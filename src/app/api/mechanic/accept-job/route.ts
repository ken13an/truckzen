import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function POST(req: Request) {
  const s = db()
  const { assignment_id, action, user_id } = await req.json()
  if (!assignment_id || !action) return NextResponse.json({ error: 'assignment_id and action required' }, { status: 400 })

  const now = new Date().toISOString()
  if (action === 'accept') {
    await s.from('job_assignments').update({ status: 'accepted', accepted_at: now, updated_at: now }).eq('id', assignment_id)
    // Also update so_lines status
    const { data: a } = await s.from('job_assignments').select('so_line_id').eq('id', assignment_id).single()
    if (a) await s.from('so_lines').update({ line_status: 'in_progress' }).eq('id', a.so_line_id)
  } else if (action === 'decline') {
    await s.from('job_assignments').update({ status: 'declined', updated_at: now }).eq('id', assignment_id)
  } else if (action === 'complete') {
    await s.from('job_assignments').update({ status: 'completed', completed_at: now, updated_at: now }).eq('id', assignment_id)
    const { data: a } = await s.from('job_assignments').select('so_line_id').eq('id', assignment_id).single()
    if (a) await s.from('so_lines').update({ line_status: 'completed' }).eq('id', a.so_line_id)
  }

  return NextResponse.json({ ok: true })
}
