'use client'
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

const FONT = "'Instrument Sans', sans-serif"
const MONO = "'IBM Plex Mono', monospace"
const BLUE = '#1B6EE6'
const PAGE_BG = '#F4F5F7'

type SortField = 'part_number' | 'description' | 'uom' | 'on_hand' | 'allocated' | 'average_cost' | 'selling_price' | 'min_qty' | 'max_qty' | 'default_location' | 'preferred_vendor' | 'part_category' | 'status'
type SortDir = 'asc' | 'desc'
type SubTab = 'inventory' | 'vendors' | 'history' | 'purchase_orders'

export default function PartsPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [parts, setParts] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  // Sub tabs
  const [subTab, setSubTab] = useState<SubTab>('inventory')

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [vendorFilter, setVendorFilter] = useState('')

  // Distinct values for dropdowns
  const [categories, setCategories] = useState<string[]>([])
  const [vendors, setVendors] = useState<string[]>([])

  // Pagination
  const [page, setPage] = useState(1)
  const perPage = 25

  // Sorting
  const [sortField, setSortField] = useState<SortField>('part_number')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const searchTimer = useRef<ReturnType<typeof setTimeout>>()

  // Load user + initial data
  useEffect(() => {
    getCurrentUser(supabase).then(p => {
      if (!p) { window.location.href = '/login'; return }
      setUser(p)
    })
  }, [])

  // Fetch parts when filters change
  const fetchParts = useCallback(async () => {
    if (!user) return
    setLoading(true)
    let url = `/api/parts?per_page=${perPage}&page=${page}`
    if (search) url += `&search=${encodeURIComponent(search)}`
    if (statusFilter && statusFilter !== 'all') url += `&status=${statusFilter}`
    if (categoryFilter) url += `&category=${encodeURIComponent(categoryFilter)}`
    if (vendorFilter) url += `&vendor=${encodeURIComponent(vendorFilter)}`

    const res = await fetch(url)
    if (res.ok) {
      const json = await res.json()
      if (Array.isArray(json)) {
        setParts(json); setTotal(json.length)
      } else {
        setParts(json.data || []); setTotal(json.total || 0)
      }
    }
    setLoading(false)
  }, [user, page, statusFilter, categoryFilter, vendorFilter, search])

  useEffect(() => { fetchParts() }, [fetchParts])

  // Load distinct categories and vendors once
  useEffect(() => {
    if (!user) return
    fetch('/api/parts?per_page=2000&status=all').then(r => r.json()).then(json => {
      const list = Array.isArray(json) ? json : (json.data || [])
      const cats = new Set<string>()
      const vends = new Set<string>()
      list.forEach((p: any) => {
        const cat = p.part_category || p.category
        if (cat) cats.add(cat)
        const v = p.preferred_vendor || p.vendor
        if (v) vends.add(v)
      })
      setCategories(Array.from(cats).sort())
      setVendors(Array.from(vends).sort())
    })
  }, [user])

  // Sort client-side
  const sorted = useMemo(() => {
    const arr = [...parts]
    arr.sort((a, b) => {
      let av = a[sortField] ?? ''
      let bv = b[sortField] ?? ''
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av
      av = String(av).toLowerCase(); bv = String(bv).toLowerCase()
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }, [parts, sortField, sortDir])

  const totalPages = Math.ceil(total / perPage) || 1

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  function handleSearch(val: string) {
    setSearch(val)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setPage(1), 300)
  }

  const fmt = (n: number | null | undefined) => n != null ? '$' + Number(n).toFixed(2) : '--'
  const fmtQty = (n: number | null | undefined) => n != null ? Number(n).toFixed(2) : '--'

  function getPartCategory(p: any) { return p.part_category || p.category || '--' }
  function getVendor(p: any) { return p.preferred_vendor || p.vendor || '--' }
  function getAvgCost(p: any) { return p.average_cost ?? p.cost_price ?? null }
  function getSellingPrice(p: any) { return p.selling_price ?? p.sell_price ?? null }
  function getOnHand(p: any) { return p.on_hand ?? 0 }
  function getAllocated(p: any) { return p.allocated ?? p.reserved_qty ?? 0 }
  function getLocation(p: any) { return p.default_location || p.bin_location || '--' }
  function getStatus(p: any) { return p.status || 'active' }

  const SUB_TABS: { key: SubTab; label: string }[] = [
    { key: 'inventory', label: 'Inventory' },
    { key: 'vendors', label: 'Vendors' },
    { key: 'history', label: 'Part History' },
    { key: 'purchase_orders', label: 'Purchase Orders' },
  ]

  const COLUMNS: { key: SortField; label: string; mono?: boolean; align?: string; width?: number }[] = [
    { key: 'part_number', label: 'Part #', mono: true, width: 120 },
    { key: 'description', label: 'Description', width: 200 },
    { key: 'uom', label: 'UOM', width: 60 },
    { key: 'on_hand', label: 'In Stock', align: 'right', width: 80 },
    { key: 'allocated', label: 'Allocated', align: 'right', width: 80 },
    { key: 'average_cost', label: 'Avg Cost', align: 'right', width: 90 },
    { key: 'selling_price', label: 'Selling Price', align: 'right', width: 100 },
    { key: 'min_qty', label: 'Min Qty', align: 'right', width: 70 },
    { key: 'max_qty', label: 'Max Qty', align: 'right', width: 70 },
    { key: 'default_location', label: 'Location', width: 90 },
    { key: 'preferred_vendor', label: 'Vendor', width: 120 },
    { key: 'part_category', label: 'Category', width: 100 },
    { key: 'status', label: 'Status', width: 90 },
  ]

  return (
    <div style={{ minHeight: '100vh', background: PAGE_BG, fontFamily: FONT, padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#1A1A1A' }}>Parts</div>
          <div style={{ fontSize: 13, color: '#6B7280' }}>{total.toLocaleString()} part{total !== 1 ? 's' : ''}</div>
        </div>
        <a href="/parts/new" style={{ padding: '10px 20px', background: BLUE, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', fontFamily: 'inherit', cursor: 'pointer' }}>+ Add Part</a>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #E5E7EB', marginBottom: 16 }}>
        {SUB_TABS.map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)} style={{
            padding: '10px 18px', background: 'none', border: 'none',
            borderBottom: subTab === t.key ? `2px solid ${BLUE}` : '2px solid transparent',
            color: subTab === t.key ? BLUE : '#9CA3AF',
            fontWeight: subTab === t.key ? 700 : 500, fontSize: 13, cursor: 'pointer',
            fontFamily: 'inherit', marginBottom: -2,
          }}>{t.label}</button>
        ))}
      </div>

      {/* Coming Soon for other tabs */}
      {subTab !== 'inventory' && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 64, textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>{SUB_TABS.find(t => t.key === subTab)?.label}</div>
          <div style={{ fontSize: 14, color: '#9CA3AF' }}>Coming Soon</div>
        </div>
      )}

      {/* Inventory tab */}
      {subTab === 'inventory' && (
        <>
          {/* Filters bar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 320 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                value={search}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search part #, description..."
                style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 12, color: '#1A1A1A', fontFamily: 'inherit', outline: 'none', background: '#fff', boxSizing: 'border-box' }}
              />
            </div>

            {/* Status dropdown */}
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
              style={dropdownStyle}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All Status</option>
            </select>

            {/* Category dropdown */}
            <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1) }}
              style={dropdownStyle}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* Vendor dropdown */}
            <select value={vendorFilter} onChange={e => { setVendorFilter(e.target.value); setPage(1) }}
              style={dropdownStyle}>
              <option value="">All Vendors</option>
              {vendors.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          {/* Table */}
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: 48, textAlign: 'center', color: '#9CA3AF' }}>Loading...</div>
            ) : sorted.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No parts found</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                      {COLUMNS.map(col => (
                        <th key={col.key} onClick={() => handleSort(col.key)} style={{
                          padding: '8px 10px', textAlign: (col.align as any) || 'left', fontSize: 10, fontWeight: 600,
                          color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em', cursor: 'pointer',
                          whiteSpace: 'nowrap', userSelect: 'none', minWidth: col.width,
                        }}>
                          {col.label}
                          {sortField === col.key && <span style={{ marginLeft: 4, fontSize: 8 }}>{sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(p => {
                      const onHand = getOnHand(p)
                      const partStatus = getStatus(p)
                      return (
                        <tr key={p.id}
                          onClick={() => window.location.href = `/parts/${p.id}`}
                          style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}>
                          {/* Part # */}
                          <td style={{ padding: '10px 10px', fontFamily: MONO, fontSize: 12, fontWeight: 700, color: BLUE, whiteSpace: 'nowrap' }}>
                            {p.part_number || '--'}
                          </td>
                          {/* Description */}
                          <td style={{ padding: '10px 10px', fontSize: 12, fontWeight: 500, color: '#1A1A1A', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.description ? (p.description.length > 40 ? p.description.slice(0, 40) + '...' : p.description) : '--'}
                          </td>
                          {/* UOM */}
                          <td style={{ padding: '10px 10px', fontSize: 11, color: '#6B7280' }}>{p.uom || '--'}</td>
                          {/* In Stock */}
                          <td style={{ padding: '10px 10px', fontFamily: MONO, fontSize: 12, fontWeight: 700, textAlign: 'right', color: onHand > 0 ? BLUE : '#9CA3AF' }}>
                            {fmtQty(onHand)}
                          </td>
                          {/* Allocated */}
                          <td style={{ padding: '10px 10px', fontFamily: MONO, fontSize: 11, textAlign: 'right', color: '#6B7280' }}>
                            {fmtQty(getAllocated(p))}
                          </td>
                          {/* Avg Cost */}
                          <td style={{ padding: '10px 10px', fontFamily: MONO, fontSize: 11, textAlign: 'right', color: '#6B7280' }}>
                            {fmt(getAvgCost(p))}
                          </td>
                          {/* Selling Price */}
                          <td style={{ padding: '10px 10px', fontFamily: MONO, fontSize: 11, textAlign: 'right', color: '#1A1A1A', fontWeight: 600 }}>
                            {fmt(getSellingPrice(p))}
                          </td>
                          {/* Min Qty */}
                          <td style={{ padding: '10px 10px', fontFamily: MONO, fontSize: 11, textAlign: 'right', color: '#6B7280' }}>
                            {fmtQty(p.min_qty)}
                          </td>
                          {/* Max Qty */}
                          <td style={{ padding: '10px 10px', fontFamily: MONO, fontSize: 11, textAlign: 'right', color: '#6B7280' }}>
                            {fmtQty(p.max_qty)}
                          </td>
                          {/* Location */}
                          <td style={{ padding: '10px 10px', fontSize: 11, color: '#6B7280' }}>{getLocation(p)}</td>
                          {/* Vendor */}
                          <td style={{ padding: '10px 10px', fontSize: 11, color: '#6B7280', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getVendor(p)}</td>
                          {/* Category */}
                          <td style={{ padding: '10px 10px', fontSize: 11, color: '#6B7280' }}>{getPartCategory(p)}</td>
                          {/* Status */}
                          <td style={{ padding: '10px 10px' }}>
                            <span style={{
                              display: 'inline-block', padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 600,
                              background: partStatus === 'active' ? '#F0FDF4' : '#F3F4F6',
                              color: partStatus === 'active' ? '#16A34A' : '#9CA3AF',
                            }}>
                              {partStatus === 'active' ? 'Active' : 'Inactive'}
                            </span>
                          </td>
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
                style={paginationBtn(page <= 1)}>Previous</button>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Page {page} of {totalPages.toLocaleString()}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                style={paginationBtn(page >= totalPages)}>Next</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const dropdownStyle: React.CSSProperties = {
  padding: '7px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 12,
  color: '#374151', fontFamily: "'Instrument Sans', sans-serif", outline: 'none',
  background: '#fff', cursor: 'pointer', minWidth: 120,
}

const paginationBtn = (disabled: boolean): React.CSSProperties => ({
  padding: '6px 14px', borderRadius: 6, border: '1px solid #D1D5DB',
  background: disabled ? '#F3F4F6' : '#fff', color: disabled ? '#9CA3AF' : '#374151',
  fontSize: 12, fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
  fontFamily: "'Instrument Sans', sans-serif",
})
