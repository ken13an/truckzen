/**
 * TruckZen Public API v1 — Units (trucks/trailers)
 */
import { validateApiKey, apiError, apiSuccess } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'
import { paginatedQuery } from '@/lib/paginate'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const auth = await validateApiKey(req)
  if (!auth) return apiError('UNAUTHORIZED', 'Invalid or expired API key', 401)

  const { searchParams } = new URL(req.url)
  const filters: Record<string, any> = {}
  if (searchParams.get('customer_id')) filters.customer_id = searchParams.get('customer_id')
  if (searchParams.get('status')) filters.status = searchParams.get('status')

  const result = await paginatedQuery(db(), {
    table: 'assets',
    select: 'id, unit_number, vin, year, make, model, engine, odometer, status, unit_type, ownership_type, source, warranty_provider, warranty_expiry, warranty_mileage_limit, created_at',
    shopId: auth.shopId,
    page: parseInt(searchParams.get('page') || '1'),
    limit: parseInt(searchParams.get('limit') || '100'),
    filters,
    search: searchParams.get('search') ? { columns: ['unit_number', 'vin', 'make', 'model'], query: searchParams.get('search')! } : undefined,
    orderBy: { column: 'unit_number', ascending: true },
  })

  if (result.error) return apiError('QUERY_ERROR', result.error.message, 500)
  return apiSuccess(result.data, { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages })
}
