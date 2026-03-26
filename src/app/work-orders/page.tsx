/**
 * TruckZen — Original Design
 * Built from scratch by TruckZen development team
 * All business logic and UI design is proprietary to TruckZen
 */
'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser, type UserProfile } from '@/lib/auth'
import { PageFooter } from '@/components/ui/PageControls'
import OwnershipTypeBadge from '@/components/OwnershipTypeBadge'
import SourceBadge from '@/components/ui/SourceBadge'
import FilterBar from '@/components/FilterBar'

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  draft:            { label: 'Draft',          bg: '#F3F4F6', color: '#6B7280' },
  not_started:      { label: 'Unassigned',     bg: '#FEF2F2', color: '#DC2626' },
  in_progress:      { label: 'In Progress',    bg: '#EFF6FF', color: '#1D6FE8' },
  waiting_parts:    { label: 'Waiting Parts',  bg: '#FFF7ED', color: '#EA580C' },
  waiting_approval: { label: 'Pending Review', bg: '#FFFBEB', color: '#D97706' },
  authorized:       { label: 'Approved',       bg: '#F0FDF4', color: '#16A34A' },
  done:             { label: 'Completed',      bg: '#ECFDF5', color: '#059669' },
  good_to_go:       { label: 'Completed',      bg: '#ECFDF5', color: '#059669' },
  completed:        { label: 'Completed',      bg: '#ECFDF5', color: '#059669' },
  invoiced:         { label: 'Invoiced',       bg: '#EFF6FF', color: '#1D6FE8' },
  closed:           { label: 'Closed',         bg: '#F3F4F6', color: '#6B7280' },
}

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

  // Fetch WOs from API with server-side pagination
  const fetchOrders = async (sid: string, p: number) => {
    if (!sid) return
    setLoading(true)
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
    setLoading(false)
  }

  useEffect(() => {
    getCurrentUser(supabase).then(async (p) => {
      if (!p) { window.location.href = '/login'; return }
      setUser(p)
      setShopId(p.shop_id)
      await fetchOrders(p.shop_id, 1)
    })
  }, [])

  // Re-fetch when filters, page, or search change
  useEffect(() => {
    if (!shopId) return
    fetchOrders(shopId, page)
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
  const fmt = (n: number) => n ? `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—'
  const canBulkDelete = user && ['owner', 'gm', 'it_person'].includes(user.role)
  const blockedStatuses = ['in_progress', 'completed', 'good_to_go', 'done', 'invoiced']

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
      setToastMsg(`${data.deleted} work order${data.deleted !== 1 ? 's' : ''} deleted${data.skipped > 0 ? `, ${data.skipped} skipped (in progress/completed)` : ''}`)
      setTimeout(() => setToastMsg(''), 5000)
      setSelected(new Set())
      setShowDeleteModal(false)
      await fetchOrders(shopId, page)
    }
    setDeleting(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F4F5F7', fontFamily: "'Instrument Sans', sans-serif", padding: 'clamp(12px, 3vw, 24px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#1A1A1A' }}>Work Orders</div>
          <div style={{ fontSize: 13, color: '#6B7280' }}>{total.toLocaleString()} work order{total !== 1 ? 's' : ''} {viewFilter !== 'all' ? `(${viewFilter})` : ''}</div>
        </div>
        <a href="/work-orders/new" style={{ padding: '10px 20px', background: '#1D6FE8', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', fontFamily: 'inherit' }}>+ New Work Order</a>
      </div>

      {/* View filter: All / Active / Historical */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #E5E7EB', marginBottom: 12 }}>
        {([['active', 'Active'], ['all', 'All'], ['drafts', 'Drafts'], ['historical', 'Historical'], ['dealer', 'Sent to Dealer']] as [ViewFilter, string][]).map(([v, l]) => (
          <button key={v} onClick={() => { setViewFilter(v); setPage(1) }} style={{
            padding: '10px 18px', background: 'none', border: 'none', borderBottom: viewFilter === v ? '2px solid #1D6FE8' : '2px solid transparent',
            color: viewFilter === v ? '#1D6FE8' : '#9CA3AF', fontWeight: viewFilter === v ? 700 : 500, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginBottom: -2,
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
          { value: 'open', label: 'Open' },
          { value: 'in_progress', label: 'In Progress' },
          { value: 'completed', label: 'Completed' },
          { value: 'closed', label: 'Closed' },
        ]}
        statusValue={statusFilter}
        onStatusChange={val => { setStatusFilter(val); setPage(1) }}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={val => { setDateFrom(val); setDateRange('all'); setPage(1) }}
        onDateToChange={val => { setDateTo(val); setDateRange('all'); setPage(1) }}
        theme="light"
      />

      {/* Bulk delete bar */}
      {canBulkDelete && selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#DC2626' }}>{selected.size} selected</span>
          {(() => { const blocked = Array.from(selected).filter(id => { const o = filtered.find(f => f.id === id); return o && blockedStatuses.includes(o.status) }); return blocked.length > 0 ? <span style={{ fontSize: 11, color: '#991B1B' }}>{blocked.length} cannot be deleted (in progress/completed)</span> : null })()}
          <div style={{ flex: 1 }} />
          <button onClick={() => setSelected(new Set())} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
          <button onClick={() => setShowDeleteModal(true)} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: '#DC2626', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Delete Selected ({selected.size})</button>
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#9CA3AF' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
            {search || statusFilter !== 'all' || dateFrom || dateTo ? 'No results found. Try adjusting your filters.' : viewFilter === 'active' ? 'No active work orders. Create your first work order or view historical records.' : 'No work orders found'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                {canBulkDelete && <th style={{ padding: '8px 6px 8px 12px', width: 32 }}><input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleAll} style={{ cursor: 'pointer', accentColor: '#1D6FE8' }} /></th>}
                {['WO #', 'Date', 'Customer', 'Unit', 'Work Description', 'Status', 'Tech', 'Total'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => {
                const st = STATUS_MAP[o.status] || STATUS_MAP.draft
                const isHist = o.is_historical
                return (
                  <tr key={o.id} style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer', opacity: isHist ? 0.7 : 1, background: selected.has(o.id) ? '#EFF6FF' : '' }} onClick={() => window.location.href = `/work-orders/${o.id}`}
                    onMouseEnter={e => { if (!selected.has(o.id)) e.currentTarget.style.background = '#F9FAFB' }} onMouseLeave={e => { if (!selected.has(o.id)) e.currentTarget.style.background = '' }}>
                    {canBulkDelete && <td style={{ padding: '10px 6px 10px 12px', width: 32 }} onClick={e => e.stopPropagation()}><input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleSelect(o.id)} style={{ cursor: 'pointer', accentColor: '#1D6FE8' }} /></td>}
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#1D6FE8', whiteSpace: 'nowrap' }}>
                      {o.so_number || '—'}
                      {isHist && <span style={{ marginLeft: 4, padding: '1px 5px', borderRadius: 3, background: 'rgba(124,139,160,0.1)', color: '#7C8BA0', fontSize: 8, fontWeight: 600, textTransform: 'uppercase', fontFamily: "'IBM Plex Mono', monospace" }}>Historical</span>}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace' }}>{o.created_at ? new Date(o.created_at).toLocaleDateString() : '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600, color: '#1A1A1A', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(o.customers as any)?.company_name || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#6B7280' }}>
                      #{(o.assets as any)?.unit_number || '—'}
                      {o.ownership_type && o.ownership_type !== 'fleet_asset' && <div style={{ marginTop: 2 }}><OwnershipTypeBadge type={o.ownership_type} size="sm" /></div>}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#6B7280', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.complaint || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 600, background: st.bg, color: st.color }}>{st.label}</span>
                      {o.automation?.is_overdue && <span style={{ marginLeft: 4, padding: '1px 5px', borderRadius: 3, background: '#FEF2F2', color: '#DC2626', fontSize: 8, fontWeight: 700, textTransform: 'uppercase' }}>Overdue</span>}
                      {o.automation?.exception && <div style={{ fontSize: 9, color: '#D97706', marginTop: 2 }}>{o.automation.next_action}</div>}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#374151' }}>{(o.users as any)?.full_name || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: '#1A1A1A' }}>{fmt(o.grand_total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
      {/* Pagination */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', fontSize: 13, color: '#6B7280' }}>
        <span>{total.toLocaleString()} total</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #D1D5DB', background: page <= 1 ? '#F3F4F6' : '#fff', color: page <= 1 ? '#9CA3AF' : '#374151', fontSize: 12, fontWeight: 600, cursor: page <= 1 ? 'default' : 'pointer', fontFamily: 'inherit' }}>Previous</button>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Page {page} of {totalPages.toLocaleString()}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #D1D5DB', background: page >= totalPages ? '#F3F4F6' : '#fff', color: page >= totalPages ? '#9CA3AF' : '#374151', fontSize: 12, fontWeight: 600, cursor: page >= totalPages ? 'default' : 'pointer', fontFamily: 'inherit' }}>Next</button>
        </div>
      </div>
      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowDeleteModal(false)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 420, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>Delete Work Orders</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>Are you sure you want to delete {selected.size} work order{selected.size !== 1 ? 's' : ''}? They will be removed from the active list.</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDeleteModal(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleBulkDelete} disabled={deleting} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#DC2626', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: deleting ? 0.6 : 1 }}>{deleting ? 'Deleting...' : `Delete ${selected.size} WO${selected.size !== 1 ? 's' : ''}`}</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMsg && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1A1A1A', color: '#fff', padding: '12px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 2000, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          {toastMsg}
        </div>
      )}
    </div>
  )
}
