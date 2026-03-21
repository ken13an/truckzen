import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')
  const shopId = searchParams.get('shop_id')

  let q = s.from('parts_requests').select('*').order('created_at', { ascending: false })
  if (userId) q = q.eq('requested_by', userId)
  if (shopId) q = q.eq('shop_id', shopId)

  const { data, error } = await q.limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const s = db()
  const { shop_id, so_id, so_line_id, user_id, part_name, quantity, notes } = await req.json()
  if (!shop_id || !part_name) return NextResponse.json({ error: 'shop_id and part_name required' }, { status: 400 })

  const { data, error } = await s.from('parts_requests').insert({
    shop_id,
    so_id: so_id || null,
    so_line_id: so_line_id || null,
    requested_by: user_id,
    description: part_name,
    part_name,
    quantity: quantity || 1,
    notes: notes || null,
    status: 'requested',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: Request) {
  const s = db()
  const { id, status, approved_by_user_id, rejected_reason, in_stock } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const update: Record<string, any> = { updated_at: new Date().toISOString() }
  if (status) update.status = status
  if (approved_by_user_id) { update.approved_by_user_id = approved_by_user_id; update.approved_at = new Date().toISOString() }
  if (rejected_reason) update.rejected_reason = rejected_reason
  if (in_stock !== undefined) update.in_stock = in_stock
  if (status === 'ready') update.ready_at = new Date().toISOString()
  if (status === 'picked_up') update.picked_up_at = new Date().toISOString()
  if (status === 'ordered') update.ordered_at = new Date().toISOString()

  const { error } = await s.from('parts_requests').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
