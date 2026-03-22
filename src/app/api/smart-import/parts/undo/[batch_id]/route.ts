import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function DELETE(req: Request, { params }: { params: Promise<{ batch_id: string }> }) {
  const s = db()
  const { batch_id } = await params
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')

  if (!batch_id || !shopId) return NextResponse.json({ error: 'batch_id and shop_id required' }, { status: 400 })

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
