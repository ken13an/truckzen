'use client'
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { useEmployeePermission } from '@/hooks/useEmployeePermission'

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
  const [categoryFilter, setCategoryFilter] = useState('')
  const [vendorFilter, setVendorFilter] = useState('')

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

  // Fetch parts when filters change (inventory tab)
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
        setParts(json.data ?? []); setTotal(json.total ?? 0)
      }
    }
    setLoading(false)
  }, [user, page, statusFilter, categoryFilter, vendorFilter, search])

  useEffect(() => { if (subTab === 'inventory') fetchParts() }, [fetchParts, subTab])

  // Fetch reorder parts
  const fetchReorder = useCallback(async () => {
    if (!user) return
    setReorderLoading(true)
    const res = await fetch(`/api/parts?per_page=${perPage}&page=${reorderPage}&low_stock=true&status=all`)
    if (res.ok) {
      const json = await res.json()
      setReorderParts(json.data ?? [])
      setReorderTotal(json.total ?? 0)
    }
    setReorderLoading(false)
  }, [user, reorderPage])

  useEffect(() => { if (subTab === 'reorder') fetchReorder() }, [fetchReorder, subTab])

  // Load distinct categories and vendors once
  useEffect(() => {
    if (!user) return
    fetch('/api/parts?per_page=2000&status=all').then(r => r.json()).then(json => {
      const list = Array.isArray(json) ? json : (json.data ?? [])
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
  function getAllocated(p: any) { return p.allocated ?? p.reserved_qty ?? 0 }
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
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 320 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input value={search} onChange={e => handleSearch(e.target.value)} placeholder="Search part #, description..."
                style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 12, color: '#1A1A1A', fontFamily: 'inherit', outline: 'none', background: '#fff', boxSizing: 'border-box' }} />
            </div>
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
                        <tr key={p.id} onClick={() => window.location.href = `/parts/${p.id}`}
                          style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}>
                          <td style={{ padding: '10px 10px', fontFamily: MONO, fontSize: 12, fontWeight: 700, color: BLUE, whiteSpace: 'nowrap' }}>{p.part_number || '--'}</td>
                          <td style={{ padding: '10px 10px', fontSize: 12, fontWeight: 500, color: '#1A1A1A', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description ? (p.description.length > 40 ? p.description.slice(0, 40) + '...' : p.description) : '--'}</td>
                          <td style={{ padding: '10px 10px', fontSize: 11, color: '#6B7280' }}>{p.uom || '--'}</td>
                          <td style={{ padding: '10px 10px', fontFamily: MONO, fontSize: 12, fontWeight: 700, textAlign: 'right', color: onHand > 0 ? BLUE : '#9CA3AF' }}>{fmtQty(onHand)}</td>
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

      {/* ==================== COMING SOON TABS ==================== */}
      {(subTab === 'vendors' || subTab === 'history' || subTab === 'purchase_orders') && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 64, textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>{SUB_TABS.find(t => t.key === subTab)?.label}</div>
          <div style={{ fontSize: 14, color: '#9CA3AF' }}>Coming Soon</div>
        </div>
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
