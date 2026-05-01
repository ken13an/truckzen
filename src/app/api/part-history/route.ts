import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/server-auth'
import { requireRouteContext } from '@/lib/api-route-auth'
import { SERVICE_PARTS_ROLES } from '@/lib/roles'

// Part purchase history. Shop-scoped: actor must hold a SERVICE_PARTS_ROLES
// role and shop scope comes from the server session. Query shop_id is no
// longer trusted.
export async function GET(req: Request) {
  const ctx = await requireRouteContext([...SERVICE_PARTS_ROLES])
  if (ctx.error || !ctx.actor) return ctx.error!
  const shopId = ctx.actor.effective_shop_id || ctx.actor.shop_id
  if (!shopId) return NextResponse.json({ error: 'No shop context' }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const perPage = Math.min(parseInt(searchParams.get('per_page') || '50'), 200)
  const search = searchParams.get('search') || ''
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  const s = createAdminSupabaseClient()

  let q = s
    .from('purchase_order_lines')
    .select(
      'id, part_number, description, quantity, quantity_received, received_at, cost_price, created_at, purchase_orders!inner(id, po_number, vendor_name, status, received_date, shop_id)',
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
    quantity_received: line.quantity_received,
    received_at: line.received_at,
    cost_price: line.cost_price,
    date: line.purchase_orders?.received_date || line.created_at,
    po_number: line.purchase_orders?.po_number,
    po_status: line.purchase_orders?.status,
    vendor: line.purchase_orders?.vendor_name,
  }))

  return NextResponse.json({ data: result, total: count || 0, page, per_page: perPage })
}
