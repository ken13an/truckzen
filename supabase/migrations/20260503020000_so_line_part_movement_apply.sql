-- Per-line parts movement RPCs on so_lines.
--
-- Reservation-home + schema audits (2026-05-03) proved:
--   * so_lines (line_type='part') is the canonical home of per-line parts demand.
--   * The four projection columns reserved_qty / picked_up_qty / installed_qty /
--     returned_unused_qty are populated only via atomic RPCs (this migration).
--   * stock_movements remains the append-only ledger; only inventory-moving
--     events (reserve, return_unused) write rows here, since the existing
--     stock_movements_qty_delta_nonzero CHECK forbids qty_delta=0 rows. The
--     state-only events (pickup, consume) update so_lines projection columns
--     and the parts_status compatibility flag — no ledger row in this patch.
--     A separate audit log for state-only events is deferred to a future
--     patch per the design.
--
-- This migration adds four SECURITY DEFINER RPCs modeled on po_receive_apply:
--
--   so_line_part_reserve_apply        inventory event: -on_hand,  +reserved_qty
--   so_line_part_pickup_apply         state event:    reserved -> picked_up
--   so_line_part_return_unused_apply  inventory event: +on_hand,  +returned_unused_qty
--   so_line_part_consume_apply        state event:    picked_up -> installed
--
-- Inventory rules:
--   reserve   : parts.on_hand -= qty;   reserved_qty += qty           (writes ledger)
--   pickup    : reserved_qty -= LEAST(reserved_qty, qty);
--               picked_up_qty += qty                                  (no ledger, no on_hand)
--   return    : picked_up_qty -= qty;   returned_unused_qty += qty;
--               parts.on_hand += qty                                  (writes ledger)
--   consume   : picked_up_qty -= LEAST(picked_up_qty, qty);
--               reserved_qty  -= LEAST(reserved_qty, qty - drained_picked);
--               installed_qty += qty                                  (no ledger, no on_hand)
--
-- Pickup and consume are LENIENT for the transition period: they accept the
-- legacy state where reserve was never wired (reserved_qty=0) by allowing
-- direct pickup/install without a prior reservation. parts.on_hand is never
-- mutated by these state-only events, so the legacy zero-inventory-effect
-- behavior is preserved exactly.
--
-- Reserve and return are STRICT: they require an explicit part_id from the
-- caller (so_lines lacks a part_id FK; lookup ambiguity is the caller's
-- problem, not the RPC's). They fail if parts.on_hand is insufficient or
-- the row is missing.
--
-- All four RPCs enforce:
--   * shop scoping (so_lines.so_id -> service_orders.shop_id match)
--   * line_type='part'
--   * positive qty
--   * the so_lines sum invariant (reserved + picked_up + installed + returned <= quantity)
--   * row lock via FOR UPDATE before any mutation
--
-- Returns: refreshed so_lines row as jsonb (mirrors parts_manual_adjust_apply
-- and po_receive_apply response shape).

BEGIN;

-- ── 1. Reserve ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.so_line_part_reserve_apply(
  p_so_line_id    uuid,
  p_shop_id       uuid,
  p_part_id       uuid,
  p_qty           integer,
  p_reason        text DEFAULT NULL,
  p_actor_user_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_line_quantity      numeric;
  v_line_type          text;
  v_reserved           integer;
  v_picked_up          integer;
  v_installed          integer;
  v_returned_unused    integer;
  v_part_before_on_hand integer;
  v_part_after_on_hand  integer;
  v_now                timestamptz := now();
  v_response           jsonb;
BEGIN
  IF p_so_line_id IS NULL OR p_shop_id IS NULL OR p_part_id IS NULL THEN
    RAISE EXCEPTION 'so_line_part_reserve_apply: p_so_line_id, p_shop_id, p_part_id are required'
      USING ERRCODE = '22023';
  END IF;
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'so_line_part_reserve_apply: p_qty must be a positive integer'
      USING ERRCODE = '22023';
  END IF;

  -- Lock so_lines row + verify shop scope via service_orders.
  SELECT sl.line_type, sl.quantity, sl.reserved_qty, sl.picked_up_qty,
         sl.installed_qty, sl.returned_unused_qty
    INTO v_line_type, v_line_quantity, v_reserved, v_picked_up,
         v_installed, v_returned_unused
    FROM public.so_lines sl
    JOIN public.service_orders so ON so.id = sl.so_id
   WHERE sl.id = p_so_line_id AND so.shop_id = p_shop_id
   FOR UPDATE OF sl;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'so_line_part_reserve_apply: so_line not found for shop'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_line_type <> 'part' THEN
    RAISE EXCEPTION 'so_line_part_reserve_apply: line_type must be part (got %)', v_line_type
      USING ERRCODE = 'P0001';
  END IF;
  IF (v_reserved + v_picked_up + v_installed + v_returned_unused + p_qty)
       > COALESCE(v_line_quantity, 1) THEN
    RAISE EXCEPTION 'so_line_part_reserve_apply: reserve would exceed line quantity (% over %)',
      (v_reserved + v_picked_up + v_installed + v_returned_unused + p_qty),
      COALESCE(v_line_quantity, 1)
      USING ERRCODE = 'P0001';
  END IF;

  -- Lock the parts row + verify shop scope. Fail if on_hand insufficient —
  -- no clamp; reserve must reflect a real available quantity.
  SELECT on_hand
    INTO v_part_before_on_hand
    FROM public.parts
   WHERE id = p_part_id AND shop_id = p_shop_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'so_line_part_reserve_apply: part not found for shop'
      USING ERRCODE = 'P0002';
  END IF;
  IF COALESCE(v_part_before_on_hand, 0) < p_qty THEN
    RAISE EXCEPTION 'so_line_part_reserve_apply: insufficient on_hand (% < %)',
      COALESCE(v_part_before_on_hand, 0), p_qty
      USING ERRCODE = 'P0001';
  END IF;

  v_part_after_on_hand := v_part_before_on_hand - p_qty;

  -- Mutate parts + so_lines in the same transaction.
  UPDATE public.parts
     SET on_hand = v_part_after_on_hand,
         updated_at = v_now
   WHERE id = p_part_id AND shop_id = p_shop_id;

  UPDATE public.so_lines
     SET reserved_qty = v_reserved + p_qty,
         updated_at   = v_now
   WHERE id = p_so_line_id;

  -- Append-only ledger row.
  INSERT INTO public.stock_movements (
    shop_id, part_id, movement_type, qty_delta, before_qty, after_qty,
    source_table, source_id, actor_user_id, notes
  )
  VALUES (
    p_shop_id, p_part_id, 'reserve', -p_qty,
    v_part_before_on_hand, v_part_after_on_hand,
    'so_lines', p_so_line_id, p_actor_user_id, p_reason
  );

  SELECT to_jsonb(sl.*) INTO v_response
    FROM public.so_lines sl WHERE sl.id = p_so_line_id;
  RETURN v_response;
END;
$$;

ALTER FUNCTION public.so_line_part_reserve_apply(uuid, uuid, uuid, integer, text, uuid)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.so_line_part_reserve_apply(uuid, uuid, uuid, integer, text, uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.so_line_part_reserve_apply(uuid, uuid, uuid, integer, text, uuid)
  TO authenticated, service_role;


-- ── 2. Pickup (lenient: drains reserved if available, else direct add) ─────
CREATE OR REPLACE FUNCTION public.so_line_part_pickup_apply(
  p_so_line_id    uuid,
  p_shop_id       uuid,
  p_qty           integer,
  p_actor_user_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_line_quantity   numeric;
  v_line_type       text;
  v_reserved        integer;
  v_picked_up       integer;
  v_installed       integer;
  v_returned_unused integer;
  v_drain_reserved  integer;
  v_now             timestamptz := now();
  v_response        jsonb;
BEGIN
  IF p_so_line_id IS NULL OR p_shop_id IS NULL THEN
    RAISE EXCEPTION 'so_line_part_pickup_apply: p_so_line_id, p_shop_id are required'
      USING ERRCODE = '22023';
  END IF;
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'so_line_part_pickup_apply: p_qty must be a positive integer'
      USING ERRCODE = '22023';
  END IF;

  SELECT sl.line_type, sl.quantity, sl.reserved_qty, sl.picked_up_qty,
         sl.installed_qty, sl.returned_unused_qty
    INTO v_line_type, v_line_quantity, v_reserved, v_picked_up,
         v_installed, v_returned_unused
    FROM public.so_lines sl
    JOIN public.service_orders so ON so.id = sl.so_id
   WHERE sl.id = p_so_line_id AND so.shop_id = p_shop_id
   FOR UPDATE OF sl;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'so_line_part_pickup_apply: so_line not found for shop'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_line_type <> 'part' THEN
    RAISE EXCEPTION 'so_line_part_pickup_apply: line_type must be part (got %)', v_line_type
      USING ERRCODE = 'P0001';
  END IF;

  v_drain_reserved := LEAST(v_reserved, p_qty);

  -- Sum invariant after the move:
  --   new_reserved + new_picked_up + installed + returned_unused
  --   = (reserved - drain_reserved) + (picked_up + p_qty) + installed + returned_unused
  IF ((v_reserved - v_drain_reserved) + (v_picked_up + p_qty)
       + v_installed + v_returned_unused) > COALESCE(v_line_quantity, 1) THEN
    RAISE EXCEPTION 'so_line_part_pickup_apply: pickup would exceed line quantity'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.so_lines
     SET reserved_qty  = v_reserved - v_drain_reserved,
         picked_up_qty = v_picked_up + p_qty,
         updated_at    = v_now
   WHERE id = p_so_line_id;

  -- State-only event: no parts.on_hand mutation, no stock_movements row
  -- (ledger CHECK requires qty_delta <> 0). Future state-event audit log
  -- belongs to a separate patch per the design.

  SELECT to_jsonb(sl.*) INTO v_response
    FROM public.so_lines sl WHERE sl.id = p_so_line_id;
  RETURN v_response;
END;
$$;

ALTER FUNCTION public.so_line_part_pickup_apply(uuid, uuid, integer, uuid)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.so_line_part_pickup_apply(uuid, uuid, integer, uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.so_line_part_pickup_apply(uuid, uuid, integer, uuid)
  TO authenticated, service_role;


-- ── 3. Return unused (strict: requires picked_up_qty >= p_qty + part_id) ───
CREATE OR REPLACE FUNCTION public.so_line_part_return_unused_apply(
  p_so_line_id    uuid,
  p_shop_id       uuid,
  p_part_id       uuid,
  p_qty           integer,
  p_reason        text DEFAULT NULL,
  p_actor_user_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_line_type           text;
  v_picked_up           integer;
  v_returned_unused     integer;
  v_part_before_on_hand integer;
  v_part_after_on_hand  integer;
  v_now                 timestamptz := now();
  v_response            jsonb;
BEGIN
  IF p_so_line_id IS NULL OR p_shop_id IS NULL OR p_part_id IS NULL THEN
    RAISE EXCEPTION 'so_line_part_return_unused_apply: p_so_line_id, p_shop_id, p_part_id are required'
      USING ERRCODE = '22023';
  END IF;
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'so_line_part_return_unused_apply: p_qty must be a positive integer'
      USING ERRCODE = '22023';
  END IF;

  SELECT sl.line_type, sl.picked_up_qty, sl.returned_unused_qty
    INTO v_line_type, v_picked_up, v_returned_unused
    FROM public.so_lines sl
    JOIN public.service_orders so ON so.id = sl.so_id
   WHERE sl.id = p_so_line_id AND so.shop_id = p_shop_id
   FOR UPDATE OF sl;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'so_line_part_return_unused_apply: so_line not found for shop'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_line_type <> 'part' THEN
    RAISE EXCEPTION 'so_line_part_return_unused_apply: line_type must be part (got %)', v_line_type
      USING ERRCODE = 'P0001';
  END IF;
  IF v_picked_up < p_qty THEN
    RAISE EXCEPTION 'so_line_part_return_unused_apply: picked_up_qty insufficient (% < %)',
      v_picked_up, p_qty
      USING ERRCODE = 'P0001';
  END IF;

  -- Lock parts row + restock.
  SELECT on_hand
    INTO v_part_before_on_hand
    FROM public.parts
   WHERE id = p_part_id AND shop_id = p_shop_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'so_line_part_return_unused_apply: part not found for shop'
      USING ERRCODE = 'P0002';
  END IF;

  v_part_after_on_hand := COALESCE(v_part_before_on_hand, 0) + p_qty;

  UPDATE public.parts
     SET on_hand = v_part_after_on_hand,
         updated_at = v_now
   WHERE id = p_part_id AND shop_id = p_shop_id;

  UPDATE public.so_lines
     SET picked_up_qty       = v_picked_up - p_qty,
         returned_unused_qty = v_returned_unused + p_qty,
         updated_at          = v_now
   WHERE id = p_so_line_id;

  INSERT INTO public.stock_movements (
    shop_id, part_id, movement_type, qty_delta, before_qty, after_qty,
    source_table, source_id, actor_user_id, notes
  )
  VALUES (
    p_shop_id, p_part_id, 'return_unused', p_qty,
    COALESCE(v_part_before_on_hand, 0), v_part_after_on_hand,
    'so_lines', p_so_line_id, p_actor_user_id, p_reason
  );

  SELECT to_jsonb(sl.*) INTO v_response
    FROM public.so_lines sl WHERE sl.id = p_so_line_id;
  RETURN v_response;
END;
$$;

ALTER FUNCTION public.so_line_part_return_unused_apply(uuid, uuid, uuid, integer, text, uuid)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.so_line_part_return_unused_apply(uuid, uuid, uuid, integer, text, uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.so_line_part_return_unused_apply(uuid, uuid, uuid, integer, text, uuid)
  TO authenticated, service_role;


-- ── 4. Consume (lenient: drains picked_up first, then reserved as fallback) ─
CREATE OR REPLACE FUNCTION public.so_line_part_consume_apply(
  p_so_line_id    uuid,
  p_shop_id       uuid,
  p_qty           integer,
  p_actor_user_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_line_quantity   numeric;
  v_line_type       text;
  v_reserved        integer;
  v_picked_up       integer;
  v_installed       integer;
  v_returned_unused integer;
  v_drain_picked    integer;
  v_drain_reserved  integer;
  v_now             timestamptz := now();
  v_response        jsonb;
BEGIN
  IF p_so_line_id IS NULL OR p_shop_id IS NULL THEN
    RAISE EXCEPTION 'so_line_part_consume_apply: p_so_line_id, p_shop_id are required'
      USING ERRCODE = '22023';
  END IF;
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'so_line_part_consume_apply: p_qty must be a positive integer'
      USING ERRCODE = '22023';
  END IF;

  SELECT sl.line_type, sl.quantity, sl.reserved_qty, sl.picked_up_qty,
         sl.installed_qty, sl.returned_unused_qty
    INTO v_line_type, v_line_quantity, v_reserved, v_picked_up,
         v_installed, v_returned_unused
    FROM public.so_lines sl
    JOIN public.service_orders so ON so.id = sl.so_id
   WHERE sl.id = p_so_line_id AND so.shop_id = p_shop_id
   FOR UPDATE OF sl;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'so_line_part_consume_apply: so_line not found for shop'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_line_type <> 'part' THEN
    RAISE EXCEPTION 'so_line_part_consume_apply: line_type must be part (got %)', v_line_type
      USING ERRCODE = 'P0001';
  END IF;

  -- Drain picked_up first (the proper source). If insufficient, fall back to
  -- reserved (transition compat for lines that skipped pickup). Anything not
  -- covered by either is a direct install (legacy path where neither reserve
  -- nor pickup were ever called) — invariant check below catches overflow.
  v_drain_picked   := LEAST(v_picked_up, p_qty);
  v_drain_reserved := LEAST(v_reserved, p_qty - v_drain_picked);

  -- New state after this consume:
  --   new_reserved   = v_reserved   - v_drain_reserved
  --   new_picked_up  = v_picked_up  - v_drain_picked
  --   new_installed  = v_installed  + p_qty
  --   returned_unused unchanged
  IF ((v_reserved - v_drain_reserved) + (v_picked_up - v_drain_picked)
       + (v_installed + p_qty) + v_returned_unused) > COALESCE(v_line_quantity, 1) THEN
    RAISE EXCEPTION 'so_line_part_consume_apply: consume would exceed line quantity'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.so_lines
     SET reserved_qty  = v_reserved   - v_drain_reserved,
         picked_up_qty = v_picked_up  - v_drain_picked,
         installed_qty = v_installed  + p_qty,
         updated_at    = v_now
   WHERE id = p_so_line_id;

  -- State-only event: no parts.on_hand change, no stock_movements row.
  -- parts.on_hand was already decremented at reserve time (when wired).
  -- Legacy direct-install qty was never on_hand to begin with.

  SELECT to_jsonb(sl.*) INTO v_response
    FROM public.so_lines sl WHERE sl.id = p_so_line_id;
  RETURN v_response;
END;
$$;

ALTER FUNCTION public.so_line_part_consume_apply(uuid, uuid, integer, uuid)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.so_line_part_consume_apply(uuid, uuid, integer, uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.so_line_part_consume_apply(uuid, uuid, integer, uuid)
  TO authenticated, service_role;

COMMIT;
