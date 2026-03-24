-- Add department column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS department TEXT DEFAULT NULL;

-- Backfill department from existing roles
UPDATE users SET department = CASE
  WHEN role IN ('service_writer', 'service_manager') THEN 'service'
  WHEN role IN ('parts_manager', 'parts_staff') THEN 'parts'
  WHEN role IN ('technician', 'shop_manager', 'floor_manager', 'floor_supervisor') THEN 'floor'
  WHEN role IN ('accountant', 'accounting_manager', 'office_admin') THEN 'accounting'
  WHEN role IN ('maintenance_technician', 'maintenance_manager') THEN 'maintenance'
  WHEN role IN ('fleet_manager', 'dispatcher') THEN 'fleet'
  WHEN role = 'driver' THEN 'drivers'
  WHEN role IN ('owner', 'gm', 'it_person') THEN 'management'
  ELSE NULL
END
WHERE department IS NULL;
