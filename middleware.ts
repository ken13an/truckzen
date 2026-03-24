import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = [
  '/login', '/setup', '/kiosk', '/portal', '/pay',
  '/api/telegram', '/api/stripe/webhook', '/api/kiosk',
  '/api/pay', '/offline', '/waiting', '/forgot-password', '/reset-password',
  '/api/work-orders', '/api/wo-', '/api/portal', '/api/kiosk-checkin', '/api/mechanic',
  '/privacy', '/terms', '/register', '/api-docs', '/api/v1',
]

// Module → route prefixes
const MODULE_ROUTES: Record<string, string[]> = {
  dashboard:        ['/dashboard'],
  kiosk_admin:      ['/kiosk-admin'],
  floor:            ['/floor', '/shop-floor'],
  orders:           ['/orders', '/work-orders', '/api/service-orders', '/api/work-orders', '/api/so-lines'],
  invoices:         ['/invoices', '/api/invoices'],
  parts:            ['/parts', '/api/parts'],
  fleet:            ['/fleet', '/api/assets'],
  drivers:          ['/drivers', '/api/drivers'],
  maintenance:      ['/maintenance'],
  tires:            ['/maintenance/tires', '/api/tires'],
  parts_lifecycle:  ['/maintenance/parts-lifecycle', '/api/parts-lifecycle'],
  compliance:       ['/compliance', '/api/compliance'],
  customers:        ['/customers', '/api/customers'],
  accounting:       ['/accounting'],
  reports:          ['/reports', '/api/reports'],
  time_tracking:    ['/time-tracking', '/api/time-tracking'],
  settings:         ['/settings'],
  import:           ['/settings/import', '/api/import'],
  admin_permissions:['/admin'],
  tech_mobile:      ['/tech'],
  dvir:             ['/dvir'],
  billing:          ['/settings/billing'],
  integrations:     ['/settings/integrations'],
  audit_log:        ['/settings/audit'],
}

// Default role → module access (kept in sync with lib/permissions.ts)
const UNLIMITED_ROLES = ['owner', 'gm', 'it_person']

const DEFAULT_PERMS: Record<string, string[]> = {
  shop_manager:           ['dashboard','floor','orders','invoices','parts','fleet','drivers','maintenance','tires','parts_lifecycle','compliance','customers','reports','time_tracking','settings','import','dvir','tech_mobile'],
  floor_manager:          ['dashboard','floor','orders','customers','fleet','parts','reports','time_tracking','settings'],
  service_writer:         ['dashboard','floor','orders','invoices','customers','parts'],
  technician:             ['floor','parts','time_tracking','tech_mobile','dvir'],
  parts_manager:          ['dashboard','floor','orders','parts','parts_lifecycle'],
  fleet_manager:          ['dashboard','fleet','drivers','maintenance','tires','parts_lifecycle','compliance','reports','dvir'],
  maintenance_manager:    ['dashboard','floor','parts','fleet','maintenance','tires','parts_lifecycle','compliance','reports','time_tracking','dvir'],
  maintenance_technician: ['floor','parts','maintenance','tires','parts_lifecycle','time_tracking','tech_mobile','dvir'],
  accountant:             ['dashboard','invoices','accounting','reports'],
  office_admin:           ['dashboard','floor','orders','invoices','customers','parts','accounting','reports','time_tracking','settings','import'],
  dispatcher:             ['dashboard','floor','fleet','drivers'],
  driver:                 ['dvir'],
  customer:               [],
}

