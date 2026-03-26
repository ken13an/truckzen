import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, jsonError } from '@/lib/server-auth'

const ROLE_DEPARTMENT: Record<string, string> = {
  service_writer: 'service',
  service_manager: 'service',
  parts_manager: 'parts',
  parts_staff: 'parts',
  technician: 'floor',
  shop_manager: 'floor',
  floor_manager: 'floor',
  floor_supervisor: 'floor',
  accountant: 'accounting',
  accounting_manager: 'accounting',
  office_admin: 'accounting',
  maintenance_technician: 'maintenance',
  maintenance_manager: 'maintenance',
  fleet_manager: 'fleet',
  dispatcher: 'fleet',
  driver: 'drivers',
  owner: 'management',
  gm: 'management',
  it_person: 'management',
}

export async function GET(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  if (!actor.shop_id) return jsonError('No shop context', 400)

  const s = createAdminSupabaseClient()
  const { searchParams } = new URL(req.url)
  const department = searchParams.get('department') || ''
  const role = searchParams.get('role') || ''
  const status = searchParams.get('status') || ''
  const search = searchParams.get('search') || ''
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)))

  const { data: allUsers, error } = await s.from('users')
    .select('id, full_name, email, role, team, active, created_at, deleted_at, skills, department')
    .eq('shop_id', actor.shop_id)
    .is('deleted_at', null)
    .or('is_autobot.is.null,is_autobot.eq.false')
    .order('full_name')

  if (error) return jsonError(error.message, 500)
  if (!allUsers) return NextResponse.json({ members: [], total: 0, page: 1, pages: 0, department_counts: {} })

  const { data: { users: authUsers } } = await s.auth.admin.listUsers({ perPage: 1000 })
  const authMap: Record<string, string | null> = {}
  for (const au of authUsers || []) authMap[au.id] = au.last_sign_in_at || null

  const enriched = allUsers.map((u: any) => ({
    ...u,
    last_sign_in_at: authMap[u.id] || null,
    department: u.department || ROLE_DEPARTMENT[u.role] || 'other',
  }))

  const afterSearch = search
    ? enriched.filter((u: any) => {
        const q = search.toLowerCase()
        return u.full_name?.toLowerCase().includes(q) ||
               u.email?.toLowerCase().includes(q) ||
               u.role?.toLowerCase().includes(q)
      })
    : enriched

  const afterStatus = status
    ? afterSearch.filter((u: any) => {
        if (status === 'active') return u.active && u.last_sign_in_at
        if (status === 'pending') return u.active && !u.last_sign_in_at
        if (status === 'inactive') return !u.active
        return true
      })
    : afterSearch

  const deptCounts: Record<string, number> = {}
  for (const u of afterStatus) {
    const d = u.department
    deptCounts[d] = (deptCounts[d] || 0) + 1
  }

  const afterDept = department ? afterStatus.filter((u: any) => u.department === department) : afterStatus
  const filtered = role ? afterDept.filter((u: any) => u.role === role) : afterDept

  const total = filtered.length
  const pages = Math.ceil(total / limit)
  const offset = (page - 1) * limit
  const members = filtered.slice(offset, offset + limit)

  return NextResponse.json({ members, total, page, pages, department_counts: deptCounts })
}
