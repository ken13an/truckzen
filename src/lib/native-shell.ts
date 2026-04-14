// Canonical native-shell (iOS/Android app WebView) detection.
// Single source of truth used by middleware to suppress public marketing paths
// in native app mode. Browsers never send any of these signals, so web users
// are unaffected.
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

// Paths that must not render inside the native app shell. Keep narrow —
// only public marketing / acquisition entry points. Authenticated operational
// routes are intentionally excluded.
export const NATIVE_BLOCKED_PATHS: ReadonlySet<string> = new Set([
  '/',
  '/register',
])

export function shouldRedirectForNativeShell(pathname: string): boolean {
  return NATIVE_BLOCKED_PATHS.has(pathname)
}
