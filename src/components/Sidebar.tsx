'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getSidebarItems, ROLE_LABEL, ROLE_COLOR } from '@/lib/permissions'
import {
  LayoutDashboard, Kanban, ClipboardList, FileText, Package, Truck,
  Wrench, Users, Calculator, BarChart3, Clock, Settings, CircleDot,
  RefreshCw, ShieldCheck, Contact, Upload, Lock, Smartphone, ClipboardCheck,
  CreditCard, Plug, ScrollText, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  'layout-dashboard': LayoutDashboard, 'kanban': Kanban, 'clipboard-list': ClipboardList,
  'file-text': FileText, 'package': Package, 'truck': Truck, 'wrench': Wrench,
  'users': Users, 'calculator': Calculator, 'bar-chart-3': BarChart3, 'clock': Clock,
  'settings': Settings, 'circle-dot': CircleDot, 'refresh-cw': RefreshCw,
  'shield-check': ShieldCheck, 'contact': Contact, 'upload': Upload, 'lock': Lock,
  'smartphone': Smartphone, 'clipboard-check': ClipboardCheck, 'credit-card': CreditCard,
  'plug': Plug, 'scroll-text': ScrollText,
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

  useEffect(() => {
    async function load() {
      const { data: { user: au } } = await supabase.auth.getUser()
      if (!au) return
      const { data } = await supabase.from('users').select('id, shop_id, full_name, role, team').eq('id', au.id).single()
      if (!data) return
      setUser(data)

      const { data: rp } = await supabase.from('role_permissions').select('module, allowed').eq('shop_id', data.shop_id).eq('role', data.role)
      if (rp) setRolePerms(Object.fromEntries(rp.map((r: any) => [r.module, r.allowed])))

      const { data: uo } = await supabase.from('user_permission_overrides').select('module, allowed').eq('user_id', data.id)
      if (uo) setUserOverrides(Object.fromEntries(uo.map((r: any) => [r.module, r.allowed])))

      const [{ count: ls }, { count: oj }] = await Promise.all([
        supabase.from('parts').select('*', { count: 'exact', head: true }).eq('shop_id', data.shop_id).lte('on_hand', 2),
        supabase.from('service_orders').select('*', { count: 'exact', head: true }).eq('shop_id', data.shop_id).not('status', 'in', '("good_to_go","void")'),
      ])
      setLowStock(ls ?? 0)
      setOpenJobs(oj ?? 0)
    }
    load()
  }, [])

  if (!user) return null

  const visible = getSidebarItems(user.role, rolePerms, userOverrides)
  const roleColor = ROLE_COLOR[user.role] ?? 'var(--text-tertiary)'
  const initials = (user.full_name ?? '').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname?.startsWith(href) ?? false
  }

  return (
    <aside
      className={`flex flex-col sticky top-0 h-screen shrink-0 border-r border-brand-border bg-surface transition-all duration-200 ${collapsed ? 'w-14' : 'w-60'}`}
    >
      {/* Logo */}
      <div className={`flex items-center border-b border-brand-border min-h-14 ${collapsed ? 'justify-center px-2 py-4' : 'justify-between px-4 py-4'}`}>
        {!collapsed && (
          <span className="text-base font-bold tracking-wide text-text-primary">
            truck<span className="text-teal">zen</span><span className="text-teal">.</span>
          </span>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="text-text-tertiary hover:text-text-secondary transition-colors duration-150 p-1"
        >
          {collapsed ? <PanelLeftOpen size={18} strokeWidth={1.5} /> : <PanelLeftClose size={18} strokeWidth={1.5} />}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden">
        {visible.map(item => {
          const active = isActive(item.href)
          const IconComponent = ICON_MAP[item.icon] ?? LayoutDashboard
          const badge = item.href === '/parts' && lowStock > 0 ? lowStock
            : item.href === '/orders' && openJobs > 0 ? openJobs
            : null

          return (
            <a key={item.href} href={item.href} className="no-underline block">
              <div
                className={`flex items-center gap-2.5 mx-1.5 rounded-md transition-all duration-150
                  ${collapsed ? 'justify-center py-2.5' : 'py-2.5 px-3'}
                  ${active ? 'bg-teal/10 border-l-2 border-teal' : 'border-l-2 border-transparent hover:bg-surface-2'}
                `}
              >
                <IconComponent
                  size={18}
                  strokeWidth={1.5}
                  className={`shrink-0 ${active ? 'text-teal' : 'text-text-tertiary'}`}
                />
                {!collapsed && (
                  <>
                    <span className={`text-sm flex-1 whitespace-nowrap ${active ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>
                      {item.label}
                    </span>
                    {badge != null && badge > 0 && (
                      <span className="bg-error text-white text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-full min-w-4 text-center">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </>
                )}
              </div>
            </a>
          )
        })}
      </nav>

      {/* User profile footer */}
      <div className={`flex items-center gap-2.5 border-t border-brand-border ${collapsed ? 'justify-center py-3' : 'px-3 py-3'}`}>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center font-mono text-[9px] font-bold shrink-0"
          style={{ background: `${roleColor}22`, color: roleColor }}
        >
          {initials}
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="text-xs font-semibold text-text-primary whitespace-nowrap overflow-hidden text-ellipsis">
              {(user.full_name ?? '').split(' ')[0]}
            </div>
            <div className="text-[9px] font-mono" style={{ color: roleColor }}>
              {ROLE_LABEL[user.role] ?? user.role}
              {user.team ? ` · Team ${user.team}` : ''}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
