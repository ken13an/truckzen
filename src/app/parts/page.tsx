'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import ExcelJS from 'exceljs'
import * as XLSX from 'xlsx'
import PageControls, { PageFooter } from '@/components/ui/PageControls'
import SourceBadge from '@/components/ui/SourceBadge'

const BG = '#060708', CARD = '#161B24', BORDER = 'rgba(255,255,255,.055)'
const TEXT = '#DDE3EE', MUTED = '#7C8BA0', WHITE = '#F0F4FF', BLUE = '#4D9EFF'
const GREEN = '#1DB870', RED = '#D94F4F', AMBER = '#D4882A'
const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const HEADING = "'Bebas Neue',sans-serif"

const CATEGORIES = ['Engine', 'Brakes', 'Electrical', 'Suspension', 'Drivetrain', 'Cooling', 'Exhaust', 'HVAC', 'Filters', 'Fluids', 'Body', 'Other']

export default function PartsPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [tab, setTab] = useState(0)

  // Inventory state
  const [parts, setParts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editVals, setEditVals] = useState<any>({})
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)

  // Requests state
  const [requests, setRequests] = useState<any[]>([])
  const [reqLoading, setReqLoading] = useState(true)
  const [reqFilter, setReqFilter] = useState<'pending' | 'all'>('pending')

  // Add part form
  const [form, setForm] = useState({ part_number: '', description: '', category: 'Other', on_hand: '0', reorder_point: '2', cost_price: '0', sell_price: '0', vendor: '', bin_location: '', core_charge: '0', warranty_months: '0' })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // Bulk import state
  const [bulkStep, setBulkStep] = useState<0 | 1 | 2 | 3>(0) // 0=hidden, 1=preview, 2=importing, 3=done
  const [bulkRows, setBulkRows] = useState<any[]>([])
  const [bulkFileName, setBulkFileName] = useState('')
  const [bulkImporting, setBulkImporting] = useState(false)
  const [bulkResult, setBulkResult] = useState<any>(null)

  const [toast, setToast] = useState('')
  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { window.location.href = '/login'; return }
      setUser(profile)
      await Promise.all([loadParts(profile.shop_id), loadRequests(profile.shop_id)])
    }
    load()
  }, [])

  const loadParts = useCallback(async (shopId: string) => {
    const { data } = await supabase.from('parts')
      .select('id, part_number, description, category, on_hand, reorder_point, cost_price, sell_price, vendor, bin_location, core_charge, warranty_months, source')
      .eq('shop_id', shopId).order('description')
    setParts(data || [])
    setLoading(false)
  }, [supabase])

  const loadRequests = useCallback(async (shopId: string) => {
    const { data } = await supabase.from('parts_requests').select('*').eq('shop_id', shopId).order('created_at', { ascending: false }).limit(200)
    setRequests(data || [])
    setReqLoading(false)
  }, [supabase])

  const filtered = useMemo(() => parts.filter(p => {
    if (lowStockOnly && p.on_hand > p.reorder_point) return false
    if (!search) return true
    const s = search.toLowerCase()
    return p.description?.toLowerCase().includes(s) || p.part_number?.toLowerCase().includes(s) || p.vendor?.toLowerCase().includes(s)
  }), [parts, search, lowStockOnly])

  const paginated = useMemo(() => {
    if (perPage === 0) return filtered
    const start = (page - 1) * perPage
    return filtered.slice(start, start + perPage)
  }, [filtered, page, perPage])

  const fmt = (n: number) => '$' + (n || 0).toFixed(2)
  const margin = (p: any) => p.sell_price && p.cost_price ? Math.round((p.sell_price - p.cost_price) / p.sell_price * 100) : 0

  async function handleFulfill(reqId: string) {
    await supabase.from('parts_requests').update({ status: 'ready', ready_at: new Date().toISOString() }).eq('id', reqId)
    setRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: 'ready' } : r))
  }

  async function handleCancel(reqId: string) {
    await supabase.from('parts_requests').update({ status: 'cancelled' }).eq('id', reqId)
    setRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: 'cancelled' } : r))
  }

  function startEdit(p: any) {
    setEditingId(p.id)
    setEditVals({ part_number: p.part_number || '', description: p.description, category: p.category, on_hand: p.on_hand, cost_price: p.cost_price, sell_price: p.sell_price, reorder_point: p.reorder_point, bin_location: p.bin_location || '', vendor: p.vendor || '' })
  }

  async function saveEdit() {
    if (!editingId) return
    const updates = {
      part_number: editVals.part_number || null,
      description: editVals.description,
      category: editVals.category,
      on_hand: parseInt(editVals.on_hand) || 0,
      cost_price: parseFloat(editVals.cost_price) || 0,
      sell_price: parseFloat(editVals.sell_price) || 0,
      reorder_point: parseInt(editVals.reorder_point) || 0,
      bin_location: editVals.bin_location || null,
      vendor: editVals.vendor || null,
    }
    await supabase.from('parts').update(updates).eq('id', editingId)
    setParts(prev => prev.map(p => p.id === editingId ? { ...p, ...updates } : p))
    setEditingId(null)
  }

  async function handleAddPart(e: React.FormEvent) {
    e.preventDefault()
    if (!form.description.trim()) { setSaveMsg('Description is required'); return }
    setSaving(true); setSaveMsg('')
    const res = await fetch('/api/parts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (res.ok) {
      const newPart = await res.json()
      setParts(prev => [...prev, newPart].sort((a, b) => (a.description || '').localeCompare(b.description || '')))
      setForm({ part_number: '', description: '', category: 'Other', on_hand: '0', reorder_point: '2', cost_price: '0', sell_price: '0', vendor: '', bin_location: '', core_charge: '0', warranty_months: '0' })
      setSaveMsg('Part added successfully'); setTab(1)
    } else { const err = await res.json(); setSaveMsg(err.error || 'Failed') }
    setSaving(false)
  }

  // ── Bulk Import ──
  async function handleBulkFile(f: File) {
    setBulkFileName(f.name)
    const data = await f.arrayBuffer()
    const wb = XLSX.read(data)
    let sheetName = wb.SheetNames[0]
    if (wb.SheetNames.length > 1 && sheetName.toLowerCase().includes('how')) sheetName = wb.SheetNames[1]
    const json: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 })
    if (json.length < 2) { flash('No data rows'); return }
    const hdrs = (json[0] as string[]).map(h => String(h || '').trim().toLowerCase())
    const rows = json.slice(1).filter(r => r.some(c => c != null && String(c).trim())).map(r => {
      const obj: Record<string, string> = {}
      hdrs.forEach((h, i) => { obj[h] = String(r[i] ?? '').trim() })
      return obj
    })
    setBulkRows(rows)
    setBulkStep(1)
  }

  async function runBulkImport() {
    if (!user) return
    setBulkImporting(true); setBulkStep(2)
    const batchId = crypto.randomUUID()
    const res = await fetch('/api/smart-import/parts/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: bulkRows, shop_id: user.shop_id, batch_id: batchId, user_id: user.id }),
    })
    setBulkImporting(false)
    if (res.ok) { setBulkResult(await res.json()); setBulkStep(3); await loadParts(user.shop_id) }
    else flash('Import failed')
  }

  async function undoBulkImport() {
    if (!bulkResult?.batch_id || !user) return
    if (!confirm('Undo this import?')) return
    const res = await fetch(`/api/smart-import/parts/undo/${bulkResult.batch_id}?shop_id=${user.shop_id}`, { method: 'DELETE' })
    if (res.ok) { flash('Import undone'); setBulkStep(0); setBulkResult(null); await loadParts(user.shop_id) }
    else flash('Undo failed')
  }

  async function downloadErrorReport() {
    if (!bulkResult?.skipped_rows?.length) return
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Skipped')
    const keys = Object.keys(bulkResult.skipped_rows[0]).filter((k: string) => k !== '_reason')
    ws.addRow([...keys, 'Reason'])
    ws.getRow(1).eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EF4444' } }; c.font = { bold: true, color: { argb: 'FFFFFF' } } })
    for (const row of bulkResult.skipped_rows) ws.addRow([...keys.map((k: string) => row[k] || ''), row._reason])
    const buf = await wb.xlsx.writeBuffer()
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf])); a.download = 'Parts_Import_Errors.xlsx'; a.click()
  }

  const filteredReqs = reqFilter === 'pending' ? requests.filter(r => ['pending', 'approved', 'ordered'].includes(r.status)) : requests
  const statusColor = (s: string) => s === 'ready' || s === 'collected' ? GREEN : s === 'cancelled' ? RED : s === 'ordered' ? AMBER : BLUE
  const TABS = ['Requests', 'Inventory', 'Add Part']

  const inputStyle: React.CSSProperties = { padding: '8px 12px', background: '#1C2130', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, color: TEXT, fontSize: 12, fontFamily: FONT, outline: 'none', width: '100%', boxSizing: 'border-box' }
  const btnPrimary: React.CSSProperties = { padding: '8px 16px', background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }

  return (
    <div style={{ background: BG, minHeight: '100vh', color: TEXT, fontFamily: FONT, padding: 24 }}>
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: '#1D6FE8', color: '#fff', padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>{toast}</div>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontFamily: HEADING, fontSize: 28, color: WHITE }}>Parts Department</div>
          <div style={{ fontSize: 12, color: MUTED }}>{parts.length} parts · {parts.filter(p => p.on_hand <= p.reorder_point).length} low stock · {requests.filter(r => r.status === 'pending').length} pending requests</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,.08)', marginBottom: 20 }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{ padding: '10px 18px', fontSize: 12, fontWeight: tab === i ? 700 : 400, color: tab === i ? BLUE : MUTED, background: 'none', border: 'none', borderBottom: tab === i ? `2px solid ${BLUE}` : '2px solid transparent', cursor: 'pointer', fontFamily: FONT }}>
            {t}
            {i === 0 && requests.filter(r => r.status === 'pending').length > 0 && (
              <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 100, background: `${RED}20`, color: RED, fontSize: 9, fontWeight: 700 }}>{requests.filter(r => r.status === 'pending').length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab 0: Requests */}
      {tab === 0 && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {(['pending', 'all'] as const).map(f => (
              <button key={f} onClick={() => setReqFilter(f)} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${reqFilter === f ? BLUE : 'rgba(255,255,255,.08)'}`, background: reqFilter === f ? `${BLUE}15` : 'transparent', color: reqFilter === f ? BLUE : MUTED, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
                {f === 'pending' ? 'Pending' : 'All'}
              </button>
            ))}
          </div>
          {reqLoading ? <div style={{ textAlign: 'center', padding: 40, color: MUTED }}>Loading...</div>
          : filteredReqs.length === 0 ? <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 32, textAlign: 'center', color: MUTED }}>{reqFilter === 'pending' ? 'No pending requests' : 'No requests'}</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredReqs.map(r => (
                <div key={r.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: WHITE, marginBottom: 3 }}>{r.part_name || r.description || 'Part Request'}</div>
                      {r.part_number && <div style={{ fontFamily: MONO, fontSize: 10, color: BLUE, marginBottom: 3 }}>{r.part_number}</div>}
                      <div style={{ fontSize: 11, color: MUTED }}>Qty: {r.quantity || 1} · Priority: <span style={{ color: r.priority === 'urgent' ? RED : r.priority === 'high' ? AMBER : MUTED, fontWeight: 600 }}>{r.priority || 'normal'}</span></div>
                      {r.notes && <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{r.notes}</div>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 100, fontFamily: MONO, fontSize: 8, background: `${statusColor(r.status)}15`, color: statusColor(r.status), border: `1px solid ${statusColor(r.status)}33` }}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor' }} />{r.status}
                      </span>
                      {['pending', 'approved'].includes(r.status) && (
                        <>
                          <button onClick={() => handleFulfill(r.id)} style={{ padding: '4px 10px', background: `${GREEN}15`, border: `1px solid ${GREEN}33`, borderRadius: 6, color: GREEN, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>Fulfill</button>
                          <button onClick={() => handleCancel(r.id)} style={{ padding: '4px 10px', background: `${RED}15`, border: `1px solid ${RED}33`, borderRadius: 6, color: RED, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>Cancel</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>}
        </div>
      )}

      {/* Tab 1: Inventory */}
      {tab === 1 && bulkStep === 0 && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <PageControls total={filtered.length} page={page} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage} searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search by part #, description, vendor..." />
            </div>
            <button onClick={() => setLowStockOnly(!lowStockOnly)} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${lowStockOnly ? AMBER : 'rgba(255,255,255,.08)'}`, background: lowStockOnly ? `${AMBER}15` : 'transparent', color: lowStockOnly ? AMBER : MUTED, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
              Low Stock ({parts.filter(p => p.on_hand <= p.reorder_point).length})
            </button>
            <button onClick={() => window.location.href = '/api/smart-import/parts/template'} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.08)', background: 'transparent', color: MUTED, fontSize: 10, cursor: 'pointer', fontFamily: FONT }}>Download Template</button>
            <button onClick={() => { setBulkStep(1); setBulkRows([]); setBulkFileName('') }} style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${BLUE}40`, background: `${BLUE}10`, color: BLUE, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>Bulk Add Parts</button>
            <button onClick={() => setTab(2)} style={btnPrimary}>+ Add Part</button>
          </div>

          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <thead>
                  <tr>{['Part #', 'Description', 'Category', 'On Hand', 'Reorder', 'Cost', 'Sell', 'Margin', 'Vendor', 'Bin', 'Status', ''].map(h =>
                    <th key={h} style={{ fontFamily: MONO, fontSize: 8, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.1em', padding: '7px 8px', textAlign: 'left', background: '#0B0D11', whiteSpace: 'nowrap' }}>{h}</th>
                  )}</tr>
                </thead>
                <tbody>
                  {loading ? <tr><td colSpan={12} style={{ textAlign: 'center', padding: 40, color: MUTED }}>Loading...</td></tr>
                  : paginated.length === 0 ? <tr><td colSpan={12} style={{ textAlign: 'center', padding: 40, color: MUTED }}>No parts found</td></tr>
                  : paginated.map(p => {
                    const isLow = p.on_hand <= p.reorder_point, isOut = p.on_hand === 0, m = margin(p)
                    const isEditing = editingId === p.id

                    if (isEditing) {
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,.025)', background: 'rgba(29,111,232,.03)' }}>
                          <td style={cellPad}><input value={editVals.part_number} onChange={e => setEditVals({ ...editVals, part_number: e.target.value })} style={{ ...inputStyle, width: 70, padding: '3px 6px', fontSize: 11 }} /></td>
                          <td style={cellPad}><input value={editVals.description} onChange={e => setEditVals({ ...editVals, description: e.target.value })} style={{ ...inputStyle, width: 140, padding: '3px 6px', fontSize: 11 }} /></td>
                          <td style={cellPad}><select value={editVals.category} onChange={e => setEditVals({ ...editVals, category: e.target.value })} style={{ ...inputStyle, width: 80, padding: '3px 4px', fontSize: 10 }}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></td>
                          <td style={cellPad}><input value={editVals.on_hand} onChange={e => setEditVals({ ...editVals, on_hand: e.target.value })} style={{ ...inputStyle, width: 45, padding: '3px 6px', fontSize: 11, textAlign: 'center' }} /></td>
                          <td style={cellPad}><input value={editVals.reorder_point} onChange={e => setEditVals({ ...editVals, reorder_point: e.target.value })} style={{ ...inputStyle, width: 45, padding: '3px 6px', fontSize: 11, textAlign: 'center' }} /></td>
                          <td style={cellPad}><input value={editVals.cost_price} onChange={e => setEditVals({ ...editVals, cost_price: e.target.value })} style={{ ...inputStyle, width: 55, padding: '3px 6px', fontSize: 11 }} /></td>
                          <td style={cellPad}><input value={editVals.sell_price} onChange={e => setEditVals({ ...editVals, sell_price: e.target.value })} style={{ ...inputStyle, width: 55, padding: '3px 6px', fontSize: 11 }} /></td>
                          <td style={cellPad}><span style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>—</span></td>
                          <td style={cellPad}><input value={editVals.vendor} onChange={e => setEditVals({ ...editVals, vendor: e.target.value })} style={{ ...inputStyle, width: 70, padding: '3px 6px', fontSize: 11 }} /></td>
                          <td style={cellPad}><input value={editVals.bin_location} onChange={e => setEditVals({ ...editVals, bin_location: e.target.value })} style={{ ...inputStyle, width: 50, padding: '3px 6px', fontSize: 11 }} /></td>
                          <td style={cellPad}>—</td>
                          <td style={cellPad}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={saveEdit} style={{ padding: '3px 8px', background: `${GREEN}15`, border: `1px solid ${GREEN}33`, borderRadius: 4, color: GREEN, fontSize: 9, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>Save</button>
                              <button onClick={() => setEditingId(null)} style={{ padding: '3px 8px', background: 'transparent', border: '1px solid rgba(255,255,255,.08)', borderRadius: 4, color: MUTED, fontSize: 9, cursor: 'pointer', fontFamily: FONT }}>Cancel</button>
                            </div>
                          </td>
                        </tr>
                      )
                    }

                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,.025)' }}>
                        <td style={{ ...cellPad, fontFamily: MONO, fontSize: 10, color: BLUE }}>{p.part_number || '—'}</td>
                        <td style={{ ...cellPad, color: WHITE, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description || '—'} <SourceBadge source={p.source} /></td>
                        <td style={{ ...cellPad, fontSize: 10, color: MUTED }}>{p.category || '—'}</td>
                        <td style={{ ...cellPad, fontFamily: MONO, fontSize: 11, fontWeight: 700, color: isOut ? RED : isLow ? AMBER : TEXT, textAlign: 'center' }}>{p.on_hand}</td>
                        <td style={{ ...cellPad, fontFamily: MONO, fontSize: 10, color: MUTED, textAlign: 'center' }}>{p.reorder_point}</td>
                        <td style={{ ...cellPad, fontFamily: MONO, fontSize: 10, color: MUTED }}>{fmt(p.cost_price)}</td>
                        <td style={{ ...cellPad, fontFamily: MONO, fontSize: 10, color: TEXT }}>{fmt(p.sell_price)}</td>
                        <td style={{ ...cellPad, fontFamily: MONO, fontSize: 10, fontWeight: 700, color: m >= 40 ? GREEN : m >= 25 ? AMBER : RED }}>{m}%</td>
                        <td style={{ ...cellPad, fontSize: 10, color: MUTED, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.vendor || '—'}</td>
                        <td style={{ ...cellPad, fontFamily: MONO, fontSize: 10, color: '#48536A' }}>{p.bin_location || '—'}</td>
                        <td style={cellPad}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 100, fontFamily: MONO, fontSize: 8, background: isOut ? 'rgba(217,79,79,.1)' : isLow ? 'rgba(212,136,42,.1)' : 'rgba(29,184,112,.1)', color: isOut ? RED : isLow ? AMBER : GREEN, border: '1px solid currentColor' }}>
                            <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor' }} />
                            {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                          </span>
                        </td>
                        <td style={cellPad}>
                          <button onClick={() => startEdit(p)} style={{ padding: '3px 8px', background: 'transparent', border: '1px solid rgba(255,255,255,.08)', borderRadius: 4, color: MUTED, fontSize: 9, cursor: 'pointer', fontFamily: FONT }}>Edit</button>
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
      )}

      {/* Tab 1: Bulk Import Flow (overlays inventory) */}
      {tab === 1 && bulkStep > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: WHITE }}>Bulk Add Parts</div>
            <button onClick={() => { setBulkStep(0); setBulkResult(null) }} style={{ padding: '5px 12px', border: '1px solid rgba(255,255,255,.08)', borderRadius: 6, background: 'transparent', color: MUTED, fontSize: 10, cursor: 'pointer', fontFamily: FONT }}>Back to Inventory</button>
          </div>

          {/* Upload */}
          {bulkStep === 1 && bulkRows.length === 0 && (
            <div style={{ background: CARD, border: `2px dashed ${BORDER}`, borderRadius: 12, padding: 60, textAlign: 'center', cursor: 'pointer' }}
              onClick={() => document.getElementById('bulkFile')?.click()}>
              <div style={{ fontSize: 32, opacity: 0.3, marginBottom: 8 }}>+</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: WHITE }}>Drop CSV or XLSX here</div>
              <div style={{ fontSize: 12, color: MUTED }}>Upload parts purchase file</div>
              <input id="bulkFile" type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleBulkFile(e.target.files[0])} />
            </div>
          )}

          {/* Preview */}
          {bulkStep === 1 && bulkRows.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>{bulkFileName} — {bulkRows.length} rows</div>
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr>{['Part #', 'Description', 'Category', 'Cost', 'Sell', 'Qty', 'Vendor', 'Bin'].map(h =>
                      <th key={h} style={{ fontFamily: MONO, fontSize: 8, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.1em', padding: '7px 8px', textAlign: 'left', background: '#0B0D11' }}>{h}</th>
                    )}</tr>
                  </thead>
                  <tbody>
                    {bulkRows.slice(0, 20).map((r, i) => {
                      const hasDesc = !!r.description?.trim()
                      return (
                        <tr key={i} style={{ borderLeft: `3px solid ${hasDesc ? GREEN : RED}`, borderBottom: '1px solid rgba(255,255,255,.025)' }}>
                          <td style={cellPad}>{r.part_number || '—'}</td>
                          <td style={{ ...cellPad, color: hasDesc ? WHITE : RED }}>{r.description || 'MISSING'}</td>
                          <td style={cellPad}>{r.category || '—'}</td>
                          <td style={cellPad}>{r.cost_price || '—'}</td>
                          <td style={cellPad}>{r.sell_price || '—'}</td>
                          <td style={{ ...cellPad, fontWeight: 700 }}>{r.quantity || '0'}</td>
                          <td style={cellPad}>{r.vendor || '—'}</td>
                          <td style={cellPad}>{r.bin_location || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>
                {bulkRows.filter(r => r.description?.trim()).length} valid, {bulkRows.filter(r => !r.description?.trim()).length} missing description (will skip)
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setBulkRows([]); setBulkFileName('') }} style={{ padding: '8px 16px', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, background: 'transparent', color: MUTED, fontSize: 12, cursor: 'pointer', fontFamily: FONT }}>Re-upload</button>
                <button onClick={runBulkImport} style={{ ...btnPrimary, flex: 1, padding: '10px 24px', fontSize: 13 }}>Import {bulkRows.length} Parts</button>
              </div>
            </div>
          )}

          {/* Importing */}
          {bulkStep === 2 && (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: WHITE, marginBottom: 8 }}>Importing...</div>
              <div style={{ color: MUTED, fontSize: 12 }}>Processing {bulkRows.length} parts</div>
            </div>
          )}

          {/* Results */}
          {bulkStep === 3 && bulkResult && (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: bulkResult.skipped === 0 ? GREEN : AMBER, marginBottom: 16 }}>Import Complete</div>
              <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginBottom: 20 }}>
                <div><div style={{ fontSize: 28, fontWeight: 700, color: GREEN }}>{bulkResult.created}</div><div style={{ fontSize: 10, color: MUTED }}>New Parts</div></div>
                <div><div style={{ fontSize: 28, fontWeight: 700, color: AMBER }}>{bulkResult.updated}</div><div style={{ fontSize: 10, color: MUTED }}>Qty Updated</div></div>
                <div><div style={{ fontSize: 28, fontWeight: 700, color: RED }}>{bulkResult.skipped}</div><div style={{ fontSize: 10, color: MUTED }}>Skipped</div></div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button onClick={undoBulkImport} style={{ padding: '8px 16px', border: `1px solid ${RED}`, borderRadius: 8, background: 'transparent', color: RED, fontSize: 11, cursor: 'pointer', fontFamily: FONT }}>Undo</button>
                {bulkResult.skipped_rows?.length > 0 && (
                  <button onClick={downloadErrorReport} style={{ padding: '8px 16px', border: `1px solid ${AMBER}`, borderRadius: 8, background: 'transparent', color: AMBER, fontSize: 11, cursor: 'pointer', fontFamily: FONT }}>Error Report</button>
                )}
                <button onClick={() => { setBulkStep(0); setBulkResult(null) }} style={btnPrimary}>View Inventory</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Add Part */}
      {tab === 2 && (
        <div style={{ maxWidth: 560 }}>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: WHITE, marginBottom: 16 }}>Add New Part</div>
            {saveMsg && <div style={{ padding: '8px 12px', borderRadius: 8, marginBottom: 16, fontSize: 12, fontWeight: 600, background: saveMsg.includes('success') ? `${GREEN}15` : `${RED}15`, color: saveMsg.includes('success') ? GREEN : RED, border: `1px solid ${saveMsg.includes('success') ? GREEN : RED}33` }}>{saveMsg}</div>}
            <form onSubmit={handleAddPart}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div><label style={labelS}>Part Number</label><input value={form.part_number} onChange={e => setForm({ ...form, part_number: e.target.value })} placeholder="e.g. BW-1234" style={inputStyle} /></div>
                <div><label style={labelS}>Category</label><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={{ ...inputStyle, appearance: 'auto' }}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
              </div>
              <div style={{ marginBottom: 12 }}><label style={labelS}>Description *</label><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Part description" style={inputStyle} required /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div><label style={labelS}>On Hand</label><input type="number" value={form.on_hand} onChange={e => setForm({ ...form, on_hand: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelS}>Reorder At</label><input type="number" value={form.reorder_point} onChange={e => setForm({ ...form, reorder_point: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelS}>Cost Price</label><input type="number" step="0.01" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelS}>Sell Price</label><input type="number" step="0.01" value={form.sell_price} onChange={e => setForm({ ...form, sell_price: e.target.value })} style={inputStyle} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div><label style={labelS}>Vendor</label><input value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} placeholder="Vendor" style={inputStyle} /></div>
                <div><label style={labelS}>Bin Location</label><input value={form.bin_location} onChange={e => setForm({ ...form, bin_location: e.target.value })} placeholder="e.g. A-12" style={inputStyle} /></div>
              </div>
              <button type="submit" disabled={saving} style={{ ...btnPrimary, padding: '10px 24px', fontSize: 13, opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving...' : 'Add Part'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const cellPad: React.CSSProperties = { padding: '8px 8px', fontSize: 11, color: '#A0AABF' }
const labelS: React.CSSProperties = { fontSize: 10, color: '#7C8BA0', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4, display: 'block' }
