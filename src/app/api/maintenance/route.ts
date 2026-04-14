import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getAuthenticatedUserProfile, getActorShopId } from '@/lib/server-auth'
import { parsePageParams } from '@/lib/query-limits'

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient()
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const shopId = getActorShopId(actor)
  if (!shopId) return NextResponse.json({ error: 'No shop context' }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const assetId  = searchParams.get('asset_id')
  const overdue  = searchParams.get('overdue') === 'true'
  const today    = new Date().toISOString().split('T')[0]
  const { page, limit, offset } = parsePageParams(searchParams)

  let q = supabase
    .from('pm_schedules')
    .select('*, assets(id, unit_number, year, make, model, odometer, customers(company_name))', { count: 'exact' })
    .eq('shop_id', shopId)
    .eq('active', true)
    .order('next_due_date')

  if (assetId) q = q.eq('asset_id', assetId)
  if (overdue) q = q.lt('next_due_date', today)

  const { data, count, error } = await q.range(offset, offset + limit - 1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data || [], total: count || 0, page, limit, total_pages: Math.ceil((count || 0) / limit) })
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const shopId = getActorShopId(actor)
  if (!shopId) return NextResponse.json({ error: 'No shop context' }, { status: 400 })

  const allowed = ['owner','gm','it_person','shop_manager','fleet_manager','maintenance_manager','office_admin']
  const effectiveRole = actor.impersonate_role || actor.role
  if (!allowed.includes(effectiveRole)) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const body = await req.json()
  if (!body.asset_id || !body.service_name) return NextResponse.json({ error: 'asset_id and service_name required' }, { status: 400 })

  const { data, error } = await supabase.from('pm_schedules').insert({
    shop_id:          shopId,
    asset_id:         body.asset_id,
    service_name:     body.service_name.trim(),
    interval_miles:   body.interval_miles  || null,
    interval_days:    body.interval_days   || null,
    next_due_date:    body.next_due_date   || null,
    next_due_reading: body.next_due_reading|| null,
    notes:            body.notes          || null,
    active:           true,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
