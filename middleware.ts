import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isNativeShellRequest, shouldRedirectForNativeShell, NATIVE_COOKIE } from '@/lib/native-shell'

const PUBLIC_FILE = /\.(.*)$/
const PUBLIC_PATHS = [
  '/login', '/register', '/forgot-password', '/reset-password', '/privacy', '/terms', '/support', '/robots.txt',
  '/portal', '/pay', '/kiosk', '/smart-drop', '/accept-invite', '/api/health', '/api/auth/login', '/api/auth/2fa',
  '/api/accept-invite', '/api/portal', '/api/pay', '/api/stripe/webhook', '/api/platform-admin/registrations',
]

function isPublicPath(pathname: string) {
  if (pathname === '/') return true
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

function hasSessionCookie(req: NextRequest) {
  if (req.cookies.has('tz_session_token')) return true
  return req.cookies.getAll().some((cookie) => cookie.name.startsWith('sb-'))
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

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
