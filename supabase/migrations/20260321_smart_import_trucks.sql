-- Prompt 7: Smart Import — Bulk truck upload support

-- Add import_batch_id to assets for undo capability
ALTER TABLE assets
ADD COLUMN IF NOT EXISTS import_batch_id UUID;

-- Import history table
CREATE TABLE IF NOT EXISTS import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL,
  import_type VARCHAR NOT NULL,  -- 'trucks' | 'parts' | 'customers'
  batch_id UUID NOT NULL,
  total_rows INT DEFAULT 0,
  imported_rows INT DEFAULT 0,
  skipped_rows INT DEFAULT 0,
  status VARCHAR DEFAULT 'completed',
  error_report JSONB,
  imported_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  undo_available_until TIMESTAMPTZ
);
