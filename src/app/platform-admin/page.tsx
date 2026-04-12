'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { getPermissions } from '@/lib/getPermissions'
import { Store, Wrench, FileText, DollarSign } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

export default function PlatformOverview() {
  const { tokens: t } = useTheme()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const u = await getCurrentUser(supabase)
      if (!u) { window.location.href = '/login'; return }
      const perms = getPermissions(u)
      if (!perms.canAccessPlatformAdmin) { window.location.href = '/403'; return }
      setUser(u)

      const res = await fetch(`/api/platform-admin/stats?user_id=${u.id}`)
      if (res.ok) setStats(await res.json())
      setLoading(false)
    }
    load()
  }, [])

  if (loading || !stats) {
    return <div style={{ color: t.textSecondary, fontSize: 13, padding: 40 }}>Loading...</div>
  }

  const statCards = [
    { label: 'Total Shops', value: stats.total_shops, icon: Store, color: '#1D6FE8' },
    { label: 'Total Work Orders', value: stats.total_wos.toLocaleString(), icon: Wrench, color: '#1DB870' },
    { label: 'Pending Registrations', value: stats.pending_registrations, icon: FileText, color: stats.pending_registrations > 0 ? '#D94F4F' : t.textSecondary },
    { label: 'Monthly Revenue', value: '$' + stats.monthly_revenue.toLocaleString(undefined, { minimumFractionDigits: 2 }), icon: DollarSign, color: '#F59E0B' },
  ]

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function fmtTime(d: string) {
    return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  const planLabel: Record<string, string> = { truckzen: 'TruckZen', truckzen_pro: 'Pro', enterprise: 'Enterprise' }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, margin: '0 0 24px' }}>Platform Overview</h1>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {statCards.map(c => {
          const Icon = c.icon
          return (
            <div key={c.label} style={{ background: t.bgCard, border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '20px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Icon size={16} color={c.color} />
                <span style={{ fontSize: 11, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'IBM Plex Mono', monospace" }}>{c.label}</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: t.text }}>{c.value}</div>
            </div>
          )
        })}
      </div>

      {/* Recent Shops Table */}
      <div style={{ background: t.bgCard, border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: t.text, margin: 0 }}>Recent Shops</h2>
          <a href="/platform-admin/shops" style={{ fontSize: 11, color: '#1D6FE8', textDecoration: 'none' }}>View All</a>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Shop Name', 'Owner', 'Plan', 'Status', 'WOs This Month', 'Joined'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'IBM Plex Mono', monospace", borderBottom: '1px solid rgba(255,255,255,.06)', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(stats.recent_shops || []).map((shop: any) => (
              <tr key={shop.id}>
                <td style={{ padding: '10px 12px', fontSize: 13, color: t.text, borderBottom: '1px solid rgba(255,255,255,.04)' }}>{shop.name}</td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: t.textSecondary, borderBottom: '1px solid rgba(255,255,255,.04)' }}>{shop.owner_name}</td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: t.textSecondary, borderBottom: '1px solid rgba(255,255,255,.04)' }}>{planLabel[shop.subscription_plan] || shop.subscription_plan}</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: shop.status === 'active' ? '#22C55E' : '#F59E0B', background: shop.status === 'active' ? 'rgba(34,197,94,.12)' : 'rgba(245,158,11,.12)', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' }}>{shop.status}</span>
                </td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: t.textSecondary, borderBottom: '1px solid rgba(255,255,255,.04)', textAlign: 'center' }}>{shop.wo_this_month}</td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: t.textTertiary, borderBottom: '1px solid rgba(255,255,255,.04)' }}>{fmtDate(shop.created_at)}</td>
              </tr>
            ))}
            {(!stats.recent_shops || stats.recent_shops.length === 0) && (
              <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: t.textTertiary, fontSize: 12 }}>No shops yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Recent Activity */}
      <div style={{ background: t.bgCard, border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: t.text, margin: 0 }}>Recent Activity</h2>
          <a href="/platform-admin/activity" style={{ fontSize: 11, color: '#1D6FE8', textDecoration: 'none' }}>View All</a>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {(stats.recent_activity || []).map((a: any) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
              <span style={{ fontSize: 9, fontWeight: 600, color: '#1D6FE8', background: 'rgba(29,111,232,.12)', padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase', fontFamily: "'IBM Plex Mono', monospace", whiteSpace: 'nowrap' }}>
                {a.action_type.replace(/_/g, ' ')}
              </span>
              <span style={{ fontSize: 12, color: t.text, flex: 1 }}>{a.description}</span>
              <span style={{ fontSize: 11, color: t.textTertiary, whiteSpace: 'nowrap' }}>{fmtTime(a.created_at)}</span>
            </div>
          ))}
          {(!stats.recent_activity || stats.recent_activity.length === 0) && (
            <div style={{ padding: 20, textAlign: 'center', color: t.textTertiary, fontSize: 12 }}>No activity yet</div>
          )}
        </div>
      </div>
    </div>
  )
}
