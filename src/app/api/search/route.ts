import { NextResponse } from 'next/server'
import { getAuthenticatedUserProfile, getActorShopId, jsonError, createAdminSupabaseClient } from '@/lib/server-auth'
import type { SearchResult, SearchEntityType, SearchResponse } from '@/types/search'

export async function GET(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const limit = Math.min(parseInt(searchParams.get('limit') || '5'), 20)

  if (q.length < 2) {
    return NextResponse.json({ query: q, results: [], counts: { work_order: 0, customer: 0, asset: 0, part: 0, employee: 0, vendor: 0 }, total: 0 } satisfies SearchResponse)
  }

  const s = createAdminSupabaseClient()
  const pattern = `%${q}%`

  // Run all 6 entity searches in parallel
  const [woResults, customerResults, assetResults, partResults, employeeResults, vendorResults] = await Promise.all([
    searchWorkOrders(s, shopId, q, pattern, limit),
    searchCustomers(s, shopId, pattern, limit),
    searchAssets(s, shopId, pattern, limit),
    searchParts(s, shopId, pattern, limit),
    searchEmployees(s, shopId, pattern, limit),
    searchVendors(s, shopId, pattern, limit),
  ])

  const allResults = [...woResults, ...customerResults, ...assetResults, ...partResults, ...employeeResults, ...vendorResults]
  allResults.sort((a, b) => b.relevance - a.relevance)

  const counts: Record<SearchEntityType, number> = {
    work_order: woResults.length,
    customer: customerResults.length,
    asset: assetResults.length,
    part: partResults.length,
    employee: employeeResults.length,
    vendor: vendorResults.length,
  }

  return NextResponse.json({ query: q, results: allResults, counts, total: allResults.length } satisfies SearchResponse)
}

async function searchWorkOrders(s: ReturnType<typeof createAdminSupabaseClient>, shopId: string, q: string, pattern: string, limit: number): Promise<SearchResult[]> {
  try {
    // Cross-table lookups for customer name and asset unit number
    const [{ data: matchCust }, { data: matchAsset }] = await Promise.all([
      s.from('customers').select('id').eq('shop_id', shopId).ilike('company_name', pattern),
      s.from('assets').select('id').eq('shop_id', shopId).or(`unit_number.ilike.${pattern},vin.ilike.${pattern}`),
    ])
    const custIds = (matchCust || []).map((c: any) => c.id)
    const assetIds = (matchAsset || []).map((a: any) => a.id)

    const orParts = [`so_number.ilike.${pattern}`, `complaint.ilike.${pattern}`]
    if (custIds.length > 0) orParts.push(`customer_id.in.(${custIds.join(',')})`)
    if (assetIds.length > 0) orParts.push(`asset_id.in.(${assetIds.join(',')})`)

    const { data } = await s
      .from('service_orders')
      .select('id, so_number, status, complaint, created_at, customer_id, asset_id')
      .eq('shop_id', shopId)
      .is('deleted_at', null)
      .not('status', 'eq', 'void')
      .or(orParts.join(','))
      .order('created_at', { ascending: false })
      .limit(limit)

    return (data || []).map((wo: any) => {
      const soMatch = wo.so_number?.toLowerCase().includes(q.toLowerCase())
      return {
        id: wo.id,
        entity_type: 'work_order' as const,
        title: `WO #${wo.so_number}`,
        subtitle: wo.complaint ? wo.complaint.slice(0, 80) : 'No complaint',
        url: `/work-orders/${wo.id}`,
        status: wo.status,
        relevance: soMatch ? 90 : 70,
      }
    })
  } catch (e) {
    console.error('[search] work_orders error:', e)
    return []
  }
}

