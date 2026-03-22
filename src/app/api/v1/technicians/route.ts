/**
 * TruckZen Public API v1 — Technicians/mechanics
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
    table: 'users',
    select: 'id, full_name, email, role, team, active, created_at',
    shopId: auth.shopId,
    page: parseInt(searchParams.get('page') || '1'),
    limit: parseInt(searchParams.get('limit') || '100'),
    filters: { active: true },
    orderBy: { column: 'full_name', ascending: true },
  })

  if (result.error) return apiError('QUERY_ERROR', result.error.message, 500)
  return apiSuccess(result.data, { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages })
}
