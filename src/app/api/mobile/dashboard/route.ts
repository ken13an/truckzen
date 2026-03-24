import { NextResponse } from 'next/server'
import { createServerSupabaseClient, getCurrentUser } from '@/lib/supabase/server'
import { getCache, setCache } from '@/lib/cache'

// Single endpoint returning everything the mobile dashboard needs in one call
// Replaces 3-5 separate API calls from the mobile app
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = user.id
  const shopId = user.shop_id
  const cacheKey = `mobile:${userId}`
  const cached = getCache<any>(cacheKey)
  if (cached) return NextResponse.json(cached)

  const [jobs, notifications, timeClock] = await Promise.all([
    supabase.from('service_orders')
      .select('id, so_number, status, customer_name, unit_number, priority')
      .eq('shop_id', shopId)
      .eq('assigned_mechanic_id', userId)
      .not('status', 'in', '("done","void","closed")')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('notifications')
      .select('id, title, message, type, created_at')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('time_clock_entries')
      .select('id, clocked_in_at, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1),
  ])

  const result = {
    jobs: jobs.data || [],
    notifications: notifications.data || [],
    active_clock: timeClock.data?.[0] || null,
    fetched_at: new Date().toISOString(),
  }

  setCache(cacheKey, result, 15) // 15s TTL for mobile dashboard
  return NextResponse.json(result)
}