async function searchCustomers(s: ReturnType<typeof createAdminSupabaseClient>, shopId: string, pattern: string, limit: number): Promise<SearchResult[]> {
  try {
    const { data } = await s
      .from('customers')
      .select('id, company_name, contact_name, phone')
      .eq('shop_id', shopId)
      .is('deleted_at', null)
      .or(`company_name.ilike.${pattern},contact_name.ilike.${pattern},phone.ilike.${pattern}`)
      .order('total_spent', { ascending: false })
      .limit(limit)

    return (data || []).map((c: any) => ({
      id: c.id,
      entity_type: 'customer' as const,
      title: c.company_name || '—',
      subtitle: [c.contact_name, c.phone].filter(Boolean).join(' · ') || '—',
      url: `/customers/${c.id}`,
      relevance: 85,
    }))
  } catch (e) {
    console.error('[search] customers error:', e)
    return []
  }
}

async function searchAssets(s: ReturnType<typeof createAdminSupabaseClient>, shopId: string, pattern: string, limit: number): Promise<SearchResult[]> {
  try {
    const { data } = await s
      .from('assets')
      .select('id, unit_number, year, make, model, vin')
      .eq('shop_id', shopId)
      .is('deleted_at', null)
      .or(`unit_number.ilike.${pattern},vin.ilike.${pattern},make.ilike.${pattern},model.ilike.${pattern}`)
      .order('unit_number')
      .limit(limit)

    return (data || []).map((a: any) => ({
      id: a.id,
      entity_type: 'asset' as const,
      title: `Unit ${a.unit_number || '—'}`,
      subtitle: [a.year, a.make, a.model].filter(Boolean).join(' ') || '—',
      url: `/fleet/${a.id}`,
      relevance: 90,
    }))
  } catch (e) {
    console.error('[search] assets error:', e)
    return []
  }
}

async function searchParts(s: ReturnType<typeof createAdminSupabaseClient>, shopId: string, pattern: string, limit: number): Promise<SearchResult[]> {
  try {
    const { data } = await s
      .from('parts')
      .select('id, part_number, description, on_hand, status')
      .eq('shop_id', shopId)
      .is('deleted_at', null)
      .or(`description.ilike.${pattern},part_number.ilike.${pattern},manufacturer.ilike.${pattern}`)
      .order('on_hand', { ascending: false })
      .limit(limit)

    return (data || []).map((p: any) => ({
      id: p.id,
      entity_type: 'part' as const,
      title: p.description || '—',
      subtitle: `PN: ${p.part_number || '—'} | Qty: ${p.on_hand ?? 0}`,
      url: `/parts/${p.id}`,
      relevance: 85,
    }))
  } catch (e) {
    console.error('[search] parts error:', e)
    return []
  }
}

async function searchEmployees(s: ReturnType<typeof createAdminSupabaseClient>, shopId: string, pattern: string, limit: number): Promise<SearchResult[]> {
  try {
    const { data } = await s
      .from('users')
      .select('id, full_name, role, team')
      .eq('shop_id', shopId)
      .is('deleted_at', null)
      .eq('active', true)
      .ilike('full_name', pattern)
      .limit(limit)

    return (data || []).map((u: any) => ({
      id: u.id,
      entity_type: 'employee' as const,
      title: u.full_name || '—',
      subtitle: [u.role?.replace(/_/g, ' '), u.team ? `Team ${u.team}` : null].filter(Boolean).join(' · '),
      url: `/settings/users`,
      relevance: 80,
    }))
  } catch (e) {
    console.error('[search] employees error:', e)
    return []
  }
}

async function searchVendors(s: ReturnType<typeof createAdminSupabaseClient>, shopId: string, pattern: string, limit: number): Promise<SearchResult[]> {
  try {
    const { data } = await s
      .from('vendors')
      .select('id, name')
      .eq('shop_id', shopId)
      .ilike('name', pattern)
      .order('name')
      .limit(limit)

    return (data || []).map((v: any) => ({
      id: v.id,
      entity_type: 'vendor' as const,
      title: v.name || '—',
      subtitle: 'Vendor',
      url: `/parts?tab=vendors`,
      relevance: 75,
    }))
  } catch (e) {
    console.error('[search] vendors error:', e)
    return []
  }
}
