import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'

export async function GET(req: Request) {
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const assetId  = searchParams.get('asset_id')
  const overdue  = searchParams.get('overdue') === 'true'
  const today    = new Date().toISOString().split('T')[0]
  const upcoming = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

  let q = supabase
    .from('pm_schedules')
    .select('*, assets(id, unit_number, year, make, model, odometer, customers(company_name))')
    .eq('shop_id', user.shop_id)
    .eq('active', true)
    .order('next_due_date')

  if (assetId) q = q.eq('asset_id', assetId)
  if (overdue) q = q.lt('next_due_date', today)

  const { data, error } = await q.limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = ['owner','gm','it_person','shop_manager','fleet_manager','maintenance_manager','office_admin']
  if (!allowed.includes(user.role)) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const body = await req.json()
  if (!body.asset_id || !body.service_name) return NextResponse.json({ error: 'asset_id and service_name required' }, { status: 400 })

  const { data, error } = await supabase.from('pm_schedules').insert({
    shop_id:          user.shop_id,
    asset_id:         body.asset_id,
    service_name:     body.service_name.trim(),
    interval_miles:   body.interval_miles  || null,
    interval_days:    body.interval_days   || null,
    next_due_date:    body.next_due_date   || null,
    next_due_reading: body.next_due_reading|| null,
    notes:            body.notes          || null,
    active:           true,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
