-- Prompt 5: Platform Admin Panel — database changes

-- Add new columns to shops table
ALTER TABLE shops
ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR DEFAULT 'truckzen'
  CHECK (subscription_plan IN ('truckzen', 'truckzen_pro', 'enterprise'));

ALTER TABLE shops
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR DEFAULT 'trial'
  CHECK (subscription_status IN ('trial', 'active', 'past_due', 'cancelled'));

ALTER TABLE shops
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (now() + interval '30 days');

ALTER TABLE shops
ADD COLUMN IF NOT EXISTS monthly_revenue DECIMAL(10,2) DEFAULT 0;

ALTER TABLE shops
ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;

ALTER TABLE shops
ADD COLUMN IF NOT EXISTS onboarded_by UUID REFERENCES users(id);

ALTER TABLE shops
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Shop registration requests (new shops wanting to join)
CREATE TABLE IF NOT EXISTS shop_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_name VARCHAR NOT NULL,
  owner_name VARCHAR NOT NULL,
  owner_email VARCHAR NOT NULL,
  owner_phone VARCHAR,
  address VARCHAR,
  city VARCHAR,
  state VARCHAR,
  zip VARCHAR,
  fleet_size INT,
  current_software VARCHAR,
  message TEXT,
  status VARCHAR DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  reject_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Platform activity log
CREATE TABLE IF NOT EXISTS platform_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type VARCHAR NOT NULL,
  description TEXT,
  shop_id UUID REFERENCES shops(id),
  performed_by UUID REFERENCES users(id),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
