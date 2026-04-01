-- HulkMode3: Auto-sync status_family on UPDATE (not just INSERT)

CREATE OR REPLACE FUNCTION set_status_family() RETURNS TRIGGER AS $$
BEGIN
  -- On INSERT: set status_family if NULL
  -- On UPDATE: re-map status_family when status actually changes
  IF TG_OP = 'INSERT' THEN
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
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.status_family := CASE NEW.status::text
        WHEN 'draft' THEN 'draft'
        WHEN 'waiting_approval' THEN 'waiting'
        WHEN 'in_progress' THEN 'active'
        WHEN 'done' THEN 'done'
        WHEN 'void' THEN 'void'
        ELSE NEW.status_family
      END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_status_family_update ON service_orders;
CREATE TRIGGER trg_set_status_family_update BEFORE UPDATE ON service_orders
  FOR EACH ROW EXECUTE FUNCTION set_status_family();
