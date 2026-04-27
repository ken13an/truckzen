import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, getStaffEmails, getShopInfo } from '@/lib/services/email'
import { checkinConfirmedEmail } from '@/lib/emails/checkinConfirmed'
import { staffCheckinAlertEmail } from '@/lib/emails/staffCheckinAlert'
import { insertServiceOrder } from '@/lib/generateWoNumber'
import { sendPushToRole } from '@/lib/services/notifications'
import { checkKioskLimit } from '@/lib/kioskRateLimit'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// POST — submit a kiosk check-in, create WO + job lines
export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
  if (!checkKioskLimit(ip)) {
    return NextResponse.json({ error: 'Too many check-ins from this location. Try again later.' }, { status: 429 })
  }

  const s = db()
  const body = await req.json()
  const {
    shop_id, customer_id, unit_id, concern_text, concern_text_original, parked_location,
    keys_left, staying, need_by_date, priority, auth_type, auth_limit,
    contact_email, contact_phone, customer_type,
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
    const { data: activeWOs } = await s.from('service_orders')
      .select('id, so_number').eq('asset_id', finalUnitId).eq('shop_id', shop_id)
      .is('deleted_at', null)
      .not('status', 'in', '("good_to_go","done","void")')
      .limit(1)
    if (activeWOs && activeWOs.length > 0) {
      return NextResponse.json({ error: `This truck is already being serviced (${activeWOs[0].so_number}). Please check with the front desk.`, wo_number: activeWOs[0].so_number }, { status: 409 })
    }
  }

  // Snapshot ownership_type from asset for default line approval state
  let kioskOwnership = 'fleet_asset'
  if (finalUnitId) {
    const { data: assetOwn } = await s.from('assets').select('ownership_type, is_owner_operator').eq('id', finalUnitId).single()
    if (assetOwn?.ownership_type) kioskOwnership = assetOwn.ownership_type
    if (assetOwn?.is_owner_operator) kioskOwnership = 'owner_operator'
  }
  const lineApprovalDefaults = (kioskOwnership === 'owner_operator' || kioskOwnership === 'outside_customer')
    ? { approval_status: 'needs_approval' as const, approval_required: true }
    : { approval_status: 'pre_approved' as const, approval_required: false }

  // Create WO with atomic number generation + retry. Carry the same canonical
  // intake truth that /api/work-orders/route.ts:248-266 writes — without it,
  // downstream UI (work-order page banner, customer portal approval gate,
  // automation engine) cannot decide owner-operator vs fleet behavior.
  const portalToken = crypto.randomUUID()
  const kioskJobType = 'repair'
  const kioskEstimateRequired =
    (kioskOwnership === 'owner_operator' || kioskOwnership === 'outside_customer')
      && !['diagnostic', 'full_inspection'].includes(kioskJobType)
  const { data: wo, error: woErr } = await insertServiceOrder(s, shop_id, {
    asset_id: finalUnitId || null,
    customer_id: finalCustomerId || null,
    complaint: concern_text.trim(),
    source: 'kiosk',
    priority: priority === 'breakdown' ? 'critical' : priority === 'urgent' ? 'high' : 'normal',
    status: 'draft',
    portal_token: portalToken,
    auth_type: auth_type || 'estimate_first',
    auth_limit: auth_limit || null,
    ownership_type: kioskOwnership,
    job_type: kioskJobType,
    estimate_required: kioskEstimateRequired,
  })

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
    customer_type: customer_type || 'company',
    concern_text_original: concern_text_original || concern_text.trim(),
  })

  // Generate AI job lines via signed internal call. /api/ai/action-items
  // is gated for browser session OR HMAC; kiosk has no session so it must
  // sign its server-to-server fetch with TRUCKZEN_INTERNAL_API_SECRET.
  try {
    const aiPathname = '/api/ai/action-items'
    const aiBody = JSON.stringify({ complaint: concern_text.trim(), shop_id })
    const { signInternalRequest, INTERNAL_TS_HEADER, INTERNAL_SIG_HEADER } = await import('@/lib/internal-request-auth')
    const { timestamp, signature } = signInternalRequest({ method: 'POST', pathname: aiPathname, rawBody: aiBody })
    const aiRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://truckzen.pro'}${aiPathname}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [INTERNAL_TS_HEADER]: timestamp,
        [INTERNAL_SIG_HEADER]: signature,
      },
      body: aiBody,
    })
    if (aiRes.ok) {
      const aiData = await aiRes.json()
      const items = aiData.action_items || [{ description: concern_text.trim().toUpperCase(), skills: [] }]
      for (const item of items) {
        const desc = typeof item === 'string' ? item : item.description
        const skills = typeof item === 'string' ? [] : (item.skills || [])
        if (!desc?.trim()) continue
        await s.from('so_lines').insert({
          so_id: wo.id,
          line_type: 'labor',
          description: desc.trim(),
          quantity: 0,
          unit_price: 0,
          line_status: 'unassigned',
          required_skills: skills,
          ...lineApprovalDefaults,
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
      ...lineApprovalDefaults,
    })
  }

  // Log activity
  await s.from('wo_activity_log').insert({ wo_id: wo.id, action: `Kiosk check-in: ${checkinRef}` })

  // Fire-and-forget email notifications
  const unitLabel = new_unit?.unit_number || ''
  const customerName = new_customer?.contact_name || new_customer?.company_name || companyName || 'Customer'
  const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://truckzen.pro'}/portal/${portalToken}`

  // 1. Checkin confirmation to customer
  if (contact_email) {
    ;(async () => {
      try {
        const shop = await getShopInfo(shop_id)
        const { subject, html } = checkinConfirmedEmail({
          customerName,
          unitNumber: unitLabel,
          reference: checkinRef,
          portalLink: portalUrl,
          shop,
          estimateExpected: kioskEstimateRequired,
          concern: concern_text.trim(),
        })
        await sendEmail(contact_email, subject, html)
      } catch {}
    })()
  }

  // 2. Staff checkin alert to service writers
  ;(async () => {
    try {
      const shop = await getShopInfo(shop_id)
      const emails = await getStaffEmails(shop_id, 'service_writer')
      if (emails.length > 0) {
        const { subject, html } = staffCheckinAlertEmail({
          unitNumber: unitLabel,
          company: companyName || 'Walk-in',
          concern: concern_text.trim(),
          customerName,
          shop,
        })
        await sendEmail(emails, subject, html)
      }
    } catch {}
  })()

  // 3. Push notification to service writers
  ;(async () => {
    try {
      await sendPushToRole(shop_id, 'service_writer', 'New Check-In', `Unit ${unitLabel}, ${concern_text.trim()}`)
    } catch {}
  })()

  return NextResponse.json({
    ok: true,
    wo_id: wo.id,
    wo_number: wo.so_number,
    portal_token: portalToken,
    checkin_ref: checkinRef,
  }, { status: 201 })
}
