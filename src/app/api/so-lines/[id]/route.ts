import { DEFAULT_LABOR_RATE_FALLBACK } from '@/lib/invoice-lock'
import { NextResponse } from 'next/server'
import { getSoLineForActor, requireRouteContext } from '@/lib/api-route-auth'

import { isInvoiceHardLocked } from '@/lib/invoice-lock'

async function recalcTotals(admin: any, soId: string) {
  const { data: allLines } = await admin.from('so_lines').select('line_type, quantity, unit_price, parts_sell_price, parts_status, billed_hours, actual_hours, estimated_hours').eq('so_id', soId)
  const { data: shop } = await admin.from('service_orders').select('shop_id, shops(labor_rate, default_labor_rate, tax_rate, tax_labor)').eq('id', soId).single()
  const shopData = (shop?.shops as any) || {}
  const laborRate = shopData.labor_rate || shopData.default_labor_rate || DEFAULT_LABOR_RATE_FALLBACK
  const taxRate = parseFloat(shopData.tax_rate) || 0
  const taxLabor = !!shopData.tax_labor
  const laborTotal = (allLines || []).filter((l: any) => l.line_type === 'labor').reduce((sum: number, l: any) => {
    const hrs = l.billed_hours || l.actual_hours || l.estimated_hours || 0
    return sum + (hrs * laborRate)
  }, 0)
  const partsTotal = (allLines || []).filter((l: any) => l.line_type === 'part' && l.parts_status !== 'canceled').reduce((sum: number, l: any) => {
    const sell = l.parts_sell_price || l.unit_price || 0
    return sum + (sell * (l.quantity || 1))
  }, 0)
  const taxableAmount = partsTotal + (taxLabor ? laborTotal : 0)
  const taxAmount = taxRate > 0 ? taxableAmount * (taxRate / 100) : 0
  const grandTotal = Math.round((laborTotal + partsTotal + taxAmount) * 100) / 100
  await admin.from('service_orders').update({ labor_total: Math.round(laborTotal * 100) / 100, parts_total: Math.round(partsTotal * 100) / 100, grand_total: grandTotal }).eq('id', soId)
  return grandTotal
}

type P = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: P) {
  const { id } = await params
  const ctx = await requireRouteContext(['owner', 'gm', 'it_person', 'shop_manager', 'service_writer', 'office_admin', 'parts_manager', 'parts_clerk', 'floor_manager', 'accountant', 'accounting_manager'])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const { data: line } = await getSoLineForActor(ctx.admin, ctx.actor, id, 'id, so_id, quantity, unit_price, parts_sell_price, line_type')
  if (!line) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Lock ALL lines after invoice sent/paid/closed
  const soId = (line as any).so_id || (line as any).service_order_id
  if (soId) {
    const { data: wo } = await ctx.admin.from('service_orders').select('invoice_status, is_historical').eq('id', soId).single()
    if (wo?.is_historical) {
      return NextResponse.json({ error: 'Historical Fullbay records are read-only' }, { status: 403 })
    }
    if (isInvoiceHardLocked(wo?.invoice_status)) {
      return NextResponse.json({ error: 'Lines are locked — invoice has been sent to customer' }, { status: 403 })
    }
  }

  const body = await req.json()
  // total_price is a generated column — never write it directly
  const allowedFields = ['description', 'part_number', 'quantity', 'unit_price', 'finding', 'resolution', 'line_status', 'status', 'assigned_to', 'estimated_hours', 'actual_hours', 'billed_hours', 'labor_rate', 'real_name', 'parts_cost_price', 'parts_sell_price', 'parts_status', 'rough_name']
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

  const { data, error } = await ctx.admin.from('so_lines').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const recalcSoId = (data as any).so_id || soId
  const grandTotal = recalcSoId ? await recalcTotals(ctx.admin, recalcSoId) : null

  // Notify mechanic when part marked Ready
  if (update.parts_status === 'ready_for_job' && recalcSoId) {
    try {
      const { data: wo } = await ctx.admin.from('service_orders').select('id, so_number, shop_id, assigned_tech, asset_id, assets(unit_number)').eq('id', recalcSoId).single()
      if (wo?.assigned_tech && wo.shop_id) {
        const { createNotification } = await import('@/lib/createNotification')
        const unitNum = (wo.assets as any)?.unit_number || ''
        await createNotification({
          shopId: wo.shop_id,
          recipientId: wo.assigned_tech,
          type: 'parts_ready',
          title: 'Part Ready',
          body: `A part is ready for WO #${wo.so_number || ''}${unitNum ? ` — Unit #${unitNum}` : ''}`,
          link: `/work-orders/${recalcSoId}`,
          relatedWoId: recalcSoId,
        })
      }
    } catch {}
  }

  return NextResponse.json({ ...data, updated_grand_total: grandTotal })
}

export async function DELETE(_req: Request, { params }: P) {
  const { id } = await params
  const ctx = await requireRouteContext(['owner', 'gm', 'it_person', 'shop_manager', 'service_writer', 'office_admin'])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const { data: line } = await getSoLineForActor(ctx.admin, ctx.actor, id, 'id, so_id, line_type')
  if (!line) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Lock ALL lines after invoice sent/paid/closed
  const soIdDel = (line as any).so_id || (line as any).service_order_id
  if (soIdDel) {
    const { data: wo } = await ctx.admin.from('service_orders').select('invoice_status, is_historical').eq('id', soIdDel).single()
    if (wo?.is_historical) {
      return NextResponse.json({ error: 'Historical Fullbay records are read-only' }, { status: 403 })
    }
    if (isInvoiceHardLocked(wo?.invoice_status)) {
      return NextResponse.json({ error: 'Lines are locked — invoice has been sent to customer' }, { status: 403 })
    }
  }

  await ctx.admin.from('so_lines').delete().eq('id', id)
  if (soIdDel) await recalcTotals(ctx.admin, soIdDel)
  return NextResponse.json({ success: true })
}
