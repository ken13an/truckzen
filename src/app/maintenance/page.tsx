'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { Truck, CalendarClock, ShieldAlert, Fuel, AlertTriangle, Users2, Plus, Zap, FileCheck, AlarmClock, Shield, MessageSquare } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"

export default function MaintenanceDashboard() {
  const { tokens: t } = useTheme()
  const BLUE = '#1B6EE6', GREEN = '#1DB870', AMBER = t.warning, RED = t.danger, MUTED = t.textSecondary
  const supabase = createClient()
  const [stats, setStats] = useState<any>({})
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { window.location.href = '/login'; return }
      const [dashRes, actRes] = await Promise.all([
        fetch(`/api/maintenance/dashboard?shop_id=${profile.shop_id}`),
        supabase.from('maint_activity_log').select('*').eq('shop_id', profile.shop_id).order('created_at', { ascending: false }).limit(10),
      ])
      if (dashRes.ok) setStats(await dashRes.json())
      setActivities(actRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const cards = [
    { label: 'Active Road Repairs', value: stats.activeRepairs || 0, color: BLUE, icon: Truck, href: '/maintenance/repairs' },
    { label: 'Overdue PMs', value: stats.overduePMs || 0, color: RED, icon: CalendarClock, href: '/maintenance/pm' },
    { label: 'Expiring CDLs (30d)', value: stats.expiringCDLs || 0, color: AMBER, icon: ShieldAlert, href: '/maintenance/drivers' },
    { label: 'Fuel Spend This Month', value: `$${(stats.fuelSpendMonth || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: GREEN, icon: Fuel, href: '/maintenance/fuel' },
    { label: 'Open Defects', value: stats.openDefects || 0, color: RED, icon: AlertTriangle, href: '/maintenance/inspections' },
    { label: 'Total Drivers', value: stats.totalDrivers || 0, color: BLUE, icon: Users2, href: '/maintenance/drivers' },
    { label: 'Overdue Reminders', value: stats.overdueReminders || 0, color: RED, icon: AlarmClock, href: '/maintenance/service-reminders' },
    { label: 'Due Soon Reminders', value: stats.dueSoonReminders || 0, color: AMBER, icon: AlarmClock, href: '/maintenance/service-reminders' },
    { label: 'Open Issues', value: stats.openIssues || 0, color: AMBER, icon: AlertTriangle, href: '/maintenance/issues' },
    { label: 'Open Faults', value: stats.openFaults || 0, color: RED, icon: Zap, href: '/maintenance/faults' },
    { label: 'Overdue Renewals', value: stats.overdueVehicleRenewals || 0, color: RED, icon: FileCheck, href: '/maintenance/vehicle-renewals' },
    { label: 'Active Warranties', value: stats.activeWarranties || 0, color: GREEN, icon: Shield, href: '/maintenance/warranties' },
  ]

  const quickActions = [
    { label: 'New Road Repair', href: '/maintenance/repairs/new' },
    { label: 'Schedule PM', href: '/maintenance/pm/new' },
    { label: 'Add Fuel Entry', href: '/maintenance/fuel/new' },
    { label: 'New Inspection', href: '/maintenance/inspections/new' },
    { label: 'Report Issue', href: '/maintenance/issues/new' },
    { label: 'Add Renewal', href: '/maintenance/vehicle-renewals/new' },
    { label: 'Log Fault', href: '/maintenance/faults/new' },
  ]

  const typeColor: Record<string, string> = { comment: BLUE, status_change: AMBER, repair_created: GREEN, fault_detected: RED, issue_reported: AMBER }

  return (
    <div style={{ background: t.bg, minHeight: '100vh', color: t.text, fontFamily: FONT, padding: 24 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: t.text, marginBottom: 20 }}>Maintenance</div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10, marginBottom: 24 }}>
        {cards.map(c => {
          const Icon = c.icon
          return (
            <a key={c.label} href={c.href} style={{ textDecoration: 'none' }}>
              <div style={{ background: t.bgCard, border: `1px solid ${t.bgActive}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', transition: 'border-color .15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = c.color + '44')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = t.bgActive)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                  <Icon size={13} color={c.color} />
                  <span style={{ fontSize: 9, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: MONO }}>{c.label}</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: loading ? MUTED : c.color }}>{loading ? '...' : c.value}</div>
              </div>
            </a>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: MONO, marginBottom: 10 }}>Quick Actions</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {quickActions.map(a => (
            <a key={a.label} href={a.href} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 14px', background: 'linear-gradient(135deg,#1B6EE6,#1248B0)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 700, textDecoration: 'none', fontFamily: FONT }}>
              <Plus size={12} /> {a.label}
            </a>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div style={{ background: t.bgCard, border: `1px solid ${t.bgActive}`, borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MessageSquare size={14} color={MUTED} />
            <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>Recent Activity</span>
          </div>
          <a href="/maintenance/activity" style={{ fontSize: 11, color: t.accentLight, textDecoration: 'none' }}>View all</a>
        </div>
        {activities.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: t.textTertiary, fontSize: 12 }}>No activity yet. Data will appear here once maintenance records are created.</div>
        ) : (
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {activities.map(a => (
              <div key={a.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.03)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${typeColor[a.activity_type] || BLUE}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: typeColor[a.activity_type] || BLUE, flexShrink: 0 }}>
                  {(a.user_name || 'S')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: t.text }}><span style={{ fontWeight: 600 }}>{a.user_name || 'System'}</span> <span style={{ color: MUTED }}>{a.activity_type?.replace(/_/g, ' ')}</span></div>
                  <div style={{ fontSize: 11, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.message}</div>
                </div>
                <div style={{ fontSize: 9, color: MUTED, whiteSpace: 'nowrap' }}>{new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
