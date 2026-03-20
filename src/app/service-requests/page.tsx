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

const CHECKIN_LABEL: Record<string, string> = {
  kiosk: 'Kiosk',
  qr_code: 'QR Code',
  service_writer: 'Service Writer',
  phone: 'Phone',
  fleet_request: 'Fleet Request',
}

export default function ServiceRequestsPage() {
  const supabase = createClient()
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    getCurrentUser(supabase).then(async (p) => {
      if (!p) { window.location.href = '/login'; return }
      const params = new URLSearchParams({ shop_id: p.shop_id })
      if (filter !== 'all') params.set('status', filter)
      const res = await fetch(`/api/service-requests?${params}`)
      if (res.ok) setRequests(await res.json())
      setLoading(false)
    })
  }, [filter])

  const S: Record<string, React.CSSProperties> = {
    page: { padding: 24, fontFamily: "'Instrument Sans', sans-serif" },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
    title: { fontSize: 22, fontWeight: 700, color: '#F0F4FF' },
    sub: { fontSize: 12, color: '#7C8BA0', marginTop: 2 },
    btn: { padding: '8px 16px', background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', fontFamily: 'inherit' },
    filters: { display: 'flex', gap: 6, marginBottom: 16 },
    pill: { padding: '5px 12px', borderRadius: 100, border: '1px solid rgba(255,255,255,.08)', background: 'transparent', color: '#7C8BA0', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
    pillActive: { padding: '5px 12px', borderRadius: 100, border: '1px solid rgba(29,111,232,.3)', background: 'rgba(29,111,232,.1)', color: '#4D9EFF', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
    card: { background: '#161B24', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, overflow: 'hidden' },
    th: { fontSize: 10, fontWeight: 700, color: '#7C8BA0', textTransform: 'uppercase' as const, letterSpacing: '.06em', padding: '8px 12px', textAlign: 'left' as const, fontFamily: "'IBM Plex Mono', monospace", background: '#12131a' },
    td: { padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,.04)', fontSize: 12, color: '#DDE3EE', verticalAlign: 'top' as const },
    badge: { display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, fontFamily: 'monospace' },
    empty: { textAlign: 'center' as const, color: '#7C8BA0', padding: 48, fontSize: 13 },
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <div style={S.title}>Service Requests</div>
          <div style={S.sub}>{requests.length} request{requests.length !== 1 ? 's' : ''}</div>
        </div>
        <a href="/service-requests/new" style={S.btn}>+ New Service Request</a>
      </div>

      <div style={S.filters}>
        {[['all', 'All'], ['new', 'New'], ['scheduled', 'Scheduled'], ['converted', 'Converted'], ['rejected', 'Rejected']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} style={filter === v ? S.pillActive : S.pill}>{l}</button>
        ))}
      </div>

      <div style={S.card}>
        {loading ? (
          <div style={S.empty}>Loading...</div>
        ) : requests.length === 0 ? (
          <div style={S.empty}>No service requests {filter !== 'all' ? `with status "${filter}"` : ''}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead><tr>
                {['Customer', 'Unit', 'Complaint', 'Check-in', 'Status', 'Created'].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {requests.map(r => {
                  const st = STATUS_BADGE[r.status] || STATUS_BADGE.new
                  return (
                    <tr key={r.id}>
                      <td style={{ ...S.td, fontWeight: 600, color: '#F0F4FF', whiteSpace: 'nowrap' }}>
                        {r.company_name || 'Walk-in'}
                        {r.contact_name && <div style={{ fontSize: 10, color: '#7C8BA0', fontWeight: 400 }}>{r.contact_name}</div>}
                      </td>
                      <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 11, color: '#7C8BA0' }}>{r.unit_number || '—'}</td>
                      <td style={{ ...S.td, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description || '—'}</td>
                      <td style={S.td}>
                        <span style={{ ...S.badge, background: 'rgba(255,255,255,.06)', color: '#7C8BA0' }}>
                          {CHECKIN_LABEL[r.check_in_type || r.source] || r.source}
                        </span>
                        {r.check_in_type === 'service_writer' && r.created_by && r.created_by !== 'kiosk' && r.created_by !== 'service_writer' && (
                          <div style={{ fontSize: 10, color: '#48536A', marginTop: 2 }}>by {r.created_by}</div>
                        )}
                      </td>
                      <td style={S.td}>
                        <span style={{ ...S.badge, background: st.bg, color: st.color }}>{st.label}</span>
                      </td>
                      <td style={{ ...S.td, fontSize: 10, color: '#48536A', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
