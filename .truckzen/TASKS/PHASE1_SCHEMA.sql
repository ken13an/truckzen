# TruckZen -- Phase 1 Database Schema

This is the COMPLETE database schema for Phase 1.
Run this as a single Supabase migration to create all tables at once.
After running, ALL Phase 1 features have their data layer ready.

---

## Instructions for CC

1. Go to Supabase Dashboard --> SQL Editor
2. Paste this entire SQL block
3. Run it
4. Verify all tables exist in Table Editor
5. Report which tables were created successfully

If any table already exists, the IF NOT EXISTS clause will skip it safely.

---

```sql
-- ============================================================
-- TRUCKZEN PHASE 1 MEGA MIGRATION
-- Creates ALL tables needed for Phase 1 features
-- Safe to run multiple times (IF NOT EXISTS)
-- ============================================================

-- ────────────────────────────────────────────
-- UNITS (trucks and trailers)
-- Every vehicle serviced gets a profile
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- Identity
  unit_number TEXT,
  vin TEXT,
  license_plate TEXT,
  dot_number TEXT,

  -- Vehicle info
  year INTEGER,
  make TEXT,
  model TEXT,
  unit_type TEXT DEFAULT 'truck' CHECK (unit_type IN ('truck', 'trailer', 'reefer', 'other')),
  engine_make TEXT,
  engine_model TEXT,

  -- Tracking
  current_mileage INTEGER,
  current_engine_hours INTEGER,
  last_mileage_update TIMESTAMPTZ,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'sold', 'scrapped')),
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_units_shop ON units(shop_id);
CREATE INDEX IF NOT EXISTS idx_units_customer ON units(customer_id);
CREATE INDEX IF NOT EXISTS idx_units_vin ON units(vin);
CREATE INDEX IF NOT EXISTS idx_units_number ON units(shop_id, unit_number);

-- ────────────────────────────────────────────
-- REPAIR ORDERS (the core of everything)
-- Replaces/upgrades existing service_orders
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS repair_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,

  -- RO number (auto-generated per shop)
  ro_number TEXT NOT NULL,

  -- Relationships
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  service_request_id UUID, -- link back to original service request if created from one

  -- Assignment
  assigned_writer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_tech_id UUID REFERENCES users(id) ON DELETE SET NULL,
  team_id UUID,
  bay_number TEXT,

  -- Status
  status TEXT DEFAULT 'open' CHECK (status IN (
    'open', 'in_progress', 'waiting_parts', 'waiting_authorization',
    'authorized', 'completed', 'invoiced', 'closed', 'void'
  )),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Check-in info
  check_in_type TEXT DEFAULT 'service_writer' CHECK (check_in_type IN ('kiosk', 'qr_code', 'service_writer', 'phone', 'fleet_request')),
  customer_complaint TEXT, -- initial complaint from check-in
  promised_date TIMESTAMPTZ,

  -- Totals (calculated from lines)
  labor_total DECIMAL(10,2) DEFAULT 0,
  parts_total DECIMAL(10,2) DEFAULT 0,
  subtotal DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,

  -- Metadata
  internal_notes TEXT,
  customer_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ro_number ON repair_orders(shop_id, ro_number);
CREATE INDEX IF NOT EXISTS idx_ro_shop ON repair_orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_ro_customer ON repair_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_ro_unit ON repair_orders(unit_id);
CREATE INDEX IF NOT EXISTS idx_ro_status ON repair_orders(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_ro_writer ON repair_orders(assigned_writer_id);
CREATE INDEX IF NOT EXISTS idx_ro_tech ON repair_orders(assigned_tech_id);

-- ────────────────────────────────────────────
-- REPAIR ORDER LINES (3C: Complaint/Cause/Correction)
-- Each RO can have multiple complaint lines
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS repair_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_order_id UUID NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,

  -- Line number within the RO
  line_number INTEGER NOT NULL DEFAULT 1,

  -- 3C Workflow
  complaint TEXT NOT NULL, -- what the customer reported
  cause TEXT, -- what the technician found (filled by tech or AI)
  correction TEXT, -- what was done to fix it (filled by tech or AI)

  -- AI Service Writer fields
  cause_original_language TEXT, -- what the tech said in their language
  cause_original_lang_code TEXT, -- 'en', 'ru', 'uz', 'es'
  correction_original_language TEXT,
  correction_original_lang_code TEXT,

  -- Assignment (can differ per line)
  assigned_tech_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Authorization
  authorization_status TEXT DEFAULT 'pending' CHECK (authorization_status IN (
    'pending', 'sent', 'authorized', 'declined', 'not_required'
  )),
  authorized_by TEXT, -- name of person who authorized
  authorized_at TIMESTAMPTZ,

  -- Labor
  estimated_hours DECIMAL(6,2),
  actual_hours DECIMAL(6,2) DEFAULT 0,
  labor_rate DECIMAL(8,2), -- rate at time of creation
  labor_total DECIMAL(10,2) DEFAULT 0,

  -- Parts total for this line (sum of parts attached)
  parts_total DECIMAL(10,2) DEFAULT 0,

  -- Line total
  line_total DECIMAL(10,2) DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'open' CHECK (status IN (
    'open', 'in_progress', 'waiting_parts', 'waiting_authorization',
    'completed', 'void'
  )),

  -- Job template reference (if created from canned job)
  job_template_id UUID,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ro_lines_ro ON repair_order_lines(repair_order_id);
CREATE INDEX IF NOT EXISTS idx_ro_lines_shop ON repair_order_lines(shop_id);
CREATE INDEX IF NOT EXISTS idx_ro_lines_tech ON repair_order_lines(assigned_tech_id);

-- ────────────────────────────────────────────
-- TIME ENTRIES (tech clock in/out per RO line)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  repair_order_id UUID NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
  repair_order_line_id UUID NOT NULL REFERENCES repair_order_lines(id) ON DELETE CASCADE,
  tech_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Clock times
  clock_in TIMESTAMPTZ NOT NULL DEFAULT now(),
  clock_out TIMESTAMPTZ,

  -- Calculated
  hours_worked DECIMAL(6,2), -- calculated on clock_out

  -- Type
  entry_type TEXT DEFAULT 'labor' CHECK (entry_type IN ('labor', 'diagnostic', 'rework', 'warranty')),

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_entries_shop ON time_entries(shop_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_ro ON time_entries(repair_order_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_tech ON time_entries(tech_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_active ON time_entries(tech_id) WHERE clock_out IS NULL;

-- ────────────────────────────────────────────
-- PARTS CATALOG (shop's parts inventory)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,

  -- Identity
  part_number TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT, -- 'brakes', 'engine', 'electrical', 'filters', etc.

  -- Pricing
  cost_price DECIMAL(10,2) DEFAULT 0, -- what the shop pays
  sell_price DECIMAL(10,2) DEFAULT 0, -- what the customer pays
  markup_percent DECIMAL(5,2), -- calculated or manual

  -- Inventory
  quantity_on_hand INTEGER DEFAULT 0,
  reorder_point INTEGER DEFAULT 0,
  reorder_quantity INTEGER DEFAULT 0,
  location TEXT, -- shelf/bin location in the shop

  -- Vendor
  primary_vendor_id UUID,
  vendor_part_number TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parts_shop ON parts(shop_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_parts_number ON parts(shop_id, part_number);
CREATE INDEX IF NOT EXISTS idx_parts_category ON parts(shop_id, category);

-- ────────────────────────────────────────────
-- RO LINE PARTS (parts attached to RO lines)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ro_line_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  repair_order_id UUID NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
  repair_order_line_id UUID NOT NULL REFERENCES repair_order_lines(id) ON DELETE CASCADE,
  part_id UUID REFERENCES parts(id) ON DELETE SET NULL,

  -- Part info (snapshot at time of use, in case catalog changes)
  part_number TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(8,2) NOT NULL DEFAULT 1,
  unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit_sell DECIMAL(10,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(10,2) NOT NULL DEFAULT 0, -- quantity * unit_sell

  -- Status
  status TEXT DEFAULT 'assigned' CHECK (status IN ('assigned', 'ordered', 'received', 'installed', 'returned')),

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ro_parts_ro ON ro_line_parts(repair_order_id);
CREATE INDEX IF NOT EXISTS idx_ro_parts_line ON ro_line_parts(repair_order_line_id);

-- ────────────────────────────────────────────
-- ESTIMATES
-- Generated from RO lines, sent to customer
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  repair_order_id UUID NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,

  estimate_number TEXT NOT NULL,

  -- Customer info (snapshot)
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,

  -- Totals
  labor_total DECIMAL(10,2) DEFAULT 0,
  parts_total DECIMAL(10,2) DEFAULT 0,
  subtotal DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft', 'sent', 'viewed', 'approved', 'partially_approved', 'declined', 'expired', 'void'
  )),

  -- Tracking
  sent_at TIMESTAMPTZ,
  sent_via TEXT, -- 'email', 'sms', 'both'
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  approved_by TEXT,
  approval_signature TEXT, -- digital signature data

  -- Validity
  approval_token UUID DEFAULT gen_random_uuid(), -- unique token for public approval page (/approve/[token])
  valid_until TIMESTAMPTZ,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estimates_shop ON estimates(shop_id);
CREATE INDEX IF NOT EXISTS idx_estimates_ro ON estimates(repair_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_estimate_number ON estimates(shop_id, estimate_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_estimate_token ON estimates(approval_token);

-- ────────────────────────────────────────────
-- ESTIMATE LINES (mirror of RO lines for the estimate)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS estimate_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  repair_order_line_id UUID REFERENCES repair_order_lines(id) ON DELETE SET NULL,

  -- Content
  description TEXT NOT NULL,
  complaint TEXT,

  -- Pricing
  labor_hours DECIMAL(6,2) DEFAULT 0,
  labor_rate DECIMAL(8,2) DEFAULT 0,
  labor_total DECIMAL(10,2) DEFAULT 0,
  parts_total DECIMAL(10,2) DEFAULT 0,
  line_total DECIMAL(10,2) DEFAULT 0,

  -- Authorization per line
  is_approved BOOLEAN,
  customer_response TEXT, -- 'approved', 'declined', null

  line_number INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estimate_lines_estimate ON estimate_lines(estimate_id);

-- ────────────────────────────────────────────
-- INVOICES
-- Created from completed ROs
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  repair_order_id UUID REFERENCES repair_orders(id) ON DELETE SET NULL,

  invoice_number TEXT NOT NULL,

  -- Customer info (snapshot)
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  customer_address TEXT,

  -- Unit info (snapshot)
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  unit_description TEXT, -- "2019 Peterbilt 579 - Unit #2717"

  -- Totals
  labor_total DECIMAL(10,2) DEFAULT 0,
  parts_total DECIMAL(10,2) DEFAULT 0,
  shop_supplies DECIMAL(10,2) DEFAULT 0,
  environmental_fee DECIMAL(10,2) DEFAULT 0,
  subtotal DECIMAL(10,2) DEFAULT 0,
  tax_rate DECIMAL(5,4) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,

  -- Payment
  amount_paid DECIMAL(10,2) DEFAULT 0,
  balance_due DECIMAL(10,2) DEFAULT 0,
  payment_terms TEXT DEFAULT 'due_on_receipt', -- 'due_on_receipt', 'net_15', 'net_30', 'net_60', 'net_90'
  due_date TIMESTAMPTZ,

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'void', 'written_off'
  )),

  -- Tracking
  payment_token UUID DEFAULT gen_random_uuid(), -- unique token for public payment page (/pay/[token])
  sent_at TIMESTAMPTZ,
  sent_via TEXT,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  internal_notes TEXT,

  -- QuickBooks
  qb_invoice_id TEXT,
  qb_synced_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_shop ON invoices(shop_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_ro ON invoices(repair_order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(shop_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_number ON invoices(shop_id, invoice_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_payment_token ON invoices(payment_token);

-- ────────────────────────────────────────────
-- INVOICE LINES
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  repair_order_line_id UUID REFERENCES repair_order_lines(id) ON DELETE SET NULL,

  -- Content
  line_type TEXT DEFAULT 'labor' CHECK (line_type IN ('labor', 'parts', 'supplies', 'fee', 'discount', 'other')),
  description TEXT NOT NULL,
  quantity DECIMAL(8,2) DEFAULT 1,
  unit_price DECIMAL(10,2) DEFAULT 0,
  line_total DECIMAL(10,2) DEFAULT 0,
  is_taxable BOOLEAN DEFAULT true,

  line_number INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id);

-- ────────────────────────────────────────────
-- PAYMENTS
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- Payment info
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN (
    'cash', 'check', 'credit_card', 'debit_card', 'ach', 'wire', 'fleet_account', 'other'
  )),
  reference_number TEXT, -- check number, transaction ID, etc.

  -- Stripe
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,

  -- QuickBooks
  qb_payment_id TEXT,

  notes TEXT,
  received_by UUID REFERENCES users(id) ON DELETE SET NULL,
  payment_date TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_shop ON payments(shop_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);

-- ────────────────────────────────────────────
-- SERVICE REQUESTS (updated -- link to ROs)
-- Add columns if they don't exist
-- ────────────────────────────────────────────
DO $$
BEGIN
  -- Add unit_id to service_requests if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_requests' AND column_name = 'unit_id') THEN
    ALTER TABLE service_requests ADD COLUMN unit_id UUID REFERENCES units(id) ON DELETE SET NULL;
  END IF;

  -- Add check_in_type if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_requests' AND column_name = 'check_in_type') THEN
    ALTER TABLE service_requests ADD COLUMN check_in_type TEXT DEFAULT 'kiosk';
  END IF;

  -- Add created_by (the service writer who created it, for Path B)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_requests' AND column_name = 'created_by') THEN
    ALTER TABLE service_requests ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  -- Add converted_to_ro_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_requests' AND column_name = 'converted_to_ro_id') THEN
    ALTER TABLE service_requests ADD COLUMN converted_to_ro_id UUID;
  END IF;
END $$;

-- ────────────────────────────────────────────
-- JOB TEMPLATES (canned jobs)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE, -- NULL = global template
  name TEXT NOT NULL, -- "Oil Change - Peterbilt 579"
  description TEXT,
  category TEXT, -- 'PM', 'brakes', 'engine', 'electrical', etc.

  -- Template data (JSON)
  complaint_template TEXT,
  estimated_hours DECIMAL(6,2),
  suggested_parts JSONB DEFAULT '[]', -- [{part_number, description, quantity}]

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_templates_shop ON job_templates(shop_id);

-- ────────────────────────────────────────────
-- AI USAGE LOG (track Claude API costs per shop)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- What was called
  feature TEXT NOT NULL, -- 'service_writer', 'smart_drop', 'parts_suggestion', 'telegram_bot'
  model TEXT DEFAULT 'claude-sonnet-4-6',
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  estimated_cost DECIMAL(8,6) DEFAULT 0,

  -- Context
  related_id UUID, -- RO id, service request id, etc.
  input_language TEXT, -- 'en', 'ru', 'uz', 'es'
  success BOOLEAN DEFAULT true,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_shop ON ai_usage_log(shop_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_feature ON ai_usage_log(feature);
CREATE INDEX IF NOT EXISTS idx_ai_usage_date ON ai_usage_log(created_at);

-- ────────────────────────────────────────────
-- RO PHOTOS (damage documentation)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ro_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  repair_order_id UUID NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
  repair_order_line_id UUID REFERENCES repair_order_lines(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- File
  storage_path TEXT NOT NULL, -- Supabase Storage path
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,

  -- Metadata
  photo_type TEXT DEFAULT 'damage' CHECK (photo_type IN ('damage', 'before', 'after', 'diagnostic', 'other')),
  caption TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ro_photos_ro ON ro_photos(repair_order_id);

-- ────────────────────────────────────────────
-- RO NUMBER SEQUENCE (auto-increment per shop)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_sequences (
  shop_id UUID PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
  next_ro_number INTEGER DEFAULT 1001,
  next_estimate_number INTEGER DEFAULT 1001,
  next_invoice_number INTEGER DEFAULT 1001,
  ro_prefix TEXT DEFAULT 'RO',
  estimate_prefix TEXT DEFAULT 'EST',
  invoice_prefix TEXT DEFAULT 'INV'
);

-- Function to get next RO number
CREATE OR REPLACE FUNCTION get_next_ro_number(p_shop_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_number INTEGER;
  v_prefix TEXT;
BEGIN
  -- Insert default if not exists
  INSERT INTO shop_sequences (shop_id) VALUES (p_shop_id) ON CONFLICT DO NOTHING;

  -- Get and increment
  UPDATE shop_sequences
  SET next_ro_number = next_ro_number + 1
  WHERE shop_id = p_shop_id
  RETURNING next_ro_number - 1, ro_prefix INTO v_number, v_prefix;

  RETURN v_prefix || '-' || LPAD(v_number::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Same for estimates
CREATE OR REPLACE FUNCTION get_next_estimate_number(p_shop_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_number INTEGER;
  v_prefix TEXT;
BEGIN
  INSERT INTO shop_sequences (shop_id) VALUES (p_shop_id) ON CONFLICT DO NOTHING;
  UPDATE shop_sequences SET next_estimate_number = next_estimate_number + 1
  WHERE shop_id = p_shop_id
  RETURNING next_estimate_number - 1, estimate_prefix INTO v_number, v_prefix;
  RETURN v_prefix || '-' || LPAD(v_number::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Same for invoices
CREATE OR REPLACE FUNCTION get_next_invoice_number(p_shop_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_number INTEGER;
  v_prefix TEXT;
BEGIN
  INSERT INTO shop_sequences (shop_id) VALUES (p_shop_id) ON CONFLICT DO NOTHING;
  UPDATE shop_sequences SET next_invoice_number = next_invoice_number + 1
  WHERE shop_id = p_shop_id
  RETURNING next_invoice_number - 1, invoice_prefix INTO v_number, v_prefix;
  RETURN v_prefix || '-' || LPAD(v_number::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────
-- UPDATED_AT TRIGGER (reusable)
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'units', 'repair_orders', 'repair_order_lines',
      'parts', 'estimates', 'invoices'
    ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON %I; CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ────────────────────────────────────────────
-- HELPER FUNCTION: get current user's shop_id
-- Standard Supabase JWT does NOT include shop_id,
-- so we look it up from the users table via auth.uid()
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_user_shop_id()
RETURNS UUID AS $$
  SELECT shop_id FROM users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ────────────────────────────────────────────
-- ROW LEVEL SECURITY (multi-tenant isolation)
-- Uses get_user_shop_id() for all tables with shop_id
-- ────────────────────────────────────────────
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'units', 'repair_orders', 'repair_order_lines', 'time_entries',
      'parts', 'ro_line_parts', 'estimates',
      'invoices', 'payments', 'job_templates',
      'ai_usage_log', 'ro_photos', 'shop_sequences'
    ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

    -- Drop existing policy if any
    EXECUTE format('DROP POLICY IF EXISTS shop_isolation ON %I', tbl);

    -- Create isolation policy using helper function
    EXECUTE format(
      'CREATE POLICY shop_isolation ON %I FOR ALL USING (shop_id = get_user_shop_id())',
      tbl
    );
  END LOOP;
END $$;

-- Special case: estimate_lines and invoice_lines don't have shop_id directly
-- They inherit through their parent table
ALTER TABLE estimate_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS estimate_lines_access ON estimate_lines;
CREATE POLICY estimate_lines_access ON estimate_lines FOR ALL
  USING (estimate_id IN (SELECT id FROM estimates WHERE shop_id = get_user_shop_id()));

ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoice_lines_access ON invoice_lines;
CREATE POLICY invoice_lines_access ON invoice_lines FOR ALL
  USING (invoice_id IN (SELECT id FROM invoices WHERE shop_id = get_user_shop_id()));

-- Service role bypasses RLS automatically, so API routes using
-- SUPABASE_SERVICE_ROLE_KEY are not affected by these policies.

-- ============================================================
-- DONE
-- Tables created: 15
-- Functions: 4 (get_next_ro/estimate/invoice_number, update_updated_at)
-- Triggers: 6 (updated_at on 6 tables)
-- Indexes: 25+
-- RLS Policies: 15+
-- ============================================================
```
