/**
 * TruckZen — Original Design
 * Built independently by TruckZen development team
 */
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { PageFooter } from '@/components/ui/PageControls'
import FilterBar from '@/components/FilterBar'

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  draft:   { label: 'Draft',   color: '#7C8BA0' },
  sent:    { label: 'Pending', color: '#D4882A' },
  paid:    { label: 'Paid',    color: '#1DB870' },
  overdue: { label: 'Overdue', color: '#D94F4F' },
  voided:  { label: 'Voided',  color: '#48536A' },
}

export default function InvoicesPage() {
  const supabase = createClient()
  const [invoices, setInvoices] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  async function fetchInvoices(p: number) {
    setLoading(true)
    let url = `/api/invoices?page=${p}&per_page=${perPage}&historical=false`
    if (filter !== 'all') url += `&status=${filter}`
    if (search) url += `&q=${encodeURIComponent(search)}`
    if (dateFrom) url += `&date_from=${dateFrom}`
    if (dateTo) url += `&date_to=${dateTo}`
    const res = await fetch(url)
    if (res.ok) {
      const json = await res.json()
      if (Array.isArray(json)) {
        setInvoices(json); setTotal(json.length)
      } else {
        setInvoices(json.data || []); setTotal(json.total || 0)
        if (json.summary) setSummary(json.summary)
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    getCurrentUser(supabase).then((profile: any) => {
      if (!profile) { window.location.href = '/login'; return }
      fetchInvoices(1)
    })
  }, [])

  useEffect(() => { fetchInvoices(page) }, [page, filter, dateFrom, dateTo, perPage])

  // Debounced search
  useEffect(() => {
    if (searchTimer) clearTimeout(searchTimer)
    const t = setTimeout(() => { setPage(1); fetchInvoices(1) }, 400)
    setSearchTimer(t)
    return () => clearTimeout(t)
  }, [search])

  const fmt = (n: number) => '$' + (n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  return (
    <div style={{ background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: "'Instrument Sans',sans-serif", padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF' }}>Sent Invoices</div>
          <div style={{ fontSize: 12, color: '#7C8BA0' }}>
            {total.toLocaleString()} invoices{summary.sent ? ` · ${summary.sent} pending payment` : ''}{summary.paid ? ` · ${summary.paid} paid` : ''}
          </div>
        </div>
        <a href="/accounting" style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(217,119,6,.08)', border: '1px solid rgba(217,119,6,.2)', color: '#D97706', fontSize: 12, fontWeight: 700, textDecoration: 'none', fontFamily: 'inherit' }}>
          ← Review Queue
        </a>
      </div>

      <FilterBar
        search={search}
        onSearchChange={val => { setSearch(val); setPage(1) }}
        searchPlaceholder="Search invoice #, customer, WO..."
        statusOptions={[
          { value: 'all', label: 'All Statuses' },
          { value: 'draft', label: 'Draft' },
          { value: 'sent', label: 'Pending' },
          { value: 'paid', label: 'Paid' },
          { value: 'overdue', label: 'Overdue' },
        ]}
        statusValue={filter}
        onStatusChange={val => { setFilter(val); setPage(1) }}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={val => { setDateFrom(val); setPage(1) }}
        onDateToChange={val => { setDateTo(val); setPage(1) }}
        theme="dark"
      />

      <div style={{ background: '#161B24', border: '1px solid rgba(255,255,255,.055)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead><tr>
              {['Invoice #', 'Customer', 'WO / Unit', 'Total', 'Balance', 'Date', 'Status'].map(h =>
                <th key={h} style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.1em', padding: '7px 10px', textAlign: 'left', background: '#0B0D11', whiteSpace: 'nowrap' }}>{h}</th>
              )}
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#7C8BA0' }}>Loading...</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#7C8BA0' }}>{search || filter !== 'all' || dateFrom || dateTo ? 'No results found. Try adjusting your filters.' : 'No invoices found'}</td></tr>
              ) : invoices.map(inv => {
                const cust = inv.customers as any
                const so = inv.service_orders as any
                const cfg = STATUS_CFG[inv.status] || { label: inv.status, color: '#7C8BA0' }
                const isOverdue = inv.status === 'sent' && inv.due_date && inv.due_date < new Date().toISOString().split('T')[0]
                const isHistorical = so?.is_historical
                return (
                  <tr key={inv.id} style={{ borderBottom: '1px solid rgba(255,255,255,.025)', cursor: 'pointer', opacity: isHistorical ? 0.75 : 1 }} onClick={() => window.location.href = '/invoices/' + inv.id}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.03)')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={{ padding: '9px 10px', fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: '#4D9EFF', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {inv.invoice_number || '—'}
                      {isHistorical && <span style={{ marginLeft: 4, padding: '1px 5px', borderRadius: 3, background: 'rgba(124,139,160,0.1)', color: '#7C8BA0', fontSize: 8, fontWeight: 600, textTransform: 'uppercase' }}>Historical</span>}
                    </td>
                    <td style={{ padding: '9px 10px', color: '#F0F4FF', fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cust?.company_name || '—'}</td>
                    <td style={{ padding: '9px 10px', fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: '#7C8BA0' }}>
                      {so?.so_number || '—'}{so?.assets?.unit_number ? ` · #${so.assets.unit_number}` : ''}
                    </td>
                    <td style={{ padding: '9px 10px', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: '#DDE3EE', fontWeight: 700 }}>{fmt(inv.total)}</td>
                    <td style={{ padding: '9px 10px', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: inv.balance_due > 0 ? '#4D9EFF' : '#1DB870', fontWeight: 700 }}>{fmt(inv.balance_due || 0)}</td>
                    <td style={{ padding: '9px 10px', fontSize: 10, color: '#48536A', fontFamily: "'IBM Plex Mono',monospace" }}>{inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '—'}</td>
                    <td style={{ padding: '9px 10px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 100, fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, background: (isOverdue ? '#D94F4F' : cfg.color) + '18', color: isOverdue ? '#D94F4F' : cfg.color, border: '1px solid ' + (isOverdue ? '#D94F4F' : cfg.color) + '33' }}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor' }} />{isOverdue ? 'Overdue' : cfg.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <PageFooter total={total} page={page} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage} />
    </div>
  )
}