function getModuleForPath(path: string): string | null {
  // Check specific paths first (longest match)
  const sorted = Object.entries(MODULE_ROUTES).sort((a, b) => {
    const maxA = Math.max(...a[1].map(r => r.length))
    const maxB = Math.max(...b[1].map(r => r.length))
    return maxB - maxA
  })
  for (const [mod, routes] of sorted) {
    if (routes.some(r => path.startsWith(r))) return mod
  }
  return null
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

  // Allow public routes
  if (PUBLIC_ROUTES.some(r => pathname.startsWith(r))) {
    if (pathname === '/login' && user) return NextResponse.redirect(new URL('/', request.url))
    return response
  }

  // API routes handle their own auth — skip middleware permission checks
  if (pathname.startsWith('/api/')) return response

  // Session inactivity timeout — 8 hours
  const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000
  if (user) {
    const lastActivity = request.cookies.get('tz_last_activity')?.value
    if (lastActivity) {
      const elapsed = Date.now() - parseInt(lastActivity, 10)
      if (elapsed > SESSION_TIMEOUT_MS) {
        // Session expired — sign out and redirect
        await supabase.auth.signOut()
        const loginUrl = new URL('/login?expired=1', request.url)
        const expiredResponse = NextResponse.redirect(loginUrl)
        expiredResponse.cookies.delete('tz_last_activity')
        return expiredResponse
      }
    }
    // Update last activity timestamp
    response.cookies.set('tz_last_activity', String(Date.now()), {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_TIMEOUT_MS / 1000,
    })
  }

  // Single-device session enforcement (check every 60 seconds)
  if (user) {
    const sessionToken = request.cookies.get('tz_session_token')?.value
    const lastChecked = request.cookies.get('tz_session_checked')?.value
    const now = Date.now()
    const shouldCheck = !lastChecked || (now - parseInt(lastChecked, 10)) > 60000

    if (sessionToken && shouldCheck) {
      try {
        const checkRes = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=session_token`,
          { headers: { 'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!, 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}` } }
        )
        const rows = await checkRes.json()
        const dbToken = rows?.[0]?.session_token

        if (dbToken && dbToken !== sessionToken) {
          // Session was replaced by another device
          await supabase.auth.signOut()
          const replacedResponse = NextResponse.redirect(new URL('/login?reason=session_replaced', request.url))
          replacedResponse.cookies.delete('tz_session_token')
          replacedResponse.cookies.delete('tz_session_checked')
          replacedResponse.cookies.delete('tz_last_activity')
          return replacedResponse
        }
      } catch {}

      // Update last check timestamp
      response.cookies.set('tz_session_checked', String(now), {
        path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 3600,
      })
    }
  }

  // Homepage — platform owners go to /platform-admin, others to /dashboard
  if (pathname === '/') {
    if (user) {
      const { data: po } = await supabase.from('users').select('is_platform_owner').eq('id', user.id).single()
      if (po?.is_platform_owner) return NextResponse.redirect(new URL('/platform-admin', request.url))
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return response
  }

  // Redirect old /orders routes to /work-orders
  if (pathname.startsWith('/orders')) {
    const newPath = pathname.replace('/orders', '/work-orders')
    return NextResponse.redirect(new URL(newPath, request.url))
  }

  // Mechanic + Floor Manager dashboards — accessible to logged-in users (pages handle role checks)
  if (pathname.startsWith('/mechanic') || pathname.startsWith('/floor-manager')) {
    if (!user) return NextResponse.redirect(new URL('/login', request.url))
    return response
  }

  // Not logged in → login
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  // Platform owner — can access any route (checked early to avoid profile/role gates)
  {
    const { data: po } = await supabase.from('users').select('is_platform_owner').eq('id', user.id).single()
    if (po?.is_platform_owner) return response
  }

  // Non-platform-owners cannot access /platform-admin
  if (pathname.startsWith('/platform-admin')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Get user profile
  const { data: profile } = await supabase.from('users').select('role, shop_id, is_active').eq('id', user.id).single()
  if (!profile) return NextResponse.redirect(new URL('/login', request.url))

  // Deactivated user — force logout
  if (profile.is_active === false) {
    await supabase.auth.signOut()
    const disabledResponse = NextResponse.redirect(new URL('/login?reason=account_disabled', request.url))
    disabledResponse.cookies.delete('tz_last_activity')
    return disabledResponse
  }

  // Unlimited roles can access everything
  if (UNLIMITED_ROLES.includes(profile.role)) {
    // Check setup
    const { data: shop } = await supabase.from('shops').select('setup_complete').eq('id', profile.shop_id).single()
    if (shop && !shop.setup_complete && pathname !== '/setup') return NextResponse.redirect(new URL('/setup', request.url))
    return response
  }

  // Check setup for other roles
  const { data: shop } = await supabase.from('shops').select('setup_complete').eq('id', profile.shop_id).single()
  if (shop && !shop.setup_complete) return NextResponse.redirect(new URL('/waiting', request.url))

  // Root path → redirect to role's default page
  if (pathname === '/') {
    const redirect = DEFAULT_PERMS[profile.role]?.[0] || 'dashboard'
    const mod = Object.entries(MODULE_ROUTES).find(([k]) => k === redirect)
    return NextResponse.redirect(new URL(mod?.[1]?.[0] || '/dashboard', request.url))
  }

  // Check module access
  const module = getModuleForPath(pathname)
  if (!module) return response // Unknown routes pass through

  const defaultAllowed = DEFAULT_PERMS[profile.role]?.includes(module) ?? false

  // Check DB overrides (user-level first, then role-level)
  const { data: userOverride } = await supabase.from('user_permission_overrides')
    .select('allowed').eq('user_id', user.id).eq('module', module).single()

  if (userOverride) {
    if (!userOverride.allowed) return NextResponse.redirect(new URL('/403', request.url))
    return response
  }

  const { data: roleOverride } = await supabase.from('role_permissions')
    .select('allowed').eq('shop_id', profile.shop_id).eq('role', profile.role).eq('module', module).single()

  if (roleOverride) {
    if (!roleOverride.allowed) return NextResponse.redirect(new URL('/403', request.url))
    return response
  }

  // Use default
  if (!defaultAllowed) return NextResponse.redirect(new URL('/403', request.url))

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|icon-|apple-touch-icon|splash-|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
