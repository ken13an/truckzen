import { SERVICE_PARTS_ROLES } from '@/lib/roles'
import { DEFAULT_LABOR_RATE_FALLBACK } from '@/lib/invoice-lock'
import { NextResponse } from 'next/server'
import { requireRouteContext } from '@/lib/api-route-auth'
import { safeRoute } from '@/lib/api-handler'

async function recalcTotals(admin: any, soId: string) {
  const { data: lines } = await admin.from('so_lines').select('line_type, quantity, unit_price, parts_sell_price, parts_status, billed_hours, actual_hours, estimated_hours').eq('so_id', soId)
  const { data: shop } = await admin.from('service_orders').select('shop_id, shops(labor_rate, default_labor_rate, tax_rate, tax_labor)').eq('id', soId).single()
  const shopData = (shop?.shops as any) || {}
  const laborRate = shopData.labor_rate || shopData.default_labor_rate || DEFAULT_LABOR_RATE_FALLBACK
  const taxRate = parseFloat(shopData.tax_rate) || 0
  const taxLabor = !!shopData.tax_labor
  const laborTotal = (lines || []).filter((l: any) => l.line_type === 'labor').reduce((sum: number, l: any) => {
    const hrs = l.billed_hours || l.actual_hours || l.estimated_hours || 0
    return sum + (hrs * laborRate)
  }, 0)
  const partsTotal = (lines || []).filter((l: any) => l.line_type === 'part' && l.parts_status !== 'canceled').reduce((sum: number, l: any) => {
    const sell = l.parts_sell_price || l.unit_price || 0
    return sum + (sell * (l.quantity || 1))
  }, 0)
  const taxableAmount = partsTotal + (taxLabor ? laborTotal : 0)
  const taxAmount = taxRate > 0 ? taxableAmount * (taxRate / 100) : 0
  const grandTotal = Math.round((laborTotal + partsTotal + taxAmount) * 100) / 100
  await admin.from('service_orders').update({ labor_total: Math.round(laborTotal * 100) / 100, parts_total: Math.round(partsTotal * 100) / 100, grand_total: grandTotal }).eq('id', soId)
}

