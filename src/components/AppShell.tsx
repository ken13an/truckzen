'use client'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import NotificationBell from '@/components/NotificationBell'
import RoleSwitcher from '@/components/RoleSwitcher'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { Menu, X } from 'lucide-react'

const FULL_SCREEN = ['/login', '/setup', '/kiosk', '/pay', '/portal', '/waiting', '/forgot-password', '/reset-password', '/tech', '/offline', '/403', '/mechanic', '/floor-manager', '/platform-admin', '/register']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [shopImpersonation, setShopImpersonation] = useState<{ shopName: string; originalShopId: string } | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  useKeyboardShortcuts()

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
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
    <div style={{ display: 'flex', minHeight: '100vh', background: '#060708' }}>
      {/* Desktop sidebar */}
      {!isMobile && <Sidebar />}

      {/* Mobile drawer overlay */}
      {isMobile && drawerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998, display: 'flex' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} onClick={() => setDrawerOpen(false)} />
          <div style={{ position: 'relative', zIndex: 1, width: 260, maxWidth: '80vw' }}>
            <Sidebar />
            <button onClick={() => setDrawerOpen(false)} style={{ position: 'absolute', top: 12, right: -44, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', color: '#fff' }}>
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Shop impersonation banner */}
        {shopImpersonation && (
          <div style={{ background: 'rgba(232,105,42,.12)', borderBottom: '1px solid rgba(232,105,42,.25)', padding: '8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 12, color: '#E8692A', fontWeight: 600 }}>
            <span>You are viewing <strong>{shopImpersonation.shopName}</strong> as Owner</span>
            <button onClick={async () => {
              await fetch('/api/platform-admin/impersonate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-original-shop-id': shopImpersonation.originalShopId },
                body: JSON.stringify({ user_id: user.id, action: 'stop' }),
              })
              localStorage.removeItem('tz_original_shop_id')
              window.location.href = '/platform-admin'
            }} style={{ background: '#E8692A', border: 'none', borderRadius: 4, color: '#fff', fontSize: 10, cursor: 'pointer', padding: '3px 10px', fontFamily: 'inherit', fontWeight: 700 }}>
              Exit Impersonation
            </button>
          </div>
        )}
        {/* Role impersonation banner */}
        {isImpersonating && !shopImpersonation && (
          <div style={{ background: 'rgba(245,158,11,.1)', borderBottom: '1px solid rgba(245,158,11,.2)', padding: '6px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 12, color: '#F59E0B', fontWeight: 600 }}>
            <span>Impersonating: {user.impersonate_role?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</span>
            <button onClick={async () => {
              await fetch('/api/impersonate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'reset' }) })
              await new Promise(r => setTimeout(r, 300))
              window.location.href = '/dashboard'
            }} style={{ background: 'none', border: '1px solid rgba(245,158,11,.3)', borderRadius: 4, color: '#F59E0B', fontSize: 10, cursor: 'pointer', padding: '2px 8px', fontFamily: 'inherit' }}>
              Exit
            </button>
          </div>
        )}
        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: isMobile ? '8px 12px' : '8px 20px', paddingTop: 'max(8px, env(safe-area-inset-top))', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
          {isMobile ? (
            <button onClick={() => setDrawerOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7C8BA0', padding: 6 }}>
              <Menu size={22} />
            </button>
          ) : <div />}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {user?.can_impersonate && (
              <RoleSwitcher userId={user.id} actualRole={user.role} impersonateRole={user.impersonate_role} />
            )}
            {user && <NotificationBell userId={user.id} />}
          </div>
        </div>
        <main style={{ flex: 1, overflowX: 'hidden', paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
