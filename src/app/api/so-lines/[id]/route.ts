import { WO_FULL_ACCESS_ROLES, SERVICE_WRITE_ROLES, MECHANIC_ROLES } from '@/lib/roles'
import { VALID_PARTS_STATUSES, VALID_LINE_STATUSES, PARTS_PICKUP_STATUS, VALID_PARTS_REQUIREMENTS } from '@/lib/parts-status'
import { DEFAULT_LABOR_RATE_FALLBACK } from '@/lib/invoice-lock'
import { NextResponse } from 'next/server'
import { getSoLineForActor, requireRouteContext } from '@/lib/api-route-auth'

import { isInvoiceHardLocked } from '@/lib/invoice-lock'
import { safeRoute } from '@/lib/api-handler'

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

async function _PATCH(req: Request, { params }: P) {
  const { id } = await params
  // Allow mechanics through for parts receipt only — full role check happens below
  const ctx = await requireRouteContext([...WO_FULL_ACCESS_ROLES, ...MECHANIC_ROLES])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const { data: line } = await getSoLineForActor(ctx.admin, ctx.actor, id, 'id, so_id, quantity, unit_price, parts_sell_price, line_type')
  if (!line) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Lock ALL lines after invoice sent/paid/closed
  const soId = (line as any).so_id || (line as any).service_order_id
  let lineShopId: string | null = null
  if (soId) {
    const { data: wo } = await ctx.admin.from('service_orders').select('invoice_status, is_historical, shop_id').eq('id', soId).single()
    if (wo?.is_historical) {
      return NextResponse.json({ error: 'Historical Fullbay records are read-only' }, { status: 403 })
    }
    if (isInvoiceHardLocked(wo?.invoice_status)) {
      return NextResponse.json({ error: 'Lines are locked — invoice has been sent to customer' }, { status: 403 })
    }
    lineShopId = (wo as any)?.shop_id || null
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Mechanic roles can only confirm parts receipt (parts_status → picked_up)
  const effectiveRole = ctx.actor.impersonate_role || ctx.actor.role
  if (MECHANIC_ROLES.includes(effectiveRole)) {
    if (Object.keys(body).length !== 1 || body.parts_status !== PARTS_PICKUP_STATUS) {
      return NextResponse.json({ error: 'Mechanics can only confirm parts pickup' }, { status: 403 })
    }
  }

  // total_price is a generated column — never write it directly. tire_position
  // was settable at line creation but not editable afterwards; Phase 2B opens
  // it for service-writer roles so generic tire jobs can be qualified before
  // estimate send. Mechanic restriction above (single-key parts_status only)
  // prevents mechanics from reaching this field.
  const allowedFields = ['description', 'part_number', 'quantity', 'unit_price', 'finding', 'resolution', 'line_status', 'status', 'assigned_to', 'estimated_hours', 'actual_hours', 'billed_hours', 'labor_rate', 'real_name', 'parts_cost_price', 'parts_sell_price', 'parts_status', 'rough_name', 'parts_requirement', 'parts_requirement_note', 'tire_position']
  // Fields that must be numeric in the DB — coerce string→number and reject NaN
  // so the update never silently writes a bad value.
  const numericFields = new Set(['quantity', 'unit_price', 'estimated_hours', 'actual_hours', 'billed_hours', 'labor_rate', 'parts_cost_price', 'parts_sell_price'])
  const update: Record<string, any> = {}
  for (const f of allowedFields) {
    if (body[f] === undefined) continue
    let val = body[f]
    if (numericFields.has(f) && val !== null) {
      const n = typeof val === 'number' ? val : Number(val)
      if (!Number.isFinite(n)) {
        return NextResponse.json({ error: `Field "${f}" must be a number` }, { status: 400 })
      }
      val = n
    }
    if (!numericFields.has(f) && val !== null && typeof val !== 'string' && typeof val !== 'boolean') {
      return NextResponse.json({ error: `Field "${f}" has invalid type` }, { status: 400 })
    }
    update[f] = val
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'No fields' }, { status: 400 })

  // Validate line_status enum
  if (update.line_status !== undefined) {
    if (!(VALID_LINE_STATUSES as readonly string[]).includes(update.line_status)) {
      return NextResponse.json({ error: `Invalid line_status "${update.line_status}"` }, { status: 400 })
    }
  }

  // Validate parts_status enum
  if (update.parts_status !== undefined) {
    if (!(VALID_PARTS_STATUSES as readonly string[]).includes(update.parts_status)) {
      return NextResponse.json({ error: `Invalid parts_status "${update.parts_status}"` }, { status: 400 })
    }
  }

  // Validate parts_requirement enum (null allowed to clear)
  if (update.parts_requirement !== undefined && update.parts_requirement !== null) {
    if (!(VALID_PARTS_REQUIREMENTS as readonly string[]).includes(update.parts_requirement)) {
      return NextResponse.json({ error: `Invalid parts_requirement "${update.parts_requirement}"` }, { status: 400 })
    }
  }

  // Bump updated_at so optimistic-concurrency precondition works on this route.
  update.updated_at = new Date().toISOString()

  // Optimistic concurrency: when client provides last-seen updated_at,
  // require match before writing. Missing value preserves legacy behavior.
  const expectedUpdatedAt = typeof body.expected_updated_at === 'string' ? body.expected_updated_at : null
  if (!expectedUpdatedAt) return NextResponse.json({ error: 'expected_updated_at is required' }, { status: 400 })
  let soLineQ = ctx.admin.from('so_lines').update(update).eq('id', id)
  if (expectedUpdatedAt) soLineQ = soLineQ.eq('updated_at', expectedUpdatedAt)
  const { data: writeResult, error } = await soLineQ.select().maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!writeResult) {
    return NextResponse.json({ error: 'Conflict', message: 'This record was updated by someone else. Refresh and try again.' }, { status: 409 })
  }
  let data: any = writeResult

  // Atomic movement-state shifts when parts_status flips on a part row.
  // Pickup drains reserved into picked_up; consume drains picked_up (then
  // reserved as fallback) into installed. Both are state-only events: they
  // bump so_lines projection columns inside one Postgres transaction without
  // touching parts.on_hand or stock_movements (those belong to reserve and
  // return_unused, which are wired by future patches once a real trigger
  // exists for them).
  if (data.line_type === 'part' && update.parts_status !== undefined && lineShopId) {
    const lineQty = Math.max(0, Math.round(Number(data.quantity ?? 1)))
    const pickedUp = Number(data.picked_up_qty ?? 0)
    const installed = Number(data.installed_qty ?? 0)
    const returnedUnused = Number(data.returned_unused_qty ?? 0)
    if (update.parts_status === PARTS_PICKUP_STATUS) {
      const pickupDelta = lineQty - pickedUp - installed - returnedUnused
      if (pickupDelta > 0) {
        const { data: rpcRow, error: rpcErr } = await ctx.admin.rpc('so_line_part_pickup_apply', {
          p_so_line_id: id,
          p_shop_id: lineShopId,
          p_qty: pickupDelta,
          p_actor_user_id: ctx.actor.id,
        })
        if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 })
        if (rpcRow) data = rpcRow
      }
    } else if (update.parts_status === 'installed') {
      const consumeDelta = lineQty - installed - returnedUnused
      if (consumeDelta > 0) {
        const { data: rpcRow, error: rpcErr } = await ctx.admin.rpc('so_line_part_consume_apply', {
          p_so_line_id: id,
          p_shop_id: lineShopId,
          p_qty: consumeDelta,
          p_actor_user_id: ctx.actor.id,
        })
        if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 })
        if (rpcRow) data = rpcRow
      }
    }
  }

  const recalcSoId = data.so_id || soId
  const grandTotal = recalcSoId ? await recalcTotals(ctx.admin, recalcSoId) : null

  // Auto-clear hours-request queue items when estimated_hours is updated
  if (update.estimated_hours !== undefined && recalcSoId) {
    try {
      const woLink = `/work-orders/${recalcSoId}`
      await ctx.admin.from('notifications')
        .update({ is_read: true })
        .in('type', ['hours_request_more', 'hours_request_needed'])
        .eq('link', woLink)
        .eq('is_read', false)
    } catch { /* cleanup failure must not break the hours update */ }
  }

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

async function _DELETE(_req: Request, { params }: P) {
  const { id } = await params
  const ctx = await requireRouteContext([...SERVICE_WRITE_ROLES])
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

export const PATCH = safeRoute(_PATCH)
export const DELETE = safeRoute(_DELETE)
