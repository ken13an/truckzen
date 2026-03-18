'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const NAV: {
  label: string
  href: string
  icon: string
  roles?: string[]
  badge?: string
}[] = [
  { label: 'Dashboard',    href: '/dashboard',     icon: '▦'  },
  { label: 'Shop Floor',   href: '/floor',         icon: '⬡'  },
  { label: 'Service Orders',href: '/orders',       icon: '≡'  },
  { label: 'Invoices',     href: '/invoices',      icon: '$'  },
  { label: 'Parts',        href: '/parts',         icon: '⬡', roles: ['owner','gm','it_person','shop_manager','parts_manager','service_advisor','service_writer','technician','office_admin'] },
  { label: 'Fleet',        href: '/fleet',         icon: '◈'  },
  { label: 'Drivers',      href: '/drivers',       icon: '◉', roles: ['owner','gm','it_person','shop_manager','fleet_manager','office_admin'] },
  { label: 'Maintenance',  href: '/maintenance',   icon: '⚙'  },
  { label: 'Compliance',   href: '/compliance',    icon: '✓', roles: ['owner','gm','it_person','shop_manager','fleet_manager','office_admin'] },
  { label: 'Customers',    href: '/customers',     icon: '◎', roles: ['owner','gm','it_person','shop_manager','service_advisor','service_writer','office_admin'] },
  { label: 'Accounting',   href: '/accounting',    icon: '◈', roles: ['owner','gm','it_person','accountant','office_admin'] },
  { label: 'Reports',      href: '/reports',       icon: '▤', roles: ['owner','gm','it_person','shop_manager','accountant','office_admin'] },
  { label: 'Cleaning',     href: '/cleaning',      icon: '◇'  },
  { label: 'Time Tracking',href: '/time-tracking', icon: '⏲', roles: ['owner','gm','it_person','shop_manager','office_admin'] },
  { label: 'Smart Drop',   href: '/smart-drop',    icon: '↓', roles: ['owner','gm','it_person','shop_manager','office_admin'] },
  { label: 'Settings',     href: '/settings',      icon: '⚙', roles: ['owner','gm','it_person','shop_manager','office_admin'] },
]

const ROLE_LABEL: Record<string, string> = {
  owner:'Owner', gm:'GM', it_person:'IT', shop_manager:'Shop Manager',
  service_advisor:'Advisor', service_writer:'Writer', technician:'Tech',
  parts_manager:'Parts Mgr', fleet_manager:'Fleet Mgr', maintenance_manager:'Maint. Mgr',
  maintenance_technician:'Maint. Tech', accountant:'Accountant',
  office_admin:'Admin', dispatcher:'Dispatcher', driver:'Driver',
}

const ROLE_COLOR: Record<string, string> = {
  owner:'#D94F4F', gm:'#D94F4F', it_person:'#D94F4F',
  shop_manager:'#D4882A', service_advisor:'#4D9EFF', technician:'#1DB870',
  parts_manager:'#8B5CF6', fleet_manager:'#0E9F8E', accountant:'#E8692A',
}

export default function Sidebar() {
  const pathname = usePathname()
  const supabase = createClient()
  const [user,       setUser]       = useState<any>(null)
  const [collapsed,  setCollapsed]  = useState(false)
  const [lowStock,   setLowStock]   = useState(0)
  const [openJobs,   setOpenJobs]   = useState(0)

  useEffect(() => {
    async function load() {
      const { data: { user: au } } = await supabase.auth.getUser()
      if (!au) return
      const { data } = await supabase.from('users').select('id, shop_id, full_name, role, team').eq('id', au.id).single()
      if (!data) return
      setUser(data)

      // Load badge counts
      const [{ count: ls }, { count: oj }] = await Promise.all([
        supabase.from('parts').select('*', { count:'exact', head:true })
          .eq('shop_id', data.shop_id).lte('on_hand', 2),
        supabase.from('service_orders').select('*', { count:'exact', head:true })
          .eq('shop_id', data.shop_id).not('status', 'in', '("good_to_go","void")'),
      ])
      setLowStock(ls || 0)
      setOpenJobs(oj || 0)
    }
    load()
  }, [])

  if (!user) return null

  // Filter nav by role
  const visible = NAV.filter(item => !item.roles || item.roles.includes(user.role))

  const roleColor = ROLE_COLOR[user.role] || '#7C8BA0'
  const initials  = user.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const W = collapsed ? 56 : 220

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
        {!collapsed && (
          <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: '.1em', color: '#F0F4FF' }}>
            TRUCK<span style={{ color: '#4D9EFF' }}>ZEN</span>
          </span>
        )}
        <button onClick={() => setCollapsed(c => !c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#48536A', fontSize: 16, padding: 4, lineHeight: 1 }}>
          {collapsed ? '»' : '«'}
        </button>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto', overflowX: 'hidden' }}>
        {visible.map(item => {
          const active = isActive(item.href)
          const badge  = item.href === '/parts' && lowStock > 0 ? lowStock
                       : item.href === '/orders' && openJobs > 0 ? openJobs
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
                <span style={{ fontSize: 13, color: active ? '#4D9EFF' : '#7C8BA0', flexShrink: 0, width: 16, textAlign: 'center' }}>
                  {item.icon}
                </span>
                {!collapsed && (
                  <>
                    <span style={{ fontSize: 12, fontWeight: active ? 700 : 400, color: active ? '#F0F4FF' : '#7C8BA0', flex: 1, whiteSpace: 'nowrap' }}>
                      {item.label}
                    </span>
                    {badge && badge > 0 && (
                      <span style={{ background: item.href === '/parts' ? '#D94F4F' : '#1D6FE8', color: '#fff', fontSize: 9, fontWeight: 700, fontFamily: 'monospace', padding: '1px 5px', borderRadius: 100, minWidth: 16, textAlign: 'center' }}>
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
      <div style={{ padding: collapsed ? '12px 0' : '12px 14px', borderTop: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', gap: 10, justifyContent: collapsed ? 'center' : 'flex-start' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: `linear-gradient(135deg,${roleColor}66,${roleColor}33)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontSize: 9, fontWeight: 700, color: roleColor, flexShrink: 0 }}>
          {initials}
        </div>
        {!collapsed && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#DDE3EE', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.full_name?.split(' ')[0]}
            </div>
            <div style={{ fontSize: 9, color: roleColor, fontFamily: 'monospace' }}>
              {ROLE_LABEL[user.role] || user.role}
              {user.team && ` · Team ${user.team}`}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
