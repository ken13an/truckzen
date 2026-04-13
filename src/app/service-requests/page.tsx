/**
 * TruckZen — Original Design
 * Service Requests — intake system for Maintenance & Fleet departments
 */
'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import Pagination from '@/components/Pagination'
import FilterBar from '@/components/FilterBar'
import { getWorkorderRoute } from '@/lib/navigation/workorder-route'
import { useTheme } from '@/hooks/useTheme'

const URGENCY: Record<string, { label: string; color: string; bg: string }> = {
  low:      { label: 'LOW',      color: '#48536A', bg: 'rgba(72,83,106,.1)' },
  normal:   { label: 'NORMAL',   color: '#7C8BA0', bg: 'rgba(124,139,160,.1)' },
  high:     { label: 'HIGH',     color: '#D4882A', bg: 'rgba(212,136,42,.12)' },
  critical: { label: 'CRITICAL', color: '#D94F4F', bg: 'rgba(217,79,79,.12)' },
}

const SOURCE: Record<string, { label: string; color: string; bg: string }> = {
  kiosk:          { label: 'KIOSK',       color: '#4D9EFF', bg: 'rgba(29,111,232,.12)' },
  fleet:          { label: 'FLEET',       color: '#0E9F8E', bg: 'rgba(14,159,142,.12)' },
  maintenance:    { label: 'MAINTENANCE', color: '#F59E0B', bg: 'rgba(245,158,11,.12)' },
  manual:         { label: 'MANUAL',      color: '#7C8BA0', bg: 'rgba(124,139,160,.08)' },
  service_writer: { label: 'MANUAL',      color: '#7C8BA0', bg: 'rgba(124,139,160,.08)' },
}

