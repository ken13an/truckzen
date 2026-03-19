'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { Loader2, Plus, ChevronLeft, ChevronRight } from 'lucide-react'

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
    setCustomers(data.data ?? [])
    setTotal(data.total ?? 0)
    setTotalPages(data.total_pages ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => {
    getCurrentUser(supabase).then((p: any) => {
      if (!p) { window.location.href = '/login'; return }
      setShopId(p.shop_id)
      loadCustomers(p.shop_id, 1, perPage, '')
    })
  }, [])

  useEffect(() => {
    if (!shopId) return
    loadCustomers(shopId, page, perPage, searchDebounced)
  }, [page, perPage, searchDebounced, shopId])

  const from = (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)

  return (
    <div className="bg-bg min-h-screen text-text-primary p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Customers</h1>
          <p className="text-sm text-text-secondary">{total.toLocaleString()} companies</p>
        </div>
        <div className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone, email..."
            className="px-3 py-2 bg-surface-2 border border-brand-border rounded-md text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-teal transition-colors duration-150 w-56" />
          <a href="/customers/new" className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal text-bg rounded-md text-sm font-bold hover:bg-teal-hover transition-colors duration-150 no-underline">
            <Plus size={14} strokeWidth={2} /> Add Customer
          </a>
        </div>
      </div>

      {error && <div className="px-3 py-2.5 bg-error/10 border border-error/20 rounded-md text-xs text-error mb-4">{error}</div>}

      <div className="bg-surface border border-brand-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead><tr className="bg-surface-2">
              {['Company', 'Contact', 'Phone', 'Email', 'Address', 'Visits', 'Spent'].map(h =>
                <th key={h} className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest font-mono px-3 py-2 text-left whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="text-center text-text-secondary py-12 text-sm">Loading...</td></tr>
              : customers.length === 0 ? <tr><td colSpan={7} className="text-center text-text-secondary py-12 text-sm">{search ? 'No customers match your search' : 'No customers found'}</td></tr>
              : customers.map(c => (
                <tr key={c.id} className="border-b border-brand-border/50 hover:bg-surface-2 cursor-pointer transition-colors duration-150" onClick={() => window.location.href = `/customers/${c.id}`}>
                  <td className="px-3 py-2.5 text-sm font-semibold text-text-primary">{c.company_name ?? 'Unnamed'}</td>
                  <td className="px-3 py-2.5 text-sm text-text-secondary">{c.contact_name ?? '—'}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-text-secondary">{c.phone ?? '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-text-tertiary">{c.email ?? '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-text-tertiary max-w-[180px] truncate">{c.address ?? '—'}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-teal text-center">{c.visit_count ?? 0}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-text-primary">{c.total_spent ? `$${Number(c.total_spent).toLocaleString()}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <div className="flex justify-between items-center px-4 py-2.5 border-t border-brand-border flex-wrap gap-2">
            <span className="text-xs text-text-tertiary">Showing {from}–{to} of {total.toLocaleString()}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-text-tertiary">Per page:</span>
              {[25, 50, 100, 250].map(n => (
                <button key={n} onClick={() => { setPerPage(n); setPage(1) }}
                  className={`px-2 py-0.5 rounded-sm text-[10px] font-semibold transition-colors ${perPage === n ? 'bg-teal/10 text-teal border border-teal/30' : 'text-text-tertiary border border-brand-border hover:text-text-secondary'}`}>
                  {n}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-sm text-xs border border-brand-border transition-colors ${page <= 1 ? 'text-brand-border cursor-default' : 'text-text-secondary hover:text-text-primary cursor-pointer'}`}>
                <ChevronLeft size={12} /> Prev
              </button>
              <span className="px-2.5 py-1 text-xs text-text-tertiary">Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-sm text-xs border border-brand-border transition-colors ${page >= totalPages ? 'text-brand-border cursor-default' : 'text-text-secondary hover:text-text-primary cursor-pointer'}`}>
                Next <ChevronRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
