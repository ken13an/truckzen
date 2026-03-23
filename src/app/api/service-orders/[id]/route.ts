import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logAction } from '@/lib/services/auditLog'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

type Params = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  const s = db()
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')

  let q = s
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

  if (shopId) q = q.eq('shop_id', shopId)

  const { data: so, error } = await q.single()

  if (error || !so) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(so)
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const s = db()

  const { data: current } = await s.from('service_orders').select('*').eq('id', id).single()
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

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

  update.updated_at = new Date().toISOString()
  if (update.status === 'good_to_go' && current.status !== 'good_to_go') {
    update.completed_at = new Date().toISOString()
  }

  const { data: updated, error } = await s.from('service_orders').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params
  const s = db()
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')

  const { data: so } = await s.from('service_orders').select('shop_id').eq('id', id).single()
  await s.from('service_orders').update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id)

  if (so && userId) {
    logAction({ shop_id: so.shop_id, user_id: userId, action: 'soft_delete', entity_type: 'service_order', entity_id: id }).catch(() => {})
  }

  return NextResponse.json({ success: true })
}
