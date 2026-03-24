import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const page = parseInt(searchParams.get('page') || '1')
  const perPage = Math.min(parseInt(searchParams.get('per_page') || '50'), 200)
  const search = searchParams.get('search') || ''
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  const s = db()

  let q = s
    .from('purchase_order_lines')
    .select(
      'id, part_number, description, quantity, cost_price, created_at, purchase_orders!inner(id, po_number, vendor_name, received_date, shop_id)',
      { count: 'exact' }
    )
    .eq('purchase_orders.shop_id', shopId)
    .order('created_at', { ascending: false })

  if (search) {
    q = q.or(`part_number.ilike.%${search}%,description.ilike.%${search}%`)
  }

  q = q.range(from, to)

  const { data, error, count } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = (data || []).map((line: any) => ({
    id: line.id,
    part_number: line.part_number,
    description: line.description,
    quantity: line.quantity,
    cost_price: line.cost_price,
    date: line.purchase_orders?.received_date || line.created_at,
    po_number: line.purchase_orders?.po_number,
    vendor: line.purchase_orders?.vendor_name,
  }))

  return NextResponse.json({ data: result, total: count || 0, page, per_page: perPage })
}
