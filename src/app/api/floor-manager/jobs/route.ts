import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  // Get all job lines with assignments, WO info, customer, unit
  const { data: lines } = await s.from('so_lines')
    .select(`id, description, line_status, estimated_hours, actual_hours, required_skills, line_type,
      service_orders!inner(id, so_number, status, shop_id, customer_id, asset_id,
        customers(company_name),
        assets(unit_number, unit_type)
      )`)
    .eq('service_orders.shop_id', shopId)
    .in('line_type', ['labor', 'job'])
    .not('service_orders.status', 'in', '("good_to_go","done","void")')
    .order('created_at', { ascending: false })
    .limit(200)

  // Get assignments for these lines
  const lineIds = (lines || []).map((l: any) => l.id)
  let assignments: any[] = []
  if (lineIds.length > 0) {
    const { data: ja } = await s.from('job_assignments')
      .select('*, users:assigned_to_user_id(full_name, team, skills)')
      .in('so_line_id', lineIds)
    assignments = ja || []
  }

  // Also check wo_job_assignments
  let woAssignments: any[] = []
  if (lineIds.length > 0) {
    const { data: wja } = await s.from('wo_job_assignments')
      .select('*, users:user_id(full_name, team)')
      .in('line_id', lineIds)
    woAssignments = wja || []
  }

  // Merge data
  const jobs = (lines || []).map((line: any) => {
    const wo = line.service_orders
    const ja = assignments.find((a: any) => a.so_line_id === line.id)
    const wja = woAssignments.find((a: any) => a.line_id === line.id)
    const mechanic = ja?.users || wja?.users || null
    return {
      id: line.id,
      assignment_id: ja?.id || wja?.id || null,
      description: line.description,
      status: ja?.status || line.line_status || 'pending',
      estimated_hours: line.estimated_hours,
      required_skills: line.required_skills || [],
      wo_id: wo?.id,
      wo_number: wo?.so_number,
      customer: wo?.customers?.company_name || '',
      unit_number: wo?.assets?.unit_number || '',
      unit_type: wo?.assets?.unit_type || 'tractor',
      mechanic_name: mechanic?.full_name || null,
      mechanic_team: mechanic?.team || null,
    }
  })

  return NextResponse.json(jobs)
}

export async function PATCH(req: Request) {
  const s = db()
  const { id, status, assignment_id } = await req.json()
  if (!id || !status) return NextResponse.json({ error: 'id and status required' }, { status: 400 })

  // Update job_assignments if exists
  if (assignment_id) {
    await s.from('job_assignments').update({ status, updated_at: new Date().toISOString() }).eq('id', assignment_id)
  }
  // Also update so_lines line_status
  const lineStatusMap: Record<string, string> = { pending: 'unassigned', accepted: 'in_progress', in_progress: 'in_progress', completed: 'completed' }
  await s.from('so_lines').update({ line_status: lineStatusMap[status] || status }).eq('id', id)

  return NextResponse.json({ ok: true })
}
