import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logAction } from '@/lib/services/auditLog'
import { getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'
import { safeRoute } from '@/lib/api-handler'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

type Params = { params: Promise<{ id: string }> }

async function _GET(req: Request, { params }: Params) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)

  const { id } = await params
  const s = db()

  const { data: so, error } = await s
    .from('service_orders')
    .select(`
      *,
      assets(id, unit_number, year, make, model, vin, odometer, engine),
      customers(id, company_name, contact_name, phone, email),
      users!assigned_tech(id, full_name, role, team),
      so_lines(id, line_type, description, part_number, quantity, unit_price, total_price, created_at),
      invoices(id, invoice_number, status, total, balance_due)
    `)
    .eq('id', id)
    .eq('shop_id', shopId)
    .single()

  if (error || !so) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(so)
}

async function _PATCH(req: Request, { params }: Params) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)

  const { id } = await params
  const s = db()

  const { data: current } = await s.from('service_orders').select('*').eq('id', id).eq('shop_id', shopId).single()
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (current.is_historical) {
    return NextResponse.json({ error: 'Historical Fullbay records are read-only' }, { status: 403 })
  }

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const allowedFields = ['status', 'priority', 'team', 'bay', 'assigned_tech', 'complaint', 'cause', 'correction', 'internal_notes', 'customer_id', 'grand_total', 'due_date']
  const update: Record<string, any> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) update[field] = body[field]
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // Guard WO status transitions (skip for historical/imported WOs)
  if (update.status && !current.is_historical) {
    const VALID_WO_TRANSITIONS: Record<string, string[]> = {
      draft: ['in_progress', 'waiting_approval', 'void'],
      waiting_approval: ['in_progress', 'draft', 'void'],
      in_progress: ['waiting_parts', 'done', 'completed', 'void'],
      waiting_parts: ['in_progress', 'void'],
      completed: ['good_to_go', 'in_progress', 'void'],
      done: ['good_to_go', 'in_progress', 'void'],
      good_to_go: ['void'],
    }
    const allowed = VALID_WO_TRANSITIONS[current.status]
    if (allowed && !allowed.includes(update.status)) {
      return NextResponse.json({ error: `Cannot transition from "${current.status}" to "${update.status}"` }, { status: 400 })
    }
  }

  update.updated_at = new Date().toISOString()
  if (update.status === 'good_to_go' && current.status !== 'good_to_go') {
    update.completed_at = new Date().toISOString()
  }

  const { data: updated, error } = await s.from('service_orders').update(update).eq('id', id).eq('shop_id', shopId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(updated)
}

async function _DELETE(req: Request, { params }: Params) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)

  const { id } = await params
  const s = db()

  const { data: delTarget } = await s.from('service_orders').select('is_historical').eq('id', id).eq('shop_id', shopId).single()
  if (delTarget?.is_historical) {
    return NextResponse.json({ error: 'Historical Fullbay records are read-only' }, { status: 403 })
  }

  await s.from('service_orders').update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id).eq('shop_id', shopId)

  logAction({ shop_id: shopId, user_id: actor.id, action: 'soft_delete', entity_type: 'service_order', entity_id: id }).catch(() => {})

  return NextResponse.json({ success: true })
}

export const GET = safeRoute(_GET)
export const PATCH = safeRoute(_PATCH)
export const DELETE = safeRoute(_DELETE)
