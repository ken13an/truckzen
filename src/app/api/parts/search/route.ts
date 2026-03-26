/**
 * TruckZen — Original Design
 * Parts inventory search — for auto-fill in WO parts editing
 */
import { NextResponse } from 'next/server'
import { requireRouteContext } from '@/lib/api-route-auth'

export async function GET(req: Request) {
  const ctx = await requireRouteContext()
  if (ctx.error || !ctx.shopId || !ctx.admin) return ctx.error!

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() || ''
  if (q.length < 2) return NextResponse.json([])

  const { data } = await ctx.admin.from('parts')
    .select('id, description, part_number, cost_price, sell_price, on_hand, average_cost')
    .eq('shop_id', ctx.shopId)
    .is('deleted_at', null)
    .or(`part_number.ilike.%${q}%,description.ilike.%${q}%`)
    .limit(8)

  return NextResponse.json(data || [])
}
