// TruckZen Phase 1 Database Types
// Generated from PHASE1_SCHEMA.sql — every nullable column is typed as | null

export interface Unit {
  id: string
  shop_id: string
  customer_id: string | null
  unit_number: string | null
  vin: string | null
  license_plate: string | null
  dot_number: string | null
  year: number | null
  make: string | null
  model: string | null
  unit_type: 'truck' | 'trailer' | 'reefer' | 'other'
  engine_make: string | null
  engine_model: string | null
  current_mileage: number | null
  current_engine_hours: number | null
  last_mileage_update: string | null
  status: 'active' | 'inactive' | 'sold' | 'scrapped'
  notes: string | null
  created_at: string
  updated_at: string
}

export interface RepairOrder {
  id: string
  shop_id: string
  ro_number: string
  customer_id: string | null
  unit_id: string | null
  service_request_id: string | null
  assigned_writer_id: string | null
  assigned_tech_id: string | null
  team_id: string | null
  bay_number: string | null
  status: 'open' | 'in_progress' | 'waiting_parts' | 'waiting_authorization' | 'authorized' | 'completed' | 'invoiced' | 'closed' | 'void'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  check_in_type: 'kiosk' | 'qr_code' | 'service_writer' | 'phone' | 'fleet_request'
  customer_complaint: string | null
  promised_date: string | null
  labor_total: number
  parts_total: number
  subtotal: number
  tax_amount: number
  total: number
  internal_notes: string | null
  customer_notes: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
  closed_at: string | null
}

export interface RepairOrderLine {
  id: string
  repair_order_id: string
  shop_id: string
  line_number: number
  complaint: string
  cause: string | null
  correction: string | null
  cause_original_language: string | null
  cause_original_lang_code: string | null
  correction_original_language: string | null
  correction_original_lang_code: string | null
  assigned_tech_id: string | null
  authorization_status: 'pending' | 'sent' | 'authorized' | 'declined' | 'not_required'
  authorized_by: string | null
  authorized_at: string | null
  estimated_hours: number | null
  actual_hours: number
  labor_rate: number | null
  labor_total: number
  parts_total: number
  line_total: number
  status: 'open' | 'in_progress' | 'waiting_parts' | 'waiting_authorization' | 'completed' | 'void'
  job_template_id: string | null
  created_at: string
  updated_at: string
}

export interface TimeEntry {
  id: string
  shop_id: string
  repair_order_id: string
  repair_order_line_id: string
  tech_id: string
  clock_in: string
  clock_out: string | null
  hours_worked: number | null
  entry_type: 'labor' | 'diagnostic' | 'rework' | 'warranty'
  notes: string | null
  created_at: string
}

export interface Part {
  id: string
  shop_id: string
  part_number: string
  description: string
  category: string | null
  cost_price: number
  sell_price: number
  markup_percent: number | null
  quantity_on_hand: number
  reorder_point: number
  reorder_quantity: number
  location: string | null
  primary_vendor_id: string | null
  vendor_part_number: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ROLinePart {
  id: string
  shop_id: string
  repair_order_id: string
  repair_order_line_id: string
  part_id: string | null
  part_number: string
  description: string
  quantity: number
  unit_cost: number
  unit_sell: number
  line_total: number
  status: 'assigned' | 'ordered' | 'received' | 'installed' | 'returned'
  created_at: string
}

export interface Estimate {
  id: string
  shop_id: string
  repair_order_id: string
  estimate_number: string
  customer_id: string | null
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  labor_total: number
  parts_total: number
  subtotal: number
  tax_amount: number
  total: number
  status: 'draft' | 'sent' | 'viewed' | 'approved' | 'partially_approved' | 'declined' | 'expired' | 'void'
  sent_at: string | null
  sent_via: string | null
  viewed_at: string | null
  responded_at: string | null
  approved_by: string | null
  approval_signature: string | null
  approval_token: string
  valid_until: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface EstimateLine {
  id: string
  estimate_id: string
  repair_order_line_id: string | null
  description: string
  complaint: string | null
  labor_hours: number
  labor_rate: number
  labor_total: number
  parts_total: number
  line_total: number
  is_approved: boolean | null
  customer_response: string | null
  line_number: number
  created_at: string
}

export interface Invoice {
  id: string
  shop_id: string
  repair_order_id: string | null
  invoice_number: string
  customer_id: string | null
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  customer_address: string | null
  unit_id: string | null
  unit_description: string | null
  labor_total: number
  parts_total: number
  shop_supplies: number
  environmental_fee: number
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  amount_paid: number
  balance_due: number
  payment_terms: string
  due_date: string | null
  status: 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue' | 'void' | 'written_off'
  payment_token: string
  sent_at: string | null
  sent_via: string | null
  paid_at: string | null
  notes: string | null
  internal_notes: string | null
  qb_invoice_id: string | null
  qb_synced_at: string | null
  created_at: string
  updated_at: string
}

export interface InvoiceLine {
  id: string
  invoice_id: string
  repair_order_line_id: string | null
  line_type: 'labor' | 'parts' | 'supplies' | 'fee' | 'discount' | 'other'
  description: string
  quantity: number
  unit_price: number
  line_total: number
  is_taxable: boolean
  line_number: number
  created_at: string
}

export interface Payment {
  id: string
  shop_id: string
  invoice_id: string
  customer_id: string | null
  amount: number
  payment_method: 'cash' | 'check' | 'credit_card' | 'debit_card' | 'ach' | 'wire' | 'fleet_account' | 'other'
  reference_number: string | null
  stripe_payment_intent_id: string | null
  stripe_charge_id: string | null
  qb_payment_id: string | null
  notes: string | null
  received_by: string | null
  payment_date: string
  created_at: string
}

export interface JobTemplate {
  id: string
  shop_id: string | null
  name: string
  description: string | null
  category: string | null
  complaint_template: string | null
  estimated_hours: number | null
  suggested_parts: { part_number: string; description: string; quantity: number }[]
  is_active: boolean
  created_at: string
}

export interface AIUsageLog {
  id: string
  shop_id: string
  user_id: string | null
  feature: 'service_writer' | 'smart_drop' | 'parts_suggestion' | 'telegram_bot'
  model: string
  input_tokens: number
  output_tokens: number
  estimated_cost: number
  related_id: string | null
  input_language: string | null
  success: boolean
  error_message: string | null
  created_at: string
}

export interface ROPhoto {
  id: string
  shop_id: string
  repair_order_id: string
  repair_order_line_id: string | null
  uploaded_by: string | null
  storage_path: string
  file_name: string | null
  file_size: number | null
  mime_type: string | null
  photo_type: 'damage' | 'before' | 'after' | 'diagnostic' | 'other'
  caption: string | null
  created_at: string
}

export interface ShopSequence {
  shop_id: string
  next_ro_number: number
  next_estimate_number: number
  next_invoice_number: number
  ro_prefix: string
  estimate_prefix: string
  invoice_prefix: string
}
