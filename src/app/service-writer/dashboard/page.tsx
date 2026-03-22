/**
 * TruckZen — Original Design
 * Service Writer Dashboard — live data, auto-refresh, clickable WOs
 */
'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const BLUE = '#1B6EE6', GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F', MUTED = '#7C8BA0'

export default function ServiceWriterDashboard() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<any[]>([])
  const [myWos, setMyWos] = useState<any[]>([])
  const [pendingEstimates, setPendingEstimates] = useState<any[]>([])
  const [stats, setStats] = useState({ requests: 0, openWos: 0, pendingApprovals: 0, completedToday: 0 })

  const loadData = useCallback(async (profile: any) => {
    const shopId = profile.shop_id
    const today = new Date().toISOString().split('T')[0]

    const [{ data: reqs }, { data: wos }, { data: ests }, { count: completed }] = await Promise.all([
      supabase.from('service_requests').select('id, company_name, unit_number, description, source, created_at, status').eq('shop_id', shopId).in('status', ['new', 'scheduled']).order('created_at', { ascending: false }).limit(20),
      supabase.from('service_orders').select('id, so_number, status, complaint, created_at, updated_at, assets(unit_number, make, model), customers(company_name), users!assigned_tech(full_name)').eq('shop_id', shopId).or('is_historical.is.null,is_historical.eq.false').not('status', 'in', '("good_to_go","void","done")').order('created_at', { ascending: false }).limit(30),
      supabase.from('estimates').select('id, estimate_number, grand_total, sent_at, wo_id, customer_name, service_orders(so_number)').eq('shop_id', shopId).eq('status', 'sent').order('sent_at', { ascending: true }),
      supabase.from('service_orders').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).in('status', ['done', 'good_to_go']).gte('completed_at', today),
    ])

    setRequests(reqs || [])
    setMyWos(wos || [])
    setPendingEstimates(ests || [])
    setStats({ requests: (reqs || []).length, openWos: (wos || []).length, pendingApprovals: (ests || []).length, completedToday: completed || 0 })
  }, [supabase])

  useEffect(() => {
    getCurrentUser(supabase).then(async (p: any) => {
      if (!p) { window.location.href = '/login'; return }
      setUser(p); await loadData(p); setLoading(false)
    })
  }, [])

  useEffect(() => { if (!user) return; const iv = setInterval(() => loadData(user), 30000); return () => clearInterval(iv) }, [user])

  const timeAgo = (d: string) => { const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); return m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d` }
  const statusColor: Record<string, string> = { draft: MUTED, in_progress: BLUE, waiting_parts: AMBER, done: GREEN }

  if (loading) return <div style={{ background: '#060708', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED }}>Loading...</div>

  return (
    <div style={{ background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: FONT, padding: 24 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF', marginBottom: 20 }}>Service Writer</div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Service Requests', value: stats.requests, color: AMBER },
          { label: 'Open WOs', value: stats.openWos, color: BLUE },
          { label: 'Pending Approvals', value: stats.pendingApprovals, color: RED },
          { label: 'Completed Today', value: stats.completedToday, color: GREEN },
        ].map(s => (
          <div key={s.label} style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 10, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: MONO, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Service Requests */}
        <div style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#F0F4FF', marginBottom: 12 }}>Service Requests</div>
          {requests.length === 0 ? <div style={{ color: '#48536A', fontSize: 12, padding: 20, textAlign: 'center' }}>No pending requests</div> : requests.slice(0, 8).map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.04)', cursor: 'pointer' }} onClick={() => window.location.href = `/service-requests`}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#F0F4FF' }}>{r.company_name || 'Walk-in'} {r.unit_number ? `· #${r.unit_number}` : ''}</div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{r.description?.slice(0, 50) || '—'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: BLUE, background: `${BLUE}18`, padding: '2px 6px', borderRadius: 4 }}>{r.source || 'manual'}</span>
                <div style={{ fontSize: 10, color: '#48536A', marginTop: 2 }}>{timeAgo(r.created_at)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* My Open WOs */}
        <div style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#F0F4FF', marginBottom: 12 }}>Open Work Orders</div>
          {myWos.length === 0 ? <div style={{ color: '#48536A', fontSize: 12, padding: 20, textAlign: 'center' }}>No open WOs</div> : myWos.slice(0, 8).map(wo => (
            <div key={wo.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.04)', cursor: 'pointer' }} onClick={() => window.location.href = `/work-orders/${wo.id}`}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: BLUE }}>{wo.so_number}</span>
                  <span style={{ fontSize: 9, fontWeight: 600, color: statusColor[wo.status] || MUTED, background: `${statusColor[wo.status] || MUTED}18`, padding: '1px 6px', borderRadius: 4 }}>{wo.status?.replace(/_/g, ' ')}</span>
                </div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>#{(wo.assets as any)?.unit_number || '—'} · {(wo.customers as any)?.company_name || '—'}</div>
              </div>
              <div style={{ fontSize: 11, color: '#48536A' }}>{(wo.users as any)?.full_name || 'Unassigned'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Estimates */}
      {pendingEstimates.length > 0 && (
        <div style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 16, marginTop: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#F0F4FF', marginBottom: 12 }}>Pending Estimate Approvals</div>
          {pendingEstimates.map(est => (
            <div key={est.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.04)', cursor: 'pointer' }} onClick={() => est.wo_id && (window.location.href = `/work-orders/${est.wo_id}`)}>
              <div style={{ fontSize: 12, color: '#F0F4FF' }}>{est.customer_name || '—'} · {est.estimate_number}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: AMBER }}>${(est.grand_total || 0).toFixed(0)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
