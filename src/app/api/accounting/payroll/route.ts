import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getActorShopId } from '@/lib/server-auth'
import { requireAuthenticatedUser } from '@/lib/route-guards'
import { ACCOUNTING_ROLES } from '@/lib/roles'
import { logAction } from '@/lib/services/auditLog'

const FULL_ACCESS_ROLES = ACCOUNTING_ROLES
const SHOP_MANAGER_ROLES = ['shop_manager', 'floor_manager', 'service_manager']
const PARTS_MANAGER_ROLES = ['parts_manager']
const TECH_ROLES = ['technician', 'lead_tech', 'maintenance_technician']
const PARTS_ROLES = ['parts_manager', 'parts_staff']

export async function GET() {
  const { actor: user, error } = await requireAuthenticatedUser()
  if (error || !user) return error

  const isFullAccess = FULL_ACCESS_ROLES.includes(user.role)
  const isShopManager = SHOP_MANAGER_ROLES.includes(user.role)
  const isPartsManager = PARTS_MANAGER_ROLES.includes(user.role)

  if (!isFullAccess && !isShopManager && !isPartsManager) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const shopId = getActorShopId(user)
  if (!shopId) return NextResponse.json({ error: 'shop context required' }, { status: 400 })

  const s = createAdminSupabaseClient()
  let usersQuery = s.from('users')
    .select('id, full_name, email, role, team, active')
    .eq('shop_id', shopId)
    .eq('active', true)
    .or('is_autobot.is.null,is_autobot.eq.false')
    .order('full_name')

  if (isShopManager) usersQuery = usersQuery.in('role', TECH_ROLES)
  else if (isPartsManager) usersQuery = usersQuery.in('role', PARTS_ROLES)

  const { data: users } = await usersQuery
  const { data: payroll } = await s.from('employee_payroll').select('*').eq('shop_id', shopId)

  // Fetch punch counts for the current week (Mon-Sun)
  const now = new Date()
  const dayOfWeek = now.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset)
  const weekStartISO = weekStart.toISOString()

  const userIds = (users || []).map((u: any) => u.id)

  // Workplace punches this week
  const { data: punches } = userIds.length > 0
    ? await s.from('work_punches').select('user_id, duration_minutes').in('user_id', userIds).eq('shop_id', shopId).gte('punch_in_at', weekStartISO).not('punch_out_at', 'is', null)
    : { data: [] }

  // Job-line time entries this week
  const { data: timeEntries } = userIds.length > 0
    ? await s.from('so_time_entries').select('user_id, duration_minutes').in('user_id', userIds).eq('shop_id', shopId).gte('clocked_in_at', weekStartISO).not('clocked_out_at', 'is', null)
    : { data: [] }

  // Aggregate per user
  const punchMap = new Map<string, { count: number; minutes: number }>()
  for (const p of punches || []) {
    const cur = punchMap.get(p.user_id) || { count: 0, minutes: 0 }
    cur.count++
    cur.minutes += p.duration_minutes || 0
    punchMap.set(p.user_id, cur)
  }

  const jobMap = new Map<string, { count: number; minutes: number }>()
  for (const t of timeEntries || []) {
    const cur = jobMap.get(t.user_id) || { count: 0, minutes: 0 }
    cur.count++
    cur.minutes += t.duration_minutes || 0
    jobMap.set(t.user_id, cur)
  }

  const payMap = new Map<string, any>()
  for (const p of payroll || []) payMap.set(p.user_id, p)

  return NextResponse.json((users || []).map((u) => ({
    ...u,
    payroll: payMap.get(u.id) || null,
    punchStats: punchMap.get(u.id) || { count: 0, minutes: 0 },
    jobStats: jobMap.get(u.id) || { count: 0, minutes: 0 },
  })))
}

export async function POST(req: Request) {
  const { actor: user, error } = await requireAuthenticatedUser()
  if (error || !user) return error
  if (!FULL_ACCESS_ROLES.includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const shopId = getActorShopId(user)
  if (!shopId) return NextResponse.json({ error: 'shop context required' }, { status: 400 })

  const body = await req.json().catch(() => null)
  const userId = typeof body?.user_id === 'string' ? body.user_id : ''
  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  const s = createAdminSupabaseClient()
  const { data: target } = await s.from('users').select('id').eq('id', userId).eq('shop_id', shopId).single()
  if (!target) return NextResponse.json({ error: 'User not found in your shop' }, { status: 404 })

  const { data, error: dbError } = await s.from('employee_payroll').upsert({
    shop_id: shopId,
    user_id: userId,
    pay_type: body?.pay_type || 'hourly',
    hourly_rate: parseFloat(body?.hourly_rate) || 0,
    salary_amount: parseFloat(body?.salary_amount) || 0,
    weekly_hours: parseFloat(body?.weekly_hours) || 40,
    effective_date: body?.effective_date || new Date().toISOString().split('T')[0],
    notes: body?.notes || null,
    active: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'shop_id,user_id' }).select().single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  logAction({ shop_id: shopId, user_id: user.id, action: 'payroll.updated', entity_type: 'employee_payroll', entity_id: userId }).catch(() => {})
  return NextResponse.json(data)
}
