'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

type Tab = 'orders' | 'requests' | 'mechanic' | 'completed'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: '#7C8BA0' },
  not_approved: { label: 'Not Approved', color: '#D4882A' },
  waiting_approval: { label: 'Waiting Approval', color: '#D4882A' },
  in_progress: { label: 'In Progress', color: '#4D9EFF' },
  waiting_parts: { label: 'Waiting Parts', color: '#E8692A' },
  done: { label: 'Done', color: '#1DB870' },
  ready_final_inspection: { label: 'Ready Inspection', color: '#8B5CF6' },
  good_to_go: { label: 'Good to Go', color: '#1DB870' },
  failed_inspection: { label: 'Failed Inspection', color: '#D94F4F' },
}

export default function OrdersPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [tab, setTab] = useState<Tab>('orders')
  const [orders, setOrders] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [mechRequests, setMechRequests] = useState<any[]>([])
  const [completedOrders, setCompletedOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [teamFilter, setTeamFilter] = useState('all')

  useEffect(() => {
    getCurrentUser(supabase).then(async (p: any) => {
      if (!p) { window.location.href = '/login'; return }
      setUser(p)
      // Load all data
      const [ordersRes, reqRes, mechRes, compRes] = await Promise.all([
        fetch(`/api/service-orders?shop_id=${p.shop_id}&role=${p.role}&user_team=${p.team || ''}&limit=100`),
        fetch(`/api/service-requests?shop_id=${p.shop_id}`),
        fetch(`/api/mechanic-requests?shop_id=${p.shop_id}`),
        fetch(`/api/service-orders?shop_id=${p.shop_id}&status=good_to_go&limit=50`),
      ])
      if (ordersRes.ok) setOrders(await ordersRes.json())
      if (reqRes.ok) { const d = await reqRes.json(); setRequests(Array.isArray(d) ? d : []) }
      if (mechRes.ok) { const d = await mechRes.json(); setMechRequests(Array.isArray(d) ? d : []) }
      if (compRes.ok) { const d = await compRes.json(); setCompletedOrders(Array.isArray(d) ? d : []) }
      setLoading(false)
      // Check URL param for tab
      if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === 'requests') setTab('requests')
    })
  }, [])

  const filtered = orders.filter(so => {
    if (statusFilter !== 'all' && so.status !== statusFilter) return false
    if (teamFilter !== 'all' && so.team !== teamFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!(so.so_number?.toLowerCase().includes(q) || (so.assets as any)?.unit_number?.toLowerCase().includes(q) || (so.customers as any)?.company_name?.toLowerCase().includes(q) || so.complaint?.toLowerCase().includes(q))) return false
    }
    return true
  })

  const newRequests = requests.filter(r => r.status === 'new')
  const pendingMech = mechRequests.filter(r => r.status === 'pending')

  async function convertRequest(id: string) {
    const res = await fetch('/api/service-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'convert', request_id: id, user_id: user?.id }) })
    const d = await res.json()
    if (d.so_id) window.location.href = '/orders/' + d.so_id
  }

  async function rejectRequest(id: string) {
    await fetch('/api/service-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reject', request_id: id, reason: 'Rejected by service writer' }) })
    setRequests(prev => prev.filter(r => r.id !== id))
  }

  async function respondMechRequest(id: string, status: string, note?: string) {
    await fetch('/api/mechanic-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'respond', request_id: id, status, response_note: note, responded_by: user?.id }) })
    setMechRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  if (loading) return <div style={{ minHeight: '100vh', background: '#060708', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C8BA0' }}>Loading...</div>

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={S.title}>Service Orders</div>
          <div style={{ fontSize: 12, color: '#7C8BA0' }}>{filtered.length} orders · {newRequests.length} requests · {pendingMech.length} mechanic actions</div>
        </div>
        <button style={S.btn} onClick={() => window.location.href = '/orders/new'}>+ New Service Order</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { key: 'orders' as Tab, label: `All Orders (${orders.length})`, color: '#4D9EFF' },
          { key: 'requests' as Tab, label: `Service Requests`, badge: newRequests.length, color: '#F59E0B' },
          { key: 'mechanic' as Tab, label: `Mechanic Actions`, badge: pendingMech.length, color: '#8B5CF6' },
          { key: 'completed' as Tab, label: `Completed (${completedOrders.length})`, color: '#1DB870' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            background: tab === t.key ? `${t.color}15` : '#0D0F12',
            color: tab === t.key ? t.color : '#48536A',
            borderBottom: tab === t.key ? `2px solid ${t.color}` : '2px solid transparent',
            position: 'relative',
          }}>
            {t.label}
            {t.badge && t.badge > 0 ? <span style={{ background: t.color, color: '#000', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10, marginLeft: 6 }}>{t.badge}</span> : null}
          </button>
        ))}
      </div>

      {/* TAB 1: ALL ORDERS */}
      {tab === 'orders' && <>
        <div style={S.tbar}>
          <input style={S.search} placeholder="SO #, truck, customer..." value={search} onChange={e => setSearch(e.target.value)} />
          {['all', 'in_progress', 'waiting_parts', 'draft', 'good_to_go'].map(s => (
            <button key={s} style={{ ...S.chip, ...(statusFilter === s ? S.chipOn : {}) }} onClick={() => setStatusFilter(s)}>
              {s === 'all' ? 'All' : STATUS_MAP[s]?.label || s}
            </button>
          ))}
          <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,.08)' }} />
          {['all', 'A', 'B', 'C', 'D'].map(t => (
            <button key={t} style={{ ...S.chip, ...(teamFilter === t ? S.chipOn : {}) }} onClick={() => setTeamFilter(t)}>
              {t === 'all' ? 'All Teams' : `Team ${t}`}
            </button>
          ))}
        </div>
        <div style={S.card}>
          {filtered.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: '#7C8BA0' }}>No orders found</div> : (
            <table style={S.table}>
              <thead><tr>{['SO #', 'Truck', 'Customer', 'Complaint', 'Tech', 'Team/Bay', 'Status', 'Priority', 'Total'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map(so => {
                  const st = STATUS_MAP[so.status] || { label: so.status, color: '#7C8BA0' }
                  return (
                    <tr key={so.id} style={{ cursor: 'pointer' }} onClick={() => window.location.href = `/orders/${so.id}`}>
                      <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 10, color: '#4D9EFF', fontWeight: 700 }}>{so.so_number}</td>
                      <td style={S.td}><span style={{ fontWeight: 700, color: '#F0F4FF' }}>#{(so.assets as any)?.unit_number}</span></td>
                      <td style={{ ...S.td, color: '#DDE3EE' }}>{(so.customers as any)?.company_name}</td>
                      <td style={{ ...S.td, color: '#7C8BA0', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{so.complaint}</td>
                      <td style={{ ...S.td, color: '#DDE3EE' }}>{(so.users as any)?.full_name || <span style={{ color: '#48536A' }}>—</span>}</td>
                      <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 10, color: '#7C8BA0' }}>{so.team ? `Team ${so.team}` : ''}{so.bay ? ` · ${so.bay}` : ''}</td>
                      <td style={S.td}><span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 8, fontWeight: 700, background: `${st.color}18`, color: st.color }}>{st.label}</span></td>
                      <td style={{ ...S.td, fontSize: 9, fontWeight: 700, color: so.priority === 'critical' ? '#D94F4F' : so.priority === 'high' ? '#D4882A' : '#7C8BA0' }}>{so.priority?.toUpperCase()}</td>
                      <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 10 }}>{so.grand_total ? `$${so.grand_total.toFixed(0)}` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </>}

      {/* TAB 2: SERVICE REQUESTS */}
      {tab === 'requests' && (
        <div style={S.card}>
          {requests.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: '#7C8BA0' }}>No service requests</div> : (
            <table style={S.table}>
              <thead><tr>{['Source', 'Customer', 'Unit', 'Description', 'Created', 'Status', 'Actions'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {requests.map(r => (
                  <tr key={r.id}>
                    <td style={{ ...S.td, fontSize: 9, textTransform: 'uppercase', color: '#7C8BA0' }}>{r.source?.replace(/_/g, ' ')}</td>
                    <td style={{ ...S.td, fontWeight: 700, color: '#F0F4FF' }}>{r.company_name || '—'}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace', color: '#4D9EFF' }}>#{r.unit_number || '—'}</td>
                    <td style={{ ...S.td, color: '#DDE3EE', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</td>
                    <td style={{ ...S.td, fontSize: 10, fontFamily: 'monospace', color: '#7C8BA0' }}>{new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                    <td style={S.td}><span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: r.status === 'new' ? '#F59E0B' : r.status === 'converted' ? '#1DB870' : r.status === 'rejected' ? '#D94F4F' : '#7C8BA0' }}>{r.status}</span></td>
                    <td style={S.td}>
                      {r.status === 'new' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => convertRequest(r.id)} style={{ ...S.smallBtn, background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', color: '#fff' }}>Convert to SO</button>
                          <button onClick={() => rejectRequest(r.id)} style={{ ...S.smallBtn, border: '1px solid rgba(239,68,68,.3)', color: '#EF4444' }}>Reject</button>
                        </div>
                      )}
                      {r.status === 'converted' && r.converted_so_id && <a href={`/orders/${r.converted_so_id}`} style={{ fontSize: 10, color: '#4D9EFF', textDecoration: 'none' }}>View SO →</a>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB 3: MECHANIC ACTION REQUESTS */}
      {tab === 'mechanic' && (
        <div style={S.card}>
          {mechRequests.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: '#7C8BA0' }}>No mechanic action requests</div> : (
            <table style={S.table}>
              <thead><tr>{['SO #', 'Mechanic', 'Type', 'Description', 'Created', 'Status', 'Actions'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {mechRequests.map(r => (
                  <tr key={r.id}>
                    <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 10, color: '#4D9EFF' }}>{(r.service_orders as any)?.so_number || '—'}</td>
                    <td style={{ ...S.td, color: '#F0F4FF' }}>{(r.users as any)?.full_name || '—'}</td>
                    <td style={{ ...S.td, fontSize: 10, textTransform: 'uppercase', color: r.request_type === 'need_parts' ? '#E8692A' : r.request_type === 'labor_extension' ? '#D4882A' : '#8B5CF6' }}>{r.request_type?.replace(/_/g, ' ')}</td>
                    <td style={{ ...S.td, color: '#DDE3EE', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</td>
                    <td style={{ ...S.td, fontSize: 10, fontFamily: 'monospace', color: '#7C8BA0' }}>{new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                    <td style={S.td}><span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: r.status === 'pending' ? '#F59E0B' : r.status === 'approved' ? '#1DB870' : '#D94F4F' }}>{r.status}</span></td>
                    <td style={S.td}>
                      {r.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => respondMechRequest(r.id, 'approved', 'Approved')} style={{ ...S.smallBtn, background: '#1DB870', color: '#000' }}>Approve</button>
                          <button onClick={() => respondMechRequest(r.id, 'denied', 'Denied')} style={{ ...S.smallBtn, border: '1px solid rgba(239,68,68,.3)', color: '#EF4444' }}>Deny</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB 4: COMPLETED */}
      {tab === 'completed' && (
        <div style={S.card}>
          {completedOrders.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: '#7C8BA0' }}>No completed orders</div> : (
            <table style={S.table}>
              <thead><tr>{['SO #', 'Truck', 'Customer', 'Complaint', 'Total', 'Completed'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {completedOrders.map(so => (
                  <tr key={so.id} style={{ cursor: 'pointer' }} onClick={() => window.location.href = `/orders/${so.id}`}>
                    <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 10, color: '#4D9EFF', fontWeight: 700 }}>{so.so_number}</td>
                    <td style={{ ...S.td, fontWeight: 700, color: '#F0F4FF' }}>#{(so.assets as any)?.unit_number}</td>
                    <td style={{ ...S.td, color: '#DDE3EE' }}>{(so.customers as any)?.company_name}</td>
                    <td style={{ ...S.td, color: '#7C8BA0', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{so.complaint}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace' }}>{so.grand_total ? `$${so.grand_total.toFixed(0)}` : '—'}</td>
                    <td style={{ ...S.td, fontSize: 10, color: '#7C8BA0' }}>{so.completed_at ? new Date(so.completed_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: { background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: "'Instrument Sans',sans-serif", padding: 24 },
  title: { fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF' },
  card: { background: '#161B24', border: '1px solid rgba(255,255,255,.055)', borderRadius: 12, overflow: 'hidden' },
  tbar: { display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 14, alignItems: 'center' },
  search: { padding: '7px 12px', borderRadius: 8, background: '#1C2130', border: '1px solid rgba(255,255,255,.08)', color: '#DDE3EE', fontSize: 11, outline: 'none', fontFamily: 'inherit', width: 200 },
  chip: { padding: '5px 12px', borderRadius: 100, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(255,255,255,.08)', background: '#1C2130', color: '#7C8BA0' },
  chipOn: { background: 'rgba(29,111,232,.10)', color: '#4D9EFF', border: '1px solid rgba(29,111,232,.3)' },
  btn: { padding: '8px 16px', borderRadius: 8, background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  smallBtn: { padding: '4px 10px', borderRadius: 6, border: 'none', background: 'none', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  table: { width: '100%', borderCollapse: 'collapse' as const, minWidth: 640 },
  th: { fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: '#48536A', textTransform: 'uppercase' as const, letterSpacing: '.1em', padding: '7px 10px', textAlign: 'left' as const, background: '#0B0D11', whiteSpace: 'nowrap' as const },
  td: { fontSize: 11, padding: '10px', borderBottom: '1px solid rgba(255,255,255,.025)' },
}
