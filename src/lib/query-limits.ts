/**
 * TruckZen — Canonical query limits for list endpoints.
 * Every list API should use these instead of inline magic numbers.
 */

/** Default number of rows per page when no limit is specified */
export const DEFAULT_PAGE_LIMIT = 50

/** Maximum rows any single list request may return */
export const MAX_PAGE_LIMIT = 100

/** Parse and clamp page/limit from search params */
export function parsePageParams(searchParams: URLSearchParams) {
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1)
  const limit = Math.min(
    Math.max(parseInt(searchParams.get('limit') || searchParams.get('per_page') || String(DEFAULT_PAGE_LIMIT), 10), 1),
    MAX_PAGE_LIMIT,
  )
  const offset = (page - 1) * limit
  return { page, limit, offset }
}
