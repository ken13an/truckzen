export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue' | 'void'
export type PaymentMethod = 'stripe' | 'cash' | 'check' | 'ach' | 'other'
export type InvoiceLineType = 'labor' | 'part' | 'shop_charge' | 'discount'

export interface Invoice {
  id: string
  shop_id: string
  service_order_id: string
  customer_id: string
  invoice_number: string
  status: InvoiceStatus
  subtotal: number
  tax_rate: number
  tax_amount: number
  discount_amount: number
  discount_reason: string | null
  total: number
  amount_paid: number
  balance_due: number
  payment_terms: string
  due_date: string | null
  sent_at: string | null
  viewed_at: string | null
  paid_at: string | null
  payment_method: PaymentMethod | null
  stripe_session_id: string | null
  notes: string | null
  customer_notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined
  customers?: { company_name: string; contact_name: string | null; phone: string | null; email: string | null }
  service_orders?: { so_number: string; assets?: { unit_number: string; year: number | null; make: string | null; model: string | null } }
}

export interface InvoiceLine {
  id: string
  invoice_id: string
  line_type: InvoiceLineType
  description: string
  quantity: number
  unit_price: number
  total_price: number
  so_line_id: string | null
  sort_order: number
  created_at: string
}
