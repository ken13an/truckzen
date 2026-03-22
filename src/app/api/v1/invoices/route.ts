/**
 * TruckZen Public API v1 — Invoices
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
  if (searchParams.get('status')) filters.status = searchParams.get('status')

  const result = await paginatedQuery(db(), {
    table: 'invoices',
    select: 'id, invoice_number, status, subtotal, tax_amount, total, balance_due, amount_paid, due_date, paid_at, so_id, customer_id, created_at',
    shopId: auth.shopId,
    page: parseInt(searchParams.get('page') || '1'),
    limit: parseInt(searchParams.get('limit') || '100'),
    filters,
    orderBy: { column: 'created_at', ascending: false },
  })

  if (result.error) return apiError('QUERY_ERROR', result.error.message, 500)
  return apiSuccess(result.data, { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages })
}
