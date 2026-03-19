'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

export default function CustomersPage() {
  const supabase = createClient()
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(50)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [shopId, setShopId] = useState('')

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setSearchDebounced(search); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const loadCustomers = useCallback(async (sid: string, p: number, pp: number, q: string) => {
    setLoading(true)
    const params = new URLSearchParams({ shop_id: sid, page: String(p), per_page: String(pp) })
    if (q) params.set('q', q)
    const res = await fetch(`/api/customers?${params}`)
    if (!res.ok) { setError('Failed to load customers'); setLoading(false); return }
    const data = await res.json()
    setCustomers(data.data || [])
    setTotal(data.total || 0)
    setTotalPages(data.total_pages || 0)
    setLoading(false)
  }, [])

  useEffect(() => {
    getCurrentUser(supabase).then((p: any) => {
      if (!p) { window.location.href = '/login'; return }
      setShopId(p.shop_id)
      loadCustomers(p.shop_id, 1, perPage, '')
    })
  }, [])

  // Reload on page/search/perPage change
  useEffect(() => {
    if (!shopId) return
    loadCustomers(shopId, page, perPage, searchDebounced)
  }, [page, perPage, searchDebounced, shopId])

  const from = (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={S.title}>Customers</div>
          <div style={{ fontSize: 12, color: '#7C8BA0' }}>{total.toLocaleString()} companies</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone, email..."
            style={{ padding: '7px 12px', background: '#1C2130', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, color: '#DDE3EE', fontSize: 11, fontFamily: 'inherit', outline: 'none', width: 220 }} />
          <button onClick={() => window.location.href = '/customers/new'}
            style={{ padding: '7px 14px', background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Add Customer
          </button>
        </div>
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, color: '#EF4444' }}>{error}</div>}

      <div style={{ background: '#161B24', border: '1px solid rgba(255,255,255,.055)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead><tr>{['Company', 'Contact', 'Phone', 'Email', 'Address', 'Visits', 'Spent'].map(h =>
              <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', color: '#7C8BA0', padding: 40 }}>Loading...</td></tr>
              : customers.length === 0 ? <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', color: '#7C8BA0', padding: 40 }}>{search ? 'No customers match your search' : 'No customers found'}</td></tr>
              : customers.map(c => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => window.location.href = `/customers/${c.id}`}>
                  <td style={{ ...S.td, fontWeight: 700, color: '#F0F4FF' }}>{c.company_name || 'Unnamed'}</td>
                  <td style={{ ...S.td, color: '#DDE3EE' }}>{c.contact_name || '—'}</td>
                  <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 11, color: '#7C8BA0' }}>{c.phone || '—'}</td>
                  <td style={{ ...S.td, fontSize: 11, color: '#7C8BA0' }}>{c.email || '—'}</td>
                  <td style={{ ...S.td, fontSize: 11, color: '#48536A', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.address || '—'}</td>
                  <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 11, color: '#4D9EFF', textAlign: 'center' }}>{c.visit_count || 0}</td>
                  <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 11, color: '#DDE3EE' }}>{c.total_spent ? `$${Number(c.total_spent).toLocaleString()}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,.04)', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 11, color: '#7C8BA0' }}>
              Showing {from}–{to} of {total.toLocaleString()}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: '#48536A' }}>Per page:</span>
              {[25, 50, 100, 250].map(n => (
                <button key={n} onClick={() => { setPerPage(n); setPage(1) }}
                  style={{ padding: '3px 8px', borderRadius: 4, border: perPage === n ? '1px solid rgba(29,111,232,.3)' : '1px solid rgba(255,255,255,.06)', background: perPage === n ? 'rgba(29,111,232,.1)' : 'transparent', color: perPage === n ? '#4D9EFF' : '#48536A', fontSize: 10, cursor: 'pointer' }}>
                  {n}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid rgba(255,255,255,.06)', background: 'transparent', color: page <= 1 ? '#2A2D35' : '#7C8BA0', fontSize: 11, cursor: page <= 1 ? 'default' : 'pointer' }}>
                ← Prev
              </button>
              <span style={{ padding: '4px 10px', fontSize: 11, color: '#7C8BA0' }}>
                Page {page} of {totalPages}
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid rgba(255,255,255,.06)', background: 'transparent', color: page >= totalPages ? '#2A2D35' : '#7C8BA0', fontSize: 11, cursor: page >= totalPages ? 'default' : 'pointer' }}>
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: { background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: "'Instrument Sans',sans-serif", padding: 24 },
  title: { fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF', marginBottom: 4 },
  th: { fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: '#48536A', textTransform: 'uppercase' as const, letterSpacing: '.1em', padding: '7px 12px', textAlign: 'left' as const, background: '#0B0D11', whiteSpace: 'nowrap' as const },
  td: { padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,.025)', fontSize: 12 },
}
