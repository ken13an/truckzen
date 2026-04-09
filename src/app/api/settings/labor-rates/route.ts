import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getActorShopId } from '@/lib/server-auth'
import { getCache, setCache, invalidateCache } from '@/lib/cache'
import { requireAuthenticatedUser, requireRole } from '@/lib/route-guards'
import { logAction } from '@/lib/services/auditLog'

const LABOR_RATE_ROLES = ['owner', 'gm', 'it_person', 'accountant', 'office_admin', 'accounting_manager', 'shop_manager', 'service_writer', 'floor_manager', 'parts_manager'] as const

export async function GET() {
  const { actor, error } = await requireAuthenticatedUser()
  if (error || !actor) return error
  const roleError = requireRole(actor, LABOR_RATE_ROLES)
  if (roleError) return roleError

  const shopId = getActorShopId(actor)
  if (!shopId) return NextResponse.json({ error: 'shop context required' }, { status: 400 })

  const cacheKey = `labor-rates:${shopId}`
  const cached = getCache<any>(cacheKey)
  if (cached) return NextResponse.json(cached)

  const s = createAdminSupabaseClient()
  const { data, error: dbError } = await s.from('shop_labor_rates').select('*').eq('shop_id', shopId).order('ownership_type').limit(100)
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  setCache(cacheKey, data || [], 300)
  return NextResponse.json(data || [])
}

export async function PATCH(req: Request) {
  const { actor, error } = await requireAuthenticatedUser()
  if (error || !actor) return error
  const roleError = requireRole(actor, LABOR_RATE_ROLES)
  if (roleError) return roleError

  const shopId = getActorShopId(actor)
  if (!shopId) return NextResponse.json({ error: 'shop context required' }, { status: 400 })

  const body = await req.json().catch(() => null)
  const rates = body?.rates
  if (!Array.isArray(rates)) return NextResponse.json({ error: 'rates array required' }, { status: 400 })

  const s = createAdminSupabaseClient()
  for (const r of rates) {
    if (!r?.id) continue
    const update: Record<string, unknown> = { updated_by: actor.id, updated_at: new Date().toISOString() }
    if (r.rate_per_hour != null) update.rate_per_hour = r.rate_per_hour
    if (r.parts_margin_pct != null) update.parts_margin_pct = r.parts_margin_pct
    if (r.parts_markup_pct != null) update.parts_markup_pct = r.parts_markup_pct
    if (r.parts_pricing_mode != null) update.parts_pricing_mode = r.parts_pricing_mode
    await s.from('shop_labor_rates').update(update).eq('id', r.id).eq('shop_id', shopId)
  }

  invalidateCache(`labor-rates:${shopId}`)
  logAction({ shop_id: shopId, user_id: actor.id, action: 'labor_rates.updated', entity_type: 'shop', entity_id: shopId }).catch(() => {})
  return NextResponse.json({ ok: true })
}
