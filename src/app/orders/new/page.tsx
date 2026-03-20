'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

export default function NewSOPage() {
  const supabase = createClient()
  const router = useRouter()

  const [user, setUser] = useState<any>(null)
  const [assets, setAssets] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [shopRate, setShopRate] = useState(145)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Form
  const [form, setForm] = useState({ asset_id: '', customer_id: '', complaint: '', cause: '', correction: '', source: 'walk_in', priority: 'normal', team: '', bay: '' })
  const [assetSearch, setAssetSearch] = useState('')
  const [filteredAssets, setFilteredAssets] = useState<any[]>([])
  const [selectedAsset, setSelectedAsset] = useState<any>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)

  // AI panel state
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<any>(null)
  const [suggestedParts, setSuggestedParts] = useState<any[]>([])
  const [addedParts, setAddedParts] = useState<any[]>([])
  const [laborHoursMin, setLaborHoursMin] = useState(0)
  const [laborHoursMax, setLaborHoursMax] = useState(0)
  const [laborHours, setLaborHours] = useState(0)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { router.push('/login'); return }
      setUser(profile)

      const [{ data: a }, { data: c }, { data: shop }] = await Promise.all([
        supabase.from('assets').select('id, unit_number, year, make, model, customer_id, engine_make').eq('shop_id', profile.shop_id).not('status', 'eq', 'retired').order('unit_number'),
        supabase.from('customers').select('id, company_name, contact_name, phone').eq('shop_id', profile.shop_id).order('company_name'),
        supabase.from('shops').select('labor_rate').eq('id', profile.shop_id).single(),
      ])
      setAssets(a || [])
      setCustomers(c || [])
      if (shop?.labor_rate) setShopRate(parseFloat(shop.labor_rate))
    }
    load()
  }, [])

  // Customer search — case-insensitive partial match on company_name, contact_name, phone
  useEffect(() => {
    if (!customerSearch || customerSearch.length < 1) { setFilteredCustomers([]); return }
    const q = customerSearch.toLowerCase()
    setFilteredCustomers(customers.filter(c =>
      (c.company_name || '').toLowerCase().includes(q) ||
      (c.contact_name || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q)
    ).slice(0, 10))
  }, [customerSearch, customers])

  function selectCustomer(cust: any) {
    setSelectedCustomer(cust)
    setCustomerSearch(cust.company_name)
    setFilteredCustomers([])
    setForm(f => ({ ...f, customer_id: cust.id }))
    // Clear vehicle selection when customer changes
    setSelectedAsset(null)
    setAssetSearch('')
    setFilteredAssets([])
    setForm(f => ({ ...f, asset_id: '' }))
  }

  // Truck search — filtered by selected customer if one is chosen
  useEffect(() => {
    if (!assetSearch) { setFilteredAssets([]); return }
    const q = assetSearch.toLowerCase()
    let pool = assets
    if (selectedCustomer) {
      pool = assets.filter(a => a.customer_id === selectedCustomer.id)
    }
    setFilteredAssets(pool.filter(a =>
      a.unit_number?.toLowerCase().includes(q) || a.make?.toLowerCase().includes(q) || a.model?.toLowerCase().includes(q)
    ).slice(0, 8))
  }, [assetSearch, assets, selectedCustomer])

  function selectAsset(asset: any) {
    setSelectedAsset(asset)
    const custName = customers.find((c: any) => c.id === asset.customer_id)?.company_name
    setAssetSearch(`#${asset.unit_number}${custName ? ` — ${custName}` : ''} — ${asset.year} ${asset.make} ${asset.model}`)
    setFilteredAssets([])
    // Only set customer_id from asset if no customer is already selected
    setForm(f => ({ ...f, asset_id: asset.id, customer_id: f.customer_id || asset.customer_id || '' }))
  }

  // ── VOICE INPUT ────────────────────────────────────────
  function startVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { setError('Voice input not supported in this browser. Use Chrome or Edge.'); return }

    const r = new SR()
    r.continuous = true
    r.interimResults = true
    r.lang = 'en-US'
    r.onresult = (e: any) => {
      let text = ''
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript
      setTranscript(text)
    }
    r.onerror = (e: any) => { console.log('Speech error:', e.error); setRecording(false) }
    r.onend = () => setRecording(false)
    r.start()
    recognitionRef.current = r
    setRecording(true)
    setTranscript('')
    setAiResult(null)
  }

  function stopVoice() {
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null }
    setRecording(false)
  }

  // ── AI GENERATE ────────────────────────────────────────
  async function generateAI() {
    const text = transcript || form.complaint
    if (!text.trim()) { setError('Speak or type a complaint first'); return }

    setAiLoading(true)
    setError('')

    const res = await fetch('/api/ai/service-writer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: text,
        language: 'en',
        truck_info: selectedAsset ? { year: selectedAsset.year, make: selectedAsset.make, model: selectedAsset.model, engine: selectedAsset.engine_make } : null,
        complaint: form.complaint || text,
        shop_id: user?.shop_id,
        role: user?.role,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setError(err.error || 'AI generation failed — try again')
      setAiLoading(false)
      return
    }

    const data = await res.json()
    setAiResult(data)

    // Auto-fill form
    setForm(f => ({
      ...f,
      complaint: data.complaint || f.complaint || text,
      cause: data.cause || '',
      correction: data.correction || '',
    }))

    // Parts suggestions
    if (data.suggested_parts) {
      setSuggestedParts(data.suggested_parts)
    }

    // Labor hours
    if (data.labor_hours_min) setLaborHoursMin(data.labor_hours_min)
    if (data.labor_hours_max) setLaborHoursMax(data.labor_hours_max)
    if (data.labor_hours_min && data.labor_hours_max) {
      setLaborHours(Math.round(((data.labor_hours_min + data.labor_hours_max) / 2) * 10) / 10)
    }

    setAiLoading(false)
  }

  function addPart(part: any) {
    if (addedParts.find(p => p.name === part.name)) return
    setAddedParts(prev => [...prev, { ...part, quantity: part.quantity || 1, unit_cost: part.inventory_match?.sell_price || 0 }])
  }

  function removePart(idx: number) {
    setAddedParts(prev => prev.filter((_, i) => i !== idx))
  }

  function updatePartQty(idx: number, qty: number) {
    setAddedParts(prev => prev.map((p, i) => i === idx ? { ...p, quantity: Math.max(1, qty) } : p))
  }

  // Totals
  const partsTotal = addedParts.reduce((s, p) => s + (p.unit_cost * p.quantity), 0)
  const laborTotal = laborHours * shopRate
  const grandTotal = partsTotal + laborTotal

  // ── SUBMIT ─────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.asset_id) { setError('Select a truck'); return }
    if (!form.complaint) { setError('Describe the complaint'); return }

    setSubmitting(true)
    setError('')

    const res = await fetch('/api/service-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shop_id: user.shop_id,
        user_id: user.id,
        role: user.role,
        asset_id: form.asset_id,
        customer_id: form.customer_id || null,
        complaint: form.complaint,
        cause: form.cause || null,
        correction: form.correction || null,
        source: form.source,
        priority: form.priority,
        team: form.team || null,
        bay: form.bay || null,
      }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Failed to create service order')
      setSubmitting(false)
      return
    }

    // Add line items (parts + labor)
    const soId = data.id
    for (const part of addedParts) {
      await fetch('/api/so-lines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          so_id: soId,
          line_type: 'part',
          description: part.inventory_match?.description || part.name,
          part_number: part.inventory_match?.part_number || part.part_number || null,
          quantity: part.quantity,
          unit_price: part.unit_cost,
        }),
      })
    }

    if (laborHours > 0) {
      await fetch('/api/so-lines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          so_id: soId,
          line_type: 'labor',
          description: `${form.correction?.slice(0, 60) || 'Repair labor'} — ${laborHours} hrs`,
          quantity: laborHours,
          unit_price: shopRate,
        }),
      })
    }

    router.push(`/orders/${soId}`)
  }

  if (!user) return null

  return (
    <div style={S.page}>
      <a href="/orders" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#7C8BA0', textDecoration: 'none', marginBottom: 20 }}>← Orders</a>
      <div style={S.title}>New Service Order</div>
      <div style={{ fontSize: 12, color: '#7C8BA0', marginBottom: 20 }}>AI-assisted service writing — speak or type the complaint, AI generates professional notes and suggests parts.</div>

      {error && <div style={S.error}>{error}</div>}

      <form onSubmit={handleSubmit}>
        {/* ═══ CUSTOMER ═══ */}
        <div style={S.card}>
          <div style={S.cardTitle}>1. Customer</div>
          <label style={S.label}>Search by company name</label>
          <div style={{ position: 'relative' }}>
            <input style={S.input} value={customerSearch} onChange={e => { setCustomerSearch(e.target.value); if (!e.target.value) { setSelectedCustomer(null); setForm(f => ({ ...f, customer_id: '' })) } }}
              placeholder="e.g. Testhaulers or ABC Trucking" />
            {filteredCustomers.length > 0 && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#1C2130', border: '1px solid rgba(255,255,255,.12)', borderRadius: 9, overflow: 'hidden', zIndex: 50, boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}>
                {filteredCustomers.map((c: any) => (
                  <div key={c.id} style={{ padding: '12px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,.04)', fontSize: 13 }}
                    onClick={() => selectCustomer(c)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(29,111,232,.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <span style={{ fontWeight: 700, color: '#F0F4FF' }}>{c.company_name}</span>
                    {c.contact_name && <span style={{ color: '#7C8BA0', marginLeft: 8, fontSize: 11 }}>{c.contact_name}</span>}
                    {c.phone && <span style={{ color: '#48536A', marginLeft: 8, fontSize: 10, fontFamily: 'monospace' }}>{c.phone}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          {selectedCustomer && (
            <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(29,111,232,.06)', border: '1px solid rgba(29,111,232,.15)', borderRadius: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#F0F4FF' }}>{selectedCustomer.company_name}</div>
              <div style={{ fontSize: 11, color: '#7C8BA0', marginTop: 2 }}>Customer selected — vehicle search will filter to their units</div>
            </div>
          )}
        </div>

        {/* ═══ VEHICLE ═══ */}
        <div style={S.card}>
          <div style={S.cardTitle}>2. Vehicle</div>
          <label style={S.label}>Search by unit number, make, or model</label>
          <div style={{ position: 'relative' }}>
            <input style={S.input} value={assetSearch} onChange={e => { setAssetSearch(e.target.value); if (!e.target.value) { setSelectedAsset(null); setForm(f => ({ ...f, asset_id: '', customer_id: '' })) } }}
              placeholder="e.g. TH001 or Volvo or T680" />
            {filteredAssets.length > 0 && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#1C2130', border: '1px solid rgba(255,255,255,.12)', borderRadius: 9, overflow: 'hidden', zIndex: 50, boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}>
                {filteredAssets.map(a => {
                  const custName = customers.find((c: any) => c.id === a.customer_id)?.company_name
                  return (
                    <div key={a.id} style={{ padding: '12px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,.04)', fontSize: 13 }}
                      onClick={() => selectAsset(a)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(29,111,232,.08)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#4D9EFF' }}>#{a.unit_number}</span>
                      {custName && <span style={{ color: '#7C8BA0', marginLeft: 6 }}> — {custName}</span>}
                      <span style={{ color: '#DDE3EE', marginLeft: 6 }}> — {a.year} {a.make} {a.model}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          {selectedAsset && (
            <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(29,111,232,.06)', border: '1px solid rgba(29,111,232,.15)', borderRadius: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#F0F4FF' }}>Unit #{selectedAsset.unit_number} — {selectedAsset.year} {selectedAsset.make} {selectedAsset.model}</div>
              {selectedAsset.engine_make && <div style={{ fontSize: 11, color: '#7C8BA0', marginTop: 2 }}>Engine: {selectedAsset.engine_make}</div>}
            </div>
          )}
        </div>

        {/* ═══ AI SERVICE WRITER ═══ */}
        <div style={{ ...S.card, borderColor: 'rgba(29,111,232,.15)' }}>
          <div style={S.cardTitle}>3. AI Service Writer</div>

          {/* Voice input */}
          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Voice Input — Speak the complaint in any language</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={recording ? stopVoice : startVoice}
                style={{ ...S.voiceBtn, background: recording ? '#EF4444' : 'linear-gradient(135deg,#1D6FE8,#1248B0)', flex: 'none', width: 56, height: 56 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{recording ? 'Stop' : 'Rec'}</span>
              </button>
              <div style={{ flex: 1 }}>
                {recording && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'rgba(239,68,68,.08)', borderRadius: 8, marginBottom: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444', animation: 'pulse 1s infinite' }} />
                    <span style={{ fontSize: 12, color: '#EF4444', fontWeight: 600 }}>Recording... tap stop when done</span>
                  </div>
                )}
                {transcript && (
                  <div style={{ padding: '10px 14px', background: '#1C2130', borderRadius: 8, fontSize: 13, color: '#DDE3EE', lineHeight: 1.5 }}>
                    {transcript}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Complaint text */}
          <label style={S.label}>Complaint — What the customer reported</label>
          <textarea style={{ ...S.input, minHeight: 80, resize: 'vertical' }}
            value={form.complaint} onChange={e => setForm(f => ({ ...f, complaint: e.target.value }))}
            placeholder="e.g. Oil leak from rear of engine, getting worse over last 2 weeks" />

          {/* Generate button */}
          <button type="button" onClick={generateAI} disabled={aiLoading || (!transcript && !form.complaint)}
            style={{ ...S.aiBtn, opacity: aiLoading || (!transcript && !form.complaint) ? 0.5 : 1, marginTop: 8, marginBottom: 16 }}>
            {aiLoading ? (
              <span>Generating... please wait</span>
            ) : (
              <>Generate Cause, Correction & Parts</>
            )}
          </button>

          {/* AI Results: Cause & Correction */}
          {(form.cause || form.correction) && (
            <>
              <label style={S.label}>Cause — AI-generated technical diagnosis</label>
              <textarea style={{ ...S.input, minHeight: 60, resize: 'vertical', borderColor: 'rgba(29,111,232,.2)' }}
                value={form.cause} onChange={e => setForm(f => ({ ...f, cause: e.target.value }))} />

              <label style={{ ...S.label, marginTop: 12 }}>Correction — AI-generated repair procedure</label>
              <textarea style={{ ...S.input, minHeight: 60, resize: 'vertical', borderColor: 'rgba(29,111,232,.2)' }}
                value={form.correction} onChange={e => setForm(f => ({ ...f, correction: e.target.value }))} />
            </>
          )}

          {aiResult?.confidence && (
            <div style={{ fontSize: 10, color: '#48536A', marginTop: 4 }}>AI confidence: {aiResult.confidence} · Department: {aiResult.department || '—'}</div>
          )}
        </div>

        {/* ═══ PARTS SUGGESTIONS ═══ */}
        {suggestedParts.length > 0 && (
          <div style={S.card}>
            <div style={S.cardTitle}>4. Suggested Parts</div>
            <div style={{ fontSize: 11, color: '#7C8BA0', marginBottom: 12 }}>AI-suggested parts based on the repair. Click to add to the service order.</div>
            {suggestedParts.map((p: any, i: number) => {
              const inv = p.inventory_match
              const added = addedParts.some(ap => ap.name === p.name)
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F4FF' }}>{p.name}</div>
                    {inv ? (
                      <div style={{ fontSize: 11, color: '#7C8BA0', marginTop: 2 }}>
                        <span style={{ fontFamily: 'monospace' }}>{inv.part_number}</span>
                        <span style={{ marginLeft: 8, color: inv.in_stock ? (inv.low_stock ? '#F59E0B' : '#22C55E') : '#EF4444', fontWeight: 600 }}>
                          {inv.in_stock ? `${inv.on_hand} in stock` : 'Out of stock'}
                        </span>
                        <span style={{ marginLeft: 8 }}>${inv.sell_price}</span>
                        {inv.bin_location && <span style={{ marginLeft: 8, color: '#48536A' }}>Bin: {inv.bin_location}</span>}
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: '#48536A' }}>Not found in inventory</div>
                    )}
                  </div>
                  <button type="button" onClick={() => addPart(p)} disabled={added}
                    style={{ padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 700, cursor: added ? 'default' : 'pointer', background: added ? '#1A1D23' : 'linear-gradient(135deg,#1D6FE8,#1248B0)', color: added ? '#48536A' : '#fff' }}>
                    {added ? 'Added' : '+ Add'}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* ═══ LINE ITEMS ═══ */}
        {(addedParts.length > 0 || laborHours > 0) && (
          <div style={S.card}>
            <div style={S.cardTitle}>5. Line Items & Totals</div>

            {/* Parts */}
            {addedParts.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                <div style={{ flex: 1, fontSize: 12, color: '#DDE3EE' }}>{p.inventory_match?.description || p.name}</div>
                <input type="number" value={p.quantity} onChange={e => updatePartQty(i, parseInt(e.target.value) || 1)} min={1}
                  style={{ width: 50, padding: '4px 6px', background: '#1C2130', border: '1px solid rgba(255,255,255,.08)', borderRadius: 4, color: '#DDE3EE', fontSize: 12, textAlign: 'center' }} />
                <div style={{ width: 70, fontSize: 12, color: '#7C8BA0', textAlign: 'right' }}>${(p.unit_cost * p.quantity).toFixed(2)}</div>
                <button type="button" onClick={() => removePart(i)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 14, padding: 4 }}>×</button>
              </div>
            ))}

            {/* Labor */}
            {(laborHoursMin > 0 || laborHours > 0) && (
              <div style={{ padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#DDE3EE' }}>Labor</div>
                    {laborHoursMin > 0 && <div style={{ fontSize: 10, color: '#48536A' }}>AI estimate: {laborHoursMin} — {laborHoursMax} hrs</div>}
                  </div>
                  <input type="number" value={laborHours} onChange={e => setLaborHours(parseFloat(e.target.value) || 0)} step="0.5" min={0}
                    style={{ width: 60, padding: '4px 6px', background: '#1C2130', border: '1px solid rgba(255,255,255,.08)', borderRadius: 4, color: '#DDE3EE', fontSize: 12, textAlign: 'center' }} />
                  <div style={{ fontSize: 10, color: '#48536A' }}>hrs × ${shopRate}/hr</div>
                  <div style={{ width: 70, fontSize: 12, color: '#7C8BA0', textAlign: 'right' }}>${laborTotal.toFixed(2)}</div>
                </div>
              </div>
            )}

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: 13 }}>
              <span style={{ color: '#7C8BA0' }}>Parts:</span>
              <span style={{ fontWeight: 600, color: '#DDE3EE' }}>${partsTotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
              <span style={{ color: '#7C8BA0' }}>Labor:</span>
              <span style={{ fontWeight: 600, color: '#DDE3EE' }}>${laborTotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: 16, borderTop: '1px solid rgba(255,255,255,.08)', marginTop: 8 }}>
              <span style={{ fontWeight: 700, color: '#F0F4FF' }}>Total:</span>
              <span style={{ fontWeight: 700, color: '#4D9EFF' }}>${grandTotal.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* ═══ DETAILS ═══ */}
        <div style={S.card}>
          <div style={S.cardTitle}>Details</div>
          <div style={S.row}>
            <div>
              <label style={S.label}>Source</label>
              <select style={S.select} value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                <option value="walk_in">Walk In</option>
                <option value="phone">Phone</option>
                <option value="kiosk">Kiosk</option>
                <option value="portal">Customer Portal</option>
                <option value="telegram">Telegram</option>
              </select>
            </div>
            <div>
              <label style={S.label}>Priority</label>
              <select style={S.select} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="critical">Critical — Truck Down</option>
              </select>
            </div>
          </div>
          <div style={S.row}>
            <div>
              <label style={S.label}>Team</label>
              <select style={S.select} value={form.team} onChange={e => setForm(f => ({ ...f, team: e.target.value }))}>
                <option value="">Unassigned</option>
                <option value="A">Team A</option>
                <option value="B">Team B</option>
                <option value="C">Team C</option>
                <option value="D">Team D</option>
              </select>
            </div>
            <div>
              <label style={S.label}>Bay</label>
              <select style={S.select} value={form.bay} onChange={e => setForm(f => ({ ...f, bay: e.target.value }))}>
                <option value="">No Bay</option>
                {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={`Bay ${i + 1}`}>Bay {i + 1}</option>)}
              </select>
            </div>
          </div>
        </div>

        <button type="submit" style={{ ...S.submitBtn, opacity: submitting ? 0.6 : 1 }} disabled={submitting}>
          {submitting ? 'Creating...' : 'Create Service Order →'}
        </button>
      </form>

      <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }`}</style>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: { background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: "'Instrument Sans',sans-serif", padding: 24, maxWidth: 720, margin: '0 auto' },
  title: { fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF', marginBottom: 4 },
  card: { background: '#161B24', border: '1px solid rgba(255,255,255,.055)', borderRadius: 12, padding: 20, marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: 700, color: '#F0F4FF', marginBottom: 14 },
  label: { fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: '#48536A', marginBottom: 5, display: 'block' },
  input: { width: '100%', padding: '10px 12px', background: '#1C2130', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 13, color: '#DDE3EE', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const },
  select: { width: '100%', padding: '10px 12px', background: '#1C2130', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 13, color: '#DDE3EE', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 },
  error: { padding: '10px 12px', background: 'rgba(217,79,79,.08)', border: '1px solid rgba(217,79,79,.2)', borderRadius: 8, fontSize: 12, color: '#D94F4F', marginBottom: 14 },
  voiceBtn: { borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  aiBtn: { width: '100%', padding: '14px 24px', background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  submitBtn: { width: '100%', padding: '15px 24px', background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', border: 'none', borderRadius: 9, fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', minHeight: 52 },
}
