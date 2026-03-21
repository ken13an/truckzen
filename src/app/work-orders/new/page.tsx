'use client'
import { useEffect, useState, useRef } from 'react'
import { ChevronLeft } from 'lucide-react'
import AITextInput from '@/components/ai-text-input'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser, type UserProfile } from '@/lib/auth'

interface Customer {
  id: string
  company_name: string
  contact_name: string | null
  phone: string | null
}

interface Asset {
  id: string
  unit_number: string
  year: number | null
  make: string | null
  model: string | null
}

const FONT = "'Instrument Sans', sans-serif"

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #E5E7EB',
  borderRadius: 12,
  padding: 20,
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#6B7280',
  textTransform: 'uppercase',
  letterSpacing: '.04em',
  marginBottom: 6,
  fontFamily: FONT,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #D1D5DB',
  borderRadius: 8,
  padding: '10px 14px',
  fontSize: 14,
  color: '#1A1A1A',
  fontFamily: FONT,
  outline: 'none',
  boxSizing: 'border-box',
}

const btnPrimary: React.CSSProperties = {
  background: '#1D6FE8',
  color: '#fff',
  fontWeight: 700,
  borderRadius: 10,
  border: 'none',
  padding: '12px 28px',
  fontSize: 14,
  cursor: 'pointer',
  fontFamily: FONT,
}

const btnSecondary: React.CSSProperties = {
  background: '#fff',
  color: '#1D6FE8',
  fontWeight: 600,
  borderRadius: 8,
  border: '1px solid #D1D5DB',
  padding: '8px 18px',
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: FONT,
}

