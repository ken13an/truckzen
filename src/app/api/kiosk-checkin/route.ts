import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, getStaffEmails, getShopInfo } from '@/lib/services/email'
import { checkinConfirmedEmail } from '@/lib/emails/checkinConfirmed'
import { staffCheckinAlertEmail } from '@/lib/emails/staffCheckinAlert'
import { sendPushToRole } from '@/lib/services/notifications'
import { checkKioskLimit } from '@/lib/kioskRateLimit'

// Kiosk submit creates a Pending Request (kiosk_checkins audit row +
// service_requests Pending Request) — NOT a service_order. The service writer
// reviews and converts to a real WO via /api/service-requests action='convert'.
// AI job-line generation moves to the service-writer review/convert step.

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// POST — submit a kiosk check-in
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
  let resolvedContactName = ''

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
    resolvedContactName = cust.contact_name || new_customer.contact_name || ''
  } else if (finalCustomerId) {
    const { data: c } = await s.from('customers').select('company_name, contact_name').eq('id', finalCustomerId).single()
    companyName = c?.company_name || ''
    resolvedContactName = c?.contact_name || ''
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

  // Duplicate WO prevention — preserved. If an active service_order already
  // exists for this asset, the customer is told to check with the front desk
  // rather than submitting a new Pending Request. (Pending-request-vs-pending-
  // request duplicate detection is a future concern handled at conversion.)
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

  // Snapshot ownership_type and unit_number. ownership_type is used only for
  // the customer email's estimateExpected wording — operational ownership/
  // job/estimate truth is set at conversion time when the service writer
  // creates the SO.
  let kioskOwnership = 'fleet_asset'
  let unitNumber = ''
  if (finalUnitId) {
    const { data: assetOwn } = await s.from('assets').select('unit_number, ownership_type, is_owner_operator').eq('id', finalUnitId).single()
    unitNumber = assetOwn?.unit_number || ''
    if (assetOwn?.ownership_type) kioskOwnership = assetOwn.ownership_type
    if (assetOwn?.is_owner_operator) kioskOwnership = 'owner_operator'
  }
  const kioskJobType = 'repair'
  const kioskEstimateRequired =
    (kioskOwnership === 'owner_operator' || kioskOwnership === 'outside_customer')
      && !['diagnostic', 'full_inspection'].includes(kioskJobType)

  const portalToken = crypto.randomUUID()
  const checkinRef = `CK-${Date.now().toString(36).toUpperCase()}`

  // 1. Create kiosk_checkins audit row FIRST (status='new', no SO link).
  const { data: checkin, error: kcErr } = await s.from('kiosk_checkins').insert({
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
    wo_id: null,
    checkin_ref: checkinRef,
    company_name: companyName,
    status: 'new',
    converted_so_id: null,
    customer_type: customer_type || 'company',
    concern_text_original: concern_text_original || concern_text.trim(),
  }).select().single()

  if (kcErr || !checkin) {
    return NextResponse.json({ error: 'Failed to record check-in: ' + (kcErr?.message || 'unknown error') }, { status: 500 })
  }

  // 2. Create service_requests Pending Request linked to the kiosk_checkins
  // row. The service writer will review and convert this to a real WO via
  // /api/service-requests action='convert'. The raw kiosk priority is kept
  // on kiosk_checkins (above) — service_requests has no priority column in
  // the live schema, so we don't write it here. Service writer can read it
  // off kiosk_checkins at conversion if needed.
  const { data: sr, error: srErr } = await s.from('service_requests').insert({
    shop_id,
    customer_id: finalCustomerId || null,
    asset_id: finalUnitId || null,
    unit_number: unitNumber,
    company_name: companyName,
    contact_name: resolvedContactName || null,
    phone: contact_phone || null,
    description: concern_text.trim(),
    source: 'kiosk_checkin',
    check_in_type: 'kiosk',
    status: 'new',
    parking_location: parked_location || null,
    key_location: keys_left || null,
    kiosk_checkin_id: checkin.id,
    created_by: 'kiosk',
  }).select().single()

  if (srErr || !sr) {
    // Mark the kiosk audit row so we don't leave a dangling row behind a
    // failed SR insert. No customer email is sent on partial failure.
    await s.from('kiosk_checkins').update({ status: 'error' }).eq('id', checkin.id)
    return NextResponse.json({ error: 'Failed to create pending request: ' + (srErr?.message || 'unknown error') }, { status: 500 })
  }

  // Fire-and-forget email + push notifications. Sent only after both inserts
  // succeed so customers don't receive a confirmation for a failed request.
  const unitLabel = unitNumber || new_unit?.unit_number || ''
  const customerName = new_customer?.contact_name || resolvedContactName || new_customer?.company_name || companyName || 'Customer'
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

  // 2. Staff alert to service writers — template already says "checked in
  // via the kiosk" without implying a real WO exists.
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
      await sendPushToRole(shop_id, 'service_writer', 'New Pending Request', `Unit ${unitLabel}, ${concern_text.trim()}`)
    } catch {}
  })()

  // Response shape preserved enough for KioskFlow success screen, which
  // reads data.wo_number (used as the customer-facing reference) and
  // data.portal_token. checkinRef is the right reference value here — the
  // request is not a WO yet, but the customer's printable reference is the
  // CK- code generated above.
  return NextResponse.json({
    success: true,
    request_id: sr.id,
    checkin_id: checkin.id,
    reference: checkinRef,
    wo_number: checkinRef,
    portal_token: portalToken,
    portal_url: portalUrl,
    mode: 'pending_request',
  }, { status: 201 })
}
