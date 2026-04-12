/**
 * TruckZen — Original Design
 * Service Writer Dashboard — live data, auto-refresh, clickable WOs
 */
'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { useTheme } from '@/hooks/useTheme'
import { LayoutGrid, List } from 'lucide-react'
import { getWorkorderRoute } from '@/lib/navigation/workorder-route'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"

export default function ServiceWriterDashboard() {
  const { tokens: t } = useTheme()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<any[]>([])
  const [myWos, setMyWos] = useState<any[]>([])
  const [pendingEstimates, setPendingEstimates] = useState<any[]>([])
  const [stats, setStats] = useState({ requests: 0, openWos: 0, pendingApprovals: 0, completedToday: 0 })
  const [hoursRequests, setHoursRequests] = useState<any[]>([])
  const [metricView, setMetricView] = useState<'grid' | 'compact'>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('tz-metric-view') as 'grid' | 'compact') || 'grid'
    return 'grid'
  })

  const loadData = useCallback(async (profile: any) => {
    const shopId = profile.shop_id
    const today = new Date().toISOString().split('T')[0]

    const [reqsRes, wosRes, estsRes, notifsRes] = await Promise.all([
      fetch(`/api/service-requests?shop_id=${shopId}`).then(r => r.json()),
      fetch(`/api/service-orders?shop_id=${shopId}&limit=100`).then(r => r.json()),
      fetch(`/api/estimates?shop_id=${shopId}&status=sent`).then(r => r.json()),
      fetch('/api/notifications?type=hours_request_more,hours_request_needed&unread=true&limit=100').then(r => r.ok ? r.json() : { notifications: [] }),
    ])

    const allReqs: any[] = Array.isArray(reqsRes) ? reqsRes : []
    const allWos: any[] = Array.isArray(wosRes) ? wosRes : []
    const allEsts: any[] = Array.isArray(estsRes) ? estsRes : (estsRes?.data || [])

    const reqs = allReqs.filter(r => r.status === 'new' || r.status === 'scheduled').slice(0, 20)
    const excludedStatuses = new Set(['good_to_go', 'void', 'done'])
    const wos = allWos.filter(wo => !excludedStatuses.has(wo.status) && !wo.is_historical).slice(0, 30)
    const completedToday = allWos.filter(wo => (wo.status === 'done' || wo.status === 'good_to_go') && wo.completed_at && wo.completed_at.startsWith(today)).length

    const hrsReqs = notifsRes.notifications || []

    setRequests(reqs)
    setMyWos(wos)
    setPendingEstimates(allEsts)
    setHoursRequests(hrsReqs)
    setStats({ requests: reqs.length, openWos: wos.length, pendingApprovals: allEsts.length, completedToday })
  }, [])

  useEffect(() => {
    getCurrentUser(supabase).then(async (p: any) => {
      if (!p) { window.location.href = '/login'; return }
      setUser(p); await loadData(p); setLoading(false)
    })
  }, [])

  useEffect(() => { if (!user) return; const iv = setInterval(() => loadData(user), 30000); return () => clearInterval(iv) }, [user])

  const timeAgo = (d: string) => { const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); return m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d` }
  const statusColor: Record<string, string> = { draft: t.textSecondary, in_progress: t.accent, waiting_parts: t.warning, done: t.success }
  const statusBg: Record<string, string> = { draft: t.surfaceMuted, in_progress: t.accentBg, waiting_parts: t.warningBg, done: t.successBg }

  const toggleMetricView = (v: 'grid' | 'compact') => { setMetricView(v); localStorage.setItem('tz-metric-view', v) }

  if (loading) return <div style={{ background: t.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textSecondary }}>Loading...</div>

  return (
    <div style={{ background: t.bg, minHeight: '100vh', color: t.text, fontFamily: FONT, padding: '32px clamp(20px, 4vw, 40px)' }}>
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, letterSpacing: '.02em', color: t.text, lineHeight: 1 }}>Service</div>
          <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 6 }}>Live shop activity &mdash; refreshes every 30s</div>
        </div>
        <div style={{ display: 'inline-flex', gap: 2, padding: 3, borderRadius: 8, background: t.bgCard, border: `1px solid ${t.cardBorder}` }}>
          <button onClick={() => toggleMetricView('grid')} style={{ background: metricView === 'grid' ? t.accentBg : 'transparent', color: metricView === 'grid' ? t.accent : t.textTertiary, border: 'none', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><LayoutGrid size={14} /></button>
          <button onClick={() => toggleMetricView('compact')} style={{ background: metricView === 'compact' ? t.accentBg : 'transparent', color: metricView === 'compact' ? t.accent : t.textTertiary, border: 'none', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><List size={14} /></button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: metricView === 'grid' ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Service Requests', value: stats.requests, color: t.warning },
          { label: 'Open WOs', value: stats.openWos, color: t.accent },
          { label: 'Pending Approvals', value: stats.pendingApprovals, color: t.danger },
          { label: 'Completed Today', value: stats.completedToday, color: t.success },
        ].map(s => (
          <div key={s.label} style={{ background: t.bgCard, border: `1px solid ${t.cardBorder}`, borderRadius: 10, padding: '16px 18px' }}>
            <div style={{ fontSize: 10, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '.04em', fontFamily: MONO, marginBottom: 6, fontWeight: 600 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Bay Strip */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 10 }}>Shop Bays</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 8 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map(bay => {
            const wo = myWos.find((w: any) => w.bay && Number(w.bay) === bay)
            const occupied = !!wo
            return (
              <div key={bay} style={{ background: occupied ? t.accentBg : t.bgCard, border: `1px solid ${occupied ? t.borderAccent : t.cardBorder}`, borderRadius: 8, padding: '10px 8px', textAlign: 'center', cursor: occupied ? 'pointer' : 'default' }} onClick={() => { if (wo) window.location.href = getWorkorderRoute(wo.id) }}>
                <div style={{ fontSize: 8, color: t.textSecondary, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 4 }}>Bay {bay}</div>
                <div style={{ fontSize: 11, fontWeight: 600, fontFamily: MONO, color: occupied ? t.accent : t.textTertiary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {occupied ? `#${(wo.assets as any)?.unit_number || wo.so_number}` : 'Empty'}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Service Requests */}
        <div style={{ background: t.bgCard, border: `1px solid ${t.cardBorder}`, borderRadius: 10, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Service Requests</span>
            {requests.length > 0 && <span style={{ fontSize: 10, fontWeight: 600, color: t.accent, background: t.accentBg, borderRadius: 6, padding: '2px 7px' }}>{requests.length}</span>}
            <a href="/service-requests" style={{ marginLeft: 'auto', fontSize: 11, color: t.textTertiary, textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.color = t.accent)} onMouseLeave={e => (e.currentTarget.style.color = t.textTertiary)}>View all</a>
          </div>
          {requests.length === 0 ? <div style={{ color: t.textTertiary, fontSize: 12, padding: 20, textAlign: 'center' }}>No pending requests — they&apos;ll appear when customers check in</div> : requests.slice(0, 8).map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${t.border}`, cursor: 'pointer' }} onClick={() => window.location.href = `/service-requests`}
              onMouseEnter={e => (e.currentTarget.style.background = t.bgHover)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{r.company_name || 'Walk-in'} {r.unit_number ? `· #${r.unit_number}` : ''}</div>
                <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 2 }}>{r.description?.slice(0, 50) || '—'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: t.accent, background: t.accentBg, padding: '2px 6px', borderRadius: 4 }}>{r.source || 'manual'}</span>
                <div style={{ fontSize: 10, color: t.textTertiary, marginTop: 2 }}>{timeAgo(r.created_at)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* My Open WOs — table style */}
        <div style={{ background: t.bgCard, border: `1px solid ${t.cardBorder}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Open Work Orders</span>
              {myWos.length > 0 && <span style={{ fontSize: 10, fontWeight: 600, color: t.accent, background: t.accentBg, borderRadius: 6, padding: '2px 7px' }}>{myWos.length}</span>}
              <a href="/work-orders" style={{ marginLeft: 'auto', fontSize: 11, color: t.textTertiary, textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = t.accent)} onMouseLeave={e => (e.currentTarget.style.color = t.textTertiary)}>View all</a>
            </div>
          </div>
          {myWos.length === 0 ? <div style={{ color: t.textTertiary, fontSize: 12, padding: 20, textAlign: 'center' }}>No open WOs</div> : (
            <div>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr 100px', gap: 8, padding: '6px 16px', background: t.border }}>
                {['WO #', 'Customer', 'Status', 'Assigned'].map(h => (
                  <div key={h} style={{ fontSize: 9, fontWeight: 600, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</div>
                ))}
              </div>
              {/* Table rows */}
              {myWos.slice(0, 10).map(wo => (
                <div key={wo.id} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr 100px', gap: 8, padding: '8px 16px', borderTop: `1px solid ${t.border}`, cursor: 'pointer', transition: 'background .1s' }} onClick={() => window.location.href = getWorkorderRoute(wo.id)}
                  onMouseEnter={e => (e.currentTarget.style.background = t.bgHover)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: t.accent }}>{wo.so_number}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{(wo.customers as any)?.company_name || '—'}</div>
                    <div style={{ fontSize: 10, color: t.textSecondary }}>#{(wo.assets as any)?.unit_number || '—'}</div>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 600, color: statusColor[wo.status] || t.textSecondary, background: statusBg[wo.status] || t.surfaceMuted, padding: '1px 6px', borderRadius: 4, alignSelf: 'center', width: 'fit-content' }}>{wo.status?.replace(/_/g, ' ')}</span>
                  <span style={{ fontSize: 11, color: t.textTertiary }}>{(wo.users as any)?.full_name || 'Unassigned'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pending Estimates */}
      {pendingEstimates.length > 0 && (
        <div style={{ background: t.bgCard, border: `1px solid ${t.cardBorder}`, borderRadius: 10, padding: 16, marginTop: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 12 }}>Pending Estimate Approvals</div>
          {pendingEstimates.map(est => (
            <div key={est.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${t.border}`, cursor: 'pointer' }} onClick={() => est.wo_id && (window.location.href = getWorkorderRoute(est.wo_id))}
              onMouseEnter={e => (e.currentTarget.style.background = t.bgHover)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div style={{ fontSize: 12, color: t.text }}>{est.customer_name || '—'} · {est.estimate_number}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.warning }}>${(est.grand_total || 0).toFixed(0)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Mechanic Hours Requests */}
      {hoursRequests.length > 0 && (
        <div style={{ background: t.bgCard, border: `1px solid ${t.cardBorder}`, borderRadius: 10, padding: 16, marginTop: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.warning, marginBottom: 12 }}>Mechanic Hours Requests</div>
          {hoursRequests.map((r: any) => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: `1px solid ${t.border}`, cursor: r.link ? 'pointer' : 'default' }} onClick={() => { if (r.link) { fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, action: 'mark_read' }) }).catch(() => {}); window.location.href = r.link } }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{r.title}</div>
                <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 2 }}>{r.body}</div>
              </div>
              <div style={{ fontSize: 10, color: t.textTertiary, whiteSpace: 'nowrap', marginLeft: 12 }}>{r.created_at ? new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}</div>
            </div>
          ))}
        </div>
      )}

      {/* Shop Health + Recent Activity */}
      {(() => {
        const openWoScore = stats.openWos <= 5 ? 100 : stats.openWos <= 10 ? 85 : stats.openWos <= 15 ? 70 : stats.openWos <= 20 ? 55 : 40
        const approvalScore = stats.pendingApprovals === 0 ? 100 : stats.pendingApprovals <= 2 ? 80 : stats.pendingApprovals <= 5 ? 60 : 40
        const requestScore = stats.requests <= 3 ? 100 : stats.requests <= 6 ? 85 : stats.requests <= 10 ? 70 : 50
        const completionScore = stats.completedToday >= 8 ? 100 : stats.completedToday >= 5 ? 85 : stats.completedToday >= 3 ? 70 : stats.completedToday >= 1 ? 55 : 40
        const healthScore = Math.round((openWoScore + approvalScore + requestScore + completionScore) / 4)
        const healthLabel = healthScore >= 85 ? 'Strong' : healthScore >= 70 ? 'Stable' : healthScore >= 55 ? 'Busy' : 'Needs Attention'
        const scoreColor = healthScore >= 80 ? t.success : healthScore >= 55 ? t.warning : t.danger
        const labelColor = healthScore >= 85 ? t.success : healthScore >= 70 ? t.accent : healthScore >= 55 ? t.warning : t.danger
        const labelBg = healthScore >= 85 ? t.successBg : healthScore >= 70 ? t.accentBg : healthScore >= 55 ? t.warningBg : t.dangerBg

        const activityDotColor: Record<string, string> = { request: t.accent, wo: t.success, estimate: t.warning, hours: t.danger }
        const activityEntries: { type: string; time: string; title: string; meta: string; href: string | null; id: string }[] = []
        requests.forEach(r => { if (r.created_at) activityEntries.push({ type: 'request', time: r.created_at, title: 'New service request', meta: r.company_name || 'Walk-in', href: '/service-requests', id: `req-${r.id}` }) })
        myWos.forEach(wo => { const ts = wo.updated_at || wo.created_at; if (ts) activityEntries.push({ type: 'wo', time: ts, title: 'Work order updated', meta: `${wo.so_number}${(wo.customers as any)?.company_name ? ' · ' + (wo.customers as any).company_name : ''}`, href: getWorkorderRoute(wo.id), id: `wo-${wo.id}` }) })
        pendingEstimates.forEach(est => { const ts = est.updated_at || est.created_at; if (ts) activityEntries.push({ type: 'estimate', time: ts, title: 'Estimate pending approval', meta: est.estimate_number || est.customer_name || '—', href: est.wo_id ? getWorkorderRoute(est.wo_id) : null, id: `est-${est.id}` }) })
        hoursRequests.forEach((r: any) => { if (r.created_at) activityEntries.push({ type: 'hours', time: r.created_at, title: r.title || 'More time requested', meta: r.body || '', href: r.link || null, id: `hrs-${r.id}` }) })
        activityEntries.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        const recentActivity = activityEntries.slice(0, 6)

        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            {/* Shop Health */}
            <div style={{ background: t.bgCard, border: `1px solid ${t.cardBorder}`, borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 4 }}>Shop Health</div>
              <div style={{ fontSize: 10, color: t.textTertiary, marginBottom: 14 }}>Derived from current dashboard workload</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 36, fontWeight: 700, color: scoreColor }}>{healthScore}</div>
                <span style={{ fontSize: 10, fontWeight: 600, color: labelColor, background: labelBg, padding: '3px 10px', borderRadius: 6 }}>{healthLabel}</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: t.border, marginBottom: 16 }}>
                <div style={{ height: '100%', borderRadius: 3, width: `${healthScore}%`, background: `linear-gradient(90deg, ${t.success}, ${t.accent})`, transition: 'width .3s' }} />
              </div>
              {[
                { label: 'Open WOs', value: stats.openWos },
                { label: 'Pending Approvals', value: stats.pendingApprovals },
                { label: 'Incoming Requests', value: stats.requests },
                { label: 'Completed Today', value: stats.completedToday },
              ].map(m => (
                <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${t.border}` }}>
                  <span style={{ fontSize: 11, color: t.textTertiary }}>{m.label}</span>
                  <span style={{ fontSize: 11, fontFamily: MONO, color: t.text, fontWeight: 600 }}>{m.value}</span>
                </div>
              ))}
            </div>

            {/* Recent Activity */}
            <div style={{ background: t.bgCard, border: `1px solid ${t.cardBorder}`, borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 12 }}>Recent Activity</div>
              {recentActivity.length === 0 ? (
                <div style={{ color: t.textTertiary, fontSize: 12, padding: 20, textAlign: 'center' }}>No recent dashboard activity</div>
              ) : recentActivity.map(a => (
                <div key={a.id} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: `1px solid ${t.border}`, cursor: a.href ? 'pointer' : 'default' }} onClick={() => { if (a.href) window.location.href = a.href }}
                  onMouseEnter={e => { if (a.href) (e.currentTarget.style.background = t.bgHover) }} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: activityDotColor[a.type] || t.textTertiary, marginTop: 5, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: t.textSecondary }}>{a.title} — <span style={{ color: a.type === 'wo' ? t.accent : t.text, fontWeight: 600 }}>{a.meta}</span></div>
                    <div style={{ fontSize: 9, color: t.textTertiary, marginTop: 1 }}>{timeAgo(a.time)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}
      </div>
    </div>
  )
}
