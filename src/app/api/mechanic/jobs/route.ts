import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUserProfile, jsonError } from '@/lib/server-auth'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const userId = actor.id

  const s = db()

  // Canonical source: wo_job_assignments (written by supervisor assign UI)
  const { data: woAssigns } = await s.from('wo_job_assignments')
    .select('*, so_lines(id, description, line_status, estimated_hours, actual_hours, finding, resolution, required_skills, so_id)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

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
