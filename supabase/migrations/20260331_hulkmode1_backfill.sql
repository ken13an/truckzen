-- HulkMode1 Migration 2: Backfill Only
-- Populates new columns for existing non-historical data

-- 1. Set workorder_lane = 'shop_internal' for all non-historical WOs
UPDATE service_orders SET workorder_lane = 'shop_internal'
WHERE workorder_lane IS NULL AND (is_historical IS NULL OR is_historical = false);

-- 2. Map current status -> status_family for non-historical WOs
UPDATE service_orders SET status_family = 'draft' WHERE status::text = 'draft' AND status_family IS NULL AND (is_historical IS NULL OR is_historical = false);
UPDATE service_orders SET status_family = 'waiting' WHERE status::text = 'waiting_approval' AND status_family IS NULL AND (is_historical IS NULL OR is_historical = false);
UPDATE service_orders SET status_family = 'active' WHERE status::text = 'in_progress' AND status_family IS NULL AND (is_historical IS NULL OR is_historical = false);
UPDATE service_orders SET status_family = 'done' WHERE status::text = 'done' AND status_family IS NULL AND (is_historical IS NULL OR is_historical = false);
UPDATE service_orders SET status_family = 'void' WHERE status::text = 'void' AND status_family IS NULL AND (is_historical IS NULL OR is_historical = false);

-- 3. worker_profiles — inserted via app-level script (8 users, all shop_internal)
-- Not included in SQL backfill due to need for per-user INSERT with ON CONFLICT skip
