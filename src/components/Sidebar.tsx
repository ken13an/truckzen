/**
 * TruckZen — Original Design
 * Built independently by TruckZen development team
 */
'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getSidebarItems, hasAccess } from '@/lib/permissions'
import { getPermissions } from '@/lib/getPermissions'
import Logo, { LogoIcon } from '@/components/Logo'
import { Wrench, Package, Factory, Monitor, FileText, Truck, Users2, UserCircle, ShieldCheck, BarChart3, Cog, Calculator, Clock, Settings, LogOut, Shield, ChevronDown, Upload, BookOpen, ClipboardList, ShoppingCart, Box, Layers, LayoutDashboard, CalendarClock, ClipboardCheck, Fuel, Building2, Receipt, Gauge, AlertTriangle, Zap, Bell, AlarmClock, FileCheck, UserCheck, Repeat, Globe, MapPin, Map, MessageSquare, Trash2, Lock, Banknote } from 'lucide-react'

const UNLIMITED_ROLES = ['owner', 'gm', 'it_person']
const SMART_DROP_ROLES = [...UNLIMITED_ROLES, 'shop_manager', 'service_writer']
const TRASH_ROLES = [...UNLIMITED_ROLES, 'shop_manager', 'floor_supervisor', 'service_writer', 'office_admin']
const PERMISSIONS_ROLES = [...UNLIMITED_ROLES, 'shop_manager', 'parts_manager', 'maintenance_manager', 'office_admin']

interface DeptSection {
  label: string
  icon: any
  color: string
  dashboardHref: string
  items: { href: string; label: string; icon: any }[]
}

