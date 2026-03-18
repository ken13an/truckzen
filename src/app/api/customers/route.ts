import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'

export async function GET(req: Request) {
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('q')

  let q = supabase
    .from('customers')
    .select('id, company_name, contact_name, phone, email, address, city, state, payment_terms, created_at')
    .eq('shop_id', user.shop_id)
    .order('company_name')

  if (search) q = q.or(`company_name.ilike.%${search}%,contact_name.ilike.%${search}%,email.ilike.%${search}%`)

  const { data, error } = await q.limit(300)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = ['owner','gm','it_person','shop_manager','service_advisor','service_writer','office_admin']
  if (!allowed.includes(user.role)) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const body = await req.json()
  if (!body.company_name) return NextResponse.json({ error: 'Company name required' }, { status: 400 })

  const { data, error } = await supabase.from('customers').insert({
    shop_id:       user.shop_id,
    company_name:  body.company_name.trim(),
    contact_name:  body.contact_name || null,
    phone:         body.phone || null,
    email:         body.email?.toLowerCase() || null,
    address:       body.address || null,
    city:          body.city || null,
    state:         body.state || 'TX',
    zip:           body.zip || null,
    payment_terms: body.payment_terms || 'Net 30',
    notes:         body.notes || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
