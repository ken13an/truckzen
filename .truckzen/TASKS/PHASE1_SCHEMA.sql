# TruckZen -- Phase 1 Database Schema

Plain SQL — no DO blocks, no transaction control. Safe for Supabase SQL Editor.

```sql
-- ============================================================
-- TRUCKZEN PHASE 1 MEGA MIGRATION
-- Plain SQL — safe for Supabase SQL Editor
-- ============================================================

-- UNITS
CREATE TABLE IF NOT EXISTS units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  unit_number TEXT,
  vin TEXT,
  license_plate TEXT,
  dot_number TEXT,
  year INTEGER,
  make TEXT,
  model TEXT,
  unit_type TEXT DEFAULT 'truck' CHECK (unit_type IN ('truck', 'trailer', 'reefer', 'other')),
  engine_make TEXT,
  engine_model TEXT,
  current_mileage INTEGER,
  current_engine_hours INTEGER,
  last_mileage_update TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'sold', 'scrapped')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_units_shop ON units(shop_id);
CREATE INDEX IF NOT EXISTS idx_units_customer ON units(customer_id);
CREATE INDEX IF NOT EXISTS idx_units_vin ON units(vin);
CREATE INDEX IF NOT EXISTS idx_units_number ON units(shop_id, unit_number);

-- REPAIR ORDERS
CREATE TABLE IF NOT EXISTS repair_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  ro_number TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  service_request_id UUID,
  assigned_writer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_tech_id UUID REFERENCES users(id) ON DELETE SET NULL,
  team_id UUID,
  bay_number TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN (
    'open', 'in_progress', 'waiting_parts', 'waiting_authorization',
    'authorized', 'completed', 'invoiced', 'closed', 'void'
  )),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  check_in_type TEXT DEFAULT 'service_writer' CHECK (check_in_type IN ('kiosk', 'qr_code', 'service_writer', 'phone', 'fleet_request')),
  customer_complaint TEXT,
  promised_date TIMESTAMPTZ,
  labor_total DECIMAL(10,2) DEFAULT 0,
  parts_total DECIMAL(10,2) DEFAULT 0,
  subtotal DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
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

-- REPAIR ORDER LINES (3C: Complaint/Cause/Correction)
CREATE TABLE IF NOT EXISTS repair_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_order_id UUID NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL DEFAULT 1,
  complaint TEXT NOT NULL,
  cause TEXT,
  correction TEXT,
  cause_original_language TEXT,
  cause_original_lang_code TEXT,
  correction_original_language TEXT,
  correction_original_lang_code TEXT,
  assigned_tech_id UUID REFERENCES users(id) ON DELETE SET NULL,
  authorization_status TEXT DEFAULT 'pending' CHECK (authorization_status IN (
    'pending', 'sent', 'authorized', 'declined', 'not_required'
  )),
  authorized_by TEXT,
  authorized_at TIMESTAMPTZ,
  estimated_hours DECIMAL(6,2),
  actual_hours DECIMAL(6,2) DEFAULT 0,
  labor_rate DECIMAL(8,2),
  labor_total DECIMAL(10,2) DEFAULT 0,
  parts_total DECIMAL(10,2) DEFAULT 0,
  line_total DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'open' CHECK (status IN (
    'open', 'in_progress', 'waiting_parts', 'waiting_authorization',
    'completed', 'void'
  )),
  job_template_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ro_lines_ro ON repair_order_lines(repair_order_id);
CREATE INDEX IF NOT EXISTS idx_ro_lines_shop ON repair_order_lines(shop_id);
CREATE INDEX IF NOT EXISTS idx_ro_lines_tech ON repair_order_lines(assigned_tech_id);

-- TIME ENTRIES
CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  repair_order_id UUID NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
  repair_order_line_id UUID NOT NULL REFERENCES repair_order_lines(id) ON DELETE CASCADE,
  tech_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  clock_in TIMESTAMPTZ NOT NULL DEFAULT now(),
  clock_out TIMESTAMPTZ,
  hours_worked DECIMAL(6,2),
  entry_type TEXT DEFAULT 'labor' CHECK (entry_type IN ('labor', 'diagnostic', 'rework', 'warranty')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_entries_shop ON time_entries(shop_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_ro ON time_entries(repair_order_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_tech ON time_entries(tech_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_active ON time_entries(tech_id) WHERE clock_out IS NULL;

-- RO LINE PARTS
CREATE TABLE IF NOT EXISTS ro_line_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  repair_order_id UUID NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
  repair_order_line_id UUID NOT NULL REFERENCES repair_order_lines(id) ON DELETE CASCADE,
  part_id UUID REFERENCES parts(id) ON DELETE SET NULL,
  part_number TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(8,2) NOT NULL DEFAULT 1,
  unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit_sell DECIMAL(10,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'assigned' CHECK (status IN ('assigned', 'ordered', 'received', 'installed', 'returned')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ro_parts_ro ON ro_line_parts(repair_order_id);
CREATE INDEX IF NOT EXISTS idx_ro_parts_line ON ro_line_parts(repair_order_line_id);

-- ESTIMATES
CREATE TABLE IF NOT EXISTS estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  repair_order_id UUID NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
  estimate_number TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  labor_total DECIMAL(10,2) DEFAULT 0,
  parts_total DECIMAL(10,2) DEFAULT 0,
  subtotal DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft', 'sent', 'viewed', 'approved', 'partially_approved', 'declined', 'expired', 'void'
  )),
  sent_at TIMESTAMPTZ,
  sent_via TEXT,
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  approved_by TEXT,
  approval_signature TEXT,
  approval_token UUID DEFAULT gen_random_uuid(),
  valid_until TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estimates_shop ON estimates(shop_id);
CREATE INDEX IF NOT EXISTS idx_estimates_ro ON estimates(repair_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_estimate_number ON estimates(shop_id, estimate_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_estimate_token ON estimates(approval_token);

-- ESTIMATE LINES
CREATE TABLE IF NOT EXISTS estimate_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  repair_order_line_id UUID REFERENCES repair_order_lines(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  complaint TEXT,
  labor_hours DECIMAL(6,2) DEFAULT 0,
  labor_rate DECIMAL(8,2) DEFAULT 0,
  labor_total DECIMAL(10,2) DEFAULT 0,
  parts_total DECIMAL(10,2) DEFAULT 0,
  line_total DECIMAL(10,2) DEFAULT 0,
  is_approved BOOLEAN,
  customer_response TEXT,
  line_number INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estimate_lines_estimate ON estimate_lines(estimate_id);

-- INVOICE LINES (invoices table already exists)
CREATE TABLE IF NOT EXISTS invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  repair_order_line_id UUID REFERENCES repair_order_lines(id) ON DELETE SET NULL,
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

-- PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN (
    'cash', 'check', 'credit_card', 'debit_card', 'ach', 'wire', 'fleet_account', 'other'
  )),
  reference_number TEXT,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  qb_payment_id TEXT,
  notes TEXT,
  received_by UUID REFERENCES users(id) ON DELETE SET NULL,
  payment_date TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_shop ON payments(shop_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);

-- SERVICE REQUESTS — add columns if missing
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES units(id) ON DELETE SET NULL;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS check_in_type TEXT DEFAULT 'kiosk';
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS converted_to_ro_id UUID;

-- JOB TEMPLATES
CREATE TABLE IF NOT EXISTS job_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  complaint_template TEXT,
  estimated_hours DECIMAL(6,2),
  suggested_parts JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_templates_shop ON job_templates(shop_id);

-- AI USAGE LOG
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  feature TEXT NOT NULL,
  model TEXT DEFAULT 'claude-sonnet-4-6',
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  estimated_cost DECIMAL(8,6) DEFAULT 0,
  related_id UUID,
  input_language TEXT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_shop ON ai_usage_log(shop_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_feature ON ai_usage_log(feature);
CREATE INDEX IF NOT EXISTS idx_ai_usage_date ON ai_usage_log(created_at);

-- RO PHOTOS
CREATE TABLE IF NOT EXISTS ro_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  repair_order_id UUID NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
  repair_order_line_id UUID REFERENCES repair_order_lines(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  photo_type TEXT DEFAULT 'damage' CHECK (photo_type IN ('damage', 'before', 'after', 'diagnostic', 'other')),
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ro_photos_ro ON ro_photos(repair_order_id);

-- SHOP SEQUENCES (auto-increment RO/estimate/invoice numbers)
CREATE TABLE IF NOT EXISTS shop_sequences (
  shop_id UUID PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
  next_ro_number INTEGER DEFAULT 1001,
  next_estimate_number INTEGER DEFAULT 1001,
  next_invoice_number INTEGER DEFAULT 1001,
  ro_prefix TEXT DEFAULT 'RO',
  estimate_prefix TEXT DEFAULT 'EST',
  invoice_prefix TEXT DEFAULT 'INV'
);

-- FUNCTIONS: get next RO number
CREATE OR REPLACE FUNCTION get_next_ro_number(p_shop_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_number INTEGER;
  v_prefix TEXT;
BEGIN
  INSERT INTO shop_sequences (shop_id) VALUES (p_shop_id) ON CONFLICT DO NOTHING;
  UPDATE shop_sequences
  SET next_ro_number = next_ro_number + 1
  WHERE shop_id = p_shop_id
  RETURNING next_ro_number - 1, ro_prefix INTO v_number, v_prefix;
  RETURN v_prefix || '-' || LPAD(v_number::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- FUNCTIONS: get next estimate number
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

-- FUNCTIONS: get next invoice number
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

-- FUNCTION: updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- TRIGGERS: updated_at on tables
DROP TRIGGER IF EXISTS set_updated_at ON units;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON units FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON repair_orders;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON repair_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON repair_order_lines;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON repair_order_lines FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON parts;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON parts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON estimates;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON estimates FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON invoices;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- HELPER: get current user's shop_id from JWT
CREATE OR REPLACE FUNCTION get_user_shop_id()
RETURNS UUID AS $$
  SELECT shop_id FROM users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- RLS: enable and create policies for all shop_id tables
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shop_isolation ON units;
CREATE POLICY shop_isolation ON units FOR ALL USING (shop_id = get_user_shop_id());

ALTER TABLE repair_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shop_isolation ON repair_orders;
CREATE POLICY shop_isolation ON repair_orders FOR ALL USING (shop_id = get_user_shop_id());

ALTER TABLE repair_order_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shop_isolation ON repair_order_lines;
CREATE POLICY shop_isolation ON repair_order_lines FOR ALL USING (shop_id = get_user_shop_id());

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shop_isolation ON time_entries;
CREATE POLICY shop_isolation ON time_entries FOR ALL USING (shop_id = get_user_shop_id());

ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shop_isolation ON parts;
CREATE POLICY shop_isolation ON parts FOR ALL USING (shop_id = get_user_shop_id());

ALTER TABLE ro_line_parts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shop_isolation ON ro_line_parts;
CREATE POLICY shop_isolation ON ro_line_parts FOR ALL USING (shop_id = get_user_shop_id());

ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shop_isolation ON estimates;
CREATE POLICY shop_isolation ON estimates FOR ALL USING (shop_id = get_user_shop_id());

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shop_isolation ON invoices;
CREATE POLICY shop_isolation ON invoices FOR ALL USING (shop_id = get_user_shop_id());

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shop_isolation ON payments;
CREATE POLICY shop_isolation ON payments FOR ALL USING (shop_id = get_user_shop_id());

ALTER TABLE job_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shop_isolation ON job_templates;
CREATE POLICY shop_isolation ON job_templates FOR ALL USING (shop_id = get_user_shop_id());

ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shop_isolation ON ai_usage_log;
CREATE POLICY shop_isolation ON ai_usage_log FOR ALL USING (shop_id = get_user_shop_id());

ALTER TABLE ro_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shop_isolation ON ro_photos;
CREATE POLICY shop_isolation ON ro_photos FOR ALL USING (shop_id = get_user_shop_id());

ALTER TABLE shop_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shop_isolation ON shop_sequences;
CREATE POLICY shop_isolation ON shop_sequences FOR ALL USING (shop_id = get_user_shop_id());

-- RLS for child tables (no shop_id — inherit through parent)
ALTER TABLE estimate_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS estimate_lines_access ON estimate_lines;
CREATE POLICY estimate_lines_access ON estimate_lines FOR ALL
  USING (estimate_id IN (SELECT id FROM estimates WHERE shop_id = get_user_shop_id()));

ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoice_lines_access ON invoice_lines;
CREATE POLICY invoice_lines_access ON invoice_lines FOR ALL
  USING (invoice_id IN (SELECT id FROM invoices WHERE shop_id = get_user_shop_id()));

-- ============================================================
-- DONE — 15 tables, 4 functions, 6 triggers, 25+ indexes, 15 RLS policies
-- ============================================================
```
