-- Repoint estimate_lines.repair_order_line_id from legacy public.repair_order_lines(id)
-- to live public.so_lines(id), so create_from_wo can snapshot real work-order lines
-- into estimate_lines. Mirrors the earlier repoint of estimates.repair_order_id to
-- service_orders (commit c87261b0).
--
-- Safety: nullable column, ON DELETE SET NULL preserved. Precheck confirmed zero
-- orphan rows and zero estimate_lines rows, so this is a definition-only change.

BEGIN;

ALTER TABLE public.estimate_lines
  DROP CONSTRAINT IF EXISTS estimate_lines_repair_order_line_id_fkey;

ALTER TABLE public.estimate_lines
  ADD CONSTRAINT estimate_lines_repair_order_line_id_fkey
  FOREIGN KEY (repair_order_line_id)
  REFERENCES public.so_lines(id)
  ON DELETE SET NULL;

COMMIT;
