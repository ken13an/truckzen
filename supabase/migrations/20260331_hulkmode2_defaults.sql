-- HulkMode2: Auto-set workorder_lane + status_family on new WO creation

-- 1. DB default for workorder_lane
ALTER TABLE service_orders ALTER COLUMN workorder_lane SET DEFAULT 'shop_internal';

-- 2. Trigger to auto-set status_family from status on INSERT
CREATE OR REPLACE FUNCTION set_status_family() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status_family IS NULL AND NEW.status IS NOT NULL THEN
    NEW.status_family := CASE NEW.status::text
      WHEN 'draft' THEN 'draft'
      WHEN 'waiting_approval' THEN 'waiting'
      WHEN 'in_progress' THEN 'active'
      WHEN 'done' THEN 'done'
      WHEN 'void' THEN 'void'
      ELSE 'draft'
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_status_family ON service_orders;
CREATE TRIGGER trg_set_status_family BEFORE INSERT ON service_orders
  FOR EACH ROW EXECUTE FUNCTION set_status_family();

-- 3. Fix any existing NULL rows from post-HulkMode1 gap
UPDATE service_orders SET workorder_lane = 'shop_internal'
  WHERE workorder_lane IS NULL AND (is_historical IS NULL OR is_historical = false);
UPDATE service_orders SET status_family = CASE status::text
    WHEN 'draft' THEN 'draft'
    WHEN 'waiting_approval' THEN 'waiting'
    WHEN 'in_progress' THEN 'active'
    WHEN 'done' THEN 'done'
    WHEN 'void' THEN 'void'
    ELSE 'draft'
  END
  WHERE status_family IS NULL AND (is_historical IS NULL OR is_historical = false);
