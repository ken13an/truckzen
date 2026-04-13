'use client'
import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser, type UserProfile } from '@/lib/auth'
import { useTheme } from '@/hooks/useTheme'

interface CustomerResult { id: string; company_name: string; contact_name: string | null; phone: string | null; email: string | null }
interface UnitResult { id: string; unit_number: string | null; year: number | null; make: string | null; model: string | null; vin: string | null }

export default function NewServiceRequestPage() {
  const { tokens: th } = useTheme()
  const supabase = createClient()
  const [user, setUser] = useState<UserProfile | null>(null)

  // Customer
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<CustomerResult[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null)
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newCust, setNewCust] = useState({ company_name: '', contact_name: '', phone: '', email: '' })
  const [searching, setSearching] = useState(false)

  // Unit
  const [units, setUnits] = useState<UnitResult[]>([])
  const [selectedUnit, setSelectedUnit] = useState<UnitResult | null>(null)
  const [showNewUnit, setShowNewUnit] = useState(false)
  const [newUnit, setNewUnit] = useState({ unit_number: '', year: '', make: '', model: '', vin: '', unit_type: 'truck', mileage: '' })
  const [loadingUnits, setLoadingUnits] = useState(false)

  // Complaint
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('normal')
  const [internalNotes, setInternalNotes] = useState('')

  // Submit
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getCurrentUser(supabase).then(p => {
      if (!p) { window.location.href = '/login'; return }
      setUser(p)
    })
  }, [])

  // Debounced customer search
  const searchCustomers = useCallback(async (q: string) => {
    if (!user || q.length < 2) { setCustomerResults([]); return }
    setSearching(true)
    const res = await fetch(`/api/customers?shop_id=${user.shop_id}&q=${encodeURIComponent(q)}&per_page=8`)
    if (res.ok) {
      const json = await res.json()
      setCustomerResults(json.data || json || [])
    }
    setSearching(false)
  }, [user])

  useEffect(() => {
    const t = setTimeout(() => searchCustomers(customerSearch), 300)
    return () => clearTimeout(t)
  }, [customerSearch, searchCustomers])

  // Load units when customer selected
  useEffect(() => {
    if (!selectedCustomer || !user) { setUnits([]); return }
    setLoadingUnits(true)
    setSelectedUnit(null)
    setShowNewUnit(false)
    fetch(`/api/assets?shop_id=${user.shop_id}&customer_id=${selectedCustomer.id}`)
      .then(async res => {
        if (res.ok) {
          const data = await res.json()
          const arr = Array.isArray(data) ? data : (data.data || [])
          setUnits(arr)
          if (arr.length === 0) setShowNewUnit(true)
        }
      })
      .finally(() => setLoadingUnits(false))
  }, [selectedCustomer, user])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) { setError('Complaint description is required.'); return }
    if (!selectedCustomer && !newCust.company_name.trim()) { setError('Select or create a customer.'); return }
    if (!user) return

    setSubmitting(true)
    setError('')

    const payload: any = {
      action: 'create',
      shop_id: user.shop_id,
      user_id: user.id,
      description: description.trim(),
      priority,
      internal_notes: internalNotes.trim() || null,
    }

    if (selectedCustomer) {
      payload.customer_id = selectedCustomer.id
    } else if (newCust.company_name.trim()) {
      payload.new_customer = newCust
    }

    if (selectedUnit) {
      payload.unit_id = selectedUnit.id
    } else if (showNewUnit && newUnit.unit_number.trim()) {
      payload.new_unit = newUnit
    }

    const res = await fetch('/api/service-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }))
      setError(err.error || 'Failed to create service request')
      setSubmitting(false)
      return
    }

    window.location.href = '/service-requests'
  }

  const S: Record<string, React.CSSProperties> = {
    page: { padding: 24, fontFamily: "'Instrument Sans', sans-serif", maxWidth: 720, margin: '0 auto' },
    back: { fontSize: 12, color: th.textSecondary, textDecoration: 'none', display: 'block', marginBottom: 20 },
    title: { fontSize: 22, fontWeight: 700, color: th.text, marginBottom: 4 },
    sub: { fontSize: 13, color: th.textSecondary, marginBottom: 28 },
    section: { background: th.bgCard, border: `1px solid ${th.border}`, borderRadius: 12, padding: 20, marginBottom: 16 },
    sectionTitle: { fontSize: 13, fontWeight: 700, color: th.text, marginBottom: 14 },
    label: { fontSize: 11, fontWeight: 600, color: th.textSecondary, textTransform: 'uppercase' as const, letterSpacing: '.06em', fontFamily: "'IBM Plex Mono', monospace", display: 'block', marginBottom: 6 },
    input: { width: '100%', padding: '10px 12px', background: th.inputBg, border: `1px solid ${th.border}`, borderRadius: 8, fontSize: 13, color: th.text, outline: 'none', fontFamily: 'inherit', minHeight: 42, boxSizing: 'border-box' as const },
    textarea: { width: '100%', padding: '10px 12px', background: th.inputBg, border: `1px solid ${th.border}`, borderRadius: 8, fontSize: 13, color: th.text, outline: 'none', fontFamily: 'inherit', minHeight: 100, resize: 'vertical' as const, boxSizing: 'border-box' as const },
    select: { width: '100%', padding: '10px 12px', background: th.inputBg, border: `1px solid ${th.border}`, borderRadius: 8, fontSize: 13, color: th.text, outline: 'none', fontFamily: 'inherit', minHeight: 42, boxSizing: 'border-box' as const },
    row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
    field: { marginBottom: 12 },
    custCard: { padding: '10px 14px', background: 'rgba(29,111,232,.08)', border: '1px solid rgba(29,111,232,.2)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    unitCard: { padding: '8px 12px', background: th.inputBg, border: `1px solid ${th.border}`, borderRadius: 8, cursor: 'pointer', marginBottom: 6 },
    unitCardActive: { padding: '8px 12px', background: 'rgba(29,111,232,.08)', border: '1px solid rgba(29,111,232,.25)', borderRadius: 8, cursor: 'pointer', marginBottom: 6 },
    secondaryBtn: { padding: '7px 14px', background: 'none', border: `1px solid ${th.border}`, borderRadius: 8, color: th.textSecondary, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
    submitBtn: { width: '100%', padding: 14, background: th.accent, border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, color: th.bgLight, cursor: 'pointer', fontFamily: 'inherit', minHeight: 48, boxShadow: '0 0 16px rgba(29,111,232,.25)' },
    submitDisabled: { width: '100%', padding: 14, background: th.inputBg, border: `1px solid ${th.border}`, borderRadius: 10, fontSize: 14, fontWeight: 600, color: th.textSecondary, cursor: 'not-allowed', fontFamily: 'inherit', minHeight: 48 },
    error: { padding: '10px 12px', background: 'rgba(217,79,79,.08)', border: '1px solid rgba(217,79,79,.2)', borderRadius: 8, fontSize: 12, color: '#D94F4F', marginBottom: 16 },
    searchResult: { padding: '8px 12px', cursor: 'pointer', borderBottom: `1px solid ${th.border}` },
  }

  if (!user) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: th.textSecondary }}>Loading...</div>

  return (
    <div style={S.page}>
      <a href="/service-requests" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: th.border, borderRadius: 8, fontSize: 14, fontWeight: 700, color: th.text, textDecoration: 'none', marginBottom: 20 }}>
  <ChevronLeft size={16} strokeWidth={2} /> Service Requests
