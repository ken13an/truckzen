-- Per-line parts movement state columns on so_lines.
--
-- Reservation-home audit (2026-05-03) proved:
--   * so_lines (rows where line_type='part') is the canonical live owner of
--     per-line parts demand. Service writer add, mechanic pickup confirm, and
--     parts side display all read/write the same so_lines row.
--   * parts.reserved is dormant and must NOT be reused — global counter
--     re-creates the very opacity the deprecation just removed.
--   * A dedicated reservation table is overkill — every read would JOIN
--     against a table that holds at most one row per so_lines row.
--
-- This migration adds four integer quantity columns to so_lines that capture
-- the partial movement state per line:
--
--   reserved_qty         currently held against this line, not yet picked up
--   picked_up_qty        currently with the mechanic, not yet installed/returned
--   installed_qty        cumulative installed/consumed (terminal, monotonic up)
--   returned_unused_qty  cumulative returned to inventory (terminal, monotonic up)
--
-- Sum invariant on part rows:
--   reserved_qty + picked_up_qty + installed_qty + returned_unused_qty
--     <= COALESCE(quantity, 1)
--
-- Quantity column rationale: so_lines.quantity (numeric(8,2)) is the live
-- ordered-qty truth used by recalcTotals (src/app/api/so-lines/route.ts:20)
-- and the generated total_price column. parts_quantity exists but is not on
-- the hot path. The invariant binds against quantity so it stays consistent
-- with the rest of the line math.
--
-- Scope discipline:
--   * No RPCs in this patch. reserve/pickup/return/consume writers come next.
--   * No stock_movements changes. The qty_delta_nonzero CHECK question for
--     state-only events (pickup, install) belongs to the movement-RPC patch.
--   * No parts.reserved removal — still preserved for export back-compat.
--   * No route, UI, or invoice changes.

BEGIN;

-- ── 1. Add the four current-state projection columns ───────────────────────
ALTER TABLE public.so_lines
  ADD COLUMN IF NOT EXISTS reserved_qty        integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS picked_up_qty       integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS installed_qty       integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS returned_unused_qty integer NOT NULL DEFAULT 0;

-- Existing rows (labor, part, sublet, fee) all get 0 via the column DEFAULT,
-- so no separate UPDATE backfill is required and no row becomes invalid.

COMMENT ON COLUMN public.so_lines.reserved_qty IS
  'Per-line parts movement state: quantity currently reserved against this line and not yet picked up. Decreases on pickup (moves to picked_up_qty) or on release-before-pickup. Only meaningful on rows where line_type=part. Future reserve/pickup/return/consume RPCs are the only writers.';
COMMENT ON COLUMN public.so_lines.picked_up_qty IS
  'Per-line parts movement state: quantity currently with the mechanic — picked up but not yet installed or returned. Decreases on return-unused or on install. Only meaningful on rows where line_type=part.';
COMMENT ON COLUMN public.so_lines.installed_qty IS
  'Per-line parts movement state: cumulative installed/consumed quantity. Terminal, monotonic up. Only meaningful on rows where line_type=part.';
COMMENT ON COLUMN public.so_lines.returned_unused_qty IS
  'Per-line parts movement state: cumulative returned-unused quantity. Terminal, monotonic up. Only meaningful on rows where line_type=part.';

-- ── 2. Non-negative integrity (covers all rows; NOT NULL DEFAULT 0 means
--      existing rows already satisfy this) ──────────────────────────────────
ALTER TABLE public.so_lines
  ADD CONSTRAINT so_lines_movement_qty_nonneg CHECK (
    reserved_qty        >= 0
    AND picked_up_qty       >= 0
    AND installed_qty       >= 0
    AND returned_unused_qty >= 0
  );

-- ── 3. Sum invariant on part rows only ─────────────────────────────────────
-- Non-part rows (labor/sublet/fee) are excluded so the existing service-line
-- shapes are not constrained. On part rows, the four-state sum can never
-- exceed the line's ordered quantity. Existing part rows have all four
-- counters at 0, so the constraint passes immediately.
ALTER TABLE public.so_lines
  ADD CONSTRAINT so_lines_movement_qty_sum_le_quantity CHECK (
    line_type <> 'part'
    OR (reserved_qty + picked_up_qty + installed_qty + returned_unused_qty)
         <= COALESCE(quantity, 1)
  );

COMMIT;
