import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// GET /api/service-requests?shop_id=...&status=...
export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const status = searchParams.get('status')

  let q = s.from('service_requests')
    .select('id, shop_id, customer_id, asset_id, unit_number, company_name, contact_name, phone, description, source, check_in_type, status, urgency, priority, reject_reason, scheduled_date, expected_arrival, promised_date, parking_location, key_location, converted_so_id, created_by, created_at, kiosk_checkin_id')
    .eq('shop_id', shopId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (status) q = q.eq('status', status)

  const { data, error } = await q.limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/service-requests — create, convert, schedule, or reject
export async function POST(req: Request) {
  const s = db()
  const body = await req.json()
  const { action } = body

  // ── CREATE (service writer check-in Path B) ──
  if (action === 'create') {
    const { shop_id, user_id, customer_id, new_customer, unit_id, new_unit, description, priority, internal_notes } = body
    if (!shop_id || !description) return NextResponse.json({ error: 'shop_id and description required' }, { status: 400 })

    let finalCustomerId = customer_id || null
    let finalAssetId = unit_id || null // UI sends assets.id as unit_id
    let companyName = ''
    let contactName = ''
    let phone = ''
    let unitNumber = ''

    // Create new customer if needed
    if (new_customer && !finalCustomerId) {
      const { data: cust, error: custErr } = await s.from('customers').insert({
        shop_id,
        company_name: new_customer.company_name || 'Walk-in',
        contact_name: new_customer.contact_name || null,
        phone: new_customer.phone || null,
        email: new_customer.email || null,
      }).select().single()
      if (custErr) return NextResponse.json({ error: 'Failed to create customer: ' + custErr.message }, { status: 500 })
      finalCustomerId = cust.id
      companyName = cust.company_name
      contactName = cust.contact_name || ''
      phone = cust.phone || ''
    } else if (finalCustomerId) {
      const { data: c } = await s.from('customers').select('company_name, contact_name, phone').eq('id', finalCustomerId).single()
      if (c) { companyName = c.company_name || ''; contactName = c.contact_name || ''; phone = c.phone || '' }
    }

    // Create new asset if needed (UI fetches from assets table, so new units go there too)
    if (new_unit && !finalAssetId) {
      const { data: a, error: aErr } = await s.from('assets').insert({
        shop_id,
        customer_id: finalCustomerId,
        unit_number: new_unit.unit_number || null,
        year: new_unit.year ? parseInt(new_unit.year) : null,
        make: new_unit.make || null,
        model: new_unit.model || null,
        vin: new_unit.vin?.trim().toUpperCase() || null,
        unit_type: new_unit.unit_type || 'tractor',
        odometer: new_unit.mileage ? parseInt(new_unit.mileage) : 0,
        ownership_type: 'outside_customer',
        status: 'on_road',
      }).select().single()
      if (aErr) return NextResponse.json({ error: 'Failed to create unit: ' + aErr.message }, { status: 500 })
      finalAssetId = a.id
      unitNumber = a.unit_number || ''
    } else if (finalAssetId) {
      const { data: a } = await s.from('assets').select('unit_number').eq('id', finalAssetId).single()
      if (a) unitNumber = a.unit_number || ''
    }

    const { data: sr, error: srErr } = await s.from('service_requests').insert({
      shop_id,
      customer_id: finalCustomerId,
      asset_id: finalAssetId,
      unit_number: unitNumber,
      company_name: companyName,
      contact_name: contactName,
      phone,
      description,
      source: 'service_writer',
      check_in_type: 'service_writer',
      created_by: user_id || 'service_writer',
      status: 'new',
    }).select().single()

    if (srErr) return NextResponse.json({ error: 'Failed to create service request: ' + srErr.message }, { status: 500 })
    return NextResponse.json({ ok: true, service_request: sr })
  }

  // ── CONVERT / SCHEDULE / REJECT ──
  const { request_id, shop_id, user_id } = body
  if (!request_id || !action) return NextResponse.json({ error: 'request_id and action required' }, { status: 400 })

  const { data: sr } = await s.from('service_requests').select('*').eq('id', request_id).single()
  if (!sr) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

  switch (action) {
    case 'convert': {
      // Generate SO number
      const { count } = await s.from('service_orders').select('*', { count: 'exact', head: true }).eq('shop_id', sr.shop_id)
      const year = new Date().getFullYear()
      const soNum = `SO-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`

      // Create service order from request
      const { data: so, error: soErr } = await s.from('service_orders').insert({
        shop_id: sr.shop_id,
        so_number: soNum,
        asset_id: sr.asset_id || null,
        customer_id: sr.customer_id || null,
        complaint: sr.description,
        source: 'kiosk',
        priority: 'normal',
        status: 'draft',
        advisor_id: user_id || null,
        workorder_lane: 'shop_internal',
        status_family: 'draft',
      }).select().single()

      if (soErr) return NextResponse.json({ error: soErr.message }, { status: 500 })

      // Update request status
      await s.from('service_requests').update({ status: 'converted', converted_so_id: so.id }).eq('id', request_id)

      // Also update the kiosk_checkin if linked
      if (sr.kiosk_checkin_id) {
        await s.from('kiosk_checkins').update({ converted_so_id: so.id, status: 'converted' }).eq('id', sr.kiosk_checkin_id)
      }

      return NextResponse.json({ ok: true, so_id: so.id, so_number: so.so_number })
    }

    case 'schedule': {
      const { scheduled_date } = body
      if (!scheduled_date) return NextResponse.json({ error: 'scheduled_date required' }, { status: 400 })
      await s.from('service_requests').update({ status: 'scheduled', scheduled_date }).eq('id', request_id)
      return NextResponse.json({ ok: true })
    }

    case 'reject': {
      const { reason } = body
      await s.from('service_requests').update({ status: 'rejected', reject_reason: reason || 'Rejected' }).eq('id', request_id)
      if (sr.kiosk_checkin_id) {
        await s.from('kiosk_checkins').update({ status: 'rejected' }).eq('id', sr.kiosk_checkin_id)
      }
      return NextResponse.json({ ok: true })
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  }
}
