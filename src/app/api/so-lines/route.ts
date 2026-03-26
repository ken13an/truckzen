import { NextResponse } from 'next/server'
import { requireRouteContext } from '@/lib/api-route-auth'

async function recalcTotals(admin: any, soId: string) {
  const { data: lines } = await admin.from('so_lines').select('line_type, quantity, total_price, unit_price, parts_sell_price').eq('so_id', soId)
  const calcLineTotal = (l: any) => l.total_price ?? ((l.line_type === 'part' ? (l.parts_sell_price || l.unit_price || 0) : (l.unit_price || 0)) * (l.quantity || 1))
  const laborTotal = (lines || []).filter((l: any) => l.line_type === 'labor').reduce((sum: number, l: any) => sum + calcLineTotal(l), 0)
  const partsTotal = (lines || []).filter((l: any) => l.line_type === 'part').reduce((sum: number, l: any) => sum + calcLineTotal(l), 0)
  const grandTotal = laborTotal + partsTotal
  await admin.from('service_orders').update({ labor_total: laborTotal, parts_total: partsTotal, grand_total: grandTotal }).eq('id', soId)
}

export async function GET(req: Request) {
  const ctx = await requireRouteContext()
  if (ctx.error || !ctx.shopId || !ctx.admin) return ctx.error!
  const { searchParams } = new URL(req.url)
  const soId = searchParams.get('so_id')

  if (soId) {
    const { data: so } = await ctx.admin.from('service_orders').select('id, shop_id').eq('id', soId).single()
    if (!so || so.shop_id !== ctx.shopId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const { data, error } = await ctx.admin.from('so_lines').select('*').eq('so_id', soId).order('sort_order').order('created_at')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const partsStatus = searchParams.get('parts_status')
  const lineType = searchParams.get('line_type')
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500)
  const updatedSince = searchParams.get('updated_since')

  let q = ctx.admin
    .from('so_lines')
    .select('id, description, rough_name, real_name, parts_status, quantity, created_at, updated_at, line_type, service_orders!inner(id, so_number, shop_id, assets(unit_number), users!assigned_tech(full_name))')
    .eq('service_orders.shop_id', ctx.shopId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (lineType) q = q.eq('line_type', lineType)
  if (partsStatus) q = q.in('parts_status', partsStatus.split(','))
  if (updatedSince) q = (q as any).gte('updated_at', updatedSince)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const ctx = await requireRouteContext(['owner', 'gm', 'it_person', 'shop_manager', 'service_writer', 'office_admin', 'parts_manager', 'parts_clerk', 'floor_manager'])
  if (ctx.error || !ctx.shopId || !ctx.admin) return ctx.error!
  const body = await req.json()
  const { so_id, line_type, description, part_number, quantity, unit_price, estimated_hours, line_status, rough_name, parts_status } = body

  if (!so_id || !line_type || !description) {
    return NextResponse.json({ error: 'so_id, line_type, description required' }, { status: 400 })
  }

  const { data: so } = await ctx.admin.from('service_orders').select('id, shop_id').eq('id', so_id).single()
  if (!so || so.shop_id !== ctx.shopId) return NextResponse.json({ error: 'Work order not found' }, { status: 404 })

  const qty = parseFloat(quantity) || 1
  const price = parseFloat(unit_price) || 0
  const totalPrice = price * qty

  const { data, error } = await ctx.admin.from('so_lines').insert({
    so_id,
    line_type,
    description: description.trim(),
    part_number: part_number?.trim() || null,
    quantity: qty,
    unit_price: price,
    total_price: totalPrice,
    estimated_hours: estimated_hours ?? null,
    line_status: line_status || null,
    rough_name: rough_name?.trim() || null,
    parts_status: parts_status || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await recalcTotals(ctx.admin, so_id)
  return NextResponse.json(data, { status: 201 })
}
