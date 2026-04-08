import { DEFAULT_LABOR_RATE_FALLBACK } from '@/lib/invoice-lock'
/**
 * TruckZen — Original Design
 * Estimates API — create from WO, list, send, approve/decline
 */
import { NextResponse } from 'next/server'
import { requireRouteContext, getWorkOrderForActor } from '@/lib/api-route-auth'

export async function GET(req: Request) {
  const ctx = await requireRouteContext()
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const woId = searchParams.get('wo_id')

  let q = ctx.admin.from('estimates').select('*, estimate_lines(*)').is('deleted_at', null).order('created_at', { ascending: false })
  if (!ctx.actor.is_platform_owner && ctx.shopId) q = q.eq('shop_id', ctx.shopId)
  if (status && status !== 'all') q = q.eq('status', status)
  if (woId) q = q.or(`wo_id.eq.${woId},repair_order_id.eq.${woId}`)
  const { data, error } = await q.limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const ctx = await requireRouteContext(['owner', 'gm', 'it_person', 'shop_manager', 'service_writer', 'office_admin', 'accountant', 'accounting_manager'])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const { action, ...body } = await req.json().catch(() => ({}))

  if (action === 'create_from_wo') {
    const woId = body.wo_id
    if (!woId) return NextResponse.json({ error: 'wo_id required' }, { status: 400 })
    const { data: wo } = await getWorkOrderForActor(ctx.admin, ctx.actor, woId, '*, customers(id, company_name, contact_name, email, phone), assets(id, unit_number, year, make, model), shop_id')
    if (!wo) return NextResponse.json({ error: 'WO not found' }, { status: 404 })

    const shopId = (wo as any).shop_id
    const { data: shop } = await ctx.admin.from('shops').select('default_labor_rate, labor_rate, tax_rate, default_tax_rate').eq('id', shopId).single()
    const laborRate = shop?.default_labor_rate || shop?.labor_rate || DEFAULT_LABOR_RATE_FALLBACK
    const taxRate = shop?.tax_rate || shop?.default_tax_rate || 0

    const { data: lines } = await ctx.admin.from('so_lines').select('*').eq('so_id', woId)
    const { data: woParts } = await ctx.admin.from('wo_parts').select('*').eq('wo_id', woId)
    const { count } = await ctx.admin.from('estimates').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).is('deleted_at', null)
    const estNum = `EST-${String((count || 0) + 1).padStart(5, '0')}`
    const cust = (wo as any).customers as any
    const asset = (wo as any).assets as any

    const { data: est, error } = await ctx.admin.from('estimates').insert({
      shop_id: shopId, wo_id: woId, repair_order_id: woId, estimate_number: estNum,
      customer_id: cust?.id || (wo as any).customer_id, asset_id: asset?.id || (wo as any).asset_id,
      customer_name: cust?.company_name || cust?.contact_name || null, customer_email: cust?.email || null, customer_phone: cust?.phone || null,
      status: 'draft', tax_rate: taxRate, valid_until: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      created_by: ctx.actor.id,
    }).select().single()

    if (error || !est) return NextResponse.json({ error: error?.message || 'Failed' }, { status: 500 })

    const estLines: any[] = []
    for (const line of lines || []) {
      if (line.line_type === 'labor') {
        const hrs = line.estimated_hours || line.billed_hours || line.actual_hours || 1
        estLines.push({ estimate_id: est.id, line_type: 'labor', description: line.description, quantity: hrs, unit_price: laborRate, total: hrs * laborRate, so_line_id: line.id })
      } else if (line.line_type === 'part' && (line.real_name || line.rough_name || line.description)) {
        const price = line.parts_sell_price || line.unit_price || 0
        estLines.push({ estimate_id: est.id, line_type: 'part', description: line.real_name || line.rough_name || line.description, part_number: line.part_number, quantity: line.quantity || 1, unit_price: price, total: (line.quantity || 1) * price, so_line_id: line.id })
      }
    }
    for (const part of woParts || []) {
      estLines.push({ estimate_id: est.id, line_type: 'part', description: part.description, part_number: part.part_number || null, quantity: part.quantity || 1, unit_price: part.unit_cost || 0, total: (part.quantity || 1) * (part.unit_cost || 0), so_line_id: part.line_id || null })
    }
    if (estLines.length > 0) await ctx.admin.from('estimate_lines').insert(estLines)

    const laborTotal = estLines.filter((l) => l.line_type === 'labor').reduce((sum, l) => sum + l.total, 0)
    const partsTotal = estLines.filter((l) => l.line_type === 'part').reduce((sum, l) => sum + l.total, 0)
    const sub = laborTotal + partsTotal
    const taxAmt = sub * (taxRate / 100)
    const grandTotal = sub + taxAmt

    await ctx.admin.from('estimates').update({ labor_total: laborTotal, parts_total: partsTotal, subtotal: sub, tax_amount: taxAmt, grand_total: grandTotal, total: grandTotal }).eq('id', est.id)
    await ctx.admin.from('service_orders').update({ estimate_id: est.id }).eq('id', woId)

    return NextResponse.json({ ...est, labor_total: laborTotal, parts_total: partsTotal, grand_total: grandTotal })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
