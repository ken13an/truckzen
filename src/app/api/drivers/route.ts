import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  const search = searchParams.get('q')

  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const supabase = db()

  let q = supabase
    .from('drivers')
    .select('id, full_name, phone, email, cdl_number, cdl_class, cdl_expiry, medical_expiry, assigned_unit, active, hire_date, created_at')
    .eq('shop_id', shopId)
    .order('full_name')

  if (search) q = q.or(`full_name.ilike.%${search}%,cdl_number.ilike.%${search}%`)

  const { data, error } = await q.limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = db()

  const body = await req.json()
  if (!body.full_name) return NextResponse.json({ error: 'full_name required' }, { status: 400 })
  if (!body.shop_id) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const { data, error } = await supabase.from('drivers').insert({
    shop_id:        body.shop_id,
    full_name:      body.full_name.trim(),
    phone:          body.phone         || null,
    email:          body.email?.toLowerCase() || null,
    cdl_number:     body.cdl_number    || null,
    cdl_class:      body.cdl_class     || null,
    cdl_expiry:     body.cdl_expiry    || null,
    medical_expiry: body.medical_expiry || null,
    assigned_unit:  body.assigned_unit || null,
    hire_date:      body.hire_date     || null,
    active:         true,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
