-- HulkMode1 Migration 1: Schema Only
-- Phase 1 foundation for two-lane workorder architecture

-- 1. Extend service_orders (live workorders table) with lane/family columns
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS workorder_lane TEXT;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS status_family TEXT;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS lane_status TEXT;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS financial_owner_domain TEXT;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS billing_relationship TEXT;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS repair_location_type TEXT;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS origin_service_request_id UUID;

-- CHECK constraints
ALTER TABLE service_orders ADD CONSTRAINT chk_workorder_lane CHECK (workorder_lane IS NULL OR workorder_lane IN ('shop_internal','maintenance_external'));
ALTER TABLE service_orders ADD CONSTRAINT chk_status_family CHECK (status_family IS NULL OR status_family IN ('draft','open','waiting','active','done','closed','void'));
ALTER TABLE service_orders ADD CONSTRAINT chk_financial_owner_domain CHECK (financial_owner_domain IS NULL OR financial_owner_domain IN ('shop_accounting','fleet_accounting'));
ALTER TABLE service_orders ADD CONSTRAINT chk_billing_relationship CHECK (billing_relationship IS NULL OR billing_relationship IN ('external_customer','internal_company_repair','outside_vendor_repair','warranty','owner_operator'));
ALTER TABLE service_orders ADD CONSTRAINT chk_repair_location_type CHECK (repair_location_type IS NULL OR repair_location_type IN ('ugl_shop','connected_shop','external_vendor','roadside','yard'));

-- Lane immutability trigger
CREATE OR REPLACE FUNCTION prevent_lane_change() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.workorder_lane IS NOT NULL AND NEW.workorder_lane IS DISTINCT FROM OLD.workorder_lane THEN
    RAISE EXCEPTION 'workorder_lane is immutable once set';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_lane_change BEFORE UPDATE ON service_orders
  FOR EACH ROW EXECUTE FUNCTION prevent_lane_change();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_so_workorder_lane ON service_orders(workorder_lane) WHERE workorder_lane IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_so_status_family ON service_orders(status_family) WHERE status_family IS NOT NULL;

-- 2. Extend service_requests for future routing
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS request_lane TEXT;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS requesting_department TEXT;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS target_shop_id UUID;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS target_department TEXT;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS request_type TEXT;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS converted_workorder_id UUID;

-- 3. Create worker_profiles
CREATE TABLE IF NOT EXISTS worker_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  shop_id UUID NOT NULL REFERENCES shops(id),
  department TEXT,
  workflow_lane TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, shop_id),
  CONSTRAINT chk_wp_workflow_lane CHECK (workflow_lane IS NULL OR workflow_lane IN ('shop_internal','maintenance_external','multi_lane'))
);

-- 4. Create asset_external_links
CREATE TABLE IF NOT EXISTS asset_external_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  external_secondary_id TEXT,
  match_method TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, external_id)
);
CREATE INDEX IF NOT EXISTS idx_ael_asset ON asset_external_links(asset_id);
