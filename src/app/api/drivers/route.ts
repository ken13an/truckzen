import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'

export async function GET(req: Request) {
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('q')

  let q = supabase
    .from('drivers')
    .select('id, full_name, phone, email, cdl_number, cdl_class, cdl_expiry, medical_card_expiry, status, customer_id, customers(company_name), created_at')
    .eq('shop_id', user.shop_id)
    .order('full_name')

  if (search) q = q.or(`full_name.ilike.%${search}%,cdl_number.ilike.%${search}%`)

  const { data, error } = await q.limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = ['owner','gm','it_person','shop_manager','fleet_manager','office_admin']
  if (!allowed.includes(user.role)) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const body = await req.json()
  if (!body.full_name) return NextResponse.json({ error: 'full_name required' }, { status: 400 })

  const { data, error } = await supabase.from('drivers').insert({
    shop_id:             user.shop_id,
    full_name:           body.full_name.trim(),
    phone:               body.phone         || null,
    email:               body.email?.toLowerCase() || null,
    cdl_number:          body.cdl_number    || null,
    cdl_class:           body.cdl_class     || null,
    cdl_expiry:          body.cdl_expiry    || null,
    medical_card_expiry: body.medical_card_expiry || null,
    customer_id:         body.customer_id   || null,
    status:              'active',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
