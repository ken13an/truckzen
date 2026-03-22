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
import { Wrench, Package, Factory, Monitor, FileText, Truck, Users2, UserCircle, ShieldCheck, BarChart3, Cog, Calculator, Clock, Settings, LogOut, Shield, ChevronDown, Upload, BookOpen, ClipboardList, ShoppingCart, Box, Layers } from 'lucide-react'

const UNLIMITED_ROLES = ['owner', 'gm', 'it_person']
const SMART_DROP_ROLES = [...UNLIMITED_ROLES, 'shop_manager', 'service_writer']

interface DeptSection {
  label: string
  icon: any
  color: string
  items: { href: string; label: string; icon: any }[]
}

const DEPARTMENTS: DeptSection[] = [
  {
    label: 'Service', icon: Wrench, color: '#1D6FE8',
    items: [
      { href: '/shop-floor', label: 'Shop Floor', icon: Factory },
      { href: '/work-orders', label: 'Work Orders', icon: Wrench },
      { href: '/kiosk-admin', label: 'Kiosk', icon: Monitor },
      { href: '/time-tracking', label: 'Time Tracking', icon: Clock },
    ],
  },
  {
    label: 'Parts', icon: Package, color: '#F97316',
    items: [
      { href: '/parts/queue', label: 'Parts Queue', icon: ClipboardList },
      { href: '/parts', label: 'Inventory', icon: Package },
      { href: '/parts/cores', label: 'Core Parts', icon: Box },
      { href: '/parts/reorder', label: 'Purchase Orders', icon: ShoppingCart },
    ],
  },
  {
    label: 'Fleet', icon: Truck, color: '#22C55E',
    items: [
      { href: '/service-requests', label: 'Service Requests', icon: FileText },
      { href: '/fleet', label: 'All Units', icon: Truck },
      { href: '/customers', label: 'Customers', icon: Users2 },
      { href: '/drivers', label: 'Drivers', icon: UserCircle },
      { href: '/compliance', label: 'Compliance', icon: ShieldCheck },
      { href: '/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  {
    label: 'Maintenance', icon: Cog, color: '#F59E0B',
    items: [
      { href: '/service-requests', label: 'Service Requests', icon: FileText },
      { href: '/maintenance', label: 'PM Scheduling', icon: Cog },
      { href: '/dvir', label: 'DVIR', icon: BookOpen },
      { href: '/maintenance/warranty-review', label: 'Warranty Review', icon: ShieldCheck },
      { href: '/maintenance/tires', label: 'Tire Management', icon: Cog },
      { href: '/maintenance/parts-lifecycle', label: 'Parts Lifecycle', icon: Layers },
    ],
  },
  {
    label: 'Accounting', icon: Calculator, color: '#8B5CF6',
    items: [
      { href: '/invoices', label: 'Invoices', icon: FileText },
      { href: '/accounting', label: 'Pending Approval', icon: Calculator },
      { href: '/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
]

function getDeptAccess(role: string): string[] {
  if (UNLIMITED_ROLES.includes(role)) return ['Service', 'Parts', 'Fleet', 'Maintenance', 'Accounting']
  switch (role) {
    case 'shop_manager': return ['Service', 'Parts', 'Fleet', 'Accounting']
    case 'service_writer': return ['Service']
    case 'technician': case 'lead_tech': case 'maintenance_technician': return ['Service']
    case 'parts_manager': return ['Parts']
    case 'accountant': return ['Service', 'Accounting']
    case 'office_admin': return ['Service', 'Parts', 'Fleet', 'Accounting']
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
  const isActive = (href: string) => pathname === href || (href !== '/' && pathname?.startsWith(href))
  const W = collapsed ? 56 : 220

  function toggleDept(label: string) {
    setExpanded(prev => ({ ...prev, [label]: !prev[label] }))
  }

  function renderNavItem(item: { href: string; label: string; icon: any }, indent: boolean = false) {
    const active = isActive(item.href)
    const Icon = item.icon
    const badge = item.href === '/parts' && lowStock > 0 ? lowStock : item.href === '/work-orders' && openJobs > 0 ? openJobs : null

    return (
      <a key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: collapsed ? '8px 0' : indent ? '7px 14px' : '8px 16px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          margin: '1px 6px', borderRadius: 8, marginLeft: indent && !collapsed ? 16 : 6,
          background: active ? 'rgba(29,111,232,.12)' : 'transparent',
          borderLeft: active ? '2px solid #1D6FE8' : '2px solid transparent',
          cursor: 'pointer', transition: 'all .12s',
        }}
        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.04)' }}
        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
          <span style={{ flexShrink: 0, width: indent ? 13 : 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={indent ? 13 : 15} strokeWidth={1.5} color={active ? '#4D9EFF' : '#48536A'} />
          </span>
          {!collapsed && (
            <>
              <span style={{ fontSize: indent ? 11 : 12, fontWeight: active ? 700 : 400, color: active ? '#F0F4FF' : '#7C8BA0', flex: 1, whiteSpace: 'nowrap' }}>{item.label}</span>
              {badge != null && badge > 0 && (
                <span style={{ background: item.href === '/parts' ? '#D94F4F' : '#1D6FE8', color: '#fff', fontSize: 9, fontWeight: 700, fontFamily: 'monospace', padding: '1px 5px', borderRadius: 100, minWidth: 16, textAlign: 'center' }}>{badge > 99 ? '99+' : badge}</span>
              )}
            </>
          )}
        </div>
      </a>
    )
  }

  return (
    <aside style={{ width: W, minHeight: '100vh', background: '#0B0D11', borderRight: '1px solid rgba(255,255,255,.06)', display: 'flex', flexDirection: 'column', transition: 'width .2s ease', flexShrink: 0, position: 'sticky', top: 0 }}>
      {/* Logo */}
      <div style={{ padding: collapsed ? '16px 14px' : '16px 18px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', minHeight: 56 }}>
        {collapsed ? <LogoIcon size="sm" /> : <Logo size="sm" showWordmark={true} />}
        <button onClick={() => setCollapsed(c => !c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#48536A', fontSize: 16, padding: 4, lineHeight: 1 }}>{collapsed ? '\u00BB' : '\u00AB'}</button>
      </div>

      {/* Platform Admin */}
      {isPlatformOwner && (
        <div style={{ borderBottom: '1px solid rgba(255,255,255,.06)', padding: '6px 0' }}>
          {renderNavItem({ href: '/platform-admin', label: 'Platform Admin', icon: Shield })}
        </div>
      )}

      <nav style={{ flex: 1, padding: '6px 0', overflowY: 'auto', overflowX: 'hidden' }}>
        {/* Smart Drop — standalone */}
        {SMART_DROP_ROLES.includes(user.role) && (
          <div style={{ marginBottom: 4 }}>
            {renderNavItem({ href: '/smart-drop', label: 'Smart Drop', icon: Upload })}
          </div>
        )}

        {/* Department sections */}
        {!collapsed && <div style={{ fontSize: 9, fontWeight: 700, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.1em', padding: '8px 18px 4px', fontFamily: "'IBM Plex Mono', monospace" }}>Departments</div>}

        {DEPARTMENTS.filter(dept => deptAccess.includes(dept.label)).map(dept => {
          const DeptIcon = dept.icon
          const isExpanded = expanded[dept.label]
          const deptItems = dept.items.filter(item => visibleHrefs.has(item.href) || UNLIMITED_ROLES.includes(user.role))
          if (deptItems.length === 0 && !UNLIMITED_ROLES.includes(user.role)) return null

          const hasDeptActive = dept.items.some(item => isActive(item.href))

          return (
            <div key={dept.label} style={{ marginBottom: 2 }}>
              <div onClick={() => toggleDept(dept.label)} role="button" tabIndex={0} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: collapsed ? '8px 0' : '8px 16px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                margin: '1px 6px', borderRadius: 8,
                background: hasDeptActive && !isExpanded ? 'rgba(255,255,255,.04)' : 'transparent',
                cursor: 'pointer', transition: 'all .12s', userSelect: 'none',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = hasDeptActive && !isExpanded ? 'rgba(255,255,255,.04)' : 'transparent')}>
                <span style={{ flexShrink: 0, width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DeptIcon size={14} strokeWidth={1.5} color={hasDeptActive ? dept.color : '#7C8BA0'} />
                </span>
                {!collapsed && (
                  <>
                    <span style={{ fontSize: 11, fontWeight: 700, color: hasDeptActive ? '#F0F4FF' : '#7C8BA0', flex: 1, textAlign: 'left' }}>{dept.label}</span>
                    <ChevronDown size={12} color="#48536A" style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .15s' }} />
                  </>
                )}
              </div>
              {isExpanded === true && collapsed === false && (
                <div style={{ overflow: 'hidden' }}>
                  {(UNLIMITED_ROLES.includes(user.role) ? dept.items : deptItems).map(item => renderNavItem(item, true))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Bottom: Settings + Sign Out */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', padding: '6px 0' }}>
        {!collapsed && <div style={{ fontSize: 9, fontWeight: 700, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.1em', padding: '4px 18px 2px', fontFamily: "'IBM Plex Mono', monospace" }}>Platform</div>}
        {renderNavItem({ href: '/settings', label: 'Settings', icon: Settings })}
        <a href="#" onClick={async (e) => { e.preventDefault(); await supabase.auth.signOut(); window.location.href = '/login' }} style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '9px 0' : '9px 16px', justifyContent: collapsed ? 'center' : 'flex-start', margin: '1px 6px', borderRadius: 8, cursor: 'pointer', transition: 'all .12s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,.08)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
            <span style={{ flexShrink: 0, width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LogOut size={15} strokeWidth={1.5} color="#7C8BA0" /></span>
            {!collapsed && <span style={{ fontSize: 12, color: '#7C8BA0' }}>Sign Out</span>}
          </div>
        </a>
      </div>
      <div style={{ height: 4 }} />
    </aside>
  )
}
