'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser, type UserProfile } from '@/lib/auth'
import { Check, Bell, ChevronRight, X } from 'lucide-react'

const FONT = "'Inter', -apple-system, sans-serif"
const BLUE = '#1D6FE8', GREEN = '#16A34A', RED = '#DC2626', AMBER = '#D97706', GRAY = '#6B7280'

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner', gm: 'GM', it_person: 'IT Admin', shop_manager: 'Shop Manager',
  service_writer: 'Service Writer', technician: 'Technician', lead_tech: 'Lead Tech',
  parts_manager: 'Parts Dept', fleet_manager: 'Fleet Manager', maintenance_manager: 'Maint. Manager',
  maintenance_technician: 'Maint. Tech', accountant: 'Accounting', office_admin: 'Office Admin',
}

const PRIORITY_BORDER: Record<string, string> = { urgent: RED, high: AMBER, normal: BLUE, low: GRAY }

export default function DashboardPage() {
  const supabase = createClient()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [shop, setShop] = useState<any>(null)

  const loadDashboard = useCallback(async (u: UserProfile) => {
    const res = await fetch(`/api/dashboard?user_id=${u.id}`)
    if (res.ok) setData(await res.json())
  }, [])

  useEffect(() => {
    getCurrentUser(supabase).then(async (p) => {
      if (!p) { window.location.href = '/login'; return }
      setUser(p)
      const shopRes = await fetch(`/api/settings?shop_id=${p.shop_id}`)
      if (shopRes.ok) setShop(await shopRes.json())
      await loadDashboard(p)
      setLoading(false)
    })
  }, [])

  // Auto-refresh every 30s
  useEffect(() => {
    if (!user) return
    const iv = setInterval(() => loadDashboard(user), 30000)
    return () => clearInterval(iv)
  }, [user, loadDashboard])

  // Real-time notifications
  useEffect(() => {
    if (!user) return
    const channel = supabase.channel('dashboard-notifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
        loadDashboard(user)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  async function markRead(notifId: string) {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: notifId, action: 'mark_read', user_id: user?.id }) })
    setData((d: any) => d ? { ...d, notifications: d.notifications.filter((n: any) => n.id !== notifId) } : d)
  }

  async function dismissNotif(notifId: string) {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: notifId, action: 'dismiss', user_id: user?.id }) })
    setData((d: any) => d ? { ...d, notifications: d.notifications.filter((n: any) => n.id !== notifId) } : d)
  }

  async function markAllRead() {
    if (!user) return
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'all', action: 'mark_read', user_id: user.id }) })
    setData((d: any) => d ? { ...d, notifications: [] } : d)
  }

  if (loading || !data) return <div style={{ background: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: GRAY, fontFamily: FONT }}>Loading dashboard...</div>

  const stats = data.stats || {}
  const notifications = data.notifications || []
  const actionItems = data.actionItems || []
  const teamStatus = data.teamStatus
  const recentActivity = data.recentActivity || []
  const role = data.role || user?.role || ''
  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'

  function timeAgo(d: string) {
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
    if (diff < 1) return 'just now'
    if (diff < 60) return `${diff}m ago`
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`
    return `${Math.floor(diff / 1440)}d ago`
  }

  const statCards = Object.entries(stats).map(([key, value]) => ({
    label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    value: typeof value === 'number' && key.includes('revenue') ? `$${(value as number).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : value,
    color: key.includes('pending') || key.includes('unassigned') || key.includes('overdue') ? AMBER : key.includes('revenue') || key.includes('approved') || key.includes('completed') ? GREEN : BLUE,
  }))

  const card: React.CSSProperties = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }

  return (
    <div style={{ background: '#F9FAFB', minHeight: '100vh', fontFamily: FONT, padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>{greeting}, {user?.full_name?.split(' ')[0] || 'there'}</div>
          <div style={{ fontSize: 13, color: GRAY, marginTop: 2 }}>{shop?.name || ''} · {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        </div>
        <span style={{ padding: '4px 12px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: '#EFF6FF', color: BLUE }}>{ROLE_LABEL[role] || role}</span>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(statCards.length, 4)}, 1fr)`, gap: 12, marginBottom: 24 }}>
        {statCards.map(c => (
          <div key={c.label} style={{ ...card, borderLeft: `3px solid ${c.color}` }}>
            <div style={{ fontSize: 11, color: GRAY, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#111827' }}>{String(c.value)}</div>
          </div>
        ))}
      </div>

      {/* Main content: Action Items + Notifications */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16, marginBottom: 24 }}>
        {/* Action Items */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Action Items</div>
          {actionItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: GREEN }}>
              <Check size={28} style={{ marginBottom: 6 }} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>You're all caught up</div>
              <div style={{ fontSize: 12, color: GRAY, marginTop: 2 }}>No action items right now</div>
            </div>
          ) : actionItems.map((item: any) => (
            <div key={item.id} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid #F3F4F6', borderLeft: `3px solid ${PRIORITY_BORDER[item.priority] || BLUE}`, paddingLeft: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{item.title}</div>
                {item.wo_number && <div style={{ fontSize: 11, color: BLUE, fontWeight: 600, marginTop: 2 }}>{item.wo_number}{item.unit ? ` · #${item.unit}` : ''}</div>}
                {item.description && <div style={{ fontSize: 12, color: GRAY, marginTop: 2 }}>{item.description}</div>}
              </div>
              <a href={item.link} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: BLUE, color: '#fff', borderRadius: 6, fontSize: 11, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', height: 'fit-content' }}>
                {item.action || 'View'} <ChevronRight size={12} />
              </a>
            </div>
          ))}
        </div>

        {/* Notifications */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Bell size={14} color={GRAY} />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Notifications</span>
              {notifications.length > 0 && <span style={{ background: RED, color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 100 }}>{notifications.length}</span>}
            </div>
            {notifications.length > 0 && (
              <button onClick={markAllRead} style={{ fontSize: 11, color: BLUE, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: FONT }}>Mark all read</button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: GRAY, fontSize: 12 }}>No new notifications</div>
          ) : notifications.map((n: any) => (
            <div key={n.id} style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }} onClick={() => { markRead(n.id); if (n.link) window.location.href = n.link }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: BLUE, marginTop: 5, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#111827' }}>{n.title}</div>
                <div style={{ fontSize: 11, color: GRAY, marginTop: 1 }}>{n.body?.slice(0, 80)}</div>
                <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{timeAgo(n.created_at)}</div>
              </div>
              <button onClick={e => { e.stopPropagation(); dismissNotif(n.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB', padding: 2 }}><X size={14} /></button>
            </div>
          ))}
        </div>
      </div>

      {/* Team Status (Floor Manager / Owner) */}
      {teamStatus && Array.isArray(teamStatus) && teamStatus.length > 0 && (
        <div style={{ ...card, marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Team Status</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            {teamStatus.map((m: any) => (
              <div key={m.id} style={{ padding: '10px 14px', background: '#F9FAFB', borderRadius: 8, border: '1px solid #F3F4F6' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{m.full_name}</div>
                <div style={{ fontSize: 11, color: GRAY, marginTop: 2 }}>Team {m.team || '—'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Recent Activity</div>
        {recentActivity.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: GRAY, fontSize: 12 }}>No recent activity</div>
        ) : recentActivity.map((a: any) => (
          <div key={a.id} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid #F3F4F6' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#D1D5DB', marginTop: 6, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: '#374151' }}>{a.action}</div>
              <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>{timeAgo(a.created_at)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
