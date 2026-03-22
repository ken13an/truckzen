/**
 * TruckZen Public API v1 — Parts catalog
 */
import { validateApiKey, apiError, apiSuccess } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'
import { paginatedQuery } from '@/lib/paginate'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function GET(req: Request) {
  const auth = await validateApiKey(req)
  if (!auth) return apiError('UNAUTHORIZED', 'Invalid or expired API key', 401)

  const { searchParams } = new URL(req.url)
  const result = await paginatedQuery(db(), {
    table: 'parts',
    select: 'id, part_number, description, category, cost_price, sell_price, on_hand, reorder_point, vendor, bin_location, created_at',
    shopId: auth.shopId,
    page: parseInt(searchParams.get('page') || '1'),
    limit: parseInt(searchParams.get('limit') || '100'),
    search: searchParams.get('search') ? { columns: ['description', 'part_number', 'vendor'], query: searchParams.get('search')! } : undefined,
    orderBy: { column: 'description', ascending: true },
  })

  if (result.error) return apiError('QUERY_ERROR', result.error.message, 500)
  return apiSuccess(result.data, { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages })
}
