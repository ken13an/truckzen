import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'

export async function DELETE(req: Request, { params }: { params: Promise<{ batch_id: string }> }) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)

  const s = createAdminSupabaseClient()
  const { batch_id } = await params

  if (!batch_id) return NextResponse.json({ error: 'batch_id required' }, { status: 400 })

  const { data: history } = await s.from('import_history')
    .select('id, undo_available_until')
    .eq('batch_id', batch_id)
    .eq('shop_id', shopId)
    .single()

  if (!history) return NextResponse.json({ error: 'Import batch not found' }, { status: 404 })

  if (history.undo_available_until && new Date(history.undo_available_until) < new Date()) {
    return NextResponse.json({ error: 'Undo window has expired (24 hours)' }, { status: 400 })
  }

  const { count } = await s.from('assets')
    .delete({ count: 'exact' })
    .eq('import_batch_id', batch_id)
    .eq('shop_id', shopId)

  await s.from('import_history')
    .update({ status: 'undone' })
    .eq('batch_id', batch_id)
    .eq('shop_id', shopId)

  return NextResponse.json({ deleted: count || 0 })
}
