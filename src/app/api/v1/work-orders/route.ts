/**
 * TruckZen Public API v1 — Work Orders
 */
import { NextResponse } from 'next/server'
import { validateApiKey, apiError, apiSuccess } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const auth = await validateApiKey(req)
  if (!auth) return apiError('UNAUTHORIZED', 'Invalid or expired API key', 401)

  const { searchParams } = new URL(req.url)
  const s = db()
  const page = Math.max(parseInt(searchParams.get('page') || '1'), 1)
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500)
  const offset = (page - 1) * limit

  let q = s.from('service_orders')
    .select(`id, so_number, status, priority, complaint,
      grand_total, labor_total, parts_total, tax_total, mileage_at_service,
      created_at, updated_at, completed_at,
      assets(id, unit_number, vin, year, make, model),
      customers(id, company_name, contact_name),
      so_lines(id, line_type, description, rough_name, real_name, part_number, quantity, unit_price, total_price, parts_status, tire_position, estimated_hours, actual_hours, billed_hours)
    `, { count: 'exact' })
    .eq('shop_id', auth.shopId)
    .is('deleted_at', null)
    .neq('status', 'void')
    .order('created_at', { ascending: false })

  const status = searchParams.get('status')
  if (status && status !== 'all') q = q.eq('status', status)

  const fromDate = searchParams.get('from_date')
  const toDate = searchParams.get('to_date')
  if (fromDate) q = q.gte('created_at', fromDate)
  if (toDate) q = q.lte('created_at', toDate + 'T23:59:59Z')

  q = q.range(offset, offset + limit - 1)
  const { data, count, error } = await q

  if (error) return apiError('QUERY_ERROR', error.message, 500)
  const total = count || 0
  return apiSuccess(data || [], { total, page, limit, totalPages: Math.ceil(total / limit) })
}
