import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'
import { log } from '@/lib/security'

export async function GET(req: Request) {
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const category  = searchParams.get('category')
  const vendor    = searchParams.get('vendor')
  const status    = searchParams.get('status')
  const lowStock  = searchParams.get('low_stock') === 'true'
  const search    = searchParams.get('q') || searchParams.get('search')
  const page      = parseInt(searchParams.get('page') || '1')
  const perPage   = parseInt(searchParams.get('per_page') || '500')

  let q = supabase
    .from('parts')
    .select(
      'id, part_number, description, uom, on_hand, allocated, in_transit, average_cost, selling_price, cost_floor, ' +
      'markup_percent, margin_percent, inventory_balance, min_qty, max_qty, default_location, preferred_vendor, ' +
      'manufacturer, part_category, item_type, status, search_tags, track_quantity, count_group, cogs_account, ' +
      'fee_discount, shop_supply_amount, website_link, upc, notes, cross_references, source, ' +
      'category, cost_price, sell_price, vendor, bin_location, reorder_point, reserved_qty, core_charge, warranty_months, ' +
      'created_at, updated_at',
      { count: 'exact' }
    )
    .eq('shop_id', user.shop_id)
    .is('deleted_at', null)
    .order('description')

  // Status filter: active / inactive
  if (status === 'active')   q = q.or('status.eq.active,status.is.null')
  if (status === 'inactive') q = q.eq('status', 'inactive')

  if (category) q = q.or(`category.eq.${category},part_category.eq.${category}`)
  if (vendor)   q = q.or(`vendor.eq.${vendor},preferred_vendor.eq.${vendor}`)
  if (search)   q = q.or(`description.ilike.%${search}%,part_number.ilike.%${search}%`)

  // Pagination
  const from = (page - 1) * perPage
  const to = from + perPage - 1
  q = q.range(from, to)

  const { data, error, count } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (lowStock) {
    const filtered = (data || []).filter((p: any) => (p.on_hand ?? 0) <= (p.reorder_point ?? 0))
    return NextResponse.json({ data: filtered, total: filtered.length, page, per_page: perPage })
  }

  return NextResponse.json({ data: data || [], total: count || 0, page, per_page: perPage })
}

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = ['owner','gm','it_person','shop_manager','parts_manager','office_admin']
  if (!allowed.includes(user.role)) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const body = await req.json()
  const { part_number, description, category, on_hand, reorder_point, cost_price, sell_price, vendor, bin_location, core_charge, warranty_months,
    uom, average_cost, selling_price, cost_floor, markup_percent, margin_percent, min_qty, max_qty, default_location, preferred_vendor,
    manufacturer, part_category, item_type, status, track_quantity, count_group, notes, cross_references } = body

  if (!description) return NextResponse.json({ error: 'Description required' }, { status: 400 })

  const { data, error } = await supabase.from('parts').insert({
    shop_id: user.shop_id,
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
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await log('parts.added', user.shop_id, user.id, { table: 'parts', recordId: data.id, newData: { description, part_number } })
  return NextResponse.json(data, { status: 201 })
}
