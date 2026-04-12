/**
 * TruckZen — Canonical Role Landing Resolution
 *
 * Single source of truth for "where does this role land after switch/login/redirect".
 * Wraps the authoritative ROLE_REDIRECT map in src/lib/permissions.ts — which was
 * already used by login post-auth and the admin roles-guide. Before centralization,
 * RoleSwitcher.tsx and dashboard/page.tsx each maintained their own drifted copies,
 * which caused wrong-destination bugs after role switch/impersonation for roles
 * missing from the local copies (floor_manager, accounting_manager, etc).
 *
 * All role-switch / landing redirect logic MUST go through this helper.
 */
import { ROLE_REDIRECT } from '@/lib/permissions'

/**
 * Resolve the landing route for a given role.
 *
 * - Pass the effective role (impersonate_role || role) the user is acting as.
 * - Never throws. Returns '/dashboard' as the universal fallback so the app
 *   never lands on an undefined route.
 * - The returned value is a pathname string. Never a full URL, never a next
 *   router action.
 */
export function getRoleLandingRoute(role: string | null | undefined): string {
  if (!role) return '/dashboard'
  return ROLE_REDIRECT[role] || '/dashboard'
}

/**
 * Decide whether a user visiting /dashboard should be auto-redirected to their
 * role-specific landing.
 *
 * Returns:
 *   - the target pathname (string) if the role has a non-dashboard landing
 *   - null if the role belongs on /dashboard (owner, gm, it_person, office_admin, etc.)
 *
 * This preserves the prior dashboard/page.tsx behavior exactly, but derives it
 * from the same canonical ROLE_REDIRECT map as everywhere else.
 */
export function shouldRedirectFromDashboard(role: string | null | undefined): string | null {
  if (!role) return null
  const landing = ROLE_REDIRECT[role]
  if (!landing || landing === '/dashboard') return null
  return landing
}
