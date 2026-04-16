-- Stability_Patch02_PreReq_SoLines_UpdatedAt_Schema
-- Adds the real updated_at column and DB-maintained trigger for so_lines.
-- Prerequisite for Stability_Patch02A (caller wiring) and Stability_Patch02
-- (mandatory concurrency token). Standalone schema-only patch.

BEGIN;

-- 1. Ensure the canonical touch_updated_at() trigger function exists.
--    Idempotent: reuses the baseline helper from supabase/001_schema.sql.
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- 2. Add nullable column with default NOW(); safe on non-empty tables.
ALTER TABLE so_lines
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Backfill any NULL rows from created_at (confirmed present on so_lines).
UPDATE so_lines
SET updated_at = COALESCE(updated_at, created_at, NOW())
WHERE updated_at IS NULL;

-- 4. Enforce NOT NULL now that every row has a value.
ALTER TABLE so_lines
  ALTER COLUMN updated_at SET NOT NULL;

-- 5. Attach BEFORE UPDATE trigger so the column advances automatically.
DROP TRIGGER IF EXISTS trg_so_lines_updated ON so_lines;
CREATE TRIGGER trg_so_lines_updated
  BEFORE UPDATE ON so_lines
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMIT;