export default function ServiceRequestsPage() {
  const { tokens: th } = useTheme()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'new' | 'converted' | 'rejected'>('new')
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [toast, setToast] = useState('')
  const [page, setPage] = useState(1)
  const [srSearch, setSrSearch] = useState('')
  const [srDateFrom, setSrDateFrom] = useState('')
  const [srDateTo, setSrDateTo] = useState('')

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    getCurrentUser(supabase).then(async (p) => {
      if (!p) { window.location.href = '/login'; return }
      setUser(p)
      await loadRequests(p.shop_id)
    })
  }, [])

  async function loadRequests(shopId: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/service-requests?shop_id=${shopId}`)
      const data = await res.json()
      setRequests(Array.isArray(data) ? data : [])
    } catch {
      setRequests([])
    }
    setLoading(false)
  }

  const filtered = useMemo(() => {
    let list = requests.filter(r => {
      if (tab === 'new') return r.status === 'new' || r.status === 'scheduled'
      if (tab === 'converted') return r.status === 'converted'
      if (tab === 'rejected') return r.status === 'rejected'
      return true
    })
    if (srSearch.trim()) {
      const q = srSearch.toLowerCase()
      list = list.filter(r =>
        (r.unit_number || '').toLowerCase().includes(q) ||
        (r.company_name || '').toLowerCase().includes(q) ||
        (r.contact_name || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q)
      )
    }
    if (srDateFrom) {
      const from = new Date(srDateFrom)
      list = list.filter(r => r.created_at && new Date(r.created_at) >= from)
    }
    if (srDateTo) {
      const to = new Date(srDateTo + 'T23:59:59')
      list = list.filter(r => r.created_at && new Date(r.created_at) <= to)
    }
    return list
  }, [requests, tab, srSearch, srDateFrom, srDateTo])

  const PER_PAGE = 25
  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  async function convertToWO(r: any) {
    if (!user) return
    const res = await fetch('/api/service-requests', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'convert', request_id: r.id, shop_id: user.shop_id, user_id: user.id }),
    })
    if (res.ok) {
      const data = await res.json()
      window.location.href = getWorkorderRoute(data.so_id || data.id, undefined, 'service-request')
    } else flash('Failed to convert')
  }

  async function rejectRequest() {
    if (!user || !rejectId || !rejectReason.trim()) return
    await fetch('/api/service-requests', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', request_id: rejectId, reject_reason: rejectReason.trim(), shop_id: user.shop_id }),
    })
    setRejectId(null); setRejectReason('')
    flash('Request rejected')
    if (user) await loadRequests(user.shop_id)
  }

  function timeAgo(d: string) {
    const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
    if (m < 60) return `${m}m ago`
    if (m < 1440) return `${Math.floor(m / 60)}h ago`
    return `${Math.floor(m / 1440)}d ago`
  }

  function fmtDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  const tabs = [
    { key: 'new' as const, label: 'Pending', count: requests.filter(r => r.status === 'new' || r.status === 'scheduled').length },
    { key: 'converted' as const, label: 'Converted', count: requests.filter(r => r.status === 'converted').length },
    { key: 'rejected' as const, label: 'Rejected', count: requests.filter(r => r.status === 'rejected').length },
  ]

  if (loading) return <div style={{ background: th.bg, minHeight: '100vh', color: th.textSecondary, fontFamily: "'Instrument Sans',sans-serif", padding: 40, textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ background: th.bg, minHeight: '100vh', color: th.text, fontFamily: "'Instrument Sans',sans-serif", padding: 24 }}>
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: th.accent, color: th.bgLight, padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>{toast}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: th.text }}>Service Requests</div>
          <div style={{ fontSize: 12, color: th.textSecondary }}>Intake requests from Fleet, Maintenance, and Kiosk</div>
        </div>
        <a href="/service-requests/new" style={{ padding: '8px 16px', background: th.accent, border: 'none', borderRadius: 8, color: th.bgLight, fontSize: 12, fontWeight: 700, textDecoration: 'none', fontFamily: 'inherit' }}>+ New Request</a>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${th.border}`, marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setPage(1) }} style={{
            padding: '10px 18px', fontSize: 12, fontWeight: tab === t.key ? 700 : 400,
            color: tab === t.key ? th.accentLight : th.textSecondary, background: 'none', border: 'none',
            borderBottom: tab === t.key ? `2px solid ${th.accentLight}` : '2px solid transparent',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* FilterBar */}
      <FilterBar
        search={srSearch}
        onSearchChange={val => { setSrSearch(val); setPage(1) }}
        searchPlaceholder="Search unit #, customer, description..."
        dateFrom={srDateFrom}
        dateTo={srDateTo}
        onDateFromChange={val => { setSrDateFrom(val); setPage(1) }}
        onDateToChange={val => { setSrDateTo(val); setPage(1) }}
        theme="dark"
      />

      {/* Request cards */}
      {filtered.length === 0 ? (
        <div style={{ background: th.bgCard, border: `1px solid ${th.border}`, borderRadius: 12, padding: 40, textAlign: 'center', color: th.textSecondary, fontSize: 13 }}>
          {srSearch || srDateFrom || srDateTo ? 'No results found. Try adjusting your filters.' : tab === 'new' ? 'No pending service requests' : `No ${tab} requests`}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {paginated.map(r => {
            const urg = URGENCY[r.urgency || r.priority || 'normal'] || URGENCY.normal
            const src = SOURCE[r.source || r.check_in_type || 'manual'] || SOURCE.manual
            return (
              <div key={r.id} style={{ background: th.bgCard, border: `1px solid ${th.border}`, borderRadius: 12, padding: 16 }}>
                {/* Top row: badges + time */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: src.bg, color: src.color, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: '.04em' }}>{src.label}</span>
                    <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: urg.bg, color: urg.color, fontFamily: "'IBM Plex Mono',monospace" }}>{urg.label}</span>
                  </div>
                  <span style={{ fontSize: 10, color: th.textTertiary }}>{timeAgo(r.created_at)}</span>
                </div>

                {/* Truck + Customer */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: th.text }}>
                    {r.unit_number ? `#${r.unit_number}` : '—'}{r.unit_number && ' — '}{r.company_name || 'Walk-in'}
                  </div>
                  {r.contact_name && <div style={{ fontSize: 11, color: th.textSecondary, marginTop: 2 }}>{r.contact_name}{r.phone ? ` · ${r.phone}` : ''}</div>}
                </div>

                {/* Concern */}
                <div style={{ fontSize: 13, color: th.text, marginBottom: 10, lineHeight: 1.5 }}>{r.description || '—'}</div>

                {/* Details row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', marginBottom: 12, fontSize: 11 }}>
                  <div><span style={{ color: th.textTertiary }}>Arriving:</span> <span style={{ color: th.text }}>{fmtDate(r.expected_arrival) || fmtDate(r.scheduled_date) || '—'}</span></div>
                  <div><span style={{ color: th.textTertiary }}>Need by:</span> <span style={{ color: th.text }}>{fmtDate(r.promised_date) || '—'}</span></div>
                  <div><span style={{ color: th.textTertiary }}>Parking:</span> <span style={{ color: th.text }}>{r.parking_location || '—'}</span></div>
                  <div><span style={{ color: th.textTertiary }}>Keys:</span> <span style={{ color: th.text }}>{r.key_location || '—'}</span></div>
                </div>

                {/* Actions */}
                {r.status === 'new' || r.status === 'scheduled' ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => convertToWO(r)} style={{ padding: '6px 14px', background: 'rgba(29,111,232,.12)', color: th.accentLight, border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Convert to WO</button>
                    <a href={`/service-requests/new?edit=${r.id}`} style={{ padding: '6px 14px', background: th.border, color: th.textSecondary, borderRadius: 6, fontSize: 11, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>Edit</a>
                    <button onClick={() => { setRejectId(r.id); setRejectReason('') }} style={{ padding: '6px 14px', background: 'rgba(217,79,79,.08)', color: '#D94F4F', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Reject</button>
                  </div>
                ) : r.status === 'converted' && r.converted_so_id ? (
                  <a href={getWorkorderRoute(r.converted_so_id, undefined, 'service-request')} style={{ fontSize: 11, color: th.accentLight, textDecoration: 'none' }}>View Work Order →</a>
                ) : r.status === 'rejected' ? (
                  <div style={{ fontSize: 11, color: '#D94F4F' }}>Rejected{r.reject_reason ? `: ${r.reject_reason}` : ''}</div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} total={filtered.length} label="requests" onPageChange={setPage} />

      {/* Reject modal */}
      {rejectId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setRejectId(null)}>
          <div style={{ background: '#12131a', border: `1px solid ${th.border}`, borderRadius: 16, padding: 28, width: 400 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: th.text, marginBottom: 12 }}>Reject Request</div>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason..." rows={3} autoFocus style={{ width: '100%', padding: '10px 12px', background: th.border, border: `1px solid ${th.border}`, borderRadius: 8, fontSize: 13, color: th.text, outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={rejectRequest} disabled={!rejectReason.trim()} style={{ flex: 1, padding: 10, background: rejectReason.trim() ? '#D94F4F' : th.border, color: rejectReason.trim() ? th.bgLight : th.textTertiary, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: rejectReason.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>Reject</button>
              <button onClick={() => setRejectId(null)} style={{ padding: '10px 20px', background: th.border, color: th.textSecondary, border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
