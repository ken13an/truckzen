import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')
  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  // Get jobs assigned to this mechanic via job_assignments
  const { data: assignments } = await s.from('job_assignments')
    .select('*, so_lines(id, description, line_status, estimated_hours, actual_hours, finding, resolution, required_skills, so_id)')
    .eq('assigned_to_user_id', userId)
    .order('created_at', { ascending: false })

  if (!assignments || assignments.length === 0) {
    // Also check wo_job_assignments (the other assignment table)
    const { data: woAssigns } = await s.from('wo_job_assignments')
      .select('*, so_lines(id, description, line_status, estimated_hours, actual_hours, finding, resolution, required_skills, so_id)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    // Get WO details for each
    const jobs = []
    for (const a of woAssigns || []) {
      if (!a.so_lines) continue
      const { data: wo } = await s.from('service_orders')
        .select('id, so_number, status, customers(company_name), assets(unit_number, unit_type)')
        .eq('id', a.so_lines.so_id)
        .single()
      jobs.push({ ...a, wo, line: a.so_lines })
    }
    return NextResponse.json(jobs)
  }

  // Get WO details for each assignment
  const jobs = []
  for (const a of assignments) {
    if (!a.so_lines) continue
    const { data: wo } = await s.from('service_orders')
      .select('id, so_number, status, customers(company_name), assets(unit_number, unit_type)')
      .eq('id', a.so_lines.so_id)
      .single()
    jobs.push({ ...a, wo, line: a.so_lines })
  }

  return NextResponse.json(jobs)
}
