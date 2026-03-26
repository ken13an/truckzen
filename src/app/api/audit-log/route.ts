import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'

export async function GET(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)

  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)

  const url = new URL(req.url)
  const action = url.searchParams.get('action')
  const entity_type = url.searchParams.get('entity_type')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const user_id = url.searchParams.get('user_id')
  const limit = parseInt(url.searchParams.get('limit') || '100', 10)

  const s = createAdminSupabaseClient()
  let q = s.from('audit_log').select('*, users(full_name, email)').eq('shop_id', shopId).order('created_at', { ascending: false }).limit(limit)

  if (action) q = q.eq('action', action)
  if (entity_type) q = q.eq('entity_type', entity_type)
  if (from) q = q.gte('created_at', from)
  if (to) q = q.lte('created_at', to)
  if (user_id) q = q.eq('user_id', user_id)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data || [])
}
