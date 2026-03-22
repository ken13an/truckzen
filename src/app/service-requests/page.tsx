/**
 * TruckZen — Original Design
 * Built from scratch by TruckZen development team
 * All business logic and UI design is proprietary to TruckZen
 */
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  new:       { bg: 'rgba(29,111,232,.12)', color: '#4D9EFF', label: 'New' },
  scheduled: { bg: 'rgba(255,214,10,.12)', color: '#FFD60A', label: 'Scheduled' },
  converted: { bg: 'rgba(29,209,88,.12)',  color: '#30D158', label: 'Converted' },
  rejected:  { bg: 'rgba(217,79,79,.12)',  color: '#D94F4F', label: 'Rejected' },
}

const SOURCE_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  kiosk:        { bg: 'rgba(29,111,232,.12)', color: '#4D9EFF', label: 'KIOSK' },
  fleet:        { bg: 'rgba(14,159,142,.12)', color: '#0E9F8E', label: 'FLEET' },
  maintenance:  { bg: 'rgba(245,158,11,.12)', color: '#F59E0B', label: 'MAINTENANCE' },
  manual:       { bg: 'rgba(124,139,160,.08)', color: '#7C8BA0', label: 'MANUAL' },
  service_writer: { bg: 'rgba(124,139,160,.08)', color: '#7C8BA0', label: 'MANUAL' },
  samsara:      { bg: 'rgba(139,92,246,.12)', color: '#8B5CF6', label: 'SAMSARA' },
  motive:       { bg: 'rgba(139,92,246,.12)', color: '#8B5CF6', label: 'MOTIVE' },
  fullbay:      { bg: 'rgba(124,139,160,.08)', color: '#7C8BA0', label: 'FULLBAY' },
}

