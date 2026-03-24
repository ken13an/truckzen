-- AutoBots system tables and is_autobot column

-- Add is_autobot flag to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_autobot BOOLEAN DEFAULT FALSE;

-- AutoBot accounts table
CREATE TABLE IF NOT EXISTS autobots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  status TEXT DEFAULT 'inactive',
  auth_user_id UUID DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deployed_at TIMESTAMPTZ DEFAULT NULL
);

INSERT INTO autobots (name, email, role) VALUES
  ('AutoBot Service Writer', 'autobot.servicewriter@truckzen.pro', 'service_writer'),
  ('AutoBot Mechanic', 'autobot.mechanic@truckzen.pro', 'mechanic'),
  ('AutoBot Parts', 'autobot.parts@truckzen.pro', 'parts_staff'),
  ('AutoBot Accounting', 'autobot.accounting@truckzen.pro', 'accountant'),
  ('AutoBot Floor Supervisor', 'autobot.floor@truckzen.pro', 'floor_supervisor')
ON CONFLICT DO NOTHING;

-- Test scenarios table
CREATE TABLE IF NOT EXISTS autobot_scenarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]',
  is_preset BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Insert preset scenarios
INSERT INTO autobot_scenarios (name, description, steps, is_preset) VALUES
  ('Full Workflow', 'Kiosk check-in through Service Writer, Parts, Mechanic (clock in + complete), Accounting, and Invoice closed.', '[{"bot":"AutoBot Service Writer","action":"check_in","expected":"Truck checked in via kiosk"},{"bot":"AutoBot Service Writer","action":"create_wo","expected":"Work order created from service request"},{"bot":"AutoBot Parts","action":"request_parts","expected":"Parts requested for work order"},{"bot":"AutoBot Parts","action":"fulfill_parts","expected":"Parts fulfilled and assigned"},{"bot":"AutoBot Mechanic","action":"clock_in","expected":"Mechanic clocked in to job"},{"bot":"AutoBot Mechanic","action":"complete_job","expected":"Job marked complete by mechanic"},{"bot":"AutoBot Accounting","action":"generate_invoice","expected":"Invoice generated from completed WO"}]', TRUE),
  ('Kiosk Rush', '5 simultaneous kiosk check-ins from different trucks. Tests concurrent load.', '[{"bot":"AutoBot Service Writer","action":"check_in","expected":"Truck 1 checked in"},{"bot":"AutoBot Service Writer","action":"check_in","expected":"Truck 2 checked in"},{"bot":"AutoBot Service Writer","action":"check_in","expected":"Truck 3 checked in"},{"bot":"AutoBot Service Writer","action":"check_in","expected":"Truck 4 checked in"},{"bot":"AutoBot Service Writer","action":"check_in","expected":"Truck 5 checked in"}]', TRUE),
  ('Parts Shortage', 'Mechanic requests a part that is out of stock. Tests the out-of-stock workflow.', '[{"bot":"AutoBot Service Writer","action":"create_wo","expected":"Work order created"},{"bot":"AutoBot Mechanic","action":"clock_in","expected":"Mechanic clocked in"},{"bot":"AutoBot Parts","action":"request_parts","expected":"Part requested but out of stock"},{"bot":"AutoBot Parts","action":"fulfill_parts","expected":"Back-order initiated"}]', TRUE),
  ('Service Writer Only', 'Just the kiosk check-in, service request, and WO creation flow. Quick 2-step test.', '[{"bot":"AutoBot Service Writer","action":"check_in","expected":"Truck checked in via kiosk"},{"bot":"AutoBot Service Writer","action":"create_wo","expected":"Work order created from check-in"}]', TRUE)
ON CONFLICT DO NOTHING;

-- Test results table
CREATE TABLE IF NOT EXISTS autobot_test_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scenario_name TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ DEFAULT NULL,
  duration_ms INTEGER DEFAULT NULL,
  total_steps INTEGER DEFAULT 0,
  passed_steps INTEGER DEFAULT 0,
  failed_steps INTEGER DEFAULT 0,
  status TEXT DEFAULT 'running',
  steps_detail JSONB DEFAULT '[]',
  run_by UUID REFERENCES users(id)
);
