-- ============================================================
-- Soft Delete / Trash System
-- Adds deleted_at column to all major entities, creates purge
-- function for 45-day retention, and schedules nightly cleanup.
-- ============================================================

-- 1. Add deleted_at columns
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE parts_requests ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE so_time_entries ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE kiosk_checkins ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Indexes for performance (partial index — only non-null for trash queries)
CREATE INDEX IF NOT EXISTS idx_service_orders_deleted_at ON service_orders(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON customers(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assets_deleted_at ON assets(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_parts_deleted_at ON parts(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_requests_deleted_at ON service_requests(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_estimates_deleted_at ON estimates(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_deleted_at ON invoices(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_deleted_at ON purchase_orders(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_parts_requests_deleted_at ON parts_requests(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_so_time_entries_deleted_at ON so_time_entries(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kiosk_checkins_deleted_at ON kiosk_checkins(deleted_at) WHERE deleted_at IS NOT NULL;

-- 3. Auto-purge function: hard deletes records in trash > 45 days
CREATE OR REPLACE FUNCTION purge_old_deleted_records()
RETURNS void AS $$
BEGIN
  DELETE FROM service_orders WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '45 days';
  DELETE FROM customers WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '45 days';
  DELETE FROM assets WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '45 days';
  DELETE FROM parts WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '45 days';
  DELETE FROM users WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '45 days';
  DELETE FROM service_requests WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '45 days';
  DELETE FROM estimates WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '45 days';
  DELETE FROM invoices WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '45 days';
  DELETE FROM purchase_orders WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '45 days';
  DELETE FROM parts_requests WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '45 days';
  DELETE FROM so_time_entries WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '45 days';
  DELETE FROM kiosk_checkins WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '45 days';
END;
$$ LANGUAGE plpgsql;

-- 4. Schedule nightly purge at 2 AM UTC via pg_cron
-- (Run manually in Supabase dashboard if pg_cron not available in migrations)
-- SELECT cron.schedule('purge-deleted-records', '0 2 * * *', 'SELECT purge_old_deleted_records();');
