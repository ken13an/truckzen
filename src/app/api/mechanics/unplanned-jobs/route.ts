import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/server-auth'
import { requireRouteContext } from '@/lib/api-route-auth'
import { ASSIGNMENT_ROLES } from '@/lib/roles'
import { safeRoute } from '@/lib/api-handler'

// Mechanic unplanned-job tracking. Self-service for the mechanic; supervisors
// in ASSIGNMENT_ROLES may read another mechanic's history. shop_id is derived
// from the server session — body/query mechanic_id and shop_id are no longer
// trusted for permission.

async function _GET(req: Request) {
  const ctx = await requireRouteContext()
  if (ctx.error || !ctx.actor) return ctx.error!
  const shopId = ctx.actor.effective_shop_id || ctx.actor.shop_id
  if (!shopId) return NextResponse.json({ error: 'No shop context' }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const mechanicId = searchParams.get('mechanic_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!mechanicId) return NextResponse.json({ error: 'mechanic_id required' }, { status: 400 })

  // Self-read OR supervisor-read. Cross-mechanic queries require an
  // assignment-level role.
  const isSelf = mechanicId === ctx.actor.id
  const isSupervisor = ctx.actor.is_platform_owner || ASSIGNMENT_ROLES.includes(ctx.actor.role)
  if (!isSelf && !isSupervisor) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const s = createAdminSupabaseClient()

  // Verify the target mechanic belongs to the actor's shop. 404 (not 403) so
  // we don't leak whether a mechanic_id exists in another shop.
  if (!ctx.actor.is_platform_owner) {
    const { data: mech } = await s.from('users').select('id').eq('id', mechanicId).eq('shop_id', shopId).single()
    if (!mech) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let query = s
    .from('mechanic_unplanned_jobs')
    .select('*')
    .eq('shop_id', shopId)
    .eq('mechanic_id', mechanicId)
    .order('created_at', { ascending: false })

  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to + 'T23:59:59')

  const { data, error } = await query.limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function _POST(req: Request) {
  const ctx = await requireRouteContext()
  if (ctx.error || !ctx.actor) return ctx.error!
  const shopId = ctx.actor.effective_shop_id || ctx.actor.shop_id
  if (!shopId) return NextResponse.json({ error: 'No shop context' }, { status: 400 })

  const body = await req.json()
  const { description, duration_minutes, category } = body

  if (!description) {
    return NextResponse.json({ error: 'description required' }, { status: 400 })
  }

  // POST is self-only: only the mechanic can log their own unplanned job.
  // shop_id and mechanic_id are derived from the session, not the body.
  const s = createAdminSupabaseClient()
  const { data, error } = await s
    .from('mechanic_unplanned_jobs')
    .insert({
      shop_id: shopId,
      mechanic_id: ctx.actor.id,
      description,
      duration_minutes: duration_minutes || null,
      category: category || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export const GET = safeRoute(_GET)
export const POST = safeRoute(_POST)
