import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getActorShopId } from '@/lib/server-auth'
import { requireAuthenticatedUser, requireRole, MANAGEMENT_ROLES } from '@/lib/route-guards'

const VALID_PROVIDERS = ['samsara', 'fleetio', 'fullbay'] as const

export async function GET(req: Request) {
  const { actor, error } = await requireAuthenticatedUser()
  if (error || !actor) return error
  const roleError = requireRole(actor, MANAGEMENT_ROLES)
  if (roleError) return roleError

  const shopId = getActorShopId(actor)
  if (!shopId) return NextResponse.json({ error: 'shop context required' }, { status: 400 })

  const url = new URL(req.url)
  const assetId = url.searchParams.get('asset_id')

  const s = createAdminSupabaseClient()

  // If asset_id provided, verify asset belongs to actor shop then return links for that asset
  if (assetId) {
    const { data: asset } = await s.from('assets').select('id').eq('id', assetId).eq('shop_id', shopId).single()
    if (!asset) return NextResponse.json({ error: 'Asset not found in your shop' }, { status: 404 })

    const { data, error: dbError } = await s
      .from('asset_external_links')
      .select('*')
      .eq('asset_id', assetId)
      .order('created_at', { ascending: false })
    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
    return NextResponse.json(data || [])
  }

  // No asset_id — return all links for assets in actor shop
  const { data: shopAssets } = await s.from('assets').select('id').eq('shop_id', shopId)
  const assetIds = (shopAssets || []).map((a: any) => a.id)
  if (assetIds.length === 0) return NextResponse.json([])

  const { data, error: dbError } = await s
    .from('asset_external_links')
    .select('*')
    .in('asset_id', assetIds)
    .order('created_at', { ascending: false })
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const { actor, error } = await requireAuthenticatedUser()
  if (error || !actor) return error
  const roleError = requireRole(actor, MANAGEMENT_ROLES)
  if (roleError) return roleError

  const shopId = getActorShopId(actor)
  if (!shopId) return NextResponse.json({ error: 'shop context required' }, { status: 400 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  const { asset_id, provider, external_id, external_secondary_id, match_method } = body

  if (!asset_id || !provider || !external_id) {
    return NextResponse.json({ error: 'asset_id, provider, and external_id are required' }, { status: 400 })
  }

  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: `Invalid provider. Allowed: ${VALID_PROVIDERS.join(', ')}` }, { status: 400 })
  }

  const s = createAdminSupabaseClient()

  // Verify asset belongs to actor shop
  const { data: asset } = await s.from('assets').select('id').eq('id', asset_id).eq('shop_id', shopId).single()
  if (!asset) return NextResponse.json({ error: 'Asset not found in your shop' }, { status: 404 })

  // Insert — unique constraint (provider, external_id) prevents duplicates at DB level
  const { data, error: dbError } = await s
    .from('asset_external_links')
    .insert({
      asset_id,
      provider,
      external_id: String(external_id),
      external_secondary_id: external_secondary_id || null,
      match_method: match_method || 'manual',
      is_primary: false,
    })
    .select()
    .single()

  if (dbError) {
    if (dbError.code === '23505') {
      return NextResponse.json({ error: 'This provider + external_id link already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: Request) {
  const { actor, error } = await requireAuthenticatedUser()
  if (error || !actor) return error
  const roleError = requireRole(actor, MANAGEMENT_ROLES)
  if (roleError) return roleError

  const shopId = getActorShopId(actor)
  if (!shopId) return NextResponse.json({ error: 'shop context required' }, { status: 400 })

  const url = new URL(req.url)
  const linkId = url.searchParams.get('id')
  if (!linkId) return NextResponse.json({ error: 'Link id required' }, { status: 400 })

  const s = createAdminSupabaseClient()

  // Fetch link, verify the linked asset belongs to actor shop
  const { data: link } = await s.from('asset_external_links').select('id, asset_id').eq('id', linkId).single()
  if (!link) return NextResponse.json({ error: 'Link not found' }, { status: 404 })

  const { data: asset } = await s.from('assets').select('id').eq('id', link.asset_id).eq('shop_id', shopId).single()
  if (!asset) return NextResponse.json({ error: 'Not authorized to delete this link' }, { status: 403 })

  const { error: dbError } = await s.from('asset_external_links').delete().eq('id', linkId)
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
