import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/server-auth'
import { requirePlatformOwner } from '@/lib/route-guards'

export async function GET(req: Request) {
  const { error } = await requirePlatformOwner()
  if (error) return error

  const s = createAdminSupabaseClient()
  const type = new URL(req.url).searchParams.get('type') || 'all'

  if (type === 'services' || type === 'all') {
    const { data: services } = await s.from('platform_services').select('*').order('category').order('name')
    if (type === 'services') return NextResponse.json(services || [])

    const { data: progress } = await s.from('project_progress').select('*').order('sort_order')
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
    let shopUsage: any[] = []

    try {
      const { data: shops } = await s.from('shops').select('id, name')
      shopUsage = await Promise.all((shops || []).map(async (shop: any) => {
        const [{ count: smsCount }, { count: callCount }, { count: emailCount }] = await Promise.all([
          s.from('notification_log').select('*', { count: 'exact', head: true }).eq('shop_id', shop.id).eq('channel', 'sms').gte('created_at', monthStart),
          s.from('notification_log').select('*', { count: 'exact', head: true }).eq('shop_id', shop.id).eq('channel', 'voice').gte('created_at', monthStart),
          s.from('notification_log').select('*', { count: 'exact', head: true }).eq('shop_id', shop.id).eq('channel', 'email').gte('created_at', monthStart),
        ])
        let aiCount = 0
        try {
          const { count } = await s.from('ai_usage_log').select('*', { count: 'exact', head: true }).eq('shop_id', shop.id).gte('created_at', monthStart)
          aiCount = count || 0
        } catch {}
        const estCost = (smsCount || 0) * 0.0079 + (callCount || 0) * 0.014 + (emailCount || 0) * 0.001 + aiCount * 0.003
        return { shop_id: shop.id, shop_name: shop.name, sms: smsCount || 0, calls: callCount || 0, ai_requests: aiCount, emails: emailCount || 0, est_cost: estCost }
      }))
    } catch {}

    return NextResponse.json({ services: services || [], progress: progress || [], shop_usage: shopUsage })
  }

  if (type === 'progress') {
    const { data } = await s.from('project_progress').select('*').order('sort_order')
    return NextResponse.json(data || [])
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}

export async function POST(req: Request) {
  const { actor, error } = await requirePlatformOwner()
  if (error || !actor) return error

  const s = createAdminSupabaseClient()
  const body = await req.json().catch(() => null)
  const action = body?.action
  const data = { ...(body || {}) }
  delete data.user_id
  delete data.action

  if (action === 'add_service') {
    const { data: svc, error: dbError } = await s.from('platform_services').insert(data).select().single()
    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
    return NextResponse.json(svc, { status: 201 })
  }
  if (action === 'update_service') {
    const { id, ...updates } = data
    updates.updated_at = new Date().toISOString()
    const { error: dbError } = await s.from('platform_services').update(updates).eq('id', id)
    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  if (action === 'add_progress') {
    const { data: maxRow } = await s.from('project_progress').select('sort_order').order('sort_order', { ascending: false }).limit(1).single()
    const { data: item, error: dbError } = await s.from('project_progress').insert({ ...data, sort_order: (maxRow?.sort_order || 0) + 1 }).select().single()
    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
    return NextResponse.json(item, { status: 201 })
  }
  if (action === 'update_progress') {
    const { id, ...updates } = data
    updates.updated_at = new Date().toISOString()
    const { error: dbError } = await s.from('project_progress').update(updates).eq('id', id)
    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  if (action === 'delete_progress') {
    const { error: dbError } = await s.from('project_progress').delete().eq('id', data.id)
    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
