// Canonical native-shell (iOS/Android app WebView) detection.
// Single source of truth used by middleware to suppress public marketing and
// customer-token-public routes in native app mode. Browsers never send any of
// these signals, so web users are unaffected.
import type { NextRequest } from 'next/server'

export const NATIVE_COOKIE = 'tz_native'
export const NATIVE_UA_MARKER = 'TruckZenNativeShell'
export const NATIVE_QUERY_PARAM = 'shell'
export const NATIVE_QUERY_VALUE = 'native'

export function isNativeShellRequest(req: NextRequest): boolean {
  const ua = req.headers.get('user-agent') || ''
  if (ua.includes(NATIVE_UA_MARKER)) return true
  if (req.cookies.get(NATIVE_COOKIE)?.value === '1') return true
  if (req.nextUrl.searchParams.get(NATIVE_QUERY_PARAM) === NATIVE_QUERY_VALUE) return true
  return false
}

// Exact paths that must not render inside the native app shell — public
// marketing / acquisition / legal / password-reset / invite-acceptance entry
// points. /login is intentionally NOT blocked: it is the redirect sink used by
// this module and blocking it would infinite-loop. Stripping marketing chrome
// from /login itself is a separate concern out of scope here.
export const NATIVE_BLOCKED_PATHS: ReadonlySet<string> = new Set([
  '/',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/privacy',
  '/terms',
  '/support',
  '/accept-invite',
])

// Prefix families that must not render inside native. Every path starting with
// one of these strings (followed by '/' or end-of-string) is blocked. Covers
// token-public customer surfaces and in-shop kiosk flows that are not intended
// for the authenticated fleet worker running the app.
export const NATIVE_BLOCKED_PREFIXES: readonly string[] = [
  '/portal',
  '/pay',
  '/kiosk',
  '/smart-drop',
]

export function shouldRedirectForNativeShell(pathname: string): boolean {
  if (NATIVE_BLOCKED_PATHS.has(pathname)) return true
  for (const p of NATIVE_BLOCKED_PREFIXES) {
    if (pathname === p || pathname.startsWith(p + '/')) return true
  }
  return false
}
