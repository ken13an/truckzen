import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'
import { checkRateLimit, log } from '@/lib/security'

export async function GET(req: Request) {
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const lowStock = searchParams.get('low_stock') === 'true'
  const search   = searchParams.get('q')

  let q = supabase
    .from('parts')
    .select('id, part_number, description, category, on_hand, reserved_qty, reorder_point, cost_price, sell_price, vendor, bin_location, core_charge, warranty_months, created_at')
    .eq('shop_id', user.shop_id)
    .order('description')

  if (category)  q = q.eq('category', category)
  if (lowStock)  q = q.lte('on_hand', supabase.rpc as any)
  if (search)    q = q.or(`description.ilike.%${search}%,part_number.ilike.%${search}%`)

  const { data, error } = await q.limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = ['owner','gm','it_person','shop_manager','parts_manager','office_admin']
  if (!allowed.includes(user.role)) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const body = await req.json()
  const { part_number, description, category, on_hand, reorder_point, cost_price, sell_price, vendor, bin_location, core_charge, warranty_months } = body

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
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await log('parts.added', user.shop_id, user.id, { table: 'parts', recordId: data.id, newData: { description, part_number } })
  return NextResponse.json(data, { status: 201 })
}