async function _GET(req: Request) {
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

async function _POST(req: Request) {
  const ctx = await requireRouteContext([...SERVICE_PARTS_ROLES])
  if (ctx.error || !ctx.shopId || !ctx.admin) return ctx.error!
  const body = await req.json()
  const { so_id, line_type, description, part_number, quantity, unit_price, estimated_hours, line_status, rough_name, parts_status, related_labor_line_id } = body

  if (!so_id || !line_type || !description) {
    return NextResponse.json({ error: 'so_id, line_type, description required' }, { status: 400 })
  }

  const { data: so } = await ctx.admin.from('service_orders').select('id, shop_id, invoice_status, is_historical, ownership_type, estimate_approved, estimate_status').eq('id', so_id).single()
  if (!so || so.shop_id !== ctx.shopId) return NextResponse.json({ error: 'Work order not found' }, { status: 404 })

  if (so.is_historical) {
    return NextResponse.json({ error: 'Historical Fullbay records are read-only' }, { status: 403 })
  }

  // Lock: cannot add lines after invoice sent to customer
  if (so.invoice_status && ['sent', 'paid', 'closed'].includes(so.invoice_status)) {
    return NextResponse.json({ error: 'Lines are locked — invoice has been sent to customer' }, { status: 403 })
  }

  const qty = parseFloat(quantity) || 1
  const price = parseFloat(unit_price) || 0

  const lineApprovalDefaults = (so.ownership_type === 'owner_operator' || so.ownership_type === 'outside_customer')
    ? { approval_status: 'needs_approval' as const, approval_required: true }
    : { approval_status: 'pre_approved' as const, approval_required: false }

  // Server-derived supplement flag. When the parent WO's estimate is already
  // approved, any newly inserted line is an addition AFTER that approval and
  // must enter the supplement flow rather than inherit Estimate-1 approval
  // (read path: src/app/work-orders/[id]/page.tsx primary derivation rule
  // !is_additional && wo.estimate_approved → APPROVED). customer_approved is
  // intentionally left at DB default (null) so the pending-supplement portal
  // surfaces it for customer approval.
  //
  // Parent-approval truth comes from EITHER estimate_approved=true OR
  // estimate_status='approved' because TruckZen approval routes write these
  // two fields inconsistently:
  //   - /api/portal/[token]/estimate/approve and /api/estimates/[id]/respond
  //     write both estimate_approved=true AND estimate_status='approved'
  //   - /api/portal/[token]/approve (legacy whole-WO approve) writes ONLY
  //     estimate_status='approved' and leaves estimate_approved untouched
  // Treating either as canonical-approved here closes the post-approval
  // supplement window for both routes without inventing a new field or
  // touching the legacy /portal/[token]/approve writer.
  const isPostApprovalLine = so.estimate_approved === true || so.estimate_status === 'approved'
  if (isPostApprovalLine) {
    console.log('[so-lines] post-approval add-line', { wo: so_id, estimate_approved: so.estimate_approved, estimate_status: so.estimate_status, line_type })
  }

  const trimmedPartNumber = typeof part_number === 'string' ? part_number.trim() : ''

  // Pre-flight resolve the inventory part_id for live part lines so we can
  // either reserve atomically after insert or refuse the create when the
  // resolution is ambiguous. Lines that are not part rows, lack a
  // part_number, or are explicitly canceled bypass reservation entirely
  // (rough/draft estimate lines stay unaffected).
  const isLivePartLine =
    line_type === 'part' &&
    trimmedPartNumber.length > 0 &&
    (parts_status ?? '') !== 'canceled' &&
    qty > 0
  let resolvedPartId: string | null = null
  if (isLivePartLine) {
    const { data: matches } = await ctx.admin.from('parts')
      .select('id')
      .eq('shop_id', ctx.shopId)
      .eq('part_number', trimmedPartNumber)
      .eq('status', 'active')
      .is('deleted_at', null)
    if (matches && matches.length > 1) {
      return NextResponse.json({
        error: `Cannot reserve: part_number "${trimmedPartNumber}" matches ${matches.length} inventory rows for this shop. Resolve duplicates before adding to a work order.`,
      }, { status: 400 })
    }
    if (matches && matches.length === 1) {
      resolvedPartId = matches[0].id
    }
    // Zero matches: line proceeds without reservation. Demand is captured;
    // a future workflow step (PO receive, manual stock add) can reserve later.
  }

  const { data, error } = await ctx.admin.from('so_lines').insert({
    so_id,
    line_type,
    description: description.trim(),
    part_number: part_number?.trim() || null,
    quantity: qty,
    unit_price: price,
    estimated_hours: estimated_hours ?? null,
    line_status: line_status || null,
    rough_name: rough_name?.trim() || null,
    parts_status: parts_status || null,
    related_labor_line_id: related_labor_line_id || null,
    is_additional: isPostApprovalLine,
    ...lineApprovalDefaults,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Atomic reserve when we have a single resolved inventory part. Failure
  // here (insufficient on_hand, race against another writer) rolls back the
  // just-inserted so_lines row so the response is fail-closed: either the
  // line exists with a real reservation, or it doesn't exist at all. Lines
  // without a resolved part_id keep the existing zero-reserve behavior.
  let lineRow: any = data
  if (resolvedPartId) {
    const reserveQty = Math.max(1, Math.round(qty))
    const { data: rpcRow, error: rpcErr } = await ctx.admin.rpc('so_line_part_reserve_apply', {
      p_so_line_id: data.id,
      p_shop_id: ctx.shopId,
      p_part_id: resolvedPartId,
      p_qty: reserveQty,
      p_reason: null,
      p_actor_user_id: ctx.actor?.id ?? null,
    })
    if (rpcErr) {
      await ctx.admin.from('so_lines').delete().eq('id', data.id)
      return NextResponse.json({ error: `Reserve failed: ${rpcErr.message}` }, { status: 400 })
    }
    if (rpcRow) lineRow = rpcRow
  }

  await recalcTotals(ctx.admin, so_id)
  return NextResponse.json(lineRow, { status: 201 })
}

export const GET = safeRoute(_GET)
export const POST = safeRoute(_POST)
