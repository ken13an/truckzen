'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { ChevronLeft, Check, Clock, Truck, Package } from 'lucide-react'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const BLUE = '#1B6EE6', GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F', MUTED = '#7C8BA0'

const statusOptions: Record<string, { label: string; color: string }> = {
  rough: { label: 'Rough', color: MUTED },
  sourced: { label: 'Sourced', color: BLUE },
  ordered: { label: 'Ordered', color: AMBER },
  received: { label: 'Received', color: GREEN },
  installed: { label: 'Installed', color: '#059669' },
}

export default function PartsWOView() {
  const params = useParams()
  const woId = params.id as string
  const supabase = createClient()

  const [user, setUser] = useState<any>(null)
  const [wo, setWo] = useState<any>(null)
  const [partLines, setPartLines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [searchResults, setSearchResults] = useState<Record<string, any[]>>({})
  const [shopLaborRates, setShopLaborRates] = useState<any[]>([])
  const dropdownClicked = useRef(false)
  const searchTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const loadData = useCallback(async () => {
    const woRes = await fetch(`/api/work-orders/${woId}`)
    if (!woRes.ok) { window.location.href = '/parts/queue'; return }
    const woData = await woRes.json()
    setWo(woData)
    const lines = (woData.so_lines || []).filter((l: any) => l.line_type === 'part')
    setPartLines(lines)
    if (woData.shop_id) {
      const ratesRes = await fetch(`/api/settings/labor-rates?shop_id=${woData.shop_id}`)
      if (ratesRes.ok) {
        const ratesData = await ratesRes.json()
        setShopLaborRates(ratesData)
      }
    }
  }, [woId])

  useEffect(() => {
    getCurrentUser(supabase).then(p => {
      if (!p) { window.location.href = '/login'; return }
      setUser(p)
      loadData().then(() => setLoading(false))
    })
  }, [])

  async function patchLine(lineId: string, data: Record<string, any>) {
    const res = await fetch(`/api/so-lines/${lineId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) await loadData()
    return res
  }

  // Save to DB without reloading — prevents focus loss on text inputs
  async function saveLineQuiet(lineId: string, data: Record<string, any>) {
    await fetch(`/api/so-lines/${lineId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  }

  function updateLocalLine(lineId: string, field: string, value: any) {
    setPartLines(prev => prev.map(l => l.id === lineId ? { ...l, [field]: value } : l))
  }

  function searchInventory(lineId: string, query: string) {
    if (searchTimers.current[lineId]) clearTimeout(searchTimers.current[lineId])
    if (!query || query.length < 2 || !wo?.shop_id) {
      setSearchResults(prev => { const n = { ...prev }; delete n[lineId]; return n })
      return
    }
    searchTimers.current[lineId] = setTimeout(async () => {
      const res = await fetch(`/api/parts/search?shop_id=${wo.shop_id}&q=${encodeURIComponent(query)}`)
      if (res.ok) {
        const results = await res.json()
        setSearchResults(prev => ({ ...prev, [lineId]: results }))
      }
    }, 300)
  }

  async function autoFillFromInventory(lineId: string, invPart: any) {
    let sellPrice = invPart.sell_price || 0
    const costPrice = invPart.cost_price || invPart.average_cost || 0
    const ownershipType = wo?.ownership_type || wo?.assets?.ownership_type
    if (costPrice > 0 && ownershipType && shopLaborRates.length > 0) {
      const rate = shopLaborRates.find((r: any) => r.ownership_type === ownershipType)
      if (rate) {
        if (rate.parts_pricing_mode === 'margin' && rate.parts_margin_pct > 0) {
          sellPrice = costPrice / (1 - rate.parts_margin_pct / 100)
        } else if (rate.parts_markup_pct > 0) {
          sellPrice = costPrice * (1 + rate.parts_markup_pct / 100)
        }
      }
    }
    // Fallback: if sell is still 0 but cost exists, apply 30% default markup
    if (sellPrice <= 0 && costPrice > 0) {
      sellPrice = costPrice * 1.3
    }
    const res = await patchLine(lineId, {
      real_name: invPart.description,
      part_number: invPart.part_number,
      parts_cost_price: costPrice,
      parts_sell_price: Math.round(sellPrice * 100) / 100,
      parts_status: 'sourced',
    })
    setSearchResults(prev => { const n = { ...prev }; delete n[lineId]; return n })
    if (!res || !res.ok) {
      alert('Failed to save part — check your permissions and try again')
    }
  }

  const fmt = (n: number | null | undefined) => n != null ? '$' + Number(n).toFixed(2) : '--'
  const customer = wo?.customers || {}
  const asset = wo?.assets || {}
  const pricingTierLabel = customer.pricing_tier === 'ugl_company' ? 'UGL Company' : customer.pricing_tier === 'ugl_owner_operator' ? 'UGL Owner Op.' : 'Outside'
  const tierColor = customer.pricing_tier === 'ugl_company' ? BLUE : customer.pricing_tier === 'ugl_owner_operator' ? AMBER : MUTED

  const allSourced = partLines.length > 0 && partLines.every((l: any) => l.parts_status !== 'rough' && l.real_name)
  const sourcedCount = partLines.filter((l: any) => l.real_name).length
  // Parts locked once invoice submitted to accounting
  // Parts locked after invoice sent (not during accounting_review — accounting can still edit)
  const partsLocked = !!wo?.invoice_status && ['sent', 'paid', 'closed'].includes(wo.invoice_status)

  if (loading) return <div style={{ background: '#060708', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontFamily: FONT }}>Loading...</div>
  if (!wo) return null

  return (
    <div style={{ background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: FONT, padding: 24 }}>
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 999, background: GREEN, color: '#fff', padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>{toast}</div>}

      <a href="/parts/queue" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: MUTED, textDecoration: 'none', fontSize: 12, marginBottom: 16 }}>
        <ChevronLeft size={14} /> Back to Parts Queue
      </a>

      {/* Header */}
      <div style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: BLUE }}>WO #{wo.so_number}</span>
              <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: `${tierColor}20`, color: tierColor, textTransform: 'uppercase' }}>{pricingTierLabel}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#F0F4FF' }}>
              <Truck size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              #{asset.unit_number || '—'} {[asset.year, asset.make, asset.model].filter(Boolean).join(' ')}
            </div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{customer.company_name || '—'}</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, color: MUTED }}>
            {wo.users?.full_name && <div>Mechanic: <span style={{ color: '#F0F4FF' }}>{wo.users.full_name}</span></div>}
            {wo.complaint && <div style={{ marginTop: 4, maxWidth: 300, fontSize: 11 }}>Complaint: {wo.complaint}</div>}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {partLines.length > 0 && (
        <div style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <Package size={16} color={allSourced ? GREEN : AMBER} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: allSourced ? GREEN : AMBER, marginBottom: 4 }}>
              {sourcedCount}/{partLines.length} parts sourced
            </div>
            <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,.08)', borderRadius: 2 }}>
              <div style={{ width: `${(sourcedCount / partLines.length) * 100}%`, height: '100%', background: allSourced ? GREEN : AMBER, borderRadius: 2, transition: 'width .3s' }} />
            </div>
          </div>
        </div>
      )}

      {/* Parts locked banner */}
      {partsLocked && (
        <div style={{ background: 'rgba(124,139,160,.06)', border: '1px solid rgba(124,139,160,.2)', borderRadius: 10, padding: '10px 16px', marginBottom: 12, fontSize: 12, color: MUTED, fontWeight: 600, textAlign: 'center' }}>
          Parts locked — invoice submitted to accounting ({wo.invoice_status?.replace(/_/g, ' ')})
        </div>
      )}

      {/* Part Lines from so_lines */}
      <div style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#F0F4FF', marginBottom: 16 }}>
          Parts ({partLines.length})
        </div>

        {partLines.length === 0 && (
          <div style={{ padding: 30, textAlign: 'center', color: '#48536A', fontSize: 12 }}>No part lines on this work order.</div>
        )}

        {partLines.map((p: any) => {
          const st = statusOptions[p.parts_status || 'rough'] || statusOptions.rough
          return (
            <div key={p.id} style={{ border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: 14, marginBottom: 10, background: p.parts_status === 'rough' || !p.real_name ? '#0A0C10' : '#0D0F12' }}>
              {/* Top row: rough name + status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: MUTED }}>
                  Suggested: <strong style={{ color: '#9CA3B0' }}>{p.rough_name || p.description || '—'}</strong>
                </div>
                {partsLocked ? (
                  <span style={{ fontSize: 10, fontWeight: 700, color: st.color, background: `${st.color}18`, padding: '3px 10px', borderRadius: 6, textTransform: 'uppercase' }}>{st.label}</span>
                ) : (
                  <select
                    value={p.parts_status || 'rough'}
                    onChange={async e => { await patchLine(p.id, { parts_status: e.target.value }) }}
                    style={{
                      fontSize: 10, fontWeight: 700, color: st.color, background: `${st.color}18`,
                      padding: '3px 10px', borderRadius: 6, border: 'none', fontFamily: FONT, cursor: 'pointer',
                      textTransform: 'uppercase',
                    }}
                  >
                    {Object.entries(statusOptions).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Editable fields grid — locked after invoice submission */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 60px 90px 90px', gap: 8, opacity: partsLocked ? 0.7 : 1, pointerEvents: partsLocked ? 'none' : 'auto' }}>
                {/* Real Name with search dropdown */}
                <div style={{ position: 'relative' }}>
                  <span style={labelStyle}>Real Name</span>
                  <input
                    value={p.real_name || ''}
                    onChange={e => {
                      updateLocalLine(p.id, 'real_name', e.target.value)
                      searchInventory(p.id, e.target.value)
                    }}
                    onBlur={e => {
                      if (dropdownClicked.current) { dropdownClicked.current = false; return }
                      if (e.target.value) saveLineQuiet(p.id, { real_name: e.target.value })
                      setTimeout(() => setSearchResults(prev => { const n = { ...prev }; delete n[p.id]; return n }), 200)
                    }}
                    placeholder="Type to search inventory..."
                    style={inputStyle}
                  />
                  {searchResults[p.id]?.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1A1F2B', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, marginTop: 2, zIndex: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.4)', maxHeight: 180, overflowY: 'auto' }}>
                      {searchResults[p.id].map((inv: any) => (
                        <div
                          key={inv.id}
                          onMouseDown={() => { dropdownClicked.current = true; autoFillFromInventory(p.id, inv) }}
                          style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,.06)', fontSize: 12 }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#242A38')}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}
                        >
                          <div style={{ fontWeight: 600, color: '#F0F4FF' }}>{inv.description}</div>
                          <div style={{ fontSize: 10, color: MUTED }}>
                            {inv.part_number || '—'} · Cost: {fmt(inv.cost_price)} · Sell: {fmt(inv.sell_price)} · {inv.on_hand || 0} in stock
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Part # */}
                <div>
                  <span style={labelStyle}>Part #</span>
                  <input
                    value={p.part_number || ''}
                    onChange={e => {
                      updateLocalLine(p.id, 'part_number', e.target.value)
                      searchInventory(p.id, e.target.value)
                    }}
                    onBlur={e => {
                      if (dropdownClicked.current) return
                      saveLineQuiet(p.id, { part_number: e.target.value })
                      setTimeout(() => setSearchResults(prev => { const n = { ...prev }; delete n[p.id]; return n }), 200)
                    }}
                    placeholder="PN"
                    style={inputStyle}
                  />
                </div>

                {/* Qty */}
                <div>
                  <span style={labelStyle}>Qty</span>
                  <input
                    type="number"
                    value={p.quantity || 1}
                    onChange={e => updateLocalLine(p.id, 'quantity', parseInt(e.target.value) || 1)}
                    onBlur={e => saveLineQuiet(p.id, { quantity: parseInt(e.target.value) || 1 })}
                    style={inputStyle}
                  />
                </div>

                {/* Cost */}
                <div>
                  <span style={labelStyle}>Cost</span>
                  <input
                    type="number"
                    step="0.01"
                    value={p.parts_cost_price ?? ''}
                    onChange={e => updateLocalLine(p.id, 'parts_cost_price', e.target.value === '' ? '' : parseFloat(e.target.value))}
                    onBlur={e => saveLineQuiet(p.id, { parts_cost_price: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    style={inputStyle}
                  />
                </div>

                {/* Sell */}
                <div>
                  <span style={labelStyle}>Sell</span>
                  <input
                    type="number"
                    step="0.01"
                    value={p.parts_sell_price ?? ''}
                    onChange={e => updateLocalLine(p.id, 'parts_sell_price', e.target.value === '' ? '' : parseFloat(e.target.value))}
                    onBlur={e => saveLineQuiet(p.id, { parts_sell_price: parseFloat(e.target.value) || 0, total_price: (parseFloat(e.target.value) || 0) * (p.quantity || 1) })}
                    placeholder="0.00"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 9, fontWeight: 700, color: '#48536A',
  textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4,
  fontFamily: "'IBM Plex Mono',monospace",
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,.04)',
  border: '1px solid rgba(255,255,255,.08)',
  borderRadius: 6,
  padding: '6px 8px',
  fontSize: 11,
  color: '#F0F4FF',
  fontFamily: "'Instrument Sans',sans-serif",
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}
