import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

const FULL_ACCESS_ROLES = ['owner', 'gm', 'it_person', 'accountant', 'office_admin', 'accounting_manager']
const SHOP_MANAGER_ROLES = ['shop_manager', 'floor_manager', 'service_manager']
const PARTS_MANAGER_ROLES = ['parts_manager']

const TECH_ROLES = ['technician', 'lead_tech', 'maintenance_technician']
const PARTS_ROLES = ['parts_manager', 'parts_staff']

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isFullAccess = FULL_ACCESS_ROLES.includes(user.role)
  const isShopManager = SHOP_MANAGER_ROLES.includes(user.role)
  const isPartsManager = PARTS_MANAGER_ROLES.includes(user.role)

  if (!isFullAccess && !isShopManager && !isPartsManager) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const shopId = user.shop_id
  const s = db()

  let usersQuery = s.from('users')
    .select('id, full_name, email, role, team, active')
    .eq('shop_id', shopId)
    .eq('active', true)
    .or('is_autobot.is.null,is_autobot.eq.false')
    .order('full_name')

  if (isShopManager) {
    usersQuery = usersQuery.in('role', TECH_ROLES)
  } else if (isPartsManager) {
    usersQuery = usersQuery.in('role', PARTS_ROLES)
  }

  const { data: users } = await usersQuery

  const { data: payroll } = await s.from('employee_payroll')
    .select('*')
    .eq('shop_id', shopId)

  const payMap = new Map<string, any>()
  for (const p of payroll || []) payMap.set(p.user_id, p)

  const result = (users || []).map(u => ({
    ...u,
    payroll: payMap.get(u.id) || null,
  }))

  return NextResponse.json(result)
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!FULL_ACCESS_ROLES.includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const shopId = user.shop_id
  const s = db()
  const body = await req.json()
  const { user_id, pay_type, hourly_rate, salary_amount, weekly_hours, effective_date, notes } = body

  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  const { data, error } = await s.from('employee_payroll').upsert({
    shop_id: shopId,
    user_id,
    pay_type: pay_type || 'hourly',
    hourly_rate: parseFloat(hourly_rate) || 0,
    salary_amount: parseFloat(salary_amount) || 0,
    weekly_hours: parseFloat(weekly_hours) || 40,
    effective_date: effective_date || new Date().toISOString().split('T')[0],
    notes: notes || null,
    active: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'shop_id,user_id' }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
