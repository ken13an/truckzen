import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// GET /api/platform-admin/shops — list all shops with full details
export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')
  const status = searchParams.get('status')
  const plan = searchParams.get('plan')
  const search = searchParams.get('search')

  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  const { data: caller } = await s.from('users').select('is_platform_owner').eq('id', userId).single()
  if (!caller?.is_platform_owner) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  let query = s.from('shops').select('*').order('created_at', { ascending: false })

  if (status && status !== 'all') query = query.eq('status', status)
  if (plan && plan !== 'all') query = query.eq('subscription_plan', plan)
  if (search) query = query.or(`name.ilike.%${search}%`)

  const { data: shops, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with owner info + total WOs
  const enriched = await Promise.all((shops || []).map(async (shop: any) => {
    const [{ data: owner }, { count: woCount }] = await Promise.all([
      s.from('users').select('full_name, email').eq('shop_id', shop.id).eq('role', 'owner').limit(1).single(),
      s.from('service_orders').select('*', { count: 'exact', head: true }).eq('shop_id', shop.id),
    ])
    return {
      ...shop,
      owner_name: owner?.full_name || '—',
      owner_email: owner?.email || '',
      wo_total: woCount || 0,
    }
  }))

  // If search includes email, also search by owner email
  if (search && enriched) {
    const lowerSearch = search.toLowerCase()
    return NextResponse.json(enriched.filter((s: any) =>
      s.name?.toLowerCase().includes(lowerSearch) || s.owner_email?.toLowerCase().includes(lowerSearch)
    ))
  }

  return NextResponse.json(enriched)
}

// PATCH /api/platform-admin/shops — update shop details
export async function PATCH(req: Request) {
  const s = db()
  const body = await req.json()
  const { user_id, shop_id, ...updates } = body

  if (!user_id || !shop_id) return NextResponse.json({ error: 'user_id and shop_id required' }, { status: 400 })

  const { data: caller } = await s.from('users').select('is_platform_owner').eq('id', user_id).single()
  if (!caller?.is_platform_owner) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  // Only allow specific fields to be updated
  const allowed = ['name', 'status', 'subscription_plan', 'subscription_status', 'trial_ends_at', 'notes', 'address', 'city', 'state', 'zip', 'email', 'phone']
  const safeUpdates: Record<string, any> = {}
  for (const key of allowed) {
    if (key in updates) safeUpdates[key] = updates[key]
  }

  const { error } = await s.from('shops').update(safeUpdates).eq('id', shop_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log activity
  await s.from('platform_activity_log').insert({
    action_type: 'shop_updated',
    description: `Shop updated: ${Object.keys(safeUpdates).join(', ')}`,
    shop_id,
    performed_by: user_id,
    metadata: safeUpdates,
  })

  return NextResponse.json({ ok: true })
}
