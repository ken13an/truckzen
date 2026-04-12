import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parsePageParams } from '@/lib/query-limits'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const shopId   = searchParams.get('shop_id')
  const expiring = searchParams.get('expiring') === 'true'
  const { page, limit, offset } = parsePageParams(searchParams)

  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const supabase = db()
  const today    = new Date().toISOString().split('T')[0]
  const in30days = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]

  let q = supabase
    .from('compliance_items')
    .select('id, item_type, document_name, expiry_date, reminder_days, alert_sent, notes, asset_id, driver_id, assets(unit_number, make, model), drivers(full_name)', { count: 'exact' })
    .eq('shop_id', shopId)
    .order('expiry_date')

  if (expiring) q = q.lte('expiry_date', in30days)

  const { data, count, error } = await q.range(offset, offset + limit - 1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Annotate each item with days until expiry
  const today_d = new Date(today).getTime()
  const annotated = (data || []).map(item => ({
    ...item,
    days_until_expiry: item.expiry_date
      ? Math.ceil((new Date(item.expiry_date).getTime() - today_d) / 86400000)
      : null,
  }))

  return NextResponse.json({ data: annotated, total: count || 0, page, limit, total_pages: Math.ceil((count || 0) / limit) })
}

export async function POST(req: Request) {
  const supabase = db()

  const body = await req.json()
  if (!body.document_name || !body.expiry_date)
    return NextResponse.json({ error: 'document_name and expiry_date required' }, { status: 400 })
  if (!body.shop_id)
    return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const { data, error } = await supabase.from('compliance_items').insert({
    shop_id:       body.shop_id,
    item_type:     body.item_type || 'other',
    document_name: body.document_name.trim(),
    expiry_date:   body.expiry_date,
    reminder_days: body.reminder_days || null,
    asset_id:      body.asset_id   || null,
    driver_id:     body.driver_id  || null,
    notes:         body.notes      || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
