import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCache, setCache, invalidateCache } from '@/lib/cache'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const cacheKey = `vendors:${shopId}`
  const cached = getCache<any>(cacheKey)
  if (cached) return NextResponse.json(cached)

  const s = db()

  const { data: vendors, error } = await s
    .from('vendors')
    .select('*')
    .eq('shop_id', shopId)
    .order('name')
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Count parts linked to each vendor
  const { data: parts } = await s
    .from('parts')
    .select('preferred_vendor')
    .eq('shop_id', shopId)
    .is('deleted_at', null)
    .limit(5000)

  const vendorPartCounts = new Map<string, number>()
  for (const p of parts || []) {
    const v = (p.preferred_vendor || '').toLowerCase().trim()
    if (v) vendorPartCounts.set(v, (vendorPartCounts.get(v) || 0) + 1)
  }

  const result = (vendors || []).map(v => ({
    ...v,
    parts_count: vendorPartCounts.get((v.name || '').toLowerCase().trim()) || 0,
  }))

  setCache(cacheKey, result, 300) // 5 min TTL
  return NextResponse.json(result)
}
