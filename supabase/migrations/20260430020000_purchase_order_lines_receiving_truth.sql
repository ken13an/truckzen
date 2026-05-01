-- Canonical PO-line receiving truth.
-- Additive only: adds quantity_received and received_at to the canonical
-- active table purchase_order_lines so canonical TruckZen PO flow can
-- track partial/full receipt without switching to dormant po_lines.

ALTER TABLE public.purchase_order_lines
  ADD COLUMN IF NOT EXISTS quantity_received numeric(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.purchase_order_lines
  ADD COLUMN IF NOT EXISTS received_at timestamp with time zone;

-- non-negative received qty
ALTER TABLE public.purchase_order_lines
  DROP CONSTRAINT IF EXISTS purchase_order_lines_qty_received_nonneg;
ALTER TABLE public.purchase_order_lines
  ADD CONSTRAINT purchase_order_lines_qty_received_nonneg
  CHECK (quantity_received >= 0);

-- partial-receipt guard: received cannot exceed ordered when ordered is set.
-- Existing rows default to quantity_received = 0, which trivially satisfies
-- this for any non-null quantity. Rows with NULL quantity pass the CHECK
-- per SQL CHECK semantics (NULL is treated as not-failing).
ALTER TABLE public.purchase_order_lines
  DROP CONSTRAINT IF EXISTS purchase_order_lines_qty_received_lte_ordered;
ALTER TABLE public.purchase_order_lines
  ADD CONSTRAINT purchase_order_lines_qty_received_lte_ordered
  CHECK (quantity IS NULL OR quantity_received <= quantity);
