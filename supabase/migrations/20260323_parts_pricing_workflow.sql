-- ============================================================
-- Parts Pricing Tiers & Enhanced Parts Workflow
-- ============================================================

-- 1. Add pricing tier to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS pricing_tier TEXT DEFAULT 'outside'
  CHECK (pricing_tier IN ('ugl_company', 'ugl_owner_operator', 'outside'));

COMMENT ON COLUMN customers.pricing_tier IS
  'ugl_company = UGL company trucks, ugl_owner_operator = UGL owner operators, outside = outside customers';

-- 2. Add pricing tier columns to parts table
ALTER TABLE parts ADD COLUMN IF NOT EXISTS price_ugl_company NUMERIC(10,2);
ALTER TABLE parts ADD COLUMN IF NOT EXISTS price_ugl_owner_operator NUMERIC(10,2);
ALTER TABLE parts ADD COLUMN IF NOT EXISTS price_outside NUMERIC(10,2);

-- Migrate existing sell_price to price_outside as default
UPDATE parts SET price_outside = sell_price WHERE price_outside IS NULL AND sell_price IS NOT NULL;

-- 3. Add workflow columns to parts_requests
ALTER TABLE parts_requests ADD COLUMN IF NOT EXISTS line_items JSONB DEFAULT '[]';
ALTER TABLE parts_requests ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE parts_requests ADD COLUMN IF NOT EXISTS parts_ready_at TIMESTAMPTZ;
ALTER TABLE parts_requests ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES users(id);

-- Update status check constraint (drop old if exists, add new)
-- Note: If the old constraint exists, this handles it gracefully
DO $$
BEGIN
  -- Try to drop existing constraint
  ALTER TABLE parts_requests DROP CONSTRAINT IF EXISTS parts_requests_status_check;
  -- Add new constraint with expanded statuses
  ALTER TABLE parts_requests ADD CONSTRAINT parts_requests_status_check
    CHECK (status IN ('pending', 'requested', 'reviewing', 'submitted', 'partial', 'ready', 'delivered',
                      'in_stock', 'ordered', 'rejected', 'picked_up', 'approved'));
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore if constraint doesn't exist or can't be modified
END $$;

-- 4. Index for fast parts dept dashboard queries
CREATE INDEX IF NOT EXISTS idx_parts_requests_status ON parts_requests(status, shop_id);
