import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase'

export async function GET(req: Request) {
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const expiring = searchParams.get('expiring') === 'true'
  const today    = new Date().toISOString().split('T')[0]
  const in30days = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]

  let q = supabase
    .from('compliance_items')
    .select('id, item_type, document_name, expiry_date, issued_date, notes, assets(unit_number, make, model), drivers(full_name)')
    .eq('shop_id', user.shop_id)
    .order('expiry_date')

  if (expiring) q = q.lte('expiry_date', in30days)

  const { data, error } = await q.limit(300)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Annotate each item with days until expiry
  const today_d = new Date(today).getTime()
  const annotated = (data || []).map(item => ({
    ...item,
    days_until_expiry: item.expiry_date
      ? Math.ceil((new Date(item.expiry_date).getTime() - today_d) / 86400000)
      : null,
  }))

  return NextResponse.json(annotated)
}

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = ['owner','gm','it_person','shop_manager','fleet_manager','office_admin']
  if (!allowed.includes(user.role)) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const body = await req.json()
  if (!body.document_name || !body.expiry_date)
    return NextResponse.json({ error: 'document_name and expiry_date required' }, { status: 400 })

  const { data, error } = await supabase.from('compliance_items').insert({
    shop_id:       user.shop_id,
    item_type:     body.item_type || 'other',
    document_name: body.document_name.trim(),
    expiry_date:   body.expiry_date,
    issued_date:   body.issued_date || null,
    asset_id:      body.asset_id   || null,
    driver_id:     body.driver_id  || null,
    notes:         body.notes      || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
