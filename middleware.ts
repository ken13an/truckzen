import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_FILE = /\.(.*)$/
const PUBLIC_PATHS = [
  '/login', '/register', '/forgot-password', '/reset-password', '/privacy', '/terms', '/support', '/robots.txt',
  '/portal', '/pay', '/kiosk', '/smart-drop', '/api/health', '/api/auth/login', '/api/auth/2fa',
  '/api/portal', '/api/pay', '/api/stripe/webhook', '/api/platform-admin/registrations',
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
