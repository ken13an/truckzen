-- Performance indexes for 500 concurrent users
-- All created with CONCURRENTLY to avoid table locks

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_orders_shop_status
  ON service_orders(shop_id, status) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_orders_asset
  ON service_orders(asset_id) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_service_orders_shop_status
  ON service_orders(shop_id, status) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parts_shop_status
  ON parts(shop_id, status) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parts_number
  ON parts(shop_id, part_number);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_shop
  ON customers(shop_id) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assets_customer
  ON assets(customer_id, shop_id) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_shop_status
  ON invoices(shop_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_shop_role
  ON users(shop_id, role);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, is_read) WHERE is_read = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_shop_time
  ON audit_log(shop_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_so_lines_so_id
  ON so_lines(so_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wo_parts_shop_status
  ON wo_parts(shop_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wo_job_assignments_user
  ON wo_job_assignments(user_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_time_clock_user_active
  ON time_clock_entries(user_id, status) WHERE status = 'active';
