import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/server-auth'
import { requireRouteContext } from '@/lib/api-route-auth'
import { logAction } from '@/lib/services/auditLog'

const TRASH_TABLES = [
  { table: 'service_orders', type: 'Work Order', nameCol: 'so_number', extraCols: 'complaint' },
  { table: 'customers', type: 'Customer', nameCol: 'company_name', extraCols: 'contact_name, email' },
  { table: 'assets', type: 'Truck', nameCol: 'unit_number', extraCols: 'year, make, model, vin' },
  { table: 'parts', type: 'Part', nameCol: 'part_number', extraCols: 'description, category' },
  { table: 'users', type: 'Staff', nameCol: 'full_name', extraCols: 'email, role' },
  { table: 'service_requests', type: 'Service Request', nameCol: 'id', extraCols: 'description, status' },
  { table: 'estimates', type: 'Estimate', nameCol: 'estimate_number', extraCols: 'total, status' },
  { table: 'invoices', type: 'Invoice', nameCol: 'invoice_number', extraCols: 'total, status' },
  { table: 'purchase_orders', type: 'Purchase Order', nameCol: 'po_number', extraCols: 'status, vendor_name' },
  { table: 'parts_requests', type: 'Parts Request', nameCol: 'id', extraCols: 'part_description, status' },
  { table: 'so_time_entries', type: 'Time Entry', nameCol: 'id', extraCols: 'hours, created_at' },
  { table: 'kiosk_checkins', type: 'Kiosk Check-in', nameCol: 'id', extraCols: 'customer_name, created_at' },
] as const

const ALLOWED_ROLES = ['owner', 'gm', 'it_person', 'shop_manager', 'floor_supervisor', 'service_writer', 'office_admin']

// Trash routes are shop-scoped operational tools for the roles in
// ALLOWED_ROLES. Body/query shop_id and user_id are no longer trusted —
// shop scope and audit attribution come from the server session.

// GET — fetch all soft-deleted items
export async function GET(req: Request) {
  const ctx = await requireRouteContext([...ALLOWED_ROLES])
  if (ctx.error || !ctx.actor) return ctx.error!
  const shopId = ctx.actor.effective_shop_id || ctx.actor.shop_id
  if (!shopId) return NextResponse.json({ error: 'No shop context' }, { status: 400 })

  const s = createAdminSupabaseClient()
  const { searchParams } = new URL(req.url)
  const filterType = searchParams.get('type') // optional filter by entity type

  const results: any[] = []

  for (const def of TRASH_TABLES) {
    if (filterType && filterType !== 'all' && def.type !== filterType) continue

    const cols = `id, ${def.nameCol}, ${def.extraCols}, deleted_at, shop_id`
    const shopCol = def.table === 'users' ? 'shop_id' : 'shop_id'

    const { data } = await s
      .from(def.table)
      .select(cols)
      .eq(shopCol, shopId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .limit(100)

    if (data) {
      for (const r of data) {
        const row = r as any
        const name = row[def.nameCol] || row.id
        results.push({
          id: row.id,
          table: def.table,
          type: def.type,
          name: String(name),
          details: row,
          deleted_at: row.deleted_at,
          days_remaining: Math.max(0, 45 - Math.floor((Date.now() - new Date(row.deleted_at).getTime()) / (1000 * 60 * 60 * 24))),
        })
      }
    }
  }

  // Sort by deleted_at descending
  results.sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime())

  return NextResponse.json({ data: results })
}

// POST — restore item
export async function POST(req: Request) {
  const ctx = await requireRouteContext([...ALLOWED_ROLES])
  if (ctx.error || !ctx.actor) return ctx.error!
  const shopId = ctx.actor.effective_shop_id || ctx.actor.shop_id
  if (!shopId) return NextResponse.json({ error: 'No shop context' }, { status: 400 })

  const s = createAdminSupabaseClient()
  const body = await req.json().catch(() => ({}))
  const { table, id } = body

  if (!table || !id) {
    return NextResponse.json({ error: 'table and id required' }, { status: 400 })
  }

  const validTable = TRASH_TABLES.find(t => t.table === table)
  if (!validTable) return NextResponse.json({ error: 'Invalid table' }, { status: 400 })

  const { error } = await s
    .from(table)
    .update({ deleted_at: null })
    .eq('id', id)
    .eq('shop_id', shopId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  logAction({
    shop_id: shopId, user_id: ctx.actor.id,
    action: 'trash.restore',
    entity_type: validTable.type,
    entity_id: id,
    details: { table },
  }).catch(() => {})

  return NextResponse.json({ success: true })
}

// DELETE — permanently delete item
export async function DELETE(req: Request) {
  const ctx = await requireRouteContext([...ALLOWED_ROLES])
  if (ctx.error || !ctx.actor) return ctx.error!
  const shopId = ctx.actor.effective_shop_id || ctx.actor.shop_id
  if (!shopId) return NextResponse.json({ error: 'No shop context' }, { status: 400 })

  const s = createAdminSupabaseClient()
  const { searchParams } = new URL(req.url)
  const table = searchParams.get('table')
  const id = searchParams.get('id')

  if (!table || !id) {
    return NextResponse.json({ error: 'table and id required' }, { status: 400 })
  }

  const validTable = TRASH_TABLES.find(t => t.table === table)
  if (!validTable) return NextResponse.json({ error: 'Invalid table' }, { status: 400 })

  const { error } = await s
    .from(table)
    .delete()
    .eq('id', id)
    .eq('shop_id', shopId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  logAction({
    shop_id: shopId, user_id: ctx.actor.id,
    action: 'trash.permanent_delete',
    entity_type: validTable.type,
    entity_id: id,
    details: { table },
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
