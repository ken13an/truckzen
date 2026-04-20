import { DEFAULT_LABOR_RATE_FALLBACK } from '@/lib/invoice-lock'
import { INVOICE_ACTION_ROLES } from '@/lib/roles'
/**
 * TruckZen — Original Design
 * Estimates API — create from WO, list, send, approve/decline
 */
import { NextResponse } from 'next/server'
import { requireRouteContext, getWorkOrderForActor } from '@/lib/api-route-auth'
import { safeRoute } from '@/lib/api-handler'
import { parsePageParams } from '@/lib/query-limits'

async function _GET(req: Request) {
  const ctx = await requireRouteContext()
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const woId = searchParams.get('wo_id')
  const { page, limit, offset } = parsePageParams(searchParams)

  let q = ctx.admin.from('estimates').select('*, estimate_lines(*)', { count: 'exact' }).is('deleted_at', null).order('created_at', { ascending: false })
  if (!ctx.actor.is_platform_owner && ctx.shopId) q = q.eq('shop_id', ctx.shopId)
  if (status && status !== 'all') q = q.eq('status', status)
  if (woId) q = q.or(`wo_id.eq.${woId},repair_order_id.eq.${woId}`)
  const { data, count, error } = await q.range(offset, offset + limit - 1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data || [], total: count || 0, page, limit, total_pages: Math.ceil((count || 0) / limit) })
}

