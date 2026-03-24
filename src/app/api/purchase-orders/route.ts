import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')
  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const page = parseInt(searchParams.get('page') || '1')
  const perPage = Math.min(parseInt(searchParams.get('per_page') || '50'), 5000)
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  const s = db()
  const { data, error, count } = await s
    .from('purchase_orders')
    .select('id, po_number, vendor_name, status, total, received_date, source, fullbay_id, created_at', { count: 'exact' })
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get line counts per PO
  const poIds = (data || []).map(po => po.id)
  let lineCounts = new Map<string, number>()
  if (poIds.length > 0) {
    const { data: lines } = await s
      .from('purchase_order_lines')
      .select('purchase_order_id')
      .in('purchase_order_id', poIds)

    for (const l of lines || []) {
      lineCounts.set(l.purchase_order_id, (lineCounts.get(l.purchase_order_id) || 0) + 1)
    }
  }

  const result = (data || []).map(po => ({
    ...po,
    line_count: lineCounts.get(po.id) || 0,
  }))

  return NextResponse.json({ data: result, total: count || 0, page, per_page: perPage })
}

export async function POST(req: Request) {
  const s = db()
  const body = await req.json()
  const { shop_id, vendor_id, vendor_name, lines, notes, so_id, created_by } = body

  if (!shop_id) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })
  if (!lines?.length) return NextResponse.json({ error: 'At least one line item required' }, { status: 400 })

  const { count } = await s.from('purchase_orders').select('*', { count: 'exact', head: true }).eq('shop_id', shop_id)
  const poNum = `PO-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`
  const total = lines.reduce((sum: number, l: any) => sum + ((l.quantity || 1) * (l.cost_price || 0)), 0)

  const { data: po, error } = await s.from('purchase_orders').insert({
    shop_id,
    po_number: poNum,
    vendor_id: vendor_id || null,
    vendor_name: vendor_name || null,
    so_id: so_id || null,
    status: 'draft',
    total,
    notes: notes || null,
    created_by: created_by || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const poLines = lines.map((l: any) => ({
    purchase_order_id: po.id,
    part_id: l.part_id || null,
    part_number: l.part_number || null,
    description: l.description || '',
    quantity: l.quantity || 1,
    cost_price: l.cost_price || 0,
  }))

  await s.from('purchase_order_lines').insert(poLines)

  return NextResponse.json({ ...po, lines: poLines }, { status: 201 })
}
