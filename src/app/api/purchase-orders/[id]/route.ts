import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'

type LineUpdate = { id: string; quantity_received: number }

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

  // Use the canonical supabase admin client (same path every other production
  // route uses). Atomicity: the bulk line upsert is one SQL statement, and the
  // header recompute is a second one — line-level updates remain all-or-nothing,
  // and the header is reconciled from the just-written full line state.
  const s = createAdminSupabaseClient()

  // 1. PO lookup + shop scope
  const { data: po, error: poErr } = await s
    .from('purchase_orders')
    .select('id, status, received_date')
    .eq('id', poId)
    .eq('shop_id', shopId)
    .maybeSingle()
  if (poErr) {
    logErr('po_lookup_failed', { purchase_order_id: poId, shop_id: shopId, db_error: poErr.message })
    return NextResponse.json({ error: poErr.message }, { status: 500 })
  }
  if (!po) return jsonError('Not found', 404)

  // 2. Read every line on this PO for ownership + over-receive validation
  const { data: existingLines, error: linesErr } = await s
    .from('purchase_order_lines')
    .select('id, purchase_order_id, quantity, quantity_received, received_at')
    .eq('purchase_order_id', poId)
  if (linesErr) {
    logErr('po_lines_lookup_failed', { purchase_order_id: poId, shop_id: shopId, db_error: linesErr.message })
    return NextResponse.json({ error: linesErr.message }, { status: 500 })
  }

  const lineMap = new Map((existingLines || []).map(l => [l.id, l]))

  // 3. Validate each update line against the just-read snapshot
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

  // 4. Build upsert rows. received_at flips to now on the first non-zero qr
  //    and clears when qr is zeroed; otherwise it is preserved.
  const nowIso = new Date().toISOString()
  const upsertRows = updates.map(u => {
    const existing = lineMap.get(u.id)!
    const prevQr = existing.quantity_received == null ? 0 : Number(existing.quantity_received)
    const setReceivedAt = u.quantity_received > 0 && prevQr === 0
    const clearReceivedAt = u.quantity_received === 0 && prevQr > 0
    return {
      id: u.id,
      purchase_order_id: poId,
      quantity_received: u.quantity_received,
      received_at: setReceivedAt ? nowIso : (clearReceivedAt ? null : existing.received_at),
    }
  })

  // 5. Apply all line updates in a single atomic statement
  const { error: upErr } = await s
    .from('purchase_order_lines')
    .upsert(upsertRows, { onConflict: 'id' })
  if (upErr) {
    logErr('bulk_line_update_failed', { purchase_order_id: poId, shop_id: shopId, db_error: upErr.message })
    return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  // 6. Re-read full line state to recompute header truth
  const { data: freshLines, error: freshErr } = await s
    .from('purchase_order_lines')
    .select('id, quantity, quantity_received')
    .eq('purchase_order_id', poId)
  if (freshErr) {
    logErr('po_lines_refresh_failed', { purchase_order_id: poId, shop_id: shopId, db_error: freshErr.message })
    return NextResponse.json({ error: freshErr.message }, { status: 500 })
  }

  // 7. Recompute PO header status from the just-written full line state
  const lineCount = (freshLines || []).length
  let totalReceived = 0
  let allFullyReceived = lineCount > 0
  for (const l of freshLines || []) {
    const qr = l.quantity_received == null ? 0 : Number(l.quantity_received)
    const q = l.quantity == null ? 0 : Number(l.quantity)
    totalReceived += qr
    if (qr < q) allFullyReceived = false
  }

  const headerPatch: Record<string, unknown> = { updated_at: nowIso }
  if (allFullyReceived && lineCount > 0) {
    headerPatch.status = 'received'
    if (!po.received_date) headerPatch.received_date = nowIso.slice(0, 10)
  } else if (totalReceived > 0) {
    headerPatch.status = 'partially_received'
  }

  const { error: hdrErr } = await s
    .from('purchase_orders')
    .update(headerPatch)
    .eq('id', poId)
    .eq('shop_id', shopId)
  if (hdrErr) {
    logErr('header_update_failed', { purchase_order_id: poId, shop_id: shopId, db_error: hdrErr.message })
    return NextResponse.json({ error: hdrErr.message }, { status: 500 })
  }

  // 8. Read final state for the response
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
