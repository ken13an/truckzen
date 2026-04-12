import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'
import { safeRoute } from '@/lib/api-handler'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

const OVERRIDE_ROLES = ['owner', 'gm', 'it_person', 'shop_manager']

type Params = { params: Promise<{ id: string }> }

async function _POST(req: Request, { params }: Params) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)
  if (!OVERRIDE_ROLES.includes(actor.role)) {
    return NextResponse.json({ error: 'Only owner, admin, GM, or shop manager can override' }, { status: 403 })
  }

  const { id } = await params
  const s = db()
  const { reason } = await req.json().catch(() => ({}))

  // Set estimate_approved = true with override (scoped to shop)
  await s.from('service_orders').update({
    estimate_approved: true,
    updated_at: new Date().toISOString(),
  }).eq('id', id).eq('shop_id', shopId)

  // Log override to activity
  await s.from('wo_activity_log').insert({
    wo_id: id,
    user_id: actor.id,
    action: `Estimate block overridden by ${actor.full_name}${reason ? ` — Reason: ${reason}` : ''}`,
  })

  return NextResponse.json({ ok: true })
}

export const POST = safeRoute(_POST)
