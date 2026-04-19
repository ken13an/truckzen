import { NextResponse } from 'next/server'
import { checkPortalLimits } from '@/lib/ratelimit/portal-guard'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

type P = { params: Promise<{ token: string }> }

export async function GET(req: Request, { params }: P) {
  const { token } = await params
  const _rl = await checkPortalLimits(req, token); if (_rl !== true) return _rl
  const s = db()

  // Find WO by portal_token
  const { data: wo, error } = await s
    .from('service_orders')
    .select(`
      id, shop_id, so_number, status, complaint, priority, grand_total, created_at, updated_at,
      auth_type, auth_limit, approved_at, approved_by, portal_token,
      estimate_status, estimate_approved_date, estimate_declined_reason, estimate_created_date,
      assets(id, unit_number, year, make, model, vin, odometer),
      customers(id, company_name, contact_name, phone, email),
      so_lines(id, line_type, description, quantity, unit_price, total_price, line_status, customer_approved, approved_at, is_additional, supplement_batch_id, finding, resolution, estimated_hours, billed_hours),
      wo_parts(id, line_id, part_number, description, quantity, unit_cost, status, is_additional, customer_approved, approved_at, supplement_batch_id),
      wo_shop_charges(id, description, amount, taxable)
    `)
    .eq('portal_token', token)
    .single()

  if (error || !wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Get shop settings for tax
  const { data: shop } = await s.from('shops').select('name, dba, tax_rate, tax_labor, phone, email, address').eq('id', wo.shop_id).single()

  // Get checkin details
  const { data: checkin } = await s.from('kiosk_checkins').select('need_by_date, parked_location, keys_left, staying, priority, contact_email, contact_phone').eq('portal_token', token).single()

  return NextResponse.json({ ...wo, shop, checkin })
}
