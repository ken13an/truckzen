'use client'
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { useEmployeePermission } from '@/hooks/useEmployeePermission'
import FilterBar from '@/components/FilterBar'

const FONT = "'Instrument Sans', sans-serif"
const MONO = "'IBM Plex Mono', monospace"
const BLUE = '#1B6EE6'
const PAGE_BG = '#F4F5F7'

type SortField = 'part_number' | 'description' | 'uom' | 'on_hand' | 'allocated' | 'average_cost' | 'price_ugl_company' | 'price_ugl_owner_operator' | 'price_outside' | 'min_qty' | 'max_qty' | 'default_location' | 'preferred_vendor' | 'part_category' | 'status'
type SortDir = 'asc' | 'desc'
type SubTab = 'inventory' | 'reorder' | 'vendors' | 'history' | 'purchase_orders'

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
  const [stockFilter, setStockFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [vendorFilter, setVendorFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Distinct values for dropdowns
  const [categories, setCategories] = useState<string[]>([])
  const [vendors, setVendors] = useState<string[]>([])

  // Pagination
  const [page, setPage] = useState(1)
  const perPage = 50

  // Reorder tab state
  const [reorderParts, setReorderParts] = useState<any[]>([])
  const [reorderTotal, setReorderTotal] = useState(0)
  const [reorderPage, setReorderPage] = useState(1)
  const [reorderLoading, setReorderLoading] = useState(false)
  const [selectedReorder, setSelectedReorder] = useState<Set<string>>(new Set())
  const [creatingPO, setCreatingPO] = useState(false)
  const [poDone, setPoDone] = useState<any>(null)

  // Vendors tab state
  const [vendorList, setVendorList] = useState<any[]>([])
  const [vendorLoading, setVendorLoading] = useState(false)
  const [vendorSearch, setVendorSearch] = useState('')

  // Part History tab state
  const [historyData, setHistoryData] = useState<any[]>([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historySearch, setHistorySearch] = useState('')

  // Purchase Orders tab state
  const [poData, setPoData] = useState<any[]>([])
  const [poTotal, setPoTotal] = useState(0)
  const [poPage, setPoPage] = useState(1)
  const [poLoading, setPoLoading] = useState(false)

  // Sorting
  const [sortField, setSortField] = useState<SortField>('part_number')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const canViewCostPrice = useEmployeePermission('parts.view_cost_price')
  const canViewVendorInfo = useEmployeePermission('parts.view_vendor_info')

  const searchTimer = useRef<ReturnType<typeof setTimeout>>()

  // Load user
  useEffect(() => {
    getCurrentUser(supabase).then(p => {
      if (!p) { window.location.href = '/login'; return }
      setUser(p)
    })
  }, [])

  // Fetch parts via API route (service role key — bypasses RLS)
  const fetchParts = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        shop_id: user.shop_id,
        page: String(page),
        per_page: String(perPage),
      })
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      if (categoryFilter) params.set('category', categoryFilter)
      if (vendorFilter) params.set('vendor', vendorFilter)
      if (search) params.set('search', search)

      const res = await fetch(`/api/parts?${params}`)
      if (res.ok) {
        const json = await res.json()
        setParts(json.data || [])
        setTotal(json.total || 0)
      }
    } catch (err) {
      console.error('Failed to fetch parts:', err)
    }
    setLoading(false)
  }, [user, page, statusFilter, categoryFilter, vendorFilter, search])

  useEffect(() => { if (subTab === 'inventory') fetchParts() }, [fetchParts, subTab])

  // Fetch reorder parts via API route
  const fetchReorder = useCallback(async () => {
    if (!user) return
    setReorderLoading(true)
    try {
      const res = await fetch(`/api/parts?shop_id=${user.shop_id}&low_stock=true&per_page=2000&page=${reorderPage}`)
      if (res.ok) {
        const json = await res.json()
        setReorderParts(json.data || [])
        setReorderTotal(json.total || 0)
      }
    } catch (err) {
      console.error('Failed to fetch reorder parts:', err)
    }
    setReorderLoading(false)
  }, [user, reorderPage])

  useEffect(() => { if (subTab === 'reorder') fetchReorder() }, [fetchReorder, subTab])

  // Load distinct categories and vendors via API route
  useEffect(() => {
    if (!user) return
    fetch(`/api/parts?shop_id=${user.shop_id}&per_page=2000&status=all`)
      .then(r => r.json())
      .then((json: any) => {
        const cats = new Set<string>()
        const vends = new Set<string>()
        ;(json.data ?? []).forEach((p: any) => {
          const cat = p.part_category || p.category
          if (cat) cats.add(cat)
          const v = p.preferred_vendor || p.vendor
          if (v) vends.add(v)
        })
        setCategories(Array.from(cats).sort())
        setVendors(Array.from(vends).sort())
      })
      .catch(() => {})
  }, [user])

  // Fetch vendors list via API route
  const fetchVendors = useCallback(async () => {
    if (!user) return
    setVendorLoading(true)
    try {
      const res = await fetch(`/api/vendors?shop_id=${user.shop_id}`)
      if (res.ok) setVendorList(await res.json())
    } catch {}
    setVendorLoading(false)
  }, [user])

  useEffect(() => { if (subTab === 'vendors') fetchVendors() }, [fetchVendors, subTab])

  // Fetch part history via API route
  const fetchHistory = useCallback(async () => {
    if (!user) return
    setHistoryLoading(true)
    try {
      const params = new URLSearchParams({ shop_id: user.shop_id, page: String(historyPage), per_page: '50' })
      if (historySearch) params.set('search', historySearch)
      const res = await fetch(`/api/part-history?${params}`)
      if (res.ok) { const json = await res.json(); setHistoryData(json.data || []); setHistoryTotal(json.total || 0) }
    } catch {}
    setHistoryLoading(false)
  }, [user, historyPage, historySearch])

  useEffect(() => { if (subTab === 'history') fetchHistory() }, [fetchHistory, subTab])

  // Fetch purchase orders via API route
  const fetchPOs = useCallback(async () => {
    if (!user) return
    setPoLoading(true)
    try {
      const res = await fetch(`/api/purchase-orders?shop_id=${user.shop_id}&page=${poPage}&per_page=50`)
      if (res.ok) { const json = await res.json(); setPoData(json.data || []); setPoTotal(json.total || 0) }
    } catch {}
    setPoLoading(false)
  }, [user, poPage])

  useEffect(() => { if (subTab === 'purchase_orders') fetchPOs() }, [fetchPOs, subTab])

  // Filter by stock level, then sort client-side
  const sorted = useMemo(() => {
    let arr = [...parts]
    // Stock filter
    if (stockFilter === 'in_stock') arr = arr.filter(p => (p.on_hand ?? 0) > 0)
    if (stockFilter === 'out_of_stock') arr = arr.filter(p => (p.on_hand ?? 0) === 0)
    arr.sort((a, b) => {
      // In-stock always floats above out-of-stock
      const aStock = (a.on_hand ?? 0) > 0 ? 1 : 0
      const bStock = (b.on_hand ?? 0) > 0 ? 1 : 0
      if (bStock !== aStock) return bStock - aStock

      // Then apply user's chosen sort
      let av = a[sortField] ?? ''
      let bv = b[sortField] ?? ''
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av
      av = String(av).toLowerCase(); bv = String(bv).toLowerCase()
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }, [parts, sortField, sortDir, stockFilter])

  const totalPages = Math.ceil(total / perPage) || 1
  const reorderTotalPages = Math.ceil(reorderTotal / perPage) || 1

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
  function getPriceUgl(p: any) { return p.price_ugl_company ?? null }
  function getPriceOwnerOp(p: any) { return p.price_ugl_owner_operator ?? null }
  function getPriceOutside(p: any) { return p.price_outside ?? p.sell_price ?? null }
  function getOnHand(p: any) { return p.on_hand ?? 0 }
  function getAllocated(p: any) { return p.allocated ?? p.reserved ?? 0 }
  function getStockStatus(p: any): { label: string; bg: string; color: string } {
    const onHand = p.on_hand ?? 0
    const inTransit = p.in_transit ?? 0
    const reorder = p.reorder_point ?? 0
    if (onHand === 0 && inTransit > 0) return { label: 'On Order', bg: 'rgba(29,111,232,.1)', color: '#4D9EFF' }
    if (onHand === 0) return { label: 'Out of Stock', bg: 'rgba(239,68,68,.1)', color: '#EF4444' }
    if (onHand > 0 && reorder > 0 && onHand <= reorder) return { label: 'Low Stock', bg: 'rgba(245,158,11,.1)', color: '#F59E0B' }
    return { label: 'In Stock', bg: 'rgba(22,163,74,.1)', color: '#16A34A' }
  }
  function getLocation(p: any) { return p.default_location || p.bin_location || '--' }
  function getStatus(p: any) { return p.status || 'active' }

  // Reorder PO creation
  async function createPO() {
    if (!selectedReorder.size) return
    setCreatingPO(true)
    const lines = reorderParts.filter(p => selectedReorder.has(p.id)).map(p => ({
      part_id: p.id,
      part_number: p.part_number,
      description: p.description,
      quantity: Math.max(1, (p.reorder_point ?? 2) - (p.on_hand ?? 0) + (p.reorder_point ?? 2)),
      unit_cost: p.cost_price || 0,
    }))
    const res = await fetch('/api/purchase-orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendor_name: 'Various', lines }),
    })
    const data = await res.json()
    setCreatingPO(false)
    if (res.ok) setPoDone(data)
  }

  const SUB_TABS: { key: SubTab; label: string }[] = [
    { key: 'inventory', label: 'Inventory' },
    { key: 'reorder', label: 'Reorder' },
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
    { key: 'price_ugl_company', label: 'UGL Co.', align: 'right', width: 85 },
    { key: 'price_ugl_owner_operator', label: 'Owner Op.', align: 'right', width: 85 },
    { key: 'price_outside', label: 'Outside', align: 'right', width: 85 },
    { key: 'min_qty', label: 'Min Qty', align: 'right', width: 70 },
    { key: 'max_qty', label: 'Max Qty', align: 'right', width: 70 },
    { key: 'default_location', label: 'Location', width: 90 },
    { key: 'preferred_vendor', label: 'Vendor', width: 120 },
    { key: 'part_category', label: 'Category', width: 100 },
    { key: 'status', label: 'Status', width: 90 },
  ]

  function Pagination({ currentPage, totalPg, totalCount, onPrev, onNext }: { currentPage: number; totalPg: number; totalCount: number; onPrev: () => void; onNext: () => void }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', fontSize: 13, color: '#6B7280' }}>
        <span>{totalCount.toLocaleString()} total</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button disabled={currentPage <= 1} onClick={onPrev} style={paginationBtn(currentPage <= 1)}>Previous</button>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Page {currentPage} of {totalPg.toLocaleString()}</span>
          <button disabled={currentPage >= totalPg} onClick={onNext} style={paginationBtn(currentPage >= totalPg)}>Next</button>
        </div>
      </div>
    )
  }

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
          <button key={t.key} onClick={() => { setSubTab(t.key); if (t.key === 'reorder') setPoDone(null) }} style={{
            padding: '10px 18px', background: 'none', border: 'none',
            borderBottom: subTab === t.key ? `2px solid ${BLUE}` : '2px solid transparent',
            color: subTab === t.key ? BLUE : '#9CA3AF',
            fontWeight: subTab === t.key ? 700 : 500, fontSize: 13, cursor: 'pointer',
            fontFamily: 'inherit', marginBottom: -2,
          }}>{t.label}</button>
        ))}
      </div>

      {/* ==================== INVENTORY TAB ==================== */}
      {subTab === 'inventory' && (
        <>
          {/* Filters bar */}
          <FilterBar
            search={search}
            onSearchChange={val => { handleSearch(val) }}
            searchPlaceholder="Search part #, description..."
            statusOptions={[
              { value: 'all', label: 'All' },
              { value: 'in_stock', label: 'In Stock' },
              { value: 'out_of_stock', label: 'Out of Stock' },
            ]}
            statusValue={stockFilter}
            onStatusChange={val => { setStockFilter(val); setPage(1) }}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={val => { setDateFrom(val); setPage(1) }}
            onDateToChange={val => { setDateTo(val); setPage(1) }}
            theme="light"
            onClearAll={() => { setStatusFilter('active'); setCategoryFilter(''); setVendorFilter(''); setPage(1) }}
          />
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} style={dropdownStyle}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All Status</option>
            </select>
            <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1) }} style={dropdownStyle}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={vendorFilter} onChange={e => { setVendorFilter(e.target.value); setPage(1) }} style={dropdownStyle}>
              <option value="">All Vendors</option>
              {vendors.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          {/* Table */}
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: 48, textAlign: 'center', color: '#9CA3AF' }}>Loading...</div>
            ) : sorted.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>{search || statusFilter !== 'active' || stockFilter !== 'all' || categoryFilter || vendorFilter || dateFrom || dateTo ? 'No results found. Try adjusting your filters.' : 'No parts found'}</div>
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
                      const stockStatus = getStockStatus(p)
                      return (
                        <tr key={p.id} onClick={() => window.location.href = `/parts/${p.id}`}
                          style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}>
                          <td style={{ padding: '10px 10px', fontFamily: MONO, fontSize: 12, fontWeight: 700, color: BLUE, whiteSpace: 'nowrap' }}>{p.part_number || '--'}</td>
                          <td style={{ padding: '10px 10px', fontSize: 12, fontWeight: 500, color: '#1A1A1A', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description ? (p.description.length > 40 ? p.description.slice(0, 40) + '...' : p.description) : '--'}</td>
                          <td style={{ padding: '10px 10px', fontSize: 11, color: '#6B7280' }}>{p.uom || '--'}</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: onHand > 0 ? '#1A1A1A' : '#9CA3AF' }}>{fmtQty(onHand)}</span>
                              <span style={{ padding: '1px 6px', borderRadius: 100, fontSize: 9, fontWeight: 700, background: stockStatus.bg, color: stockStatus.color, whiteSpace: 'nowrap' }}>{stockStatus.label}</span>
                            </span>
                          </td>
                          <td style={{ padding: '10px 10px', fontFamily: MONO, fontSize: 11, textAlign: 'right', color: '#6B7280' }}>{fmtQty(getAllocated(p))}</td>
                          <td style={{ padding: '10px 10px', fontFamily: MONO, fontSize: 11, textAlign: 'right', color: '#6B7280' }}>{canViewCostPrice ? fmt(getAvgCost(p)) : '***'}</td>
                          <td style={{ padding: '10px 10px', fontFamily: MONO, fontSize: 11, textAlign: 'right', color: '#1A1A1A', fontWeight: 600 }}>{fmt(getPriceUgl(p))}</td>
                          <td style={{ padding: '10px 10px', fontFamily: MONO, fontSize: 11, textAlign: 'right', color: '#1A1A1A', fontWeight: 600 }}>{fmt(getPriceOwnerOp(p))}</td>
                          <td style={{ padding: '10px 10px', fontFamily: MONO, fontSize: 11, textAlign: 'right', color: '#1A1A1A', fontWeight: 600 }}>{fmt(getPriceOutside(p))}</td>
                          <td style={{ padding: '10px 10px', fontFamily: MONO, fontSize: 11, textAlign: 'right', color: '#6B7280' }}>{fmtQty(p.min_qty)}</td>
                          <td style={{ padding: '10px 10px', fontFamily: MONO, fontSize: 11, textAlign: 'right', color: '#6B7280' }}>{fmtQty(p.max_qty)}</td>
                          <td style={{ padding: '10px 10px', fontSize: 11, color: '#6B7280' }}>{getLocation(p)}</td>
                          <td style={{ padding: '10px 10px', fontSize: 11, color: '#6B7280', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{canViewVendorInfo ? getVendor(p) : '***'}</td>
                          <td style={{ padding: '10px 10px', fontSize: 11, color: '#6B7280' }}>{getPartCategory(p)}</td>
                          <td style={{ padding: '10px 10px' }}>
                            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 600, background: partStatus === 'active' ? '#F0FDF4' : '#F3F4F6', color: partStatus === 'active' ? '#16A34A' : '#9CA3AF' }}>
                              {partStatus === 'active' ? 'Active' : partStatus === 'inactive' ? 'Inactive' : partStatus || 'Active'}
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
          <Pagination currentPage={page} totalPg={totalPages} totalCount={total} onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />
        </>
      )}

      {/* ==================== REORDER TAB ==================== */}
      {subTab === 'reorder' && (
        <>
          {poDone ? (
            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 64, textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#16A34A', marginBottom: 12 }}>Purchase Order Created</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#1A1A1A', marginBottom: 8 }}>{poDone.po_number}</div>
              <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 24 }}>{selectedReorder.size} parts selected</div>
              <button onClick={() => { setPoDone(null); setSelectedReorder(new Set()) }} style={{ padding: '10px 20px', background: BLUE, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Back to Reorder</button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ fontSize: 13, color: '#6B7280' }}>{reorderTotal} parts below reorder point</div>
                {selectedReorder.size > 0 && (
                  <button onClick={createPO} disabled={creatingPO} style={{ padding: '10px 20px', background: BLUE, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: creatingPO ? 0.5 : 1 }}>
                    {creatingPO ? 'Creating...' : `Create PO (${selectedReorder.size} parts)`}
                  </button>
                )}
              </div>
              <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
                {reorderLoading ? (
                  <div style={{ padding: 48, textAlign: 'center', color: '#9CA3AF' }}>Loading...</div>
                ) : reorderParts.length === 0 ? (
                  <div style={{ padding: 48, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>All parts are above reorder point</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                          <th style={{ ...thStyle, width: 40 }}>
                            <input type="checkbox" checked={selectedReorder.size === reorderParts.length && reorderParts.length > 0}
                              onChange={() => { if (selectedReorder.size === reorderParts.length) setSelectedReorder(new Set()); else setSelectedReorder(new Set(reorderParts.map(p => p.id))) }}
                              style={{ cursor: 'pointer' }} />
                          </th>
                          {['Part #', 'Description', 'On Hand', 'Reorder At', 'Order Qty', 'Unit Cost', 'Total', 'Vendor'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {reorderParts.map(p => {
                          const orderQty = Math.max(1, (p.reorder_point ?? 2) - (p.on_hand ?? 0) + (p.reorder_point ?? 2))
                          const lineCost = (p.cost_price || 0) * orderQty
                          const isOut = (p.on_hand ?? 0) === 0
                          return (
                            <tr key={p.id} style={{ cursor: 'pointer', background: selectedReorder.has(p.id) ? '#F0F9FF' : '' }}
                              onClick={() => setSelectedReorder(s => { const n = new Set(s); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n })}>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>
                                <input type="checkbox" checked={selectedReorder.has(p.id)} onChange={() => {}} style={{ cursor: 'pointer' }} />
                              </td>
                              <td style={{ ...tdStyle, fontFamily: MONO, fontSize: 11, color: BLUE, fontWeight: 700 }}>{p.part_number || '--'}</td>
                              <td style={{ ...tdStyle, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description || '--'}</td>
                              <td style={{ ...tdStyle, fontFamily: MONO, fontWeight: 700, color: isOut ? '#DC2626' : '#D97706', textAlign: 'center' }}>{p.on_hand ?? 0}</td>
                              <td style={{ ...tdStyle, fontFamily: MONO, color: '#6B7280', textAlign: 'center' }}>{p.reorder_point ?? 2}</td>
                              <td style={{ ...tdStyle, fontFamily: MONO, fontWeight: 700, color: BLUE, textAlign: 'center' }}>{orderQty}</td>
                              <td style={{ ...tdStyle, fontFamily: MONO, color: '#6B7280' }}>{fmt(p.cost_price)}</td>
                              <td style={{ ...tdStyle, fontFamily: MONO, fontWeight: 700, color: '#1A1A1A' }}>{fmt(lineCost)}</td>
                              <td style={{ ...tdStyle, fontSize: 11, color: '#6B7280' }}>{p.vendor || p.preferred_vendor || '--'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <Pagination currentPage={reorderPage} totalPg={reorderTotalPages} totalCount={reorderTotal} onPrev={() => setReorderPage(p => p - 1)} onNext={() => setReorderPage(p => p + 1)} />
            </>
          )}
        </>
      )}

      {/* ==================== VENDORS TAB ==================== */}
      {subTab === 'vendors' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 320 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input value={vendorSearch} onChange={e => setVendorSearch(e.target.value)} placeholder="Search vendors..."
                style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 12, color: '#1A1A1A', fontFamily: 'inherit', outline: 'none', background: '#fff', boxSizing: 'border-box' }} />
            </div>
            <span style={{ fontSize: 13, color: '#6B7280' }}>
              {vendorList.filter(v => {
                if (!vendorSearch) return true
                return (v.name || '').toLowerCase().includes(vendorSearch.toLowerCase())
              }).length} vendors
            </span>
          </div>
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
            {vendorLoading ? (
              <div style={{ padding: 48, textAlign: 'center', color: '#9CA3AF' }}>Loading...</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                      {['Vendor Name', 'Source', 'Phone', 'Email', 'Parts Linked'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {vendorList
                      .filter(v => !vendorSearch || (v.name || '').toLowerCase().includes(vendorSearch.toLowerCase()))
                      .map(v => (
                      <tr key={v.id} style={{ borderBottom: '1px solid #F3F4F6' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}>
                        <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>{v.name || '--'}</td>
                        <td style={{ padding: '10px 12px', fontSize: 11 }}>
                          <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 600, background: v.source === 'fullbay' ? 'rgba(29,111,232,0.1)' : 'rgba(255,255,255,0.06)', color: v.source === 'fullbay' ? BLUE : '#6B7280' }}>
                            {v.source || 'manual'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: '#6B7280' }}>{v.phone || '--'}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: '#6B7280' }}>{v.email || '--'}</td>
                        <td style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 12, fontWeight: 700, color: v.parts_count > 0 ? BLUE : '#9CA3AF', textAlign: 'center' }}>{v.parts_count}</td>
                      </tr>
                    ))}
                    {vendorList.filter(v => !vendorSearch || (v.name || '').toLowerCase().includes(vendorSearch.toLowerCase())).length === 0 && (
                      <tr><td colSpan={5} style={{ padding: 48, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No vendors found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ==================== PART HISTORY TAB ==================== */}
      {subTab === 'history' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 320 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input value={historySearch} onChange={e => { setHistorySearch(e.target.value); setHistoryPage(1) }} placeholder="Search part #, description..."
                style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 12, color: '#1A1A1A', fontFamily: 'inherit', outline: 'none', background: '#fff', boxSizing: 'border-box' }} />
            </div>
            <span style={{ fontSize: 13, color: '#6B7280' }}>{historyTotal.toLocaleString()} records</span>
          </div>
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
            {historyLoading ? (
              <div style={{ padding: 48, textAlign: 'center', color: '#9CA3AF' }}>Loading...</div>
            ) : historyData.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No part history found</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                      {['Part #', 'Description', 'PO #', 'Vendor', 'Qty', 'Cost', 'Date'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map((r: any) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 12, fontWeight: 700, color: BLUE }}>{r.part_number || '--'}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: '#1A1A1A', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description || '--'}</td>
                        <td style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 11, color: '#6B7280' }}>{r.po_number || '--'}</td>
                        <td style={{ padding: '10px 12px', fontSize: 11, color: '#6B7280' }}>{r.vendor || '--'}</td>
                        <td style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 12, fontWeight: 600, color: '#1A1A1A', textAlign: 'right' }}>{r.quantity ?? 0}</td>
                        <td style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 12, color: '#6B7280', textAlign: 'right' }}>{r.cost_price != null ? '$' + Number(r.cost_price).toFixed(2) : '--'}</td>
                        <td style={{ padding: '10px 12px', fontSize: 11, color: '#6B7280' }}>{r.date ? new Date(r.date).toLocaleDateString() : '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <Pagination currentPage={historyPage} totalPg={Math.ceil(historyTotal / 50) || 1} totalCount={historyTotal} onPrev={() => setHistoryPage(p => p - 1)} onNext={() => setHistoryPage(p => p + 1)} />
        </>
      )}

      {/* ==================== PURCHASE ORDERS TAB ==================== */}
      {subTab === 'purchase_orders' && (
        <>
          <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>{poTotal.toLocaleString()} purchase orders</div>
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
            {poLoading ? (
              <div style={{ padding: 48, textAlign: 'center', color: '#9CA3AF' }}>Loading...</div>
            ) : poData.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No purchase orders found</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                      {['PO #', 'Vendor', 'Status', 'Lines', 'Total', 'Date', 'Source'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {poData.map((po: any) => (
                      <tr key={po.id} style={{ borderBottom: '1px solid #F3F4F6' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}>
                        <td style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 12, fontWeight: 700, color: BLUE }}>{po.po_number || '--'}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: '#1A1A1A', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{po.vendor_name || '--'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 600, background: po.status === 'paid' ? '#F0FDF4' : po.status === 'received' ? '#EFF6FF' : '#F3F4F6', color: po.status === 'paid' ? '#16A34A' : po.status === 'received' ? BLUE : '#6B7280' }}>
                            {po.status || 'draft'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 12, color: '#6B7280', textAlign: 'center' }}>{po.line_count}</td>
                        <td style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 12, fontWeight: 600, color: '#1A1A1A', textAlign: 'right' }}>${(po.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style={{ padding: '10px 12px', fontSize: 11, color: '#6B7280' }}>{po.received_date ? new Date(po.received_date).toLocaleDateString() : po.created_at ? new Date(po.created_at).toLocaleDateString() : '--'}</td>
                        <td style={{ padding: '10px 12px', fontSize: 11 }}>
                          <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 600, background: po.source === 'fullbay' ? 'rgba(29,111,232,0.1)' : '#F3F4F6', color: po.source === 'fullbay' ? BLUE : '#6B7280' }}>
                            {po.source || 'manual'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <Pagination currentPage={poPage} totalPg={Math.ceil(poTotal / 50) || 1} totalCount={poTotal} onPrev={() => setPoPage(p => p - 1)} onNext={() => setPoPage(p => p + 1)} />
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

const thStyle: React.CSSProperties = {
  padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 600,
  color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 10px', borderBottom: '1px solid #F3F4F6', fontSize: 12, color: '#1A1A1A',
}
