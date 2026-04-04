/**
 * TruckZen — Maintenance CRUD API for maint_* tables
 * Hardened: session auth, session-derived shop, role guard, table allowlist
 */
import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'

const ALLOWED_TABLES = new Set([
  'maint_road_repairs', 'maint_road_repair_lines', 'maint_purchase_orders', 'maint_po_lines',
  'maint_pm_schedules', 'maint_pm_completions', 'maint_inspections', 'maint_inspection_items',
  'maint_issues', 'maint_faults', 'maint_fuel_entries', 'maint_meters',
  'maint_service_programs', 'maint_service_reminders', 'maint_recalls',
  'maint_warranties', 'maint_warranty_claims', 'maint_expenses',
  'maint_vehicle_renewals', 'maint_contact_renewals', 'maint_documents',
  'maint_vendors', 'maint_activity_log', 'maint_parts',
])

const ALLOWED_ROLES = [
  'owner', 'gm', 'it_person', 'shop_manager', 'office_admin',
  'maintenance_manager', 'fleet_manager', 'maintenance_technician',
  'service_manager', 'service_writer',
]

function validateTable(table: string | null): string | null {
  if (!table) return 'table required'
  if (!table.startsWith('maint_')) return 'Only maint_* tables allowed'
  if (!ALLOWED_TABLES.has(table)) return `Table ${table} not in allowlist`
  return null
}

export async function GET(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)
  if (!ALLOWED_ROLES.includes(actor.role) && !actor.is_platform_owner) return jsonError('Forbidden', 403)

  const { searchParams } = new URL(req.url)
  const table = searchParams.get('table')
  const tableErr = validateTable(table)
  if (tableErr) return jsonError(tableErr, 400)

  const select = searchParams.get('select') || '*'
  const page = Math.max(parseInt(searchParams.get('page') || '1'), 1)
  const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 50)
  const search = searchParams.get('q')
  const searchCols = searchParams.get('search_cols')
  const orderBy = searchParams.get('order_by') || 'created_at'
  const orderAsc = searchParams.get('order_asc') === 'true'
  const filterKey = searchParams.get('filter_key')
  const filterVal = searchParams.get('filter_val')

  const s = createAdminSupabaseClient()
  const offset = (page - 1) * limit
  let q = s.from(table!).select(select, { count: 'exact' }).eq('shop_id', shopId)

  if (filterKey && filterVal && filterVal !== 'all') q = q.eq(filterKey, filterVal)
  if (search && searchCols) {
    const clauses = searchCols.split(',').map(c => `${c.trim()}.ilike.%${search}%`).join(',')
    q = q.or(clauses)
  }

  q = q.order(orderBy, { ascending: orderAsc }).range(offset, offset + limit - 1)
  const { data, count, error } = await q

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data || [], total: count || 0, page, limit, totalPages: Math.ceil((count || 0) / limit) })
}

export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)
  if (!ALLOWED_ROLES.includes(actor.role) && !actor.is_platform_owner) return jsonError('Forbidden', 403)

  const { table, ...row } = await req.json()
  const tableErr = validateTable(table)
  if (tableErr) return jsonError(tableErr, 400)

  // Force shop_id from session
  row.shop_id = shopId

  const s = createAdminSupabaseClient()

  // Auto-generate repair/PO numbers
  if (table === 'maint_road_repairs' && !row.repair_number) {
    const { count } = await s.from('maint_road_repairs').select('*', { count: 'exact', head: true }).eq('shop_id', shopId)
    row.repair_number = `RR-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`
  }
  if (table === 'maint_purchase_orders' && !row.po_number) {
    const { count } = await s.from('maint_purchase_orders').select('*', { count: 'exact', head: true }).eq('shop_id', shopId)
    row.po_number = `PO-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`
  }

  const { data, error } = await s.from(table).insert(row).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)
  if (!ALLOWED_ROLES.includes(actor.role) && !actor.is_platform_owner) return jsonError('Forbidden', 403)

  const { table, id, ...updates } = await req.json()
  const tableErr = validateTable(table)
  if (tableErr || !id) return jsonError(tableErr || 'id required', 400)

  // Prevent overriding shop_id
  delete updates.shop_id

  updates.updated_at = new Date().toISOString()
  const s = createAdminSupabaseClient()
  const { data, error } = await s.from(table).update(updates).eq('id', id).eq('shop_id', shopId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)
  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)
  if (!ALLOWED_ROLES.includes(actor.role) && !actor.is_platform_owner) return jsonError('Forbidden', 403)

  const { table, id } = await req.json()
  const tableErr = validateTable(table)
  if (tableErr || !id) return jsonError(tableErr || 'id required', 400)

  const s = createAdminSupabaseClient()
  const { error } = await s.from(table).delete().eq('id', id).eq('shop_id', shopId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
