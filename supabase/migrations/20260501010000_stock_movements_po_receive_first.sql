-- Stock movement ledger foundation + PO receive wire-in (first writer).
--
-- Audit (2026-05-01) proved:
--   * No canonical inventory movement / stock ledger table exists in this repo
--   * po_receive_apply already updates parts.on_hand atomically, but emits
--     no per-stock-change row for traceability
--
-- This migration:
--   1. Creates public.stock_movements as the canonical append-only ledger.
--      Indexed for (shop, part, time) and (shop, source row) queries.
--      Integrity: qty_delta <> 0  AND  after_qty = before_qty + qty_delta.
--   2. Replaces po_receive_apply(uuid, uuid, jsonb) with the same logic plus
--      a ledger INSERT branch and a new optional p_actor_user_id arg. The
--      rest of the receive math (line lock, delta compute, quantity_received
--      truth, received_at flip, parts.on_hand clamp, header status/date
--      recompute, response shape) is preserved exactly.
--
-- Ledger semantics for this patch:
--   * qty_delta records the APPLIED stock change (after_qty - before_qty),
--     not the raw requested delta. This keeps the integrity check honest
--     even when the existing GREATEST(...,0) clamp prevents negative stock.
--     A clamped no-op (before=0, requested<0, after=0) inserts no row.
--   * Only PO-receive flow writes here in this patch. Manual edits, imports,
--     lifecycle decrement, etc. are intentionally NOT wired — separate
--     follow-up patches per the audit plan.

BEGIN;

