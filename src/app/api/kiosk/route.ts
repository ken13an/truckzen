import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyRole } from '@/lib/notify'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const limit = parseInt(searchParams.get('limit') || '10')
  const { data, error } = await s.from('kiosk_checkins')
    .select('id, shop_id, unit_number, company_name, contact_name, complaint_en, checkin_ref, status, created_at, assets(unit_number, year, make, model), customers(company_name)')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const s = db()
  const body = await req.json()
  const { shop_id, unit_number, vin, complaint_raw, complaint_lang, complaint_en, company_name, contact_name, phone, email, odometer } = body

  if (!shop_id || !unit_number) {
    return NextResponse.json({ error: 'shop_id and unit_number required' }, { status: 400 })
  }

  // Look up truck
  const { data: asset } = await s.from('assets')
    .select('id, customer_id, unit_number, year, make, model')
    .eq('shop_id', shop_id)
    .ilike('unit_number', unit_number.trim())
    .single()

  // Look up customer by name if provided
  let customerId = asset?.customer_id || null
  if (!customerId && company_name) {
    const { data: cust } = await s.from('customers')
      .select('id')
      .eq('shop_id', shop_id)
      .ilike('company_name', company_name.trim())
      .single()
    if (cust) customerId = cust.id
  }

  // Generate check-in ref
  const ref = `CI-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`

  // Create kiosk check-in record
  const { data: checkin, error } = await s.from('kiosk_checkins').insert({
    shop_id,
    asset_id: asset?.id || null,
    customer_id: customerId,
    unit_number: unit_number.trim(),
    company_name: company_name || null,
    contact_name: contact_name || null,
    phone: phone || null,
    email: email || null,
    vin: vin || null,
    odometer: odometer || null,
    complaint_raw: complaint_raw || null,
    complaint_lang: complaint_lang || 'en',
    complaint_en: complaint_en || complaint_raw || null,
    checkin_ref: ref,
    status: 'pending',
  }).select().single()

  if (error) {
    console.error('Kiosk insert error:', error)
    return NextResponse.json({ error: 'Check-in failed: ' + error.message }, { status: 500 })
  }

  // Create service request from the check-in
  const { data: sr } = await s.from('service_requests').insert({
    shop_id,
    customer_id: customerId,
    asset_id: asset?.id || null,
    unit_number: unit_number.trim(),
    company_name: company_name || null,
    contact_name: contact_name || null,
    phone: phone || null,
    description: complaint_en || complaint_raw || 'Kiosk check-in — no description provided',
    source: 'kiosk_checkin',
    status: 'new',
    kiosk_checkin_id: checkin.id,
    created_by: 'kiosk',
  }).select().single()

  // Notify service writers
  try {
    const truck = asset ? `${asset.year} ${asset.make} ${asset.model} — #${asset.unit_number}` : `#${unit_number}`
    const problem = (complaint_en || complaint_raw || 'No description').slice(0, 100)
    await notifyRole({
      shopId: shop_id,
      role: ['service_writer', 'shop_manager', 'owner'],
      title: `New service request: ${company_name || 'Walk-in'} — ${truck}`,
      body: problem,
      link: '/orders?tab=requests',
    })
  } catch {}

  return NextResponse.json({
    ref,
    checkin_ref: ref,
    checkin_id: checkin.id,
    request_id: sr?.id || null,
    truck_found: !!asset,
    truck: asset ? { unit_number: asset.unit_number, make: asset.make, model: asset.model } : null,
  })
}
