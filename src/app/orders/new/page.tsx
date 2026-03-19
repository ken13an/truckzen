'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { Mic, Square, Sparkles, Loader2, XCircle, Plus, X } from 'lucide-react'

export default function NewSOPage() {
  const supabase = createClient()
  const router = useRouter()

  const [user, setUser] = useState<any>(null)
  const [assets, setAssets] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [shopRate, setShopRate] = useState(145)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({ asset_id: '', customer_id: '', complaint: '', cause: '', correction: '', source: 'walk_in', priority: 'normal', team: '', bay: '' })
  const [assetSearch, setAssetSearch] = useState('')
  const [filteredAssets, setFilteredAssets] = useState<any[]>([])
  const [selectedAsset, setSelectedAsset] = useState<any>(null)

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
        supabase.from('customers').select('id, company_name').eq('shop_id', profile.shop_id).order('company_name'),
        supabase.from('shops').select('labor_rate').eq('id', profile.shop_id).single(),
      ])
      setAssets(a ?? []); setCustomers(c ?? [])
      if (shop?.labor_rate) setShopRate(parseFloat(shop.labor_rate))
    }
    load()
  }, [])

  useEffect(() => {
    if (!assetSearch) { setFilteredAssets([]); return }
    const q = assetSearch.toLowerCase()
    setFilteredAssets(assets.filter(a => a.unit_number?.toLowerCase().includes(q) || a.make?.toLowerCase().includes(q) || a.model?.toLowerCase().includes(q)).slice(0, 8))
  }, [assetSearch, assets])

  function selectAsset(asset: any) {
    setSelectedAsset(asset); setAssetSearch(`#${asset.unit_number} — ${asset.year} ${asset.make} ${asset.model}`); setFilteredAssets([])
    setForm(f => ({ ...f, asset_id: asset.id, customer_id: asset.customer_id || '' }))
  }

  function startVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { setError('Voice input not supported. Use Chrome or Edge.'); return }
    const r = new SR(); r.continuous = true; r.interimResults = true; r.lang = 'en-US'
    r.onresult = (e: any) => { let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; setTranscript(t) }
    r.onerror = () => setRecording(false); r.onend = () => setRecording(false)
    r.start(); recognitionRef.current = r; setRecording(true); setTranscript(''); setAiResult(null)
  }
  function stopVoice() { recognitionRef.current?.stop(); recognitionRef.current = null; setRecording(false) }

  async function generateAI() {
    const text = transcript || form.complaint
    if (!text.trim()) { setError('Speak or type a complaint first'); return }
    setAiLoading(true); setError('')
    const res = await fetch('/api/ai/service-writer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript: text, language: 'en', truck_info: selectedAsset ? { year: selectedAsset.year, make: selectedAsset.make, model: selectedAsset.model, engine: selectedAsset.engine_make } : null, complaint: form.complaint || text, shop_id: user?.shop_id, role: user?.role }) })
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'AI failed'); setAiLoading(false); return }
    const data = await res.json(); setAiResult(data)
    setForm(f => ({ ...f, complaint: data.complaint || f.complaint || text, cause: data.cause || '', correction: data.correction || '' }))
    if (data.suggested_parts) setSuggestedParts(data.suggested_parts)
    if (data.labor_hours_min) setLaborHoursMin(data.labor_hours_min)
    if (data.labor_hours_max) setLaborHoursMax(data.labor_hours_max)
    if (data.labor_hours_min && data.labor_hours_max) setLaborHours(Math.round(((data.labor_hours_min + data.labor_hours_max) / 2) * 10) / 10)
    setAiLoading(false)
  }

  function addPart(part: any) { if (addedParts.find(p => p.name === part.name)) return; setAddedParts(prev => [...prev, { ...part, quantity: part.quantity || 1, unit_cost: part.inventory_match?.sell_price || 0 }]) }
  function removePart(idx: number) { setAddedParts(prev => prev.filter((_, i) => i !== idx)) }
  function updatePartQty(idx: number, qty: number) { setAddedParts(prev => prev.map((p, i) => i === idx ? { ...p, quantity: Math.max(1, qty) } : p)) }

  const partsTotal = addedParts.reduce((s, p) => s + (p.unit_cost * p.quantity), 0)
  const laborTotal = laborHours * shopRate
  const grandTotal = partsTotal + laborTotal

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.asset_id) { setError('Select a truck'); return }
    if (!form.complaint) { setError('Describe the complaint'); return }
    setSubmitting(true); setError('')
    const res = await fetch('/api/service-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, shop_id: user.shop_id, user_id: user.id, role: user.role, team: form.team || null, bay: form.bay || null, customer_id: form.customer_id || null }) })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to create'); setSubmitting(false); return }
    const soId = data.id
    for (const part of addedParts) { await fetch('/api/so-lines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ so_id: soId, line_type: 'part', description: part.inventory_match?.description || part.name, part_number: part.inventory_match?.part_number || part.part_number || null, quantity: part.quantity, unit_price: part.unit_cost }) }) }
    if (laborHours > 0) { await fetch('/api/so-lines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ so_id: soId, line_type: 'labor', description: `${(form.correction ?? '').slice(0, 60) || 'Repair labor'} — ${laborHours} hrs`, quantity: laborHours, unit_price: shopRate }) }) }
    router.push(`/orders/${soId}`)
  }

  if (!user) return null

  const inp = "w-full px-3 py-2.5 bg-surface-2 border border-brand-border rounded-md text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-teal transition-colors"
  const sel = "w-full px-3 py-2.5 bg-surface-2 border border-brand-border rounded-md text-sm text-text-primary outline-none focus:border-teal transition-colors"
  const lbl = "text-[10px] font-bold text-text-tertiary uppercase tracking-widest font-mono mb-1 block"

  return (
    <div className="bg-bg min-h-screen text-text-primary p-6 max-w-2xl mx-auto">
      <a href="/orders" className="text-xs text-text-tertiary hover:text-teal no-underline mb-5 block">Back to Repair Orders</a>
      <h1 className="text-2xl font-bold text-text-primary tracking-tight mb-1">New Repair Order</h1>
      <p className="text-sm text-text-secondary mb-5">AI-assisted — speak or type the complaint, AI generates professional notes and suggests parts.</p>

      {error && <div className="flex items-center gap-2 px-3 py-2.5 bg-error/10 border border-error/20 rounded-md text-xs text-error mb-4"><XCircle size={14} strokeWidth={1.5} className="shrink-0" />{error}</div>}

      <form onSubmit={handleSubmit}>
        {/* 1. Vehicle */}
        <div className="bg-surface border border-brand-border rounded-lg p-5 mb-3">
          <h3 className="text-sm font-bold text-text-primary mb-3">1. Vehicle</h3>
          <label className={lbl}>Search by unit number, make, or model</label>
          <div className="relative">
            <input className={inp} value={assetSearch} onChange={e => { setAssetSearch(e.target.value); if (!e.target.value) { setSelectedAsset(null); setForm(f => ({ ...f, asset_id: '', customer_id: '' })) } }} placeholder="e.g. TH001 or Volvo or T680" />
            {filteredAssets.length > 0 && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-surface-2 border border-brand-border rounded-lg overflow-hidden z-50 shadow-xl">
                {filteredAssets.map(a => (
                  <div key={a.id} className="px-3 py-2.5 cursor-pointer border-b border-brand-border/50 text-sm hover:bg-teal/5 transition-colors" onClick={() => selectAsset(a)}>
                    <span className="font-mono font-bold text-teal">#{a.unit_number}</span>
                    <span className="text-text-primary ml-2">{a.year} {a.make} {a.model}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {selectedAsset && (
            <div className="mt-2.5 px-3 py-2.5 bg-teal/5 border border-teal/15 rounded-md">
              <span className="text-sm font-bold text-text-primary">Unit #{selectedAsset.unit_number} — {selectedAsset.year} {selectedAsset.make} {selectedAsset.model}</span>
              {selectedAsset.engine_make && <span className="text-xs text-text-tertiary ml-2">Engine: {selectedAsset.engine_make}</span>}
            </div>
          )}
        </div>

        {/* 2. AI Service Writer — purple accent */}
        <div className="bg-surface border border-purple/20 rounded-lg p-5 mb-3">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={18} strokeWidth={1.5} className="text-purple" />
            <h3 className="text-sm font-bold text-text-primary">2. AI Service Writer</h3>
            <span className="text-[9px] font-bold text-purple-light bg-purple/15 px-1.5 py-0.5 rounded-sm uppercase">AI Powered</span>
          </div>

          {/* Voice */}
          <label className={lbl}>Voice input — speak the complaint in any language</label>
          <div className="flex gap-2.5 mb-4">
            <button type="button" onClick={recording ? stopVoice : startVoice}
              className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 transition-colors ${recording ? 'bg-error' : 'bg-purple hover:bg-purple-dark'}`}>
              {recording ? <Square size={20} strokeWidth={1.5} className="text-white" /> : <Mic size={20} strokeWidth={1.5} className="text-white" />}
            </button>
            <div className="flex-1">
              {recording && (
                <div className="flex items-center gap-2 px-3 py-2 bg-error/10 rounded-md mb-2">
                  <div className="w-2 h-2 rounded-full bg-error animate-pulse" />
                  <span className="text-xs text-error font-semibold">Recording... tap stop when done</span>
                </div>
              )}
              {transcript && <div className="px-3 py-2.5 bg-surface-2 rounded-md text-sm text-text-primary leading-relaxed">{transcript}</div>}
            </div>
          </div>

          <label className={lbl}>Complaint — what the customer reported</label>
          <textarea className={`${inp} min-h-[80px] resize-y`} value={form.complaint} onChange={e => setForm(f => ({ ...f, complaint: e.target.value }))} placeholder="e.g. Oil leak from rear of engine, getting worse over last 2 weeks" />

          {/* Generate button — purple for AI */}
          <button type="button" onClick={generateAI} disabled={aiLoading || (!transcript && !form.complaint)}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-md text-sm font-bold mt-2 mb-4 transition-all ${aiLoading || (!transcript && !form.complaint) ? 'bg-surface-2 text-text-tertiary cursor-not-allowed' : 'bg-purple text-white hover:bg-purple-dark cursor-pointer'}`}>
            {aiLoading ? <><Loader2 size={14} className="animate-spin" /> Generating...</> : <><Sparkles size={14} strokeWidth={1.5} /> Generate Cause, Correction and Parts</>}
          </button>

          {/* AI Results */}
          {(form.cause || form.correction) && <>
            <label className={lbl}>Cause — AI-generated technical diagnosis</label>
            <textarea className={`${inp} min-h-[60px] resize-y border-purple/20`} value={form.cause} onChange={e => setForm(f => ({ ...f, cause: e.target.value }))} />
            <label className={`${lbl} mt-3`}>Correction — AI-generated repair procedure</label>
            <textarea className={`${inp} min-h-[60px] resize-y border-purple/20`} value={form.correction} onChange={e => setForm(f => ({ ...f, correction: e.target.value }))} />
          </>}
          {aiResult?.confidence && <p className="text-[10px] text-text-tertiary mt-1">AI confidence: {aiResult.confidence} &middot; Department: {aiResult.department ?? '—'}</p>}
        </div>

        {/* 3. Parts Suggestions */}
        {suggestedParts.length > 0 && (
          <div className="bg-surface border border-brand-border rounded-lg p-5 mb-3">
            <h3 className="text-sm font-bold text-text-primary mb-1">3. Suggested Parts</h3>
            <p className="text-xs text-text-secondary mb-3">AI-suggested parts. Click to add to the repair order.</p>
            {suggestedParts.map((p: any, i: number) => {
              const inv = p.inventory_match; const added = addedParts.some(ap => ap.name === p.name)
              return (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-brand-border/50">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-text-primary">{p.name}</div>
                    {inv ? (
                      <div className="text-xs text-text-secondary mt-0.5">
                        <span className="font-mono">{inv.part_number}</span>
                        <span className={`ml-2 font-semibold ${inv.in_stock ? (inv.low_stock ? 'text-warning' : 'text-success') : 'text-error'}`}>{inv.in_stock ? `${inv.on_hand} in stock` : 'Out of stock'}</span>
                        <span className="ml-2">${inv.sell_price}</span>
                      </div>
                    ) : <div className="text-xs text-text-tertiary">Not found in inventory</div>}
                  </div>
                  <button type="button" onClick={() => addPart(p)} disabled={added}
                    className={`px-3 py-1.5 rounded-sm text-xs font-bold transition-colors ${added ? 'bg-surface-2 text-text-tertiary' : 'bg-teal text-bg hover:bg-teal-hover'}`}>
                    {added ? 'Added' : '+ Add'}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* 4. Line Items */}
        {(addedParts.length > 0 || laborHours > 0) && (
          <div className="bg-surface border border-brand-border rounded-lg p-5 mb-3">
            <h3 className="text-sm font-bold text-text-primary mb-3">4. Line Items and Totals</h3>
            {addedParts.map((p, i) => (
              <div key={i} className="flex items-center gap-2.5 py-2 border-b border-brand-border/50">
                <span className="flex-1 text-sm text-text-primary">{p.inventory_match?.description || p.name}</span>
                <input type="number" value={p.quantity} onChange={e => updatePartQty(i, parseInt(e.target.value) || 1)} min={1} className="w-12 px-1.5 py-1 bg-surface-2 border border-brand-border rounded text-sm text-text-primary text-center" />
                <span className="w-16 text-sm text-text-secondary text-right">${(p.unit_cost * p.quantity).toFixed(2)}</span>
                <button type="button" onClick={() => removePart(i)} className="text-error hover:text-error/80 p-0.5"><X size={14} strokeWidth={1.5} /></button>
              </div>
            ))}
            {(laborHoursMin > 0 || laborHours > 0) && (
              <div className="flex items-center gap-2.5 py-3 border-b border-brand-border/50">
                <div className="flex-1"><span className="text-sm text-text-primary">Labor</span>{laborHoursMin > 0 && <span className="text-[10px] text-text-tertiary ml-2">AI estimate: {laborHoursMin}–{laborHoursMax} hrs</span>}</div>
                <input type="number" value={laborHours} onChange={e => setLaborHours(parseFloat(e.target.value) || 0)} step="0.5" min={0} className="w-14 px-1.5 py-1 bg-surface-2 border border-brand-border rounded text-sm text-text-primary text-center" />
                <span className="text-[10px] text-text-tertiary">hrs x ${shopRate}/hr</span>
                <span className="w-16 text-sm text-text-secondary text-right">${laborTotal.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between pt-3 mt-2 border-t border-brand-border text-base">
              <span className="font-bold text-text-primary">Total</span>
              <span className="font-bold text-teal">${grandTotal.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* 5. Details */}
        <div className="bg-surface border border-brand-border rounded-lg p-5 mb-3">
          <h3 className="text-sm font-bold text-text-primary mb-3">Details</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><label className={lbl}>Source</label><select className={sel} value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}><option value="walk_in">Walk In</option><option value="phone">Phone</option><option value="kiosk">Kiosk</option><option value="portal">Customer Portal</option><option value="telegram">Telegram</option></select></div>
            <div><label className={lbl}>Priority</label><select className={sel} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical — Truck Down</option></select></div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><label className={lbl}>Team</label><select className={sel} value={form.team} onChange={e => setForm(f => ({ ...f, team: e.target.value }))}><option value="">Unassigned</option><option value="A">Team A</option><option value="B">Team B</option><option value="C">Team C</option><option value="D">Team D</option></select></div>
            <div><label className={lbl}>Bay</label><select className={sel} value={form.bay} onChange={e => setForm(f => ({ ...f, bay: e.target.value }))}><option value="">No Bay</option>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={`Bay ${i + 1}`}>Bay {i + 1}</option>)}</select></div>
          </div>
          <div><label className={lbl}>Customer</label><select className={sel} value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}><option value="">No customer linked</option>{(customers ?? []).map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}</select></div>
        </div>

        <button type="submit" disabled={submitting}
          className={`w-full py-3.5 rounded-md text-sm font-bold min-h-[52px] transition-all ${submitting ? 'bg-surface-2 text-text-secondary cursor-not-allowed' : 'bg-teal text-bg hover:bg-teal-hover cursor-pointer'}`}>
          {submitting ? 'Creating...' : 'Create Repair Order'}
        </button>
      </form>
    </div>
  )
}
