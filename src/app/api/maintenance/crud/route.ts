/**
 * TruckZen — Original Design
 * Generic CRUD API for all maint_* tables
 * Handles: GET (list with pagination), POST (create), PATCH (update), DELETE
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const s = db()
  const { searchParams } = new URL(req.url)
  const table = searchParams.get('table')
  const shopId = searchParams.get('shop_id')
  const select = searchParams.get('select') || '*'
  const page = Math.max(parseInt(searchParams.get('page') || '1'), 1)
  const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 5000)
  const search = searchParams.get('q')
  const searchCols = searchParams.get('search_cols')
  const orderBy = searchParams.get('order_by') || 'created_at'
  const orderAsc = searchParams.get('order_asc') === 'true'
  const filterKey = searchParams.get('filter_key')
  const filterVal = searchParams.get('filter_val')

  if (!table || !shopId) return NextResponse.json({ error: 'table and shop_id required' }, { status: 400 })
  if (!table.startsWith('maint_')) return NextResponse.json({ error: 'Only maint_* tables allowed' }, { status: 403 })

  const offset = (page - 1) * limit
  let q = s.from(table).select(select, { count: 'exact' }).eq('shop_id', shopId)

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
  const s = db()
  const { table, ...row } = await req.json()
  if (!table?.startsWith('maint_')) return NextResponse.json({ error: 'Only maint_* tables' }, { status: 403 })

  // Auto-generate repair/PO numbers
  if (table === 'maint_road_repairs' && !row.repair_number && row.shop_id) {
    const { count } = await s.from('maint_road_repairs').select('*', { count: 'exact', head: true }).eq('shop_id', row.shop_id)
    row.repair_number = `RR-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`
  }
  if (table === 'maint_purchase_orders' && !row.po_number && row.shop_id) {
    const { count } = await s.from('maint_purchase_orders').select('*', { count: 'exact', head: true }).eq('shop_id', row.shop_id)
    row.po_number = `PO-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`
  }

  const { data, error } = await s.from(table).insert(row).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: Request) {
  const s = db()
  const { table, id, ...updates } = await req.json()
  if (!table?.startsWith('maint_') || !id) return NextResponse.json({ error: 'table and id required' }, { status: 400 })
  updates.updated_at = new Date().toISOString()
  const { data, error } = await s.from(table).update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const s = db()
  const { table, id } = await req.json()
  if (!table?.startsWith('maint_') || !id) return NextResponse.json({ error: 'table and id required' }, { status: 400 })
  const { error } = await s.from(table).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
