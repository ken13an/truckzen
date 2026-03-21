import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

// DELETE /api/smart-import/trucks/undo/[batch_id] — undo a truck import batch
export async function DELETE(req: Request, { params }: { params: Promise<{ batch_id: string }> }) {
  const s = db()
  const { batch_id } = await params
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')

  if (!batch_id || !shopId) return NextResponse.json({ error: 'batch_id and shop_id required' }, { status: 400 })

  // Check undo is still available
  const { data: history } = await s.from('import_history')
    .select('id, undo_available_until')
    .eq('batch_id', batch_id)
    .eq('shop_id', shopId)
    .single()

  if (!history) return NextResponse.json({ error: 'Import batch not found' }, { status: 404 })

  if (history.undo_available_until && new Date(history.undo_available_until) < new Date()) {
    return NextResponse.json({ error: 'Undo window has expired (24 hours)' }, { status: 400 })
  }

  // Delete all assets with this batch_id
  const { count } = await s.from('assets')
    .delete({ count: 'exact' })
    .eq('import_batch_id', batch_id)
    .eq('shop_id', shopId)

  // Update history
  await s.from('import_history')
    .update({ status: 'undone' })
    .eq('batch_id', batch_id)
    .eq('shop_id', shopId)

  return NextResponse.json({ deleted: count || 0 })
}
