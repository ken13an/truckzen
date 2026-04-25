import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/server-auth'
import { requireRouteContext } from '@/lib/api-route-auth'
import { MANAGEMENT_ROLES } from '@/lib/roles'
import { getCache, setCache } from '@/lib/cache'

// Role permissions read. Management-only: settings surface that reveals
// what each role is allowed to do. Shop scope comes from the server session.
// Query shop_id is no longer trusted.
export async function GET(req: Request) {
  const ctx = await requireRouteContext([...MANAGEMENT_ROLES])
  if (ctx.error || !ctx.actor) return ctx.error!
  const shopId = ctx.actor.effective_shop_id || ctx.actor.shop_id
  if (!shopId) return NextResponse.json({ error: 'No shop context' }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const role = searchParams.get('role')
  if (!role) return NextResponse.json([])

  const cacheKey = `role-perms:${shopId}:${role}`
  const cached = getCache<any>(cacheKey)
  if (cached) return NextResponse.json(cached)

  const { data } = await createAdminSupabaseClient().from('role_permissions').select('module, allowed').eq('shop_id', shopId).eq('role', role).limit(100)
  setCache(cacheKey, data || [], 120) // 2 min TTL
  return NextResponse.json(data || [])
}
