import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'
import { log } from '@/lib/security'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerSupabaseClient()
  const user     = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: so, error } = await supabase
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
    .eq('shop_id', user.shop_id)
    .single()

  if (error || !so) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Techs only see their team
  const limitedRoles = ['technician', 'maintenance_technician']
  if (limitedRoles.includes(user.role) && user.team && (so as any).team !== user.team) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  return NextResponse.json(so)
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerSupabaseClient()
  const user     = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch current SO first
  const { data: current } = await supabase
    .from('service_orders')
    .select('*')
    .eq('id', id)
    .eq('shop_id', user.shop_id)
    .single()

  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Allowed fields per role
  const unlimitedRoles = ['owner', 'gm', 'it_person', 'shop_manager']
  const advisorRoles   = ['service_advisor', 'service_writer', 'office_admin', 'accountant']
  const techRoles      = ['technician', 'maintenance_technician']

  let allowedFields: string[]
  if (unlimitedRoles.includes(user.role)) {
    allowedFields = ['status','priority','team','bay','assigned_tech','complaint','cause','correction','internal_notes','customer_id','grand_total','due_date']
  } else if (advisorRoles.includes(user.role)) {
    allowedFields = ['status','priority','team','bay','assigned_tech','complaint','cause','correction','customer_id','due_date']
  } else if (techRoles.includes(user.role)) {
    allowedFields = ['status','cause','correction','internal_notes']
  } else {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  // Strip non-allowed fields
  const update: Record<string, any> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) update[field] = body[field]
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  update.updated_at = new Date().toISOString()

  // If status is being closed, record completion time
  if (update.status === 'good_to_go' && current.status !== 'good_to_go') {
    update.completed_at = new Date().toISOString()
  }

  const { data: updated, error } = await supabase
    .from('service_orders')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await log('so.updated', user.shop_id, user.id, {
    table:   'service_orders',
    recordId: id,
    oldData: current,
    newData: update,
  })

  // If status changed, log it specifically
  if (update.status && update.status !== current.status) {
    await log('so.status_changed', user.shop_id, user.id, {
      table:   'service_orders',
      recordId: id,
      oldData: { status: current.status },
      newData: { status: update.status },
    })
  }

  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerSupabaseClient()
  const user     = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only unlimited roles can delete
  if (!['owner', 'gm', 'it_person'].includes(user.role)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  // Soft delete — set status to void, never hard delete
  const { data: current } = await supabase.from('service_orders').select('so_number').eq('id', id).single()

  await supabase.from('service_orders').update({ status: 'void', updated_at: new Date().toISOString() }).eq('id', id).eq('shop_id', user.shop_id)

  await log('so.deleted', user.shop_id, user.id, {
    table: 'service_orders', recordId: id,
    oldData: current,
  })

  return NextResponse.json({ success: true })
}
