import { NextResponse } from 'next/server'
import { requireRouteContext } from '@/lib/api-route-auth'

async function getEstimateForActor(admin: any, actor: any, id: string) {
  let q = admin.from('estimates').select('*').eq('id', id)
  if (!actor.is_platform_owner && actor.effective_shop_id) q = q.eq('shop_id', actor.effective_shop_id)
  const { data, error } = await q.single()
  return { data, error }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireRouteContext()
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const { data: estimate, error } = await getEstimateForActor(ctx.admin, ctx.actor, id)
  if (error || !estimate) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })
  const { data: lines } = await ctx.admin.from('estimate_lines').select('*').eq('estimate_id', id).order('line_number')
  let serviceOrder = null
  const repairOrderId = (estimate as any).repair_order_id || (estimate as any).wo_id
  if (repairOrderId) {
    const { data: so } = await ctx.admin.from('service_orders').select('id, so_number, status, complaint, assets(unit_number, year, make, model, vin)').eq('id', repairOrderId).single()
    serviceOrder = so
  }
  const { data: shop } = await ctx.admin.from('shops').select('name, dba, phone, email, tax_rate').eq('id', (estimate as any).shop_id).single()
  return NextResponse.json({ ...estimate, lines: lines || [], service_order: serviceOrder, shop })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireRouteContext(['owner', 'gm', 'it_person', 'shop_manager', 'service_writer', 'office_admin', 'accountant', 'accounting_manager'])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const { data: estimate } = await getEstimateForActor(ctx.admin, ctx.actor, id)
  if (!estimate) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })
  const body = await req.json().catch(() => null)
  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  for (const key of ['status', 'notes', 'customer_name', 'customer_email', 'customer_phone', 'approval_method', 'approved_at', 'customer_notes', 'decline_reason']) if (body?.[key] !== undefined) updates[key] = body[key]
  if (body?.status === 'sent') {
    updates.sent_at = new Date().toISOString()
    updates.valid_until = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
  }
  if (body?.status === 'approved') updates.approved_by = ctx.actor.id

  const { data, error } = await ctx.admin.from('estimates').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (body?.lines && Array.isArray(body.lines)) {
    await ctx.admin.from('estimate_lines').delete().eq('estimate_id', id)
    const laborTotal = body.lines.reduce((s: number, l: any) => s + (parseFloat(l.labor_total ?? l.total) || 0) * ((l.line_type === 'labor') ? 1 : 0), 0)
    const partsTotal = body.lines.reduce((s: number, l: any) => s + (parseFloat(l.parts_total ?? l.total) || 0) * ((l.line_type === 'part') ? 1 : 0), 0)
    const subtotal = laborTotal + partsTotal
    const { data: shop } = await ctx.admin.from('shops').select('tax_rate').eq('id', (estimate as any).shop_id).single()
    const taxRate = shop?.tax_rate || 0
    const taxAmount = subtotal * (taxRate / 100)
    const total = subtotal + taxAmount
    await ctx.admin.from('estimates').update({ labor_total: laborTotal, parts_total: partsTotal, subtotal, tax_amount: taxAmount, total, grand_total: total }).eq('id', id)
    const lineRows = body.lines.map((l: any, i: number) => ({ estimate_id: id, repair_order_line_id: l.repair_order_line_id || null, description: l.description || '', complaint: l.complaint || null, labor_hours: parseFloat(l.labor_hours) || 0, labor_rate: parseFloat(l.labor_rate) || 0, labor_total: parseFloat(l.labor_total) || 0, parts_total: parseFloat(l.parts_total) || 0, line_total: parseFloat(l.line_total) || 0, is_approved: l.is_approved ?? null, customer_response: l.customer_response || null, line_number: i + 1, line_type: l.line_type || 'labor', total: parseFloat(l.total ?? l.line_total) || 0, quantity: parseFloat(l.quantity) || 1, unit_price: parseFloat(l.unit_price) || 0, so_line_id: l.so_line_id || null, part_number: l.part_number || null }))
    await ctx.admin.from('estimate_lines').insert(lineRows)
  }
  return NextResponse.json(data)
}
