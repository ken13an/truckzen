import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// POST /api/import/undo — undo an import within 24 hours
export async function POST(req: Request) {
  const s = db()
  const { log_id, shop_id } = await req.json()

  if (!log_id || !shop_id) return NextResponse.json({ error: 'log_id and shop_id required' }, { status: 400 })

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
