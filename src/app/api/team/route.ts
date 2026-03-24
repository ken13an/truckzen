import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

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
  const s = db()
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const department = searchParams.get('department') || ''
  const role = searchParams.get('role') || ''
  const status = searchParams.get('status') || ''
  const search = searchParams.get('search') || ''
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = parseInt(searchParams.get('limit') || '25', 10)

  // Fetch all users for the shop (we need all for department counts)
  const { data: allUsers, error } = await s.from('users')
    .select('id, full_name, email, role, team, active, created_at, deleted_at, skills, department')
    .eq('shop_id', shopId)
    .is('deleted_at', null)
    .order('full_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!allUsers) return NextResponse.json({ members: [], total: 0, page: 1, pages: 0, department_counts: {} })

  // Enrich with last_sign_in_at from auth
  const { data: { users: authUsers } } = await s.auth.admin.listUsers({ perPage: 1000 })
  const authMap: Record<string, string | null> = {}
  for (const au of authUsers || []) { authMap[au.id] = au.last_sign_in_at || null }

  // Assign department based on role if not set
  const enriched = allUsers.map(u => ({
    ...u,
    last_sign_in_at: authMap[u.id] || null,
    department: u.department || ROLE_DEPARTMENT[u.role] || 'other',
  }))

  // Compute department counts (before search/status filter, but we apply search for accuracy)
  const afterSearch = search
    ? enriched.filter(u => {
        const q = search.toLowerCase()
        return u.full_name?.toLowerCase().includes(q) ||
               u.email?.toLowerCase().includes(q) ||
               u.role?.toLowerCase().includes(q)
      })
    : enriched

  const afterStatus = status
    ? afterSearch.filter(u => {
        if (status === 'active') return u.active && u.last_sign_in_at
        if (status === 'pending') return u.active && !u.last_sign_in_at
        if (status === 'inactive') return !u.active
        return true
      })
    : afterSearch

  // Department counts (after search + status filters, before department filter)
  const deptCounts: Record<string, number> = {}
  for (const u of afterStatus) {
    const d = u.department
    deptCounts[d] = (deptCounts[d] || 0) + 1
  }

  // Apply department filter
  const afterDept = department
    ? afterStatus.filter(u => u.department === department)
    : afterStatus

  // Apply role filter
  const filtered = role
    ? afterDept.filter(u => u.role === role)
    : afterDept

  // Paginate
  const total = filtered.length
  const pages = Math.ceil(total / limit)
  const offset = (page - 1) * limit
  const members = filtered.slice(offset, offset + limit)

  return NextResponse.json({
    members,
    total,
    page,
    pages,
    department_counts: deptCounts,
  })
}
