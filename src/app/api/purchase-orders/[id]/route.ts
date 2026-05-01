import { NextResponse } from 'next/server'
import { Client } from 'pg'
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

  // Production uses DATABASE_URL_POOLER (Supabase session-mode pooler).
  // Local dev / scripts may use DATABASE_URL — fall back to it.
  const dbUrl = process.env.DATABASE_URL_POOLER || process.env.DATABASE_URL
  if (!dbUrl) {
    logErr('db_connection_string_missing', {
      purchase_order_id: poId,
      shop_id: shopId,
      checked_envs: 'DATABASE_URL_POOLER, DATABASE_URL',
    })
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  // Atomic receive: PO lookup + line lock + bulk line update + header recompute
  // all run inside one Postgres transaction. Any failure rolls back every line
  // change so PO header truth and line truth stay consistent.
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  })

  try {
    await client.connect()
  } catch (connErr: any) {
    logErr('db_connect_failed', { purchase_order_id: poId, shop_id: shopId, db_error: String(connErr?.message || connErr) })
    return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
  }

  try {
    await client.query('BEGIN')

    // 1. lock the PO row + verify shop scope
    const poRes = await client.query(
      `SELECT id, status, received_date
         FROM public.purchase_orders
        WHERE id = $1 AND shop_id = $2
        FOR UPDATE`,
      [poId, shopId]
    )
    if (poRes.rowCount === 0) {
      await client.query('ROLLBACK')
      return jsonError('Not found', 404)
    }

    // 2. lock + read every line on this PO under the same transaction
    const linesRes = await client.query<{ id: string; quantity: string | null; quantity_received: string | null }>(
      `SELECT id, quantity, quantity_received
         FROM public.purchase_order_lines
        WHERE purchase_order_id = $1
        FOR UPDATE`,
      [poId]
    )
    const lineMap = new Map(linesRes.rows.map(l => [l.id, l]))

    // 3. validate each update line against the just-locked snapshot
    for (const u of updates) {
      const existing = lineMap.get(u.id)
      if (!existing) {
        logErr('line_validation_failed', { purchase_order_id: poId, shop_id: shopId, line_id: u.id, reason: 'not_in_po' })
        await client.query('ROLLBACK')
        return jsonError('Line does not belong to this PO', 400)
      }
      const ordered = existing.quantity == null ? null : Number(existing.quantity)
      if (ordered != null && u.quantity_received > ordered) {
        logErr('line_validation_failed', { purchase_order_id: poId, shop_id: shopId, line_id: u.id, reason: 'over_receipt', ordered, requested: u.quantity_received })
        await client.query('ROLLBACK')
        return jsonError('quantity_received exceeds ordered quantity', 400)
      }
    }

    // 4. apply ALL line updates in a single bulk UPDATE FROM VALUES.
    //    received_at flips to now() on the first non-zero qr and back to NULL
    //    when qr is zeroed; otherwise it is preserved.
    const params: unknown[] = []
    const valuesSql = updates.map((u, i) => {
      params.push(u.id, u.quantity_received)
      return `($${i * 2 + 1}::uuid, $${i * 2 + 2}::numeric)`
    }).join(',')
    params.push(poId)
    const lineUpdateSql = `
      UPDATE public.purchase_order_lines p
         SET quantity_received = u.qr,
             received_at = CASE
               WHEN u.qr > 0 AND COALESCE(p.quantity_received, 0) = 0 THEN now()
               WHEN u.qr = 0 AND COALESCE(p.quantity_received, 0) > 0 THEN NULL
               ELSE p.received_at
             END
        FROM (VALUES ${valuesSql}) AS u(id, qr)
       WHERE p.id = u.id
         AND p.purchase_order_id = $${updates.length * 2 + 1}::uuid
    `
    await client.query(lineUpdateSql, params)

    // 5. recompute PO header truth from the just-updated full line state.
    //    Status flips:
    //      all lines fully received -> 'received' (set received_date if absent)
    //      any line received        -> 'partially_received'
    //      otherwise                -> preserve current status
    await client.query(
      `WITH ls AS (
         SELECT
           COUNT(*)                                                     AS line_count,
           COUNT(*) FILTER (WHERE quantity_received >= COALESCE(quantity, 0)) AS fully_count,
           COALESCE(SUM(quantity_received), 0)                          AS total_qr
           FROM public.purchase_order_lines
          WHERE purchase_order_id = $1
       )
       UPDATE public.purchase_orders po
          SET status = CASE
                WHEN ls.line_count > 0 AND ls.fully_count = ls.line_count THEN 'received'
                WHEN ls.total_qr > 0                                       THEN 'partially_received'
                ELSE po.status
              END,
              received_date = CASE
                WHEN ls.line_count > 0 AND ls.fully_count = ls.line_count
                  THEN COALESCE(po.received_date, CURRENT_DATE)
                ELSE po.received_date
              END,
              updated_at = now()
         FROM ls
        WHERE po.id = $1 AND po.shop_id = $2`,
      [poId, shopId]
    )

    await client.query('COMMIT')
  } catch (err: any) {
    try { await client.query('ROLLBACK') } catch {}
    logErr('atomic_receive_failed', { purchase_order_id: poId, shop_id: shopId, db_error: String(err?.message || err) })
    return NextResponse.json({ error: err?.message || 'Receive failed' }, { status: 500 })
  } finally {
    try { await client.end() } catch {}
  }

  // 6. read final state for the response (separate transaction; safe — no writes)
  const s = createAdminSupabaseClient()
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
