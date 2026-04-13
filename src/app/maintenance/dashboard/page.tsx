/**
 * TruckZen — Original Design
 * Maintenance Dashboard — fleet trucks in shop, requests, warranty
 */
'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { getWorkorderRoute } from '@/lib/navigation/workorder-route'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const BLUE = '#1B6EE6', GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F', MUTED = '#7C8BA0'

export default function MaintenanceDashboard() {
  const { tokens: t } = useTheme()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [fleetInShop, setFleetInShop] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [warrantyPending, setWarrantyPending] = useState<any[]>([])
  const [stats, setStats] = useState({ inShop: 0, newRequests: 0, warrantyChecks: 0, completedWeek: 0 })

  const loadData = useCallback(async (profile: any) => {
    const shopId = profile.shop_id
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()

    const [fleetRes, reqsRes, { data: warranty }, { count: completed }] = await Promise.all([
      fetch(`/api/service-orders?shop_id=${shopId}&exclude_status=good_to_go,void,done&exclude_historical=true&limit=30`).then(r => r.ok ? r.json() : []),
      fetch(`/api/service-requests?shop_id=${shopId}`).then(r => r.ok ? r.json() : []),
      supabase.from('service_orders').select('id, so_number, complaint, warranty_status, assets(unit_number, make, model, warranty_provider)').eq('shop_id', shopId).is('deleted_at', null).eq('warranty_status', 'checking').order('created_at', { ascending: false }),
      supabase.from('service_orders').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).is('deleted_at', null).in('status', ['done', 'good_to_go']).gte('completed_at', weekAgo),
    ])

    const fleet: any[] = Array.isArray(fleetRes) ? fleetRes : []
    const reqs: any[] = (Array.isArray(reqsRes) ? reqsRes : []).filter((r: any) => ['new', 'scheduled'].includes(r.status)).slice(0, 20)
    const fleetWos = fleet.filter((w: any) => (w.customers as any)?.is_fleet)
    setFleetInShop(fleetWos)
    setRequests(reqs)
    setWarrantyPending(warranty || [])
    setStats({ inShop: fleetWos.length, newRequests: reqs.length, warrantyChecks: (warranty || []).length, completedWeek: completed || 0 })
  }, [supabase])

  useEffect(() => { getCurrentUser(supabase).then(async (p: any) => { if (!p) { window.location.href = '/login'; return }; setUser(p); await loadData(p); setLoading(false) }) }, [])
  useEffect(() => { if (!user) return; const iv = setInterval(() => loadData(user), 30000); return () => clearInterval(iv) }, [user])

  const statusColor: Record<string, string> = { in_progress: BLUE, waiting_parts: AMBER, draft: MUTED }

  if (loading) return <div style={{ background: t.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED }}>Loading...</div>

  return (
    <div style={{ background: t.bg, minHeight: '100vh', color: t.text, fontFamily: FONT, padding: 24 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: t.text, marginBottom: 20 }}>Maintenance</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Fleet In Shop', value: stats.inShop, color: BLUE },
          { label: 'New Requests', value: stats.newRequests, color: AMBER },
          { label: 'Warranty Checks', value: stats.warrantyChecks, color: RED },
          { label: 'Completed This Week', value: stats.completedWeek, color: GREEN },
        ].map(s => (
          <div key={s.label} style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 10, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: MONO, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Fleet In Shop */}
      <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 12 }}>Fleet Trucks In Shop</div>
        {fleetInShop.length === 0 ? <div style={{ padding: 20, textAlign: 'center', color: t.textTertiary, fontSize: 12 }}>No fleet trucks currently in shop</div> : fleetInShop.map(wo => (
          <div key={wo.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${t.border}`, cursor: 'pointer' }} onClick={() => window.location.href = getWorkorderRoute(wo.id, undefined, 'maintenance')}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: t.text }}>#{(wo.assets as any)?.unit_number || '—'}</span>
                <span style={{ fontSize: 12, color: MUTED }}>{[(wo.assets as any)?.make, (wo.assets as any)?.model].filter(Boolean).join(' ')}</span>
                <span style={{ fontSize: 9, fontWeight: 600, color: statusColor[wo.status] || MUTED, background: `${statusColor[wo.status] || MUTED}18`, padding: '2px 6px', borderRadius: 4 }}>{wo.status?.replace(/_/g, ' ')}</span>
              </div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{wo.complaint?.slice(0, 60) || '—'}</div>
            </div>
            <div style={{ fontSize: 11, color: MUTED }}>{(wo.users as any)?.full_name || 'Unassigned'}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Requests */}
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 12 }}>Maintenance Requests</div>
          {requests.length === 0 ? <div style={{ padding: 16, textAlign: 'center', color: t.textTertiary, fontSize: 12 }}>No pending requests</div> : requests.slice(0, 6).map(r => (
            <div key={r.id} style={{ padding: '8px 0', borderBottom: `1px solid ${t.border}`, cursor: 'pointer' }} onClick={() => window.location.href = '/service-requests'}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{r.company_name} {r.unit_number ? `· #${r.unit_number}` : ''}</div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{r.description?.slice(0, 50)}</div>
            </div>
          ))}
        </div>

        {/* Warranty — hidden if none */}
        {warrantyPending.length > 0 && <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 12 }}>Warranty Checks Pending ({warrantyPending.length})</div>
          {warrantyPending.map(wo => (
            <div key={wo.id} style={{ padding: '8px 0', borderBottom: `1px solid ${t.border}`, cursor: 'pointer' }} onClick={() => window.location.href = getWorkorderRoute(wo.id, undefined, 'maintenance')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: BLUE }}>{wo.so_number}</span>
                <span style={{ fontSize: 11, color: t.text }}>#{(wo.assets as any)?.unit_number}</span>
              </div>
              <div style={{ fontSize: 11, color: AMBER, marginTop: 2 }}>{(wo.assets as any)?.warranty_provider || 'Check needed'}</div>
            </div>
          ))}
        </div>}
      </div>
    </div>
  )
}
