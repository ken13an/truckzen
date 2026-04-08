import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getActorShopId } from '@/lib/server-auth'
import { requireAuthenticatedUser } from '@/lib/route-guards'
import { ACCOUNTING_ROLES } from '@/lib/roles'

export async function GET(req: Request) {
  const { actor, error } = await requireAuthenticatedUser()
  if (error || !actor) return error
  const effectiveRole = actor.impersonate_role || actor.role
  if (!ACCOUNTING_ROLES.includes(effectiveRole) && !(actor.is_platform_owner && !actor.impersonate_role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const shopId = getActorShopId(actor)
  if (!shopId) return NextResponse.json({ error: 'shop context required' }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const s = createAdminSupabaseClient()

  // If no user_id, return mechanic list with weekly totals
  if (!userId) {
    const techRoles = ['technician', 'lead_tech', 'maintenance_technician']
    const { data: users } = await s.from('users')
      .select('id, full_name, role, team, active')
      .eq('shop_id', shopId).eq('active', true)
      .in('role', techRoles)
      .or('is_autobot.is.null,is_autobot.eq.false')
      .order('full_name')

    const userIds = (users || []).map((u: any) => u.id)
    if (userIds.length === 0) return NextResponse.json({ mechanics: [], period: { from, to } })

    // Current week default
    const now = new Date()
    const dayOfWeek = now.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset)
    const periodFrom = from || weekStart.toISOString()
    const periodTo = to || new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()

    const [{ data: punches }, { data: entries }] = await Promise.all([
      s.from('work_punches').select('user_id, duration_minutes').in('user_id', userIds).eq('shop_id', shopId).gte('punch_in_at', periodFrom).lte('punch_in_at', periodTo).not('punch_out_at', 'is', null),
      s.from('so_time_entries').select('user_id, duration_minutes').in('user_id', userIds).eq('shop_id', shopId).gte('clocked_in_at', periodFrom).lte('clocked_in_at', periodTo).not('clocked_out_at', 'is', null),
    ])

    const pMap = new Map<string, { count: number; mins: number }>()
    for (const p of punches || []) { const c = pMap.get(p.user_id) || { count: 0, mins: 0 }; c.count++; c.mins += p.duration_minutes || 0; pMap.set(p.user_id, c) }
    const jMap = new Map<string, { count: number; mins: number }>()
    for (const e of entries || []) { const c = jMap.get(e.user_id) || { count: 0, mins: 0 }; c.count++; c.mins += e.duration_minutes || 0; jMap.set(e.user_id, c) }

    return NextResponse.json({
      mechanics: (users || []).map((u: any) => ({
        ...u,
        shift: pMap.get(u.id) || { count: 0, mins: 0 },
        jobs: jMap.get(u.id) || { count: 0, mins: 0 },
      })),
      period: { from: periodFrom, to: periodTo },
    })
  }

  // Detail view for one mechanic
  const periodFrom = from || new Date(Date.now() - 7 * 86400000).toISOString()
  const periodTo = to || new Date(Date.now() + 86400000).toISOString()

  const [{ data: punches }, { data: entries }] = await Promise.all([
    s.from('work_punches').select('id, punch_in_at, punch_out_at, duration_minutes, inside_geofence, override_flag').eq('user_id', userId).eq('shop_id', shopId).gte('punch_in_at', periodFrom).lte('punch_in_at', periodTo).not('punch_out_at', 'is', null).order('punch_in_at', { ascending: false }),
    s.from('so_time_entries').select('id, clocked_in_at, clocked_out_at, duration_minutes, so_line_id, so_id, so_lines(description)').eq('user_id', userId).eq('shop_id', shopId).gte('clocked_in_at', periodFrom).lte('clocked_in_at', periodTo).not('clocked_out_at', 'is', null).order('clocked_in_at', { ascending: false }),
  ])

  const { data: user } = await s.from('users').select('id, full_name, role, team').eq('id', userId).single()

  return NextResponse.json({ user, punches: punches || [], entries: entries || [], period: { from: periodFrom, to: periodTo } })
}
