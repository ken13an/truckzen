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

  // Delegate the entire receive operation to the live Postgres RPC. The RPC
  // performs PO + line + parts FOR UPDATE locks, validates ownership and
  // over-receive, applies line truth, moves stock truth via on_hand delta
  // (clamped at 0), writes a stock_movements ledger row per applied delta,
  // recomputes PO header truth, and returns the same top-level response
  // shape this route returned previously.
  const s = createAdminSupabaseClient()
  const { data, error } = await s.rpc('po_receive_apply', {
    p_po_id:         poId,
    p_shop_id:       shopId,
    p_updates:       updates,
    p_actor_user_id: actor.id,
  })

  if (error) {
    if (error.code === 'P0001') {
      return jsonError(error.message, 400)
    }
    if (error.code === 'P0002') {
      return jsonError('Not found', 404)
    }
    logErr('po_receive_rpc_failed', {
      purchase_order_id: poId,
      shop_id: shopId,
      db_error: error.message,
      db_code: error.code,
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
