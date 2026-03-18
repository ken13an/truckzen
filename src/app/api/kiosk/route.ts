// app/api/kiosk/checkin/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/security'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const ip    = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  const limit = await checkRateLimit('api', `kiosk:${ip}`)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { unit_number, complaint_raw, complaint_lang, complaint_en, shop_id } = await req.json()

  if (!shop_id || !unit_number) {
    return NextResponse.json({ error: 'shop_id and unit_number required' }, { status: 400 })
  }

  // Look up truck
  const { data: asset } = await supabase
    .from('assets')
    .select('id, customer_id, unit_number, year, make, model')
    .eq('shop_id', shop_id)
    .ilike('unit_number', unit_number.trim())
    .single()

  // Generate check-in ref
  const ref = `CI-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`

  // Create kiosk check-in record
  const { data: checkin, error } = await supabase
    .from('kiosk_checkins')
    .insert({
      shop_id,
      asset_id:       asset?.id || null,
      customer_id:    asset?.customer_id || null,
      unit_number:    unit_number.trim(),
      complaint_raw:  complaint_raw || null,
      complaint_lang: complaint_lang || 'en',
      complaint_en:   complaint_en || complaint_raw || null,
      checkin_ref:    ref,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Check-in failed' }, { status: 500 })
  }

  // Notify service advisor via Telegram (find first advisor for this shop)
  try {
    const { data: advisor } = await supabase
      .from('users')
      .select('telegram_id, full_name')
      .eq('shop_id', shop_id)
      .in('role', ['service_advisor', 'shop_manager'])
      .eq('active', true)
      .not('telegram_id', 'is', null)
      .limit(1)
      .single()

    if (advisor?.telegram_id) {
      const truck    = asset ? `${asset.year} ${asset.make} ${asset.model} — Unit #${asset.unit_number}` : `Unit #${unit_number}`
      const problem  = complaint_en || complaint_raw || 'No description provided'
      const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN!

      await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: advisor.telegram_id,
          text: `🚛 *KIOSK CHECK-IN*\nRef: ${ref}\nTruck: ${truck}\nComplaint: ${problem.slice(0, 200)}`,
          parse_mode: 'Markdown',
        }),
      })
    }
  } catch { /* non-critical — check-in still succeeds */ }

  return NextResponse.json({
    ref,
    checkin_id: checkin.id,
    truck_found: !!asset,
    truck: asset ? { unit_number: asset.unit_number, make: asset.make, model: asset.model } : null,
  })
}
