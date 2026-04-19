-- Supplement / change-order schema foundation.
--
-- Phase 2 audit (2026-04-19) proved TruckZen already has a partial
-- line-level supplement mechanism on so_lines:
--   * so_lines.is_additional          BOOLEAN DEFAULT false
--   * so_lines.customer_approved      BOOLEAN (null = pending)
--   * so_lines.approved_at            TIMESTAMPTZ
--   * /api/portal/[token]/estimate/new-items/approve reads/writes these
--   * /portal/[token]/page.tsx renders pending additional items for the
--     customer to approve
--
-- The mechanism is dormant because NO write path in src/ currently sets
-- is_additional=true. This migration extends the same shape to wo_parts,
-- adds batch grouping + emergency override metadata on both tables,
-- gives wo_activity_log a structured details slot, and preps estimates
-- for PDF/email tracking.
--
-- Backward-compatible: all new columns nullable or default false. No
-- NOT NULL, no FK, no existing row reclassified. No new table yet
-- (per Phase 2 Design A — batch id is just a UUID for now; a batches
-- table is optional in a later phase if it proves needed).
--
-- Applied directly via pg session for the same reason as the prior
-- schema-sync migrations: supabase_migrations.schema_migrations drift
-- makes `supabase db push` unsafe (33 pending migrations).

BEGIN;

-- wo_parts: mirror the so_lines.is_additional/customer_approved pattern
-- so parts added after estimate approval can be flagged as supplement
-- candidates the same way.
ALTER TABLE public.wo_parts
  ADD COLUMN IF NOT EXISTS is_additional BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS customer_approved BOOLEAN,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS supplement_batch_id UUID,
  ADD COLUMN IF NOT EXISTS emergency_override_by UUID,
  ADD COLUMN IF NOT EXISTS emergency_override_reason TEXT,
  ADD COLUMN IF NOT EXISTS emergency_override_at TIMESTAMPTZ;

-- so_lines: add batch id + emergency override metadata (existing
-- is_additional / customer_approved / approved_at are reused as-is).
ALTER TABLE public.so_lines
  ADD COLUMN IF NOT EXISTS supplement_batch_id UUID,
  ADD COLUMN IF NOT EXISTS emergency_override_by UUID,
  ADD COLUMN IF NOT EXISTS emergency_override_reason TEXT,
  ADD COLUMN IF NOT EXISTS emergency_override_at TIMESTAMPTZ;

-- wo_activity_log: structured details for supplement audit events.
ALTER TABLE public.wo_activity_log
  ADD COLUMN IF NOT EXISTS details JSONB;

-- estimates: optional PDF tracking for the customer email attachment work.
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS pdf_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT;

-- Partial indexes to keep portal "pending additional items" queries fast.
CREATE INDEX IF NOT EXISTS idx_so_lines_supplement_pending
  ON public.so_lines (so_id)
  WHERE is_additional = true AND customer_approved IS NULL;

CREATE INDEX IF NOT EXISTS idx_wo_parts_supplement_pending
  ON public.wo_parts (wo_id)
  WHERE is_additional = true AND customer_approved IS NULL;

CREATE INDEX IF NOT EXISTS idx_so_lines_supplement_batch
  ON public.so_lines (supplement_batch_id)
  WHERE supplement_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wo_parts_supplement_batch
  ON public.wo_parts (supplement_batch_id)
  WHERE supplement_batch_id IS NOT NULL;

COMMIT;
