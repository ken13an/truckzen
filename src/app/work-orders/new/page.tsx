/**
 * TruckZen — Original Design
 * Built independently by TruckZen development team
 */
'use client'
import { useEffect, useState, useRef } from 'react'
import { ChevronLeft } from 'lucide-react'
import { VinInput } from '@/components/shared/VinInput'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser, type UserProfile } from '@/lib/auth'
import { getPartSuggestions, type PartSuggestion } from '@/lib/parts-suggestions'

interface Customer { id: string; company_name: string; contact_name: string | null; phone: string | null; is_fleet?: boolean }
interface Asset { id: string; unit_number: string; year: number | null; make: string | null; model: string | null; vin?: string }

const FONT = "'Instrument Sans', sans-serif"
const card: React.CSSProperties = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20 }
const label: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6, fontFamily: FONT, display: 'block' }
const input: React.CSSProperties = { width: '100%', border: '1px solid #D1D5DB', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#1A1A1A', fontFamily: FONT, outline: 'none', boxSizing: 'border-box', background: '#fff' }
const btnP: React.CSSProperties = { background: '#1D6FE8', color: '#fff', fontWeight: 700, borderRadius: 10, border: 'none', padding: '12px 28px', fontSize: 14, cursor: 'pointer', fontFamily: FONT }
const btnS: React.CSSProperties = { background: '#fff', color: '#1D6FE8', fontWeight: 600, borderRadius: 8, border: '1px solid #D1D5DB', padding: '8px 18px', fontSize: 13, cursor: 'pointer', fontFamily: FONT }

export default function NewWorkOrderPage() {
  const supabase = createClient()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])

  // Customer
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Vehicle
  const [assets, setAssets] = useState<Asset[]>([])
  const [assetsLoading, setAssetsLoading] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [showVehicleList, setShowVehicleList] = useState(true)

  // Concern
  const [complaint, setComplaint] = useState('')
  const [priority, setPriority] = useState('normal')
  const [customerProvidesParts, setCustomerProvidesParts] = useState(false)

  // Job lines
  const [step, setStep] = useState<'edit' | 'review'>('edit')
  const [aiLoading, setAiLoading] = useState(false)
  const [jobLines, setJobLines] = useState<any[]>([])

  // Parts suggestions
  const [inventoryParts, setInventoryParts] = useState<any[]>([])
  const [suggestions, setSuggestions] = useState<PartSuggestion[]>([])

  // New unit
  const [showNewUnit, setShowNewUnit] = useState(false)
  const [newUnit, setNewUnit] = useState({ number: '', vin: '', year: '', make: '', model: '' })

  // Submit
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getCurrentUser(supabase).then(async (p) => {
      if (!p) { window.location.href = '/login'; return }
      setProfile(p)
      const [{ data: custs }, { data: parts }] = await Promise.all([
        supabase.from('customers').select('id, company_name, contact_name, phone, is_fleet').eq('shop_id', p.shop_id),
        supabase.from('parts').select('id, part_number, description, on_hand').eq('shop_id', p.shop_id).order('description'),
      ])
      if (custs) setCustomers(custs)
      if (parts) setInventoryParts(parts)
    })
  }, [])

  useEffect(() => {
    if (!selectedCustomer || !profile) return
    setAssetsLoading(true); setSelectedAsset(null); setShowVehicleList(true)
    fetch(`/api/assets?shop_id=${profile.shop_id}&customer_id=${selectedCustomer.id}`)
      .then(r => r.json()).then(data => { if (Array.isArray(data)) setAssets(data) })
      .finally(() => setAssetsLoading(false))
  }, [selectedCustomer, profile])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Update part suggestions when complaint changes
  useEffect(() => {
    if (complaint.length >= 3) {
      setSuggestions(getPartSuggestions(complaint, inventoryParts))
    } else {
      setSuggestions([])
    }
  }, [complaint, inventoryParts])

  const filteredCustomers = customerSearch.trim()
    ? customers.filter(c => {
        const q = customerSearch.toLowerCase()
        return c.company_name?.toLowerCase().includes(q) || c.contact_name?.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q)
      }).slice(0, 10)
    : []

  // AI review — kept as bottom button for complex jobs
  async function handleAiReview() {
    if (!complaint.trim()) return
    setAiLoading(true); setError('')
    try {
      const res = await fetch('/api/ai/action-items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ complaint: complaint.trim() }) })
      const data = await res.json()
      if (data.action_items && Array.isArray(data.action_items)) {
        setJobLines(data.action_items.map((item: any) => typeof item === 'string' ? { description: item, skills: [] } : { description: item.description || item, skills: item.skills || [] }))
      } else {
        setJobLines([{ description: complaint.trim(), skills: [] }])
      }
      setStep('review')
    } catch { setError('AI processing failed. Added as single job line.'); setJobLines([{ description: complaint.trim(), skills: [] }]); setStep('review') }
    setAiLoading(false)
  }

  // Skip AI — just create single job line from complaint
  function skipAiReview() {
    if (!complaint.trim()) return
    setJobLines([{ description: complaint.trim(), skills: [] }])
    setStep('review')
  }

  async function handleSubmit() {
    if (!profile || !complaint.trim()) return
    const validLines = jobLines.filter((l: any) => (typeof l === 'string' ? l.trim() : l.description?.trim()))
    if (validLines.length === 0 && step === 'edit') {
      // Auto-create single job line if user skipped review
      setJobLines([{ description: complaint.trim(), skills: [] }])
    }
    const lines = validLines.length > 0 ? validLines : [{ description: complaint.trim(), skills: [] }]
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/work-orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: profile.shop_id, user_id: profile.id,
          asset_id: selectedAsset?.id || null, customer_id: selectedCustomer?.id || null,
          complaint: complaint.trim(), priority,
          job_lines: lines.map((l: any) => ({ ...(typeof l === 'string' ? { description: l } : l), customer_provides_parts: customerProvidesParts })),
          ...(showNewUnit && newUnit.number.trim() ? { new_unit: { unit_number: newUnit.number.trim(), vin: newUnit.vin || null, year: newUnit.year ? Number(newUnit.year) : null, make: newUnit.make || null, model: newUnit.model || null } } : {}),
        }),
      })
      if (!res.ok) { const e = await res.json(); setError(e.error || 'Failed'); setSubmitting(false); return }
      const wo = await res.json()
      window.location.href = `/work-orders/${wo.id}`
    } catch { setError('Network error'); setSubmitting(false) }
  }

  const isFleet = selectedCustomer?.is_fleet
  const canSubmit = complaint.trim() && (selectedAsset || (showNewUnit && newUnit.number.trim()))

  return (
    <div style={{ minHeight: '100vh', background: '#F4F5F7', fontFamily: FONT, padding: 24 }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <a href="/work-orders" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#F3F4F6', borderRadius: 8, fontSize: 14, fontWeight: 700, color: '#374151', textDecoration: 'none', marginBottom: 20 }}>
          <ChevronLeft size={16} /> Work Orders
        </a>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1A1A1A', margin: '12px 0 28px' }}>New Work Order</h1>

        {/* Customer */}
        <div style={{ ...card, marginBottom: 16 }}>
          <span style={label}>Customer</span>
          {selectedCustomer ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>{selectedCustomer.company_name}</div>
                {selectedCustomer.contact_name && <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{selectedCustomer.contact_name}</div>}
              </div>
              <button onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); setAssets([]); setSelectedAsset(null) }} style={btnS}>Change</button>
            </div>
          ) : (
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <input type="text" placeholder="Search company, contact, or phone..." value={customerSearch} onChange={e => { setCustomerSearch(e.target.value); setShowDropdown(true) }} onFocus={() => { if (customerSearch.trim()) setShowDropdown(true) }} style={input} />
              {showDropdown && filteredCustomers.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, marginTop: 4, maxHeight: 240, overflowY: 'auto', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                  {filteredCustomers.map(c => (
                    <div key={c.id} onClick={() => { setSelectedCustomer(c); setShowDropdown(false); setCustomerSearch('') }} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F3F4F6' }} onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>{c.company_name}</div>
                      {c.contact_name && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{c.contact_name}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Vehicle — FIX 1: collapses after selection */}
        {selectedCustomer && (
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={label}>Vehicle</span>
            </div>

            {selectedAsset && !showVehicleList ? (
              /* Selected vehicle card */
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', border: '2px solid #1D6FE8', borderRadius: 8, background: '#EFF6FF' }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>#{selectedAsset.unit_number}</span>
                  <span style={{ fontSize: 13, color: '#6B7280', marginLeft: 8 }}>{[selectedAsset.year, selectedAsset.make, selectedAsset.model].filter(Boolean).join(' ')}</span>
                  {selectedAsset.vin && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>VIN: ...{selectedAsset.vin.slice(-6)}</div>}
                </div>
                <button onClick={() => { setShowVehicleList(true); setSelectedAsset(null) }} style={btnS}>Change</button>
              </div>
            ) : (
              /* Vehicle list */
              <>
                {/* Approval badge */}
                {selectedAsset && (
                  <div style={{ marginBottom: 10 }}>
                    {isFleet ? (
                      <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>Company Truck — Pre-Approved</span>
                    ) : (
                      <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A' }}>Owner Operator — Approval Required</span>
                    )}
                  </div>
                )}

                {assetsLoading ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Loading vehicles...</div>
                ) : assets.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No vehicles found for this customer</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {assets.map(a => (
                      <div key={a.id} onClick={() => { setSelectedAsset(a); setShowVehicleList(false) }} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')} onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>#{a.unit_number}</span>
                        {(a.year || a.make || a.model) && <span style={{ fontSize: 13, color: '#6B7280', marginLeft: 8 }}>{[a.year, a.make, a.model].filter(Boolean).join(' ')}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {!showNewUnit ? (
                  <button onClick={() => { setShowNewUnit(true); setSelectedAsset(null) }} style={{ ...btnS, marginTop: 10, fontSize: 12 }}>+ Add New Unit</button>
                ) : (
                  <div style={{ marginTop: 12, padding: 16, border: '1px solid #E5E7EB', borderRadius: 10, background: '#F9FAFB' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', marginBottom: 12 }}>New Unit</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div><span style={label}>Unit Number</span><input style={input} placeholder="e.g. 2717" value={newUnit.number} onChange={e => setNewUnit({ ...newUnit, number: e.target.value })} /></div>
                      <div><span style={label}>Year</span><input style={input} type="number" placeholder="2022" value={newUnit.year} onChange={e => setNewUnit({ ...newUnit, year: e.target.value })} /></div>
                      <div><span style={label}>Make</span><input style={input} placeholder="Freightliner" value={newUnit.make} onChange={e => setNewUnit({ ...newUnit, make: e.target.value })} /></div>
                      <div><span style={label}>Model</span><input style={input} placeholder="Cascadia" value={newUnit.model} onChange={e => setNewUnit({ ...newUnit, model: e.target.value })} /></div>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <span style={label}>VIN</span>
                      <VinInput value={newUnit.vin} onChange={v => setNewUnit({ ...newUnit, vin: v })} onDecode={r => { if (r.year) setNewUnit(u => ({ ...u, year: String(r.year) })); if (r.make) setNewUnit(u => ({ ...u, make: r.make! })); if (r.model) setNewUnit(u => ({ ...u, model: r.model! })) }} theme="light" />
                    </div>
                    <button onClick={() => { setShowNewUnit(false); setNewUnit({ number: '', vin: '', year: '', make: '', model: '' }) }} style={{ ...btnS, marginTop: 10, fontSize: 12 }}>Cancel</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Concern — FIX 2: white text on dark fixed by using light theme input */}
        {selectedCustomer && step === 'edit' && (
          <div style={{ ...card, marginBottom: 16 }}>
            <span style={label}>Describe the concern</span>
            <textarea
              value={complaint}
              onChange={e => setComplaint(e.target.value)}
              placeholder="e.g. Oil change, brake noise, check engine light..."
              rows={5}
              style={{ ...input, resize: 'vertical', minHeight: 100 }}
            />

            <div style={{ marginTop: 12 }}>
              <span style={label}>Priority</span>
              <select value={priority} onChange={e => setPriority(e.target.value)} style={{ ...input, appearance: 'auto' }}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            {/* FIX 5: Customer provides parts checkbox */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
              <input type="checkbox" checked={customerProvidesParts} onChange={e => setCustomerProvidesParts(e.target.checked)} style={{ accentColor: '#0E9F8E' }} />
              Customer provides own parts
            </label>

            {/* Parts suggestions — FIX 4: formula-based, not AI */}
            {suggestions.length > 0 && (
              <div style={{ marginTop: 14, padding: 12, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: 8 }}>Suggested Parts</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {suggestions.map((s, i) => (
                    <span key={i} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, background: s.source === 'inventory' ? '#EFF6FF' : '#F3F4F6', color: s.source === 'inventory' ? '#1D6FE8' : '#374151', border: `1px solid ${s.source === 'inventory' ? '#BFDBFE' : '#E5E7EB'}` }}>
                      {s.description}{s.source === 'inventory' && s.on_hand != null ? ` (${s.on_hand} in stock)` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* FIX 3: Only one AI button — at bottom */}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={skipAiReview} disabled={!complaint.trim()} style={{ ...btnP, flex: 1, opacity: complaint.trim() ? 1 : 0.5 }}>
                Create Work Order
              </button>
              <button onClick={handleAiReview} disabled={!complaint.trim() || aiLoading} style={{ ...btnS, opacity: complaint.trim() ? 1 : 0.5 }}>
                {aiLoading ? 'Processing...' : 'AI Review'}
              </button>
            </div>
          </div>
        )}

        {/* Job Lines Review (after AI) */}
        {step === 'review' && (
          <div style={{ ...card, marginBottom: 16 }}>
            <span style={{ ...label, marginBottom: 14 }}>Job Lines</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {jobLines.map((line: any, i: number) => {
                const desc = typeof line === 'string' ? line : line.description || ''
                return (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="text" value={desc} onChange={e => setJobLines(prev => prev.map((l, idx) => idx === i ? (typeof l === 'string' ? e.target.value : { ...l, description: e.target.value }) : l))} style={{ ...input, flex: 1 }} />
                    <button onClick={() => setJobLines(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: '1px solid #D1D5DB', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 14, color: '#EF4444', fontWeight: 600, flexShrink: 0 }}>Remove</button>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setJobLines(prev => [...prev, ''])} style={btnS}>+ Add Job Line</button>
              <button onClick={() => setStep('edit')} style={btnS}>Back to Edit</button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#DC2626', fontSize: 13, marginBottom: 16 }}>{error}</div>
        )}

        {/* FIX 6: Prominent Create button at bottom */}
        {step === 'review' && jobLines.length > 0 && (
          <button onClick={handleSubmit} disabled={submitting} style={{ ...btnP, width: '100%', padding: '16px 28px', fontSize: 16, opacity: submitting ? 0.5 : 1 }}>
            {submitting ? 'Creating Work Order...' : 'Create Work Order'}
          </button>
        )}

        {/* Direct create (skip AI) — shows when on edit step with valid data */}
        {step === 'edit' && canSubmit && complaint.trim() && (
          <button onClick={() => { setJobLines([{ description: complaint.trim(), skills: [] }]); setTimeout(handleSubmit, 100) }} disabled={submitting} style={{ ...btnP, width: '100%', padding: '14px 28px', fontSize: 15, opacity: submitting ? 0.5 : 1, marginTop: 8 }}>
            {submitting ? 'Creating...' : 'Create Work Order'}
          </button>
        )}
      </div>
    </div>
  )
}
