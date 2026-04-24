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

    // Shop config — tax_labor included so the tax math respects the same
    // shop setting the WO Estimate tab displays (calcInvoiceTotals:49-50).
    const { data: shop } = await ctx.admin.from('shops').select('default_labor_rate, labor_rate, tax_rate, default_tax_rate, tax_labor').eq('id', shopId).single()
    const taxRate = shop?.tax_rate || shop?.default_tax_rate || 0
    const taxLabor = shop?.tax_labor === true

    // Ownership-typed labor rate priority — mirrors page.tsx:826-828 and
    // src/lib/estimates/snapshotEnsure.ts so the snapshot here matches what
    // the writer sees on the WO Estimate tab.
    const ownershipType = (wo as any)?.ownership_type
      || (wo as any)?.assets?.ownership_type
      || 'outside_customer'
    const { data: ownershipRate } = await ctx.admin
      .from('shop_labor_rates')
      .select('rate_per_hour')
      .eq('shop_id', shopId)
      .eq('ownership_type', ownershipType)
      .maybeSingle()
    const laborRate = Number(ownershipRate?.rate_per_hour)
      || Number(shop?.labor_rate)
      || Number(shop?.default_labor_rate)
      || DEFAULT_LABOR_RATE_FALLBACK

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

    if (error || !est) {
      console.error('[estimates.create_from_wo] insert failed', { woId, shopId, error: error?.message })
      return NextResponse.json({ error: error?.message || 'Failed' }, { status: 500 })
    }

    // Build estimate_lines using ONLY columns that exist in the live schema:
    //   estimate_id, description, labor_hours, labor_rate, labor_total,
    //   parts_total, line_total, line_number.
    // No line_type / quantity / unit_price / so_line_id / part_number column
    // exists. Labor vs part is discriminated by amount fields. Part numbers
    // are embedded into description.
    const estLines: any[] = []
    let lineNumber = 1
    for (const line of lines || []) {
      if (line.line_type === 'labor') {
        const hrs = line.estimated_hours || line.billed_hours || line.actual_hours || 1
        const amt = hrs * laborRate
        estLines.push({
          estimate_id: est.id,
          description: line.description || '',
          labor_hours: hrs,
          labor_rate: laborRate,
          labor_total: amt,
          parts_total: 0,
          line_total: amt,
          line_number: lineNumber++,
        })
      } else if (line.line_type === 'part' && (line.real_name || line.rough_name || line.description)) {
        const price = line.parts_sell_price || line.unit_price || 0
        const qty = line.quantity || 1
        const amt = qty * price
        const baseDesc = line.real_name || line.rough_name || line.description
        const desc = line.part_number ? `${baseDesc} - Part # ${line.part_number}` : baseDesc
        estLines.push({
          estimate_id: est.id,
          description: desc,
          labor_hours: 0,
          labor_rate: 0,
          labor_total: 0,
          parts_total: amt,
          line_total: amt,
          line_number: lineNumber++,
        })
      }
    }
    for (const part of woParts || []) {
      const qty = part.quantity || 1
      const price = part.unit_cost || 0
      const amt = qty * price
      const baseDesc = part.description || ''
      const desc = part.part_number ? `${baseDesc} - Part # ${part.part_number}` : baseDesc
      estLines.push({
        estimate_id: est.id,
        description: desc,
        labor_hours: 0,
        labor_rate: 0,
        labor_total: 0,
        parts_total: amt,
        line_total: amt,
        line_number: lineNumber++,
      })
    }
    if (estLines.length > 0) {
      const { error: linesErr } = await ctx.admin.from('estimate_lines').insert(estLines)
      if (linesErr) {
        console.error('[estimates.create_from_wo] estimate_lines insert failed', { estimateId: est.id, error: linesErr.message })
        return NextResponse.json({ error: `Estimate created but lines snapshot failed: ${linesErr.message}` }, { status: 500 })
      }
    }

    // Totals — read schema-aligned amount fields directly. Tax mirrors
    // calcInvoiceTotals (parts-only when tax_labor=false; labor+parts when
    // tax_labor=true) — same reducer the WO Estimate tab displays.
    const laborTotal = estLines.reduce((sum, l) => sum + (Number(l.labor_total) || 0), 0)
    const partsTotal = estLines.reduce((sum, l) => sum + (Number(l.parts_total) || 0), 0)
    const sub = laborTotal + partsTotal
    const taxableAmount = partsTotal + (taxLabor ? laborTotal : 0)
    const taxAmt = taxRate > 0 ? taxableAmount * (taxRate / 100) : 0
    const grandTotal = sub + taxAmt

    // Chain .select().single() so the response carries the post-update
    // updated_at. The BEFORE UPDATE trigger set_updated_at bumps the column,
    // so the insert-time row the UI would otherwise cache is stale by the time
    // the client sends its next PATCH with expected_updated_at.
    const { data: updatedEst } = await ctx.admin.from('estimates').update({ labor_total: laborTotal, parts_total: partsTotal, subtotal: sub, tax_amount: taxAmt, grand_total: grandTotal, total: grandTotal }).eq('id', est.id).select().single()
    await ctx.admin.from('service_orders').update({ estimate_id: est.id }).eq('id', woId)

    return NextResponse.json({ ...(updatedEst || est), labor_total: laborTotal, parts_total: partsTotal, grand_total: grandTotal })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

export const GET = safeRoute(_GET)
export const POST = safeRoute(_POST)
