-- Add GPS/telematics columns to assets for Samsara webhook intake
-- samsara_vehicle_id is NOT added — asset_external_links is the canonical external ID path

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS last_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS last_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS last_gps_update TIMESTAMPTZ;
