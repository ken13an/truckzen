import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// POST — submit a kiosk check-in, create WO + job lines
export async function POST(req: Request) {
  const s = db()
  const body = await req.json()
  const {
    shop_id, customer_id, unit_id, concern_text, parked_location,
    keys_left, staying, need_by_date, priority, auth_type, auth_limit,
    contact_email, contact_phone,
    // Optional new customer/unit data
    new_customer, new_unit,
  } = body

  if (!shop_id) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })
  if (!concern_text?.trim()) return NextResponse.json({ error: 'Concern text required' }, { status: 400 })

  let finalCustomerId = customer_id
  let finalUnitId = unit_id
  let companyName = ''

  // Create new customer if needed
  if (new_customer && !finalCustomerId) {
    const { data: cust, error: custErr } = await s.from('customers').insert({
      shop_id,
      company_name: new_customer.company_name || 'Walk-in',
      contact_name: new_customer.contact_name || null,
      phone: new_customer.phone || contact_phone || null,
      email: new_customer.email || contact_email || null,
      dot_number: new_customer.dot_number || null,
      mc_number: new_customer.mc_number || null,
    }).select().single()
    if (custErr) return NextResponse.json({ error: 'Failed to create customer: ' + custErr.message }, { status: 500 })
    finalCustomerId = cust.id
    companyName = cust.company_name
  } else if (finalCustomerId) {
    const { data: c } = await s.from('customers').select('company_name').eq('id', finalCustomerId).single()
    companyName = c?.company_name || ''
  }

  // Create new unit if needed
  if (new_unit && !finalUnitId) {
    // VIN decode attempt
    let year = new_unit.year ? parseInt(new_unit.year) : null
    let make = new_unit.make || null
    let model = new_unit.model || null
    if (new_unit.vin && new_unit.vin.length === 17 && (!year || !make)) {
      try {
        const vinRes = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${new_unit.vin}?format=json`)
        const vinData = await vinRes.json()
        const r = vinData.Results?.[0]
        if (r?.ErrorCode === '0' || r?.Make) {
          year = year || parseInt(r.ModelYear) || null
          make = make || r.Make || null
          model = model || r.Model || null
        }
      } catch {}
    }

    const { data: u, error: uErr } = await s.from('assets').insert({
      shop_id,
      customer_id: finalCustomerId,
      unit_number: new_unit.unit_number || null,
      vin: new_unit.vin?.toUpperCase() || null,
      year,
      make,
      model,
      odometer: new_unit.mileage ? parseInt(new_unit.mileage) : null,
      license_plate: new_unit.license_plate || null,
      status: 'on_road',
    }).select().single()
    if (uErr) return NextResponse.json({ error: 'Failed to create unit: ' + uErr.message }, { status: 500 })
    finalUnitId = u.id
  }

  // Generate WO number
  // Duplicate WO prevention
  if (finalUnitId) {
    const { data: activeWO } = await s.from('service_orders')
      .select('id, so_number').eq('asset_id', finalUnitId).eq('shop_id', shop_id)
      .not('wo_status', 'in', '("closed","completed","invoiced")')
      .not('status', 'in', '("closed","good_to_go","void")')
      .limit(1).single()
    if (activeWO) {
      return NextResponse.json({ error: `This truck is already being serviced (${activeWO.so_number}). Please check with the front desk.`, wo_number: activeWO.so_number }, { status: 409 })
    }
  }

  const { count } = await s.from('service_orders').select('*', { count: 'exact', head: true }).eq('shop_id', shop_id)
  const woYear = new Date().getFullYear()
  const woNum = `WO-${woYear}-${String((count ?? 0) + 1).padStart(4, '0')}`

  // Create WO
  const portalToken = crypto.randomUUID()
  const { data: wo, error: woErr } = await s.from('service_orders').insert({
    shop_id,
    so_number: woNum,
    asset_id: finalUnitId || null,
    customer_id: finalCustomerId || null,
    complaint: concern_text.trim(),
    source: 'kiosk',
    priority: priority === 'breakdown' ? 'critical' : priority === 'urgent' ? 'high' : 'normal',
    status: 'draft',
    portal_token: portalToken,
    auth_type: auth_type || 'estimate_first',
    auth_limit: auth_limit || null,
  }).select().single()

  if (woErr) return NextResponse.json({ error: 'Failed to create WO: ' + woErr.message }, { status: 500 })

  // Create kiosk checkin record
  const checkinRef = `CK-${Date.now().toString(36).toUpperCase()}`
  await s.from('kiosk_checkins').insert({
    shop_id,
    customer_id: finalCustomerId || null,
    asset_id: finalUnitId || null,
    concern_text: concern_text.trim(),
    complaint_raw: concern_text.trim(),
    parked_location: parked_location || null,
    keys_left: keys_left || null,
    staying: staying ?? null,
    need_by_date: need_by_date || null,
    priority: priority || 'routine',
    auth_type: auth_type || 'estimate_first',
    auth_limit: auth_limit || null,
    contact_email: contact_email || null,
    contact_phone: contact_phone || null,
    portal_token: portalToken,
    wo_id: wo.id,
    checkin_ref: checkinRef,
    company_name: companyName,
    status: 'converted',
    converted_so_id: wo.id,
  })

  // Generate AI job lines
  try {
    const aiRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://truckzen.pro'}/api/ai/action-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ complaint: concern_text.trim() }),
    })
    if (aiRes.ok) {
      const aiData = await aiRes.json()
      const items = aiData.action_items || [concern_text.trim().toUpperCase()]
      for (const item of items) {
        if (!item?.trim()) continue
        await s.from('so_lines').insert({
          so_id: wo.id,
          line_type: 'labor',
          description: item.trim(),
          quantity: 0,
          unit_price: 0,
          line_status: 'unassigned',
        })
      }
    }
  } catch {
    // Fallback: single job line
    await s.from('so_lines').insert({
      so_id: wo.id,
      line_type: 'labor',
      description: concern_text.trim().toUpperCase(),
      quantity: 0,
      unit_price: 0,
      line_status: 'unassigned',
    })
  }

  // Log activity
  await s.from('wo_activity_log').insert({ wo_id: wo.id, action: `Kiosk check-in: ${checkinRef}` })

  // Send portal email (fire and forget — do NOT await)
  if (contact_email) {
    (async () => {
      try {
        const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://truckzen.pro'}/portal/${portalToken}`
        const { data: shopData } = await s.from('shops').select('name, dba').eq('id', shop_id).single()
        const shopName = shopData?.dba || shopData?.name || 'TruckZen'
        const { Resend } = await import('resend')
        const resend = new Resend(process.env.RESEND_API_KEY!)
        await resend.emails.send({
          from: process.env.EMAIL_FROM || 'TruckZen <noreply@truckzen.pro>',
          to: contact_email,
          subject: `${woNum} — Your truck is checked in at ${shopName}`,
          html: `<div style="font-family:sans-serif;background:#151520;color:#EDEDF0;padding:40px;max-width:480px;margin:0 auto">
            <div style="font-size:22px;font-weight:700;margin-bottom:16px">Your Truck Is Checked In</div>
            <p style="color:#9D9DA1;line-height:1.7">Work Order <strong>${woNum}</strong> has been created at ${shopName}.</p>
            <p style="color:#9D9DA1;line-height:1.7">Track your repair status, approve estimates, and pay online:</p>
            <a href="${portalUrl}" style="display:inline-block;margin:20px 0;padding:14px 28px;background:#1D6FE8;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:16px">View Your Repair Status</a>
            <p style="color:#9D9DA1;font-size:12px;margin-top:20px">Or copy this link: ${portalUrl}</p>
          </div>`,
        })
      } catch (emailErr) {
        console.error('[Kiosk] Email send failed:', emailErr)
      }
    })()
  }

  return NextResponse.json({
    ok: true,
    wo_id: wo.id,
    wo_number: woNum,
    portal_token: portalToken,
    checkin_ref: checkinRef,
  }, { status: 201 })
}
