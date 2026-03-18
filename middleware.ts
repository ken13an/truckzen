// ============================================================
// middleware.ts — Auth protection + role routing
// Place at: /middleware.ts (project root, next to package.json)
// ============================================================

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that don't need authentication
const PUBLIC_ROUTES = [
  '/login',
  '/setup',
  '/kiosk',
  '/portal',     // customer portal (uses token auth)
  '/api/telegram',
  '/api/stripe/webhook',
  '/api/kiosk',
]

// Role → allowed route prefixes
const ROLE_ROUTES: Record<string, string[]> = {
  owner:                   ['/'],         // everything
  gm:                      ['/'],         // everything
  it_person:               ['/'],         // everything
  shop_manager:            ['/', '/fleet', '/customers', '/technicians', '/pm'],
  service_advisor:         ['/orders', '/customers', '/floor', '/aiwriter', '/invoices'],
  service_writer:          ['/orders', '/customers', '/floor', '/aiwriter'],
  technician:              ['/floor', '/aiwriter', '/dvir'],
  parts_manager:           ['/parts', '/orders'],
  fleet_manager:           ['/fleet', '/drivers', '/compliance', '/maintenance', '/pm'],
  maintenance_manager:     ['/maintenance', '/pm', '/fleet'],
  maintenance_technician:  ['/maintenance', '/dvir'],
  accountant:              ['/invoices', '/accounting', '/reports'],
  office_admin:            ['/customers', '/invoices', '/settings'],
  dispatcher:              ['/fleet', '/drivers'],
  driver:                  ['/dvir'],
  customer:                ['/portal'],
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Allow public routes without auth
  if (PUBLIC_ROUTES.some(r => pathname.startsWith(r))) {
    // Redirect logged-in users away from login page
    if (pathname === '/login' && user) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return response
  }

  // Not logged in → redirect to login
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Check if first-time setup is needed
  const { data: shop } = await supabase
    .from('shops')
    .select('setup_complete')
    .single()

  if (shop && !shop.setup_complete && pathname !== '/setup') {
    // Only office_admin and owner can complete setup
    const { data: profile } = await supabase
      .from('users').select('role').eq('id', user.id).single()

    if (profile?.role === 'office_admin' || profile?.role === 'owner') {
      return NextResponse.redirect(new URL('/setup', request.url))
    } else {
      // Other users see a "waiting for setup" page
      return NextResponse.redirect(new URL('/waiting', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
