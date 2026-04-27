import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/server-auth'
import { requireRouteContext } from '@/lib/api-route-auth'
import { SERVICE_WRITE_ROLES } from '@/lib/roles'

// Service-request routes are shop-scoped operational tools (service-writer
// check-in Path B). Body/query shop_id and user_id are no longer trusted —
// shop scope and audit attribution come from the server session.

// GET /api/service-requests?status=...
export async function GET(req: Request) {
  const ctx = await requireRouteContext([...SERVICE_WRITE_ROLES])
  if (ctx.error || !ctx.actor) return ctx.error!
  const shopId = ctx.actor.effective_shop_id || ctx.actor.shop_id
  if (!shopId) return NextResponse.json({ error: 'No shop context' }, { status: 400 })

  const s = createAdminSupabaseClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  let q = s.from('service_requests')
    .select('id, shop_id, customer_id, asset_id, unit_number, company_name, contact_name, phone, description, source, check_in_type, status, reject_reason, scheduled_date, expected_arrival, promised_date, parking_location, key_location, converted_so_id, created_by, created_at, kiosk_checkin_id')
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
  const ctx = await requireRouteContext([...SERVICE_WRITE_ROLES])
  if (ctx.error || !ctx.actor) return ctx.error!
  const shopId = ctx.actor.effective_shop_id || ctx.actor.shop_id
  if (!shopId) return NextResponse.json({ error: 'No shop context' }, { status: 400 })

  const s = createAdminSupabaseClient()
  const body = await req.json()
  const { action } = body

  // ── CREATE (service writer check-in Path B) ──
  if (action === 'create') {
    const { customer_id, new_customer, unit_id, new_unit, description } = body
    if (!description) return NextResponse.json({ error: 'description required' }, { status: 400 })

    let finalCustomerId = customer_id || null
    let finalAssetId = unit_id || null // UI sends assets.id as unit_id
    let companyName = ''
    let contactName = ''
    let phone = ''
    let unitNumber = ''

    // Create new customer if needed
    if (new_customer && !finalCustomerId) {
      const { data: cust, error: custErr } = await s.from('customers').insert({
        shop_id: shopId,
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
      const { data: c } = await s.from('customers').select('company_name, contact_name, phone, shop_id').eq('id', finalCustomerId).single()
      if (!c || c.shop_id !== shopId) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
      companyName = c.company_name || ''; contactName = c.contact_name || ''; phone = c.phone || ''
    }

    // Create new asset if needed (UI fetches from assets table, so new units go there too)
    if (new_unit && !finalAssetId) {
      const { data: a, error: aErr } = await s.from('assets').insert({
        shop_id: shopId,
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
      const { data: a } = await s.from('assets').select('unit_number, shop_id').eq('id', finalAssetId).single()
      if (!a || a.shop_id !== shopId) return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
      unitNumber = a.unit_number || ''
    }

    const { data: sr, error: srErr } = await s.from('service_requests').insert({
      shop_id: shopId,
      customer_id: finalCustomerId,
      asset_id: finalAssetId,
      unit_number: unitNumber,
      company_name: companyName,
      contact_name: contactName,
      phone,
      description,
      source: 'service_writer',
      check_in_type: 'service_writer',
      created_by: ctx.actor.id,
      status: 'new',
    }).select().single()

    if (srErr) return NextResponse.json({ error: 'Failed to create service request: ' + srErr.message }, { status: 500 })
    return NextResponse.json({ ok: true, service_request: sr })
  }

  // ── CONVERT / SCHEDULE / REJECT ──
  const { request_id } = body
  if (!request_id || !action) return NextResponse.json({ error: 'request_id and action required' }, { status: 400 })

  const { data: sr } = await s.from('service_requests').select('*').eq('id', request_id).single()
  if (!sr || sr.shop_id !== shopId) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

  switch (action) {
    case 'convert': {
      // Generate SO number
      const { count } = await s.from('service_orders').select('*', { count: 'exact', head: true }).eq('shop_id', sr.shop_id)
      const year = new Date().getFullYear()
      const soNum = `SO-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`

      // Snapshot ownership_type from the linked asset, same pattern as
      // /api/work-orders/route.ts:235-245. Falls back to 'fleet_asset' if no
      // asset is attached or asset has no ownership data.
      let convertOwnership = 'fleet_asset'
      if (sr.asset_id) {
        const { data: assetData } = await s.from('assets').select('ownership_type, is_owner_operator').eq('id', sr.asset_id).single()
        if (assetData?.ownership_type) convertOwnership = assetData.ownership_type
        if (assetData?.is_owner_operator) convertOwnership = 'owner_operator'
      }
      const convertJobType = 'repair'
      const convertEstimateRequired =
        (convertOwnership === 'owner_operator' || convertOwnership === 'outside_customer')
          && !['diagnostic', 'full_inspection'].includes(convertJobType)

      // If kiosk-originated, carry the customer's portal token onto the SO so
      // the customer's existing /portal/<token> link continues to work after
      // conversion (the SR-aware resolver already handles the pre-conversion
      // case via kiosk_checkins.portal_token).
      let portalTokenCarry: string | null = null
      if (sr.kiosk_checkin_id) {
        const { data: kc } = await s.from('kiosk_checkins')
          .select('id, shop_id, portal_token, status')
          .eq('id', sr.kiosk_checkin_id)
          .eq('shop_id', sr.shop_id)
          .maybeSingle()
        if (kc?.portal_token) portalTokenCarry = kc.portal_token
      }

      // Create service order from request. source preserves the originating
      // service_request.source ('service_writer' from the create branch) — was
      // previously hardcoded to 'kiosk' which corrupted the audit trail.
      // origin_service_request_id (added by 20260331_hulkmode1_schema.sql)
      // closes the bidirectional audit trail with service_requests.converted_so_id.
      const { data: so, error: soErr } = await s.from('service_orders').insert({
        shop_id: sr.shop_id,
        so_number: soNum,
        asset_id: sr.asset_id || null,
        customer_id: sr.customer_id || null,
        complaint: sr.description,
        source: sr.source || 'service_writer',
        priority: 'normal',
        status: 'draft',
        advisor_id: ctx.actor.id,
        service_writer_id: ctx.actor.id,
        workorder_lane: 'shop_internal',
        status_family: 'draft',
        ownership_type: convertOwnership,
        job_type: convertJobType,
        estimate_required: convertEstimateRequired,
        portal_token: portalTokenCarry,
        origin_service_request_id: sr.id,
      }).select().single()

      if (soErr) return NextResponse.json({ error: soErr.message }, { status: 500 })

      // Insert customer-visible "Note from Customer" preserving the original
      // request text separate from any reviewed job lines. Fail-closed: if the
      // note insert fails after the SO insert, return 500 and DO NOT mark the
      // SR converted (the next convert attempt will succeed and the SO row
      // already created remains, but the SR/kiosk linkage is honest).
      const customerNoteText = (sr.description ?? '').trim()
      if (customerNoteText) {
        const { error: noteErr } = await s.from('wo_notes').insert({
          wo_id: so.id,
          user_id: ctx.actor.id,
          note_text: `Note from Customer: ${customerNoteText}`,
          visible_to_customer: true,
        })
        if (noteErr) {
          return NextResponse.json({ error: 'Failed to preserve customer note: ' + noteErr.message }, { status: 500 })
        }
      }

      // Optional reviewed-lines payload from the new Pending Request review
      // page. The existing /service-requests queue page convert button does
      // NOT send this — convert remains backward compatible (no lines created
      // when the field is absent). Server-side validation: array shape, each
      // item has a non-empty trimmed description, hard caps on count + length.
      const rawReviewedLines = (body as any)?.reviewed_lines
      let reviewedLinesClean: Array<{ description: string }> = []
      if (Array.isArray(rawReviewedLines)) {
        reviewedLinesClean = rawReviewedLines
          .map((l: any) => ({ description: typeof l?.description === 'string' ? l.description.trim().slice(0, 500) : '' }))
          .filter(l => l.description.length > 0)
          .slice(0, 25)
      }
      if (reviewedLinesClean.length > 0) {
        const linesPayload = reviewedLinesClean.map(l => ({
          so_id: so.id,
          line_type: 'labor' as const,
          description: l.description,
          quantity: 0,
          unit_price: 0,
          line_status: 'unassigned' as const,
        }))
        const { error: linesErr } = await s.from('so_lines').insert(linesPayload)
        if (linesErr) {
          return NextResponse.json({ error: 'Failed to create reviewed job lines: ' + linesErr.message }, { status: 500 })
        }
      }

      // Update request status (only after note + reviewed lines succeeded)
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
