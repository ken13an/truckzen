import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWelcomeEmail } from '@/lib/integrations/resend'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(req: Request) {
  const s = db()
  const { email, full_name, shop_id } = await req.json()
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://truckzen.pro'

  // Generate a new recovery link
  const { data: linkData, error: linkErr } = await s.auth.admin.generateLink({
    type: 'recovery',
    email: email.toLowerCase().trim(),
    options: { redirectTo: `${appUrl}/reset-password` },
  })

  if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 })

  const setupUrl = linkData?.properties?.action_link || `${appUrl}/forgot-password`

  // Get shop name
  let shopName = 'TruckZen'
  if (shop_id) {
    const { data: shop } = await s.from('shops').select('name, dba').eq('id', shop_id).single()
    shopName = shop?.dba || shop?.name || 'TruckZen'
  }

  const result = await sendWelcomeEmail(email, full_name || 'Team Member', shopName, setupUrl)
  if (!result.success) return NextResponse.json({ error: result.error || 'Failed to send' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
