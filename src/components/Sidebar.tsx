/**
 * TruckZen — Original Design
 * Built independently by TruckZen development team
 */
'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getSidebarItems } from '@/lib/permissions'
import Logo, { LogoIcon } from '@/components/Logo'
import { Wrench, Package, Factory, Monitor, FileText, Truck, Users2, UserCircle, MapPin, ShieldCheck, BarChart3, Cog, Calculator, CreditCard, Clock, Settings, LogOut, Shield, ChevronDown, Upload, BookOpen } from 'lucide-react'

const UNLIMITED_ROLES = ['owner', 'gm', 'it_person']

interface DeptSection {
  label: string
  icon: any
  color: string
  items: { href: string; label: string; icon: any }[]
  roles?: string[] // if set, only these roles see it
}

const DEPARTMENTS: DeptSection[] = [
  {
    label: 'Service', icon: Wrench, color: '#4D9EFF',
    items: [
      { href: '/shop-floor', label: 'Shop Floor', icon: Factory },
      { href: '/work-orders', label: 'Work Orders', icon: Wrench },
      { href: '/service-requests', label: 'Service Requests', icon: FileText },
      { href: '/parts', label: 'Parts & Inventory', icon: Package },
      { href: '/kiosk-admin', label: 'Kiosk Settings', icon: Monitor },
      { href: '/smart-drop', label: 'Smart Drop', icon: Upload },
      { href: '/time-tracking', label: 'Time Tracking', icon: Clock },
    ],
  },
  {
    label: 'Fleet', icon: Truck, color: '#1DB870',
    items: [
      { href: '/fleet', label: 'All Units', icon: Truck },
      { href: '/customers', label: 'Customers & Companies', icon: Users2 },
      { href: '/drivers', label: 'Drivers', icon: UserCircle },
      { href: '/compliance', label: 'Compliance', icon: ShieldCheck },
      { href: '/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  {
    label: 'Maintenance', icon: Cog, color: '#D4882A',
    items: [
      { href: '/maintenance', label: 'PM Scheduling', icon: Cog },
      { href: '/dvir', label: 'Inspections & DVIR', icon: BookOpen },
      { href: '/maintenance/tires', label: 'Tire Management', icon: Cog },
      { href: '/maintenance/parts-lifecycle', label: 'Parts Lifecycle', icon: Package },
    ],
  },
  {
    label: 'Accounting', icon: Calculator, color: '#8B5CF6',
    items: [
      { href: '/invoices', label: 'Invoices', icon: FileText },
      { href: '/accounting', label: 'Pending Approval', icon: Calculator },
      { href: '/reports', label: 'Reports', icon: BarChart3 },
    ],
    roles: [...UNLIMITED_ROLES, 'accountant', 'office_admin'],
  },
]

// Role → which departments they can see
function getDeptAccess(role: string): string[] {
  if (UNLIMITED_ROLES.includes(role)) return ['Service', 'Fleet', 'Maintenance', 'Accounting']
  switch (role) {
    case 'shop_manager': return ['Service', 'Fleet']
    case 'service_writer': return ['Service']
    case 'technician': case 'lead_tech': case 'maintenance_technician': return ['Service']
    case 'parts_manager': return ['Service']
    case 'accountant': return ['Service', 'Accounting']
    case 'office_admin': return ['Service', 'Fleet', 'Accounting']
    case 'fleet_manager': return ['Fleet']
    case 'maintenance_manager': return ['Maintenance']
    case 'dispatcher': return ['Fleet']
    default: return ['Service']
  }
}

export default function Sidebar() {
  const pathname = usePathname()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [lowStock, setLowStock] = useState(0)
  const [openJobs, setOpenJobs] = useState(0)
  const [isPlatformOwner, setIsPlatformOwner] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ Service: true })
  const [rolePerms, setRolePerms] = useState<Record<string, boolean>>({})
  const [userOverrides, setUserOverrides] = useState<Record<string, boolean>>({})

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

      // Auto-expand section containing active page
      for (const dept of DEPARTMENTS) {
        if (dept.items.some(item => pathname?.startsWith(item.href))) {
          setExpanded(prev => ({ ...prev, [dept.label]: true }))
        }
      }
    }
    load()
  }, [])

  if (!user) return null

  const visible = getSidebarItems(user.role, rolePerms, userOverrides)
  const visibleHrefs = new Set<string>(visible.map(i => i.href))
  const deptAccess = getDeptAccess(user.role)

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname?.startsWith(href)
  }

  const W = collapsed ? 56 : 220

  function toggleDept(label: string) {
    setExpanded(prev => ({ ...prev, [label]: !prev[label] }))
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

      {/* Platform Admin */}
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

      {/* Department sections */}
      <nav style={{ flex: 1, padding: '6px 0', overflowY: 'auto', overflowX: 'hidden' }}>
        {!collapsed && <div style={{ fontSize: 9, fontWeight: 700, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.1em', padding: '8px 18px 4px', fontFamily: "'IBM Plex Mono', monospace" }}>Departments</div>}

        {DEPARTMENTS.filter(dept => deptAccess.includes(dept.label)).map(dept => {
          const DeptIcon = dept.icon
          const isExpanded = expanded[dept.label]
          const deptItems = dept.items.filter(item => visibleHrefs.has(item.href) || UNLIMITED_ROLES.includes(user.role))
          if (deptItems.length === 0) return null

          const hasDeptActive = deptItems.some(item => isActive(item.href))

          return (
            <div key={dept.label} style={{ marginBottom: 2 }}>
              {/* Department header */}
              <button onClick={() => toggleDept(dept.label)} style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: collapsed ? '8px 0' : '8px 16px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                margin: '1px 6px', borderRadius: 8, border: 'none',
                background: hasDeptActive && !isExpanded ? 'rgba(255,255,255,.04)' : 'transparent',
                cursor: 'pointer', transition: 'all .12s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = hasDeptActive && !isExpanded ? 'rgba(255,255,255,.04)' : 'transparent')}>
                <span style={{ flexShrink: 0, width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DeptIcon size={14} strokeWidth={1.5} color={hasDeptActive ? dept.color : '#7C8BA0'} />
                </span>
                {!collapsed && (
                  <>
                    <span style={{ fontSize: 11, fontWeight: 700, color: hasDeptActive ? '#F0F4FF' : '#7C8BA0', flex: 1, textAlign: 'left' }}>
                      {dept.label}
                    </span>
                    <ChevronDown size={12} color="#48536A" style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .15s' }} />
                  </>
                )}
              </button>

              {/* Sub-items */}
              {isExpanded && !collapsed && (
                <div style={{ paddingLeft: 10 }}>
                  {deptItems.map(item => {
                    const active = isActive(item.href)
                    const ItemIcon = item.icon
                    const badge = item.href === '/parts' && lowStock > 0 ? lowStock
                      : item.href === '/work-orders' && openJobs > 0 ? openJobs
                      : null

                    return (
                      <a key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '7px 14px', margin: '1px 6px', borderRadius: 8,
                          background: active ? 'rgba(29,111,232,.12)' : 'transparent',
                          borderLeft: active ? '2px solid #1D6FE8' : '2px solid transparent',
                          cursor: 'pointer', transition: 'all .12s',
                        }}
                        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.04)' }}
                        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                          <span style={{ flexShrink: 0, width: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ItemIcon size={13} strokeWidth={1.5} color={active ? '#4D9EFF' : '#48536A'} />
                          </span>
                          <span style={{ fontSize: 11, fontWeight: active ? 700 : 400, color: active ? '#F0F4FF' : '#7C8BA0', flex: 1, whiteSpace: 'nowrap' }}>
                            {item.label}
                          </span>
                          {badge != null && badge > 0 && (
                            <span style={{ background: item.href === '/parts' ? '#D94F4F' : '#1D6FE8', color: '#fff', fontSize: 9, fontWeight: 700, fontFamily: 'monospace', padding: '1px 5px', borderRadius: 100, minWidth: 16, textAlign: 'center' }}>
                              {badge > 99 ? '99+' : badge}
                            </span>
                          )}
                        </div>
                      </a>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Dashboard link at top when collapsed */}
        {collapsed && (
          <a href="/dashboard" style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '9px 0', margin: '1px 6px', borderRadius: 8, background: pathname === '/dashboard' ? 'rgba(29,111,232,.12)' : 'transparent', cursor: 'pointer' }}>
              <Wrench size={15} color={pathname === '/dashboard' ? '#4D9EFF' : '#7C8BA0'} />
            </div>
          </a>
        )}
      </nav>

      {/* Bottom: Settings + Sign Out */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', padding: '6px 0' }}>
        {!collapsed && <div style={{ fontSize: 9, fontWeight: 700, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.1em', padding: '4px 18px 2px', fontFamily: "'IBM Plex Mono', monospace" }}>Platform</div>}

        <a href="/settings" style={{ textDecoration: 'none' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: collapsed ? '9px 0' : '9px 16px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            margin: '1px 6px', borderRadius: 8,
            background: pathname?.startsWith('/settings') ? 'rgba(29,111,232,.12)' : 'transparent',
            borderLeft: pathname?.startsWith('/settings') ? '2px solid #1D6FE8' : '2px solid transparent',
            cursor: 'pointer', transition: 'all .12s',
          }}
          onMouseEnter={e => { if (!pathname?.startsWith('/settings')) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.04)' }}
          onMouseLeave={e => { if (!pathname?.startsWith('/settings')) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
            <span style={{ flexShrink: 0, width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Settings size={15} strokeWidth={1.5} color={pathname?.startsWith('/settings') ? '#4D9EFF' : '#7C8BA0'} />
            </span>
            {!collapsed && <span style={{ fontSize: 12, fontWeight: pathname?.startsWith('/settings') ? 700 : 400, color: pathname?.startsWith('/settings') ? '#F0F4FF' : '#7C8BA0' }}>Settings</span>}
          </div>
        </a>

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
      <div style={{ height: 4 }} />
    </aside>
  )
}
