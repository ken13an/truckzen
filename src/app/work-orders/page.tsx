'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { PageFooter } from '@/components/ui/PageControls'
import SourceBadge from '@/components/ui/SourceBadge'

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  draft:                  { label: 'Draft',          bg: '#F3F4F6', color: '#6B7280' },
  not_started:            { label: 'Unassigned',     bg: '#FEF2F2', color: '#DC2626' },
  in_progress:            { label: 'In Progress',    bg: '#EFF6FF', color: '#1D6FE8' },
  waiting_parts:          { label: 'Waiting Parts',  bg: '#FFF7ED', color: '#EA580C' },
  waiting_approval:       { label: 'Pending Review', bg: '#FFFBEB', color: '#D97706' },
  authorized:             { label: 'Approved',       bg: '#F0FDF4', color: '#16A34A' },
  done:                   { label: 'Completed',      bg: '#ECFDF5', color: '#059669' },
  good_to_go:             { label: 'Completed',      bg: '#ECFDF5', color: '#059669' },
  completed:              { label: 'Completed',      bg: '#ECFDF5', color: '#059669' },
  invoiced:               { label: 'Invoiced',       bg: '#EFF6FF', color: '#1D6FE8' },
  closed:                 { label: 'Closed',         bg: '#F3F4F6', color: '#6B7280' },
}

export default function WorkOrdersPage() {
  const supabase = createClient()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)

  useEffect(() => {
    getCurrentUser(supabase).then(async (p) => {
      if (!p) { window.location.href = '/login'; return }
      const res = await fetch(`/api/work-orders?shop_id=${p.shop_id}&limit=200`)
      if (res.ok) setOrders(await res.json())
      setLoading(false)
    })
  }, [])

  const filtered = orders.filter(o => {
    if (statusFilter !== 'all') {
      if (statusFilter === 'open') { if (['good_to_go', 'completed', 'done', 'closed', 'invoiced', 'void'].includes(o.status)) return false }
      else if (statusFilter === 'completed') { if (!['good_to_go', 'completed', 'done'].includes(o.status)) return false }
      else if (statusFilter === 'closed') { if (!['closed', 'invoiced'].includes(o.status)) return false }
      else if (o.status !== statusFilter) return false
    }
    if (!search) return true
    const q = search.toLowerCase()
    return o.so_number?.toLowerCase().includes(q) || o.complaint?.toLowerCase().includes(q) || (o.customers as any)?.company_name?.toLowerCase().includes(q) || (o.assets as any)?.unit_number?.toLowerCase().includes(q)
  })

  const paginated = useMemo(() => {
    if (perPage === 0) return filtered
    const start = (page - 1) * perPage
    return filtered.slice(start, start + perPage)
  }, [filtered, page, perPage])

  return (
    <div style={{ minHeight: '100vh', background: '#F4F5F7', fontFamily: "'Instrument Sans', sans-serif", padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#1A1A1A' }}>Work Orders</div>
          <div style={{ fontSize: 13, color: '#6B7280' }}>{filtered.length} work order{filtered.length !== 1 ? 's' : ''}</div>
        </div>
        <a href="/work-orders/new" style={{ padding: '10px 20px', background: '#1D6FE8', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', fontFamily: 'inherit' }}>+ New Work Order</a>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {[['all', 'All'], ['open', 'Open'], ['in_progress', 'In Progress'], ['completed', 'Completed'], ['closed', 'Closed']].map(([v, l]) => (
          <button key={v} onClick={() => setStatusFilter(v)} style={{ padding: '6px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: statusFilter === v ? '1px solid #1D6FE8' : '1px solid #D1D5DB', background: statusFilter === v ? '#EFF6FF' : '#fff', color: statusFilter === v ? '#1D6FE8' : '#6B7280', fontFamily: 'inherit' }}>{l}</button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search WO #, customer, unit..." style={{ marginLeft: 8, padding: '7px 14px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, color: '#1A1A1A', fontFamily: 'inherit', outline: 'none', width: 240, background: '#fff' }} />
      </div>

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#9CA3AF' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#9CA3AF' }}>No work orders found</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                {['WO #', 'Customer', 'Unit', 'Concern', 'Status', 'Created', 'Assigned To', 'Total'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map(o => {
                const st = STATUS_MAP[o.status] || STATUS_MAP.draft
                return (
                  <tr key={o.id} style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }} onClick={() => window.location.href = `/work-orders/${o.id}`}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#1D6FE8' }}>{o.so_number || '—'} <SourceBadge source={o.source} /></td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>{(o.customers as any)?.company_name || '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: '#6B7280' }}>#{(o.assets as any)?.unit_number || '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: '#6B7280', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.complaint || '—'}</td>
                    <td style={{ padding: '12px 14px' }}><span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>{st.label}</span></td>
                    <td style={{ padding: '12px 14px', fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace' }}>{o.created_at ? new Date(o.created_at).toLocaleDateString() : '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: '#374151' }}>{(o.users as any)?.full_name || '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: '#1A1A1A' }}>{o.grand_total ? `$${Number(o.grand_total).toFixed(0)}` : '—'}</td>
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
