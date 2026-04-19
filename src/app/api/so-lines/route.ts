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

// Phase 4: reuse an open pending supplement batch for this WO, or mint one.
// A batch is "open" when at least one line (or wo_part) on the WO carries
// is_additional=true AND customer_approved IS NULL AND a supplement_batch_id.
// No batch table — the id is derived entirely from the items themselves.
async function getOrCreateOpenSupplementBatch(admin: any, soId: string): Promise<{ batchId: string; opened: boolean }> {
  const { data: existingLine } = await admin
    .from('so_lines')
    .select('supplement_batch_id')
    .eq('so_id', soId)
    .eq('is_additional', true)
    .is('customer_approved', null)
    .not('supplement_batch_id', 'is', null)
    .limit(1)
    .maybeSingle()
  if (existingLine?.supplement_batch_id) return { batchId: existingLine.supplement_batch_id as string, opened: false }

  const { data: existingPart } = await admin
    .from('wo_parts')
    .select('supplement_batch_id')
    .eq('wo_id', soId)
    .eq('is_additional', true)
    .is('customer_approved', null)
    .not('supplement_batch_id', 'is', null)
    .limit(1)
    .maybeSingle()
  if (existingPart?.supplement_batch_id) return { batchId: existingPart.supplement_batch_id as string, opened: false }

  return { batchId: crypto.randomUUID(), opened: true }
}

async function _POST(req: Request) {
  const ctx = await requireRouteContext([...SERVICE_PARTS_ROLES])
  if (ctx.error || !ctx.shopId || !ctx.admin) return ctx.error!
  const body = await req.json()
  // NOTE: supplement fields are server-owned. We deliberately do NOT destructure
  // is_additional / customer_approved / supplement_batch_id / emergency_override_*
  // from the body — clients cannot set them.
  const { so_id, line_type, description, part_number, quantity, unit_price, estimated_hours, line_status, rough_name, parts_status, related_labor_line_id } = body

  if (!so_id || !line_type || !description) {
    return NextResponse.json({ error: 'so_id, line_type, description required' }, { status: 400 })
  }

  const { data: so } = await ctx.admin.from('service_orders').select('id, shop_id, invoice_status, is_historical, ownership_type, estimate_approved').eq('id', so_id).single()
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

  // Phase 4: post-approval additions on owner/outside-customer WOs become pending supplements.
  const isSupplementCandidate =
    so.estimate_approved === true &&
    (so.ownership_type === 'owner_operator' || so.ownership_type === 'outside_customer')
  let supplementFields: Record<string, any> = {}
  let batchInfo: { batchId: string; opened: boolean } | null = null
  if (isSupplementCandidate) {
    batchInfo = await getOrCreateOpenSupplementBatch(ctx.admin, so_id)
    supplementFields = {
      is_additional: true,
      customer_approved: null,
      supplement_batch_id: batchInfo.batchId,
    }
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
    ...lineApprovalDefaults,
    ...supplementFields,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await recalcTotals(ctx.admin, so_id)

  if (isSupplementCandidate && batchInfo) {
    if (batchInfo.opened) {
      await ctx.admin.from('wo_activity_log').insert({
        wo_id: so_id,
        user_id: ctx.actor?.id || null,
        action: 'Supplement batch opened (pending customer approval)',
        details: { event: 'supplement_batch_opened', wo_id: so_id, supplement_batch_id: batchInfo.batchId, first_item_ref: { table: 'so_lines', id: (data as any).id }, actor_user_id: ctx.actor?.id || null },
      })
    }
    await ctx.admin.from('wo_activity_log').insert({
      wo_id: so_id,
      user_id: ctx.actor?.id || null,
      action: `Supplement job line added (pending): ${description.trim()}`,
      details: {
        event: 'supplement_line_created',
        so_id,
        line_id: (data as any).id,
        line_type,
        description: description.trim(),
        quantity: qty,
        unit_price: price,
        supplement_batch_id: batchInfo.batchId,
        actor_user_id: ctx.actor?.id || null,
      },
    })
  }
  return NextResponse.json(data, { status: 201 })
}

export const GET = safeRoute(_GET)
export const POST = safeRoute(_POST)
