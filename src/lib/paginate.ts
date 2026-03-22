/**
 * TruckZen — Original Design
 * Server-side pagination helper for Supabase queries
 * RULE: Every list page uses this. No exceptions.
 */

interface PaginateOptions {
  table: string
  select: string
  shopId: string
  page?: number
  limit?: number
  search?: { columns: string[]; query: string }
  filters?: Record<string, any>
  orFilters?: string // raw OR filter string for Supabase
  orderBy?: { column: string; ascending?: boolean }
  notFilters?: Record<string, string> // e.g. { status: '("void")' }
}

export async function paginatedQuery(supabase: any, options: PaginateOptions) {
  const page = Math.max(options.page || 1, 1)
  const limit = Math.min(options.limit || 25, 100)
  const offset = (page - 1) * limit

  let query = supabase
    .from(options.table)
    .select(options.select, { count: 'exact' })
    .eq('shop_id', options.shopId)

  if (options.filters) {
    for (const [key, value] of Object.entries(options.filters)) {
      if (value !== undefined && value !== null && value !== 'all') {
        query = query.eq(key, value)
      }
    }
  }

  if (options.notFilters) {
    for (const [key, value] of Object.entries(options.notFilters)) {
      query = query.not(key, 'in', value)
    }
  }

  if (options.orFilters) {
    query = query.or(options.orFilters)
  }

  if (options.search?.query && options.search.query.length >= 2) {
    const clauses = options.search.columns.map(col => `${col}.ilike.%${options.search!.query}%`).join(',')
    query = query.or(clauses)
  }

  const orderCol = options.orderBy?.column || 'created_at'
  query = query.order(orderCol, { ascending: options.orderBy?.ascending ?? false })
  query = query.range(offset, offset + limit - 1)

  const { data, count, error } = await query

  return {
    data: data || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
    error,
  }
}
