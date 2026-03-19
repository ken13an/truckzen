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

  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  let q = s
    .from('customers')
    .select('id, company_name, contact_name, phone, email, address, notes, source, visit_count, total_spent, created_at')
    .eq('shop_id', shopId)
    .order('company_name')

  if (search) q = q.or(`company_name.ilike.%${search}%,contact_name.ilike.%${search}%,email.ilike.%${search}%`)

  const { data, error } = await q.limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const s = db()
  const body = await req.json()

  if (!body.shop_id) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })
  if (!body.company_name) return NextResponse.json({ error: 'Company name required' }, { status: 400 })

  const { data, error } = await s.from('customers').insert({
    shop_id:       body.shop_id,
    company_name:  body.company_name.trim(),
    contact_name:  body.contact_name || null,
    phone:         body.phone || null,
    email:         body.email?.toLowerCase() || null,
    address:       body.address || null,
    notes:         body.notes || null,
    source:        body.source || 'walk_in',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
