import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'
import { decodeVIN } from '@/lib/integrations/nhtsa'

export async function GET(req: Request) {
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('q')
  const status = searchParams.get('status')

  let q = supabase
    .from('assets')
    .select('id, unit_number, year, make, model, vin, odometer, engine, status, customer_id, customers(company_name)')
    .eq('shop_id', user.shop_id)
    .order('unit_number')

  if (status) q = q.eq('status', status)
  if (search) q = q.or(`unit_number.ilike.%${search}%,make.ilike.%${search}%,model.ilike.%${search}%,vin.ilike.%${search}%`)

  const { data, error } = await q.limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = ['owner','gm','it_person','shop_manager','fleet_manager','service_advisor','office_admin']
  if (!allowed.includes(user.role)) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const body = await req.json()
  let { unit_number, vin, year, make, model, engine, odometer, customer_id, status } = body

  if (!unit_number) return NextResponse.json({ error: 'Unit number required' }, { status: 400 })

  // Auto-decode VIN if provided and fields missing
  if (vin && (!year || !make || !model)) {
    const decoded = await decodeVIN(vin)
    if (decoded.valid) {
      year  = year  || decoded.year
      make  = make  || decoded.make
      model = model || decoded.model
      engine = engine || decoded.engine
    }
  }

  // Check unit number not already in use
  const { data: existing } = await supabase.from('assets').select('id').eq('shop_id', user.shop_id).eq('unit_number', unit_number.trim()).single()
  if (existing) return NextResponse.json({ error: `Unit #${unit_number} already exists` }, { status: 409 })

  const { data, error } = await supabase.from('assets').insert({
    shop_id:     user.shop_id,
    unit_number: unit_number.trim(),
    vin:         vin?.trim().toUpperCase() || null,
    year:        parseInt(year) || null,
    make:        make || null,
    model:       model || null,
    engine:      engine || null,
    odometer:    parseInt(odometer) || 0,
    customer_id: customer_id || null,
    status:      status || 'active',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
