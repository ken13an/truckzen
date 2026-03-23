import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  const status = searchParams.get('status')
  const soId = searchParams.get('so_id')

  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  let q = s.from('parts_requests')
    .select('*, service_orders:so_id(id, so_number, status, assigned_tech, assets(unit_number, year, make, model), customers(id, company_name, pricing_tier), users!assigned_tech(full_name)), requester:requested_by(full_name), submitter:submitted_by(full_name)')
    .eq('shop_id', shopId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (status && status !== 'all') {
    if (status === 'active') {
      q = q.in('status', ['pending', 'requested', 'reviewing', 'submitted', 'partial'])
    } else {
      q = q.eq('status', status)
    }
  }
  if (soId) q = q.eq('so_id', soId)

  const { data, error } = await q.limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data || [])
}