export default function ServiceRequestsPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [toast, setToast] = useState('')

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    getCurrentUser(supabase).then(async (p) => {
      if (!p) { window.location.href = '/login'; return }
      setUser(p)
      await loadRequests(p.shop_id, filter)
    })
  }, [filter])

  async function loadRequests(shopId: string, f: string) {
    setLoading(true)
    const params = new URLSearchParams({ shop_id: shopId })
    if (f !== 'all') params.set('status', f)
    const res = await fetch(`/api/service-requests?${params}`)
    if (res.ok) setRequests(await res.json())
    setLoading(false)
  }

  async function convertToWO(r: any) {
    if (!user) return
    const res = await fetch('/api/service-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'convert', request_id: r.id, shop_id: user.shop_id, user_id: user.id }),
    })
    if (res.ok) {
      const data = await res.json()
      window.location.href = `/work-orders/${data.so_id || data.id}`
    } else {
      const err = await res.json()
      flash(err.error || 'Failed to convert')
    }
  }

  async function rejectRequest() {
    if (!user || !rejectId || !rejectReason.trim()) return
    const res = await fetch('/api/service-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', request_id: rejectId, reject_reason: rejectReason.trim(), shop_id: user.shop_id }),
    })
    if (res.ok) {
      flash('Request rejected')
      setRejectId(null); setRejectReason('')
      await loadRequests(user.shop_id, filter)
    } else flash('Failed to reject')
  }

  return (
    <div style={{ padding: 24, fontFamily: "'Instrument Sans', sans-serif" }}>
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: '#1D6FE8', color: '#fff', padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>{toast}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#F0F4FF' }}>Service Requests</div>
          <div style={{ fontSize: 12, color: '#7C8BA0', marginTop: 2 }}>{requests.length} request{requests.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/work-orders" style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, color: '#7C8BA0', fontSize: 12, textDecoration: 'none', fontFamily: 'inherit' }}>Work Orders</a>
          <a href="/service-requests/new" style={{ padding: '8px 16px', background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none', fontFamily: 'inherit' }}>+ New Request</a>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['all', 'All'], ['new', 'New'], ['scheduled', 'Scheduled'], ['converted', 'Converted'], ['rejected', 'Rejected']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{
            padding: '5px 12px', borderRadius: 100, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            border: filter === v ? '1px solid rgba(29,111,232,.3)' : '1px solid rgba(255,255,255,.08)',
            background: filter === v ? 'rgba(29,111,232,.1)' : 'transparent',
            color: filter === v ? '#4D9EFF' : '#7C8BA0',
          }}>{l}</button>
        ))}
      </div>

      <div style={{ background: '#161B24', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#7C8BA0', padding: 48, fontSize: 13 }}>Loading...</div>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#7C8BA0', padding: 48, fontSize: 13 }}>No service requests</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
              <thead><tr>
                {['Source', 'Customer', 'Unit', 'Concern', 'Requested By', 'Status', 'Date', 'Actions'].map(h =>
                  <th key={h} style={{ fontSize: 10, fontWeight: 700, color: '#7C8BA0', textTransform: 'uppercase', letterSpacing: '.06em', padding: '8px 10px', textAlign: 'left', fontFamily: "'IBM Plex Mono', monospace", background: '#12131a' }}>{h}</th>
                )}
              </tr></thead>
              <tbody>
                {requests.map(r => {
                  const st = STATUS_BADGE[r.status] || STATUS_BADGE.new
                  const src = SOURCE_BADGE[r.source || r.check_in_type || 'manual'] || SOURCE_BADGE.manual
                  return (
                    <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,.04)' }}>
                      <td style={{ padding: '10px 10px' }}>
                        <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: src.bg, color: src.color, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '.04em' }}>{src.label}</span>
                      </td>
                      <td style={{ padding: '10px 10px', fontSize: 12 }}>
                        <span style={{ fontWeight: 600, color: '#F0F4FF' }}>{r.company_name || 'Walk-in'}</span>
                        {r.contact_name && <div style={{ fontSize: 10, color: '#7C8BA0' }}>{r.contact_name}</div>}
                      </td>
                      <td style={{ padding: '10px 10px', fontFamily: 'monospace', fontSize: 11, color: '#7C8BA0' }}>{r.unit_number || '—'}</td>
                      <td style={{ padding: '10px 10px', fontSize: 12, color: '#DDE3EE', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description || '—'}</td>
                      <td style={{ padding: '10px 10px', fontSize: 11, color: '#7C8BA0' }}>
                        {r.requested_by_name || r.created_by || '—'}
                        {r.requested_by_role && <div style={{ fontSize: 9, color: '#48536A' }}>{r.requested_by_role}</div>}
                      </td>
                      <td style={{ padding: '10px 10px' }}>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: st.bg, color: st.color, fontFamily: 'monospace' }}>{st.label}</span>
                      </td>
                      <td style={{ padding: '10px 10px', fontSize: 10, color: '#48536A', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '10px 10px' }}>
                        {r.status === 'new' && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => convertToWO(r)} style={{ padding: '4px 10px', background: 'rgba(29,111,232,.12)', color: '#4D9EFF', border: 'none', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Convert to WO</button>
                            <a href={`/service-requests/new?edit=${r.id}`} style={{ padding: '4px 10px', background: 'rgba(255,255,255,.06)', color: '#7C8BA0', borderRadius: 4, fontSize: 10, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>Edit</a>
                            <button onClick={() => { setRejectId(r.id); setRejectReason('') }} style={{ padding: '4px 10px', background: 'rgba(217,79,79,.08)', color: '#D94F4F', border: 'none', borderRadius: 4, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}>Reject</button>
                          </div>
                        )}
                        {r.status === 'converted' && r.converted_so_id && (
                          <a href={`/work-orders/${r.converted_so_id}`} style={{ fontSize: 10, color: '#4D9EFF', textDecoration: 'none' }}>View WO</a>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject modal */}
      {rejectId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setRejectId(null)}>
          <div style={{ background: '#12131a', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: 28, width: 400 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#F0F4FF', marginBottom: 12 }}>Reject Request</div>
            <p style={{ fontSize: 12, color: '#7C8BA0', margin: '0 0 12px' }}>Provide a reason — the requester will be notified.</p>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason for rejection..." rows={3} autoFocus style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 13, color: '#DDE3EE', outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={rejectRequest} disabled={!rejectReason.trim()} style={{ flex: 1, padding: 10, background: rejectReason.trim() ? '#D94F4F' : 'rgba(255,255,255,.06)', color: rejectReason.trim() ? '#fff' : '#48536A', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: rejectReason.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>Reject</button>
              <button onClick={() => setRejectId(null)} style={{ padding: '10px 20px', background: 'rgba(255,255,255,.06)', color: '#7C8BA0', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
