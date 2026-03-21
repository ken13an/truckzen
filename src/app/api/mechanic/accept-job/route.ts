import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function POST(req: Request) {
  const s = db()
  const { assignment_id, action, user_id, reason } = await req.json()
  if (!assignment_id || !action) return NextResponse.json({ error: 'assignment_id and action required' }, { status: 400 })

  const now = new Date().toISOString()

  // Get assignment + WO info for activity logging
  const { data: assign } = await s.from('job_assignments').select('so_line_id, so_lines(so_id, description)').eq('id', assignment_id).single()
  const woId = (assign?.so_lines as any)?.so_id

  if (action === 'accept') {
    await s.from('job_assignments').update({ status: 'accepted', accepted_at: now, updated_at: now }).eq('id', assignment_id)
    if (assign?.so_line_id) await s.from('so_lines').update({ line_status: 'in_progress' }).eq('id', assign.so_line_id)
    if (woId && user_id) await s.from('wo_activity_log').insert({ wo_id: woId, user_id, action: `Mechanic accepted job: ${(assign?.so_lines as any)?.description?.slice(0, 50) || ''}` })
  } else if (action === 'decline') {
    await s.from('job_assignments').update({ status: 'declined', declined_at: now, decline_reason: reason || null, updated_at: now }).eq('id', assignment_id)
    if (woId && user_id) await s.from('wo_activity_log').insert({ wo_id: woId, user_id, action: `Mechanic declined job${reason ? ': ' + reason : ''}` })
  } else if (action === 'complete') {
    await s.from('job_assignments').update({ status: 'completed', completed_at: now, updated_at: now }).eq('id', assignment_id)
    if (assign?.so_line_id) await s.from('so_lines').update({ line_status: 'completed' }).eq('id', assign.so_line_id)
    if (woId && user_id) await s.from('wo_activity_log').insert({ wo_id: woId, user_id, action: `Mechanic completed job: ${(assign?.so_lines as any)?.description?.slice(0, 50) || ''}` })
  } else if (action === 'start') {
    await s.from('job_assignments').update({ status: 'in_progress', updated_at: now }).eq('id', assignment_id)
    if (assign?.so_line_id) await s.from('so_lines').update({ line_status: 'in_progress' }).eq('id', assign.so_line_id)
    if (woId && user_id) await s.from('wo_activity_log').insert({ wo_id: woId, user_id, action: 'Mechanic started work on job' })
  }

  return NextResponse.json({ ok: true })
}
