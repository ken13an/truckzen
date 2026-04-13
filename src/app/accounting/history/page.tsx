'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { PageFooter } from '@/components/ui/PageControls'
import FilterBar from '@/components/FilterBar'
import { getWorkorderRoute } from '@/lib/navigation/workorder-route'
import AppPageShell from '@/components/layout/AppPageShell'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const BLUE = '#1B6EE6', GREEN = '#1DB870', AMBER = '#D4882A', MUTED = '#7C8BA0'

export default function ImportedHistoryPage() {
  const { tokens: t } = useTheme()
  const supabase = createClient()
  const [records, setRecords] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  async function fetchData(p: number) {
    setLoading(true)
    // Historical records live in service_orders with is_historical=true
    let url = `/api/work-orders?page=${p}&limit=${perPage}&historical=true`
    if (search) url += `&search=${encodeURIComponent(search)}`
    if (dateFrom) url += `&date_from=${dateFrom}`
    if (dateTo) url += `&date_to=${dateTo}`
    const res = await fetch(url)
    if (res.ok) {
      const json = await res.json()
      setRecords(json.data || [])
      setTotal(json.total || 0)
    }
    setLoading(false)
  }

  useEffect(() => {
    getCurrentUser(supabase).then((p: any) => {
      if (!p) { window.location.href = '/login'; return }
      fetchData(1)
    })
  }, [])

  useEffect(() => { fetchData(page) }, [page, perPage, dateFrom, dateTo])
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchData(1) }, 400)
    return () => clearTimeout(t)
  }, [search])

  const fmt = (n: number) => '$' + (n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return d } }

  const statusColor = (s: string) => s === 'paid' || s === 'closed' ? GREEN : s === 'sent' ? BLUE : s === 'in_progress' ? AMBER : MUTED

  if (loading && records.length === 0) return (
    <AppPageShell width="wide" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
      <div style={{ color: 'var(--tz-textSecondary)' }}>Loading...</div>
    </AppPageShell>
  )

  return (
    <AppPageShell width="wide" style={{ fontFamily: FONT }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: 'var(--tz-text)' }}>Imported History</div>
        <div style={{ fontSize: 12, color: 'var(--tz-textSecondary)' }}>{total.toLocaleString()} imported work orders &mdash; read-only</div>
      </div>

      <div style={{ background: 'rgba(139,92,246,.06)', border: '1px solid rgba(139,92,246,.2)', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 12, color: '#A78BFA', fontWeight: 600 }}>
        These are imported historical records. They are read-only.
      </div>

      <FilterBar
        search={search}
        onSearchChange={val => setSearch(val)}
        searchPlaceholder="Search WO #, customer, unit..."
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={val => { setDateFrom(val); setPage(1) }}
        onDateToChange={val => { setDateTo(val); setPage(1) }}
        theme="dark"
      />

      {records.length === 0 && !loading && (
        <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, padding: 40, textAlign: 'center', color: 'var(--tz-textTertiary)', fontSize: 13 }}>
          {search || dateFrom || dateTo ? 'No results found. Try adjusting your filters.' : 'No imported records found.'}
        </div>
      )}

      {records.length > 0 && (
        <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${'var(--tz-border)'}` }}>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: 'var(--tz-textTertiary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>WO #</th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: 'var(--tz-textTertiary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Customer</th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: 'var(--tz-textTertiary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Unit</th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: 'var(--tz-textTertiary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Complaint</th>
                <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: 'var(--tz-textTertiary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Total</th>
                <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: 'var(--tz-textTertiary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Date</th>
                <th style={{ textAlign: 'center', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: 'var(--tz-textTertiary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Source</th>
                <th style={{ textAlign: 'center', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: 'var(--tz-textTertiary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((wo: any) => {
                const cust = wo.customers as any
                const asset = wo.assets as any
                const src = wo.source || 'imported'
                const srcLabel = src === 'csv_import' ? 'CSV' : 'Imported'
                const st = wo.invoice_status || wo.status || '—'
                return (
                  <tr key={wo.id} style={{ borderBottom: `1px solid ${'var(--tz-border)'}`, cursor: 'pointer' }}
                    onClick={() => window.location.href = getWorkorderRoute(wo.id, undefined, 'accounting-history')}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--tz-border)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={{ padding: '10px 14px', fontFamily: MONO, fontWeight: 700, color: BLUE }}>{wo.so_number || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>{cust?.company_name || '—'}</td>
                    <td style={{ padding: '10px 14px', color: MUTED }}>
                      {asset?.unit_number ? `#${asset.unit_number}` : '—'}
                      {asset?.make ? ` ${asset.make}` : ''}
                    </td>
                    <td style={{ padding: '10px 14px', color: MUTED, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wo.complaint || '—'}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: MONO, fontWeight: 700 }}>{fmt(wo.grand_total || 0)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: MUTED }}>{wo.created_at ? fmtDate(wo.created_at) : '—'}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(139,92,246,.1)', color: '#A78BFA', textTransform: 'uppercase', fontFamily: MONO }}>{srcLabel}</span>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: `${statusColor(st)}18`, color: statusColor(st), textTransform: 'uppercase' }}>{st.replace(/_/g, ' ')}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <PageFooter total={total} page={page} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage} />
    </AppPageShell>
  )
}