</a>
      <div style={S.title}>New Service Request</div>
      <div style={S.sub}>Service writer check-in — create a request on behalf of the customer</div>

      <form onSubmit={handleSubmit}>
        {/* Section 1: Customer */}
        <div style={S.section}>
          <div style={S.sectionTitle}>Customer</div>

          {selectedCustomer ? (
            <div style={S.custCard}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: th.text }}>{selectedCustomer.company_name}</div>
                <div style={{ fontSize: 11, color: th.textSecondary }}>
                  {[selectedCustomer.contact_name, selectedCustomer.phone].filter(Boolean).join(' - ') || 'No contact info'}
                </div>
              </div>
              <button type="button" style={S.secondaryBtn} onClick={() => { setSelectedCustomer(null); setSelectedUnit(null); setUnits([]); setCustomerSearch(''); setShowNewCustomer(false) }}>Change</button>
            </div>
          ) : showNewCustomer ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: th.accentLight }}>New Customer</div>
                <button type="button" style={S.secondaryBtn} onClick={() => setShowNewCustomer(false)}>Search Instead</button>
              </div>
              <div style={S.row}>
                <div style={S.field}>
                  <label style={S.label}>Company Name *</label>
                  <input style={S.input} value={newCust.company_name} onChange={e => setNewCust({ ...newCust, company_name: e.target.value })} placeholder="Company name" required />
                </div>
                <div style={S.field}>
                  <label style={S.label}>Contact Name</label>
                  <input style={S.input} value={newCust.contact_name} onChange={e => setNewCust({ ...newCust, contact_name: e.target.value })} placeholder="First Last" />
                </div>
              </div>
              <div style={S.row}>
                <div style={S.field}>
                  <label style={S.label}>Phone</label>
                  <input style={S.input} type="tel" value={newCust.phone} onChange={e => setNewCust({ ...newCust, phone: e.target.value })} placeholder="(555) 555-5555" />
                </div>
                <div style={S.field}>
                  <label style={S.label}>Email</label>
                  <input style={S.input} type="email" value={newCust.email} onChange={e => setNewCust({ ...newCust, email: e.target.value })} placeholder="email@company.com" />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ position: 'relative' }}>
                <input
                  style={S.input}
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  placeholder="Search by company name, contact, or phone..."
                  autoFocus
                />
                {searching && <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: th.textSecondary }}>Searching...</div>}
              </div>
              {customerResults.length > 0 && (
                <div style={{ background: th.inputBg, border: `1px solid ${th.border}`, borderRadius: 8, marginTop: 6, maxHeight: 200, overflowY: 'auto' }}>
                  {customerResults.map(c => (
                    <div key={c.id} style={S.searchResult}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(29,111,232,.08)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      onClick={() => { setSelectedCustomer(c); setCustomerResults([]); setCustomerSearch('') }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: th.text }}>{c.company_name || 'Unnamed'}</div>
                      <div style={{ fontSize: 10, color: th.textSecondary }}>{[c.contact_name, c.phone].filter(Boolean).join(' - ')}</div>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" style={{ ...S.secondaryBtn, marginTop: 10 }} onClick={() => { setShowNewCustomer(true); setCustomerResults([]); setSelectedUnit(null); setUnits([]) }}>+ New Customer</button>
            </div>
          )}
        </div>

        {/* Section 2: Unit */}
        {(selectedCustomer || showNewCustomer) && (
          <div style={S.section}>
            <div style={S.sectionTitle}>Unit / Vehicle</div>

            {loadingUnits ? (
              <div style={{ color: th.textSecondary, fontSize: 12 }}>Loading units...</div>
            ) : (
              <>
                {units.length > 0 && !showNewUnit && (
                  <div style={{ marginBottom: 10 }}>
                    {units.map(u => (
                      <div key={u.id}
                        style={selectedUnit?.id === u.id ? S.unitCardActive : S.unitCard}
                        onClick={() => { setSelectedUnit(u); setShowNewUnit(false) }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: selectedUnit?.id === u.id ? th.accentLight : th.text }}>
                          #{u.unit_number || '—'} {u.year ? `${u.year} ` : ''}{u.make || ''} {u.model || ''}
                        </div>
                        {u.vin && <div style={{ fontSize: 10, color: th.textTertiary, fontFamily: 'monospace' }}>{u.vin}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {showNewUnit ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: th.accentLight }}>New Unit</div>
                      {units.length > 0 && <button type="button" style={S.secondaryBtn} onClick={() => setShowNewUnit(false)}>Select Existing</button>}
                    </div>
                    <div style={S.row}>
                      <div style={S.field}>
                        <label style={S.label}>Unit Number</label>
                        <input style={S.input} value={newUnit.unit_number} onChange={e => setNewUnit({ ...newUnit, unit_number: e.target.value })} placeholder="e.g. 2717" />
                      </div>
                      <div style={S.field}>
                        <label style={S.label}>VIN</label>
                        <input style={S.input} value={newUnit.vin} onChange={e => setNewUnit({ ...newUnit, vin: e.target.value })} placeholder="17 characters" />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                      <div style={S.field}>
                        <label style={S.label}>Year</label>
                        <input style={S.input} type="number" value={newUnit.year} onChange={e => setNewUnit({ ...newUnit, year: e.target.value })} placeholder="2024" />
                      </div>
                      <div style={S.field}>
                        <label style={S.label}>Make</label>
                        <input style={S.input} value={newUnit.make} onChange={e => setNewUnit({ ...newUnit, make: e.target.value })} placeholder="Peterbilt" />
                      </div>
                      <div style={S.field}>
                        <label style={S.label}>Model</label>
                        <input style={S.input} value={newUnit.model} onChange={e => setNewUnit({ ...newUnit, model: e.target.value })} placeholder="579" />
                      </div>
                    </div>
                    <div style={S.row}>
                      <div style={S.field}>
                        <label style={S.label}>Type</label>
                        <select style={S.select} value={newUnit.unit_type} onChange={e => setNewUnit({ ...newUnit, unit_type: e.target.value })}>
                          <option value="truck">Truck</option>
                          <option value="trailer">Trailer</option>
                          <option value="reefer">Reefer</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div style={S.field}>
                        <label style={S.label}>Mileage</label>
                        <input style={S.input} type="number" value={newUnit.mileage} onChange={e => setNewUnit({ ...newUnit, mileage: e.target.value })} placeholder="Current miles" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <button type="button" style={S.secondaryBtn} onClick={() => { setShowNewUnit(true); setSelectedUnit(null) }}>+ New Unit</button>
                )}
              </>
            )}
          </div>
        )}

        {/* Section 3: Complaint */}
        <div style={S.section}>
          <div style={S.sectionTitle}>Complaint</div>
          <div style={S.field}>
            <label style={S.label}>Description *</label>
            <textarea style={S.textarea} value={description} onChange={e => { setDescription(e.target.value); setError('') }}
              placeholder="Describe the customer's complaint or reason for visit..." />
          </div>
          <div style={S.field}>
            <label style={S.label}>Priority</label>
            <select style={S.select} value={priority} onChange={e => setPriority(e.target.value)}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        {/* Section 4: Writer Notes */}
        <div style={S.section}>
          <div style={S.sectionTitle}>Internal Notes</div>
          <textarea style={S.textarea} value={internalNotes} onChange={e => setInternalNotes(e.target.value)}
            placeholder="Internal notes for the shop team..." />
        </div>

        {/* Error + Submit */}
        {error && <div style={S.error}>{error}</div>}
        <button type="submit" disabled={submitting} style={submitting ? S.submitDisabled : S.submitBtn}>
          {submitting ? 'Creating...' : 'Create Service Request'}
        </button>
      </form>
    </div>
  )
}
