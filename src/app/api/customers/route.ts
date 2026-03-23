import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  const search = searchParams.get('q')
  const page = parseInt(searchParams.get('page') || '1')
  const perPage = Math.min(parseInt(searchParams.get('per_page') || '50'), 2000)

  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  // Get total count
  let countQ = s.from('customers').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).is('deleted_at', null)
  if (search) {
    const pattern = search.length === 1 ? `${search}%` : `%${search}%`
    countQ = countQ.or(`company_name.ilike.${pattern},contact_name.ilike.${pattern}`)
  }
  const { count: total } = await countQ

  // Get page data
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  let q = s.from('customers')
    .select('id, company_name, contact_name, phone, email, address, notes, source, visit_count, total_spent, created_at, dot_number, mc_number, payment_terms, customer_status, portal_token, internal_tags')
    .eq('shop_id', shopId)
    .is('deleted_at', null)
    .order('company_name')
    .range(from, to)

  if (search) {
    const pattern = search.length === 1 ? `${search}%` : `%${search}%`
    q = q.or(`company_name.ilike.${pattern},contact_name.ilike.${pattern}`)
  }

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    data: data || [],
    total: total || 0,
    page,
    per_page: perPage,
    total_pages: Math.ceil((total || 0) / perPage),
  })
}

export async function POST(req: Request) {
  const s = db()
  const body = await req.json()

  if (!body.shop_id) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })
  if (!body.company_name) return NextResponse.json({ error: 'Company name required' }, { status: 400 })

  const { data, error } = await s.from('customers').insert({
    shop_id: body.shop_id,
    company_name: body.company_name.trim(),
    contact_name: body.contact_name || null,
    phone: body.phone || null,
    email: body.email?.toLowerCase() || null,
    address: body.address || null,
    notes: body.notes || null,
    source: body.source || 'walk_in',
    payment_terms: body.payment_terms || null,
    default_ownership_type: body.default_ownership_type || 'fleet_asset',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
