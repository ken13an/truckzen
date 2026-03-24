import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCache, setCache, invalidateCache } from '@/lib/cache'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const cacheKey = `labor-rates:${shopId}`
  const cached = getCache<any>(cacheKey)
  if (cached) return NextResponse.json(cached)

  const { data, error } = await s.from('shop_labor_rates').select('*').eq('shop_id', shopId).order('ownership_type').limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  setCache(cacheKey, data || [], 300) // 5 min TTL
  return NextResponse.json(data || [])
}

export async function PATCH(req: Request) {
  const s = db()
  const { rates, user_id, shop_id } = await req.json()
  if (!rates || !Array.isArray(rates)) return NextResponse.json({ error: 'rates array required' }, { status: 400 })

  for (const r of rates) {
    if (!r.id) continue
    const update: any = { updated_by: user_id || null, updated_at: new Date().toISOString() }
    if (r.rate_per_hour != null) update.rate_per_hour = r.rate_per_hour
    if (r.parts_margin_pct != null) update.parts_margin_pct = r.parts_margin_pct
    if (r.parts_markup_pct != null) update.parts_markup_pct = r.parts_markup_pct
    if (r.parts_pricing_mode != null) update.parts_pricing_mode = r.parts_pricing_mode
    await s.from('shop_labor_rates').update(update).eq('id', r.id)
  }

  if (shop_id) invalidateCache(`labor-rates:${shop_id}`)
  return NextResponse.json({ ok: true })
}
