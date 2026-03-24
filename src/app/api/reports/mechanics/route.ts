import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

const ALLOWED_ROLES = ['owner', 'gm', 'it_person', 'accountant', 'office_admin', 'accounting_manager', 'floor_manager', 'shop_manager']

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ALLOWED_ROLES.includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') || new Date(new Date().setDate(1)).toISOString().split('T')[0]
  const to = searchParams.get('to') || new Date().toISOString().split('T')[0]
  const mechId = searchParams.get('mechanic_id')

  const s = db()
  const shopId = user.shop_id

  // Get mechanics
  const { data: mechanics } = await s.from('users')
    .select('id, full_name, role, team')
    .eq('shop_id', shopId)
    .in('role', ['technician', 'lead_tech', 'maintenance_technician'])
    .eq('active', true)

  if (!mechanics || mechanics.length === 0) return NextResponse.json({ mechanics: [], summary: {} })

  // Get completed WOs in period assigned to these mechanics
  const mechIds = mechId ? [mechId] : mechanics.map(m => m.id)
  const { data: completedWOs } = await s.from('service_orders')
    .select('id, so_number, assigned_tech, complaint, grand_total, completed_at, created_at')
    .eq('shop_id', shopId)
    .in('assigned_tech', mechIds)
    .in('status', ['done', 'good_to_go'])
    .gte('completed_at', from + 'T00:00:00')
    .lte('completed_at', to + 'T23:59:59')
    .is('deleted_at', null)

  // Get time entries in period
  const { data: timeEntries } = await s.from('so_time_entries')
    .select('user_id, so_id, clocked_in_at, clocked_out_at, duration_minutes')
    .eq('shop_id', shopId)
    .in('user_id', mechIds)
    .gte('clocked_in_at', from + 'T00:00:00')
    .lte('clocked_in_at', to + 'T23:59:59')

  // Build per-mechanic stats
  const result = mechanics.map(mech => {
    const jobs = (completedWOs || []).filter(wo => wo.assigned_tech === mech.id)
    const hours = (timeEntries || []).filter(te => te.user_id === mech.id)
    const totalMinutes = hours.reduce((sum, te) => sum + (te.duration_minutes || 0), 0)
    const totalHours = Math.round(totalMinutes / 60 * 10) / 10
    const avgTimePerJob = jobs.length > 0 ? Math.round(totalMinutes / jobs.length) : 0
    const productivity = jobs.length > 0 && totalHours > 0 ? Math.min(100, Math.round((jobs.length / totalHours) * 25)) : 0

    return {
      id: mech.id,
      full_name: mech.full_name,
      role: mech.role,
      team: mech.team,
      jobs_completed: jobs.length,
      hours_logged: totalHours,
      avg_time_per_job_min: avgTimePerJob,
      productivity_score: productivity,
      jobs: mechId ? jobs : undefined,
    }
  })

  result.sort((a, b) => b.jobs_completed - a.jobs_completed)

  const totalJobs = result.reduce((s, m) => s + m.jobs_completed, 0)
  const totalHours = result.reduce((s, m) => s + m.hours_logged, 0)
  const avgProductivity = result.length > 0 ? Math.round(result.reduce((s, m) => s + m.productivity_score, 0) / result.length) : 0

  return NextResponse.json({
    mechanics: result,
    summary: { total_jobs: totalJobs, total_hours: totalHours, avg_productivity: avgProductivity, mechanic_count: result.length },
    period: { from, to },
  })
}
