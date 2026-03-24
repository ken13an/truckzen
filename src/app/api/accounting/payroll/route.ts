import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  // Get all active users with their payroll records
  const { data: users } = await s.from('users')
    .select('id, full_name, email, role, team, active')
    .eq('shop_id', shopId)
    .eq('active', true)
    .order('full_name')

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
  const s = db()
  const body = await req.json()
  const { shop_id, user_id, pay_type, hourly_rate, salary_amount, weekly_hours, effective_date, notes } = body

  if (!shop_id || !user_id) return NextResponse.json({ error: 'shop_id and user_id required' }, { status: 400 })

  const { data, error } = await s.from('employee_payroll').upsert({
    shop_id,
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
