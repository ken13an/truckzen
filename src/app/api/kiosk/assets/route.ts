// Public, kiosk-code-scoped per-customer asset search for the kiosk Step 2
// typeahead. Trust model mirrors /api/kiosk/customers: caller supplies kiosk
// `code` + `customer_id`; the route resolves shop_id internally and verifies
// the customer belongs to that shop before returning any assets. Caller-
// supplied shop_id is intentionally not accepted. Same rate-limit policy as
// the kiosk customer search.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/ratelimit/core'
import { getRequestIp } from '@/lib/ratelimit/request-ip'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const HARD_CAP = 8

export async function GET(req: Request) {
  const ip = getRequestIp(req)
  const ipLimit = await rateLimit('portal-ip', ip)
  if (!ipLimit.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')?.toLowerCase().trim()
  const customerId = (searchParams.get('customer_id') || '').trim()
  const q = (searchParams.get('q') || '').trim()

  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 })
  if (!customerId) return NextResponse.json({ error: 'customer_id required' }, { status: 400 })

  const s = db()
  const { data: shop, error: shopErr } = await s.from('shops')
    .select('id, kiosk_enabled')
    .eq('kiosk_code', code)
    .single()

  if (shopErr || !shop) return NextResponse.json({ error: 'Kiosk not found' }, { status: 404 })
  if (shop.kiosk_enabled === false) return NextResponse.json({ error: 'Kiosk is disabled' }, { status: 403 })

  // Verify customer belongs to the kiosk-resolved shop before returning any
  // assets. Without this check, a caller with a valid kiosk code could
  // enumerate assets for any customer_id by guessing UUIDs.
  const { data: customer, error: custErr } = await s.from('customers')
    .select('id')
    .eq('id', customerId)
    .eq('shop_id', shop.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (custErr) {
    console.error('[kiosk/assets] customer check failed', { shop_id: shop.id, error: custErr.message })
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
  if (!customer) return NextResponse.json({ error: 'Invalid customer_id for this kiosk' }, { status: 400 })

  let query = s.from('assets')
    .select('id, unit_number, year, make, model, vin')
    .eq('shop_id', shop.id)
    .eq('customer_id', customer.id)
    .is('deleted_at', null)
    .order('unit_number')
    .limit(HARD_CAP)

  if (q) {
    const pattern = `%${q}%`
    query = query.or(
      `unit_number.ilike.${pattern},make.ilike.${pattern},model.ilike.${pattern},vin.ilike.${pattern},owner_name.ilike.${pattern},driver_name.ilike.${pattern}`
    )
  }

  const { data, error } = await query
  if (error) {
    console.error('[kiosk/assets] search failed', { shop_id: shop.id, error: error.message })
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }

  return NextResponse.json({ assets: data || [] })
}
