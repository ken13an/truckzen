import { NextResponse } from 'next/server'
import { getSoLineForActor, requireRouteContext } from '@/lib/api-route-auth'

import { isInvoiceHardLocked } from '@/lib/invoice-lock'

async function recalcTotals(admin: any, soId: string) {
  const { data: allLines } = await admin.from('so_lines').select('line_type, quantity, total_price, unit_price, parts_sell_price').eq('so_id', soId)
  const calcLineTotal = (l: any) => l.total_price ?? ((l.line_type === 'part' ? (l.parts_sell_price || l.unit_price || 0) : (l.unit_price || 0)) * (l.quantity || 1))
  const laborTotal = (allLines || []).filter((l: any) => l.line_type === 'labor').reduce((sum: number, l: any) => sum + calcLineTotal(l), 0)
  const partsTotal = (allLines || []).filter((l: any) => l.line_type === 'part').reduce((sum: number, l: any) => sum + calcLineTotal(l), 0)
  const grandTotal = laborTotal + partsTotal
  await admin.from('service_orders').update({ labor_total: laborTotal, parts_total: partsTotal, grand_total: grandTotal }).eq('id', soId)
  return grandTotal
}

type P = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: P) {
  const { id } = await params
  const ctx = await requireRouteContext(['owner', 'gm', 'it_person', 'shop_manager', 'service_writer', 'office_admin', 'parts_manager', 'parts_clerk', 'floor_manager', 'accountant', 'accounting_manager'])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const { data: line } = await getSoLineForActor(ctx.admin, ctx.actor, id, 'id, so_id, quantity, unit_price, parts_sell_price, line_type')
  if (!line) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Lock part-type lines after invoice submitted to accounting
  if ((line as any).line_type === 'part') {
    const soId = (line as any).so_id || (line as any).service_order_id
    if (soId) {
      const { data: wo } = await ctx.admin.from('service_orders').select('invoice_status').eq('id', soId).single()
      if (isInvoiceHardLocked(wo?.invoice_status)) {
        return NextResponse.json({ error: 'Part lines are locked — invoice has been submitted to accounting' }, { status: 403 })
      }
    }
  }

  const body = await req.json()
  const allowedFields = ['description', 'part_number', 'quantity', 'unit_price', 'total_price', 'finding', 'resolution', 'line_status', 'status', 'assigned_to', 'estimated_hours', 'actual_hours', 'billed_hours', 'labor_rate', 'real_name', 'parts_cost_price', 'parts_sell_price', 'parts_status', 'rough_name']
  const update: Record<string, any> = {}
  for (const f of allowedFields) if (body[f] !== undefined) update[f] = body[f]
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'No fields' }, { status: 400 })

  // Validate line_status enum
  if (update.line_status !== undefined) {
    const VALID_LINE_STATUSES = ['unassigned', 'pending_review', 'approved', 'in_progress', 'completed']
    if (!VALID_LINE_STATUSES.includes(update.line_status)) {
      return NextResponse.json({ error: `Invalid line_status "${update.line_status}"` }, { status: 400 })
    }
  }

  // Validate parts_status enum
  if (update.parts_status !== undefined) {
    const VALID_PARTS_STATUSES = ['rough', 'sourced', 'ordered', 'received', 'ready_for_job', 'installed', 'canceled']
    if (!VALID_PARTS_STATUSES.includes(update.parts_status)) {
      return NextResponse.json({ error: `Invalid parts_status "${update.parts_status}"` }, { status: 400 })
    }
  }

  const quantity = update.quantity ?? (line as any).quantity ?? 1
  const unitPrice = update.unit_price ?? (line as any).unit_price ?? 0
  const sellPrice = update.parts_sell_price ?? (line as any).parts_sell_price ?? unitPrice
  if (update.quantity !== undefined || update.unit_price !== undefined || update.parts_sell_price !== undefined || update.total_price !== undefined) {
    update.total_price = (update.total_price !== undefined ? Number(update.total_price) : Number((line as any).line_type === 'part' ? sellPrice : unitPrice) * Number(quantity || 1))
  }

  const { data, error } = await ctx.admin.from('so_lines').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const soId = (data as any).so_id || (data as any).service_order_id
  const grandTotal = soId ? await recalcTotals(ctx.admin, soId) : null
  return NextResponse.json({ ...data, updated_grand_total: grandTotal })
}

export async function DELETE(_req: Request, { params }: P) {
  const { id } = await params
  const ctx = await requireRouteContext(['owner', 'gm', 'it_person', 'shop_manager', 'service_writer', 'office_admin'])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const { data: line } = await getSoLineForActor(ctx.admin, ctx.actor, id, 'id, so_id, line_type')
  if (!line) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Lock part-type lines after invoice submitted to accounting
  if ((line as any).line_type === 'part') {
    const soId = (line as any).so_id || (line as any).service_order_id
    if (soId) {
      const { data: wo } = await ctx.admin.from('service_orders').select('invoice_status').eq('id', soId).single()
      if (isInvoiceHardLocked(wo?.invoice_status)) {
        return NextResponse.json({ error: 'Part lines are locked — invoice has been submitted to accounting' }, { status: 403 })
      }
    }
  }

  await ctx.admin.from('so_lines').delete().eq('id', id)
  const soId = (line as any).so_id || (line as any).service_order_id
  if (soId) await recalcTotals(ctx.admin, soId)
  return NextResponse.json({ success: true })
}
