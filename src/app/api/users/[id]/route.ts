import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

type P = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: P) {
  const { id } = await params
  const s = db()
  const body = await req.json()

  const updateable = ['role', 'team', 'language', 'telegram_id', 'active', 'full_name', 'phone', 'department']
  const update: Record<string, any> = {}
  for (const f of updateable) { if (body[f] !== undefined) update[f] = body[f] }

  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'No fields' }, { status: 400 })

  // Auto-set department when role changes
  if (update.role) {
    const ROLE_DEPT: Record<string, string> = {
      service_writer: 'service', service_manager: 'service', service_advisor: 'service',
      parts_staff: 'parts', parts_manager: 'parts',
      mechanic: 'floor', technician: 'floor', lead_tech: 'floor', floor_supervisor: 'floor', floor_manager: 'floor', shop_manager: 'floor',
      accountant: 'accounting', accounting_manager: 'accounting', office_admin: 'accounting',
      maintenance_tech: 'maintenance', maintenance_technician: 'maintenance', maintenance_manager: 'maintenance',
      fleet_manager: 'fleet', dispatcher: 'fleet',
      driver: 'drivers',
      owner: 'management', gm: 'management', admin: 'management', it_person: 'management',
    }
    update.department = ROLE_DEPT[update.role] || 'management'
  }

  const { data, error } = await s.from('users').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: P) {
  const { id } = await params
  const s = db()
  // Soft delete: set deleted_at + deactivate. Actual removal after 30 days.
  await s.from('users').update({ active: false, deleted_at: new Date().toISOString() }).eq('id', id)
  return NextResponse.json({ success: true })
}
