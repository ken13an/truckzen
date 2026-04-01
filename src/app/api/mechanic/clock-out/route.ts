import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUserProfile, jsonError } from '@/lib/server-auth'
import { logAction } from '@/lib/services/auditLog'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)

  const s = db()
  const { time_entry_id, notes } = await req.json()
  if (!time_entry_id) return NextResponse.json({ error: 'time_entry_id required' }, { status: 400 })

  // Verify entry belongs to this user
  const { data: entry } = await s.from('so_time_entries')
    .select('id, clocked_in_at, so_id, user_id')
    .eq('id', time_entry_id)
    .eq('user_id', actor.id)
    .is('clocked_out_at', null)
    .single()

  if (!entry) return NextResponse.json({ error: 'No active clock found' }, { status: 404 })

  const now = new Date()
  const durationMinutes = Math.round((now.getTime() - new Date(entry.clocked_in_at).getTime()) / 60000)

  const update: any = { clocked_out_at: now.toISOString(), duration_minutes: durationMinutes }
  if (notes) update.notes = notes

  await s.from('so_time_entries').update(update).eq('id', time_entry_id)

  // Total: exclude current entry + add manually (avoids race)
  const { data: otherEntries } = await s.from('so_time_entries')
    .select('duration_minutes')
    .eq('so_id', entry.so_id)
    .eq('user_id', actor.id)
    .not('duration_minutes', 'is', null)
    .neq('id', time_entry_id)

  const priorMinutes = (otherEntries || []).reduce((sum: number, t: any) => sum + (t.duration_minutes || 0), 0)
  const totalMinutes = priorMinutes + durationMinutes

  logAction({ shop_id: actor.shop_id || '', user_id: actor.id, action: 'time.clock_out', entity_type: 'time_entry', entity_id: time_entry_id, details: { duration_minutes: durationMinutes } }).catch(() => {})

  return NextResponse.json({
    duration_minutes: durationMinutes,
    total_minutes_on_job: totalMinutes,
    total_hours_on_job: +(totalMinutes / 60).toFixed(2),
  })
}
