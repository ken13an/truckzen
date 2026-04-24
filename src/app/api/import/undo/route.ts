import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/server-auth'
import { requirePlatformOwner } from '@/lib/route-guards'

// POST /api/import/undo — undo an import within 24 hours.
// Platform-owner only: the body-supplied shop_id is destructive (bulk
// delete via service_role), so the actor must prove platform-owner status
// on the server before any write is permitted.
export async function POST(req: Request) {
  const { error } = await requirePlatformOwner()
  if (error) return error

  const { log_id, shop_id } = await req.json().catch(() => ({ log_id: null, shop_id: null }))
  if (!log_id || !shop_id) return NextResponse.json({ error: 'log_id and shop_id required' }, { status: 400 })

  const s = createAdminSupabaseClient()

  // Get the import log
  const { data: log } = await s.from('import_export_log')
    .select('*').eq('id', log_id).eq('shop_id', shop_id).eq('action', 'import').single()

  if (!log) return NextResponse.json({ error: 'Import log not found' }, { status: 404 })
  if (log.undone) return NextResponse.json({ error: 'Already undone' }, { status: 400 })

  // Check 24-hour window
  const hoursSince = (Date.now() - new Date(log.created_at).getTime()) / 3600000
  if (hoursSince > 24) return NextResponse.json({ error: 'Cannot undo imports older than 24 hours' }, { status: 400 })

  // Delete the imported records
  const ids = log.record_ids || []
  let deleted = 0

  if (ids.length > 0) {
    const table = log.data_type === 'vehicles' ? 'assets'
      : log.data_type === 'work_orders' ? 'service_orders'
      : log.data_type

    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50)
      const { error } = await s.from(table).delete().in('id', batch).eq('shop_id', shop_id)
      if (!error) deleted += batch.length
    }
  }

  // Mark as undone
  await s.from('import_export_log').update({ undone: true, undone_at: new Date().toISOString() }).eq('id', log_id)

  return NextResponse.json({ ok: true, deleted })
}
