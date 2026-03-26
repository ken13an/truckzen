import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/server-auth'
import { requirePlatformOwner } from '@/lib/route-guards'

export async function GET(req: Request) {
  const { actor, error } = await requirePlatformOwner()
  if (error || !actor) return error

  const s = createAdminSupabaseClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const plan = searchParams.get('plan')
  const search = searchParams.get('search')

  let query = s.from('shops').select('*').order('created_at', { ascending: false })
  if (status && status !== 'all') query = query.eq('status', status)
  if (plan && plan !== 'all') query = query.eq('subscription_plan', plan)
  if (search) query = query.or(`name.ilike.%${search}%`)

  const { data: shops, error: dbError } = await query
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  const enriched = await Promise.all((shops || []).map(async (shop: any) => {
    const [{ data: owner }, { count: woCount }] = await Promise.all([
      s.from('users').select('full_name, email').eq('shop_id', shop.id).eq('role', 'owner').limit(1).single(),
      s.from('service_orders').select('*', { count: 'exact', head: true }).eq('shop_id', shop.id).is('deleted_at', null),
    ])
    return { ...shop, owner_name: owner?.full_name || '—', owner_email: owner?.email || '', wo_total: woCount || 0 }
  }))

  if (search) {
    const lower = search.toLowerCase()
    return NextResponse.json(enriched.filter((shop: any) => shop.name?.toLowerCase().includes(lower) || shop.owner_email?.toLowerCase().includes(lower)))
  }

  return NextResponse.json(enriched)
}

export async function PATCH(req: Request) {
  const { actor, error } = await requirePlatformOwner()
  if (error || !actor) return error

  const body = await req.json().catch(() => null)
  const shopId = typeof body?.shop_id === 'string' ? body.shop_id : ''
  if (!shopId) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const allowed = ['name', 'status', 'subscription_plan', 'subscription_status', 'trial_ends_at', 'notes', 'address', 'city', 'state', 'zip', 'email', 'phone']
  const safeUpdates: Record<string, any> = {}
  for (const key of allowed) {
    if (body && key in body) safeUpdates[key] = body[key]
  }

  const s = createAdminSupabaseClient()
  const { error: dbError } = await s.from('shops').update(safeUpdates).eq('id', shopId)
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  await s.from('platform_activity_log').insert({
    action_type: 'shop_updated',
    description: `Shop updated: ${Object.keys(safeUpdates).join(', ')}`,
    shop_id: shopId,
    performed_by: actor.id,
    metadata: safeUpdates,
  })

  return NextResponse.json({ ok: true })
}
