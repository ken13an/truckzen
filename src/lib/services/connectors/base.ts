export interface RawCustomer {
  external_id?: string
  company_name: string
  dba_name?: string
  dot_number?: string
  mc_number?: string
  phone?: string
  email?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  payment_terms?: string
  tax_rate?: number
  notes?: string
  contacts?: { name: string; phone?: string; email?: string; role?: string; is_primary?: boolean }[]
}

export interface RawVehicle {
  external_id?: string
  unit_number: string
  vin?: string
  unit_type?: string
  year?: number | null
  make?: string
  model?: string
  engine?: string
  transmission?: string
  mileage?: number | null
  license_plate?: string
  license_state?: string
  customer_name?: string
  customer_external_id?: string
  status?: string
}

export interface RawServiceOrder {
  external_id?: string
  so_number: string
  customer_name?: string
  customer_external_id?: string
  unit_number?: string
  unit_vin?: string
  status?: string
  priority?: string
  concern?: string
  cause?: string
  correction?: string
  tech_name?: string
  date_created?: string
  date_completed?: string
  total_labor_hours?: number
  total_parts_cost?: number
  total_amount?: number
  lines?: { line_type: string; description: string; part_number?: string; quantity?: number; unit_price?: number; total_price?: number; hours?: number; tech_name?: string }[]
}

export interface RawInvoice {
  external_id?: string
  invoice_number: string
  so_number?: string
  customer_name?: string
  customer_external_id?: string
  status?: string
  subtotal?: number
  tax_rate?: number
  tax_amount?: number
  total?: number
  amount_paid?: number
  balance_due?: number
  payment_terms?: string
  due_date?: string
  paid_at?: string
  payment_method?: string
  date_created?: string
  lines?: { line_type: string; description: string; quantity?: number; unit_price?: number; total_price?: number }[]
}

export interface RawPart {
  part_number?: string
  description: string
  quantity?: number
  unit_cost?: number
  sell_price?: number
  vendor?: string
  location?: string
  min_stock?: number
  category?: string
}

export interface RawTechnician {
  full_name: string
  email?: string
  phone?: string
  role?: string
  team?: string
  skills?: string[]
  hourly_rate?: number
}

export interface ConnectionTestResult {
  ok: boolean
  shopName: string
  counts: Record<string, number>
  error?: string
}

export interface MigrationConnector {
  name: string
  testConnection(apiKey: string): Promise<ConnectionTestResult>
  pullCustomers(apiKey: string): Promise<RawCustomer[]>
  pullVehicles(apiKey: string): Promise<RawVehicle[]>
  pullServiceOrders(apiKey: string): Promise<RawServiceOrder[]>
  pullInvoices(apiKey: string): Promise<RawInvoice[]>
  pullParts(apiKey: string): Promise<RawPart[]>
  pullTechnicians(apiKey: string): Promise<RawTechnician[]>
}
