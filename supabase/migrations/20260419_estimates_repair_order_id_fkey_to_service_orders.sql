-- Repoint public.estimates.repair_order_id from public.repair_orders(id)
-- to public.service_orders(id). The 2026-04-19 audit proved:
--   * the column's FK target (public.repair_orders) is a dormant parallel
--     table with zero rows and zero application readers;
--   * every current writer and reader in src/ treats this column as a
--     service_orders.id (create_from_wo writes woId into it; respond/pdf/
--     send/portal routes all query public.service_orders by this value);
--   * production public.estimates has zero rows, so no data cleanup is
--     required and no row can violate the new FK.
--
-- Schema-only. No data mutation. NOT NULL and ON DELETE CASCADE both
-- preserved. Uses the same constraint name to keep grep history and
-- any future references stable.

BEGIN;

ALTER TABLE public.estimates
  DROP CONSTRAINT IF EXISTS estimates_repair_order_id_fkey;

ALTER TABLE public.estimates
  ADD CONSTRAINT estimates_repair_order_id_fkey
  FOREIGN KEY (repair_order_id)
  REFERENCES public.service_orders(id)
  ON DELETE CASCADE;

COMMIT;
