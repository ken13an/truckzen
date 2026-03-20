import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

type Params = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  const s = db()

  const { data: wo, error } = await s
    .from('service_orders')
    .select(`
      *,
      assets(id, unit_number, year, make, model, vin, odometer, engine, ownership_type),
      customers(id, company_name, contact_name, phone, email, address),
      users!assigned_tech(id, full_name, role, team),
      so_lines(id, line_type, description, part_number, quantity, unit_price, total_price, created_at, assigned_to, finding, resolution, estimated_hours, actual_hours, billed_hours, line_status),
      invoices(id, invoice_number, status, total, balance_due),
      wo_notes(id, user_id, note_text, visible_to_customer, created_at),
      wo_files(id, user_id, file_url, filename, caption, visible_to_customer, created_at),
      wo_activity_log(id, user_id, action, created_at),
      wo_shop_charges(id, description, amount, taxable, created_at)
    `)
    .eq('id', id)
    .single()

  if (error || !wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Get shop tax settings
  const { data: shop } = await s.from('shops').select('tax_rate, tax_labor, state, county, name, labor_rate, default_labor_rate, dba, phone, email, address').eq('id', wo.shop_id).single()

  // Get wo_parts
  const { data: woParts } = await s.from('wo_parts').select('*').eq('wo_id', id).order('created_at')

  // Resolve creator name
  let createdByName = null
  if (wo.created_by_user_id) {
    const { data: creator } = await s.from('users').select('full_name').eq('id', wo.created_by_user_id).single()
    createdByName = creator?.full_name || null
  }

  // Resolve assigned_to names for job lines
  const techIds = (wo.so_lines || []).map((l: any) => l.assigned_to).filter(Boolean)
  let techMap: Record<string, string> = {}
  if (techIds.length > 0) {
    const { data: techs } = await s.from('users').select('id, full_name, team').in('id', techIds)
    if (techs) techMap = Object.fromEntries(techs.map((t: any) => [t.id, `${t.full_name} - Team ${t.team || '?'}`]))
  }

  // Resolve note/activity user names
  const allUserIds = [
    ...(wo.wo_notes || []).map((n: any) => n.user_id),
    ...(wo.wo_activity_log || []).map((a: any) => a.user_id),
    ...(wo.wo_files || []).map((f: any) => f.user_id),
  ].filter(Boolean)
  let userMap: Record<string, string> = {}
  if (allUserIds.length > 0) {
    const { data: users } = await s.from('users').select('id, full_name').in('id', [...new Set(allUserIds)])
    if (users) userMap = Object.fromEntries(users.map((u: any) => [u.id, u.full_name]))
  }

  // Get job assignments for all lines
  const lineIds = (wo.so_lines || []).map((l: any) => l.id)
  let jobAssignments: any[] = []
  if (lineIds.length > 0) {
    const { data: ja } = await s.from('wo_job_assignments').select('*, users(id, full_name, team)').in('line_id', lineIds).order('created_at')
    jobAssignments = ja || []
  }

  return NextResponse.json({ ...wo, shop, techMap, userMap, createdByName, jobAssignments, woParts: woParts || [] })
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const s = db()
  const body = await req.json()

  const allowedFields = ['status', 'priority', 'team', 'bay', 'assigned_tech', 'complaint', 'cause', 'correction', 'internal_notes', 'customer_id', 'grand_total', 'due_date', 'service_writer_id', 'parts_person_id', 'customer_contact_name', 'customer_contact_phone', 'fleet_contact_name', 'fleet_contact_phone', 'po_number', 'estimate_date', 'promised_date']
  const update: Record<string, any> = {}
  for (const f of allowedFields) { if (body[f] !== undefined) update[f] = body[f] }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'No fields' }, { status: 400 })

  update.updated_at = new Date().toISOString()
  if (update.status === 'good_to_go' && body._old_status !== 'good_to_go') update.completed_at = new Date().toISOString()

  const { data, error } = await s.from('service_orders').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log activity
  if (body.user_id) {
    const changes = Object.keys(update).filter(k => k !== 'updated_at').join(', ')
    await s.from('wo_activity_log').insert({ wo_id: id, user_id: body.user_id, action: `Updated: ${changes}` })
  }

  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const s = db()
  await s.from('service_orders').update({ status: 'void', updated_at: new Date().toISOString() }).eq('id', id)
  return NextResponse.json({ success: true })
}
