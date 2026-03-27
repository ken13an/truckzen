import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'
import { log } from '@/lib/security'
import { checkRateLimit } from '@/lib/rateLimit'
import { getCache, setCache, invalidateCache } from '@/lib/cache'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

const COST_VISIBLE_ROLES = ['owner', 'gm', 'it_person', 'accountant', 'office_admin', 'parts_manager', 'accounting_manager']

function stripCostFields(parts: any[]): any[] {
  return parts.map(p => ({ ...p, cost_price: null, sell_price: null, average_cost: null, cost_floor: null, markup_percent: null, margin_percent: null, inventory_balance: null }))
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const category  = searchParams.get('category')
  const vendor    = searchParams.get('vendor')
  const status    = searchParams.get('status')
  const lowStock  = searchParams.get('low_stock') === 'true'
  const search    = searchParams.get('q') || searchParams.get('search')
  const page      = parseInt(searchParams.get('page') || '1')
  const perPage   = Math.min(parseInt(searchParams.get('per_page') || '50'), 50)

  // Authenticate and derive shop_id from session (supports impersonation)
  const user = await getAuthenticatedUserProfile()
  if (!user) return jsonError('Unauthorized', 401)

  const shopId = getActorShopId(user)
  const userRole = user.role

  if (!checkRateLimit(`${user.id}:parts`, 200, 60000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  if (!shopId) {
    return NextResponse.json({ data: [], total: 0, page, per_page: perPage })
  }

  const cacheKey = `parts:${shopId}:${page}:${perPage}:${search || ''}:${status || ''}:${category || ''}:${vendor || ''}:${lowStock}`
  const cached = getCache<any>(cacheKey)
  if (cached) return NextResponse.json(cached)

  const s = db()
  let q = s
    .from('parts')
    .select(
      'id, part_number, description, uom, on_hand, allocated, in_transit, average_cost, selling_price, cost_floor, ' +
      'markup_percent, margin_percent, inventory_balance, min_qty, max_qty, default_location, preferred_vendor, ' +
      'manufacturer, part_category, item_type, status, search_tags, track_quantity, count_group, cogs_account, ' +
      'fee_discount, shop_supply_amount, website_link, upc, notes, cross_references, source, ' +
      'category, cost_price, sell_price, vendor, bin_location, reorder_point, reserved, core_charge, warranty_months, ' +
      'created_at, updated_at',
      { count: 'exact' }
    )
    .eq('shop_id', shopId)
    .is('deleted_at', null)
    .order('on_hand', { ascending: false })
    .order('description')

  // Status filter: active / inactive / all
  if (status === 'active')   q = q.not('status', 'eq', 'inactive')
  if (status === 'inactive') q = q.eq('status', 'inactive')

  if (category) q = q.or(`category.eq.${category},part_category.eq.${category}`)
  if (vendor)   q = q.or(`vendor.eq.${vendor},preferred_vendor.eq.${vendor}`)
  if (search)   q = q.or(`description.ilike.%${search}%,part_number.ilike.%${search}%`)

  // Low stock filter: fetch all matching, filter, then paginate manually
  if (lowStock) {
    const { data: allData, error: allErr } = await q.limit(2000)
    if (allErr) return NextResponse.json({ error: allErr.message }, { status: 500 })
    const filtered = (allData || []).filter((p: any) => (p.on_hand ?? 0) <= (p.reorder_point ?? 0))
    const totalFiltered = filtered.length
    const from = (page - 1) * perPage
    const paged = filtered.slice(from, from + perPage)
    const hideCost = userRole && !COST_VISIBLE_ROLES.includes(userRole)
    const lowStockResult = { data: hideCost ? stripCostFields(paged) : paged, total: totalFiltered, page, per_page: perPage }
    setCache(cacheKey, lowStockResult, 60)
    return NextResponse.json(lowStockResult)
  }

  // Normal pagination
  const from = (page - 1) * perPage
  const to = from + perPage - 1
  q = q.range(from, to)

  const { data, error, count } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const hideCost = userRole && !COST_VISIBLE_ROLES.includes(userRole)
  const result = { data: hideCost ? stripCostFields(data || []) : (data || []), total: count || 0, page, per_page: perPage }
  setCache(cacheKey, result, 60) // 60s TTL
  return NextResponse.json(result)
}

export async function POST(req: Request) {
  const user = await getAuthenticatedUserProfile()
  if (!user) return jsonError('Unauthorized', 401)

  const allowed = ['owner','gm','it_person','shop_manager','parts_manager','office_admin']
  if (!user.is_platform_owner && !allowed.includes(user.role)) return jsonError('Access denied', 403)

  const body = await req.json()
  const { part_number, description, category, on_hand, reorder_point, cost_price, sell_price, vendor, bin_location, core_charge, warranty_months,
    uom, average_cost, selling_price, cost_floor, markup_percent, margin_percent, min_qty, max_qty, default_location, preferred_vendor,
    manufacturer, part_category, item_type, status, track_quantity, count_group, notes, cross_references,
    price_ugl_company, price_ugl_owner_operator, price_outside } = body

  if (!description) return NextResponse.json({ error: 'Description required' }, { status: 400 })

  const shopId = getActorShopId(user)
  if (!shopId) return jsonError('No shop context', 400)

  const { data, error } = await db().from('parts').insert({
    shop_id: shopId,
    part_number:     part_number?.trim() || null,
    description:     description.trim(),
    category:        category || 'Other',
    on_hand:         parseInt(on_hand) || 0,
    reserved_qty:    0,
    reorder_point:   parseInt(reorder_point) || 2,
    cost_price:      parseFloat(cost_price) || 0,
    sell_price:      parseFloat(sell_price) || 0,
    vendor:          vendor || null,
    bin_location:    bin_location || null,
    core_charge:     parseFloat(core_charge) || 0,
    warranty_months: parseInt(warranty_months) || 0,
    uom:             uom || null,
    average_cost:    average_cost != null ? parseFloat(average_cost) : null,
    selling_price:   selling_price != null ? parseFloat(selling_price) : null,
    cost_floor:      cost_floor != null ? parseFloat(cost_floor) : null,
    markup_percent:  markup_percent != null ? parseFloat(markup_percent) : null,
    margin_percent:  margin_percent != null ? parseFloat(margin_percent) : null,
    min_qty:         min_qty != null ? parseFloat(min_qty) : null,
    max_qty:         max_qty != null ? parseFloat(max_qty) : null,
    default_location: default_location || null,
    preferred_vendor: preferred_vendor || null,
    manufacturer:    manufacturer || null,
    part_category:   part_category || null,
    item_type:       item_type || null,
    status:          status || 'active',
    track_quantity:  track_quantity ?? true,
    count_group:     count_group || null,
    notes:           notes || null,
    cross_references: cross_references || null,
    price_ugl_company:        price_ugl_company != null ? parseFloat(price_ugl_company) : null,
    price_ugl_owner_operator: price_ugl_owner_operator != null ? parseFloat(price_ugl_owner_operator) : null,
    price_outside:            price_outside != null ? parseFloat(price_outside) : (sell_price ? parseFloat(sell_price) : null),
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  invalidateCache(`parts:${shopId}`)
  await log('parts.added', shopId, user.id, { table: 'parts', recordId: data.id, newData: { description, part_number } })
  return NextResponse.json(data, { status: 201 })
}
