export interface Shop {
  id: string
  name: string
  dba: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  phone: string | null
  email: string | null
  tax_rate: number
  logo_url: string | null
  stripe_account_id: string | null
  created_at: string
}

export interface Translation {
  id: string
  language: string
  key: string
  value: string
}
