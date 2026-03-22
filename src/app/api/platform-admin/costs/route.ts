import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

async function verifyOwner(s: ReturnType<typeof db>, userId: string) {
  const { data } = await s.from('users').select('is_platform_owner').eq('id', userId).single()
  return data?.is_platform_owner === true
}

// GET /api/platform-admin/costs — get services, usage, progress
export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')
  const type = searchParams.get('type') || 'all'

  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })
  if (!await verifyOwner(s, userId)) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  if (type === 'services' || type === 'all') {
    const { data: services } = await s.from('platform_services').select('*').order('category').order('name')

    if (type === 'services') return NextResponse.json(services || [])

    // Progress
    const { data: progress } = await s.from('project_progress').select('*').order('sort_order')

    // Usage stats (current month)
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const monthEnd = now.toISOString().split('T')[0]

    // Pull from notification_log if it exists, otherwise return empty
    let shopUsage: any[] = []
    try {
      const { data: shops } = await s.from('shops').select('id, name')
      const usageByShop: any[] = []

      for (const shop of shops || []) {
        // Count notifications by type
        const { count: smsCount } = await s.from('notification_log')
          .select('*', { count: 'exact', head: true })
          .eq('shop_id', shop.id)
          .eq('channel', 'sms')
          .gte('created_at', monthStart)
        const { count: callCount } = await s.from('notification_log')
          .select('*', { count: 'exact', head: true })
          .eq('shop_id', shop.id)
          .eq('channel', 'voice')
          .gte('created_at', monthStart)
        const { count: emailCount } = await s.from('notification_log')
          .select('*', { count: 'exact', head: true })
          .eq('shop_id', shop.id)
          .eq('channel', 'email')
          .gte('created_at', monthStart)

        let aiCount = 0
        try {
          const { count } = await s.from('ai_usage_log')
            .select('*', { count: 'exact', head: true })
            .eq('shop_id', shop.id)
            .gte('created_at', monthStart)
          aiCount = count || 0
        } catch {}

        const smsCost = (smsCount || 0) * 0.0079
        const callCost = (callCount || 0) * 0.014
        const aiCost = aiCount * 0.003
        const emailCost = (emailCount || 0) * 0.001

        usageByShop.push({
          shop_id: shop.id,
          shop_name: shop.name,
          sms: smsCount || 0,
          calls: callCount || 0,
          ai_requests: aiCount,
          emails: emailCount || 0,
          est_cost: smsCost + callCost + aiCost + emailCost,
        })
      }
      shopUsage = usageByShop
    } catch {}

    return NextResponse.json({ services: services || [], progress: progress || [], shop_usage: shopUsage })
  }

  if (type === 'progress') {
    const { data } = await s.from('project_progress').select('*').order('sort_order')
    return NextResponse.json(data || [])
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}

// POST /api/platform-admin/costs — create or update service/progress
export async function POST(req: Request) {
  const s = db()
  const body = await req.json()
  const { user_id, action, ...data } = body

  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })
  if (!await verifyOwner(s, user_id)) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  if (action === 'add_service') {
    const { data: svc, error } = await s.from('platform_services').insert(data).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(svc, { status: 201 })
  }

  if (action === 'update_service') {
    const { id, ...updates } = data
    updates.updated_at = new Date().toISOString()
    const { error } = await s.from('platform_services').update(updates).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'add_progress') {
    // Get max sort_order
    const { data: maxRow } = await s.from('project_progress').select('sort_order').order('sort_order', { ascending: false }).limit(1).single()
    const nextOrder = (maxRow?.sort_order || 0) + 1
    const { data: item, error } = await s.from('project_progress').insert({ ...data, sort_order: nextOrder }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(item, { status: 201 })
  }

  if (action === 'update_progress') {
    const { id, ...updates } = data
    updates.updated_at = new Date().toISOString()
    const { error } = await s.from('project_progress').update(updates).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'delete_progress') {
    const { error } = await s.from('project_progress').delete().eq('id', data.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
