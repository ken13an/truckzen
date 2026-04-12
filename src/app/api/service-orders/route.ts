import { SERVICE_WRITE_ROLES } from '@/lib/roles'
import { NextResponse } from 'next/server'
import { notifyRole } from '@/lib/notify'
import { insertServiceOrder } from '@/lib/generateWoNumber'
import { requireRouteContext } from '@/lib/api-route-auth'
import { safeRoute } from '@/lib/api-handler'

async function _GET(req: Request) {
  const ctx = await requireRouteContext()
  if (ctx.error || !ctx.admin || !ctx.actor || !ctx.shopId) return ctx.error!

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const team = searchParams.get('team')
  const role = ctx.actor.impersonate_role || ctx.actor.role || ''
  const userTeam = ctx.actor.team || ''
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 50)
  const page = Math.max(parseInt(searchParams.get('page') ?? '1'), 1)
  const includeSoLines = searchParams.get('include_so_lines') === 'true'
  const excludeStatuses = searchParams.get('exclude_status')
  const excludeHistorical = searchParams.get('exclude_historical') !== 'false'

  const selectFields = includeSoLines
    ? `id, so_number, status, priority, complaint, bay, team, grand_total, created_at, updated_at, assets(id, unit_number, year, make, model), customers(id, company_name), users!assigned_tech(id, full_name), so_lines(id, line_type, description, parts_status, real_name, rough_name)`
    : `id, so_number, status, priority, complaint, bay, team, grand_total, created_at, updated_at, assets(id, unit_number, year, make, model), customers(id, company_name), users!assigned_tech(id, full_name)`

  let countQ = ctx.admin.from('service_orders').select('*', { count: 'exact', head: true }).eq('shop_id', ctx.shopId).is('deleted_at', null).not('status', 'eq', 'void')
  const offset = (page - 1) * limit
  let q = ctx.admin.from('service_orders').select(selectFields).eq('shop_id', ctx.shopId).is('deleted_at', null).not('status', 'eq', 'void').order('created_at', { ascending: false }).range(offset, offset + limit - 1)

  if (excludeHistorical) {
    q = q.neq('is_historical', true)
    countQ = countQ.neq('is_historical', true)
    q = q.neq('source', 'fullbay')
    countQ = countQ.neq('source', 'fullbay')
  }
  if (excludeStatuses) {
    for (const s of excludeStatuses.split(',').map(s => s.trim())) {
      q = q.not('status', 'eq', s)
      countQ = countQ.not('status', 'eq', s)
    }
  }

  const limitedRoles = ['technician', 'maintenance_technician']
  if (limitedRoles.includes(role) && userTeam) {
    q = q.eq('team', userTeam)
    countQ = countQ.eq('team', userTeam)
  }
  if (status) {
    q = q.eq('status', status)
    countQ = countQ.eq('status', status)
  }
  if (team && !limitedRoles.includes(role)) {
    q = q.eq('team', team)
    countQ = countQ.eq('team', team)
  }

  const search = searchParams.get('q') || searchParams.get('search')
  if (search) {
    const [{ data: matchCust }, { data: matchAsset }] = await Promise.all([
      ctx.admin.from('customers').select('id').eq('shop_id', ctx.shopId).ilike('company_name', `%${search}%`),
      ctx.admin.from('assets').select('id').eq('shop_id', ctx.shopId).or(`unit_number.ilike.%${search}%,vin.ilike.%${search}%`),
    ])
    const custIds = (matchCust || []).map((c: any) => c.id)
    const assetIds = (matchAsset || []).map((a: any) => a.id)
    const orParts = [`so_number.ilike.%${search}%`, `complaint.ilike.%${search}%`]
    if (custIds.length > 0) orParts.push(`customer_id.in.(${custIds.join(',')})`)
    if (assetIds.length > 0) orParts.push(`asset_id.in.(${assetIds.join(',')})`)
    q = q.or(orParts.join(','))
    countQ = countQ.or(orParts.join(','))
  }

  const wantsPaginated = !!searchParams.get('page')
  if (wantsPaginated) {
    const [{ data, error }, { count: total }] = await Promise.all([q, countQ])
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data || [], total: total || 0, page, limit, totalPages: Math.ceil((total || 0) / limit) })
  }

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function _POST(req: Request) {
  const ctx = await requireRouteContext([...SERVICE_WRITE_ROLES])
  if (ctx.error || !ctx.admin || !ctx.actor || !ctx.shopId) return ctx.error!

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { asset_id, customer_id, complaint, cause, correction, source, priority, team, bay } = body
  if (!asset_id) return NextResponse.json({ error: 'Select a truck' }, { status: 400 })
  if (!complaint || complaint.trim().length === 0) return NextResponse.json({ error: 'Describe the complaint' }, { status: 400 })

  const { data: asset } = await ctx.admin.from('assets').select('id, shop_id, unit_number').eq('id', asset_id).single()
  if (!asset || asset.shop_id !== ctx.shopId) return NextResponse.json({ error: 'Invalid asset' }, { status: 400 })
  if (customer_id) {
    const { data: customer } = await ctx.admin.from('customers').select('id, shop_id').eq('id', customer_id).single()
    if (!customer || customer.shop_id !== ctx.shopId) return NextResponse.json({ error: 'Invalid customer' }, { status: 400 })
  }

  const { data: so, error } = await insertServiceOrder(ctx.admin, ctx.shopId, {
    asset_id,
    customer_id: customer_id || null,
    complaint: complaint.trim(),
    cause: cause || null,
    correction: correction || null,
    source: source || 'walk_in',
    priority: priority || 'normal',
    team: team || null,
    bay: bay || null,
    status: 'draft',
    advisor_id: ctx.actor.id,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  try {
    await notifyRole({ shopId: ctx.shopId, role: ['shop_manager', 'maintenance_manager'], title: `New ${so.so_number} — Truck #${asset.unit_number || '?'}`, body: complaint.trim().slice(0, 100), link: `/orders/${so.id}` })
  } catch {}

  return NextResponse.json(so, { status: 201 })
}

export const GET = safeRoute(_GET)
export const POST = safeRoute(_POST)
