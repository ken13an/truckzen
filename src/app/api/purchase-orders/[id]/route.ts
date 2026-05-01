import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'

type LineUpdate = { id: string; quantity_received: number }

const HEADER_KEEP_STATUSES = new Set(['draft', 'sent', 'in_transit', 'cancelled'])

function logErr(stage: string, ctx: Record<string, unknown>) {
  // one clear log line per failure stage; do not throw
  console.error(`[purchase-orders/[id]] ${stage}`, ctx)
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: poId } = await params
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)

  const s = createAdminSupabaseClient()
  const { data: po, error } = await s
    .from('purchase_orders')
    .select('id, shop_id, po_number, vendor_name, status, total, received_date, expected_date, source, fullbay_id, created_at')
    .eq('id', poId)
    .eq('shop_id', shopId)
    .maybeSingle()

  if (error) {
    logErr('po_read_failed', { purchase_order_id: poId, shop_id: shopId, db_error: error.message })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!po) return jsonError('Not found', 404)

  const { data: lines, error: linesErr } = await s
    .from('purchase_order_lines')
    .select('id, part_id, part_number, description, quantity, quantity_received, received_at, cost_price, sell_price, created_at')
    .eq('purchase_order_id', poId)
    .order('created_at', { ascending: true })

  if (linesErr) {
    logErr('po_lines_read_failed', { purchase_order_id: poId, shop_id: shopId, db_error: linesErr.message })
    return NextResponse.json({ error: linesErr.message }, { status: 500 })
  }

  return NextResponse.json({ ...po, lines: lines || [] })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: poId } = await params
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)

  let body: any
  try { body = await req.json() } catch { return jsonError('Invalid JSON body', 400) }

  const rawLines = Array.isArray(body?.lines) ? body.lines : null
  if (!rawLines || rawLines.length === 0) {
    return jsonError('lines required', 400)
  }

  const updates: LineUpdate[] = []
  for (const l of rawLines) {
    if (!l || typeof l.id !== 'string') {
      logErr('line_validation_failed', { purchase_order_id: poId, shop_id: shopId, reason: 'missing_id' })
      return jsonError('Each line requires id', 400)
    }
    const qr = Number(l.quantity_received)
    if (!Number.isFinite(qr) || qr < 0) {
      logErr('line_validation_failed', { purchase_order_id: poId, shop_id: shopId, line_id: l.id, reason: 'negative_or_invalid' })
      return jsonError('quantity_received must be a non-negative number', 400)
    }
    updates.push({ id: l.id, quantity_received: qr })
  }

  const s = createAdminSupabaseClient()

  // verify PO belongs to actor shop
  const { data: po, error: poErr } = await s
    .from('purchase_orders')
    .select('id, shop_id, status, received_date')
    .eq('id', poId)
    .eq('shop_id', shopId)
    .maybeSingle()

  if (poErr) {
    logErr('po_lookup_failed', { purchase_order_id: poId, shop_id: shopId, db_error: poErr.message })
    return NextResponse.json({ error: poErr.message }, { status: 500 })
  }
  if (!po) return jsonError('Not found', 404)

  // load all canonical lines for truth recompute and validation
  const { data: existingLines, error: linesErr } = await s
    .from('purchase_order_lines')
    .select('id, purchase_order_id, quantity, quantity_received, received_at')
    .eq('purchase_order_id', poId)

  if (linesErr) {
    logErr('po_lines_lookup_failed', { purchase_order_id: poId, shop_id: shopId, db_error: linesErr.message })
    return NextResponse.json({ error: linesErr.message }, { status: 500 })
  }

  const lineMap = new Map((existingLines || []).map(l => [l.id, l]))

  // reject any update line that does not belong to this PO
  for (const u of updates) {
    const existing = lineMap.get(u.id)
    if (!existing) {
      logErr('line_validation_failed', { purchase_order_id: poId, shop_id: shopId, line_id: u.id, reason: 'not_in_po' })
      return jsonError('Line does not belong to this PO', 400)
    }
    const ordered = existing.quantity == null ? null : Number(existing.quantity)
    if (ordered != null && u.quantity_received > ordered) {
      logErr('line_validation_failed', { purchase_order_id: poId, shop_id: shopId, line_id: u.id, reason: 'over_receipt', ordered, requested: u.quantity_received })
      return jsonError('quantity_received exceeds ordered quantity', 400)
    }
  }

  // apply updates
  const nowIso = new Date().toISOString()
  for (const u of updates) {
    const existing = lineMap.get(u.id)!
    const prevQr = existing.quantity_received == null ? 0 : Number(existing.quantity_received)
    const setReceivedAt = u.quantity_received > 0 && prevQr === 0
    const clearReceivedAt = u.quantity_received === 0 && prevQr > 0

    const patch: Record<string, unknown> = { quantity_received: u.quantity_received }
    if (setReceivedAt) patch.received_at = nowIso
    if (clearReceivedAt) patch.received_at = null

    const { error: upErr } = await s
      .from('purchase_order_lines')
      .update(patch)
      .eq('id', u.id)
      .eq('purchase_order_id', poId)

    if (upErr) {
      logErr('line_update_failed', { purchase_order_id: poId, shop_id: shopId, line_id: u.id, db_error: upErr.message })
      return NextResponse.json({ error: upErr.message }, { status: 500 })
    }
    // mutate local copy for header recompute
    existing.quantity_received = u.quantity_received
    if (setReceivedAt) existing.received_at = nowIso
    if (clearReceivedAt) existing.received_at = null
  }

  // recompute header truth from canonical lines
  let totalReceived = 0
  let allFullyReceived = (existingLines || []).length > 0
  for (const l of existingLines || []) {
    const qr = l.quantity_received == null ? 0 : Number(l.quantity_received)
    const q = l.quantity == null ? 0 : Number(l.quantity)
    totalReceived += qr
    if (qr < q) allFullyReceived = false
  }

  let nextStatus = po.status
  let nextReceivedDate: string | null | undefined = undefined
  if (allFullyReceived && (existingLines || []).length > 0) {
    nextStatus = 'received'
    nextReceivedDate = po.received_date || nowIso.slice(0, 10)
  } else if (totalReceived > 0) {
    nextStatus = 'partially_received'
  } else if (HEADER_KEEP_STATUSES.has(po.status || '')) {
    nextStatus = po.status
  } else {
    nextStatus = po.status
  }

  const headerPatch: Record<string, unknown> = { status: nextStatus, updated_at: nowIso }
  if (nextReceivedDate !== undefined) headerPatch.received_date = nextReceivedDate

  const { error: hdrErr } = await s
    .from('purchase_orders')
    .update(headerPatch)
    .eq('id', poId)
    .eq('shop_id', shopId)

  if (hdrErr) {
    logErr('header_status_recompute_failed', { purchase_order_id: poId, shop_id: shopId, db_error: hdrErr.message })
    return NextResponse.json({ error: hdrErr.message }, { status: 500 })
  }

  // return updated truth
  const { data: refreshedPo } = await s
    .from('purchase_orders')
    .select('id, po_number, vendor_name, status, total, received_date, expected_date, source, fullbay_id, created_at')
    .eq('id', poId)
    .eq('shop_id', shopId)
    .maybeSingle()

  const { data: refreshedLines } = await s
    .from('purchase_order_lines')
    .select('id, part_id, part_number, description, quantity, quantity_received, received_at, cost_price, sell_price, created_at')
    .eq('purchase_order_id', poId)
    .order('created_at', { ascending: true })

  return NextResponse.json({ ...(refreshedPo || {}), lines: refreshedLines || [] })
}
