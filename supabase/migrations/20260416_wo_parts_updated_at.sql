-- Stability_Patch02_WoParts_UpdatedAt_Schema
-- Adds updated_at column + trigger to wo_parts so the same concurrency
-- pattern (expected_updated_at precondition on PATCH) can be enforced.

BEGIN;

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

ALTER TABLE wo_parts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE wo_parts
SET updated_at = COALESCE(updated_at, created_at, NOW())
WHERE updated_at IS NULL;

ALTER TABLE wo_parts
  ALTER COLUMN updated_at SET NOT NULL;

DROP TRIGGER IF EXISTS trg_wo_parts_updated ON wo_parts;
CREATE TRIGGER trg_wo_parts_updated
  BEFORE UPDATE ON wo_parts
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMIT;
