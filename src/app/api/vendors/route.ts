import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCache, setCache, invalidateCache } from '@/lib/cache'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const page = parseInt(searchParams.get('page') || '1')
  const perPage = Math.min(parseInt(searchParams.get('per_page') || '500'), 5000)
  const paginated = !!searchParams.get('page')

  const cacheKey = `vendors:${shopId}:${page}:${perPage}`
  const cached = getCache<any>(cacheKey)
  if (cached) return NextResponse.json(cached)

  const s = db()

  // Count query (separate)
  const { count: total } = await s
    .from('vendors')
    .select('*', { count: 'exact', head: true })
    .eq('shop_id', shopId)

  const from = (page - 1) * perPage
  const to = from + perPage - 1

  const { data: vendors, error } = await s
    .from('vendors')
    .select('*')
    .eq('shop_id', shopId)
    .order('name')
    .range(from, to)

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

  const enriched = (vendors || []).map(v => ({
    ...v,
    parts_count: vendorPartCounts.get((v.name || '').toLowerCase().trim()) || 0,
  }))

  // Return paginated response when page param is present, otherwise legacy array
  if (paginated) {
    const result = { data: enriched, total: total || 0, page, per_page: perPage, totalPages: Math.ceil((total || 0) / perPage) }
    setCache(cacheKey, result, 300)
    return NextResponse.json(result)
  }

  setCache(cacheKey, enriched, 300) // 5 min TTL — legacy array format
  return NextResponse.json(enriched)
}
