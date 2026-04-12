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
import { ADMIN_ROLES } from '@/lib/roles'
import { Wrench, Package, Factory, Monitor, FileText, Truck, Users2, UserCircle, ShieldCheck, BarChart3, Cog, Calculator, Clock, Settings, LogOut, Shield, ChevronDown, Upload, BookOpen, ClipboardList, ShoppingCart, Box, Layers, LayoutDashboard, CalendarClock, ClipboardCheck, Fuel, Building2, Receipt, Gauge, AlertTriangle, Zap, Bell, AlarmClock, FileCheck, UserCheck, Repeat, Globe, MapPin, Map, MessageSquare, Trash2, Lock, Banknote, X } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { COLORS } from '@/lib/config/colors'

const UNLIMITED_ROLES = ADMIN_ROLES
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
    label: 'Service', icon: Wrench, color: COLORS.blue, dashboardHref: '/service-writer/dashboard',
    items: [
      { href: '/work-orders', label: 'Work Orders', icon: Wrench },
      { href: '/shop-floor', label: 'Shop Floor', icon: Factory },
    ],
  },
  {
    label: 'Parts', icon: Package, color: COLORS.amber, dashboardHref: '/parts',
    items: [
      { href: '/parts/queue', label: 'Parts Queue', icon: ClipboardList },
      { href: '/parts', label: 'Inventory', icon: Package },
      { href: '/parts/cores', label: 'Core Parts', icon: Box },
    ],
  },
  {
    label: 'Fleet', icon: Truck, color: COLORS.green, dashboardHref: '/fleet',
    items: [
      { href: '/fleet/service-requests', label: 'Service Requests', icon: FileText },
      { href: '/fleet/compliance', label: 'Compliance', icon: ShieldCheck },
      { href: '/customers', label: 'Customers', icon: Users2 },
    ],
  },
  {
    label: 'Maintenance', icon: Wrench, color: COLORS.amber, dashboardHref: '/maintenance',
    items: [
      // Group 1: Billing — highest visibility
      { href: '/maintenance/invoices', label: 'Invoices', icon: Receipt },
      { href: '/maintenance/expenses', label: 'Expenses', icon: Receipt },
      { href: '/maintenance/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
      // Group 2: Work / Service
      { href: '/maintenance/service-requests', label: 'Service Requests', icon: FileText },
      { href: '/maintenance/repairs', label: 'Road Repairs', icon: Truck },
      { href: '/maintenance/pm', label: 'PM Schedules', icon: CalendarClock },
      { href: '/maintenance/inspections', label: 'Inspections', icon: ClipboardCheck },
      // Group 3: Approvals / Warranty
      { href: '/maintenance/warranty-review', label: 'Warranty Review', icon: ShieldCheck },
      { href: '/maintenance/warranties', label: 'Warranties', icon: Shield },
      { href: '/maintenance/recalls', label: 'Recalls', icon: Bell },
      // Group 4: Units / Companies
      { href: '/maintenance/equipment', label: 'Equipment', icon: Cog },
      { href: '/maintenance/drivers', label: 'Drivers', icon: Users2 },
      { href: '/maintenance/vendors', label: 'Vendors', icon: Building2 },
      { href: '/maintenance/fuel', label: 'Fuel', icon: Fuel },
      // Group 5: Records
      { href: '/maintenance/reports', label: 'Reports', icon: BarChart3 },
      { href: '/maintenance/documents', label: 'Documents', icon: FileText },
      { href: '/maintenance/activity', label: 'Activity', icon: MessageSquare },
      { href: '/maintenance/map', label: 'Fleet Map', icon: Map },
    ],
  },
  {
    label: 'Accounting', icon: Calculator, color: COLORS.roleParts, dashboardHref: '/accounting',
    items: [
      { href: '/accounting/history', label: 'Imported History', icon: FileText },
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
  const { tokens: t, mode, toggleMode } = useTheme()
  const pathname = usePathname()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('tz-sidebar-collapsed') === 'true'
    return false
  })
  const [lowStock, setLowStock] = useState(0)
  const [openJobs, setOpenJobs] = useState(0)
  const [isPlatformOwner, setIsPlatformOwner] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [rolePerms, setRolePerms] = useState<Record<string, boolean>>({})
  const [userOverrides, setUserOverrides] = useState<Record<string, boolean>>({})
  const [punchedIn, setPunchedIn] = useState(false)
  const [punchTime, setPunchTime] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState('')
  const [qaOpen, setQaOpen] = useState(false)

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

  useEffect(() => {
    localStorage.setItem('tz-sidebar-collapsed', String(collapsed))
    window.dispatchEvent(new Event('storage'))
  }, [collapsed])

  // Fetch punch status
  useEffect(() => {
    fetch('/api/mechanic/work-punch').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.punchedIn && d.activePunch?.punch_in_at) { setPunchedIn(true); setPunchTime(d.activePunch.punch_in_at) }
    }).catch(() => {})
  }, [])

  // Elapsed timer
  useEffect(() => {
    if (!punchedIn || !punchTime) { setElapsed(''); return }
    const tick = () => {
      const m = Math.floor((Date.now() - new Date(punchTime).getTime()) / 60000)
      setElapsed(m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`)
    }
    tick()
    const iv = setInterval(tick, 60000)
    return () => clearInterval(iv)
  }, [punchedIn, punchTime])

  // ESC to close Quick Actions
  useEffect(() => {
    if (!qaOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setQaOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [qaOpen])

  // Auto-expand section containing active page — runs on every pathname change
  // Also auto-expand Accounting for accountant roles
  useEffect(() => {
    for (const dept of DEPARTMENTS) {
      const deptBase = dept.dashboardHref.replace(/\/dashboard$/, '') // e.g. '/accounting'
      const matchesDept = pathname === dept.dashboardHref || pathname?.startsWith(dept.dashboardHref + '/') || pathname === deptBase || pathname?.startsWith(deptBase + '/')
      const matchesItem = dept.items.some(item => pathname === item.href || pathname?.startsWith(item.href + '/'))
      if (matchesDept || matchesItem) {
        setExpanded(prev => prev[dept.label] ? prev : { ...prev, [dept.label]: true })
      }
    }
    // Auto-expand Accounting for accountant/accounting_manager roles
    const role = user?.impersonate_role || user?.role
    if (role && ['accountant', 'accounting_manager'].includes(role)) {
      setExpanded(prev => prev['Accounting'] ? prev : { ...prev, Accounting: true })
    }
  }, [pathname, user])

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

  async function togglePunch() {
    if (punchedIn) {
      if (!confirm(`Clock out after ${elapsed || '0m'}?`)) return
      const res = await fetch('/api/mechanic/work-punch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'punch_out' }) })
      if (res.ok) { setPunchedIn(false); setPunchTime(null); setElapsed('') }
    } else {
      const res = await fetch('/api/mechanic/work-punch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'punch_in' }) })
      if (res.ok) { const d = await res.json(); setPunchedIn(true); setPunchTime(d.punch?.punch_in_at || new Date().toISOString()) }
    }
  }

  const qaItems = [
    { group: 'Sales', items: [
      { label: 'New Work Order', href: '/work-orders/new' },
      { label: 'Quick Service Order', href: null },
      { label: 'New Estimate', href: null },
      { label: 'Counter Sale', href: null },
      { label: 'Service Request', href: '/service-requests/new' },
    ]},
    { group: 'Operations', items: [
      { label: 'Add Customer', href: '/customers/new' },
      { label: 'Add Unit', href: '/fleet/new' },
      { label: 'Receive Payment', href: null },
      { label: 'Purchase Order', href: '/maintenance/purchase-orders/new' },
      { label: 'Receive Parts', href: null },
    ]},
  ]

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
          background: active ? t.sidebarActiveBg : 'transparent',
          border: active ? `1px solid ${t.sidebarActiveBorder}` : '1px solid transparent',
          cursor: 'pointer', transition: 'all .12s',
        }}
        onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = t.bgHover; (e.currentTarget as HTMLElement).style.color = t.text } }}
        onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '' } }}>
          <span style={{ flexShrink: 0, width: indent ? 13 : 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={indent ? 13 : 15} strokeWidth={1.5} color={active ? t.sidebarTextActive : t.textTertiary} />
          </span>
          {!collapsed && (
            <>
              <span style={{ fontSize: indent ? 11 : 12, fontWeight: active ? 600 : 400, color: active ? t.sidebarTextActive : t.textSecondary, flex: 1, whiteSpace: 'nowrap' }}>{item.label}</span>
              {badge != null && badge > 0 && (
                <span style={{ background: item.href === '/parts' ? t.danger : t.accent, color: t.bgLight, fontSize: 9, fontWeight: 700, fontFamily: 'monospace', padding: '1px 5px', borderRadius: 100, minWidth: 16, textAlign: 'center' }}>{badge > 99 ? '99+' : badge}</span>
              )}
            </>
          )}
        </div>
      </a>
    )
  }

  return (
    <aside style={{ width: W, height: '100vh', background: t.sidebarBg, borderRight: `1px solid ${t.sidebarBorder}`, display: 'flex', flexDirection: 'column', transition: 'width .2s ease', flexShrink: 0, position: 'sticky', top: 0, overflow: 'hidden' }}>
      {/* Logo / brand */}
      <div style={{ padding: collapsed ? '18px 14px' : '18px 20px', borderBottom: `1px solid ${t.sidebarBorder}`, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', minHeight: 62, color: t.text }}>
        {collapsed ? <LogoIcon size="md" /> : <Logo size="md" showWordmark={true} />}
        <button onClick={() => setCollapsed(c => !c)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textTertiary, fontSize: 16, padding: 6, lineHeight: 1, borderRadius: 4 }}
          onMouseEnter={e => (e.currentTarget.style.color = t.text)} onMouseLeave={e => (e.currentTarget.style.color = t.textTertiary)}>{collapsed ? '\u00BB' : '\u00AB'}</button>
      </div>

      {/* Platform Admin */}
      {isPlatformOwner && (
        <div style={{ borderBottom: `1px solid ${t.border}`, padding: '6px 0' }}>
          {renderNavItem({ href: '/platform-admin', label: 'Platform Admin', icon: Shield })}
        </div>
      )}

      {/* Clock In/Out */}
      <div style={{ padding: collapsed ? '8px 6px' : '8px 12px' }}>
        <button onClick={togglePunch} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: collapsed ? '8px 0' : '8px 12px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          background: punchedIn ? 'rgba(92,184,138,0.04)' : 'transparent',
          border: `1px solid ${punchedIn ? 'rgba(92,184,138,0.2)' : t.cardBorder}`,
          borderRadius: 8, cursor: 'pointer', transition: 'all .15s',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: punchedIn ? t.success : t.danger, flexShrink: 0, animation: 'tz-pulse 2s infinite' }} />
          {!collapsed && <>
            <span style={{ fontSize: 11, fontWeight: 600, color: punchedIn ? t.success : t.textSecondary }}>{punchedIn ? 'Clocked In' : 'Clock In'}</span>
            {punchedIn && elapsed && <span style={{ marginLeft: 'auto', fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: t.textTertiary }}>{elapsed}</span>}
          </>}
        </button>
      </div>
      <style>{`@keyframes tz-pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }`}</style>

      <nav style={{ flex: 1, padding: '6px 0', overflowY: 'auto', overflowX: 'hidden' }}>
        {/* Smart Drop — standalone */}
        {SMART_DROP_ROLES.includes(effectiveRole) && (
          <div style={{ marginBottom: 4 }}>
            {renderNavItem({ href: '/smart-drop', label: 'Smart Drop', icon: Upload })}
          </div>
        )}

        {/* Department sections */}
        {!collapsed && <div style={{ fontSize: 9, fontWeight: 600, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '.08em', padding: '8px 18px 4px', fontFamily: "'IBM Plex Mono', monospace" }}>Departments</div>}

        {DEPARTMENTS.filter(dept => deptAccess.includes(dept.label)).map(dept => {
          const DeptIcon = dept.icon
          const isExpanded = expanded[dept.label]
          const deptItems = dept.items.filter(item => visibleHrefs.has(item.href) || UNLIMITED_ROLES.includes(effectiveRole) || (dept.label === 'Maintenance' && deptAccess.includes('Maintenance')) || (dept.label === 'Fleet' && deptAccess.includes('Fleet')))
          if (deptItems.length === 0 && !UNLIMITED_ROLES.includes(effectiveRole)) return null

          const hasDeptActive = isActive(dept.dashboardHref) || dept.items.some(item => isActive(item.href))

          return (
            <div key={dept.label} style={{ marginBottom: 2 }}>
              <div onClick={() => { if (collapsed) { window.location.href = dept.dashboardHref } else { toggleDept(dept.label) } }} role="button" tabIndex={0} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: collapsed ? '8px 0' : '8px 16px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                margin: '1px 6px', borderRadius: 8,
                background: hasDeptActive && !isExpanded ? t.bgHover : 'transparent',
                cursor: 'pointer', transition: 'all .12s', userSelect: 'none',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = t.bgHover)}
              onMouseLeave={e => (e.currentTarget.style.background = hasDeptActive && !isExpanded ? t.bgHover : 'transparent')}>
                <span style={{ flexShrink: 0, width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DeptIcon size={14} strokeWidth={1.5} color={hasDeptActive ? dept.color : t.textSecondary} />
                </span>
                {!collapsed && (
                  <>
                    <span style={{ fontSize: 11, fontWeight: 700, color: hasDeptActive ? t.text : t.textSecondary, flex: 1, textAlign: 'left' }}>{dept.label}</span>
                    <ChevronDown size={12} color={t.textTertiary} style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .15s' }} />
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

      {/* Quick Actions */}
      <div style={{ padding: '4px 6px' }}>
        <div onClick={() => setQaOpen(true)} role="button" tabIndex={0} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: collapsed ? '8px 0' : '8px 16px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          margin: '1px 0', borderRadius: 8,
          cursor: 'pointer', transition: 'all .12s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = t.bgHover)}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <span style={{ flexShrink: 0, width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M11.5 2L4 12h5.5l-1 6L17 8h-5.5l1-6z" fill={t.warning} /></svg>
          </span>
          {!collapsed && <span style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary }}>Quick Actions</span>}
        </div>
      </div>

      {/* Bottom: Settings + Sign Out */}
      <div style={{ borderTop: `1px solid ${t.border}`, padding: '6px 0' }}>
        {!collapsed && <div style={{ fontSize: 9, fontWeight: 600, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '.08em', padding: '4px 18px 2px', fontFamily: "'IBM Plex Mono', monospace" }}>Platform</div>}
        {TRASH_ROLES.includes(effectiveRole) && renderNavItem({ href: '/trash', label: 'Trash', icon: Trash2 })}
        {hasAccess(effectiveRole, 'settings', rolePerms, userOverrides) && renderNavItem({ href: '/settings', label: 'Settings', icon: Settings })}
        {PERMISSIONS_ROLES.includes(effectiveRole) && renderNavItem({ href: '/settings/permissions', label: 'Permissions', icon: Lock })}
        {/* Theme Toggle */}
        <div onClick={toggleMode} role="button" tabIndex={0} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: collapsed ? '8px 0' : '8px 16px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          margin: '1px 6px', borderRadius: 8,
          cursor: 'pointer', transition: 'all .12s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = t.bgHover)}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <span style={{ flexShrink: 0, width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {mode === 'dark' ? (
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke={t.textSecondary} strokeWidth="1.5"><circle cx="10" cy="10" r="4"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41"/></svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke={t.textSecondary} strokeWidth="1.5"><path d="M17.3 14.3A7 7 0 015.7 2.7 8 8 0 1017.3 14.3z"/></svg>
            )}
          </span>
          {!collapsed && <span style={{ fontSize: 12, color: t.textSecondary }}>{mode === 'dark' ? 'Dark Mode' : 'Warm Mode'}</span>}
        </div>
        <a href="#" onClick={async (e) => { e.preventDefault(); try { await fetch('/api/auth/session', { method: 'DELETE' }) } catch {}; await supabase.auth.signOut(); window.location.href = '/login' }} style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '9px 0' : '9px 16px', justifyContent: collapsed ? 'center' : 'flex-start', margin: '1px 6px', borderRadius: 8, cursor: 'pointer', transition: 'all .12s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,.08)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
            <span style={{ flexShrink: 0, width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LogOut size={15} strokeWidth={1.5} color={t.textSecondary} /></span>
            {!collapsed && <span style={{ fontSize: 12, color: t.textSecondary }}>Sign Out</span>}
          </div>
        </a>
      </div>
      <div style={{ height: 4 }} />

      {/* Quick Actions Modal */}
      {qaOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setQaOpen(false)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
          <div style={{ position: 'relative', width: 400, maxWidth: '90vw', background: t.bgCard, border: `1px solid ${t.cardBorder}`, borderRadius: 14, padding: 24, zIndex: 1 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: t.text }}>Quick Actions</span>
              <button onClick={() => setQaOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textTertiary, padding: 4 }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {qaItems.map(g => (
                <div key={g.group}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>{g.group}</div>
                  {g.items.map(item => (
                    <div key={item.label} onClick={() => { if (item.href) { window.location.href = item.href } else { setQaOpen(false) } }} style={{ fontSize: 12, color: t.textSecondary, padding: '6px 0', cursor: 'pointer', opacity: item.href ? 1 : 0.5 }}
                      onMouseEnter={e => (e.currentTarget.style.color = t.accent)} onMouseLeave={e => (e.currentTarget.style.color = t.textSecondary)}>{item.label}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
