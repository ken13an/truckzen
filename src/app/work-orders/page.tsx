/**
 * TruckZen — Original Design
 * Built from scratch by TruckZen development team
 * All business logic and UI design is proprietary to TruckZen
 */
'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { PageFooter } from '@/components/ui/PageControls'
import SourceBadge from '@/components/ui/SourceBadge'

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
type ViewFilter = 'all' | 'active' | 'historical'

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
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewFilter, setViewFilter] = useState<ViewFilter>('active')
  const [dateRange, setDateRange] = useState<DateRange>('all')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)

  useEffect(() => {
    getCurrentUser(supabase).then(async (p) => {
      if (!p) { window.location.href = '/login'; return }
      // Always fetch all WOs — show everything by default
      const res = await fetch(`/api/work-orders?shop_id=${p.shop_id}&limit=500`)
      if (res.ok) setOrders(await res.json())
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() => orders.filter(o => {
    // View filter (All / Active / Historical)
    if (viewFilter === 'active' && o.is_historical) return false
    if (viewFilter === 'historical' && !o.is_historical) return false

    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'open') { if (['good_to_go', 'completed', 'done', 'closed', 'invoiced', 'void'].includes(o.status)) return false }
      else if (statusFilter === 'completed') { if (!['good_to_go', 'completed', 'done'].includes(o.status)) return false }
      else if (statusFilter === 'closed') { if (!['closed', 'invoiced'].includes(o.status)) return false }
      else if (o.status !== statusFilter) return false
    }

    // Date range
    if (dateRange !== 'all') {
      const rangeStart = getDateRangeStart(dateRange)
      if (rangeStart && o.created_at && new Date(o.created_at) < rangeStart) return false
    }

    // Search
    if (!search) return true
    const q = search.toLowerCase()
    return o.so_number?.toLowerCase().includes(q) || o.complaint?.toLowerCase().includes(q) || (o.customers as any)?.company_name?.toLowerCase().includes(q) || (o.assets as any)?.unit_number?.toLowerCase().includes(q)
  }), [orders, viewFilter, statusFilter, dateRange, search])

  const paginated = useMemo(() => {
    if (perPage === 0) return filtered
    const start = (page - 1) * perPage
    return filtered.slice(start, start + perPage)
  }, [filtered, page, perPage])

  const activeCount = orders.filter(o => !o.is_historical).length
  const histCount = orders.filter(o => o.is_historical).length
  const fmt = (n: number) => n ? `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—'

  return (
    <div style={{ minHeight: '100vh', background: '#F4F5F7', fontFamily: "'Instrument Sans', sans-serif", padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#1A1A1A' }}>Work Orders</div>
          <div style={{ fontSize: 13, color: '#6B7280' }}>{filtered.length} of {orders.length} work order{orders.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/service-requests" style={{ padding: '10px 16px', background: '#fff', border: '1px solid #D1D5DB', borderRadius: 8, color: '#374151', fontSize: 13, fontWeight: 600, textDecoration: 'none', fontFamily: 'inherit' }}>Service Requests</a>
          <a href="/work-orders/new" style={{ padding: '10px 20px', background: '#1D6FE8', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', fontFamily: 'inherit' }}>+ New Work Order</a>
        </div>
      </div>

      {/* View filter: All / Active / Historical */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #E5E7EB', marginBottom: 12 }}>
        {([['active', `Active (${activeCount})`], ['all', `All (${orders.length})`], ['historical', `Historical (${histCount})`]] as [ViewFilter, string][]).map(([v, l]) => (
          <button key={v} onClick={() => { setViewFilter(v); setPage(1) }} style={{
            padding: '10px 18px', background: 'none', border: 'none', borderBottom: viewFilter === v ? '2px solid #1D6FE8' : '2px solid transparent',
            color: viewFilter === v ? '#1D6FE8' : '#9CA3AF', fontWeight: viewFilter === v ? 700 : 500, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginBottom: -2,
          }}>{l}</button>
        ))}
      </div>

      {/* Status + search + date filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {[['all', 'All'], ['open', 'Open'], ['in_progress', 'In Progress'], ['completed', 'Completed'], ['closed', 'Closed']].map(([v, l]) => (
          <button key={v} onClick={() => { setStatusFilter(v); setPage(1) }} style={{ padding: '5px 12px', borderRadius: 100, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: statusFilter === v ? '1px solid #1D6FE8' : '1px solid #D1D5DB', background: statusFilter === v ? '#EFF6FF' : '#fff', color: statusFilter === v ? '#1D6FE8' : '#6B7280', fontFamily: 'inherit' }}>{l}</button>
        ))}
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search WO #, customer, unit..." style={{ marginLeft: 4, padding: '6px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 12, color: '#1A1A1A', fontFamily: 'inherit', outline: 'none', width: 220, background: '#fff' }} />
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {([['today', 'Today'], ['week', 'This Week'], ['month', 'This Month'], ['3months', 'Last 3 Months'], ['all', 'All Time']] as [DateRange, string][]).map(([v, l]) => (
          <button key={v} onClick={() => { setDateRange(v); setPage(1) }} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: dateRange === v ? '1px solid #1D6FE8' : '1px solid #E5E7EB', background: dateRange === v ? '#EFF6FF' : '#fff', color: dateRange === v ? '#1D6FE8' : '#9CA3AF', fontFamily: 'inherit' }}>{l}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#9CA3AF' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
            {viewFilter === 'active' ? 'No active work orders. Create your first work order or view historical records.' : 'No work orders found'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                {['WO #', 'Date', 'Customer', 'Unit', 'Concern', 'Status', 'Tech', 'Total'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map(o => {
                const st = STATUS_MAP[o.status] || STATUS_MAP.draft
                const isHist = o.is_historical
                return (
                  <tr key={o.id} style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer', opacity: isHist ? 0.7 : 1 }} onClick={() => window.location.href = `/work-orders/${o.id}`}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#1D6FE8', whiteSpace: 'nowrap' }}>
                      {o.so_number || '—'}
                      {isHist && <span style={{ marginLeft: 4, padding: '1px 5px', borderRadius: 3, background: 'rgba(124,139,160,0.1)', color: '#7C8BA0', fontSize: 8, fontWeight: 600, textTransform: 'uppercase', fontFamily: "'IBM Plex Mono', monospace" }}>Historical</span>}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace' }}>{o.created_at ? new Date(o.created_at).toLocaleDateString() : '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600, color: '#1A1A1A', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(o.customers as any)?.company_name || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#6B7280' }}>#{(o.assets as any)?.unit_number || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#6B7280', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.complaint || '—'}</td>
                    <td style={{ padding: '10px 12px' }}><span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 600, background: st.bg, color: st.color }}>{st.label}</span></td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#374151' }}>{(o.users as any)?.full_name || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: '#1A1A1A' }}>{fmt(o.grand_total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      <PageFooter total={filtered.length} page={page} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage} />
    </div>
  )
}
