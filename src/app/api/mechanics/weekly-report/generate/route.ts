import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/services/email'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

function getPreviousWeekRange() {
  const now = new Date()
  // Find previous Monday
  const day = now.getDay() // 0=Sun
  const diffToMon = day === 0 ? 6 : day - 1
  const thisMonday = new Date(now)
  thisMonday.setDate(now.getDate() - diffToMon)
  thisMonday.setHours(0, 0, 0, 0)

  const prevMonday = new Date(thisMonday)
  prevMonday.setDate(thisMonday.getDate() - 7)

  const prevSunday = new Date(prevMonday)
  prevSunday.setDate(prevMonday.getDate() + 6)
  prevSunday.setHours(23, 59, 59, 999)

  return {
    start: prevMonday.toISOString().split('T')[0],
    end: prevSunday.toISOString().split('T')[0],
    startISO: prevMonday.toISOString(),
    endISO: prevSunday.toISOString(),
  }
}

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const s = db()
  const body = await req.json().catch(() => ({}))
  const shopId = body.shop_id as string | undefined
  const { start, end, startISO, endISO } = getPreviousWeekRange()

  // Get mechanics
  let mechQuery = s.from('users')
    .select('id, full_name, email, shop_id')
    .in('role', ['mechanic', 'lead_mechanic', 'technician'])

  if (shopId) mechQuery = mechQuery.eq('shop_id', shopId)

  const { data: mechanics } = await mechQuery

  let reportsGenerated = 0

  for (const mech of mechanics || []) {
    // a. Sum hours from so_time_entries
    const { data: timeEntries } = await s
      .from('so_time_entries')
      .select('clocked_in_at, clocked_out_at')
      .eq('user_id', mech.id)
      .gte('clocked_in_at', startISO)
      .lte('clocked_in_at', endISO)

    let totalHours = 0
    for (const te of timeEntries || []) {
      if (!te.clocked_out_at) continue
      const diff = new Date(te.clocked_out_at).getTime() - new Date(te.clocked_in_at).getTime()
      totalHours += diff / 3600000
    }
    totalHours = Math.round(totalHours * 100) / 100

    // b. Count completed job_assignments
    const { count: completedJobs } = await s
      .from('job_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_to_user_id', mech.id)
      .eq('status', 'completed')
      .gte('updated_at', startISO)
      .lte('updated_at', endISO)

    // c. Count unplanned jobs
    const { count: unplannedJobs } = await s
      .from('mechanic_unplanned_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('mechanic_id', mech.id)
      .gte('created_at', startISO)
      .lte('created_at', endISO)

    // d. Sum idle minutes from idle alerts
    const { count: idleAlerts } = await s
      .from('mechanic_idle_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('mechanic_id', mech.id)
      .gte('created_at', startISO)
      .lte('created_at', endISO)

    // Each idle alert roughly represents 15 min idle window
    const idleMinutes = (idleAlerts || 0) * 15

    // e. Count parts requests
    const { count: partsRequests } = await s
      .from('parts_requests')
      .select('id', { count: 'exact', head: true })
      .eq('requested_by', mech.id)
      .gte('created_at', startISO)
      .lte('created_at', endISO)

    // f. Count overtime alerts
    const { count: overtimeAlerts } = await s
      .from('mechanic_overtime_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('mechanic_id', mech.id)
      .gte('created_at', startISO)
      .lte('created_at', endISO)

    // g. Performance score
    const jobCount = completedJobs || 0
    const idleCount = idleAlerts || 0
    const unplannedCount = unplannedJobs || 0
    const otCount = overtimeAlerts || 0

    let score = 70
    score += Math.min(jobCount, 15)  // +1 per job, max +15
    score += idleCount <= 2 ? 10 : 0 // +10 for low idle
    score += unplannedCount === 0 ? 5 : 0 // +5 for no unplanned
    score -= idleCount * 2           // -2 per idle alert
    score -= otCount * 1             // -1 per overtime alert
    score = Math.max(0, Math.min(100, score))

    const { error } = await s.from('mechanic_weekly_reports').insert({
      shop_id: mech.shop_id,
      mechanic_id: mech.id,
      week_start: start,
      week_end: end,
      total_hours: totalHours,
      completed_jobs: jobCount,
      unplanned_jobs: unplannedCount,
      idle_minutes: idleMinutes,
      idle_alerts: idleCount,
      parts_requests: partsRequests || 0,
      overtime_alerts: otCount,
      performance_score: score,
    })

    if (error) continue

    // Send email to mechanic
    if (mech.email) {
      await sendEmail(
        mech.email,
        `Weekly Performance Report — ${start} to ${end}`,
        `<h2>Weekly Report for ${mech.full_name}</h2>
        <p><strong>Week:</strong> ${start} to ${end}</p>
        <table style="border-collapse:collapse;width:100%">
          <tr><td style="padding:4px 8px;border:1px solid #ddd">Total Hours</td><td style="padding:4px 8px;border:1px solid #ddd">${totalHours}h</td></tr>
          <tr><td style="padding:4px 8px;border:1px solid #ddd">Completed Jobs</td><td style="padding:4px 8px;border:1px solid #ddd">${jobCount}</td></tr>
          <tr><td style="padding:4px 8px;border:1px solid #ddd">Unplanned Jobs</td><td style="padding:4px 8px;border:1px solid #ddd">${unplannedCount}</td></tr>
          <tr><td style="padding:4px 8px;border:1px solid #ddd">Idle Alerts</td><td style="padding:4px 8px;border:1px solid #ddd">${idleCount}</td></tr>
          <tr><td style="padding:4px 8px;border:1px solid #ddd">Overtime Alerts</td><td style="padding:4px 8px;border:1px solid #ddd">${otCount}</td></tr>
          <tr><td style="padding:4px 8px;border:1px solid #ddd">Parts Requests</td><td style="padding:4px 8px;border:1px solid #ddd">${partsRequests || 0}</td></tr>
          <tr><td style="padding:4px 8px;border:1px solid #ddd"><strong>Performance Score</strong></td><td style="padding:4px 8px;border:1px solid #ddd"><strong>${score}/100</strong></td></tr>
        </table>`
      )
    }

    reportsGenerated++
  }

  return NextResponse.json({ reports_generated: reportsGenerated })
}
