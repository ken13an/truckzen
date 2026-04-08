import { NextResponse } from 'next/server'
import { requireRouteContext } from '@/lib/api-route-auth'
import { PARTS_MANAGE_ROLES } from '@/lib/roles'

type P = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: P) {
  const { id } = await params
  const ctx = await requireRouteContext([...PARTS_MANAGE_ROLES])
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
  const so = (data as any).service_orders as any
  if (soId) await ctx.admin.from('wo_activity_log').insert({ wo_id: soId, user_id: ctx.actor?.id || null, action: partial ? 'Some parts marked ready — partial pickup available' : 'All parts marked ready for pickup' })

  // Notify assigned mechanic that parts are ready for pickup
  if (so?.assigned_tech) {
    try {
      const { createNotification } = await import('@/lib/createNotification')
      await createNotification({
        shopId: ctx.shopId!,
        recipientId: so.assigned_tech,
        type: 'parts_ready',
        title: partial ? 'Parts Partially Ready' : 'Parts Ready for Pickup',
        body: `${so.so_number || 'WO'} — ${(data as any).part_name || 'parts'} ${partial ? 'partially' : ''} ready. Pick up from parts dept.`,
        link: `/mechanic/dashboard`,
        relatedWoId: soId,
      })
    } catch {}
  }

  return NextResponse.json(data)
}