-- ── 1. Canonical ledger table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         uuid NOT NULL REFERENCES public.shops(id),
  part_id         uuid NOT NULL REFERENCES public.parts(id),
  movement_type   text NOT NULL,
  qty_delta       integer NOT NULL,
  before_qty      integer NOT NULL,
  after_qty       integer NOT NULL,
  source_table    text NULL,
  source_id       uuid NULL,
  actor_user_id   uuid NULL REFERENCES auth.users(id),
  notes           text NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_movements_qty_delta_nonzero  CHECK (qty_delta <> 0),
  CONSTRAINT stock_movements_qty_delta_balanced CHECK (after_qty = before_qty + qty_delta)
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_shop_part_time
  ON public.stock_movements (shop_id, part_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movements_shop_source
  ON public.stock_movements (shop_id, source_table, source_id);

-- ── 2. Replace po_receive_apply with the 4-arg signature ────────────────────
-- DROP first because CREATE OR REPLACE FUNCTION cannot alter the argument
-- list. The default-null on the new parameter keeps existing 3-arg callers
-- working after the migration applies (Supabase rpc-by-name resolves to the
-- 4-arg function with p_actor_user_id = null) so a code/migration deploy
-- skew window cannot break the live route.
DROP FUNCTION IF EXISTS public.po_receive_apply(uuid, uuid, jsonb);

CREATE OR REPLACE FUNCTION public.po_receive_apply(
  p_po_id         uuid,
  p_shop_id       uuid,
  p_updates       jsonb,
  p_actor_user_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_po_status        text;
  v_po_received_date date;
  v_now              timestamptz := now();
  v_response         jsonb;
BEGIN
  -- 0. Input shape guard.
  IF p_po_id IS NULL OR p_shop_id IS NULL THEN
    RAISE EXCEPTION 'po_receive_apply: p_po_id and p_shop_id are required'
      USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_updates) <> 'array' THEN
    RAISE EXCEPTION 'po_receive_apply: p_updates must be a jsonb array'
      USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_updates) = 0 THEN
    RAISE EXCEPTION 'po_receive_apply: lines required'
      USING ERRCODE = '22023';
  END IF;

  -- 1. Lock the PO row + verify shop scope.
  SELECT status, received_date
    INTO v_po_status, v_po_received_date
    FROM public.purchase_orders
   WHERE id = p_po_id AND shop_id = p_shop_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'po_receive_apply: purchase order not found for shop'
      USING ERRCODE = 'P0002';
  END IF;

  -- 2. Lock + load every line on this PO under the same transaction.
  CREATE TEMP TABLE tmp_po_lines_locked ON COMMIT DROP AS
  SELECT id, part_id, quantity, quantity_received, received_at
    FROM public.purchase_order_lines
   WHERE purchase_order_id = p_po_id
   FOR UPDATE;

  -- 3. Parse the input array into a typed staging set and validate.
  CREATE TEMP TABLE tmp_po_updates_in ON COMMIT DROP AS
  SELECT
    (j->>'id')::uuid           AS id,
    (j->>'quantity_received')::numeric AS new_qr
    FROM jsonb_array_elements(p_updates) AS j;

  IF EXISTS (
    SELECT 1
      FROM tmp_po_updates_in u
     WHERE NOT EXISTS (
       SELECT 1 FROM tmp_po_lines_locked l WHERE l.id = u.id
     )
  ) THEN
    RAISE EXCEPTION 'po_receive_apply: line does not belong to this PO'
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM tmp_po_updates_in
     WHERE new_qr IS NULL OR new_qr < 0
  ) THEN
    RAISE EXCEPTION 'po_receive_apply: quantity_received must be a non-negative number'
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM tmp_po_updates_in u
      JOIN tmp_po_lines_locked l ON l.id = u.id
     WHERE l.quantity IS NOT NULL
       AND u.new_qr > l.quantity
  ) THEN
    RAISE EXCEPTION 'po_receive_apply: quantity_received exceeds ordered quantity'
      USING ERRCODE = 'P0001';
  END IF;

  -- 4. Stage per-line delta against the locked snapshot.
  CREATE TEMP TABLE tmp_po_deltas ON COMMIT DROP AS
  SELECT
    u.id,
    l.part_id,
    l.quantity_received      AS old_qr,
    u.new_qr                 AS new_qr,
    (u.new_qr - l.quantity_received) AS delta,
    l.received_at            AS old_received_at
    FROM tmp_po_updates_in u
    JOIN tmp_po_lines_locked l ON l.id = u.id;

  -- 5. Bulk-update line truth. received_at flips on first receive and clears
  --    when receive is reversed back to zero; otherwise preserve.
  UPDATE public.purchase_order_lines p
     SET quantity_received = d.new_qr,
         received_at = CASE
           WHEN d.new_qr > 0 AND COALESCE(d.old_qr, 0) = 0 THEN v_now
           WHEN d.new_qr = 0 AND COALESCE(d.old_qr, 0) > 0 THEN NULL
           ELSE d.old_received_at
         END
    FROM tmp_po_deltas d
   WHERE p.id = d.id
     AND p.purchase_order_id = p_po_id;

  -- 6a. Capture pre-update parts snapshot for the ledger insert below. Lock
  --     the same parts rows the upcoming UPDATE will touch so we read
  --     before-state under the same row locks held until commit.
  CREATE TEMP TABLE tmp_parts_pre ON COMMIT DROP AS
  SELECT pt.id AS part_id, pt.on_hand AS pre_on_hand
    FROM public.parts pt
   WHERE pt.shop_id = p_shop_id
     AND pt.id IN (
       SELECT part_id
         FROM tmp_po_deltas
        WHERE part_id IS NOT NULL
          AND delta <> 0
     )
   FOR UPDATE;

  -- 6b. Apply stock truth. Existing math preserved exactly. Only lines with
  --     a real part_id and a non-zero delta touch parts. Negative delta
  --     decrements; clamp at 0 so a stale on_hand cannot go negative through
  --     corrective edits.
  UPDATE public.parts pt
     SET on_hand    = GREATEST(pt.on_hand + d.delta, 0),
         updated_at = v_now
    FROM tmp_po_deltas d
   WHERE d.part_id IS NOT NULL
     AND d.delta <> 0
     AND pt.id = d.part_id
     AND pt.shop_id = p_shop_id;

  -- 6c. Ledger insert. qty_delta records the APPLIED stock change
  --     (after_qty - before_qty), not the raw requested delta. Skip rows
  --     where the clamp produced no actual stock movement (clamped no-op).
  INSERT INTO public.stock_movements (
    shop_id, part_id, movement_type, qty_delta, before_qty, after_qty,
    source_table, source_id, actor_user_id, notes
  )
  SELECT
    p_shop_id,
    d.part_id,
    'receive',
    (pt.on_hand - pre.pre_on_hand)::integer,
    pre.pre_on_hand::integer,
    pt.on_hand::integer,
    'purchase_order_lines',
    d.id,
    p_actor_user_id,
    NULL
    FROM tmp_po_deltas d
    JOIN tmp_parts_pre pre ON pre.part_id = d.part_id
    JOIN public.parts pt   ON pt.id        = d.part_id AND pt.shop_id = p_shop_id
   WHERE d.part_id IS NOT NULL
     AND d.delta <> 0
     AND pt.on_hand <> pre.pre_on_hand;

  -- 7. Recompute PO header truth from the just-written full line state.
  --    Status flips:
  --      all lines fully received -> 'received' (set received_date if absent)
  --      any line received        -> 'partially_received'
  --      otherwise                -> preserve current status
  WITH ls AS (
    SELECT
      COUNT(*)                                                            AS line_count,
      COUNT(*) FILTER (WHERE quantity_received >= COALESCE(quantity, 0)) AS fully_count,
      COALESCE(SUM(quantity_received), 0)                                 AS total_qr
      FROM public.purchase_order_lines
     WHERE purchase_order_id = p_po_id
  )
  UPDATE public.purchase_orders po
     SET status = CASE
           WHEN ls.line_count > 0 AND ls.fully_count = ls.line_count THEN 'received'
           WHEN ls.total_qr > 0                                        THEN 'partially_received'
           ELSE po.status
         END,
         received_date = CASE
           WHEN ls.line_count > 0 AND ls.fully_count = ls.line_count
             THEN COALESCE(po.received_date, CURRENT_DATE)
           ELSE po.received_date
         END,
         updated_at = v_now
    FROM ls
   WHERE po.id = p_po_id AND po.shop_id = p_shop_id;

  -- 8. Build the response shape that the route patch can return verbatim:
  --    PO fields at top level + lines array.
  SELECT
    jsonb_build_object(
      'id',            po.id,
      'po_number',     po.po_number,
      'vendor_name',   po.vendor_name,
      'status',        po.status,
      'total',         po.total,
      'received_date', po.received_date,
      'expected_date', po.expected_date,
      'source',        po.source,
      'fullbay_id',    po.fullbay_id,
      'created_at',    po.created_at,
      'lines', COALESCE(
        (SELECT jsonb_agg(
                  jsonb_build_object(
                    'id',                l.id,
                    'part_id',           l.part_id,
                    'part_number',       l.part_number,
                    'description',       l.description,
                    'quantity',          l.quantity,
                    'quantity_received', l.quantity_received,
                    'received_at',       l.received_at,
                    'cost_price',        l.cost_price,
                    'sell_price',        l.sell_price,
                    'created_at',        l.created_at
                  )
                  ORDER BY l.created_at ASC
                )
           FROM public.purchase_order_lines l
          WHERE l.purchase_order_id = po.id),
        '[]'::jsonb
      )
    )
    INTO v_response
    FROM public.purchase_orders po
   WHERE po.id = p_po_id AND po.shop_id = p_shop_id;

  RETURN v_response;
END;
$$;

-- Lock the function definition to the table owner so SECURITY DEFINER cannot
-- be hijacked via an attacker-controlled search_path.
ALTER FUNCTION public.po_receive_apply(uuid, uuid, jsonb, uuid) OWNER TO postgres;

-- Allow the supabase service-role + authenticated callers to invoke the RPC.
-- Route auth/shop-scope is already enforced by the API layer; the function
-- itself also re-validates p_shop_id against the PO row.
REVOKE ALL ON FUNCTION public.po_receive_apply(uuid, uuid, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.po_receive_apply(uuid, uuid, jsonb, uuid)
  TO authenticated, service_role;

COMMIT;