export default function NewWorkOrderPage() {
  const supabase = createClient()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])

  // Step 1: Customer
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Step 2: Vehicle
  const [assets, setAssets] = useState<Asset[]>([])
  const [assetsLoading, setAssetsLoading] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [showAllVehicles, setShowAllVehicles] = useState(false)

  // Step 3: Concern
  const [complaint, setComplaint] = useState('')
  const [priority, setPriority] = useState('normal')

  // Step 4: AI Review
  const [step, setStep] = useState<'edit' | 'review'>('edit')
  const [aiLoading, setAiLoading] = useState(false)
  const [jobLines, setJobLines] = useState<any[]>([])

  // Step 5: Submit
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Load user and customers on mount
  useEffect(() => {
    getCurrentUser(supabase).then(async (p) => {
      if (!p) { window.location.href = '/login'; return }
      setProfile(p)
      const { data } = await supabase
        .from('customers')
        .select('id, company_name, contact_name, phone')
        .eq('shop_id', p.shop_id)
      if (data) setCustomers(data)
    })
  }, [])

  // Load assets when customer selected
  useEffect(() => {
    if (!selectedCustomer || !profile) return
    setAssetsLoading(true)
    setSelectedAsset(null)
    setShowAllVehicles(false)
    fetch(`/api/assets?shop_id=${profile.shop_id}&customer_id=${selectedCustomer.id}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setAssets(data) })
      .finally(() => setAssetsLoading(false))
  }, [selectedCustomer, profile])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Filter customers
  const filteredCustomers = customerSearch.trim()
    ? customers.filter(c => {
        const q = customerSearch.toLowerCase()
        return (
          c.company_name?.toLowerCase().includes(q) ||
          c.contact_name?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q)
        )
      })
    : []

  // Load all vehicles (no customer filter)
  function loadAllVehicles() {
    if (!profile) return
    setAssetsLoading(true)
    setShowAllVehicles(true)
    setSelectedAsset(null)
    fetch(`/api/assets?shop_id=${profile.shop_id}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setAssets(data) })
      .finally(() => setAssetsLoading(false))
  }

  // AI review
  async function handleAiReview() {
    if (!complaint.trim()) return
    setAiLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ai/action-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ complaint: complaint.trim() }),
      })
      const data = await res.json()
      if (data.action_items && Array.isArray(data.action_items)) {
        // Normalize: AI now returns {description, skills} objects
        setJobLines(data.action_items.map((item: any) =>
          typeof item === 'string' ? { description: item, skills: [] } : { description: item.description || item, skills: item.skills || [] }
        ))
      } else {
        setJobLines([{ description: complaint.trim().toUpperCase(), skills: [] }])
      }
      setStep('review')
    } catch {
      setError('Failed to process with AI. Please try again.')
    } finally {
      setAiLoading(false)
    }
  }

  // Submit
  async function handleSubmit() {
    if (!profile || !complaint.trim() || jobLines.length === 0) return
    const validLines = jobLines.filter((l: any) => typeof l === 'string' ? l.trim() : l.description?.trim())
    if (validLines.length === 0) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: profile.shop_id,
          user_id: profile.id,
          asset_id: selectedAsset?.id || null,
          customer_id: selectedCustomer?.id || null,
          complaint: complaint.trim(),
          priority,
          job_lines: jobLines.filter((l: any) => (typeof l === 'string' ? l.trim() : l.description?.trim())),
        }),
      })
      if (!res.ok) {
        const errData = await res.json()
        setError(errData.error || 'Failed to create work order')
        setSubmitting(false)
        return
      }
      const wo = await res.json()
      window.location.href = `/work-orders/${wo.id}`
    } catch {
      setError('Network error. Please try again.')
      setSubmitting(false)
    }
  }

  function updateJobLine(index: number, value: string) {
    setJobLines(prev => prev.map((l, i) => i === index ? value : l))
  }

  function removeJobLine(index: number) {
    setJobLines(prev => prev.filter((_, i) => i !== index))
  }

  function addJobLine() {
    setJobLines(prev => [...prev, ''])
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F4F5F7', fontFamily: FONT, padding: 24 }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        {/* Back link */}
        <a href="/work-orders" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#F3F4F6', borderRadius: 8, fontSize: 14, fontWeight: 700, color: '#374151', textDecoration: 'none', marginBottom: 20 }}>
  <ChevronLeft size={16} strokeWidth={2} /> Work Orders
</a>

        {/* Title */}
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1A1A1A', marginTop: 12, marginBottom: 28, fontFamily: FONT }}>
          New Work Order
        </h1>

        {/* Step 1: Customer */}
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={labelStyle}>Customer</div>
          {selectedCustomer ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', fontFamily: FONT }}>
                  {selectedCustomer.company_name}
                </div>
                {selectedCustomer.contact_name && (
                  <div style={{ fontSize: 13, color: '#6B7280', fontFamily: FONT, marginTop: 2 }}>
                    {selectedCustomer.contact_name}
                  </div>
                )}
                {selectedCustomer.phone && (
                  <div style={{ fontSize: 13, color: '#6B7280', fontFamily: FONT, marginTop: 2 }}>
                    {selectedCustomer.phone}
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedCustomer(null)
                  setCustomerSearch('')
                  setAssets([])
                  setSelectedAsset(null)
                }}
                style={btnSecondary}
              >
                Change
              </button>
            </div>
          ) : (
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search by company, contact, or phone..."
                value={customerSearch}
                onChange={e => {
                  setCustomerSearch(e.target.value)
                  setShowDropdown(true)
                }}
                onFocus={() => { if (customerSearch.trim()) setShowDropdown(true) }}
                style={inputStyle}
              />
              {showDropdown && filteredCustomers.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: '#fff',
                    border: '1px solid #E5E7EB',
                    borderRadius: 8,
                    marginTop: 4,
                    maxHeight: 240,
                    overflowY: 'auto',
                    zIndex: 10,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                >
                  {filteredCustomers.map(c => (
                    <div
                      key={c.id}
                      onClick={() => {
                        setSelectedCustomer(c)
                        setShowDropdown(false)
                        setCustomerSearch('')
                      }}
                      style={{
                        padding: '10px 14px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #F3F4F6',
                        fontFamily: FONT,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>{c.company_name}</div>
                      {c.contact_name && (
                        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{c.contact_name}</div>
                      )}
                      {c.phone && (
                        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>{c.phone}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 2: Vehicle */}
        {selectedCustomer && (
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={labelStyle}>Vehicle</div>
              {!showAllVehicles && (
                <button onClick={loadAllVehicles} style={{ ...btnSecondary, padding: '4px 12px', fontSize: 11 }}>
                  All Vehicles
                </button>
              )}
            </div>
            {assetsLoading ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF', fontSize: 13, fontFamily: FONT }}>
                Loading vehicles...
              </div>
            ) : assets.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF', fontSize: 13, fontFamily: FONT }}>
                No vehicles found{showAllVehicles ? '' : ' for this customer'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {assets.map(a => {
                  const isSelected = selectedAsset?.id === a.id
                  return (
                    <div
                      key={a.id}
                      onClick={() => setSelectedAsset(a)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 8,
                        border: isSelected ? '2px solid #1D6FE8' : '1px solid #E5E7EB',
                        background: isSelected ? '#EFF6FF' : '#fff',
                        cursor: 'pointer',
                        fontFamily: FONT,
                        transition: 'border-color 0.15s',
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>
                        #{a.unit_number}
                      </span>
                      {(a.year || a.make || a.model) && (
                        <span style={{ fontSize: 13, color: '#6B7280', marginLeft: 8 }}>
                          {[a.year, a.make, a.model].filter(Boolean).join(' ')}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Concern */}
        {selectedCustomer && step === 'edit' && (
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={labelStyle}>Describe the concern</div>
              <AITextInput
                value={complaint}
                onChange={setComplaint}
                context="service_writer"
                theme="light"
                shopId={profile?.shop_id}
                userId={profile?.id}
                truckInfo={selectedAsset ? { year: selectedAsset.year?.toString(), make: selectedAsset.make || '', model: selectedAsset.model || '' } : undefined}
                placeholder="e.g. Oil change, brake noise, check engine light..."
                rows={5}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 100, paddingRight: 48 }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={labelStyle}>Priority</div>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                style={{
                  ...inputStyle,
                  appearance: 'auto',
                }}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <button
              onClick={handleAiReview}
              disabled={!complaint.trim() || aiLoading}
              style={{
                ...btnPrimary,
                opacity: !complaint.trim() || aiLoading ? 0.5 : 1,
                width: '100%',
              }}
            >
              {aiLoading ? 'AI Processing...' : 'Review Job Lines'}
            </button>
          </div>
        )}

        {/* Step 4: AI Review */}
        {step === 'review' && (
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <div style={{ ...labelStyle, marginBottom: 14 }}>Job Lines</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {jobLines.map((line: any, i: number) => {
                const desc = typeof line === 'string' ? line : line.description || ''
                const skills = typeof line === 'string' ? [] : (line.skills || [])
                return (
                <div key={i}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="text"
                    value={desc}
                    onChange={e => updateJobLine(i, typeof line === 'string' ? e.target.value : { ...line, description: e.target.value })}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    onClick={() => removeJobLine(i)}
                    style={{
                      background: 'none',
                      border: '1px solid #D1D5DB',
                      borderRadius: 8,
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: 14,
                      color: '#EF4444',
                      fontFamily: FONT,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    Remove
                  </button>
                  </div>
                  {skills.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4, marginLeft: 4 }}>
                      {skills.map((s: string) => (
                        <span key={s} style={{ fontSize: 10, padding: '2px 6px', background: '#EFF6FF', color: '#1D6FE8', borderRadius: 4 }}>{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              )})}

            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={addJobLine} style={btnSecondary}>
                Add Job Line
              </button>
              <button
                onClick={() => setStep('edit')}
                style={btnSecondary}
              >
                Back to Edit
              </button>
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div style={{
            padding: '12px 16px',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 8,
            color: '#DC2626',
            fontSize: 13,
            fontFamily: FONT,
            marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {/* Step 5: Submit */}
        {step === 'review' && jobLines.length > 0 && (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              ...btnPrimary,
              width: '100%',
              padding: '14px 28px',
              fontSize: 16,
              opacity: submitting ? 0.5 : 1,
            }}
          >
            {submitting ? 'Creating...' : 'Create Work Order'}
          </button>
        )}
      </div>
    </div>
  )
}
