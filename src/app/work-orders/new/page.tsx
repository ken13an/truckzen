/**
 * TruckZen — Original Design
 * New Work Order — AI built into flow, tire positions, single button
 */
'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { ChevronLeft } from 'lucide-react'
import { VinInput } from '@/components/shared/VinInput'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser, type UserProfile } from '@/lib/auth'
import { getWorkorderRoute } from '@/lib/navigation/workorder-route'
import { mergeDraftLines, type DraftJobLine } from '@/lib/merge-lines'
import { SERVICE_WRITE_ROLES } from '@/lib/roles'
import { getPartSuggestions, type PartSuggestion, getAutoRoughParts, isDiagnosticJob, needsClarification, getClarificationOptionsForInput, preRouteComplaintBeforeAi, getBrainAssist, type BrainAssistRequest, type BrainAssistResponse, resolveClarification, hasRecognizedVerb } from '@/lib/parts-suggestions'
import { useTheme } from '@/hooks/useTheme'

interface Customer { id: string; company_name: string; contact_name: string | null; phone: string | null; is_fleet?: boolean }
interface Asset { id: string; unit_number: string; year: number | null; make: string | null; model: string | null; vin?: string; ownership_type?: string; unit_type?: string; is_owner_operator?: boolean }

const FONT = "'Instrument Sans', sans-serif"

const TIRE_POSITIONS = [
  { group: 'Steer (Axle 1)', positions: ['DS Steer', 'PS Steer'] },
  { group: 'Drive (Axle 2)', positions: ['DS 2nd Axle Outer', 'DS 2nd Axle Inner', 'PS 2nd Axle Outer', 'PS 2nd Axle Inner'] },
  { group: 'Rear (Axle 3)', positions: ['DS 3rd Axle Outer', 'DS 3rd Axle Inner', 'PS 3rd Axle Outer', 'PS 3rd Axle Inner'] },
]

function isTireJob(desc: string): boolean {
  const d = desc.toLowerCase()
  // Spare tire is distinct work with no axle position — don't surface the
  // position selector for spare-tire lines and don't merge spare truth into
  // axle tire rough-parts on toggle.
  if (d.includes('spare')) return false
  return ['tire', 'tyre', 'flat', 'blowout', 'tire change', 'tire replacement', 'tire repair'].some(k => d.includes(k))
}

const KNOWN_REPAIR_WORDS = ['oil', 'brake', 'engine', 'tire', 'tyre', 'pm', 'service', 'inspect', 'replace', 'repair', 'check', 'fix', 'leak', 'light', 'lamp', 'filter', 'belt', 'hose', 'cool', 'heat', 'ac', 'air', 'fuel', 'exhaust', 'trans', 'clutch', 'steer', 'align', 'suspen', 'shock', 'spring', 'weld', 'body', 'frame', 'door', 'window', 'mirror', 'wiper', 'horn', 'def', 'dpf', 'egr', 'turbo', 'alternator', 'starter', 'battery', 'charge', 'electric', 'wire', 'fuse', 'sensor', 'valve', 'pump', 'compressor', 'radiator', 'thermostat', 'diagnostic', 'dot', 'annual', 'wheel', 'hub', 'axle', 'drive', 'shaft', 'bearing', 'seal', 'gasket', 'mount', 'install', 'remove', 'adjust', 'bleed', 'flush', 'change', 'swap', 'lube', 'grease', 'paint', 'cab', 'fender', 'bumper', 'hood', 'trailer', 'fifth', 'glad', 'slack', 'drum', 'rotor', 'pad', 'shoe', 'caliper', 'abs', 'preventive', 'maintenance', 'full inspection', 'safety']

function isUnrecognizedJob(desc: string, skills: string[]): boolean {
  if (!desc || desc.trim().length < 2) return true
  if (skills && skills.length > 0) return false
  // Patch 123: consult canonical deterministic verb-intent recognition first. Jobs
  // like "clean gas tanks" / "check lights" are recognized by verb even though they
  // contain no KNOWN_REPAIR_WORDS noun. Noun-only input falls through to the
  // KNOWN_REPAIR_WORDS fallback for clarification gating.
  if (hasRecognizedVerb(desc)) return false
  const d = desc.toLowerCase()
  return !KNOWN_REPAIR_WORDS.some(w => d.includes(w))
}

