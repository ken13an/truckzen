import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/server-auth'
import { requireRouteContext } from '@/lib/api-route-auth'
import { ASSIGNMENT_ROLES } from '@/lib/roles'
import { safeRoute } from '@/lib/api-handler'

// Mechanic weekly-report read. Manager-level surface (productivity review).
// Shop scope comes from the server session — query shop_id is no longer
// trusted.
async function _GET(req: Request) {
  const ctx = await requireRouteContext([...ASSIGNMENT_ROLES])
  if (ctx.error || !ctx.actor) return ctx.error!
  const shopId = ctx.actor.effective_shop_id || ctx.actor.shop_id
  if (!shopId) return NextResponse.json({ error: 'No shop context' }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const mechanicId = searchParams.get('mechanic_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = createAdminSupabaseClient()
    .from('mechanic_weekly_reports')
    .select('*, users:mechanic_id(id, full_name, email)')
    .eq('shop_id', shopId)
    .order('week_start', { ascending: false })

  if (mechanicId) query = query.eq('mechanic_id', mechanicId)
  if (from) query = query.gte('week_start', from)
  if (to) query = query.lte('week_end', to)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export const GET = safeRoute(_GET)
