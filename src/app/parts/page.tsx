'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

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

  // Requests state
  const [requests, setRequests] = useState<any[]>([])
  const [reqLoading, setReqLoading] = useState(true)
  const [reqFilter, setReqFilter] = useState<'pending' | 'all'>('pending')

  // Add part form
  const [form, setForm] = useState({
    part_number: '', description: '', category: 'Other', on_hand: '0',
    reorder_point: '2', cost_price: '0', sell_price: '0', vendor: '',
    bin_location: '', core_charge: '0', warranty_months: '0',
  })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

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
    const { data } = await supabase
      .from('parts')
      .select('id, part_number, description, category, on_hand, reorder_point, cost_price, sell_price, vendor, bin_location, core_charge, warranty_months')
      .eq('shop_id', shopId)
      .order('description')
    setParts(data || [])
    setLoading(false)
  }, [supabase])

  const loadRequests = useCallback(async (shopId: string) => {
    const { data } = await supabase
      .from('parts_requests')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(200)
    setRequests(data || [])
    setReqLoading(false)
  }, [supabase])

  const filtered = parts.filter(p => {
    if (lowStockOnly && p.on_hand > p.reorder_point) return false
    if (!search) return true
    const s = search.toLowerCase()
    return p.description?.toLowerCase().includes(s) || p.part_number?.toLowerCase().includes(s)
  })

  const margin = (p: any) => p.sell_price && p.cost_price ? Math.round((p.sell_price - p.cost_price) / p.sell_price * 100) : 0

  async function handleFulfill(reqId: string) {
    await supabase.from('parts_requests').update({ status: 'ready', ready_at: new Date().toISOString() }).eq('id', reqId)
    setRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: 'ready', ready_at: new Date().toISOString() } : r))
  }

  async function handleCancel(reqId: string) {
    await supabase.from('parts_requests').update({ status: 'cancelled' }).eq('id', reqId)
    setRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: 'cancelled' } : r))
  }

  function startEdit(p: any) {
    setEditingId(p.id)
    setEditVals({ on_hand: p.on_hand, cost_price: p.cost_price, sell_price: p.sell_price, reorder_point: p.reorder_point, bin_location: p.bin_location || '' })
  }

  async function saveEdit() {
    if (!editingId) return
    await supabase.from('parts').update({
      on_hand: parseInt(editVals.on_hand) || 0,
      cost_price: parseFloat(editVals.cost_price) || 0,
      sell_price: parseFloat(editVals.sell_price) || 0,
      reorder_point: parseInt(editVals.reorder_point) || 0,
      bin_location: editVals.bin_location || null,
    }).eq('id', editingId)
    setParts(prev => prev.map(p => p.id === editingId ? { ...p, ...editVals, on_hand: parseInt(editVals.on_hand) || 0, cost_price: parseFloat(editVals.cost_price) || 0, sell_price: parseFloat(editVals.sell_price) || 0, reorder_point: parseInt(editVals.reorder_point) || 0 } : p))
    setEditingId(null)
  }

  async function handleAddPart(e: React.FormEvent) {
    e.preventDefault()
    if (!form.description.trim()) { setSaveMsg('Description is required'); return }
    setSaving(true); setSaveMsg('')
    const res = await fetch('/api/parts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const newPart = await res.json()
      setParts(prev => [...prev, newPart].sort((a, b) => (a.description || '').localeCompare(b.description || '')))
      setForm({ part_number: '', description: '', category: 'Other', on_hand: '0', reorder_point: '2', cost_price: '0', sell_price: '0', vendor: '', bin_location: '', core_charge: '0', warranty_months: '0' })
      setSaveMsg('Part added successfully')
      setTab(1) // Switch to inventory
    } else {
      const err = await res.json()
      setSaveMsg(err.error || 'Failed to add part')
    }
    setSaving(false)
  }

  const filteredReqs = reqFilter === 'pending'
    ? requests.filter(r => ['pending', 'approved', 'ordered'].includes(r.status))
    : requests

  const TABS = ['Requests', 'Inventory', 'Add Part']

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', background: '#1C2130', border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 8, color: TEXT, fontSize: 12, fontFamily: FONT, outline: 'none', width: '100%', boxSizing: 'border-box',
  }

  const btnPrimary: React.CSSProperties = {
    padding: '8px 16px', background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', border: 'none',
    borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
  }

  const statusColor = (s: string) => {
    if (s === 'ready' || s === 'collected' || s === 'picked_up') return GREEN
    if (s === 'cancelled' || s === 'rejected') return RED
    if (s === 'ordered') return AMBER
    return BLUE
  }

  return (
    <div style={{ background: BG, minHeight: '100vh', color: TEXT, fontFamily: FONT, padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontFamily: HEADING, fontSize: 28, color: WHITE }}>Parts Department</div>
          <div style={{ fontSize: 12, color: MUTED }}>
            {parts.length} parts · {parts.filter(p => p.on_hand <= p.reorder_point).length} low stock · {requests.filter(r => r.status === 'pending').length} pending requests
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,.08)', marginBottom: 20 }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            padding: '10px 18px', fontSize: 12, fontWeight: tab === i ? 700 : 400,
            color: tab === i ? BLUE : MUTED, background: 'none', border: 'none',
            borderBottom: tab === i ? `2px solid ${BLUE}` : '2px solid transparent',
            cursor: 'pointer', fontFamily: FONT,
          }}>
            {t}
            {i === 0 && requests.filter(r => r.status === 'pending').length > 0 && (
              <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 100, background: `${RED}20`, color: RED, fontSize: 9, fontWeight: 700 }}>
                {requests.filter(r => r.status === 'pending').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab 0: Requests */}
      {tab === 0 && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button onClick={() => setReqFilter('pending')} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${reqFilter === 'pending' ? BLUE : 'rgba(255,255,255,.08)'}`, background: reqFilter === 'pending' ? `${BLUE}15` : 'transparent', color: reqFilter === 'pending' ? BLUE : MUTED, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
              Pending
            </button>
            <button onClick={() => setReqFilter('all')} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${reqFilter === 'all' ? BLUE : 'rgba(255,255,255,.08)'}`, background: reqFilter === 'all' ? `${BLUE}15` : 'transparent', color: reqFilter === 'all' ? BLUE : MUTED, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
              All
            </button>
          </div>

          {reqLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: MUTED }}>Loading requests...</div>
          ) : filteredReqs.length === 0 ? (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 32, textAlign: 'center', color: MUTED }}>
              {reqFilter === 'pending' ? 'No pending parts requests' : 'No parts requests found'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredReqs.map(r => (
                <div key={r.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: WHITE, marginBottom: 3 }}>
                        {r.part_name || r.description || 'Part Request'}
                      </div>
                      {r.part_number && <div style={{ fontFamily: MONO, fontSize: 10, color: BLUE, marginBottom: 3 }}>{r.part_number}</div>}
                      <div style={{ fontSize: 11, color: MUTED }}>
                        Qty: {r.quantity || 1} · Priority: <span style={{ color: r.priority === 'urgent' ? RED : r.priority === 'high' ? AMBER : MUTED, fontWeight: 600 }}>{r.priority || 'normal'}</span>
                      </div>
                      {r.notes && <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{r.notes}</div>}
                      <div style={{ fontSize: 10, color: '#48536A', marginTop: 4 }}>
                        {r.created_at ? new Date(r.created_at).toLocaleString() : ''}
                        {r.bin_location ? ` · Bin: ${r.bin_location}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 100,
                        fontFamily: MONO, fontSize: 8, background: `${statusColor(r.status)}15`, color: statusColor(r.status),
                        border: `1px solid ${statusColor(r.status)}33`,
                      }}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor' }} />
                        {r.status}
                      </span>
                      {(r.status === 'pending' || r.status === 'approved') && (
                        <>
                          <button onClick={() => handleFulfill(r.id)} style={{ padding: '4px 10px', background: `${GREEN}15`, border: `1px solid ${GREEN}33`, borderRadius: 6, color: GREEN, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
                            Fulfill
                          </button>
                          <button onClick={() => handleCancel(r.id)} style={{ padding: '4px 10px', background: `${RED}15`, border: `1px solid ${RED}33`, borderRadius: 6, color: RED, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 1: Inventory */}
      {tab === 1 && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search parts..." style={{ ...inputStyle, maxWidth: 240 }} />
            <button onClick={() => setLowStockOnly(!lowStockOnly)} style={{
              padding: '7px 14px', borderRadius: 8,
              border: `1px solid ${lowStockOnly ? AMBER : 'rgba(255,255,255,.08)'}`,
              background: lowStockOnly ? `${AMBER}15` : 'transparent',
              color: lowStockOnly ? AMBER : MUTED, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
            }}>
              Low Stock ({parts.filter(p => p.on_hand <= p.reorder_point).length})
            </button>
            <button onClick={() => setTab(2)} style={btnPrimary}>+ Add Part</button>
          </div>

          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  <tr>{['Part #', 'Description', 'Category', 'On Hand', 'Reorder', 'Cost', 'Sell', 'Margin', 'Bin', 'Status', ''].map(h =>
                    <th key={h} style={{ fontFamily: MONO, fontSize: 8, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.1em', padding: '7px 10px', textAlign: 'left', background: '#0B0D11', whiteSpace: 'nowrap' }}>{h}</th>
                  )}</tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={11} style={{ textAlign: 'center', padding: 40, color: MUTED }}>Loading...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={11} style={{ textAlign: 'center', padding: 40, color: MUTED }}>No parts found</td></tr>
                  ) : filtered.map(p => {
                    const isLow = p.on_hand <= p.reorder_point
                    const isOut = p.on_hand === 0
                    const m = margin(p)
                    const isEditing = editingId === p.id

                    if (isEditing) {
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,.025)', background: 'rgba(29,111,232,.03)' }}>
                          <td style={{ padding: '6px 10px', fontFamily: MONO, fontSize: 10, color: BLUE }}>{p.part_number}</td>
                          <td style={{ padding: '6px 10px', color: WHITE, fontSize: 12 }}>{p.description}</td>
                          <td style={{ padding: '6px 10px', fontSize: 10, color: MUTED }}>{p.category}</td>
                          <td style={{ padding: '6px 10px' }}>
                            <input value={editVals.on_hand} onChange={e => setEditVals({ ...editVals, on_hand: e.target.value })} style={{ ...inputStyle, width: 50, padding: '3px 6px', fontSize: 11, textAlign: 'center' }} />
                          </td>
                          <td style={{ padding: '6px 10px' }}>
                            <input value={editVals.reorder_point} onChange={e => setEditVals({ ...editVals, reorder_point: e.target.value })} style={{ ...inputStyle, width: 50, padding: '3px 6px', fontSize: 11, textAlign: 'center' }} />
                          </td>
                          <td style={{ padding: '6px 10px' }}>
                            <input value={editVals.cost_price} onChange={e => setEditVals({ ...editVals, cost_price: e.target.value })} style={{ ...inputStyle, width: 60, padding: '3px 6px', fontSize: 11 }} />
                          </td>
                          <td style={{ padding: '6px 10px' }}>
                            <input value={editVals.sell_price} onChange={e => setEditVals({ ...editVals, sell_price: e.target.value })} style={{ ...inputStyle, width: 60, padding: '3px 6px', fontSize: 11 }} />
                          </td>
                          <td style={{ padding: '6px 10px', fontFamily: MONO, fontSize: 10, color: MUTED }}>—</td>
                          <td style={{ padding: '6px 10px' }}>
                            <input value={editVals.bin_location} onChange={e => setEditVals({ ...editVals, bin_location: e.target.value })} style={{ ...inputStyle, width: 60, padding: '3px 6px', fontSize: 11 }} />
                          </td>
                          <td style={{ padding: '6px 10px' }}>—</td>
                          <td style={{ padding: '6px 10px', display: 'flex', gap: 4 }}>
                            <button onClick={saveEdit} style={{ padding: '3px 8px', background: `${GREEN}15`, border: `1px solid ${GREEN}33`, borderRadius: 4, color: GREEN, fontSize: 9, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>Save</button>
                            <button onClick={() => setEditingId(null)} style={{ padding: '3px 8px', background: 'transparent', border: '1px solid rgba(255,255,255,.08)', borderRadius: 4, color: MUTED, fontSize: 9, cursor: 'pointer', fontFamily: FONT }}>Cancel</button>
                          </td>
                        </tr>
                      )
                    }

                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,.025)' }}>
                        <td style={{ padding: '9px 10px', fontFamily: MONO, fontSize: 10, color: BLUE }}>{p.part_number}</td>
                        <td style={{ padding: '9px 10px', color: WHITE, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</td>
                        <td style={{ padding: '9px 10px', fontSize: 10, color: MUTED }}>{p.category}</td>
                        <td style={{ padding: '9px 10px', fontFamily: MONO, fontSize: 11, fontWeight: 700, color: isOut ? RED : isLow ? AMBER : TEXT, textAlign: 'center' }}>{p.on_hand}</td>
                        <td style={{ padding: '9px 10px', fontFamily: MONO, fontSize: 10, color: MUTED, textAlign: 'center' }}>{p.reorder_point}</td>
                        <td style={{ padding: '9px 10px', fontFamily: MONO, fontSize: 10, color: MUTED }}>{'$' + (p.cost_price || 0).toFixed(0)}</td>
                        <td style={{ padding: '9px 10px', fontFamily: MONO, fontSize: 10, color: TEXT }}>{'$' + (p.sell_price || 0).toFixed(0)}</td>
                        <td style={{ padding: '9px 10px', fontFamily: MONO, fontSize: 10, fontWeight: 700, color: m >= 40 ? GREEN : m >= 25 ? AMBER : RED }}>{m}%</td>
                        <td style={{ padding: '9px 10px', fontFamily: MONO, fontSize: 10, color: '#48536A' }}>{p.bin_location}</td>
                        <td style={{ padding: '9px 10px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 100, fontFamily: MONO, fontSize: 8, background: isOut ? 'rgba(217,79,79,.1)' : isLow ? 'rgba(212,136,42,.1)' : 'rgba(29,184,112,.1)', color: isOut ? RED : isLow ? AMBER : GREEN, border: '1px solid currentColor' }}>
                            <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor' }} />
                            {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                          </span>
                        </td>
                        <td style={{ padding: '9px 10px' }}>
                          <button onClick={() => startEdit(p)} style={{ padding: '3px 8px', background: 'transparent', border: '1px solid rgba(255,255,255,.08)', borderRadius: 4, color: MUTED, fontSize: 9, cursor: 'pointer', fontFamily: FONT }}>Edit</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Add Part */}
      {tab === 2 && (
        <div style={{ maxWidth: 560 }}>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: WHITE, marginBottom: 16 }}>Add New Part</div>

            {saveMsg && (
              <div style={{ padding: '8px 12px', borderRadius: 8, marginBottom: 16, fontSize: 12, fontWeight: 600, background: saveMsg.includes('success') ? `${GREEN}15` : `${RED}15`, color: saveMsg.includes('success') ? GREEN : RED, border: `1px solid ${saveMsg.includes('success') ? GREEN : RED}33` }}>
                {saveMsg}
              </div>
            )}

            <form onSubmit={handleAddPart}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4, display: 'block' }}>Part Number</label>
                  <input value={form.part_number} onChange={e => setForm({ ...form, part_number: e.target.value })} placeholder="e.g. BW-1234" style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4, display: 'block' }}>Category</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={{ ...inputStyle, appearance: 'auto' }}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4, display: 'block' }}>Description *</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Part description" style={inputStyle} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4, display: 'block' }}>On Hand</label>
                  <input type="number" value={form.on_hand} onChange={e => setForm({ ...form, on_hand: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4, display: 'block' }}>Reorder At</label>
                  <input type="number" value={form.reorder_point} onChange={e => setForm({ ...form, reorder_point: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4, display: 'block' }}>Cost Price</label>
                  <input type="number" step="0.01" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4, display: 'block' }}>Sell Price</label>
                  <input type="number" step="0.01" value={form.sell_price} onChange={e => setForm({ ...form, sell_price: e.target.value })} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4, display: 'block' }}>Vendor</label>
                  <input value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} placeholder="Vendor name" style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4, display: 'block' }}>Bin Location</label>
                  <input value={form.bin_location} onChange={e => setForm({ ...form, bin_location: e.target.value })} placeholder="e.g. A-12" style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4, display: 'block' }}>Core Charge</label>
                  <input type="number" step="0.01" value={form.core_charge} onChange={e => setForm({ ...form, core_charge: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4, display: 'block' }}>Warranty (months)</label>
                  <input type="number" value={form.warranty_months} onChange={e => setForm({ ...form, warranty_months: e.target.value })} style={inputStyle} />
                </div>
              </div>

              <button type="submit" disabled={saving} style={{ ...btnPrimary, padding: '10px 24px', fontSize: 13, opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving...' : 'Add Part'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
