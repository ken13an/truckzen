import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id')

  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const { data } = await s.from('so_time_entries')
    .select(`id, clocked_in_at, user_id,
      users(full_name, team),
      so_lines(description),
      service_orders(so_number)`)
    .eq('shop_id', shopId)
    .is('clocked_out_at', null)
    .order('clocked_in_at', { ascending: true })

  const active = (data || []).map((e: any) => ({
    id: e.id,
    mechanic_name: e.users?.full_name || 'Unknown',
    team: e.users?.team || null,
    wo_number: e.service_orders?.so_number || '',
    job_description: e.so_lines?.description || '',
    clocked_in_at: e.clocked_in_at,
  }))

  return NextResponse.json(active)
}
