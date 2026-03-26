import { NextResponse } from 'next/server'
import { requireRouteContext } from '@/lib/api-route-auth'

type P = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: P) {
  const { id } = await params
  const ctx = await requireRouteContext(['owner', 'gm', 'it_person', 'shop_manager', 'parts_manager', 'parts_clerk', 'floor_manager', 'office_admin'])
  if (ctx.error || !ctx.shopId || !ctx.admin) return ctx.error!
  const { partial } = await req.json().catch(() => ({ partial: false }))

  const now = new Date().toISOString()
  const { data, error } = await ctx.admin.from('parts_requests')
    .update({ status: partial ? 'partial' : 'ready', parts_ready_at: now, updated_at: now })
    .eq('id', id)
    .eq('shop_id', ctx.shopId)
    .select('*, service_orders:so_id(so_number, shop_id, assigned_tech, assets(unit_number))')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const soId = (data as any).so_id
  if (soId) await ctx.admin.from('wo_activity_log').insert({ wo_id: soId, user_id: ctx.actor?.id || null, action: partial ? 'Some parts marked ready — partial pickup available' : 'All parts marked ready for pickup' })
  return NextResponse.json(data)
}
