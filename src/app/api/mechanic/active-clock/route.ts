import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')

  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  const { data } = await s.from('so_time_entries')
    .select(`id, clocked_in_at, so_line_id, service_order_id,
      so_lines(description),
      service_orders(so_number)`)
    .eq('user_id', userId)
    .is('clocked_out_at', null)
    .limit(1)
    .single()

  if (!data) return NextResponse.json(null)

  return NextResponse.json({
    id: data.id,
    clocked_in_at: data.clocked_in_at,
    so_line_id: data.so_line_id,
    service_order_id: data.service_order_id,
    job_description: (data.so_lines as any)?.description || '',
    wo_number: (data.service_orders as any)?.so_number || '',
  })
}
