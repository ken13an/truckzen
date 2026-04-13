'use client'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import NotificationBell from '@/components/NotificationBell'
import RoleSwitcher from '@/components/RoleSwitcher'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { Menu, X, Search, Plus } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { COLORS } from '@/lib/config/colors'
import CommandPalette from '@/components/CommandPalette'

const FULL_SCREEN = ['/login', '/setup', '/kiosk', '/pay', '/portal', '/waiting', '/forgot-password', '/reset-password', '/tech', '/offline', '/403', '/mechanic', '/floor-manager', '/platform-admin', '/register']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { tokens: t } = useTheme()
  const pathname = usePathname()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [shopImpersonation, setShopImpersonation] = useState<{ shopName: string; originalShopId: string } | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('tz-sidebar-collapsed') === 'true'
    return false
  })
  useKeyboardShortcuts()

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const sync = () => setSidebarCollapsed(localStorage.getItem('tz-sidebar-collapsed') === 'true')
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  // Cmd+K / Ctrl+K / "/" to open command palette
  useEffect(() => {
    function handleCmdK(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCommandPaletteOpen(true); return }
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) { e.preventDefault(); setCommandPaletteOpen(true) }
    }
    window.addEventListener('keydown', handleCmdK)
    return () => window.removeEventListener('keydown', handleCmdK)
  }, [])

  // Close drawer on navigation
  useEffect(() => { setDrawerOpen(false) }, [pathname])

  useEffect(() => {
    getCurrentUser(supabase).then(async (p: any) => {
      if (!p) return
      setUser(p)
      const origShopId = localStorage.getItem('tz_original_shop_id')
      if (origShopId && origShopId !== p.shop_id) {
        const { data: shop } = await supabase.from('shops').select('name').eq('id', p.shop_id).single()
        setShopImpersonation({ shopName: shop?.name || 'Unknown Shop', originalShopId: origShopId })
      }
    })
  }, [])

  // Session refresh on foreground resume — prevents stale 401 after mobile background
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        // Session refreshed — no action needed, Supabase SDK handles cookies
      }
      if (event === 'SIGNED_OUT') {
        setUser(null)
      }
    })

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // App returned to foreground — trigger session refresh
        supabase.auth.getSession().catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  const isFullScreen = pathname === '/' || FULL_SCREEN.some(r => pathname?.startsWith(r))

  // Redirect authenticated users from public homepage to dashboard
  if (pathname === '/' && user) {
    window.location.href = '/dashboard'
    return null
  }

  if (isFullScreen) {
    return <>{children}</>
  }

  const effectiveRole = user?.impersonate_role || user?.role
  const isImpersonating = !!user?.impersonate_role

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: t.bg }}>
      {/* Desktop sidebar */}
      {!isMobile && <Sidebar />}

      {/* Mobile drawer overlay */}
      {isMobile && drawerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998, display: 'flex' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} onClick={() => setDrawerOpen(false)} />
          <div style={{ position: 'relative', zIndex: 1, width: 260, maxWidth: '80vw' }}>
            <Sidebar />
            <button onClick={() => setDrawerOpen(false)} style={{ position: 'absolute', top: 12, right: -44, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', color: t.bgLight }}>
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', transition: 'margin .2s ease' }}>
        {/* Shop impersonation banner */}
        {shopImpersonation && (
          <div style={{ background: 'rgba(232,105,42,.12)', borderBottom: '1px solid rgba(232,105,42,.25)', padding: '8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 12, color: COLORS.roleAccounting, fontWeight: 600 }}>
            <span>You are viewing <strong>{shopImpersonation.shopName}</strong> as Owner</span>
            <button onClick={async () => {
              await fetch('/api/platform-admin/impersonate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-original-shop-id': shopImpersonation.originalShopId },
                body: JSON.stringify({ user_id: user.id, action: 'stop' }),
              })
              localStorage.removeItem('tz_original_shop_id')
              window.location.href = '/platform-admin'
            }} style={{ background: COLORS.roleAccounting, border: 'none', borderRadius: 4, color: t.bgLight, fontSize: 10, cursor: 'pointer', padding: '3px 10px', fontFamily: 'inherit', fontWeight: 700 }}>
              Exit Impersonation
            </button>
          </div>
        )}
        {/* Role impersonation banner */}
        {isImpersonating && !shopImpersonation && (
          <div style={{ background: 'rgba(245,158,11,.1)', borderBottom: '1px solid rgba(245,158,11,.2)', padding: '6px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 12, color: COLORS.amber, fontWeight: 600 }}>
            <span>Impersonating: {user.impersonate_role?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</span>
            <button onClick={async () => {
              await fetch('/api/impersonate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'reset' }) })
              await new Promise(r => setTimeout(r, 300))
              window.location.href = '/dashboard'
            }} style={{ background: 'none', border: '1px solid rgba(245,158,11,.3)', borderRadius: 4, color: COLORS.amber, fontSize: 10, cursor: 'pointer', padding: '2px 8px', fontFamily: 'inherit' }}>
              Exit
            </button>
          </div>
        )}
        {/* Sticky top bar — uses page bg so it blends with the body; seam provided by a subtle bottom border only */}
        <div style={{ position: 'sticky', top: 0, zIndex: 15, background: t.bg, borderBottom: `1px solid ${t.border}`, display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8, padding: isMobile ? '8px 12px' : '8px 20px', paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
          {/* Left: mobile menu or spacer */}
          <div>
            {isMobile && (
              <button onClick={() => setDrawerOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textSecondary, padding: 6 }}>
                <Menu size={22} />
              </button>
            )}
          </div>
          {/* Center: search + New WO */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div onClick={() => setCommandPaletteOpen(true)} style={{ position: 'relative', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, pointerEvents: 'none', color: t.textTertiary }} />
              <div style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: 8, padding: '6px 12px 6px 30px', fontSize: 13, color: t.textTertiary, width: isMobile ? 160 : 260, userSelect: 'none' }}>
                Search truck #, company, SO #...
              </div>
              {!isMobile && (
                <span style={{ position: 'absolute', right: 8, fontSize: 10, color: t.textTertiary, background: t.bgHover, borderRadius: 4, padding: '1px 5px', pointerEvents: 'none' }}>/</span>
              )}
            </div>
            <a href="/work-orders/new" style={{ textDecoration: 'none' }}>
              <button style={{ background: t.accent, color: t.bgLight, border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, padding: '6px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                <Plus size={14} strokeWidth={2.5} /> New WO
              </button>
            </a>
          </div>
          {/* Right: identity cluster — one role indicator (RoleSwitcher OR plain badge), avatar, bell */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
            {user?.can_impersonate ? (
              <RoleSwitcher userId={user.id} actualRole={user.role} impersonateRole={user.impersonate_role} />
            ) : user && effectiveRole ? (
              <span style={{ fontSize: 10, fontWeight: 600, color: t.textSecondary, background: t.bgHover, borderRadius: 6, padding: '4px 10px', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                {effectiveRole.replace(/_/g, ' ')}
              </span>
            ) : null}
            {user && (
              <div title={user.full_name || ''} style={{ width: 28, height: 28, borderRadius: 14, background: t.accent, color: t.bgLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                {(user.full_name || '').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
            )}
            {user && <NotificationBell userId={user.id} />}
          </div>
        </div>
        <main style={{ flex: 1, overflowX: 'hidden', paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {children}
        </main>
      </div>
      <CommandPalette isOpen={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
    </div>
  )
}
