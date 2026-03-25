import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decodeVIN } from '@/lib/integrations/nhtsa'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const search = searchParams.get('search') || searchParams.get('q')
  const status = searchParams.get('status')

  const paginated = !!searchParams.get('page')
  let q = s
    .from('assets')
    .select('id, unit_number, year, make, model, vin, odometer, status, customer_id, ownership_type, is_owner_operator, unit_type, source, owner_name, driver_name, license_plate, asset_status, customers(company_name)', paginated ? { count: 'exact' } : {})
    .eq('shop_id', shopId)
    .is('deleted_at', null)
    .order('unit_number')

  const customerId = searchParams.get('customer_id')
  if (customerId) q = q.eq('customer_id', customerId)
  if (status) q = q.eq('status', status)
  const assetStatusParam = searchParams.get('asset_status')
  if (assetStatusParam && assetStatusParam !== 'all') q = q.eq('asset_status', assetStatusParam)
  if (search) q = q.or(`unit_number.ilike.%${search}%,make.ilike.%${search}%,model.ilike.%${search}%,vin.ilike.%${search}%,owner_name.ilike.%${search}%,driver_name.ilike.%${search}%`)

  const ownerType = searchParams.get('ownership_type')
  const unitType = searchParams.get('unit_type')
  if (ownerType && ownerType !== 'all') q = q.eq('ownership_type', ownerType)
  if (unitType && unitType !== 'all') q = q.eq('unit_type', unitType)

  // Pagination support
  const pageParam = searchParams.get('page')
  if (pageParam) {
    const page = Math.max(parseInt(pageParam), 1)
    const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 50)
    const offset = (page - 1) * limit
    q = q.range(offset, offset + limit - 1)
    const { data, error, count } = await (q as any)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const total = count ?? 0

    // Get counts for all ownership types (for tab badges)
    let counts: Record<string, number> = {}
    if (searchParams.get('include_counts') === 'true') {
      const countBase = s.from('assets').select('ownership_type', { count: 'exact', head: true }).eq('shop_id', shopId).is('deleted_at', null)
      const [c1, c2, c3, cAll] = await Promise.all([
        (countBase as any).eq('ownership_type', 'fleet_asset'),
        s.from('assets').select('ownership_type', { count: 'exact', head: true }).eq('shop_id', shopId).is('deleted_at', null).eq('ownership_type', 'owner_operator'),
        s.from('assets').select('ownership_type', { count: 'exact', head: true }).eq('shop_id', shopId).is('deleted_at', null).eq('ownership_type', 'outside_customer'),
        s.from('assets').select('id', { count: 'exact', head: true }).eq('shop_id', shopId).is('deleted_at', null),
      ])
      counts = { fleet_asset: c1.count || 0, owner_operator: c2.count || 0, outside_customer: c3.count || 0, all: cAll.count || 0 }
    }

    return NextResponse.json({ data: data || [], total, page, limit, totalPages: Math.ceil(total / limit), counts })
  }

  // Legacy: no pagination (for customer unit dropdowns etc.)
  const { data, error } = await q.limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const s = db()
  const body = await req.json()
  let { shop_id, unit_number, vin, year, make, model, engine, odometer, customer_id, status: assetStatus, ownership_type, unit_type } = body

  if (!shop_id) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })
  if (!unit_number) return NextResponse.json({ error: 'Unit number required' }, { status: 400 })

  // Auto-decode VIN
  if (vin && (!year || !make || !model)) {
    const decoded = await decodeVIN(vin)
    if (decoded.valid) {
      year = year || decoded.year
      make = make || decoded.make
      model = model || decoded.model
      engine = engine || decoded.engine
    }
  }

  // Check duplicate
  const { data: existing } = await s.from('assets').select('id').eq('shop_id', shop_id).eq('unit_number', unit_number.trim()).single()
  if (existing) return NextResponse.json({ error: `Unit #${unit_number} already exists` }, { status: 409 })

  const { data, error } = await s.from('assets').insert({
    shop_id,
    unit_number: unit_number.trim(),
    vin: vin?.trim().toUpperCase() || null,
    year: parseInt(year) || null,
    make: make || null,
    model: model || null,
    odometer: parseInt(odometer) || 0,
    customer_id: customer_id || null,
    status: assetStatus || 'on_road',
    ownership_type: ownership_type || 'fleet_asset',
    unit_type: unit_type || 'tractor',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
