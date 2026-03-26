import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/server-auth'
import { getCache, setCache } from '@/lib/cache'
import { requirePlatformOwner } from '@/lib/route-guards'

export async function GET() {
  const { actor, error } = await requirePlatformOwner()
  if (error || !actor) return error

  const s = createAdminSupabaseClient()
  const cacheKey = `platform-stats:${actor.id}`
  const cached = getCache<any>(cacheKey)
  if (cached) return NextResponse.json(cached)

  const [{ count: totalShops }, { count: totalWOs }, { count: pendingRegs }, { data: shops }] = await Promise.all([
    s.from('shops').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    s.from('service_orders').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    s.from('shop_registrations').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    s.from('shops').select('monthly_revenue').eq('status', 'active'),
  ])

  const monthlyRevenue = (shops || []).reduce((sum: number, row: any) => sum + (parseFloat(row.monthly_revenue) || 0), 0)
  const { data: recentShops } = await s.from('shops').select('id, name, status, subscription_plan, created_at').eq('status', 'active').order('created_at', { ascending: false }).limit(10)

  const firstOfMonth = new Date(); firstOfMonth.setDate(1); firstOfMonth.setHours(0,0,0,0)
  const enrichedShops = await Promise.all((recentShops || []).map(async (shop: any) => {
    const [{ data: owner }, { count: woCount }] = await Promise.all([
      s.from('users').select('full_name, email').eq('shop_id', shop.id).eq('role', 'owner').limit(1).single(),
      s.from('service_orders').select('*', { count: 'exact', head: true }).eq('shop_id', shop.id).is('deleted_at', null).gte('created_at', firstOfMonth.toISOString()),
    ])
    return { ...shop, owner_name: owner?.full_name || '—', owner_email: owner?.email || '', wo_this_month: woCount || 0 }
  }))

  const { data: activity } = await s.from('platform_activity_log').select('id, action_type, description, shop_id, created_at, performed_by').order('created_at', { ascending: false }).limit(10)
  const enrichedActivity = await Promise.all((activity || []).map(async (a: any) => {
    const [{ data: sh }, { data: u }] = await Promise.all([
      a.shop_id ? s.from('shops').select('name').eq('id', a.shop_id).single() : Promise.resolve({ data: null }),
      a.performed_by ? s.from('users').select('full_name').eq('id', a.performed_by).single() : Promise.resolve({ data: null }),
    ])
    return { ...a, shop_name: sh?.name || null, performed_by_name: u?.full_name || null }
  }))

  const result = { total_shops: totalShops || 0, total_wos: totalWOs || 0, pending_registrations: pendingRegs || 0, monthly_revenue: monthlyRevenue, recent_shops: enrichedShops, recent_activity: enrichedActivity }
  setCache(cacheKey, result, 60)
  return NextResponse.json(result)
}
