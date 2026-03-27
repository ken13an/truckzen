import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logAction } from '@/lib/services/auditLog'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function POST(req: Request) {
  const s = db()
  const { so_line_id, user_id, service_order_id, shop_id } = await req.json()

  if (!so_line_id || !user_id) {
    return NextResponse.json({ error: 'so_line_id and user_id required' }, { status: 400 })
  }

  // Check mechanic isn't already clocked into another job
  const { data: active } = await s.from('so_time_entries')
    .select('id, so_id')
    .eq('user_id', user_id)
    .is('clocked_out_at', null)
    .is('deleted_at', null)
    .limit(1)

  if (active && active.length > 0) {
    return NextResponse.json({
      error: 'Already clocked into another job. Clock out first.',
      active_entry: active[0],
    }, { status: 409 })
  }

  // Determine service_order_id and shop_id if not provided
  let soId = service_order_id
  let sId = shop_id
  if (!soId || !sId) {
    const { data: line } = await s.from('so_lines')
      .select('so_id, service_orders(shop_id)')
      .eq('id', so_line_id)
      .single()
    if (line) {
      soId = soId || line.so_id
      sId = sId || (line.service_orders as any)?.shop_id
    }
  }

  const now = new Date().toISOString()
  const { data: entry, error } = await s.from('so_time_entries')
    .insert({
      shop_id: sId,
      user_id,
      so_id: soId,
      clocked_in_at: now,
      clocked_out_at: null,
      duration_minutes: null,
    })
    .select('id, clocked_in_at')
    .single()

  if (error) {
    console.error('[Clock In] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fire and forget
  logAction({ shop_id: sId, user_id, action: 'time.clock_in', entity_type: 'time_entry', entity_id: entry.id }).catch(() => {})

  return NextResponse.json(entry)
}
