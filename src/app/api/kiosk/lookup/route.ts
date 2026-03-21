import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')?.toLowerCase().trim()

  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 })

  const s = db()
  const { data: shop } = await s.from('shops')
    .select('id, name, dba, phone, logo_url, kiosk_enabled, kiosk_settings')
    .eq('kiosk_code', code)
    .single()

  if (!shop) return NextResponse.json({ error: 'Kiosk not found' }, { status: 404 })
  if (shop.kiosk_enabled === false) return NextResponse.json({ error: 'Kiosk is disabled' }, { status: 403 })

  return NextResponse.json({
    shop_id: shop.id,
    shop_name: shop.dba || shop.name || 'Service Center',
    phone: shop.phone,
    logo_url: shop.logo_url,
    settings: shop.kiosk_settings || {},
  })
}
