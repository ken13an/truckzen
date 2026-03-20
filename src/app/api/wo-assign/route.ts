import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(req: Request) {
  const s = db()
  const body = await req.json()
  const { line_id, tech_id, user_id, wo_id } = body

  if (!line_id || !wo_id)
    return NextResponse.json({ error: 'line_id and wo_id required' }, { status: 400 })

  // Update the so_line assignment
  const newStatus = tech_id ? 'in_progress' : 'unassigned'
  const { data, error } = await s
    .from('so_lines')
    .update({ assigned_to: tech_id || null, line_status: newStatus })
    .eq('id', line_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Build activity log message
  let actionText: string
  if (tech_id) {
    const { data: tech } = await s.from('users').select('full_name').eq('id', tech_id).single()
    actionText = `Assigned job to ${tech?.full_name || 'Unknown'}`
  } else {
    actionText = 'Unassigned job'
  }

  await s.from('wo_activity_log').insert({
    wo_id,
    user_id: user_id || null,
    action: actionText,
  })

  return NextResponse.json(data)
}
