import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUserProfile, jsonError } from '@/lib/server-auth'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET() {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)

  const s = db()
  const { data } = await s.from('so_time_entries')
    .select(`id, clocked_in_at, so_id, so_line_id,
      service_orders(so_number, complaint),
      so_lines(id, description)`)
    .eq('user_id', actor.id)
    .is('clocked_out_at', null)
    .limit(1)
    .single()

  if (!data) return NextResponse.json(null)

  return NextResponse.json({
    id: data.id,
    clocked_in_at: data.clocked_in_at,
    service_order_id: data.so_id,
    so_line_id: data.so_line_id,
    job_description: (data.so_lines as any)?.description?.slice(0, 60) || (data.service_orders as any)?.complaint?.slice(0, 60) || '',
    wo_number: (data.service_orders as any)?.so_number || '',
  })
}
