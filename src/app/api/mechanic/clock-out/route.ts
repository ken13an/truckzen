import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logAction } from '@/lib/services/auditLog'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function POST(req: Request) {
  const s = db()
  const { time_entry_id, user_id, notes } = await req.json()

  if (!time_entry_id) {
    return NextResponse.json({ error: 'time_entry_id required' }, { status: 400 })
  }

  // Get the entry
  const { data: entry } = await s.from('so_time_entries')
    .select('id, clocked_in_at, so_line_id')
    .eq('id', time_entry_id)
    .is('clocked_out_at', null)
    .single()

  if (!entry) {
    return NextResponse.json({ error: 'No active clock found' }, { status: 404 })
  }

  const now = new Date()
  const clockIn = new Date(entry.clocked_in_at)
  const durationMinutes = Math.round((now.getTime() - clockIn.getTime()) / 60000)

  const update: any = {
    clocked_out_at: now.toISOString(),
    duration_minutes: durationMinutes,
  }
  if (notes) update.notes = notes

  const { error } = await s.from('so_time_entries')
    .update(update)
    .eq('id', time_entry_id)

  if (error) {
    console.error('[Clock Out] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Get total hours on this job line
  const { data: totals } = await s.from('so_time_entries')
    .select('duration_minutes')
    .eq('so_line_id', entry.so_line_id)
    .not('duration_minutes', 'is', null)

  const totalMinutes = (totals || []).reduce((sum: number, t: any) => sum + (t.duration_minutes || 0), 0)

  // Fire and forget
  logAction({ shop_id: '', user_id: user_id || '', action: 'time.clock_out', entity_type: 'time_entry', entity_id: time_entry_id, details: { duration_minutes: durationMinutes } }).catch(() => {})

  return NextResponse.json({
    duration_minutes: durationMinutes,
    total_minutes_on_job: totalMinutes,
    total_hours_on_job: +(totalMinutes / 60).toFixed(2),
  })
}
