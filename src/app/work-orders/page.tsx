/**
 * TruckZen — Original Design
 * Built from scratch by TruckZen development team
 * All business logic and UI design is proprietary to TruckZen
 */
'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser, type UserProfile } from '@/lib/auth'
import { SERVICE_WRITE_ROLES } from '@/lib/roles'
import { PageFooter } from '@/components/ui/PageControls'
import OwnershipTypeBadge from '@/components/OwnershipTypeBadge'
import SourceBadge from '@/components/ui/SourceBadge'
import FilterBar from '@/components/FilterBar'
import { useTheme } from '@/hooks/useTheme'
import { getWorkorderRoute } from '@/lib/navigation/workorder-route'

type DateRange = 'today' | 'week' | 'month' | '3months' | 'all'
type ViewFilter = 'all' | 'active' | 'historical' | 'dealer' | 'drafts'

function getDateRangeStart(range: DateRange): Date | null {
  const now = new Date()
  switch (range) {
    case 'today': { const d = new Date(now); d.setHours(0, 0, 0, 0); return d }
    case 'week': { const d = new Date(now); d.setDate(d.getDate() - 7); return d }
    case 'month': { const d = new Date(now); d.setMonth(d.getMonth() - 1); return d }
    case '3months': { const d = new Date(now); d.setMonth(d.getMonth() - 3); return d }
    case 'all': return null
  }
}

