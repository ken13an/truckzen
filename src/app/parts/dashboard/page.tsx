/**
 * TruckZen — Original Design
 * Parts Department Dashboard — requests, low stock, warranty
 */
'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const BLUE = '#1B6EE6', GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F', MUTED = '#7C8BA0'

export default function PartsDashboard() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [pendingParts, setPendingParts] = useState<any[]>([])
  const [lowStock, setLowStock] = useState<any[]>([])
  const [stats, setStats] = useState({ pending: 0, onOrder: 0, lowStockCount: 0, fulfilledToday: 0 })

  const loadData = useCallback(async (profile: any) => {
    const shopId = profile.shop_id
    const today = new Date().toISOString().split('T')[0]

    const [partsReqRes, soLinesRes, lowRes, fulfilledRes, orderedRes] = await Promise.all([
      fetch('/api/parts-requests?status=active'),
      fetch(`/api/so-lines?line_type=part&parts_status=rough,sourced,ordered&limit=30`),
      fetch(`/api/parts?shop_id=${shopId}&per_page=20&low_stock=true`),
      fetch(`/api/so-lines?line_type=part&parts_status=received&updated_since=${today}&limit=500`),
      fetch(`/api/so-lines?line_type=part&parts_status=ordered&limit=500`),
    ])

    const partsReqJson = partsReqRes.ok ? await partsReqRes.json() : []
    const soLinesJson  = soLinesRes.ok  ? await soLinesRes.json()  : []
    const lowJson      = lowRes.ok      ? await lowRes.json()       : { data: [] }
    const fulfilledArr = fulfilledRes.ok ? await fulfilledRes.json() : []
    const orderedArr   = orderedRes.ok   ? await orderedRes.json()   : []

    const requests  = Array.isArray(partsReqJson) ? partsReqJson : []
    const parts     = Array.isArray(soLinesJson) ? soLinesJson : []
    const low       = (lowJson.data || []) as any[]
    const fulfilled = Array.isArray(fulfilledArr) ? fulfilledArr.length : 0
    const ordered   = Array.isArray(orderedArr) ? orderedArr.length : 0

    const pendingList = requests.length > 0 ? requests : parts.filter((p: any) => p.service_orders)
    setPendingParts(pendingList)
    setLowStock(low)
    setStats({ pending: pendingList.length, onOrder: ordered, lowStockCount: low.length, fulfilledToday: fulfilled })
  }, [])

  useEffect(() => { getCurrentUser(supabase).then(async (p: any) => { if (!p) { window.location.href = '/login'; return }; setUser(p); await loadData(p); setLoading(false) }) }, [])
  useEffect(() => { if (!user) return; const iv = setInterval(() => loadData(user), 30000); return () => clearInterval(iv) }, [user])

  const timeAgo = (d: string) => { const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); return m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d` }

  if (loading) return <div style={{ background: '#060708', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED }}>Loading...</div>

  return (
    <div style={{ background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: FONT, padding: 24 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF', marginBottom: 20 }}>Parts</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Parts Requests', value: stats.pending, color: AMBER },
          { label: 'On Order', value: stats.onOrder, color: AMBER },
          { label: 'Low Stock Alerts', value: stats.lowStockCount, color: RED },
          { label: 'Fulfilled Today', value: stats.fulfilledToday, color: GREEN },
        ].map(s => (
          <div key={s.label} style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 10, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: MONO, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Pending Parts Requests */}
      <div style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#F0F4FF', marginBottom: 12 }}>Pending Parts Requests ({pendingParts.length})</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead><tr>{['Time', 'WO #', 'Truck', 'Part Requested', 'Status'].map(h => <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 9, color: '#48536A', textTransform: 'uppercase', fontFamily: MONO, borderBottom: '1px solid rgba(255,255,255,.06)' }}>{h}</th>)}</tr></thead>
          <tbody>
            {pendingParts.map(p => {
              const so = p.service_orders as any
              const waitHrs = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 3600000)
              return (
                <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,.03)', borderLeft: waitHrs > 2 ? `3px solid ${AMBER}` : 'none', cursor: 'pointer' }} onClick={() => so?.id && (window.location.href = `/work-orders/${so.id}`)}>
                  <td style={{ padding: '8px', color: waitHrs > 2 ? AMBER : '#48536A', fontFamily: MONO, fontSize: 10 }}>{timeAgo(p.created_at)}</td>
                  <td style={{ padding: '8px', fontFamily: MONO, color: BLUE, fontWeight: 700 }}>{so?.so_number || '—'}</td>
                  <td style={{ padding: '8px', color: MUTED }}>#{so?.assets?.unit_number || '—'}</td>
                  <td style={{ padding: '8px', color: '#F0F4FF', fontWeight: 600 }}>{p.rough_name || p.description}</td>
                  <td style={{ padding: '8px' }}><span style={{ fontSize: 9, fontWeight: 600, color: p.parts_status === 'rough' ? MUTED : p.parts_status === 'ordered' ? AMBER : BLUE, background: `${p.parts_status === 'rough' ? MUTED : p.parts_status === 'ordered' ? AMBER : BLUE}18`, padding: '2px 6px', borderRadius: 4 }}>{p.parts_status}</span></td>
                </tr>
              )
            })}
            {pendingParts.length === 0 && <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#48536A' }}>No parts requests — all caught up</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Low Stock — hidden if none */}
      {lowStock.length > 0 && <div style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#F0F4FF', marginBottom: 12 }}>Low Stock Alerts ({lowStock.length})</div>
        {lowStock.slice(0, 10).map(p => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
            <div>
              <div style={{ fontSize: 12, color: '#F0F4FF' }}>{p.description}</div>
              {p.part_number && <div style={{ fontSize: 10, color: '#48536A', fontFamily: MONO }}>{p.part_number}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: p.on_hand === 0 ? RED : AMBER }}>{p.on_hand}</span>
              <span style={{ fontSize: 10, color: '#48536A' }}> / {p.reorder_point || 2}</span>
            </div>
          </div>
        ))}
      </div>}
    </div>
  )
}
