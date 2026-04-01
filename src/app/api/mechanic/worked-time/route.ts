import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')
  const soIds = searchParams.get('so_ids') // comma-separated WO IDs

  if (!userId || !soIds) return NextResponse.json({ error: 'user_id and so_ids required' }, { status: 400 })

  const woIds = soIds.split(',').filter(Boolean)
  if (woIds.length === 0) return NextResponse.json({ entries: [], worked: {} })

  const { data: entries } = await s.from('so_time_entries')
    .select('so_id, so_line_id, duration_minutes, clocked_in_at, clocked_out_at')
    .eq('user_id', userId)
    .in('so_id', woIds)
    .limit(500)

  // Aggregate worked minutes per so_line_id (or so_id fallback)
  const worked: Record<string, number> = {}
  const clockedSoIds: string[] = []
  const clockedLineIds: string[] = []
  for (const e of entries || []) {
    if (!clockedSoIds.includes(e.so_id)) clockedSoIds.push(e.so_id)
    if (e.so_line_id && !clockedLineIds.includes(e.so_line_id)) clockedLineIds.push(e.so_line_id)
    let mins = e.duration_minutes
    if (!mins && e.clocked_in_at && e.clocked_out_at) {
      mins = Math.round((new Date(e.clocked_out_at).getTime() - new Date(e.clocked_in_at).getTime()) / 60000)
    }
    if (mins && mins > 0) {
      const key = e.so_line_id || e.so_id
      worked[key] = (worked[key] || 0) + mins
    }
  }

  return NextResponse.json({ worked, clockedSoIds, clockedLineIds })
}
