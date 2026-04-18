-- Schema sync: add missing deleted_at column to public.estimates.
-- Audit (2026-04-18) proved the column was absent in production even though
-- 20260323_soft_delete.sql tried to add it earlier. Existing app code in
-- GET /api/estimates and POST /api/estimates action=create_from_wo already
-- references estimates.deleted_at, so the column must exist before any new
-- estimate-flow patch (soft idempotency, unique open index, Send Estimate UI)
-- can ship.
--
-- Idempotent. No data mutation. No constraint change. No status touch.

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_estimates_deleted_at
  ON public.estimates (deleted_at)
  WHERE deleted_at IS NOT NULL;
