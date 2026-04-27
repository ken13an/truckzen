import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isNativeShellRequest, shouldRedirectForNativeShell, NATIVE_COOKIE } from '@/lib/native-shell'
import { rateLimit } from '@/lib/ratelimit/core'

function getRequestIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() || 'unknown'
  return req.headers.get('x-real-ip') || 'unknown'
}

const PUBLIC_FILE = /\.(.*)$/
const PUBLIC_PATHS = [
  '/login', '/register', '/forgot-password', '/reset-password', '/privacy', '/terms', '/support', '/robots.txt',
  '/portal', '/pay', '/kiosk', '/smart-drop', '/accept-invite', '/api/health', '/api/auth/login', '/api/auth/2fa',
  '/api/accept-invite', '/api/portal', '/api/pay', '/api/kiosk', '/api/kiosk-checkin', '/api/stripe/webhook', '/api/platform-admin/registrations',
]

function isPublicPath(pathname: string) {
  if (pathname === '/') return true
  // Customer portal submits approve/decline from an email link without a session
  // cookie. The /api/estimates/{id}/respond handler is token-guarded internally
  // (checks estimate.approval_token !== token). Narrow regex — the dynamic id
  // segment prevents a PUBLIC_PATHS prefix match.
  // /pdf is intentionally NOT allowed here: it has no token check and the current
  // customer email links to /portal/estimate/{token}, not to /pdf. Staff keep PDF
  // access via session cookie.
  if (/^\/api\/estimates\/[^\/]+\/respond$/.test(pathname)) return true
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

function hasSessionCookie(req: NextRequest) {
  if (req.cookies.has('tz_session_token')) return true
  return req.cookies.getAll().some((cookie) => cookie.name.startsWith('sb-'))
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Global per-IP floor for all /api/* traffic. Runs before auth so floods
  // are rejected cheaply. Route-level limiters still run on top of this.
  if (pathname.startsWith('/api/')) {
    const ip = getRequestIp(req)
    const floor = await rateLimit('api-floor', ip)
    if (!floor.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }
  }

  // Native-shell suppression: block public marketing/acquisition entry points
  // inside the iOS/Android WebView app. Browser users never match and are
  // unaffected. Apple 4.2 / 3.1.1 mitigation.
  const native = isNativeShellRequest(req)
  if (native && shouldRedirectForNativeShell(pathname)) {
    const loginUrl = new URL('/login', req.url)
    const res = NextResponse.redirect(loginUrl)
    res.cookies.set(NATIVE_COOKIE, '1', { path: '/', sameSite: 'lax', httpOnly: false })
    return res
  }
  if (native && !req.cookies.has(NATIVE_COOKIE)) {
    // First request carries UA or ?shell=native — persist the marker so internal
    // navigation keeps being recognized as native even if the query drops.
    const res = NextResponse.next()
    res.cookies.set(NATIVE_COOKIE, '1', { path: '/', sameSite: 'lax', httpOnly: false })
    return res
  }

  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || PUBLIC_FILE.test(pathname) || isPublicPath(pathname)) {
    return NextResponse.next()
  }

  if (!hasSessionCookie(req)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const res = NextResponse.next()
  res.headers.set('x-truckzen-auth-gate', 'on')
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
