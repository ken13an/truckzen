import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAuthenticatedUserProfile, getActorShopId } from '@/lib/server-auth'
import { getCache, setCache } from '@/lib/cache'

// Single endpoint returning everything the mobile dashboard needs in one call.
// Replaces 3-5 separate API calls from the mobile app.
//
// IMPERSONATION POLICY (Patch 129 — Policy B, proven):
// TruckZen's impersonation model sets target_shop_id and impersonate_role only;
// it does NOT change user identity (no target_user_id exists in the model).
// Therefore `assigned_tech = actor.id` and `user_id = actor.id` always resolve
// to the real session user's id — the only identity available. Shop scope,
// however, respects the effective shop via getActorShopId(actor) so a platform
// owner impersonating into another shop sees that shop's records filtered by
// their own assignments/notifications.
export async function GET() {
  await createServerSupabaseClient() // preserve existing session-cookie init side effect
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const shopId = getActorShopId(actor)
  if (!shopId) return NextResponse.json({ error: 'No shop context' }, { status: 400 })

  const userId = actor.id
  // Cache key must disambiguate effective shop so platform-owner impersonation
  // across shops does not cross-contaminate cached results.
  const cacheKey = `mobile:${userId}:${shopId}`
  const cached = getCache<any>(cacheKey)
  if (cached) return NextResponse.json(cached)

  const supabase = await createServerSupabaseClient()
  const [jobs, notifications, timeClock] = await Promise.all([
    supabase.from('service_orders')
      .select('id, so_number, status, complaint, priority, assets(unit_number), customers(company_name)')
      .eq('shop_id', shopId)
      .eq('assigned_tech', userId)
      .is('deleted_at', null)
      .not('status', 'in', '("done","void","good_to_go")')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('notifications')
      .select('id, title, body, type, created_at')
      .eq('user_id', userId)
      .eq('is_read', false)
      .eq('is_dismissed', false)
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