async function _POST(req: Request) {
  const ctx = await requireRouteContext([...INVOICE_ACTION_ROLES])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const { action, ...body } = await req.json().catch(() => ({}))

  if (action === 'create_from_wo') {
    const woId = body.wo_id
    if (!woId) return NextResponse.json({ error: 'wo_id required' }, { status: 400 })
    const { data: wo } = await getWorkOrderForActor(ctx.admin, ctx.actor, woId, '*, customers(id, company_name, contact_name, email, phone), assets(id, unit_number, year, make, model), shop_id')
    if (!wo) return NextResponse.json({ error: 'WO not found' }, { status: 404 })

    const shopId = (wo as any).shop_id

    // Soft idempotency: reuse an existing open estimate (draft/sent) for this WO.
    // Terminal statuses (approved, declined) are not reused — the UI surfaces a
    // "Resend Modified Estimate" path for declined, which intentionally creates a fresh row.
    const { data: existing, error: existingErr } = await ctx.admin
      .from('estimates')
      .select('*')
      .eq('wo_id', woId)
      .eq('shop_id', shopId)
      .is('deleted_at', null)
      .in('status', ['draft', 'sent'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (existingErr) {
      console.error('[estimates.create_from_wo] existing-estimate lookup failed', { woId, shopId, error: existingErr.message })
      return NextResponse.json({ error: existingErr.message }, { status: 500 })
    }
    if (existing) {
      // Minimal FK repair: only when service_orders.estimate_id is missing (null).
      // If it points to a different row (e.g. a prior terminal estimate), leave it —
      // that decision belongs to a separate workflow patch.
      if (!(wo as any).estimate_id) {
        const { error: fkErr } = await ctx.admin.from('service_orders').update({ estimate_id: existing.id }).eq('id', woId)
        if (fkErr) console.error('[estimates.create_from_wo] FK repair failed', { woId, estimateId: existing.id, error: fkErr.message })
      }
      return NextResponse.json(existing)
    }

    const { data: shop } = await ctx.admin.from('shops').select('default_labor_rate, labor_rate, tax_rate, default_tax_rate').eq('id', shopId).single()
    const laborRate = shop?.default_labor_rate || shop?.labor_rate || DEFAULT_LABOR_RATE_FALLBACK
    const taxRate = shop?.tax_rate || shop?.default_tax_rate || 0

    const { data: lines } = await ctx.admin.from('so_lines').select('*').eq('so_id', woId)
    const { data: woParts } = await ctx.admin.from('wo_parts').select('*').eq('wo_id', woId)

    // Phase 4 supplement filter: the original estimate snapshot excludes is_additional rows.
    const nonAdditionalLines = (lines || []).filter((l: any) => !l.is_additional)
    const nonAdditionalWoParts = (woParts || []).filter((p: any) => !p.is_additional)

    // Build snapshot payload BEFORE creating the estimate row, so we can reject
    // an empty snapshot up-front without leaving a zombie estimate behind.
    // Live estimate_lines columns (verified against DB, not inferred from stale types):
    //   id, estimate_id, repair_order_line_id, description, line_number,
    //   labor_hours, labor_rate, labor_total, parts_total, line_total,
    //   is_approved, customer_response, created_at.
    // There is NO line_type / quantity / unit_price / part_number / total / so_line_id
    // column — prior inserts writing those fields silently failed because of PostgREST schema cache,
    // which is why every historical estimate has zero estimate_lines.
    const snapshot: Array<Record<string, any>> = []
    let lineNum = 1
    for (const line of nonAdditionalLines) {
      if (line.line_type === 'labor') {
        const hrs = Number(line.estimated_hours || line.billed_hours || line.actual_hours || 1)
        const laborTotal = hrs * laborRate
        snapshot.push({
          repair_order_line_id: line.id,
          description: line.description || '',
          labor_hours: hrs,
          labor_rate: laborRate,
          labor_total: laborTotal,
          parts_total: 0,
          line_total: laborTotal,
          line_number: lineNum++,
        })
      } else if (line.line_type === 'part' && (line.real_name || line.rough_name || line.description)) {
        const price = Number(line.parts_sell_price || line.unit_price || 0)
        const qty = Number(line.quantity || 1)
        const partsTotal = price * qty
        snapshot.push({
          repair_order_line_id: line.id,
          description: line.real_name || line.rough_name || line.description || '',
          labor_hours: 0,
          labor_rate: 0,
          labor_total: 0,
          parts_total: partsTotal,
          line_total: partsTotal,
          line_number: lineNum++,
        })
      }
    }
    for (const part of nonAdditionalWoParts) {
      const price = Number(part.unit_cost || 0)
      const qty = Number(part.quantity || 1)
      const partsTotal = price * qty
      snapshot.push({
        repair_order_line_id: part.line_id || null,
        description: part.description || '',
        labor_hours: 0,
        labor_rate: 0,
        labor_total: 0,
        parts_total: partsTotal,
        line_total: partsTotal,
        line_number: lineNum++,
      })
    }

    if (snapshot.length === 0) {
      return NextResponse.json({ error: 'No estimate lines available for this work order' }, { status: 400 })
    }

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

    if (error || !est) {
      console.error('[estimates.create_from_wo] insert failed', { woId, shopId, error: error?.message })
      return NextResponse.json({ error: error?.message || 'Failed' }, { status: 500 })
    }

    const rowsToInsert = snapshot.map(r => ({ ...r, estimate_id: est.id }))
    const { error: linesErr } = await ctx.admin.from('estimate_lines').insert(rowsToInsert)
    if (linesErr) {
      console.error('[estimates.create_from_wo] estimate_lines insert failed', { woId, shopId, estimateId: est.id, error: linesErr.message })
      // Clean up the zombie estimate so service_orders.estimate_id never points at an empty snapshot.
      await ctx.admin.from('estimates').delete().eq('id', est.id)
      return NextResponse.json({ error: 'Failed to snapshot estimate lines: ' + linesErr.message }, { status: 500 })
    }

    const laborTotal = snapshot.reduce((sum, r) => sum + (Number(r.labor_total) || 0), 0)
    const partsTotal = snapshot.reduce((sum, r) => sum + (Number(r.parts_total) || 0), 0)
    const sub = laborTotal + partsTotal
    const taxAmt = sub * (taxRate / 100)
    const grandTotal = sub + taxAmt

    // Chain .select().single() so the response carries the post-update
    // updated_at. The BEFORE UPDATE trigger set_updated_at bumps the column,
    // so the insert-time row the UI would otherwise cache is stale by the time
    // the client sends its next PATCH with expected_updated_at.
    const { data: updatedEst, error: totalsErr } = await ctx.admin.from('estimates').update({ labor_total: laborTotal, parts_total: partsTotal, subtotal: sub, tax_amount: taxAmt, grand_total: grandTotal, total: grandTotal }).eq('id', est.id).select().single()
    if (totalsErr || !updatedEst) {
      console.error('[estimates.create_from_wo] totals update failed', { woId, estimateId: est.id, error: totalsErr?.message })
      await ctx.admin.from('estimate_lines').delete().eq('estimate_id', est.id)
      await ctx.admin.from('estimates').delete().eq('id', est.id)
      return NextResponse.json({ error: 'Failed to finalize estimate totals: ' + (totalsErr?.message || 'unknown') }, { status: 500 })
    }

    // Only point the WO at the new estimate after snapshot + totals are known-good.
    await ctx.admin.from('service_orders').update({ estimate_id: est.id }).eq('id', woId)

    return NextResponse.json({ ...updatedEst, labor_total: laborTotal, parts_total: partsTotal, grand_total: grandTotal })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

export const GET = safeRoute(_GET)
export const POST = safeRoute(_POST)
