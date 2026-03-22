/**
 * TruckZen — Original Design
 * Built independently by TruckZen development team
 */
'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { PageFooter } from '@/components/ui/PageControls'

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
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { window.location.href = '/login'; return }
      let q = supabase.from('invoices')
        .select('id, invoice_number, status, subtotal, tax_amount, total, balance_due, amount_paid, due_date, paid_at, created_at, so_id, customers(company_name), service_orders(so_number, is_historical, source, assets(unit_number))')
        .eq('shop_id', profile.shop_id)
        .order('created_at', { ascending: false })
      if (filter !== 'all') q = q.eq('status', filter)
      const { data } = await q.limit(500)
      setInvoices(data || [])
      setLoading(false)
    }
    load()
  }, [filter])

  const filtered = useMemo(() => {
    if (!search) return invoices
    const q = search.toLowerCase()
    return invoices.filter(inv => {
      const cust = inv.customers as any
      const so = inv.service_orders as any
      return inv.invoice_number?.toLowerCase().includes(q) ||
        cust?.company_name?.toLowerCase().includes(q) ||
        so?.so_number?.toLowerCase().includes(q) ||
        so?.assets?.unit_number?.toLowerCase().includes(q)
    })
  }, [invoices, search])

  const paginated = useMemo(() => {
    if (perPage === 0) return filtered
    const start = (page - 1) * perPage
    return filtered.slice(start, start + perPage)
  }, [filtered, page, perPage])

  const totalOutstanding = invoices.filter(i => i.status === 'sent').reduce((s, i) => s + (i.balance_due || 0), 0)
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0)
  const fmt = (n: number) => '$' + (n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  return (
    <div style={{ background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: "'Instrument Sans',sans-serif", padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF' }}>Invoices</div>
          <div style={{ fontSize: 12, color: '#7C8BA0' }}>
            {filtered.length} invoices · Outstanding: {fmt(totalOutstanding)} · Paid: {fmt(totalPaid)}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {['all', 'draft', 'sent', 'paid', 'overdue'].map(s => (
          <button key={s} onClick={() => { setFilter(s); setPage(1) }} style={{
            padding: '5px 12px', borderRadius: 100, fontSize: 10, fontWeight: 600, cursor: 'pointer',
            border: '1px solid rgba(255,255,255,.08)',
            background: filter === s ? 'rgba(29,111,232,.1)' : '#1C2130',
            color: filter === s ? '#4D9EFF' : '#7C8BA0', fontFamily: 'inherit',
          }}>
            {s === 'all' ? 'All' : STATUS_CFG[s]?.label || s}
          </button>
        ))}
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search invoice #, customer, WO..." style={{
          marginLeft: 6, padding: '6px 12px', background: 'rgba(255,255,255,.06)',
          border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 12,
          color: '#DDE3EE', outline: 'none', fontFamily: 'inherit', width: 220,
        }} />
      </div>

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
              ) : paginated.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#7C8BA0' }}>No invoices found</td></tr>
              ) : paginated.map(inv => {
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
      <PageFooter total={filtered.length} page={page} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage} />
    </div>
  )
}
