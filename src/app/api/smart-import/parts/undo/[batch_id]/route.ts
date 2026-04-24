import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/server-auth'
import { requireRouteContext } from '@/lib/api-route-auth'
import { SERVICE_WRITE_ROLES } from '@/lib/roles'

// DELETE /api/smart-import/parts/undo/[batch_id] — undo a smart-import batch
// within its 24h window. Shop-scoped: actor must hold a SERVICE_WRITE_ROLES
// role (matches the smart-drop import gate). Body/query shop_id is no longer
// trusted — the shop scope comes from the server session.
export async function DELETE(req: Request, { params }: { params: Promise<{ batch_id: string }> }) {
  const ctx = await requireRouteContext([...SERVICE_WRITE_ROLES])
  if (ctx.error || !ctx.actor) return ctx.error!
  const shopId = ctx.actor.effective_shop_id || ctx.actor.shop_id
  if (!shopId) return NextResponse.json({ error: 'No shop context' }, { status: 400 })

  const s = createAdminSupabaseClient()
  const { batch_id } = await params
  if (!batch_id) return NextResponse.json({ error: 'batch_id required' }, { status: 400 })

  const { data: history } = await s.from('import_history')
    .select('id, undo_available_until, error_report')
    .eq('batch_id', batch_id)
    .eq('shop_id', shopId)
    .single()

  if (!history) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
  if (history.undo_available_until && new Date(history.undo_available_until) < new Date()) {
    return NextResponse.json({ error: 'Undo window expired (24 hours)' }, { status: 400 })
  }

  // Delete new parts added in this batch
  const { count } = await s.from('parts')
    .delete({ count: 'exact' })
    .eq('import_batch_id', batch_id)
    .eq('shop_id', shopId)

  // Update history
  await s.from('import_history').update({ status: 'undone' }).eq('batch_id', batch_id).eq('shop_id', shopId)

  return NextResponse.json({ deleted: count || 0 })
}
