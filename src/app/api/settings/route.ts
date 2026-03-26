import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getActorShopId } from '@/lib/server-auth'
import { requireAuthenticatedUser, requireRole } from '@/lib/route-guards'
import { logAction } from '@/lib/services/auditLog'

const SETTINGS_ROLES = ['owner', 'gm', 'it_person', 'shop_manager', 'office_admin'] as const

export async function GET() {
  const { actor, error } = await requireAuthenticatedUser()
  if (error || !actor) return error
  const roleError = requireRole(actor, SETTINGS_ROLES)
  if (roleError) return roleError

  const shopId = getActorShopId(actor)
  if (!shopId) return NextResponse.json({ error: 'shop context required' }, { status: 400 })

  const s = createAdminSupabaseClient()
  const { data, error: dbError } = await s.from('shops').select('*').eq('id', shopId).single()
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const { actor, error } = await requireAuthenticatedUser()
  if (error || !actor) return error
  const roleError = requireRole(actor, SETTINGS_ROLES)
  if (roleError) return roleError

  const shopId = getActorShopId(actor)
  if (!shopId) return NextResponse.json({ error: 'shop context required' }, { status: 400 })

  const body = await req.json().catch(() => null)
  const retentionPolicy = body?.retention_policy
  const updates: Record<string, unknown> = {}
  if (retentionPolicy !== undefined) updates.retention_policy = retentionPolicy

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const s = createAdminSupabaseClient()
  const { error: dbError } = await s.from('shops').update(updates).eq('id', shopId)
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  logAction({
    shop_id: shopId,
    user_id: actor.id,
    action: 'settings.updated',
    entity_type: 'shop',
    entity_id: shopId,
    details: updates as Record<string, unknown>,
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