const DEPARTMENTS: DeptSection[] = [
  {
    label: 'Service', icon: Wrench, color: '#1D6FE8', dashboardHref: '/service-writer/dashboard',
    items: [
      { href: '/work-orders', label: 'Work Orders', icon: Wrench },
      { href: '/shop-floor', label: 'Shop Floor', icon: Factory },
    ],
  },
  {
    label: 'Parts', icon: Package, color: '#F97316', dashboardHref: '/parts/dashboard',
    items: [
      { href: '/parts/queue', label: 'Parts Queue', icon: ClipboardList },
      { href: '/parts', label: 'Inventory', icon: Package },
      { href: '/parts/cores', label: 'Core Parts', icon: Box },
      { href: '/parts/reorder', label: 'Purchase Orders', icon: ShoppingCart },
    ],
  },
  {
    label: 'Fleet', icon: Truck, color: '#22C55E', dashboardHref: '/fleet',
    items: [
      { href: '/fleet/service-requests', label: 'Service Requests', icon: FileText },
      { href: '/customers', label: 'Customers', icon: Users2 },
    ],
  },
  {
    label: 'Maintenance', icon: Wrench, color: '#F59E0B', dashboardHref: '/maintenance',
    items: [
      { href: '/maintenance/repairs', label: 'Road Repairs', icon: Truck },
      { href: '/maintenance/drivers', label: 'Drivers', icon: Users2 },
      { href: '/maintenance/pm', label: 'PM Schedules', icon: CalendarClock },
      { href: '/maintenance/inspections', label: 'Inspections', icon: ClipboardCheck },
      { href: '/maintenance/fuel', label: 'Fuel', icon: Fuel },
      { href: '/maintenance/vendors', label: 'Vendors', icon: Building2 },
      { href: '/maintenance/parts', label: 'Parts', icon: Package },
      { href: '/maintenance/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
      { href: '/maintenance/invoices', label: 'Invoices', icon: Receipt },
      { href: '/maintenance/expenses', label: 'Expenses', icon: Receipt },
      { href: '/maintenance/equipment', label: 'Equipment', icon: Cog },
      { href: '/maintenance/meters', label: 'Meters', icon: Gauge },
      { href: '/maintenance/reports', label: 'Reports', icon: BarChart3 },
      { href: '/maintenance/service-requests', label: 'Service Requests', icon: FileText },
      { href: '/maintenance/warranty-review', label: 'Warranty Review', icon: ShieldCheck },
      { href: '/maintenance/issues', label: 'Issues', icon: AlertTriangle },
      { href: '/maintenance/faults', label: 'Faults', icon: Zap },
      { href: '/maintenance/recalls', label: 'Recalls', icon: Bell },
      { href: '/maintenance/service-reminders', label: 'Service Reminders', icon: AlarmClock },
      { href: '/maintenance/vehicle-renewals', label: 'Vehicle Renewals', icon: FileCheck },
      { href: '/maintenance/contact-renewals', label: 'Contact Renewals', icon: UserCheck },
      { href: '/maintenance/service-programs', label: 'Service Programs', icon: Repeat },
      { href: '/maintenance/shop-network', label: 'Shop Network', icon: Globe },
      { href: '/maintenance/places', label: 'Places', icon: MapPin },
      { href: '/maintenance/documents', label: 'Documents', icon: FileText },
      { href: '/maintenance/warranties', label: 'Warranties', icon: Shield },
      { href: '/maintenance/map', label: 'Fleet Map', icon: Map },
      { href: '/maintenance/activity', label: 'Activity Feed', icon: MessageSquare },
    ],
  },
  {
    label: 'Accounting', icon: Calculator, color: '#8B5CF6', dashboardHref: '/accounting/dashboard',
    items: [
      { href: '/invoices', label: 'Invoices', icon: FileText },
      { href: '/reports', label: 'Reports', icon: BarChart3 },
      { href: '/accounting/payroll', label: 'Payroll', icon: Banknote },
    ],
  },
]

// Mapping from department label to the permission module keys that represent it.
// A role gains access to a department if it has access to ANY of those modules.
const DEPT_MODULES: Record<string, string[]> = {
  Service:     ['orders', 'floor'],
  Parts:       ['parts'],
  Fleet:       ['fleet', 'customers'],
  Maintenance: ['maintenance'],
  Accounting:  ['accounting', 'invoices'],
}

function getDeptAccess(
  role: string,
  rolePerms: Record<string, boolean>,
  userOverrides: Record<string, boolean>
): string[] {
  return Object.entries(DEPT_MODULES)
    .filter(([, modules]) => modules.some(mod => hasAccess(role, mod, rolePerms, userOverrides)))
    .map(([dept]) => dept)
}

export default function Sidebar() {
  const pathname = usePathname()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [lowStock, setLowStock] = useState(0)
  const [openJobs, setOpenJobs] = useState(0)
  const [isPlatformOwner, setIsPlatformOwner] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [rolePerms, setRolePerms] = useState<Record<string, boolean>>({})
  const [userOverrides, setUserOverrides] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function load() {
      const { data: { user: au } } = await supabase.auth.getUser()
      if (!au) return
      const { data } = await supabase.from('users').select('id, shop_id, full_name, role, team, is_platform_owner, impersonate_role').eq('id', au.id).single()
      if (!data) return
      setUser(data)
      const perms = getPermissions(data)
      if (perms.canAccessPlatformAdmin && !data.impersonate_role) setIsPlatformOwner(true)

      // Fetch permissions and counts via API routes (service role key bypasses RLS)
      const [rpRes, uoRes, partsRes, wosRes] = await Promise.all([
        fetch(`/api/settings/role-permissions?shop_id=${data.shop_id}&role=${data.role}`).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`/api/settings/user-overrides?user_id=${data.id}`).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`/api/parts?shop_id=${data.shop_id}&per_page=1&status=active`).then(r => r.ok ? r.json() : { total: 0 }).catch(() => ({ total: 0 })),
        Promise.resolve([]), // WO badge disabled — needs proper unread/pending logic
      ])
      if (Array.isArray(rpRes)) setRolePerms(Object.fromEntries(rpRes.map((r: any) => [r.module, r.allowed])))
      if (Array.isArray(uoRes)) setUserOverrides(Object.fromEntries(uoRes.map((r: any) => [r.module, r.allowed])))
      setLowStock(0) // Will be refined when low stock API param is added
      setOpenJobs(0) // Disabled — was showing false "1" count from limit=1 query

    }
    load()
  }, [])

  // Auto-expand section containing active page — runs on every pathname change
  // Preserves manually opened sections; only auto-opens the active one
  useEffect(() => {
    for (const dept of DEPARTMENTS) {
      const matchesDept = pathname === dept.dashboardHref || pathname?.startsWith(dept.dashboardHref + '/')
      const matchesItem = dept.items.some(item => pathname === item.href || pathname?.startsWith(item.href + '/'))
      if (matchesDept || matchesItem) {
        setExpanded(prev => prev[dept.label] ? prev : { ...prev, [dept.label]: true })
      }
    }
  }, [pathname])

  if (!user) return null

  const effectiveRole = user.impersonate_role || user.role
  const visible = getSidebarItems(effectiveRole, rolePerms, userOverrides)
  const visibleHrefs = new Set<string>(visible.map(i => i.href))
  const deptAccess = getDeptAccess(effectiveRole, rolePerms, userOverrides)
  // Collect all nav hrefs for longest-match comparison
  const allHrefs: string[] = []
  for (const dept of DEPARTMENTS) {
    allHrefs.push(dept.dashboardHref)
    for (const item of dept.items) allHrefs.push(item.href)
  }

  // Active = exact match, OR startsWith(href/) but ONLY if no longer href also matches
  const isActive = (href: string) => {
    if (!pathname) return false
    if (pathname === href) return true
    if (href === '/') return false
    // Check if pathname is under this href
    if (!pathname.startsWith(href + '/') && !pathname.startsWith(href + '?')) return false
    // Only highlight if no other nav href is a longer/better match
    const longerMatch = allHrefs.some(h => h !== href && h.length > href.length && pathname.startsWith(h))
    return !longerMatch
  }
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
        {SMART_DROP_ROLES.includes(effectiveRole) && (
          <div style={{ marginBottom: 4 }}>
            {renderNavItem({ href: '/smart-drop', label: 'Smart Drop', icon: Upload })}
          </div>
        )}

        {/* Department sections */}
        {!collapsed && <div style={{ fontSize: 9, fontWeight: 700, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.1em', padding: '8px 18px 4px', fontFamily: "'IBM Plex Mono', monospace" }}>Departments</div>}

        {DEPARTMENTS.filter(dept => deptAccess.includes(dept.label)).map(dept => {
          const DeptIcon = dept.icon
          const isExpanded = expanded[dept.label]
          const deptItems = dept.items.filter(item => visibleHrefs.has(item.href) || UNLIMITED_ROLES.includes(effectiveRole) || (dept.label === 'Maintenance' && deptAccess.includes('Maintenance')))
          if (deptItems.length === 0 && !UNLIMITED_ROLES.includes(effectiveRole)) return null

          const hasDeptActive = isActive(dept.dashboardHref) || dept.items.some(item => isActive(item.href))

          return (
            <div key={dept.label} style={{ marginBottom: 2 }}>
              <div onClick={() => { if (collapsed) { window.location.href = dept.dashboardHref } else { toggleDept(dept.label) } }} role="button" tabIndex={0} style={{
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
                  {renderNavItem({ href: dept.dashboardHref, label: 'Dashboard', icon: dept.icon }, true)}
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
        {TRASH_ROLES.includes(effectiveRole) && renderNavItem({ href: '/trash', label: 'Trash', icon: Trash2 })}
        {hasAccess(effectiveRole, 'settings', rolePerms, userOverrides) && renderNavItem({ href: '/settings', label: 'Settings', icon: Settings })}
        {PERMISSIONS_ROLES.includes(effectiveRole) && renderNavItem({ href: '/settings/permissions', label: 'Permissions', icon: Lock })}
        <a href="#" onClick={async (e) => { e.preventDefault(); try { await fetch('/api/auth/session', { method: 'DELETE' }) } catch {}; await supabase.auth.signOut(); window.location.href = '/login' }} style={{ textDecoration: 'none' }}>
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
