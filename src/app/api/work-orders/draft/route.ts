import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

/**
 * GET /api/work-orders/draft
 * Returns autosave drafts for the authenticated user
 */
export async function GET(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)
  const userId = actor.id

  const s = db()
  const { data, error } = await s
    .from('service_orders')
    .select('id, so_number, customer_id, asset_id, complaint, priority, job_type, mileage_at_service, internal_notes, created_at, updated_at')
    .eq('shop_id', shopId)
    .eq('created_by_user_id', userId)
    .like('so_number', 'DRAFT-%')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

/**
 * POST /api/work-orders/draft
 * Upsert an autosave draft. One draft per user+asset combo.
 */
export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shop_id = getActorShopId(actor)
  if (!shop_id) return jsonError('No shop context', 400)
  const user_id = actor.id

  const s = db()
  const body = await req.json()
  const { customer_id, asset_id, complaint, priority, job_type, mileage, draft_data } = body
  if (!customer_id || !asset_id) return NextResponse.json({ error: 'customer and vehicle required' }, { status: 400 })

  // Check for existing draft for this user + asset
  const { data: existing } = await s
    .from('service_orders')
    .select('id')
    .eq('shop_id', shop_id)
    .eq('created_by_user_id', user_id)
    .eq('asset_id', asset_id)
    .like('so_number', 'DRAFT-%')
    .is('deleted_at', null)
    .limit(1)
    .single()

  const draftFields = {
    shop_id,
    customer_id,
    asset_id,
    complaint: complaint?.trim() || null,
    priority: priority || 'normal',
    job_type: job_type || 'repair',
    mileage_at_service: mileage ? parseInt(mileage) : null,
    odometer_in: mileage ? parseInt(mileage) : null,
    internal_notes: draft_data || null,
    status: 'draft' as const,
    created_by_user_id: user_id,
    updated_at: new Date().toISOString(),
  }

  if (existing?.id) {
    // Update existing draft
    const { error } = await s
      .from('service_orders')
      .update(draftFields)
      .eq('id', existing.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ id: existing.id, updated: true })
  }

  // Create new draft
  const soNumber = `DRAFT-${user_id.slice(0, 8)}-${Date.now()}`
  const { data: draft, error } = await s
    .from('service_orders')
    .insert({ ...draftFields, so_number: soNumber, source: 'walk_in' })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: draft.id, created: true }, { status: 201 })
}

/**
 * DELETE /api/work-orders/draft
 * Delete a specific draft by ID, or all drafts for a user+asset
 */
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const draftId = searchParams.get('id')
  const userId = searchParams.get('user_id')
  const shopId = searchParams.get('shop_id')
  const assetId = searchParams.get('asset_id')

  if (!userId || !shopId) return NextResponse.json({ error: 'user_id and shop_id required' }, { status: 400 })

  const s = db()

  if (draftId) {
    // Delete specific draft (hard delete — it's just an autosave)
    await s
      .from('service_orders')
      .delete()
      .eq('id', draftId)
      .eq('created_by_user_id', userId)
      .like('so_number', 'DRAFT-%')
  } else if (assetId) {
    // Delete all drafts for this user + asset
    await s
      .from('service_orders')
      .delete()
      .eq('shop_id', shopId)
      .eq('created_by_user_id', userId)
      .eq('asset_id', assetId)
      .like('so_number', 'DRAFT-%')
  } else {
    // Delete all drafts for this user
    await s
      .from('service_orders')
      .delete()
      .eq('shop_id', shopId)
      .eq('created_by_user_id', userId)
      .like('so_number', 'DRAFT-%')
  }

  return NextResponse.json({ ok: true })
}
