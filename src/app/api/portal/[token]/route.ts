// Customer portal token resolver.
//
// Resolution order (read-only):
//   1. service_orders.portal_token = token  → SO-mode (existing behavior, unchanged)
//   2. kiosk_checkins.portal_token = token  → SR-aware fallback:
//      a. if kiosk_checkins.converted_so_id / wo_id → resolve linked SO, return SO-mode
//      b. else look up service_requests by kiosk_checkin_id; if SR.converted_so_id
//         set, follow it and return SO-mode (handles late conversion races)
//      c. else return SR-mode "pending request" shape with safe placeholders
//
// Never weakens existing SO-mode behavior. SR-mode response is field-whitelisted
// and contains no internal notes, raw line rows, auth_limit, or estimate
// approval tokens. Other portal action routes (approve/decline/etc.) still
// only operate on SO and will 404 cleanly for SR-mode tokens.

import { NextResponse } from 'next/server'
import { checkPortalLimits } from '@/lib/ratelimit/portal-guard'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const SO_SELECT = `
  id, shop_id, so_number, status, complaint, priority, grand_total, created_at, updated_at,
  auth_type, auth_limit, approved_at, approved_by, portal_token,
  estimate_status, estimate_approved_date, estimate_declined_reason, estimate_created_date,
  estimate_required, ownership_type, job_type,
  assets(id, unit_number, year, make, model, vin, odometer),
  customers(id, company_name, contact_name, phone, email),
  so_lines(id, line_type, description, quantity, unit_price, total_price, line_status, customer_approved, approved_at, is_additional, finding, resolution, estimated_hours, billed_hours),
  wo_shop_charges(id, description, amount, taxable)
`

type P = { params: Promise<{ token: string }> }

export async function GET(req: Request, { params }: P) {
  const { token } = await params
  const _rl = await checkPortalLimits(req, token); if (_rl !== true) return _rl
  const s = db()

  // 1. Existing SO-mode lookup. Unchanged behavior.
  const { data: wo } = await s
    .from('service_orders')
    .select(SO_SELECT)
    .eq('portal_token', token)
    .maybeSingle()

  if (wo) {
    const { data: shop } = await s.from('shops').select('name, dba, tax_rate, tax_labor, phone, email, address').eq('id', wo.shop_id).single()
    const { data: checkin } = await s.from('kiosk_checkins').select('need_by_date, parked_location, keys_left, staying, priority, contact_email, contact_phone').eq('portal_token', token).maybeSingle()
    return NextResponse.json({ ...wo, shop, checkin })
  }

  // 2. SR-aware fallback. Look up the kiosk_checkins row that owns this token.
  const { data: kc } = await s
    .from('kiosk_checkins')
    .select('id, shop_id, customer_id, asset_id, portal_token, converted_so_id, wo_id, checkin_ref, concern_text, concern_text_original, complaint_raw, contact_email, contact_phone, company_name, status, need_by_date, parked_location, keys_left, staying, priority, created_at')
    .eq('portal_token', token)
    .is('deleted_at', null)
    .maybeSingle()

  if (!kc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 2a. Kiosk row already linked to a SO (legacy direct-WO kiosk path, or
  // post-conversion). Resolve and return SO-mode using the linked id.
  const linkedSoId = kc.converted_so_id || kc.wo_id
  if (linkedSoId) {
    const { data: linkedWo } = await s
      .from('service_orders')
      .select(SO_SELECT)
      .eq('id', linkedSoId)
      .is('deleted_at', null)
      .maybeSingle()
    if (linkedWo) {
      const { data: shop } = await s.from('shops').select('name, dba, tax_rate, tax_labor, phone, email, address').eq('id', linkedWo.shop_id).single()
      const checkin = {
        need_by_date: kc.need_by_date,
        parked_location: kc.parked_location,
        keys_left: kc.keys_left,
        staying: kc.staying,
        priority: kc.priority,
        contact_email: kc.contact_email,
        contact_phone: kc.contact_phone,
      }
      return NextResponse.json({ ...linkedWo, shop, checkin })
    }
  }

  // 2b/2c. Look up the linked service_request.
  const { data: sr } = await s
    .from('service_requests')
    .select('id, shop_id, customer_id, asset_id, status, source, check_in_type, description, company_name, contact_name, phone, priority, urgency, created_at, converted_so_id, kiosk_checkin_id')
    .eq('kiosk_checkin_id', kc.id)
    .eq('shop_id', kc.shop_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!sr) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // SR was converted via service-requests/route.ts:172 but kiosk row hadn't
  // been re-synced yet — follow the SR's converted_so_id to return SO-mode.
  if (sr.converted_so_id) {
    const { data: linkedWo } = await s
      .from('service_orders')
      .select(SO_SELECT)
      .eq('id', sr.converted_so_id)
      .is('deleted_at', null)
      .maybeSingle()
    if (linkedWo) {
      const { data: shop } = await s.from('shops').select('name, dba, tax_rate, tax_labor, phone, email, address').eq('id', linkedWo.shop_id).single()
      const checkin = {
        need_by_date: kc.need_by_date,
        parked_location: kc.parked_location,
        keys_left: kc.keys_left,
        staying: kc.staying,
        priority: kc.priority,
        contact_email: kc.contact_email,
        contact_phone: kc.contact_phone,
      }
      return NextResponse.json({ ...linkedWo, shop, checkin })
    }
  }

  // 2d. Truly unconverted pending request — SR-mode response with placeholders
  // designed so the existing portal page's isUnreviewedIntake predicate
  // evaluates true and the page shows the "Under review" / "Request received"
  // state without crashing on missing fields.
  const { data: shop } = await s.from('shops').select('name, dba, tax_rate, tax_labor, phone, email, address').eq('id', sr.shop_id).single()

  let assets: any = null
  if (sr.asset_id) {
    const { data: a } = await s.from('assets').select('id, unit_number, year, make, model, vin, odometer').eq('id', sr.asset_id).maybeSingle()
    assets = a
  }
  let customers: any = null
  if (sr.customer_id) {
    const { data: c } = await s.from('customers').select('id, company_name, contact_name, phone, email').eq('id', sr.customer_id).maybeSingle()
    customers = c
  }

  const checkin = {
    need_by_date: kc.need_by_date,
    parked_location: kc.parked_location,
    keys_left: kc.keys_left,
    staying: kc.staying,
    priority: kc.priority,
    contact_email: kc.contact_email,
    contact_phone: kc.contact_phone,
  }

  const woShape = {
    id: sr.id,
    shop_id: sr.shop_id,
    so_number: null as string | null,
    status: 'draft' as const,
    complaint: sr.description ?? kc.concern_text ?? '',
    priority: sr.priority ?? null,
    grand_total: 0,
    created_at: sr.created_at,
    updated_at: null as string | null,
    auth_type: null as string | null,
    auth_limit: null as number | null,
    approved_at: null as string | null,
    approved_by: null as string | null,
    portal_token: kc.portal_token,
    estimate_status: null as string | null,
    estimate_approved_date: null as string | null,
    estimate_declined_reason: null as string | null,
    estimate_created_date: null as string | null,
    estimate_required: false,
    ownership_type: null as string | null,
    job_type: null as string | null,
    assets,
    customers,
    so_lines: [] as unknown[],
    wo_shop_charges: [] as unknown[],
    kind: 'pending_request' as const,
  }

  return NextResponse.json({ ...woShape, shop, checkin })
}
