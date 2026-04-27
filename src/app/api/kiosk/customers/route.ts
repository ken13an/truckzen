// Public, kiosk-code-scoped customer search for the kiosk Step 1 typeahead.
// Trust model mirrors /api/kiosk/lookup: caller supplies kiosk `code`; the
// route resolves shop_id internally from shops.kiosk_code (+ kiosk_enabled
// gate). Caller-supplied shop_id is intentionally not accepted. Rate-limited
// per IP with the shared 'portal-ip' policy (same shape portal-guard uses
// for public customer-facing endpoints) since 'kiosk-pin-ip' is too tight
// for typeahead and no kiosk-search policy is registered.

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
  const q = (searchParams.get('q') || '').trim()
  const perPageRaw = parseInt(searchParams.get('per_page') || String(HARD_CAP))
  const perPage = Math.min(Math.max(Number.isFinite(perPageRaw) ? perPageRaw : HARD_CAP, 1), HARD_CAP)

  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 })

  const s = db()
  const { data: shop, error: shopErr } = await s.from('shops')
    .select('id, kiosk_enabled')
    .eq('kiosk_code', code)
    .single()

  if (shopErr || !shop) return NextResponse.json({ error: 'Kiosk not found' }, { status: 404 })
  if (shop.kiosk_enabled === false) return NextResponse.json({ error: 'Kiosk is disabled' }, { status: 403 })

  let query = s.from('customers')
    .select('id, company_name, contact_name, phone')
    .eq('shop_id', shop.id)
    .is('deleted_at', null)
    .order('company_name')
    .limit(perPage)

  if (q) {
    const pattern = q.length === 1 ? `${q}%` : `%${q}%`
    query = query.or(
      `company_name.ilike.${pattern},contact_name.ilike.${pattern},dot_number.ilike.${pattern},phone.ilike.${pattern}`
    )
  }

  const { data, error } = await query
  if (error) {
    console.error('[kiosk/customers] search failed', { shop_id: shop.id, error: error.message })
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }

  return NextResponse.json({ customers: data || [] })
}