export default function WorkOrdersPage() {
  const { tokens: t } = useTheme()

  const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
    draft:            { label: 'Draft',          bg: 'var(--tz-surfaceMuted)', color: 'var(--tz-textSecondary)' },
    not_started:      { label: 'Unassigned',     bg: 'var(--tz-dangerBg)', color: 'var(--tz-danger)' },
    in_progress:      { label: 'In Progress',    bg: 'var(--tz-accentBg)', color: 'var(--tz-accent)' },
    waiting_parts:    { label: 'Waiting Parts',  bg: 'var(--tz-warningBg)', color: 'var(--tz-warning)' },
    waiting_approval: { label: 'Pending Review', bg: 'var(--tz-warningBg)', color: 'var(--tz-warning)' },
    authorized:       { label: 'Approved',       bg: 'var(--tz-successBg)', color: 'var(--tz-success)' },
    done:             { label: 'Completed',      bg: 'var(--tz-successBg)', color: 'var(--tz-success)' },
    good_to_go:       { label: 'Completed',      bg: 'var(--tz-successBg)', color: 'var(--tz-success)' },
    completed:        { label: 'Completed',      bg: 'var(--tz-successBg)', color: 'var(--tz-success)' },
    invoiced:         { label: 'Invoiced',       bg: 'var(--tz-accentBg)', color: 'var(--tz-accent)' },
    closed:           { label: 'Closed',         bg: 'var(--tz-surfaceMuted)', color: 'var(--tz-textSecondary)' },
  }

  const supabase = createClient()
  const [orders, setOrders] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewFilter, setViewFilter] = useState<ViewFilter>('active')
  const [dateRange, setDateRange] = useState<DateRange>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [perPage] = useState(25)
  const [shopId, setShopId] = useState('')
  const [user, setUser] = useState<UserProfile | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  // Pending requests fetched from /api/service-requests in parallel and
  // merged client-side. Failures here must not break the WO list — see
  // fetchPendingRequests catch + render gates below.
  const [pendingRequests, setPendingRequests] = useState<any[]>([])

  // Read-only fetch of unconverted service_requests so service writers see
  // them in the same Work Orders surface before kiosk/SR submit becomes
  // Pending-Request-first. Excludes converted/rejected statuses; deleted
  // rows are already filtered server-side.
  const fetchPendingRequests = async (sid: string) => {
    if (!sid) return
    try {
      const res = await fetch(`/api/service-requests?shop_id=${sid}`)
      if (!res.ok) return
      const data = await res.json()
      const arr = Array.isArray(data) ? data : []
      setPendingRequests(arr.filter((r: any) => r.status === 'new' || r.status === 'scheduled'))
    } catch {
      // SR fetch failure must not hide WOs
    }
  }

  // Fetch WOs from API with server-side pagination
  const fetchOrders = async (sid: string, p: number) => {
    if (!sid) return
    setLoading(true)
    try {
      let url = `/api/work-orders?shop_id=${sid}&page=${p}&limit=${perPage}`
      if (viewFilter === 'active') url += '&historical=false'
      if (viewFilter === 'historical') url += '&historical=true'
      if (viewFilter === 'dealer') url += '&warranty_status=send_to_dealer'
      if (viewFilter === 'drafts') url += '&status=draft&include_drafts=true'
      if (statusFilter !== 'all') url += `&status=${statusFilter}`
      if (search) url += `&q=${encodeURIComponent(search)}`
      const res = await fetch(url)
      if (res.ok) {
        const json = await res.json()
        // Handle both old array response and new paginated response
        if (Array.isArray(json)) {
          setOrders(json); setTotal(json.length); setTotalPages(1)
        } else {
          setOrders(json.data || []); setTotal(json.total || 0); setTotalPages(json.totalPages || 1)
        }
      }
    } catch { /* network or parse error — page stays in current state */ }
    setLoading(false)
  }

  useEffect(() => {
    getCurrentUser(supabase).then(async (p) => {
      if (!p) { window.location.href = '/login'; return }
      // Work Orders list is a service-operational surface
      const eff = p.impersonate_role || p.role
      if (!SERVICE_WRITE_ROLES.includes(eff) && !(!p.impersonate_role && p.is_platform_owner)) {
        window.location.href = '/dashboard'; return
      }
      setUser(p)
      setShopId(p.shop_id)
      await Promise.all([fetchOrders(p.shop_id, 1), fetchPendingRequests(p.shop_id)])
    }).catch(() => { /* auth error — page stays on loading state, no crash */ })
  }, [])

  // Re-fetch when filters, page, or search change
  useEffect(() => {
    if (!shopId) return
    fetchOrders(shopId, page)
    fetchPendingRequests(shopId)
  }, [page, viewFilter, statusFilter, search, shopId])

  // Date range filter (client-side on current page results)
  const filtered = useMemo(() => {
    let list = orders
    if (dateRange !== 'all') {
      const rangeStart = getDateRangeStart(dateRange)
      if (rangeStart) list = list.filter(o => o.created_at && new Date(o.created_at) >= rangeStart)
    }
    if (dateFrom) {
      const from = new Date(dateFrom)
      list = list.filter(o => o.created_at && new Date(o.created_at) >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo + 'T23:59:59')
      list = list.filter(o => o.created_at && new Date(o.created_at) <= to)
    }
    return list
  }, [orders, dateRange, dateFrom, dateTo])

  // Pending Requests are surfaced in the Work Orders section but only on
  // active/all views and only when status filter is unconstrained — their
  // status vocabulary ('new'/'scheduled') doesn't intersect with WO status
  // filters. Historical/dealer/drafts views never show pending requests.
  const showPendingRequests = (viewFilter === 'active' || viewFilter === 'all') && statusFilter === 'all'

  const filteredPending = useMemo(() => {
    if (!showPendingRequests) return [] as any[]
    let list = pendingRequests
    if (dateRange !== 'all') {
      const rangeStart = getDateRangeStart(dateRange)
      if (rangeStart) list = list.filter(r => r.created_at && new Date(r.created_at) >= rangeStart)
    }
    if (dateFrom) {
      const from = new Date(dateFrom)
      list = list.filter(r => r.created_at && new Date(r.created_at) >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo + 'T23:59:59')
      list = list.filter(r => r.created_at && new Date(r.created_at) <= to)
    }
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        (r.company_name || '').toLowerCase().includes(q) ||
        (r.contact_name || '').toLowerCase().includes(q) ||
        (r.unit_number || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [pendingRequests, showPendingRequests, dateRange, dateFrom, dateTo, search])

  // Pending request source label (kiosk-originated SRs vs service-writer
  // initiated, etc.). Falls back to a generic 'Request' label.
  const pendingSourceLabel = (r: any): string => {
    const checkInType = r?.check_in_type
    const source = r?.source
    if (checkInType === 'kiosk' || source === 'kiosk' || source === 'kiosk_checkin') return 'Kiosk Intake'
    if (checkInType === 'fleet_request') return 'Fleet Request'
    if (checkInType === 'service_writer' || source === 'service_writer') return 'Service Request'
    if (checkInType === 'phone') return 'Phone Request'
    return 'Request'
  }
  const fmt = (n: number) => n ? `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—'
  const effectiveRole = user?.impersonate_role || user?.role || ''
  const canBulkVoid = user && ['owner', 'gm', 'it_person', 'service_writer'].includes(effectiveRole)

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(o => o.id)))
  }
  const handleBulkDelete = async () => {
    if (!user) return
    setDeleting(true)
    const res = await fetch('/api/work-orders', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: Array.from(selected), user_id: user.id }) })
    if (res.ok) {
      const data = await res.json()
      setToastMsg(`${data.voided} work order${data.voided !== 1 ? 's' : ''} voided`)
      setTimeout(() => setToastMsg(''), 5000)
      setSelected(new Set())
      setShowDeleteModal(false)
      await fetchOrders(shopId, page)
    }
    setDeleting(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--tz-bg)', fontFamily: "'Instrument Sans', sans-serif", padding: 'clamp(12px, 3vw, 24px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--tz-text)' }}>Work Orders</div>
          <div style={{ fontSize: 13, color: 'var(--tz-textSecondary)' }}>{total.toLocaleString()} work order{total !== 1 ? 's' : ''} {viewFilter !== 'all' ? `(${viewFilter})` : ''}</div>
        </div>
        {user && SERVICE_WRITE_ROLES.includes(user.impersonate_role || user.role) && (
          <a href="/work-orders/new" style={{ padding: '10px 20px', background: 'var(--tz-accent)', border: 'none', borderRadius: 8, color: 'var(--tz-bgLight)', fontSize: 13, fontWeight: 700, textDecoration: 'none', fontFamily: 'inherit' }}>+ New Work Order</a>
        )}
      </div>

      {/* View filter: All / Active / Historical */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `2px solid ${'var(--tz-border)'}`, marginBottom: 12 }}>
        {([['active', 'Active'], ['all', 'All'], ['drafts', 'Drafts'], ['historical', 'Historical'], ['dealer', 'Sent to Dealer']] as [ViewFilter, string][]).map(([v, l]) => (
          <button key={v} onClick={() => { setViewFilter(v); setPage(1) }} style={{
            padding: '10px 18px', background: 'none', border: 'none', borderBottom: viewFilter === v ? `2px solid ${'var(--tz-accent)'}` : '2px solid transparent',
            color: viewFilter === v ? 'var(--tz-accent)' : 'var(--tz-textTertiary)', fontWeight: viewFilter === v ? 700 : 500, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginBottom: -2,
          }}>{l}</button>
        ))}
      </div>

      {/* FilterBar: status + search + date filters */}
      <FilterBar
        search={search}
        onSearchChange={val => { setSearch(val) }}
        searchPlaceholder="Search WO #, customer, unit..."
        statusOptions={[
          { value: 'all', label: 'All Statuses' },
          { value: 'draft', label: 'Draft' },
          { value: 'in_progress', label: 'In Progress' },
          { value: 'waiting_parts', label: 'Waiting Parts' },
          { value: 'done', label: 'Completed' },
          { value: 'good_to_go', label: 'Good to Go' },
        ]}
        statusValue={statusFilter}
        onStatusChange={val => { setStatusFilter(val); setPage(1) }}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={val => { setDateFrom(val); setDateRange('all'); setPage(1) }}
        onDateToChange={val => { setDateTo(val); setDateRange('all'); setPage(1) }}
      />

      {/* Bulk void bar */}
      {canBulkVoid && selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', background: 'var(--tz-dangerBg)', border: `1px solid ${'var(--tz-danger)'}`, borderRadius: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tz-danger)' }}>{selected.size} selected</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => setSelected(new Set())} style={{ padding: '4px 12px', borderRadius: 6, border: `1px solid ${'var(--tz-border)'}`, background: 'var(--tz-bgCard)', color: 'var(--tz-text)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
          <button onClick={() => setShowDeleteModal(true)} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: 'var(--tz-danger)', color: 'var(--tz-bgLight)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Void Selected ({selected.size})</button>
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-cardBorder)'}`, borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--tz-textSecondary)' }}>Loading...</div>
        ) : filtered.length === 0 && filteredPending.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--tz-textSecondary)', fontSize: 13 }}>
            {search || statusFilter !== 'all' || dateFrom || dateTo ? 'No results found. Try adjusting your filters.' : viewFilter === 'active' ? 'No active work orders. Create your first work order or view historical records.' : 'No work orders found'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${'var(--tz-border)'}` }}>
                {canBulkVoid && <th style={{ padding: '8px 6px 8px 12px', width: 32 }}><input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleAll} style={{ cursor: 'pointer', accentColor: 'var(--tz-accent)' }} /></th>}
                {['WO #', 'Date', 'Customer', 'Unit', 'Work Description', 'Status', 'Tech', 'Total'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--tz-textTertiary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPending.map(r => {
                const reqNumber = `REQ-${String(r.id || '').slice(0, 6).toUpperCase()}`
                return (
                  <tr key={`pr-${r.id}`} style={{ borderBottom: `1px solid ${'var(--tz-border)'}`, cursor: 'pointer', background: 'var(--tz-warningBg)' }}
                    onClick={() => { window.location.href = '/service-requests' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--tz-bgHover)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--tz-warningBg)' }}>
                    {canBulkVoid && <td style={{ padding: '10px 6px 10px 12px', width: 32 }} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" disabled style={{ cursor: 'not-allowed', opacity: 0.4 }} title="Pending requests cannot be voided here — use Review / Convert" />
                    </td>}
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: 'var(--tz-warning)', whiteSpace: 'nowrap' }}>
                      {reqNumber}
                      <span style={{ marginLeft: 4, padding: '1px 5px', borderRadius: 3, background: 'var(--tz-warningBg)', color: 'var(--tz-warning)', fontSize: 8, fontWeight: 700, textTransform: 'uppercase', fontFamily: "'IBM Plex Mono', monospace", border: `1px solid var(--tz-warning)` }}>Pending Request</span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--tz-textTertiary)', fontFamily: 'monospace' }}>{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600, color: 'var(--tz-text)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.company_name || r.contact_name || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--tz-textSecondary)' }}>
                      {r.unit_number ? `#${r.unit_number}` : '—'}
                      <div style={{ marginTop: 2, fontSize: 9, color: 'var(--tz-textTertiary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{pendingSourceLabel(r)}</div>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--tz-textSecondary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 600, background: 'var(--tz-warningBg)', color: 'var(--tz-warning)' }}>Needs Service Writer Review</span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--tz-textTertiary)' }}>—</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: 'monospace', color: 'var(--tz-textTertiary)' }}>—</td>
                  </tr>
                )
              })}
              {filtered.map(o => {
                const st = STATUS_MAP[o.status] || STATUS_MAP.draft
                const isHist = o.is_historical
                return (
                  <tr key={o.id} style={{ borderBottom: `1px solid ${'var(--tz-border)'}`, cursor: 'pointer', opacity: isHist ? 0.7 : 1, background: selected.has(o.id) ? 'var(--tz-accentBg)' : '' }} onClick={() => window.location.href = getWorkorderRoute(o.id)}
                    onMouseEnter={e => { if (!selected.has(o.id)) e.currentTarget.style.background = 'var(--tz-bgHover)' }} onMouseLeave={e => { if (!selected.has(o.id)) e.currentTarget.style.background = '' }}>
                    {canBulkVoid && <td style={{ padding: '10px 6px 10px 12px', width: 32 }} onClick={e => e.stopPropagation()}><input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleSelect(o.id)} style={{ cursor: 'pointer', accentColor: 'var(--tz-accent)' }} /></td>}
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: 'var(--tz-accent)', whiteSpace: 'nowrap' }}>
                      {o.so_number || '—'}
                      {isHist && <span style={{ marginLeft: 4, padding: '1px 5px', borderRadius: 3, background: 'var(--tz-surfaceMuted)', color: 'var(--tz-textSecondary)', fontSize: 8, fontWeight: 600, textTransform: 'uppercase', fontFamily: "'IBM Plex Mono', monospace" }}>Historical</span>}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--tz-textTertiary)', fontFamily: 'monospace' }}>{o.created_at ? new Date(o.created_at).toLocaleDateString() : '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600, color: 'var(--tz-text)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(o.customers as any)?.company_name || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--tz-textSecondary)' }}>
                      #{(o.assets as any)?.unit_number || '—'}
                      {o.ownership_type && o.ownership_type !== 'fleet_asset' && <div style={{ marginTop: 2 }}><OwnershipTypeBadge type={o.ownership_type} size="sm" /></div>}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--tz-textSecondary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.complaint || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 600, background: st.bg, color: st.color }}>{st.label}</span>
                      {o.automation?.is_overdue && <span style={{ marginLeft: 4, padding: '1px 5px', borderRadius: 3, background: 'var(--tz-dangerBg)', color: 'var(--tz-danger)', fontSize: 8, fontWeight: 700, textTransform: 'uppercase' }}>Overdue</span>}
                      {o.automation?.exception && <div style={{ fontSize: 9, color: 'var(--tz-warning)', marginTop: 2 }}>{o.automation.next_action}</div>}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--tz-textSecondary)' }}>{(o.users as any)?.full_name || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: 'var(--tz-text)' }}>{fmt(o.grand_total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
      {/* Pagination */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', fontSize: 13, color: 'var(--tz-textSecondary)' }}>
        <span>{total.toLocaleString()} total</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${'var(--tz-border)'}`, background: page <= 1 ? 'var(--tz-bg)' : 'var(--tz-bgCard)', color: page <= 1 ? 'var(--tz-textTertiary)' : 'var(--tz-textSecondary)', fontSize: 12, fontWeight: 600, cursor: page <= 1 ? 'default' : 'pointer', fontFamily: 'inherit' }}>Previous</button>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tz-text)' }}>Page {page} of {totalPages.toLocaleString()}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
            style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${'var(--tz-border)'}`, background: page >= totalPages ? 'var(--tz-bg)' : 'var(--tz-bgCard)', color: page >= totalPages ? 'var(--tz-textTertiary)' : 'var(--tz-textSecondary)', fontSize: 12, fontWeight: 600, cursor: page >= totalPages ? 'default' : 'pointer', fontFamily: 'inherit' }}>Next</button>
        </div>
      </div>
      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowDeleteModal(false)}>
          <div style={{ background: 'var(--tz-bgElevated)', borderRadius: 12, padding: 24, width: 420, maxWidth: '90vw', border: `1px solid ${'var(--tz-border)'}` }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--tz-text)', marginBottom: 8 }}>Void Work Orders</div>
            <div style={{ fontSize: 13, color: 'var(--tz-textSecondary)', marginBottom: 16 }}>Are you sure you want to void {selected.size} work order{selected.size !== 1 ? 's' : ''}? They will be removed from the active list but preserved in records.</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDeleteModal(false)} style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${'var(--tz-border)'}`, background: 'var(--tz-bgCard)', color: 'var(--tz-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleBulkDelete} disabled={deleting} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--tz-danger)', color: 'var(--tz-bgLight)', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: deleting ? 0.6 : 1 }}>{deleting ? 'Voiding...' : `Void ${selected.size} WO${selected.size !== 1 ? 's' : ''}`}</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMsg && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--tz-bgElevated)', color: 'var(--tz-text)', padding: '12px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 2000, boxShadow: '0 4px 12px rgba(0,0,0,0.4)', border: `1px solid ${'var(--tz-border)'}` }}>
          {toastMsg}
        </div>
      )}
    </div>
  )
}
