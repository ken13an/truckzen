/**
 * TruckZen — Canonical Workorder Navigation
 *
 * Single source of truth for resolving workorder destinations and effective navigation
 * context. All WO entry points (dashboard rows, cards, links, notifications, quick view,
 * mechanic job opens, etc.) MUST go through getWorkorderRoute().
 *
 * Why this exists:
 *   - Prior to centralization, every WO entry point hardcoded `/work-orders/${id}`.
 *   - Any future role/department/mode-specific routing divergence would scatter bugs across
 *     30+ files. Centralizing here means one change, one place.
 *
 * Rules:
 *   - Do NOT read localStorage, cookies, or other side channels from this module.
 *   - The caller passes an explicit `context` (or user) — no hidden side-effects.
 *   - Returns a pathname string only. Never a full URL, never a Next router action.
 */
import { ROUTES } from '@/lib/config/navigation'

export interface EffectiveNavigationContext {
  effectiveRole: string
  isImpersonating: boolean
  actualRole: string
}

/**
 * Resolve the effective navigation context for a user.
 *
 * Pass the profile object already fetched by the page (shape: { role, impersonate_role })
 * — this helper does not fetch anything.
 *
 * Canonical rule (matches server-auth.ts / route-guards.ts / Sidebar.tsx):
 *   effectiveRole = impersonate_role || role
 */
export function resolveEffectiveNavigationContext(
  user: { role?: string | null; impersonate_role?: string | null } | null | undefined,
): EffectiveNavigationContext {
  const actualRole = user?.role || ''
  const impersonate = user?.impersonate_role || null
  const effectiveRole = impersonate || actualRole
  return {
    effectiveRole,
    isImpersonating: !!impersonate && impersonate !== actualRole,
    actualRole,
  }
}

export type WorkorderNavSource =
  | 'dashboard'
  | 'service-dashboard'
  | 'accounting'
  | 'accounting-history'
  | 'floor-manager'
  | 'shop-floor'
  | 'mechanic'
  | 'notification'
  | 'history'
  | 'parts'
  | 'invoice'
  | 'customer'
  | 'fleet'
  | 'maintenance'
  | 'warranty'
  | 'service-request'
  | 'link'

/**
 * Canonical workorder destination resolver.
 *
 * Returns the pathname string for a given workorder ID. Currently all callers land on
 * the same `/work-orders/{id}` route regardless of role/department — this function is
 * the single place that will change if that ever diverges.
 *
 * Never returns null/undefined — always a valid path string.
 */
export function getWorkorderRoute(
  workorderId: string,
  _context?: EffectiveNavigationContext,
  _source?: WorkorderNavSource,
): string {
  return ROUTES.WORK_ORDER_DETAIL(workorderId)
}

/**
 * Canonical "new workorder" route.
 * Accepts optional prefill query params (customer, unit) already used by existing
 * call sites.
 */
export function getNewWorkorderRoute(params?: { customer?: string; unit?: string }): string {
  const base = ROUTES.WORK_ORDER_NEW
  if (!params || (!params.customer && !params.unit)) return base
  const qs: string[] = []
  if (params.customer) qs.push(`customer=${encodeURIComponent(params.customer)}`)
  if (params.unit) qs.push(`unit=${encodeURIComponent(params.unit)}`)
  return `${base}?${qs.join('&')}`
}
