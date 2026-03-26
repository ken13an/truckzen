/**
 * TruckZen — API key management
 */
import { NextResponse } from 'next/server'
import { generateApiKey } from '@/lib/api-auth'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, jsonError } from '@/lib/server-auth'

const KEY_ADMIN_ROLES = ['owner', 'gm', 'it_person', 'office_admin']

function canManageKeys(role: string) {
  return KEY_ADMIN_ROLES.includes(role)
}

export async function GET(_req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  if (!actor.shop_id) return jsonError('No shop context', 400)
  if (!canManageKeys(actor.role)) return jsonError('Forbidden', 403)

  const s = createAdminSupabaseClient()
  const { data, error } = await s
    .from('api_keys')
    .select('id, key_prefix, name, permissions, rate_limit, last_used_at, request_count, active, expires_at, created_at')
    .eq('shop_id', actor.shop_id)
    .order('created_at', { ascending: false })

  if (error) return jsonError(error.message, 500)
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  if (!actor.shop_id) return jsonError('No shop context', 400)
  if (!canManageKeys(actor.role)) return jsonError('Forbidden', 403)

  const body = await req.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) return jsonError('name required', 400)

  const s = createAdminSupabaseClient()
  const { data: shop, error: shopError } = await s.from('shops').select('name').eq('id', actor.shop_id).single()
  if (shopError) return jsonError(shopError.message, 500)
  const shopPrefix = (shop?.name || 'shop').replace(/[^a-zA-Z]/g, '').slice(0, 6)

  const { key, hash, prefix } = generateApiKey(shopPrefix)

  const { error } = await s.from('api_keys').insert({
    shop_id: actor.shop_id,
    key_hash: hash,
    key_prefix: prefix,
    name,
    created_by: actor.id,
  })
  if (error) return jsonError(error.message, 500)

  return NextResponse.json({ key, prefix, name })
}

export async function DELETE(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  if (!actor.shop_id) return jsonError('No shop context', 400)
  if (!canManageKeys(actor.role)) return jsonError('Forbidden', 403)

  const body = await req.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  if (!id) return jsonError('id required', 400)

  const s = createAdminSupabaseClient()
  const { error } = await s.from('api_keys').update({ active: false }).eq('id', id).eq('shop_id', actor.shop_id)
  if (error) return jsonError(error.message, 500)
  return NextResponse.json({ ok: true })
}