export default function NewWorkOrderPage() {
  const { tokens: t } = useTheme()
  const supabase = createClient()

  const card: React.CSSProperties = { background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-cardBorder)'}`, borderRadius: 12, padding: 20 }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--tz-textSecondary)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6, fontFamily: FONT, display: 'block' }
  const inp: React.CSSProperties = { width: '100%', border: `1px solid ${'var(--tz-inputBorder)'}`, borderRadius: 8, padding: '10px 14px', fontSize: 14, color: 'var(--tz-text)', fontFamily: FONT, outline: 'none', boxSizing: 'border-box', background: 'var(--tz-inputBg)' }
  const btnP: React.CSSProperties = { background: 'var(--tz-accent)', color: 'var(--tz-bgLight)', fontWeight: 700, borderRadius: 10, border: 'none', padding: '12px 28px', fontSize: 14, cursor: 'pointer', fontFamily: FONT }
  const btnS: React.CSSProperties = { background: 'var(--tz-bgCard)', color: 'var(--tz-accent)', fontWeight: 600, borderRadius: 8, border: `1px solid ${'var(--tz-inputBorder)'}`, padding: '8px 18px', fontSize: 13, cursor: 'pointer', fontFamily: FONT }

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
  const [jobLines, setJobLines] = useState<DraftJobLine[]>([])
  const [aiFailed, setAiFailed] = useState(false)
  const [mergeSelected, setMergeSelected] = useState<Set<number>>(new Set())

  const [inventoryParts, setInventoryParts] = useState<any[]>([])
  const [suggestions, setSuggestions] = useState<PartSuggestion[]>([])
  const [brainSuggestions, setBrainSuggestions] = useState<BrainAssistResponse[]>([])

  const [showNewUnit, setShowNewUnit] = useState(false)
  const [newUnit, setNewUnit] = useState({ number: '', vin: '', year: '', make: '', model: '' })
  const [submitting, setSubmitting] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [error, setError] = useState('')
  const [unitType, setUnitType] = useState<string | null>(null)
  const [mileageError, setMileageError] = useState('')

  // Draft auto-save state
  const [draftId, setDraftId] = useState<string | null>(null)
  const [draftBanner, setDraftBanner] = useState<{ id: string; complaint: string; customer: any; asset: any; priority: string; jobType: string; mileage: string; customerProvidesParts: boolean } | null>(null)
  const draftSavingRef = useRef(false)

  useEffect(() => {
    getCurrentUser(supabase).then(async (p) => {
      if (!p) { window.location.href = '/login'; return }
      // Only service-operational roles can create work orders
      const effectiveRole = p.impersonate_role || p.role
      if (!SERVICE_WRITE_ROLES.includes(effectiveRole)) { window.location.href = '/dashboard'; return }
      setProfile(p)
      const partsRes = await fetch(`/api/parts?shop_id=${p.shop_id}&per_page=50`)
      const partsData = await partsRes.json()
      if (partsData.data) setInventoryParts(partsData.data)
    })
  }, [])

  useEffect(() => {
    if (!selectedCustomer || !profile) return
    setAssetsLoading(true); setSelectedAsset(null); setShowVehicleList(true)
    fetch(`/api/assets?shop_id=${profile.shop_id}&customer_id=${selectedCustomer.id}`)
      .then(r => r.json()).then(data => { if (Array.isArray(data)) setAssets(data) })
      .finally(() => setAssetsLoading(false))
  }, [selectedCustomer, profile])

  // Load last mileage and ownership_type when asset selected
  useEffect(() => {
    if (!selectedAsset || !profile) { setLastMileage(null); setUnitType(null); return }
    // Set unitType immediately from selectedAsset (already has data from list query)
    if (selectedAsset.is_owner_operator) setUnitType('owner_operator')
    else if (selectedAsset.ownership_type) setUnitType(selectedAsset.ownership_type)
    else setUnitType('fleet_asset')
    // Fetch full asset details for odometer and to confirm ownership_type
    fetch(`/api/assets/${selectedAsset.id}`).then(r => r.ok ? r.json() : null).then((data: any) => {
      if (!data) return
      // Update unitType from full asset data (authoritative)
      if (data.is_owner_operator) setUnitType('owner_operator')
      else if (data.ownership_type) setUnitType(data.ownership_type)
      else setUnitType('fleet_asset')
      // Set odometer
      if (data.odometer) {
        setLastMileage({ value: data.odometer, date: '' })
        setMileage(String(data.odometer))
      }
    }).catch(() => {})
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

  // Server-side customer search
  useEffect(() => {
    if (!profile || !customerSearch.trim()) { setCustomers([]); return }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/customers?shop_id=${profile.shop_id}&q=${encodeURIComponent(customerSearch)}&per_page=10`)
      if (res.ok) {
        const json = await res.json()
        setCustomers(json.data || [])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [customerSearch, profile])

  // --- Draft auto-save ---
  const saveDraft = useCallback(async (beacon = false) => {
    if (!profile || !selectedCustomer || !selectedAsset) return
    if (draftSavingRef.current) return
    draftSavingRef.current = true
    const draftData = JSON.stringify({
      customer: selectedCustomer,
      asset: selectedAsset,
      complaint, priority, jobType, mileage,
      customerProvidesParts,
      newUnit: showNewUnit ? newUnit : null,
    })
    const payload = {
      shop_id: profile.shop_id, user_id: profile.id,
      customer_id: selectedCustomer.id, asset_id: selectedAsset.id,
      complaint, priority, job_type: jobType, mileage,
      draft_data: draftData,
    }
    try {
      if (beacon) {
        navigator.sendBeacon('/api/work-orders/draft', new Blob([JSON.stringify(payload)], { type: 'application/json' }))
      } else {
        await fetch('/api/work-orders/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      }
    } catch { /* silent — never show draft errors to user */ }
    draftSavingRef.current = false
  }, [profile, selectedCustomer, selectedAsset, complaint, priority, jobType, mileage, customerProvidesParts, showNewUnit, newUnit])

  // Check for existing drafts on page load
  useEffect(() => {
    if (!profile) return
    fetch(`/api/work-orders/draft?user_id=${profile.id}&shop_id=${profile.shop_id}`)
      .then(r => r.json())
      .then((drafts: any[]) => {
        if (drafts?.length > 0) {
          const d = drafts[0]
          try {
            const parsed = d.internal_notes ? JSON.parse(d.internal_notes) : null
            if (parsed) {
              setDraftBanner({
                id: d.id,
                complaint: d.complaint || '',
                customer: parsed.customer,
                asset: parsed.asset,
                priority: parsed.priority || 'normal',
                jobType: parsed.jobType || 'repair',
                mileage: parsed.mileage || '',
                customerProvidesParts: parsed.customerProvidesParts || false,
              })
            }
          } catch { /* ignore parse error */ }
        }
      })
      .catch(() => {})
  }, [profile])

  // Auto-save every 30 seconds when customer + vehicle selected
  useEffect(() => {
    if (!selectedCustomer || !selectedAsset || step !== 'edit') return
    const interval = setInterval(() => { saveDraft() }, 30000)
    return () => clearInterval(interval)
  }, [selectedCustomer, selectedAsset, saveDraft, step])

  // Save draft on beforeunload (navigation away)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (selectedCustomer && selectedAsset && step === 'edit') {
        saveDraft(true)
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [selectedCustomer, selectedAsset, saveDraft, step])

  // Restore draft
  function restoreDraft() {
    if (!draftBanner) return
    setSelectedCustomer(draftBanner.customer)
    setSelectedAsset(draftBanner.asset)
    setShowVehicleList(false)
    setComplaint(draftBanner.complaint)
    setPriority(draftBanner.priority)
    setJobType(draftBanner.jobType)
    setMileage(draftBanner.mileage)
    setCustomerProvidesParts(draftBanner.customerProvidesParts)
    setDraftId(draftBanner.id)
    setDraftBanner(null)
  }

  // Discard draft
  function discardDraft() {
    if (!draftBanner || !profile) return
    fetch(`/api/work-orders/draft?id=${draftBanner.id}&user_id=${profile.id}&shop_id=${profile.shop_id}`, { method: 'DELETE' }).catch(() => {})
    setDraftBanner(null)
  }

  // Delete draft after successful WO creation
  async function deleteDraftAfterCreate() {
    if (!profile || !selectedAsset) return
    try {
      await fetch(`/api/work-orders/draft?user_id=${profile.id}&shop_id=${profile.shop_id}&asset_id=${selectedAsset.id}`, { method: 'DELETE' })
    } catch {}
  }

  async function handleSaveDraft() {
    if (!profile) return
    setSavingDraft(true); setError('')
    try {
      // Delete any auto-saved draft first — prevents duplicates
      await deleteDraftAfterCreate()
      const res = await fetch('/api/work-orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: profile.shop_id, user_id: profile.id,
          asset_id: selectedAsset?.id || null, customer_id: selectedCustomer?.id || null,
          complaint: complaint.trim() || null, priority, mileage: mileage ? parseInt(mileage) : null, job_type: jobType,
          estimate_required: estimateRequired,
          status: 'draft',
        }),
      })
      if (!res.ok) { const e = await res.json(); setError(e.error || 'Failed to save draft'); setSavingDraft(false); return }
      window.location.href = '/work-orders'
    } catch { setError('Connection error — please try again'); setSavingDraft(false) }
  }

  const filteredCustomers = customers

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

  function validateMileage(): boolean {
    if (!mileage) { setMileageError('Current mileage is required'); return false }
    const val = parseInt(mileage)
    if (isNaN(val)) { setMileageError('Please enter a valid number'); return false }
    if (val < 0) { setMileageError('Mileage cannot be negative'); return false }
    if (val === 0) { setMileageError('Mileage cannot be 0 — enter the current odometer reading'); return false }
    if (val > 9999999) { setMileageError('Please enter a valid mileage (max 9,999,999)'); return false }
    setMileageError('')
    return true
  }

  const estimateRequired = selectedAsset
    ? (unitType === 'owner_operator' || unitType === 'outside_customer') && !['diagnostic', 'full_inspection'].includes(jobType)
    : false

  async function handleCreateClick() {
    if (!complaint.trim()) return
    if (complaint.trim().length < 3) { setError('Please describe the concern in more detail (at least 3 characters)'); return }
    if (!validateMileage()) return

    setStep('processing'); setError(''); setAiFailed(false); setDuplicateWarning('')

    const raw = complaint.trim()
    const route = preRouteComplaintBeforeAi(raw)

    // Post-deterministic brain adapter seam (TZBridge6) — runs at review step only.
    // Must NEVER run before clarification resolves. Only called when all lines are resolved.
    // Currently no-op. Later patches inject safe-family historical suggestions here.
    const runBrainSeam = (lines: typeof jobLines) => {
      // Guard: do not call brain if any line still needs clarification (TZBridge6A)
      if (lines.some(l => needsClarification(l.roughParts))) { setBrainSuggestions([]); return }
      const requests: BrainAssistRequest[] = lines.map(l => ({
        job_description: l.description,
        deterministic_rough_parts: l.roughParts.map(p => p.rough_name),
        is_diagnostic: l.isDiagnostic,
        is_tire: l.isTire,
        asset_make: selectedAsset?.make,
        asset_model: selectedAsset?.model,
        asset_year: selectedAsset?.year,
      }))
      // TZBridge7: returns PM/Oil Change suggestions for approved families, empty for all others
      setBrainSuggestions(getBrainAssist(requests))
    }

    if (route.decision === 'deterministic_single' || route.decision === 'ambiguous_noun_only') {
      const lines: typeof jobLines = [{ description: raw, skills: [], tirePositions: [], isTire: isTireJob(raw), isDiagnostic: isDiagnosticJob(raw), roughParts: getAutoRoughParts(raw) }]
      setJobLines(lines)
      runBrainSeam(lines)
      const dup = checkDuplicates(lines)
      if (dup) setDuplicateWarning(dup)
      setStep('review')
      return
    }

    if (route.decision === 'deterministic_multi') {
      const lines: typeof jobLines = route.segments.map(seg => ({
        description: seg, skills: [], tirePositions: [], isTire: isTireJob(seg), isDiagnostic: isDiagnosticJob(seg), roughParts: getAutoRoughParts(seg),
      }))
      setJobLines(lines)
      runBrainSeam(lines)
      const dup = checkDuplicates(lines)
      if (dup) setDuplicateWarning(dup)
      setStep('review')
      return
    }

    // send_to_ai — complex/multi-action/mixed-ambiguity complaints use AI splitting
    try {
      const res = await fetch('/api/ai/action-items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ complaint: raw, shop_id: profile?.shop_id, user_id: profile?.id }) })
      const data = await res.json()
      let lines: typeof jobLines = []
      if (data.action_items && Array.isArray(data.action_items) && data.action_items.length > 0) {
        lines = data.action_items.map((item: any) => {
          const desc = typeof item === 'string' ? item : item.description || ''
          return { description: desc, skills: typeof item === 'string' ? [] : item.skills || [], tirePositions: [], isTire: isTireJob(desc), isDiagnostic: isDiagnosticJob(desc), roughParts: getAutoRoughParts(desc) }
        })
      } else {
        lines = [{ description: raw, skills: [], tirePositions: [], isTire: isTireJob(raw), isDiagnostic: isDiagnosticJob(raw), roughParts: getAutoRoughParts(raw) }]
        setAiFailed(true)
      }
      setJobLines(lines)
      runBrainSeam(lines)
      const dup = checkDuplicates(lines)
      if (dup) setDuplicateWarning(dup)
    } catch {
      setJobLines([{ description: raw, skills: [], tirePositions: [], isTire: isTireJob(raw), isDiagnostic: isDiagnosticJob(raw), roughParts: getAutoRoughParts(raw) }])
      setAiFailed(true)
    }
    setStep('review')
  }

  async function handleConfirmCreate() {
    if (!profile) return
    // Validation
    if (!selectedCustomer) { setError('Please select a customer'); return }
    if (!selectedAsset) { setError('Please select a vehicle'); return }
    if (!complaint.trim()) { setError('Please describe the concern'); return }
    const mileageNum = parseInt(mileage)
    if (!mileageNum || mileageNum <= 0) { setError('Please enter current mileage'); return }
    if (jobLines.length === 0) { setError('Please add at least one job line'); return }
    if (jobLines.some(j => isUnrecognizedJob(j.description, j.skills))) { setError('Please fix or remove unrecognized job lines (shown in red)'); return }
    if (jobLines.some(j => needsClarification(j.roughParts))) { setError('Some job lines need clarification — please choose an action (Replace, Install, Repair, or Inspect)'); return }
    setSubmitting(true); setError('')
    try {
      // Delete any auto-saved draft BEFORE creating the real WO — prevents duplicates
      await deleteDraftAfterCreate()
      const res = await fetch('/api/work-orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: profile.shop_id, user_id: profile.id,
          asset_id: selectedAsset.id, customer_id: selectedCustomer.id,
          complaint: complaint.trim(), priority, mileage: mileageNum, job_type: jobType,
          estimate_required: estimateRequired,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
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
      window.location.href = getWorkorderRoute(wo.id)
    } catch { setError('Network error'); setSubmitting(false) }
  }

  function toggleTirePosition(lineIdx: number, pos: string) {
    setJobLines(prev => prev.map((l, i) => {
      if (i !== lineIdx) return l
      // Spare-tire lines do not have axle positions — never rewrite their
      // rough-parts from positional regen (would erase spare intent).
      if (l.description.toLowerCase().includes('spare')) return l
      const positions = l.tirePositions.includes(pos) ? l.tirePositions.filter(p => p !== pos) : [...l.tirePositions, pos]
      return { ...l, tirePositions: positions, roughParts: getAutoRoughParts(l.description, positions) }
    }))
  }

  const isFleet = selectedCustomer?.is_fleet
  const canCreate = complaint.trim() && (selectedAsset || (showNewUnit && newUnit.number.trim())) && mileage && parseInt(mileage) > 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--tz-bg)', fontFamily: FONT, padding: 24 }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <a href="/work-orders" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--tz-bgElevated)', borderRadius: 8, fontSize: 14, fontWeight: 700, color: 'var(--tz-text)', textDecoration: 'none', marginBottom: 20 }}>
          <ChevronLeft size={16} /> Work Orders
        </a>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--tz-text)', margin: '12px 0 28px' }}>New Work Order</h1>

        {/* Draft recovery banner */}
        {draftBanner && (
          <div style={{ marginBottom: 16, padding: '14px 18px', background: 'var(--tz-warningBg)', border: `1px solid ${'var(--tz-warning)'}`, borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tz-warning)' }}>You have an unsaved draft</div>
              <div style={{ fontSize: 12, color: 'var(--tz-warning)', marginTop: 2 }}>
                {draftBanner.customer?.company_name} — #{draftBanner.asset?.unit_number}
                {draftBanner.complaint && ` — ${draftBanner.complaint.slice(0, 60)}${draftBanner.complaint.length > 60 ? '...' : ''}`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={restoreDraft} style={{ padding: '8px 16px', background: 'var(--tz-warning)', color: 'var(--tz-bgLight)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>Continue</button>
              <button onClick={discardDraft} style={{ padding: '8px 16px', background: 'var(--tz-bgCard)', color: 'var(--tz-warning)', border: `1px solid ${'var(--tz-warning)'}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>Discard</button>
            </div>
          </div>
        )}

        {/* Customer */}
        <div style={{ ...card, marginBottom: 16 }}>
          <span style={lbl}>Customer</span>
          {selectedCustomer ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--tz-text)' }}>{selectedCustomer.company_name}</div>
                {selectedCustomer.contact_name && <div style={{ fontSize: 13, color: 'var(--tz-textSecondary)', marginTop: 2 }}>{selectedCustomer.contact_name}</div>}
              </div>
              <button onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); setAssets([]); setSelectedAsset(null) }} style={btnS}>Change</button>
            </div>
          ) : (
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <input type="text" placeholder="Search company, contact, or phone..." value={customerSearch} onChange={e => { setCustomerSearch(e.target.value); setShowDropdown(true) }} onFocus={() => { if (customerSearch.trim()) setShowDropdown(true) }} style={inp} />
              {showDropdown && filteredCustomers.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-cardBorder)'}`, borderRadius: 8, marginTop: 4, maxHeight: 240, overflowY: 'auto', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                  {filteredCustomers.map(c => (
                    <div key={c.id} onClick={() => { setSelectedCustomer(c); setShowDropdown(false); setCustomerSearch('') }} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${'var(--tz-border)'}` }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--tz-bgHover)')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tz-text)' }}>{c.company_name}</div>
                      {c.contact_name && <div style={{ fontSize: 12, color: 'var(--tz-textSecondary)', marginTop: 2 }}>{c.contact_name}</div>}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', border: `2px solid ${'var(--tz-accent)'}`, borderRadius: 8, background: 'var(--tz-accentBg)' }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tz-text)' }}>#{selectedAsset.unit_number}</span>
                  <span style={{ fontSize: 13, color: 'var(--tz-textSecondary)', marginLeft: 8 }}>{[selectedAsset.year, selectedAsset.make, selectedAsset.model].filter(Boolean).join(' ')}</span>
                  {(() => {
                    const ot = unitType || selectedAsset?.ownership_type || 'fleet_asset'
                    if (ot === 'owner_operator') return <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: 'var(--tz-warningBg)', color: 'var(--tz-warning)' }}>Owner Operator</span>
                    if (ot === 'outside_customer') return <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: 'var(--tz-accentBg)', color: 'var(--tz-accent)' }}>Outside Customer</span>
                    return <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: 'var(--tz-successBg)', color: 'var(--tz-success)' }}>Company Truck</span>
                  })()}
                </div>
                <button onClick={() => { setShowVehicleList(true); setSelectedAsset(null) }} style={btnS}>Change</button>
              </div>
            ) : (
              <>
                {assetsLoading ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--tz-textTertiary)', fontSize: 13 }}>Loading...</div>
                : assets.length === 0 ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--tz-textTertiary)', fontSize: 13 }}>No vehicles found</div>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {assets.map(a => (
                      <div key={a.id} onClick={() => { setSelectedAsset(a); setShowVehicleList(false) }} style={{ padding: '10px 14px', borderRadius: 8, border: `1px solid ${'var(--tz-cardBorder)'}`, background: 'var(--tz-bgCard)', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--tz-bgHover)')} onMouseLeave={e => (e.currentTarget.style.background = 'var(--tz-bgCard)')}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--tz-text)' }}>#{a.unit_number}</span>
                        {(a.year || a.make || a.model) && <span style={{ fontSize: 13, color: 'var(--tz-textSecondary)', marginLeft: 8 }}>{[a.year, a.make, a.model].filter(Boolean).join(' ')}</span>}
                      </div>
                    ))}
                  </div>}
                {!showNewUnit ? (
                  <button onClick={() => { setShowNewUnit(true); setSelectedAsset(null) }} style={{ ...btnS, marginTop: 10, fontSize: 12 }}>+ Add New Unit</button>
                ) : (
                  <div style={{ marginTop: 12, padding: 16, border: `1px solid ${'var(--tz-cardBorder)'}`, borderRadius: 10, background: 'var(--tz-bgElevated)' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tz-text)', marginBottom: 12 }}>New Unit</div>
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
            <input type="text" inputMode="numeric" value={mileage ? parseInt(mileage).toLocaleString() : ''} onChange={e => { const raw = e.target.value.replace(/[^0-9]/g, ''); if (raw.length <= 7) { setMileage(raw); setMileageError('') } }} placeholder="Enter current odometer reading" style={{ ...inp, borderColor: mileageError ? 'var(--tz-danger)' : 'var(--tz-inputBorder)' }} />
            {lastMileage && lastMileage.value > 0 && (
              <div style={{ fontSize: 11, color: 'var(--tz-textTertiary)', marginTop: 4 }}>
                Last recorded: {lastMileage.value.toLocaleString()} mi{lastMileage.date ? ` on ${new Date(lastMileage.date).toLocaleDateString()}` : ''}
              </div>
            )}
            {mileageError && (
              <div style={{ fontSize: 12, color: 'var(--tz-danger)', marginTop: 6 }}>{mileageError}</div>
            )}
            {mileageWarning && !mileageError && (
              <div style={{ fontSize: 12, color: mileageWarning.includes('lower') ? 'var(--tz-danger)' : 'var(--tz-warning)', marginTop: 6, padding: '6px 10px', background: mileageWarning.includes('lower') ? 'var(--tz-dangerBg)' : 'var(--tz-warningBg)', borderRadius: 6, border: `1px solid ${mileageWarning.includes('lower') ? 'var(--tz-danger)' : 'var(--tz-warning)'}` }}>
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
            {!selectedAsset && (
              <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--tz-surfaceMuted)', color: 'var(--tz-textSecondary)' }}>
                Select a vehicle to determine estimate requirements
              </div>
            )}
            {selectedAsset && (() => {
              const effectiveType = unitType || 'fleet_asset'
              const needsEstimate = (effectiveType === 'owner_operator' || effectiveType === 'outside_customer') && !['diagnostic', 'full_inspection'].includes(jobType)
              const greenMsg = ['diagnostic', 'full_inspection'].includes(jobType)
                ? `No estimate required — ${jobType === 'diagnostic' ? 'diagnostic' : 'inspection'} can start immediately`
                : 'No estimate required — work can start immediately'
              return (
                <div style={{ marginTop: 10, borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, background: needsEstimate ? 'var(--tz-warningBg)' : 'var(--tz-successBg)', border: `1px solid ${needsEstimate ? 'var(--tz-warning)' : 'var(--tz-success)'}`, borderRadius: 8, color: needsEstimate ? 'var(--tz-warning)' : 'var(--tz-success)' }}>
                    {needsEstimate ? 'Estimate required — must be approved before work begins' : greenMsg}
                  </div>
                  {needsEstimate && (
                    <div style={{ padding: '4px 12px 8px', fontSize: 11, color: 'var(--tz-warning)' }}>
                      Service writer must build and send estimate after creating this work order
                    </div>
                  )}
                </div>
              )
            })()}

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 13, color: 'var(--tz-text)', cursor: 'pointer' }}>
              <input type="checkbox" checked={customerProvidesParts} onChange={e => setCustomerProvidesParts(e.target.checked)} style={{ accentColor: 'var(--tz-accent)' }} />
              Customer provides own parts
            </label>

            {/* Parts suggestions */}
            {suggestions.length > 0 && (
              <div style={{ marginTop: 14, padding: 12, background: 'var(--tz-bgElevated)', border: `1px solid ${'var(--tz-cardBorder)'}`, borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tz-textSecondary)', textTransform: 'uppercase', marginBottom: 8 }}>Suggested Parts</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {suggestions.map((s, i) => (
                    <span key={i} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, background: s.source === 'inventory' ? 'var(--tz-accentBg)' : 'var(--tz-surfaceMuted)', color: s.source === 'inventory' ? 'var(--tz-accent)' : 'var(--tz-text)', border: `1px solid ${s.source === 'inventory' ? 'var(--tz-borderAccent)' : 'var(--tz-cardBorder)'}` }}>
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
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--tz-text)', marginBottom: 8 }}>Processing concern with AI...</div>
            <div style={{ fontSize: 12, color: 'var(--tz-textTertiary)' }}>Splitting into individual job lines</div>
          </div>
        )}

        {/* Job Lines Review (FIX 2: shown after AI auto-processes) */}
        {step === 'review' && (
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ ...lbl, marginBottom: 0 }}>Job Lines ({jobLines.length})</span>
              {aiFailed && <span style={{ fontSize: 10, color: 'var(--tz-warning)', background: 'var(--tz-warningBg)', padding: '2px 8px', borderRadius: 4 }}>AI could not split — created as single job</span>}
            </div>
            {/* Duplicate warning */}
            {duplicateWarning && (
              <div style={{ padding: '8px 12px', background: 'var(--tz-warningBg)', border: `1px solid ${'var(--tz-warning)'}`, borderRadius: 8, marginBottom: 12, fontSize: 12, color: 'var(--tz-warning)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{duplicateWarning}. Merge into one?</span>
                <button onClick={() => setDuplicateWarning('')} style={{ background: 'none', border: 'none', color: 'var(--tz-textTertiary)', fontSize: 11, cursor: 'pointer' }}>Dismiss</button>
              </div>
            )}

            {/* Merge controls */}
            {jobLines.length > 1 && mergeSelected.size >= 2 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--tz-accentBg)', border: `1px solid ${'var(--tz-borderAccent)'}`, borderRadius: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tz-accent)' }}>{mergeSelected.size} lines selected</span>
                <button onClick={() => {
                  const indices = Array.from(mergeSelected).sort((a, b) => a - b)
                  const destIdx = indices[0]
                  const srcIndices = indices.slice(1)
                  const dest = jobLines[destIdx]
                  const sources = srcIndices.map(i => jobLines[i])
                  const merged = mergeDraftLines(dest, sources)
                  setJobLines(prev => prev.filter((_, idx) => !srcIndices.includes(idx)).map((l, idx) => idx === destIdx ? merged : l))
                  setMergeSelected(new Set())
                }} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: 'var(--tz-accent)', color: 'var(--tz-bgLight)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  Merge into Job {Array.from(mergeSelected).sort((a, b) => a - b)[0] + 1}
                </button>
                <button onClick={() => setMergeSelected(new Set())} style={{ background: 'none', border: 'none', color: 'var(--tz-textTertiary)', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              {jobLines.map((line, i) => {
                const unrecognized = isUnrecognizedJob(line.description, line.skills)
                return (
                <div key={i} style={{ border: mergeSelected.has(i) ? `2px solid ${'var(--tz-accent)'}` : unrecognized ? `1px solid ${'var(--tz-danger)'}` : `1px solid ${'var(--tz-cardBorder)'}`, borderLeft: unrecognized && !mergeSelected.has(i) ? `4px solid ${'var(--tz-danger)'}` : mergeSelected.has(i) ? `2px solid ${'var(--tz-accent)'}` : `1px solid ${'var(--tz-cardBorder)'}`, borderRadius: 10, padding: 12, background: mergeSelected.has(i) ? 'var(--tz-accentBg)' : unrecognized ? 'var(--tz-dangerBg)' : 'var(--tz-bgCard)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: line.isTire ? 10 : 0 }}>
                    {jobLines.length > 1 && (
                      <input type="checkbox" checked={mergeSelected.has(i)} onChange={() => setMergeSelected(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })} style={{ cursor: 'pointer', accentColor: 'var(--tz-accent)', width: 16, height: 16, flexShrink: 0 }} />
                    )}
                    <span style={{ fontSize: 11, fontWeight: 700, color: unrecognized ? 'var(--tz-danger)' : 'var(--tz-textTertiary)', minWidth: 40, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {unrecognized && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={'var(--tz-danger)'} strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
                      Job {i + 1}
                    </span>
                    {unrecognized && <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--tz-danger)', background: 'var(--tz-dangerBg)', padding: '1px 6px', borderRadius: 4 }}>Unrecognized</span>}
                    <input type="text" value={line.description} onChange={e => setJobLines(prev => prev.map((l, idx) => idx === i ? { ...l, description: e.target.value, isTire: isTireJob(e.target.value), isDiagnostic: isDiagnosticJob(e.target.value), roughParts: getAutoRoughParts(e.target.value, l.tirePositions) } : l))} style={{ ...inp, flex: 1, borderColor: unrecognized ? 'var(--tz-danger)' : 'var(--tz-inputBorder)' }} placeholder={unrecognized ? 'What did you mean? Type the correct description...' : ''} />
                    <button onClick={() => setJobLines(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: `1px solid ${unrecognized ? 'var(--tz-danger)' : 'var(--tz-inputBorder)'}`, borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: 'var(--tz-danger)', fontWeight: 600, flexShrink: 0, fontSize: 13 }}>{unrecognized ? 'Remove' : '×'}</button>
                  </div>

                  {/* FIX 3: Tire position selector */}
                  {line.isTire && (
                    <div style={{ marginTop: 8, padding: 10, background: 'var(--tz-warningBg)', border: `1px solid ${'var(--tz-warning)'}`, borderRadius: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--tz-warning)', textTransform: 'uppercase', marginBottom: 8 }}>
                        Tire Position {line.tirePositions.length === 0 && '— specify for maintenance tracking'}
                      </div>
                      {TIRE_POSITIONS.map(g => (
                        <div key={g.group} style={{ marginBottom: 6 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--tz-textSecondary)', marginBottom: 3 }}>{g.group}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {g.positions.map(pos => {
                              const selected = line.tirePositions.includes(pos)
                              return (
                                <button key={pos} onClick={() => toggleTirePosition(i, pos)} style={{
                                  padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
                                  background: selected ? 'var(--tz-accent)' : 'var(--tz-bgCard)', color: selected ? 'var(--tz-bgLight)' : 'var(--tz-text)',
                                  border: selected ? `1px solid ${'var(--tz-accent)'}` : `1px solid ${'var(--tz-inputBorder)'}`,
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
                    <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--tz-accentBg)', border: `1px solid ${'var(--tz-borderAccent)'}`, borderRadius: 8, fontSize: 11, color: 'var(--tz-accent)' }}>
                      Diagnostic — parts will be added after inspection
                    </div>
                  )}

                  {/* Noun-only clarification gate */}
                  {needsClarification(line.roughParts) && (
                    <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--tz-warningBg)', border: `1px solid ${'var(--tz-warning)'}`, borderRadius: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tz-warning)', marginBottom: 6 }}>What do you need done? Choose an action:</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {getClarificationOptionsForInput(line.description).map(opt => (
                          <button key={opt} onClick={() => {
                            const newDesc = resolveClarification(opt, line.description)
                            setJobLines(prev => prev.map((l, idx) => idx === i ? { ...l, description: newDesc, isTire: isTireJob(newDesc), isDiagnostic: isDiagnosticJob(newDesc), roughParts: getAutoRoughParts(newDesc, l.tirePositions) } : l))
                          }} style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${'var(--tz-warning)'}`, background: 'var(--tz-bgCard)', color: 'var(--tz-warning)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Auto rough parts */}
                  {line.roughParts.length > 0 && !line.isDiagnostic && !needsClarification(line.roughParts) && (
                    <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--tz-bgElevated)', border: `1px solid ${'var(--tz-cardBorder)'}`, borderRadius: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--tz-textSecondary)', textTransform: 'uppercase', marginBottom: 6 }}>Auto-Generated Parts (rough)</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {line.roughParts.map((p, pi) => (
                          <span key={pi} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 5, fontSize: 10, background: p.is_labor ? 'var(--tz-surfaceMuted)' : 'var(--tz-warningBg)', color: p.is_labor ? 'var(--tz-textSecondary)' : 'var(--tz-warning)', border: `1px solid ${p.is_labor ? 'var(--tz-cardBorder)' : 'var(--tz-warning)'}` }}>
                            {p.is_labor ? `${p.rough_name} (inspection)` : `${p.quantity > 1 ? `${p.quantity}x ` : ''}${p.rough_name}`}
                            <span onClick={() => setJobLines(prev => prev.map((l, idx) => idx === i ? { ...l, roughParts: l.roughParts.filter((_, rIdx) => rIdx !== pi) } : l))} style={{ cursor: 'pointer', marginLeft: 2, fontWeight: 700, fontSize: 12, lineHeight: 1, opacity: 0.6 }} title="Remove">&times;</span>
                          </span>
                        ))}
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--tz-textTertiary)', marginTop: 4 }}>Parts dept will replace with real names + part numbers</div>
                    </div>
                  )}

                  {/* Historical brain suggestions (TZBridge7) — PM/Oil Change only */}
                  {brainSuggestions[i]?.suggestions?.length > 0 && !needsClarification(line.roughParts) && (
                    <div style={{ marginTop: 6, padding: '8px 12px', background: 'var(--tz-accentBg)', border: `1px solid ${'var(--tz-borderAccent)'}`, borderRadius: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--tz-accent)', textTransform: 'uppercase', marginBottom: 4 }}>Historical Suggestions</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {brainSuggestions[i].suggestions.map((s, si) => (
                          <span key={si} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 5, fontSize: 10, background: 'var(--tz-accentBg)', color: 'var(--tz-accent)', border: `1px solid ${'var(--tz-borderAccent)'}` }}>
                            {s.suggested_quantity > 1 ? `${s.suggested_quantity}x ` : ''}{s.description}{s.part_number ? ` [${s.part_number}]` : ''}
                          </span>
                        ))}
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--tz-textSecondary)', marginTop: 3 }}>Based on {brainSuggestions[i].suggestions[0]?.historical_wo_count?.toLocaleString()}+ historical work orders</div>
                    </div>
                  )}
                </div>
              )})}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setJobLines(prev => [...prev, { description: '', skills: [], tirePositions: [], isTire: false, isDiagnostic: false, roughParts: [] }])} style={btnS}>+ Add Job Line</button>
              <button onClick={() => setStep('edit')} style={btnS}>Back to Edit</button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && <div style={{ padding: '12px 16px', background: 'var(--tz-dangerBg)', border: `1px solid ${'var(--tz-danger)'}`, borderRadius: 8, color: 'var(--tz-danger)', fontSize: 13, marginBottom: 16 }}>{error}</div>}

        {/* Action buttons */}
        {step === 'edit' && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button onClick={handleSaveDraft} disabled={savingDraft || submitting} style={{ ...btnS, padding: '16px 28px', fontSize: 14, opacity: savingDraft ? 0.5 : 1 }}>
              {savingDraft ? 'Saving...' : 'Save as Draft'}
            </button>
            <button onClick={handleCreateClick} disabled={!canCreate || savingDraft} style={{ ...btnP, flex: 1, padding: '16px 28px', fontSize: 16, opacity: canCreate && !savingDraft ? 1 : 0.5 }}>
              Submit Work Order
            </button>
          </div>
        )}
        {step === 'review' && jobLines.length > 0 && (
          <button onClick={handleConfirmCreate} disabled={submitting} style={{ ...btnP, width: '100%', padding: '16px 28px', fontSize: 16, opacity: submitting ? 0.5 : 1 }}>
            {submitting ? 'Submitting Work Order...' : 'Confirm & Submit Work Order'}
          </button>
        )}
      </div>
    </div>
  )
}
