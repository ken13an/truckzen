-- =============================================
-- SHOP LABOR RATES (already exists with ownership_type schema)
-- Columns: id, shop_id, ownership_type, rate_per_hour, updated_by, updated_at
-- 3 rows per shop: fleet_asset, owner_operator, outside_customer
-- =============================================

CREATE TABLE IF NOT EXISTS shop_labor_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id),
  ownership_type VARCHAR NOT NULL,
  rate_per_hour NUMERIC(10,2) NOT NULL DEFAULT 0,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_labor_rates_shop ON shop_labor_rates(shop_id);

-- =============================================
-- EMPLOYEE PERMISSIONS
-- Columns: id, shop_id, employee_id, manager_id, department, permissions (JSONB), updated_at
-- =============================================

CREATE TABLE IF NOT EXISTS employee_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id),
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES users(id),
  department VARCHAR NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(shop_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_permissions_shop ON employee_permissions(shop_id);
CREATE INDEX IF NOT EXISTS idx_employee_permissions_employee ON employee_permissions(employee_id);

-- RLS
ALTER TABLE employee_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_labor_rates ENABLE ROW LEVEL SECURITY;

-- Seed default labor rates for shops that don't have any
DO $$
DECLARE
  v_shop RECORD;
BEGIN
  FOR v_shop IN SELECT id FROM shops LOOP
    IF NOT EXISTS (SELECT 1 FROM shop_labor_rates WHERE shop_id = v_shop.id) THEN
      INSERT INTO shop_labor_rates (shop_id, ownership_type, rate_per_hour) VALUES
        (v_shop.id, 'fleet_asset', 95.00),
        (v_shop.id, 'owner_operator', 105.00),
        (v_shop.id, 'outside_customer', 125.00);
    END IF;
  END LOOP;
END $$;
