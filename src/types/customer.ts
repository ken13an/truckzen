export interface Customer {
  id: string
  shop_id: string
  company_name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  dot_number: string | null
  mc_number: string | null
  tax_exempt: boolean
  notes: string | null
  source: string | null
  created_at: string
}

export interface CustomerContact {
  id: string
  customer_id: string
  name: string
  phone: string | null
  email: string | null
  role: string | null
  is_primary: boolean
}
