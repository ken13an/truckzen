import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCache, setCache } from '@/lib/cache'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// GET /api/platform-admin/stats — overview stats for platform admin
export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')

  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  const { data: caller } = await s.from('users').select('is_platform_owner').eq('id', userId).single()
  if (!caller?.is_platform_owner) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const cacheKey = `platform-stats:${userId}`
  const cached = getCache<any>(cacheKey)
  if (cached) return NextResponse.json(cached)

  const [
    { count: totalShops },
    { count: totalWOs },
    { count: pendingRegs },
    { data: shops },
  ] = await Promise.all([
    s.from('shops').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    s.from('service_orders').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    s.from('shop_registrations').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    s.from('shops').select('monthly_revenue').eq('status', 'active'),
  ])

  const monthlyRevenue = (shops || []).reduce((sum: number, s: any) => sum + (parseFloat(s.monthly_revenue) || 0), 0)

  // Recent shops
  const { data: recentShops } = await s.from('shops')
    .select('id, name, status, subscription_plan, created_at')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(10)

  // Enrich with owner + WO count this month
  const firstOfMonth = new Date()
  firstOfMonth.setDate(1)
  firstOfMonth.setHours(0, 0, 0, 0)

  const enrichedShops = await Promise.all((recentShops || []).map(async (shop: any) => {
    const [{ data: owner }, { count: woCount }] = await Promise.all([
      s.from('users').select('full_name, email').eq('shop_id', shop.id).eq('role', 'owner').limit(1).single(),
      s.from('service_orders').select('*', { count: 'exact', head: true })
        .eq('shop_id', shop.id)
        .is('deleted_at', null)
        .gte('created_at', firstOfMonth.toISOString()),
    ])
    return { ...shop, owner_name: owner?.full_name || '—', owner_email: owner?.email || '', wo_this_month: woCount || 0 }
  }))

  // Recent activity
  const { data: activity } = await s.from('platform_activity_log')
    .select('id, action_type, description, shop_id, created_at, performed_by')
    .order('created_at', { ascending: false })
    .limit(10)

  // Enrich activity with shop names
  const enrichedActivity = await Promise.all((activity || []).map(async (a: any) => {
    let shopName = null
    if (a.shop_id) {
      const { data: sh } = await s.from('shops').select('name').eq('id', a.shop_id).single()
      shopName = sh?.name || null
    }
    let performedByName = null
    if (a.performed_by) {
      const { data: u } = await s.from('users').select('full_name').eq('id', a.performed_by).single()
      performedByName = u?.full_name || null
    }
    return { ...a, shop_name: shopName, performed_by_name: performedByName }
  }))

  const result = {
    total_shops: totalShops || 0,
    total_wos: totalWOs || 0,
    pending_registrations: pendingRegs || 0,
    monthly_revenue: monthlyRevenue,
    recent_shops: enrichedShops,
    recent_activity: enrichedActivity,
  }
  setCache(cacheKey, result, 60) // 60s TTL
  return NextResponse.json(result)
}
