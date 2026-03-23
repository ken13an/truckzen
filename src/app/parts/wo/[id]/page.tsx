'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { ChevronLeft, Plus, X, Check, Clock, Truck, Package, AlertTriangle } from 'lucide-react'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const BLUE = '#1B6EE6', GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F', MUTED = '#7C8BA0'

interface LineItem {
  part_number: string
  description: string
  quantity: number
  unit_price: number | null
  in_stock: boolean
  ordered: boolean
  eta: string | null
  notes: string
}

const emptyLine = (): LineItem => ({ part_number: '', description: '', quantity: 1, unit_price: null, in_stock: true, ordered: false, eta: null, notes: '' })

export default function PartsWOView() {
  const params = useParams()
  const woId = params.id as string
  const supabase = createClient()

  const [user, setUser] = useState<any>(null)
  const [wo, setWo] = useState<any>(null)
  const [partsRequest, setPartsRequest] = useState<any>(null)
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const loadData = useCallback(async (profile: any) => {
    // Fetch WO with customer + asset info
    const woRes = await fetch(`/api/work-orders/${woId}`)
    if (!woRes.ok) { window.location.href = '/parts/queue'; return }
    const woData = await woRes.json()
    setWo(woData)

    // Fetch parts request for this WO
    const prRes = await fetch(`/api/parts-requests?shop_id=${profile.shop_id}&so_id=${woId}`)
    if (prRes.ok) {
      const prList = await prRes.json()
      if (prList.length > 0) {
        const pr = prList[0]
        setPartsRequest(pr)
        if (pr.line_items && Array.isArray(pr.line_items) && pr.line_items.length > 0) {
          setLineItems(pr.line_items)
        } else {
          // Initialize from AI suggested parts on so_lines
          const aiLines = (woData.so_lines || [])
            .filter((l: any) => l.line_type === 'part')
            .map((l: any) => ({
              part_number: l.part_number || '',
              description: l.rough_name || l.description || '',
              quantity: l.quantity || 1,
              unit_price: null,
              in_stock: true,
              ordered: false,
              eta: null,
              notes: '',
            }))
          setLineItems(aiLines.length > 0 ? aiLines : [emptyLine()])
        }
      } else {
        // No parts request yet — create one
        const createRes = await fetch('/api/mechanic/parts-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shop_id: profile.shop_id,
            so_id: woId,
            user_id: profile.id,
            part_name: 'Parts for WO',
            quantity: 1,
          }),
        })
        if (createRes.ok) {
          const newPr = await createRes.json()
          setPartsRequest(newPr)
        }
        // Initialize from AI parts
        const aiLines = (woData.so_lines || [])
          .filter((l: any) => l.line_type === 'part')
          .map((l: any) => ({
            part_number: l.part_number || '',
            description: l.rough_name || l.description || '',
            quantity: l.quantity || 1,
            unit_price: null,
            in_stock: true,
            ordered: false,
            eta: null,
            notes: '',
          }))
        setLineItems(aiLines.length > 0 ? aiLines : [emptyLine()])
      }
    }
    setLoading(false)
  }, [woId])

  useEffect(() => {
    getCurrentUser(supabase).then(p => {
      if (!p) { window.location.href = '/login'; return }
      setUser(p)
      loadData(p)
    })
  }, [])

  // Part number lookup
  async function lookupPart(index: number, partNumber: string) {
    if (!partNumber || !wo) return
    const customerId = wo.customer_id || wo.customers?.id
    const res = await fetch(`/api/parts/lookup?part_number=${encodeURIComponent(partNumber)}&customer_id=${customerId || ''}`)
    if (!res.ok) return
    const data = await res.json()
    if (data.found) {
      setLineItems(prev => prev.map((l, i) => i === index ? {
        ...l,
        description: data.description || l.description,
        unit_price: data.unit_price,
        in_stock: data.in_stock,
      } : l))
    }
  }

  function updateLine(index: number, field: keyof LineItem, value: any) {
    setLineItems(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l))
  }

  function addLine() { setLineItems(prev => [...prev, emptyLine()]) }
  function removeLine(index: number) { setLineItems(prev => prev.filter((_, i) => i !== index)) }

  // Save line items
  async function saveLineItems() {
    if (!partsRequest) return
    setSaving(true)
    await fetch(`/api/parts-requests/${partsRequest.id}/line-items`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line_items: lineItems }),
    })
    setSaving(false)
    flash('Saved')
  }

  // Submit
  async function submitParts() {
    if (!partsRequest || !user) return
    setSaving(true)
    const res = await fetch(`/api/parts-requests/${partsRequest.id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, line_items: lineItems }),
    })
    if (res.ok) {
      const data = await res.json()
      setPartsRequest(data)
      flash('Submitted — supervisor and mechanic notified')
    }
    setSaving(false)
  }

  // Mark ready
  async function markReady(partial: boolean = false) {
    if (!partsRequest) return
    setSaving(true)
    const res = await fetch(`/api/parts-requests/${partsRequest.id}/ready`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partial }),
    })
    if (res.ok) {
      const data = await res.json()
      setPartsRequest(data)
      flash(partial ? 'Marked partially ready' : 'Parts marked ready — mechanic notified')
    }
    setSaving(false)
  }

  const fmt = (n: number | null) => n != null ? '$' + Number(n).toFixed(2) : '--'
  const status = partsRequest?.status || 'pending'
  const isSubmitted = ['submitted', 'partial', 'ready', 'delivered'].includes(status)
  const isReady = status === 'ready'
  const hasOrderedItems = lineItems.some(l => !l.in_stock && l.ordered)
  const hasInStockItems = lineItems.some(l => l.in_stock)
  const allInStock = lineItems.every(l => l.in_stock)

  const customer = wo?.customers || {}
  const asset = wo?.assets || {}
  const pricingTierLabel = customer.pricing_tier === 'ugl_company' ? 'UGL Company' : customer.pricing_tier === 'ugl_owner_operator' ? 'UGL Owner Op.' : 'Outside'
  const tierColor = customer.pricing_tier === 'ugl_company' ? BLUE : customer.pricing_tier === 'ugl_owner_operator' ? AMBER : MUTED

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
              <span style={{
                padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                background: isReady ? `${GREEN}20` : isSubmitted ? `${AMBER}20` : `${MUTED}20`,
                color: isReady ? GREEN : isSubmitted ? AMBER : MUTED,
                textTransform: 'uppercase',
              }}>{status}</span>
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

      {/* Ready banner */}
      {isReady && (
        <div style={{ background: `${GREEN}15`, border: `1px solid ${GREEN}40`, borderRadius: 12, padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Check size={18} color={GREEN} />
          <span style={{ fontSize: 13, fontWeight: 600, color: GREEN }}>Parts Ready — waiting for mechanic pickup</span>
          {partsRequest?.parts_ready_at && <span style={{ fontSize: 11, color: MUTED, marginLeft: 'auto', fontFamily: MONO }}>{new Date(partsRequest.parts_ready_at).toLocaleString()}</span>}
        </div>
      )}

      {/* Submitted banner */}
      {status === 'submitted' && (
        <div style={{ background: `${AMBER}15`, border: `1px solid ${AMBER}40`, borderRadius: 12, padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Clock size={18} color={AMBER} />
          <span style={{ fontSize: 13, fontWeight: 600, color: AMBER }}>Submitted — parts being prepared</span>
          {partsRequest?.submitted_at && <span style={{ fontSize: 11, color: MUTED, marginLeft: 'auto', fontFamily: MONO }}>{new Date(partsRequest.submitted_at).toLocaleString()}</span>}
        </div>
      )}

      {/* Line Items */}
      <div style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#F0F4FF' }}>Parts Line Items ({lineItems.length})</div>
          <button onClick={addLine} style={{ display: 'flex', alignItems: 'center', gap: 4, background: `${BLUE}15`, color: BLUE, border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={12} /> Add Part
          </button>
        </div>

        {/* Column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 60px 90px 140px 80px 1fr 32px', gap: 8, padding: '6px 0', fontSize: 9, fontWeight: 700, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: MONO, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
          <div>Part #</div><div>Description</div><div>Qty</div><div>Unit Price</div><div>Stock Status</div><div>ETA</div><div>Notes</div><div />
        </div>

        {/* Line rows */}
        {lineItems.map((line, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 60px 90px 140px 80px 1fr 32px', gap: 8, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.03)', alignItems: 'center' }}>
            {/* Part Number */}
            <input
              value={line.part_number}
              onChange={e => updateLine(i, 'part_number', e.target.value)}
              onBlur={e => lookupPart(i, e.target.value)}
              placeholder="Part #"
              style={inputStyle}
            />
            {/* Description */}
            <input value={line.description} onChange={e => updateLine(i, 'description', e.target.value)} placeholder="Description" style={inputStyle} />
            {/* Qty */}
            <input type="number" min={1} value={line.quantity} onChange={e => updateLine(i, 'quantity', parseInt(e.target.value) || 1)} style={{ ...inputStyle, textAlign: 'center' }} />
            {/* Price */}
            <div style={{ fontFamily: MONO, fontSize: 12, color: line.unit_price != null ? '#F0F4FF' : '#48536A', fontWeight: 600, padding: '0 4px' }}>
              {fmt(line.unit_price)}
            </div>
            {/* Stock status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <input type="checkbox" checked={line.in_stock} onChange={e => { updateLine(i, 'in_stock', e.target.checked); if (e.target.checked) updateLine(i, 'ordered', false) }} />
                <span style={{ fontSize: 10, color: line.in_stock ? GREEN : RED, fontWeight: 600 }}>
                  {line.in_stock ? 'In Stock' : 'Out'}
                </span>
              </label>
              {!line.in_stock && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                  <input type="checkbox" checked={line.ordered} onChange={e => updateLine(i, 'ordered', e.target.checked)} />
                  <span style={{ fontSize: 10, color: line.ordered ? AMBER : MUTED }}>Ordered</span>
                </label>
              )}
            </div>
            {/* ETA */}
            {!line.in_stock && line.ordered ? (
              <input type="date" value={line.eta || ''} onChange={e => updateLine(i, 'eta', e.target.value || null)} style={{ ...inputStyle, fontSize: 10, padding: '4px 6px' }} />
            ) : <div />}
            {/* Notes */}
            <input value={line.notes} onChange={e => updateLine(i, 'notes', e.target.value)} placeholder="Notes" style={inputStyle} />
            {/* Remove */}
            <button onClick={() => removeLine(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#48536A', padding: 4 }}>
              <X size={14} />
            </button>
          </div>
        ))}

        {lineItems.length === 0 && (
          <div style={{ padding: 30, textAlign: 'center', color: '#48536A', fontSize: 12 }}>No line items. Click "Add Part" to begin.</div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {/* Save */}
        <button onClick={saveLineItems} disabled={saving} style={{ padding: '10px 20px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#F0F4FF', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
          Save Changes
        </button>

        {/* Submit */}
        {!isSubmitted && (
          <button onClick={submitParts} disabled={saving || lineItems.length === 0} style={{ padding: '10px 20px', background: BLUE, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
            Submit — Notify Supervisor & Mechanic
          </button>
        )}

        {/* Mark Ready */}
        {isSubmitted && !isReady && allInStock && (
          <button onClick={() => markReady(false)} disabled={saving} style={{ padding: '10px 20px', background: GREEN, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
            Mark Parts Ready for Pickup
          </button>
        )}

        {/* Mark Partial Ready */}
        {isSubmitted && !isReady && hasInStockItems && !allInStock && (
          <button onClick={() => markReady(true)} disabled={saving} style={{ padding: '10px 20px', background: AMBER, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
            Mark Available Parts Ready
          </button>
        )}

        {/* Submitted indicator */}
        {isSubmitted && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', fontSize: 12, color: MUTED }}>
            <Check size={14} /> Submitted {partsRequest?.submitted_at && new Date(partsRequest.submitted_at).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  )
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
