-- TruckZen Patch 18 — DB Constraints for Status Truth
--
-- Adds CHECK constraints backing two columns whose canonical truth was
-- centralized at the application layer in earlier patches:
--   - so_lines.line_status  → src/lib/state/line-status.ts:VALID_LINE_STATUSES
--   - so_lines.parts_status → src/lib/parts-status.ts:VALID_PARTS_STATUSES
--
-- Both columns are already validated inline by the so-lines PATCH route
-- (src/app/api/so-lines/[id]/route.ts:183, :190), but DB-level enforcement
-- ensures that future routes, scripts, manual writes, or migrations cannot
-- silently reintroduce drift values. The constraints are added with NOT
-- VALID so existing rows are not re-checked at migration time — only new
-- INSERTs and UPDATEs that touch these columns must satisfy them. A
-- subsequent patch can run VALIDATE CONSTRAINT after a data audit confirms
-- zero legacy values, fully enforcing the constraint on every row.
--
-- Out of scope (deliberately not added in this migration):
--   - invoices.status: already enforced via the public.invoice_status ENUM
--     type at the DB level. Redundant.
--   - estimates.status: already has estimates_status_check in the baseline
--     schema. Redundant.
--   - service_orders.status (WOStatus): includes legacy aliases
--     ('not_approved','ready_final_inspection','failed_inspection') that
--     are not keys in the route's transition map; not a stable set.
--   - service_orders.invoice_status: transition map intentionally accepts
--     alias values ('pending_accounting','accounting_approved',
--     'sent_to_customer'); not a stable canonical set.
--   - Historical-immutability triggers on invoices/service_orders:
--     /api/fullbay/sync/financial-repull legitimately updates historical
--     invoice rows for financial corrections; a hard immutability trigger
--     would break that flow. Left to a future patch that designs a safe
--     bypass mechanism (e.g., service-role security definer + audit).
--
-- Reversal (rollback):
--   ALTER TABLE public.so_lines DROP CONSTRAINT so_lines_line_status_check;
--   ALTER TABLE public.so_lines DROP CONSTRAINT so_lines_parts_status_check;

ALTER TABLE public.so_lines
  ADD CONSTRAINT so_lines_line_status_check
  CHECK (line_status IN (
    'unassigned',
    'pending_review',
    'approved',
    'in_progress',
    'completed'
  ))
  NOT VALID;

ALTER TABLE public.so_lines
  ADD CONSTRAINT so_lines_parts_status_check
  CHECK (parts_status IN (
    'rough',
    'sourced',
    'ordered',
    'received',
    'ready_for_job',
    'picked_up',
    'installed',
    'canceled'
  ))
  NOT VALID;
