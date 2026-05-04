-- Manual on_hand adjust RPC: atomic qty mutation + stock_movements ledger.
--
-- Readiness audit (2026-05-02) proved the prior path in
-- src/app/api/parts/[id]/route.ts performed the parts.on_hand UPDATE and
-- the stock_movements INSERT in two separate awaits — race window where
-- a qty mutation could land without a matching ledger row.
--
-- This migration adds public.parts_manual_adjust_apply: a single
-- SECURITY DEFINER function modeled on po_receive_apply that performs
-- both writes inside one Postgres transaction:
--   1. Lock the parts row (FOR UPDATE), shop-scoped
--   2. Compute before_qty / after_qty / qty_delta
--   3. If qty_delta = 0: no-op, return current row, no ledger write
--   4. If qty_delta <> 0:
--        UPDATE parts.on_hand + bump updated_at
--        INSERT stock_movements (movement_type='manual_adjust') with
--          actor_user_id and notes (reason) attribution
--   5. Return the refreshed parts row as jsonb
--
-- Establishes the canonical atomic writer pattern that future movement
-- RPCs (WO reserve, mechanic pickup/return/install) must copy. The route
-- continues to handle non-on_hand parts fields and field-history writes
-- separately; this RPC owns only the qty + ledger atomicity contract.

BEGIN;

CREATE OR REPLACE FUNCTION public.parts_manual_adjust_apply(
  p_part_id       uuid,
  p_shop_id       uuid,
  p_new_on_hand   integer,
  p_reason        text DEFAULT NULL,
  p_actor_user_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_before_qty integer;
  v_after_qty  integer;
  v_qty_delta  integer;
  v_now        timestamptz := now();
  v_response   jsonb;
BEGIN
  -- 0. Input shape guard.
  IF p_part_id IS NULL OR p_shop_id IS NULL THEN
    RAISE EXCEPTION 'parts_manual_adjust_apply: p_part_id and p_shop_id are required'
      USING ERRCODE = '22023';
  END IF;
  IF p_new_on_hand IS NULL OR p_new_on_hand < 0 THEN
    RAISE EXCEPTION 'parts_manual_adjust_apply: p_new_on_hand must be a non-negative integer'
      USING ERRCODE = '22023';
  END IF;

  -- 1. Lock the part row (shop-scoped) and read before-state under the
  --    same transaction as the upcoming UPDATE + ledger INSERT.
  SELECT on_hand
    INTO v_before_qty
    FROM public.parts
   WHERE id = p_part_id AND shop_id = p_shop_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'parts_manual_adjust_apply: part not found for shop'
      USING ERRCODE = 'P0002';
  END IF;

  v_after_qty := p_new_on_hand;
  v_qty_delta := v_after_qty - COALESCE(v_before_qty, 0);

  -- 2. Atomic qty mutation + ledger insert. qty_delta=0 is a no-op:
  --    no UPDATE, no ledger row, consistent with the prior route which
  --    also skipped the ledger write when on_hand did not change.
  IF v_qty_delta <> 0 THEN
    UPDATE public.parts
       SET on_hand    = v_after_qty,
           updated_at = v_now
     WHERE id = p_part_id AND shop_id = p_shop_id;

    INSERT INTO public.stock_movements (
      shop_id, part_id, movement_type, qty_delta, before_qty, after_qty,
      source_table, source_id, actor_user_id, notes
    )
    VALUES (
      p_shop_id,
      p_part_id,
      'manual_adjust',
      v_qty_delta,
      COALESCE(v_before_qty, 0),
      v_after_qty,
      'parts',
      p_part_id,
      p_actor_user_id,
      p_reason
    );
  END IF;

  -- 3. Return the refreshed parts row so the route can keep its existing
  --    response contract without an extra round-trip SELECT.
  SELECT to_jsonb(pt.*)
    INTO v_response
    FROM public.parts pt
   WHERE pt.id = p_part_id AND pt.shop_id = p_shop_id;

  RETURN v_response;
END;
$$;

-- Lock the function definition to the table owner so SECURITY DEFINER
-- cannot be hijacked via an attacker-controlled search_path (matches the
-- po_receive_apply hardening).
ALTER FUNCTION public.parts_manual_adjust_apply(uuid, uuid, integer, text, uuid)
  OWNER TO postgres;

REVOKE ALL ON FUNCTION public.parts_manual_adjust_apply(uuid, uuid, integer, text, uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.parts_manual_adjust_apply(uuid, uuid, integer, text, uuid)
  TO authenticated, service_role;

COMMIT;
