'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface ShopInfo {
  id: string
  name: string
  dba: string | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  logo_url: string | null
  brand_color: string | null
  website: string | null
  invoice_footer: string | null
  email_footer: string | null
  tax_rate: number
  kiosk_code: string | null
}

export function useShop(shopId: string | undefined) {
  const [shop, setShop] = useState<ShopInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!shopId) return
    const supabase = createClient()
    supabase.from('shops').select('id, name, dba, phone, email, address, city, state, zip, logo_url, brand_color, website, invoice_footer, email_footer, tax_rate, kiosk_code')
      .eq('id', shopId).single()
      .then(({ data }: { data: ShopInfo | null }) => { if (data) setShop(data); setLoading(false) })
  }, [shopId])

  const displayName = shop?.dba || shop?.name || 'TruckZen'
  const fullAddress = [shop?.address, shop?.city, shop?.state, shop?.zip].filter(Boolean).join(', ')

  return { shop, loading, displayName, fullAddress }
}
