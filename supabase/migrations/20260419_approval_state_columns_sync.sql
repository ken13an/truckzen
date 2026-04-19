-- Sync production schema to app-code expectations for estimate approval.
-- The 2026-04-19 approval-state audit proved:
--   * estimates.customer_notes is missing in prod but referenced by
--     /api/work-orders/[id] SELECT (route.ts:74), the estimates PATCH
--     handler (allowlist at [id]/route.ts:85), the portal respond route
--     approve_with_notes branch ([id]/respond/route.ts:66), and the WO
--     page approve body (page.tsx:2936). The missing column breaks the
--     /api/work-orders/[id] estimate join with 400, cascades to
--     wo.estimates[0].updated_at being undefined, and makes Approve In
--     Person fail with 400 "expected_updated_at is required".
--   * service_orders.approval_method is missing in prod but referenced by
--     /api/estimates/[id]/respond/route.ts:54,79 when propagating the
--     customer's approval back to the WO. Because the route does not
--     check that update's error, the portal returns success while the
--     service-writer side silently stays unsynced.
--
-- Part B: one-row divergence repair. The 2026-04-19 smoke-test WO
-- (id=8b0a35b2-31ec-442f-a365-f8c32cc08285 / WO-123571) has an
-- approved estimate row but service_orders still reports sent/not
-- approved. The update is scoped by exact id and guarded so a re-run
-- is a no-op after the first successful repair.
--
-- Idempotent. No other rows touched. No constraint change. No type
-- change. Adds two nullable TEXT columns.

BEGIN;

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS customer_notes TEXT;

ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS approval_method TEXT;

UPDATE public.service_orders
SET estimate_approved = true,
    estimate_status   = 'approved',
    approval_method   = 'email_portal',
    updated_at        = NOW()
WHERE id = '8b0a35b2-31ec-442f-a365-f8c32cc08285'
  AND estimate_approved IS DISTINCT FROM true
  AND EXISTS (
    SELECT 1 FROM public.estimates e
    WHERE e.id = public.service_orders.estimate_id
      AND e.status = 'approved'
  );

COMMIT;
