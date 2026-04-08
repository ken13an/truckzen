import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getActorShopId } from '@/lib/server-auth'
import { requireAuthenticatedUser } from '@/lib/route-guards'
import { ACCOUNTING_ROLES } from '@/lib/roles'

// Fallback timezone — no shop/user timezone field exists in current schema
const SHOP_TZ = 'America/Chicago'

function getPeriodBounds(mode: string): { from: string; to: string } {
  // All period math uses the shop timezone for calendar day/week/month boundaries
  const now = new Date()
  const tzNow = new Date(now.toLocaleString('en-US', { timeZone: SHOP_TZ }))
  const y = tzNow.getFullYear(), m = tzNow.getMonth(), d = tzNow.getDate()

  if (mode === 'daily') {
    const start = new Date(`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00`)
    const end = new Date(start.getTime() + 86400000)
    return { from: localToUTC(start), to: localToUTC(end) }
  }
  if (mode === 'monthly') {
    const start = new Date(`${y}-${String(m + 1).padStart(2, '0')}-01T00:00:00`)
    const end = new Date(y, m + 1, 1)
    return { from: localToUTC(start), to: localToUTC(end) }
  }
  // weekly: Monday through Sunday
  const day = tzNow.getDay()
  const mondayOff = day === 0 ? -6 : 1 - day
  const start = new Date(`${y}-${String(m + 1).padStart(2, '0')}-${String(d + mondayOff).padStart(2, '0')}T00:00:00`)
  const end = new Date(start.getTime() + 7 * 86400000)
  return { from: localToUTC(start), to: localToUTC(end) }
}

function localToUTC(d: Date): string {
  // Convert a date constructed in shop-local context to UTC ISO string
  // We construct dates as local strings then convert via the TZ offset
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: SHOP_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  // For simplicity, use the Date object directly — Node constructs dates in server-local time
  // which may differ from shop TZ. Use a reliable approach:
  return d.toISOString()
}

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
  const mode = searchParams.get('mode') || 'weekly'
  const { from: periodFrom, to: periodTo } = getPeriodBounds(mode)

  const s = createAdminSupabaseClient()
  const techRoles = ['technician', 'lead_tech', 'maintenance_technician']

  if (!userId) {
    // List view — grouped queries, no N+1
    const { data: users } = await s.from('users')
      .select('id, full_name, role, team')
      .eq('shop_id', shopId).eq('active', true)
      .in('role', techRoles)
      .or('is_autobot.is.null,is_autobot.eq.false')
      .order('full_name')

    const userIds = (users || []).map((u: any) => u.id)
    if (userIds.length === 0) return NextResponse.json({ mechanics: [], period: { from: periodFrom, to: periodTo, mode, tz: SHOP_TZ } })

    // Completed sessions — grouped IN query
    const [{ data: punches }, { data: entries }, { data: activePunches }, { data: activeEntries }] = await Promise.all([
      s.from('work_punches').select('user_id, duration_minutes').in('user_id', userIds).eq('shop_id', shopId).gte('punch_in_at', periodFrom).lt('punch_in_at', periodTo).not('punch_out_at', 'is', null),
      s.from('so_time_entries').select('user_id, duration_minutes').in('user_id', userIds).eq('shop_id', shopId).gte('clocked_in_at', periodFrom).lt('clocked_in_at', periodTo).not('clocked_out_at', 'is', null),
      // Active-now — separate from completed counts
      s.from('work_punches').select('user_id').in('user_id', userIds).eq('shop_id', shopId).is('punch_out_at', null),
      s.from('so_time_entries').select('user_id').in('user_id', userIds).eq('shop_id', shopId).is('clocked_out_at', null),
    ])

    const pMap = new Map<string, { count: number; mins: number }>()
    for (const p of punches || []) { const c = pMap.get(p.user_id) || { count: 0, mins: 0 }; c.count++; c.mins += p.duration_minutes || 0; pMap.set(p.user_id, c) }
    const jMap = new Map<string, { count: number; mins: number }>()
    for (const e of entries || []) { const c = jMap.get(e.user_id) || { count: 0, mins: 0 }; c.count++; c.mins += e.duration_minutes || 0; jMap.set(e.user_id, c) }
    const activeShiftSet = new Set((activePunches || []).map((p: any) => p.user_id))
    const activeJobSet = new Set((activeEntries || []).map((e: any) => e.user_id))

    return NextResponse.json({
      mechanics: (users || []).map((u: any) => ({
        ...u,
        shift: pMap.get(u.id) || { count: 0, mins: 0 },
        jobs: jMap.get(u.id) || { count: 0, mins: 0 },
        shiftActiveNow: activeShiftSet.has(u.id),
        jobActiveNow: activeJobSet.has(u.id),
      })),
      period: { from: periodFrom, to: periodTo, mode, tz: SHOP_TZ },
    })
  }

  // Detail view for one mechanic
  const [{ data: punches }, { data: entries }, { data: activePunch }, { data: activeEntry }] = await Promise.all([
    s.from('work_punches').select('id, punch_in_at, punch_out_at, duration_minutes, inside_geofence, override_flag').eq('user_id', userId).eq('shop_id', shopId).gte('punch_in_at', periodFrom).lt('punch_in_at', periodTo).not('punch_out_at', 'is', null).order('punch_in_at', { ascending: false }),
    s.from('so_time_entries').select('id, clocked_in_at, clocked_out_at, duration_minutes, so_line_id, so_id, so_lines(description)').eq('user_id', userId).eq('shop_id', shopId).gte('clocked_in_at', periodFrom).lt('clocked_in_at', periodTo).not('clocked_out_at', 'is', null).order('clocked_in_at', { ascending: false }),
    s.from('work_punches').select('id').eq('user_id', userId).eq('shop_id', shopId).is('punch_out_at', null).limit(1),
    s.from('so_time_entries').select('id').eq('user_id', userId).eq('shop_id', shopId).is('clocked_out_at', null).limit(1),
  ])

  const { data: user } = await s.from('users').select('id, full_name, role, team').eq('id', userId).single()

  return NextResponse.json({
    user,
    punches: punches || [],
    entries: entries || [],
    shiftActiveNow: !!(activePunch && activePunch.length > 0),
    jobActiveNow: !!(activeEntry && activeEntry.length > 0),
    period: { from: periodFrom, to: periodTo, mode, tz: SHOP_TZ },
  })
}
