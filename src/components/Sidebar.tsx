'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getSidebarItems } from '@/lib/permissions'
import Logo, { LogoIcon } from '@/components/Logo'
import { LayoutDashboard, Monitor, Wrench, Users2, Truck, FileText, Package, UserCircle, Factory, Settings, Timer, ShieldCheck, BarChart3, Calculator, LogOut, Clipboard, BookOpen, Cog, Upload, Shield } from 'lucide-react'

const ICON_MAP: Record<string, any> = {
  '/dashboard': LayoutDashboard,
  '/kiosk-admin': Monitor,
  '/work-orders': Wrench,
  '/customers': Users2,
  '/fleet': Truck,
  '/invoices': FileText,
  '/parts': Package,
  '/drivers': UserCircle,
  '/shop-floor': Factory,
  '/maintenance': Cog,
  '/maintenance/tires': Cog,
  '/maintenance/parts-lifecycle': Cog,
  '/compliance': ShieldCheck,
  '/accounting': Calculator,
  '/reports': BarChart3,
  '/time-tracking': Timer,
  '/settings': Settings,
  '/settings/import': Clipboard,
  '/admin/permissions': ShieldCheck,
  '/tech': Wrench,
  '/dvir': BookOpen,
  '/smart-drop': Upload,
}

export default function Sidebar() {
  const pathname = usePathname()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [lowStock, setLowStock] = useState(0)
  const [openJobs, setOpenJobs] = useState(0)
  const [rolePerms, setRolePerms] = useState<Record<string, boolean>>({})
  const [userOverrides, setUserOverrides] = useState<Record<string, boolean>>({})
  const [isPlatformOwner, setIsPlatformOwner] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user: au } } = await supabase.auth.getUser()
      if (!au) return
      const { data } = await supabase.from('users').select('id, shop_id, full_name, role, team, is_platform_owner').eq('id', au.id).single()
      if (!data) return
      setUser(data)
      if (data.is_platform_owner) setIsPlatformOwner(true)

      const { data: rp } = await supabase.from('role_permissions').select('module, allowed').eq('shop_id', data.shop_id).eq('role', data.role)
      if (rp) setRolePerms(Object.fromEntries(rp.map((r: any) => [r.module, r.allowed])))

      const { data: uo } = await supabase.from('user_permission_overrides').select('module, allowed').eq('user_id', data.id)
      if (uo) setUserOverrides(Object.fromEntries(uo.map((r: any) => [r.module, r.allowed])))

      const [{ count: ls }, { count: oj }] = await Promise.all([
        supabase.from('parts').select('*', { count: 'exact', head: true }).eq('shop_id', data.shop_id).lte('on_hand', 2),
        supabase.from('service_orders').select('*', { count: 'exact', head: true }).eq('shop_id', data.shop_id).not('status', 'in', '("good_to_go","void")'),
      ])
      setLowStock(ls || 0)
      setOpenJobs(oj || 0)
    }
    load()
  }, [])

  if (!user) return null

  const visible = getSidebarItems(user.role, rolePerms, userOverrides)
  // Separate settings from main items
  const mainItems = visible.filter(i => i.href !== '/settings' && !i.href.startsWith('/settings/'))
  const settingsItem = visible.find(i => i.href === '/settings')

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname?.startsWith(href)
  }

  const W = collapsed ? 56 : 220

  function renderItem(item: any) {
    const active = isActive(item.href)
    const Icon = ICON_MAP[item.href]
    const badge = item.href === '/parts' && lowStock > 0 ? lowStock
      : item.href === '/work-orders' && openJobs > 0 ? openJobs
      : null

    return (
      <a key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: collapsed ? '9px 0' : '9px 16px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          margin: '1px 6px', borderRadius: 8,
          background: active ? 'rgba(29,111,232,.12)' : 'transparent',
          borderLeft: active ? '2px solid #1D6FE8' : '2px solid transparent',
          cursor: 'pointer', transition: 'all .12s',
        }}
        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.04)' }}
        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
          <span style={{ flexShrink: 0, width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {Icon ? <Icon size={15} strokeWidth={1.5} color={active ? '#4D9EFF' : '#7C8BA0'} /> : <span style={{ fontSize: 13, color: active ? '#4D9EFF' : '#7C8BA0' }}>{item.icon}</span>}
          </span>
          {!collapsed && (
            <>
              <span style={{ fontSize: 12, fontWeight: active ? 700 : 400, color: active ? '#F0F4FF' : '#7C8BA0', flex: 1, whiteSpace: 'nowrap' }}>
                {item.label}
              </span>
              {badge != null && badge > 0 && (
                <span style={{ background: item.href === '/parts' ? '#D94F4F' : '#1D6FE8', color: '#fff', fontSize: 9, fontWeight: 700, fontFamily: 'monospace', padding: '1px 5px', borderRadius: 100, minWidth: 16, textAlign: 'center' }}>
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </>
          )}
        </div>
      </a>
    )
  }

  return (
    <aside style={{
      width: W, minHeight: '100vh', background: '#0B0D11',
      borderRight: '1px solid rgba(255,255,255,.06)',
      display: 'flex', flexDirection: 'column',
      transition: 'width .2s ease', flexShrink: 0,
      position: 'sticky', top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: collapsed ? '16px 14px' : '16px 18px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', minHeight: 56 }}>
        {collapsed ? <LogoIcon size="sm" /> : <Logo size="sm" showWordmark={true} />}
        <button onClick={() => setCollapsed(c => !c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#48536A', fontSize: 16, padding: 4, lineHeight: 1 }}>
          {collapsed ? '\u00BB' : '\u00AB'}
        </button>
      </div>

      {/* Platform Admin — top of sidebar, only for platform owner */}
      {isPlatformOwner && (
        <div style={{ borderBottom: '1px solid rgba(255,255,255,.06)', padding: '6px 0' }}>
          <a href="/platform-admin" style={{ textDecoration: 'none' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: collapsed ? '9px 0' : '9px 16px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              margin: '1px 6px', borderRadius: 8,
              background: pathname?.startsWith('/platform-admin') ? 'rgba(29,111,232,.12)' : 'transparent',
              borderLeft: pathname?.startsWith('/platform-admin') ? '2px solid #1D6FE8' : '2px solid transparent',
              cursor: 'pointer', transition: 'all .12s',
            }}
            onMouseEnter={e => { if (!pathname?.startsWith('/platform-admin')) (e.currentTarget as HTMLElement).style.background = 'rgba(29,111,232,.06)' }}
            onMouseLeave={e => { if (!pathname?.startsWith('/platform-admin')) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
              <span style={{ flexShrink: 0, width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={15} strokeWidth={1.5} color={pathname?.startsWith('/platform-admin') ? '#4D9EFF' : '#7C8BA0'} />
              </span>
              {!collapsed && <span style={{ fontSize: 12, fontWeight: pathname?.startsWith('/platform-admin') ? 700 : 400, color: pathname?.startsWith('/platform-admin') ? '#F0F4FF' : '#7C8BA0' }}>Platform Admin</span>}
            </div>
          </a>
        </div>
      )}

      {/* Main nav */}
      <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto', overflowX: 'hidden' }}>
        {mainItems.map(renderItem)}
      </nav>

      {/* Bottom: Settings + Sign Out */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', padding: '6px 0' }}>
        {settingsItem && renderItem(settingsItem)}

        {/* Sign Out */}
        <a href="#" onClick={async (e) => { e.preventDefault(); await supabase.auth.signOut(); window.location.href = '/login' }} style={{ textDecoration: 'none' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: collapsed ? '9px 0' : '9px 16px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            margin: '1px 6px', borderRadius: 8,
            cursor: 'pointer', transition: 'all .12s',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,.08)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
            <span style={{ flexShrink: 0, width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LogOut size={15} strokeWidth={1.5} color="#7C8BA0" />
            </span>
            {!collapsed && <span style={{ fontSize: 12, color: '#7C8BA0' }}>Sign Out</span>}
          </div>
        </a>
      </div>

      {/* Bottom spacing */}
      <div style={{ height: 4 }}>
      </div>
    </aside>
  )
}
