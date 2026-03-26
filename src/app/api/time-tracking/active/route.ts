import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, jsonError } from '@/lib/server-auth'

export async function GET() {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  if (!actor.shop_id) return jsonError('No shop context', 400)

  const s = createAdminSupabaseClient()
  const { data, error } = await s.from('so_time_entries')
    .select(`id, clocked_in_at, user_id,
      users(full_name, team),
      so_lines(description),
      service_orders(so_number)`)
    .eq('shop_id', actor.shop_id)
    .is('clocked_out_at', null)
    .is('deleted_at', null)
    .order('clocked_in_at', { ascending: true })

  if (error) return jsonError(error.message, 500)

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
