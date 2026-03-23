import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushToUser } from '@/lib/services/notifications'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const s = db()
  const now = new Date()
  let idleAlerts = 0
  let overtimeAlerts = 0

  // --- Idle check ---
  // Find all mechanics currently clocked in
  const { data: clockedIn } = await s
    .from('so_time_entries')
    .select('id, user_id, shop_id, clocked_in_at')
    .is('clocked_out_at', null)

  for (const entry of clockedIn || []) {
    const clockedInAt = new Date(entry.clocked_in_at)
    const minutesSinceClock = (now.getTime() - clockedInAt.getTime()) / 60000

    if (minutesSinceClock <= 15) continue

    // Check if they have active job assignments
    const { data: activeJobs } = await s
      .from('job_assignments')
      .select('id')
      .eq('assigned_to_user_id', entry.user_id)
      .in('status', ['accepted', 'in_progress'])
      .limit(1)

    if (activeJobs && activeJobs.length > 0) continue

    // Check if we already alerted for this mechanic in last 2 hours
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()
    const { data: recentAlert } = await s
      .from('mechanic_idle_alerts')
      .select('id')
      .eq('mechanic_id', entry.user_id)
      .gte('created_at', twoHoursAgo)
      .limit(1)

    if (recentAlert && recentAlert.length > 0) continue

    // Insert idle alert
    await s.from('mechanic_idle_alerts').insert({
      shop_id: entry.shop_id,
      mechanic_id: entry.user_id,
    })

    await sendPushToUser(
      entry.user_id,
      'Idle Alert',
      'You have been clocked in for over 15 minutes with no active jobs.'
    )

    idleAlerts++
  }

  // --- Overtime check ---
  // Find in-progress lines with estimated hours
  const { data: inProgressLines } = await s
    .from('so_lines')
    .select('id, estimated_hours, so_id')
    .eq('line_status', 'in_progress')
    .gt('estimated_hours', 0)

  for (const line of inProgressLines || []) {
    // Find the active time entry for this line
    const { data: timeEntry } = await s
      .from('so_time_entries')
      .select('id, user_id, clocked_in_at, shop_id')
      .eq('so_line_id', line.id)
      .is('clocked_out_at', null)
      .limit(1)
      .maybeSingle()

    if (!timeEntry) continue

    const clockedInAt = new Date(timeEntry.clocked_in_at)
    const elapsedHours = (now.getTime() - clockedInAt.getTime()) / 3600000

    if (elapsedHours <= line.estimated_hours) continue

    // Check if we already have an overtime alert for this line
    const { data: existingOT } = await s
      .from('mechanic_overtime_alerts')
      .select('id')
      .eq('so_line_id', line.id)
      .limit(1)

    if (existingOT && existingOT.length > 0) continue

    await s.from('mechanic_overtime_alerts').insert({
      shop_id: timeEntry.shop_id,
      mechanic_id: timeEntry.user_id,
      so_line_id: line.id,
      estimated_hours: line.estimated_hours,
      elapsed_hours: Math.round(elapsedHours * 100) / 100,
    })

    await sendPushToUser(
      timeEntry.user_id,
      'Overtime Alert',
      `Job has exceeded estimated ${line.estimated_hours}h (elapsed: ${elapsedHours.toFixed(1)}h).`
    )

    overtimeAlerts++
  }

  return NextResponse.json({ idle_alerts: idleAlerts, overtime_alerts: overtimeAlerts })
}
