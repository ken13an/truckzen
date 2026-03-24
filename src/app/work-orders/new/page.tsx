/**
 * TruckZen — Original Design
 * New Work Order — AI built into flow, tire positions, single button
 */
'use client'
import { useEffect, useState, useRef } from 'react'
import { ChevronLeft } from 'lucide-react'
import { VinInput } from '@/components/shared/VinInput'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser, type UserProfile } from '@/lib/auth'
import { getPartSuggestions, type PartSuggestion, getAutoRoughParts, isDiagnosticJob } from '@/lib/parts-suggestions'

interface Customer { id: string; company_name: string; contact_name: string | null; phone: string | null; is_fleet?: boolean }
interface Asset { id: string; unit_number: string; year: number | null; make: string | null; model: string | null; vin?: string; ownership_type?: string }

const FONT = "'Instrument Sans', sans-serif"
const card: React.CSSProperties = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20 }
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6, fontFamily: FONT, display: 'block' }
const inp: React.CSSProperties = { width: '100%', border: '1px solid #D1D5DB', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#1A1A1A', fontFamily: FONT, outline: 'none', boxSizing: 'border-box', background: '#fff' }
const btnP: React.CSSProperties = { background: '#1D6FE8', color: '#fff', fontWeight: 700, borderRadius: 10, border: 'none', padding: '12px 28px', fontSize: 14, cursor: 'pointer', fontFamily: FONT }
const btnS: React.CSSProperties = { background: '#fff', color: '#1D6FE8', fontWeight: 600, borderRadius: 8, border: '1px solid #D1D5DB', padding: '8px 18px', fontSize: 13, cursor: 'pointer', fontFamily: FONT }

const TIRE_POSITIONS = [
  { group: 'Steer (Axle 1)', positions: ['DS Steer', 'PS Steer'] },
  { group: 'Drive (Axle 2)', positions: ['DS 2nd Axle Outer', 'DS 2nd Axle Inner', 'PS 2nd Axle Outer', 'PS 2nd Axle Inner'] },
  { group: 'Rear (Axle 3)', positions: ['DS 3rd Axle Outer', 'DS 3rd Axle Inner', 'PS 3rd Axle Outer', 'PS 3rd Axle Inner'] },
]

function isTireJob(desc: string): boolean {
  const d = desc.toLowerCase()
  return ['tire', 'tyre', 'flat', 'blowout', 'tire change', 'tire replacement', 'tire repair'].some(k => d.includes(k))
}

export default function NewWorkOrderPage() {
  const supabase = createClient()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])

  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [assets, setAssets] = useState<Asset[]>([])
  const [assetsLoading, setAssetsLoading] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [showVehicleList, setShowVehicleList] = useState(true)

  const [complaint, setComplaint] = useState('')
  const [priority, setPriority] = useState('normal')
  const [jobType, setJobType] = useState('repair')
  const [customerProvidesParts, setCustomerProvidesParts] = useState(false)
  const [mileage, setMileage] = useState('')
  const [lastMileage, setLastMileage] = useState<{ value: number; date: string } | null>(null)
  const [mileageWarning, setMileageWarning] = useState('')
  const [duplicateWarning, setDuplicateWarning] = useState('')

  const [step, setStep] = useState<'edit' | 'processing' | 'review'>('edit')
  const [jobLines, setJobLines] = useState<{ description: string; skills: string[]; tirePositions: string[]; isTire: boolean; isDiagnostic: boolean; roughParts: { rough_name: string; quantity: number; is_labor: boolean }[] }[]>([])
  const [aiFailed, setAiFailed] = useState(false)

  const [inventoryParts, setInventoryParts] = useState<any[]>([])
  const [suggestions, setSuggestions] = useState<PartSuggestion[]>([])

  const [showNewUnit, setShowNewUnit] = useState(false)
  const [newUnit, setNewUnit] = useState({ number: '', vin: '', year: '', make: '', model: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getCurrentUser(supabase).then(async (p) => {
      if (!p) { window.location.href = '/login'; return }
      setProfile(p)
      const [{ data: custs }, { data: parts }] = await Promise.all([
        supabase.from('customers').select('id, company_name, contact_name, phone, is_fleet').eq('shop_id', p.shop_id).is('deleted_at', null),
        supabase.from('parts').select('id, part_number, description, on_hand').eq('shop_id', p.shop_id).is('deleted_at', null).order('description'),
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

  // Load last mileage when asset selected
  useEffect(() => {
    if (!selectedAsset || !profile) { setLastMileage(null); return }
    // Check asset's current odometer
    if (selectedAsset.vin) {
      supabase.from('assets').select('odometer').eq('id', selectedAsset.id).single().then(({ data }: any) => {
        if (data?.odometer) {
          setLastMileage({ value: data.odometer, date: '' })
          setMileage(String(data.odometer))
        }
      })
    }
    // Check last WO mileage for better date info
    supabase.from('service_orders').select('mileage_at_service, odometer_in, created_at')
      .eq('asset_id', selectedAsset.id).is('deleted_at', null).not('mileage_at_service', 'is', null)
      .order('created_at', { ascending: false }).limit(1).single()
      .then(({ data }: any) => {
        if (data) {
          const val = data.mileage_at_service || data.odometer_in || 0
          if (val > 0) {
            setLastMileage({ value: val, date: data.created_at })
            if (!mileage) setMileage(String(val))
          }
        }
      })
  }, [selectedAsset])

  // Mileage validation
  useEffect(() => {
    if (!mileage) { setMileageWarning(''); return }
    const val = parseInt(mileage)
    if (isNaN(val) || val <= 0) { setMileageWarning('Must be a positive number'); return }
    if (lastMileage && val < lastMileage.value) { setMileageWarning(`Mileage is lower than last recorded (${lastMileage.value.toLocaleString()} mi). Please check.`); return }
    if (lastMileage && val > lastMileage.value + 100000) { setMileageWarning(`Large mileage jump (+${(val - lastMileage.value).toLocaleString()} mi) — please verify`); return }
    setMileageWarning('')
  }, [mileage, lastMileage])

  useEffect(() => {
    function handleClick(e: MouseEvent) { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (complaint.length >= 3) setSuggestions(getPartSuggestions(complaint, inventoryParts))
    else setSuggestions([])
  }, [complaint, inventoryParts])

  const filteredCustomers = customerSearch.trim()
    ? customers.filter(c => { const q = customerSearch.toLowerCase(); return c.company_name?.toLowerCase().includes(q) || c.contact_name?.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q) }).slice(0, 10)
    : []

  // Duplicate detection: >80% similarity check
  function checkDuplicates(lines: typeof jobLines) {
    const descs = lines.map(l => l.description.toLowerCase().replace(/[^a-z0-9]/g, ''))
    for (let i = 0; i < descs.length; i++) {
      for (let j = i + 1; j < descs.length; j++) {
        if (!descs[i] || !descs[j]) continue
        const longer = Math.max(descs[i].length, descs[j].length)
        if (longer === 0) continue
        // Simple overlap check
        const common = descs[i].split('').filter((c, idx) => descs[j][idx] === c).length
        if (common / longer > 0.8) {
          return `Possible duplicate: "${lines[i].description}" and "${lines[j].description}"`
        }
      }
    }
    return ''
  }

  async function handleCreateClick() {
    if (!complaint.trim()) return
    // Validate mileage required
    if (!mileage || parseInt(mileage) <= 0) { setError('Current mileage is required'); return }
    if (mileageWarning.includes('lower than last')) { /* allow but warning is shown */ }

    setStep('processing'); setError(''); setAiFailed(false); setDuplicateWarning('')

    try {
      const res = await fetch('/api/ai/action-items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ complaint: complaint.trim(), shop_id: profile?.shop_id, user_id: profile?.id }) })
      const data = await res.json()
      let lines: typeof jobLines = []
      if (data.action_items && Array.isArray(data.action_items) && data.action_items.length > 0) {
        lines = data.action_items.map((item: any) => {
          const desc = typeof item === 'string' ? item : item.description || ''
          return { description: desc, skills: typeof item === 'string' ? [] : item.skills || [], tirePositions: [], isTire: isTireJob(desc), isDiagnostic: isDiagnosticJob(desc), roughParts: getAutoRoughParts(desc) }
        })
      } else {
        lines = [{ description: complaint.trim(), skills: [], tirePositions: [], isTire: isTireJob(complaint), isDiagnostic: isDiagnosticJob(complaint), roughParts: getAutoRoughParts(complaint) }]
        setAiFailed(true)
      }
      setJobLines(lines)
      const dup = checkDuplicates(lines)
      if (dup) setDuplicateWarning(dup)
    } catch {
      setJobLines([{ description: complaint.trim(), skills: [], tirePositions: [], isTire: isTireJob(complaint), isDiagnostic: isDiagnosticJob(complaint), roughParts: getAutoRoughParts(complaint) }])
      setAiFailed(true)
    }
    setStep('review')
  }

  async function handleConfirmCreate() {
    if (!profile || jobLines.length === 0) return
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/work-orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: profile.shop_id, user_id: profile.id,
          asset_id: selectedAsset?.id || null, customer_id: selectedCustomer?.id || null,
          complaint: complaint.trim(), priority, mileage: parseInt(mileage) || null, job_type: jobType,
          job_lines: jobLines.filter(l => l.description.trim()).map(l => ({
            description: l.description, skills: l.skills,
            customer_provides_parts: customerProvidesParts,
            tire_position: l.tirePositions.length > 0 ? l.tirePositions.join(', ') : null,
            rough_parts: l.roughParts.filter(p => !p.is_labor),
            is_diagnostic: l.isDiagnostic,
          })),
          ...(showNewUnit && newUnit.number.trim() ? { new_unit: { unit_number: newUnit.number.trim(), vin: newUnit.vin || null, year: newUnit.year ? Number(newUnit.year) : null, make: newUnit.make || null, model: newUnit.model || null } } : {}),
        }),
      })
      if (!res.ok) { const e = await res.json(); setError(e.error || 'Failed'); setSubmitting(false); return }
      const wo = await res.json()
      window.location.href = `/work-orders/${wo.id}`
    } catch { setError('Network error'); setSubmitting(false) }
  }

  function toggleTirePosition(lineIdx: number, pos: string) {
    setJobLines(prev => prev.map((l, i) => {
      if (i !== lineIdx) return l
      const positions = l.tirePositions.includes(pos) ? l.tirePositions.filter(p => p !== pos) : [...l.tirePositions, pos]
      return { ...l, tirePositions: positions, roughParts: getAutoRoughParts(l.description, positions) }
    }))
  }

  const isFleet = selectedCustomer?.is_fleet
  const canCreate = complaint.trim() && (selectedAsset || (showNewUnit && newUnit.number.trim())) && mileage && parseInt(mileage) > 0

  return (
    <div style={{ minHeight: '100vh', background: '#F4F5F7', fontFamily: FONT, padding: 24 }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <a href="/work-orders" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#F3F4F6', borderRadius: 8, fontSize: 14, fontWeight: 700, color: '#374151', textDecoration: 'none', marginBottom: 20 }}>
          <ChevronLeft size={16} /> Work Orders
        </a>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1A1A1A', margin: '12px 0 28px' }}>New Work Order</h1>

        {/* Customer */}
        <div style={{ ...card, marginBottom: 16 }}>
          <span style={lbl}>Customer</span>
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
              <input type="text" placeholder="Search company, contact, or phone..." value={customerSearch} onChange={e => { setCustomerSearch(e.target.value); setShowDropdown(true) }} onFocus={() => { if (customerSearch.trim()) setShowDropdown(true) }} style={inp} />
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

        {/* Vehicle */}
        {selectedCustomer && (
          <div style={{ ...card, marginBottom: 16 }}>
            <span style={lbl}>Vehicle</span>
            {selectedAsset && !showVehicleList ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', border: '2px solid #1D6FE8', borderRadius: 8, background: '#EFF6FF' }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>#{selectedAsset.unit_number}</span>
                  <span style={{ fontSize: 13, color: '#6B7280', marginLeft: 8 }}>{[selectedAsset.year, selectedAsset.make, selectedAsset.model].filter(Boolean).join(' ')}</span>
                  {isFleet ? <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: '#F0FDF4', color: '#16A34A' }}>Company</span>
                    : <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: '#FFFBEB', color: '#D97706' }}>Owner Op</span>}
                </div>
                <button onClick={() => { setShowVehicleList(true); setSelectedAsset(null) }} style={btnS}>Change</button>
              </div>
            ) : (
              <>
                {assetsLoading ? <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Loading...</div>
                : assets.length === 0 ? <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No vehicles found</div>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {assets.map(a => (
                      <div key={a.id} onClick={() => { setSelectedAsset(a); setShowVehicleList(false) }} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')} onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>#{a.unit_number}</span>
                        {(a.year || a.make || a.model) && <span style={{ fontSize: 13, color: '#6B7280', marginLeft: 8 }}>{[a.year, a.make, a.model].filter(Boolean).join(' ')}</span>}
                      </div>
                    ))}
                  </div>}
                {!showNewUnit ? (
                  <button onClick={() => { setShowNewUnit(true); setSelectedAsset(null) }} style={{ ...btnS, marginTop: 10, fontSize: 12 }}>+ Add New Unit</button>
                ) : (
                  <div style={{ marginTop: 12, padding: 16, border: '1px solid #E5E7EB', borderRadius: 10, background: '#F9FAFB' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', marginBottom: 12 }}>New Unit</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div><span style={lbl}>Unit Number</span><input style={inp} placeholder="e.g. 2717" value={newUnit.number} onChange={e => setNewUnit({ ...newUnit, number: e.target.value })} /></div>
                      <div><span style={lbl}>Year</span><input style={inp} type="number" placeholder="2022" value={newUnit.year} onChange={e => setNewUnit({ ...newUnit, year: e.target.value })} /></div>
                      <div><span style={lbl}>Make</span><input style={inp} placeholder="Freightliner" value={newUnit.make} onChange={e => setNewUnit({ ...newUnit, make: e.target.value })} /></div>
                      <div><span style={lbl}>Model</span><input style={inp} placeholder="Cascadia" value={newUnit.model} onChange={e => setNewUnit({ ...newUnit, model: e.target.value })} /></div>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <span style={lbl}>VIN</span>
                      <VinInput value={newUnit.vin} onChange={v => setNewUnit({ ...newUnit, vin: v })} onDecode={r => { if (r.year) setNewUnit(u => ({ ...u, year: String(r.year) })); if (r.make) setNewUnit(u => ({ ...u, make: r.make! })); if (r.model) setNewUnit(u => ({ ...u, model: r.model! })) }} theme="light" />
                    </div>
                    <button onClick={() => { setShowNewUnit(false); setNewUnit({ number: '', vin: '', year: '', make: '', model: '' }) }} style={{ ...btnS, marginTop: 10, fontSize: 12 }}>Cancel</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Mileage — required */}
        {selectedCustomer && (selectedAsset || showNewUnit) && step === 'edit' && (
          <div style={{ ...card, marginBottom: 16 }}>
            <span style={lbl}>Current Mileage *</span>
            <input type="number" value={mileage} onChange={e => setMileage(e.target.value)} placeholder="Enter current odometer reading" style={inp} min={0} />
            {lastMileage && lastMileage.value > 0 && (
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                Last recorded: {lastMileage.value.toLocaleString()} mi{lastMileage.date ? ` on ${new Date(lastMileage.date).toLocaleDateString()}` : ''}
              </div>
            )}
            {mileageWarning && (
              <div style={{ fontSize: 12, color: mileageWarning.includes('lower') ? '#DC2626' : '#D97706', marginTop: 6, padding: '6px 10px', background: mileageWarning.includes('lower') ? '#FEF2F2' : '#FFFBEB', borderRadius: 6, border: `1px solid ${mileageWarning.includes('lower') ? '#FECACA' : '#FDE68A'}` }}>
                {mileageWarning}
              </div>
            )}
          </div>
        )}

        {/* Concern + Priority (edit step only) */}
        {selectedCustomer && step === 'edit' && (
          <div style={{ ...card, marginBottom: 16 }}>
            <span style={lbl}>Describe the concern</span>
            <textarea value={complaint} onChange={e => setComplaint(e.target.value)} placeholder="e.g. PM SERVICE, TIRE CHANGE, BUMPER DESTROYED" rows={4} style={{ ...inp, resize: 'vertical', minHeight: 80 }} />
            <div style={{ marginTop: 12 }}>
              <span style={lbl}>Priority</span>
              <select value={priority} onChange={e => setPriority(e.target.value)} style={{ ...inp, appearance: 'auto' }}>
                <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option>
              </select>
            </div>
            <div style={{ marginTop: 12 }}>
              <span style={lbl}>Job Type</span>
              <select value={jobType} onChange={e => setJobType(e.target.value)} style={{ ...inp, appearance: 'auto' }}>
                <option value="repair">Repair</option>
                <option value="diagnostic">Diagnostic</option>
                <option value="full_inspection">Full Inspection</option>
                <option value="pm">Preventive Maintenance</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Estimate requirement indicator */}
            {selectedAsset && (() => {
              const ot = (selectedAsset as any).ownership_type || 'fleet_asset'
              const needsEstimate = (ot === 'owner_operator' || ot === 'outside_customer') && !['diagnostic', 'full_inspection'].includes(jobType)
              return (
                <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, background: needsEstimate ? 'rgba(217,119,6,0.08)' : 'rgba(22,163,74,0.08)', border: `1px solid ${needsEstimate ? 'rgba(217,119,6,0.2)' : 'rgba(22,163,74,0.2)'}`, color: needsEstimate ? '#D97706' : '#16A34A' }}>
                  {needsEstimate ? 'Estimate required before work begins' : 'No estimate required — work can start immediately'}
                </div>
              )
            })()}

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
              <input type="checkbox" checked={customerProvidesParts} onChange={e => setCustomerProvidesParts(e.target.checked)} style={{ accentColor: '#0E9F8E' }} />
              Customer provides own parts
            </label>

            {/* Parts suggestions */}
            {suggestions.length > 0 && (
              <div style={{ marginTop: 14, padding: 12, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: 8 }}>Suggested Parts</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {suggestions.map((s, i) => (
                    <span key={i} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, background: s.source === 'inventory' ? '#EFF6FF' : '#F3F4F6', color: s.source === 'inventory' ? '#1D6FE8' : '#374151', border: `1px solid ${s.source === 'inventory' ? '#BFDBFE' : '#E5E7EB'}` }}>
                      {s.description}{s.source === 'inventory' && s.on_hand != null ? ` (${s.on_hand})` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Processing indicator */}
        {step === 'processing' && (
          <div style={{ ...card, marginBottom: 16, textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>Processing concern with AI...</div>
            <div style={{ fontSize: 12, color: '#9CA3AF' }}>Splitting into individual job lines</div>
          </div>
        )}

        {/* Job Lines Review (FIX 2: shown after AI auto-processes) */}
        {step === 'review' && (
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ ...lbl, marginBottom: 0 }}>Job Lines ({jobLines.length})</span>
              {aiFailed && <span style={{ fontSize: 10, color: '#D97706', background: '#FFFBEB', padding: '2px 8px', borderRadius: 4 }}>AI could not split — created as single job</span>}
            </div>
            {/* Duplicate warning */}
            {duplicateWarning && (
              <div style={{ padding: '8px 12px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, marginBottom: 12, fontSize: 12, color: '#D97706', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{duplicateWarning}. Merge into one?</span>
                <button onClick={() => setDuplicateWarning('')} style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: 11, cursor: 'pointer' }}>Dismiss</button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              {jobLines.map((line, i) => (
                <div key={i} style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: 12 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: line.isTire ? 10 : 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', minWidth: 40 }}>Job {i + 1}</span>
                    <input type="text" value={line.description} onChange={e => setJobLines(prev => prev.map((l, idx) => idx === i ? { ...l, description: e.target.value, isTire: isTireJob(e.target.value), isDiagnostic: isDiagnosticJob(e.target.value), roughParts: getAutoRoughParts(e.target.value, l.tirePositions) } : l))} style={{ ...inp, flex: 1 }} />
                    <button onClick={() => setJobLines(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: '1px solid #D1D5DB', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: '#EF4444', fontWeight: 600, flexShrink: 0, fontSize: 13 }}>×</button>
                  </div>

                  {/* FIX 3: Tire position selector */}
                  {line.isTire && (
                    <div style={{ marginTop: 8, padding: 10, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#D97706', textTransform: 'uppercase', marginBottom: 8 }}>
                        Tire Position {line.tirePositions.length === 0 && '— specify for maintenance tracking'}
                      </div>
                      {TIRE_POSITIONS.map(g => (
                        <div key={g.group} style={{ marginBottom: 6 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: '#6B7280', marginBottom: 3 }}>{g.group}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {g.positions.map(pos => {
                              const selected = line.tirePositions.includes(pos)
                              return (
                                <button key={pos} onClick={() => toggleTirePosition(i, pos)} style={{
                                  padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
                                  background: selected ? '#1D6FE8' : '#fff', color: selected ? '#fff' : '#374151',
                                  border: selected ? '1px solid #1D6FE8' : '1px solid #D1D5DB',
                                }}>{pos}</button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Diagnostic note */}
                  {line.isDiagnostic && (
                    <div style={{ marginTop: 8, padding: '8px 12px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, fontSize: 11, color: '#1D6FE8' }}>
                      Diagnostic — parts will be added after inspection
                    </div>
                  )}

                  {/* Auto rough parts */}
                  {line.roughParts.length > 0 && !line.isDiagnostic && (
                    <div style={{ marginTop: 8, padding: '8px 12px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: 6 }}>Auto-Generated Parts (rough)</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {line.roughParts.filter(p => !p.is_labor).map((p, pi) => (
                          <span key={pi} style={{ padding: '3px 8px', borderRadius: 5, fontSize: 10, background: '#FFF7ED', color: '#EA580C', border: '1px solid #FED7AA' }}>
                            {p.quantity > 1 ? `${p.quantity}x ` : ''}{p.rough_name}
                          </span>
                        ))}
                        {line.roughParts.filter(p => p.is_labor).map((p, pi) => (
                          <span key={`l${pi}`} style={{ padding: '3px 8px', borderRadius: 5, fontSize: 10, background: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB' }}>
                            {p.rough_name} (inspection)
                          </span>
                        ))}
                      </div>
                      <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 4 }}>Parts dept will replace with real names + part numbers</div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setJobLines(prev => [...prev, { description: '', skills: [], tirePositions: [], isTire: false, isDiagnostic: false, roughParts: [] }])} style={btnS}>+ Add Job Line</button>
              <button onClick={() => setStep('edit')} style={btnS}>Back to Edit</button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#DC2626', fontSize: 13, marginBottom: 16 }}>{error}</div>}

        {/* FIX 1: Single button — different label per step */}
        {step === 'edit' && canCreate && (
          <button onClick={handleCreateClick} style={{ ...btnP, width: '100%', padding: '16px 28px', fontSize: 16 }}>
            Create Work Order
          </button>
        )}
        {step === 'review' && jobLines.length > 0 && (
          <button onClick={handleConfirmCreate} disabled={submitting} style={{ ...btnP, width: '100%', padding: '16px 28px', fontSize: 16, opacity: submitting ? 0.5 : 1 }}>
            {submitting ? 'Creating Work Order...' : 'Confirm & Create Work Order'}
          </button>
        )}
      </div>
    </div>
  )
}
