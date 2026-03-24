'use client'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { LayoutDashboard, Store, FileText, Users, Activity, Shield, LogOut, ChevronLeft, DollarSign, Cpu } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/platform-admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/platform-admin/shops', label: 'All Shops', icon: Store },
  { href: '/platform-admin/registrations', label: 'Registrations', icon: FileText },
  { href: '/platform-admin/impersonate', label: 'Impersonate', icon: Users },
  { href: '/platform-admin/activity', label: 'Activity Log', icon: Activity },
  { href: '/platform-admin/costs', label: 'Costs & Services', icon: DollarSign },
  { href: '/platform-admin/ai-usage', label: 'AI Usage', icon: Cpu },
]

export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    async function load() {
      const u = await getCurrentUser(supabase)
      if (!u) { window.location.href = '/login'; return }

      const { data: profile } = await supabase.from('users')
        .select('is_platform_owner, full_name')
        .eq('id', u.id)
        .single()

      if (!profile?.is_platform_owner) {
        window.location.href = '/dashboard'
        return
      }

      setUser({ ...u, is_platform_owner: true })

      // Fetch pending registrations count
      const res = await fetch(`/api/platform-admin/stats?user_id=${u.id}`)
      if (res.ok) {
        const data = await res.json()
        setPendingCount(data.pending_registrations || 0)
      }
    }
    load()
  }, [])

  const isActive = (item: typeof NAV_ITEMS[0]) => {
    if (item.exact) return pathname === item.href
    return pathname?.startsWith(item.href)
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: '#060708', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2px solid rgba(29,111,232,0.2)', borderTopColor: '#1D6FE8', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#060708' }}>
      {/* Platform Admin Sidebar */}
      <aside style={{
        width: 240, minHeight: '100vh', background: '#0B0D11',
        borderRight: '1px solid rgba(255,255,255,.06)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        position: 'sticky', top: 0,
      }}>
        {/* Header */}
        <div style={{ padding: '20px 18px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Shield size={18} color="#1D6FE8" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#F0F4FF', letterSpacing: '0.02em' }}>TruckZen Platform</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <span style={{ fontSize: 11, color: '#7C8BA0' }}>{user.full_name}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#1D6FE8', background: 'rgba(29,111,232,.12)', padding: '2px 6px', borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace" }}>PLATFORM OWNER</span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 0' }}>
          {NAV_ITEMS.map(item => {
            const active = isActive(item)
            const Icon = item.icon
            return (
              <a key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 18px', margin: '1px 6px', borderRadius: 8,
                  background: active ? 'rgba(29,111,232,.12)' : 'transparent',
                  borderLeft: active ? '2px solid #1D6FE8' : '2px solid transparent',
                  cursor: 'pointer', transition: 'all .12s',
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.04)' }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                  <Icon size={15} strokeWidth={1.5} color={active ? '#4D9EFF' : '#7C8BA0'} />
                  <span style={{ fontSize: 12, fontWeight: active ? 700 : 400, color: active ? '#F0F4FF' : '#7C8BA0', flex: 1 }}>
                    {item.label}
                  </span>
                  {item.label === 'Registrations' && pendingCount > 0 && (
                    <span style={{ background: '#D94F4F', color: '#fff', fontSize: 9, fontWeight: 700, fontFamily: 'monospace', padding: '1px 5px', borderRadius: 100, minWidth: 16, textAlign: 'center' }}>
                      {pendingCount}
                    </span>
                  )}
                </div>
              </a>
            )
          })}
        </nav>

        {/* Bottom */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', padding: '8px 0' }}>
          <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 18px', margin: '1px 6px', borderRadius: 8,
              cursor: 'pointer', transition: 'all .12s',
            }}
            onClick={() => { window.location.href = '/dashboard' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.04)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
              <ChevronLeft size={15} strokeWidth={1.5} color="#7C8BA0" />
              <span style={{ fontSize: 12, color: '#7C8BA0' }}>Back to Dashboard</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, minWidth: 0, padding: '24px 32px' }}>
        {children}
      </main>
    </div>
  )
}
