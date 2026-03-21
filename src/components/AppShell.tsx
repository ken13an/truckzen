'use client'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import NotificationBell from '@/components/NotificationBell'
import RoleSwitcher from '@/components/RoleSwitcher'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

const FULL_SCREEN = ['/login', '/setup', '/kiosk', '/pay', '/portal', '/waiting', '/forgot-password', '/reset-password', '/tech', '/offline', '/403', '/mechanic', '/floor-manager', '/platform-admin', '/register']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [shopImpersonation, setShopImpersonation] = useState<{ shopName: string; originalShopId: string } | null>(null)
  useKeyboardShortcuts()

  useEffect(() => {
    getCurrentUser(supabase).then(async (p: any) => {
      if (!p) return
      setUser(p)

      // Check if platform owner is impersonating a shop
      const origShopId = localStorage.getItem('tz_original_shop_id')
      if (origShopId && origShopId !== p.shop_id) {
        const { data: shop } = await supabase.from('shops').select('name').eq('id', p.shop_id).single()
        setShopImpersonation({ shopName: shop?.name || 'Unknown Shop', originalShopId: origShopId })
      }
    })
  }, [])

  const isFullScreen = FULL_SCREEN.some(r => pathname?.startsWith(r))

  if (isFullScreen) {
    return <>{children}</>
  }

  // Determine effective role (impersonation or actual)
  const effectiveRole = user?.impersonate_role || user?.role
  const isImpersonating = !!user?.impersonate_role

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#060708' }}>
      <Sidebar/>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Shop impersonation banner (platform owner viewing a shop) */}
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
              await fetch('/api/impersonate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.id, role: 'reset' }) })
              window.location.reload()
            }} style={{ background: 'none', border: '1px solid rgba(245,158,11,.3)', borderRadius: 4, color: '#F59E0B', fontSize: 10, cursor: 'pointer', padding: '2px 8px', fontFamily: 'inherit' }}>
              Exit
            </button>
          </div>
        )}
        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, padding: '8px 20px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
          {user?.can_impersonate && (
            <RoleSwitcher userId={user.id} actualRole={user.role} impersonateRole={user.impersonate_role} />
          )}
          {user && <NotificationBell userId={user.id} />}
        </div>
        <main style={{ flex: 1, overflowX: 'hidden' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
