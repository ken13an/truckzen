'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser, type UserProfile } from '@/lib/auth'
import { ChevronLeft, ChevronDown, ChevronRight, User, Users, MessageSquare, Clock, DollarSign, MoreHorizontal, Plus, Mic, Upload, X, Paperclip, Pencil, TrendingUp, FileText, ShieldCheck, Trash2 } from 'lucide-react'
import AITextInput from '@/components/ai-text-input'
import SourceBadge from '@/components/ui/SourceBadge'
import OwnershipTypeBadge from '@/components/OwnershipTypeBadge'
import WOStepper from '@/components/work-orders/WOStepper'
import { validateFile, sanitizeFilename, WO_FILE_EXTENSIONS, WO_FILE_MIMES, MAX_WO_FILE_SIZE } from '@/lib/upload-safety'
import WOHeader from '@/components/work-orders/WOHeader'
import JobsTab from '@/components/work-orders/JobsTab'
import PartsTab from '@/components/work-orders/PartsTab'
import EstimateTab from '@/components/work-orders/EstimateTab'
import { getAutoRoughParts, isDiagnosticJob, hasRecognizedVerb } from '@/lib/parts-suggestions'
import { isPartReceived, isCustomerSuppliedPartRow, isNoPartNeededPartRow, isNonBillablePartRequirementRow, PARTS_REQUIREMENT_DEFAULT_NOTES, PARTS_REQUIREMENT_CONFIRM_COPY } from '@/lib/parts-status'
import { getDefaultLaborHours } from '@/lib/labor-hours'
import { calcInvoiceTotals, calcWoOperationalTotals } from '@/lib/invoice-calc'
import { isInvoiceHardLocked, DEFAULT_LABOR_RATE_FALLBACK } from '@/lib/invoice-lock'
import { SERVICE_WRITE_ROLES, ACCOUNTING_ROLES } from '@/lib/roles'
import { validateJobLine, isTireRelatedDescription, type JobLineValidationResult } from '@/lib/work-orders/jobLineValidation'
import { useTheme } from '@/hooks/useTheme'
import { getWorkorderRoute } from '@/lib/navigation/workorder-route'
import { THEME } from '@/lib/config/colors'
import { isIntakeSoSource, intakeSourceLabel } from '@/lib/services/serviceOrderSource'

const KNOWN_REPAIR_WORDS = ['oil', 'brake', 'engine', 'tire', 'tyre', 'pm', 'service', 'inspect', 'replace', 'repair', 'check', 'fix', 'leak', 'light', 'lamp', 'filter', 'belt', 'hose', 'cool', 'heat', 'ac', 'air', 'fuel', 'exhaust', 'trans', 'clutch', 'steer', 'align', 'suspen', 'shock', 'spring', 'weld', 'body', 'frame', 'door', 'window', 'mirror', 'wiper', 'horn', 'def', 'dpf', 'egr', 'turbo', 'alternator', 'starter', 'battery', 'charge', 'electric', 'wire', 'fuse', 'sensor', 'valve', 'pump', 'compressor', 'radiator', 'thermostat', 'diagnostic', 'dot', 'annual', 'wheel', 'hub', 'axle', 'drive', 'shaft', 'bearing', 'seal', 'gasket', 'mount', 'install', 'remove', 'adjust', 'bleed', 'flush', 'change', 'swap', 'lube', 'grease', 'paint', 'cab', 'fender', 'bumper', 'hood', 'trailer', 'fifth', 'glad', 'slack', 'drum', 'rotor', 'pad', 'shoe', 'caliper', 'abs', 'preventive', 'maintenance', 'full inspection', 'safety']

function isUnrecognizedJob(desc: string): boolean {
  if (!desc || desc.trim().length < 2) return false
  // Patch 124: same canonical verb-intent pre-check as work-orders/new (Patch 123).
  if (hasRecognizedVerb(desc)) return false
  const d = desc.toLowerCase()
  return !KNOWN_REPAIR_WORDS.some(w => d.includes(w))
}

// Keep in sync with TIRE_POSITIONS in src/app/work-orders/new/page.tsx — the
// inline Edit Job Line dropdown must speak the same vocabulary the creation
// flow writes, so saved values round-trip cleanly through the dropdown.
const TIRE_POSITION_OPTIONS: Array<{ group: string; positions: string[] }> = [
  { group: 'Steer (Axle 1)', positions: ['DS Steer', 'PS Steer'] },
  { group: 'Drive (Axle 2)', positions: ['DS 2nd Axle Outer', 'DS 2nd Axle Inner', 'PS 2nd Axle Outer', 'PS 2nd Axle Inner'] },
  { group: 'Rear (Axle 3)', positions: ['DS 3rd Axle Outer', 'DS 3rd Axle Inner', 'PS 3rd Axle Outer', 'PS 3rd Axle Inner'] },
]

const FONT = "'Inter', -apple-system, sans-serif"
const BLUE = 'var(--tz-accent)', GREEN = 'var(--tz-success)', RED = 'var(--tz-danger)', AMBER = 'var(--tz-warning)', GRAY = 'var(--tz-textSecondary)'

const LINE_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  unassigned:     { label: 'Unassigned',     bg: 'var(--tz-dangerBg)', color: 'var(--tz-danger)' },
  approved:       { label: 'Approved',       bg: 'var(--tz-successBg)', color: 'var(--tz-success)' },
  pending_review: { label: 'Pending Review', bg: 'var(--tz-warningBg)', color: 'var(--tz-warning)' },
  in_progress:    { label: 'In Progress',    bg: 'var(--tz-accentBg)', color: 'var(--tz-accent)' },
  completed:      { label: 'Completed',      bg: 'var(--tz-successBg)', color: 'var(--tz-success)' },
}

const WO_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  open:        { label: 'Open',        bg: 'var(--tz-accentBg)', color: BLUE },
  in_progress: { label: 'In Progress', bg: 'var(--tz-accentBg)', color: BLUE },
  completed:   { label: 'Completed',   bg: 'var(--tz-successBg)', color: GREEN },
  invoiced:    { label: 'Invoiced',    bg: 'var(--tz-successBg)', color: 'var(--tz-success)' },
  closed:      { label: 'Closed',      bg: 'var(--tz-surfaceMuted)', color: GRAY },
}

const PART_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  needed: { label: 'Needed', bg: 'var(--tz-dangerBg)', color: RED },
  ordered: { label: 'Ordered', bg: 'var(--tz-warningBg)', color: AMBER },
  received: { label: 'Received', bg: 'var(--tz-accentBg)', color: BLUE },
  ready_for_job: { label: 'Ready for Pickup', bg: 'var(--tz-successBg)', color: GREEN },
  picked_up: { label: 'Picked Up', bg: 'var(--tz-successBg)', color: GREEN },
  installed: { label: 'Installed', bg: 'var(--tz-successBg)', color: 'var(--tz-success)' },
}

const TABS = ['Jobs', 'Parts', 'Estimate', 'Files & Notes', 'Activity', 'Invoice']

const pillStyle = (bg: string, color: string): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: bg, color })
const inputStyle: React.CSSProperties = { padding: '8px 12px', border: `1px solid ${'var(--tz-inputBorder)'}`, borderRadius: 8, fontSize: 13, fontFamily: FONT, outline: 'none', boxSizing: 'border-box', width: '100%', background: 'var(--tz-inputBg)', color: 'var(--tz-text)' }
const btnStyle = (bg: string, color: string): React.CSSProperties => ({ padding: '8px 16px', background: bg, color, border: bg === 'transparent' ? `1px solid ${'var(--tz-border)'}` : 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, display: 'inline-flex', alignItems: 'center', gap: 6 })
const cardStyle: React.CSSProperties = { background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-cardBorder)'}`, borderRadius: 12, padding: 16, marginBottom: 12 }
const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' }

export default function WorkOrderDetail() {
  const { tokens: t } = useTheme()
  const params = useParams()
  const id = params?.id as string
  const supabase = createClient()

  // ALL useState hooks — BEFORE any conditional returns
  const [user, setUser] = useState<UserProfile | null>(null)
  const [wo, setWo] = useState<any>(null)
  const [loadError, setLoadError] = useState<{ status: number; code?: string; detail?: string; stages?: { stage: string; message: string }[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(0)
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [mechanics, setMechanics] = useState<any[]>([])
  const [jobAssignments, setJobAssignments] = useState<any[]>([])
  const [woParts, setWoParts] = useState<any[]>([])
  const [extraTimeRequests, setExtraTimeRequests] = useState<any[]>([])
  const [showMenu, setShowMenu] = useState(false)
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [teamAssign, setTeamAssign] = useState<{ team?: string; bay?: string; assigned_tech?: string }>({})
  const [assignModal, setAssignModal] = useState<{ lineId: string; idx: number } | null>(null)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [assignList, setAssignList] = useState<{ user_id: string; name: string; percentage: number }[]>([])
  const [hoursModal, setHoursModal] = useState<any | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [noteText, setNoteText] = useState('')
  const [noteVisible, setNoteVisible] = useState(false)
  const [addingNote, setAddingNote] = useState(false)
  const [mileage, setMileage] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [newJobText, setNewJobText] = useState('')
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, any[]>>({}) // lineId → suggestions
  const [aiLoadingLine, setAiLoadingLine] = useState<string | null>(null)
  const [showAiPanel, setShowAiPanel] = useState<string | null>(null)
  const [useAI, setUseAI] = useState(false)
  const [addingJob, setAddingJob] = useState(false)
  const [jobWarning, setJobWarning] = useState('')
  const [newChargeDesc, setNewChargeDesc] = useState('')
  const [newChargeAmt, setNewChargeAmt] = useState('')
  const [newPartForms, setNewPartForms] = useState<Record<string, { desc: string; pn: string; qty: string; cost: string }>>({})
  // Packet-3 modal-reuse: approvalModal holds context so Estimate 2+
  // (supplement batches) can reuse the same modal JSX as Estimate 1.
  // null = closed. { kind: 'estimate_1' } = Estimate 1 flow.
  // { kind: 'supplement', batchId, estimateNumber } = Estimate 2+ flow.
  const [approvalModal, setApprovalModal] = useState<
    | null
    | { kind: 'estimate_1' }
    | { kind: 'supplement'; batchId: string; estimateNumber: number }
  >(null)
  const [sendingEstimate, setSendingEstimate] = useState(false)
  // In-modal error surface for the Get Estimate Approval modal. Set with
  // the server's specific reason on send failure; cleared on each new send
  // attempt and when the modal closes. Replaces a window.alert popup.
  const [sendError, setSendError] = useState<string | null>(null)
  const [approvingEstimate, setApprovingEstimate] = useState(false)
  const [qcLoading, setQcLoading] = useState(false)
  const [qcErrors, setQcErrors] = useState<string[]>([])
  const [showQcErrors, setShowQcErrors] = useState(false)
  const [showExternalData, setShowExternalData] = useState(false)
  const [warrantyNotes, setWarrantyNotes] = useState('')
  const [approvalNotes, setApprovalNotes] = useState('')
  const [invoiceChecks, setInvoiceChecks] = useState<any[]>([])
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [partSearchResults, setPartSearchResults] = useState<Record<string, any[]>>({})
  const partDropdownClicked = useRef(false)
  const [partsSubmitted, setPartsSubmitted] = useState(false)
  const [partsSubmitting, setPartsSubmitting] = useState(false)
  const [partNoteOpen, setPartNoteOpen] = useState<string | null>(null)
  const [shopLaborRates, setShopLaborRates] = useState<any[]>([])
  const [mergeSelected, setMergeSelected] = useState<Set<string>>(new Set())
  const [expandedJobLines, setExpandedJobLines] = useState<Record<string, boolean>>({})
  const [merging, setMerging] = useState(false)
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  // Saved customer contacts (customer_contacts rows). Fetched after the WO
  // loads so the estimate-send modal can offer them as additional recipients.
  // None are auto-checked — service writer must explicitly opt each one in.
  const [customerContacts, setCustomerContacts] = useState<Array<{ id: string; name: string | null; email: string | null; role: string | null; is_primary: boolean | null }>>([])
  const [selectedExtraEmails, setSelectedExtraEmails] = useState<Set<string>>(new Set())
  // Per-line edit mode for the WO detail page (Phase 2B). Only one job line
  // can be in inline-edit mode at a time. The generic WO-level Edit button
  // does NOT control this — it controls the WO header edit.
  const [editingJobLineId, setEditingJobLineId] = useState<string | null>(null)
  const [editingJobLineForm, setEditingJobLineForm] = useState<{ description: string; tire_positions: string[]; estimated_hours: string }>({ description: '', tire_positions: [], estimated_hours: '' })
  // TruckZen-styled "Add Part" modal — replaces native prompt() on the Parts
  // tab. Both Add Part call sites POST the same payload, so a single shared
  // modal covers them.
  const [addPartModal, setAddPartModal] = useState<{ open: boolean; name: string; saving: boolean }>({ open: false, name: '', saving: false })
  const [savingJobLineEdit, setSavingJobLineEdit] = useState(false)
  const [approvalConfirmModal, setApprovalConfirmModal] = useState<{ method: string; notes: string } | null>(null)
  const [printedReady, setPrintedReady] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editDraft, setEditDraft] = useState<any>(null)
  const [toastMsg, setToastMsg] = useState('')

  // DATA LOADING
  const loadInFlight = useRef(false)
  const loadData = useCallback(async () => {
    if (!id) return
    if (loadInFlight.current) return
    loadInFlight.current = true
    try {
      let u: any = null
      try {
        u = await getCurrentUser(supabase)
      } catch (authErr: any) {
        // Supabase auth processLock race (e.g. "Lock was stolen by another request") — transient; retry once.
        const msg = authErr instanceof Error ? authErr.message : String(authErr)
        if (/lock was stolen|navigator ?lock|lockmanager/i.test(msg)) {
          await new Promise(r => setTimeout(r, 300))
          u = await getCurrentUser(supabase)
        } else {
          throw authErr
        }
      }
      setUser(u)

      // Mechanic roles use the dedicated mechanic dashboard, not the full WO editor
      if (u && ['technician', 'lead_tech', 'maintenance_technician'].includes(u.impersonate_role || u.role)) {
        window.location.href = '/mechanic/dashboard'
        return
      }

      // Fetch WO with retry — handles transient failures after create redirect or auth delay.
      // Do NOT retry on true 404 (not-found is terminal); only retry on 5xx/network.
      let woRes = await fetch(`/api/work-orders/${id}`)
      if (!woRes.ok && woRes.status !== 404 && woRes.status !== 403) {
        await new Promise(r => setTimeout(r, 1000))
        woRes = await fetch(`/api/work-orders/${id}`)
      }
      if (!woRes.ok && woRes.status !== 404 && woRes.status !== 403) {
        await new Promise(r => setTimeout(r, 2000))
        woRes = await fetch(`/api/work-orders/${id}`)
      }
      if (!woRes.ok && woRes.status !== 404 && woRes.status !== 403) {
        await new Promise(r => setTimeout(r, 3000))
        woRes = await fetch(`/api/work-orders/${id}`)
      }

      const [usersRes, ratesRes] = await Promise.all([
        fetch('/api/users') ,
        u?.shop_id ? fetch(`/api/settings/labor-rates?shop_id=${u.shop_id}`) : Promise.resolve(null),
      ])

      if (!woRes.ok) {
        let errBody: any = null
        try { errBody = await woRes.json() } catch {}
        setLoadError({ status: woRes.status, code: errBody?.code, detail: errBody?.error || errBody?.detail || null })
        setLoading(false)
        return
      }
      const woData = await woRes.json()
      if (woData?.enrichmentErrors?.length) {
        console.warn('[wo-detail] enrichment warnings', woData.enrichmentErrors)
      }
      setWo(woData)
      setJobAssignments(woData.jobAssignments || [])
      setWoParts(woData.woParts || [])
      setMileage(woData.assets?.odometer?.toString() || '')
      setTeamAssign({ team: woData.team || '', bay: woData.bay || '', assigned_tech: woData.assigned_tech || '' })
      setContactEmail(woData.customers?.email || '')
      setContactPhone(woData.customers?.phone || '')
      // Load saved customer_contacts so the estimate-send modal can offer
      // them as additional recipients. RLS scopes to the user's shop. Failure
      // is non-blocking — the modal still works with just the primary input.
      if (woData.customers?.id) {
        supabase.from('customer_contacts')
          .select('id, name, email, role, is_primary')
          .eq('customer_id', woData.customers.id)
          .order('is_primary', { ascending: false })
          .then(({ data, error }: { data: any; error: any }) => {
            if (error) {
              console.warn('[wo-detail] customer_contacts load failed', error.message)
              return
            }
            setCustomerContacts(data || [])
          })
      } else {
        setCustomerContacts([])
      }
      setSelectedExtraEmails(new Set())
      // Fetch extra-time requests for this WO
      fetch(`/api/mechanic-requests?status=pending`).then(r => r.ok ? r.json() : []).then(reqs => {
        setExtraTimeRequests((reqs || []).filter((r: any) => r.so_id === id && r.request_type === 'labor_extension'))
      }).catch(() => {})

      if (usersRes) {
        const usersData = await usersRes.json()
        setAllUsers(usersData)
        setMechanics(usersData.filter((u: any) => ['technician', 'lead_tech', 'maintenance_technician'].includes(u.role)))
      }
      if (ratesRes?.ok) {
        try { const r = await ratesRes.json(); if (Array.isArray(r)) setShopLaborRates(r) } catch {}
      }
    } catch (e) {
      console.error('Load error', e)
      setLoadError({ status: 0, detail: e instanceof Error ? e.message : String(e) })
    } finally {
      loadInFlight.current = false
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  // HELPER FUNCTIONS

  // Fields that, when changed on a so_line, alter the customer-facing
  // estimate snapshot (estimate_lines + totals). Mutations that only touch
  // tracking/assignment fields (assigned_to, finding/resolution-only,
  // tire_position, etc.) do NOT trigger a snapshot refresh.
  const ESTIMATE_TRUTH_FIELDS = new Set([
    'description', 'estimated_hours', 'billed_hours', 'actual_hours', 'labor_rate',
    'quantity', 'unit_price', 'parts_cost_price', 'parts_sell_price',
    'parts_status', 'real_name', 'rough_name', 'part_number',
    'line_status', 'status', 'is_canceled',
  ])

  // Find the current pre-approval estimate (first draft/sent row). Approved
  // and declined estimates stay frozen as historical truth.
  const findRefreshableEstimate = (): { id: string; updated_at: string | null } | null => {
    const rows = ((wo?.estimates || []) as any[])
    const open = rows.find(e => {
      const s = String(e?.status || '').toLowerCase()
      return s === 'draft' || s === 'sent'
    })
    if (!open?.id) return null
    return { id: open.id, updated_at: open.updated_at || null }
  }

  // Best-effort snapshot refresh after the live WO truth changed. Failures
  // do not block the underlying edit — they surface a non-blocking toast so
  // the writer knows the customer-facing estimate is now out of sync.
  const refreshOpenEstimateIfAny = async (): Promise<void> => {
    const target = findRefreshableEstimate()
    if (!target) return
    try {
      const res = await fetch(`/api/estimates/${target.id}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expected_updated_at: target.updated_at }),
      })
      if (res.status === 409) {
        setToastMsg('Estimate was updated elsewhere — refresh and try again.')
        setTimeout(() => setToastMsg(''), 4000)
        return
      }
      if (!res.ok) return
      const json = await res.json().catch(() => null) as any
      if (json && json.ok === false && json.skipped) {
        const reason = String(json.reason || '')
        if (reason === 'estimate_approved' || reason === 'estimate_declined') {
          setToastMsg('Estimate is already approved — customer-facing copy stays frozen until you create a new one.')
          setTimeout(() => setToastMsg(''), 5000)
        } else if (reason === 'wo_invoice_locked' || reason === 'wo_is_historical') {
          setToastMsg('WO is locked — customer-facing estimate stays frozen.')
          setTimeout(() => setToastMsg(''), 4000)
        }
      }
    } catch {
      // Network blip — don't block the edit. loadData() will run anyway and
      // surface whatever truth the server has now.
    }
  }

  const patchLine = async (lineId: string, data: Record<string, any>) => {
    // Optimistic-concurrency precondition: send the line's last-seen
    // updated_at from the loaded record (now exposed via the WO GET).
    // On 409, surface the canonical conflict message and stop — caller's
    // success path will not run because we do not invoke loadData.
    const lineRecord = (wo?.so_lines || []).find((l: any) => l.id === lineId)
    const expected_updated_at = lineRecord?.updated_at
    const res = await fetch(`/api/so-lines/${lineId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, expected_updated_at }),
    })
    if (res.status === 409) {
      setToastMsg('This record was updated by someone else. Refresh and try again.')
      setTimeout(() => setToastMsg(''), 4000)
      return res
    }
    if (res.ok) {
      const touchesEstimate = Object.keys(data).some(k => ESTIMATE_TRUTH_FIELDS.has(k))
      if (touchesEstimate) await refreshOpenEstimateIfAny()
      await loadData()
    }
    return res
  }

  const logActivity = (action: string) => {
    fetch('/api/wo-activity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wo_id: id, action }) }).catch(() => {})
  }

  const openAssignModal = (lineId: string, idx: number) => {
    const existing = jobAssignments.filter((a: any) => a.line_id === lineId).map((a: any) => ({
      user_id: a.user_id,
      name: a.users?.full_name || 'Unknown',
      percentage: a.percentage || 100,
    }))
    setAssignList(existing.length > 0 ? existing : [])
    setAssignModal({ lineId, idx })
    // Fetch mechanic suggestions for this job line
    setSuggestions([])
    const line = jobLines.find((l: any) => l.id === lineId)
    const desc = line?.description || wo?.complaint || ''
    if (desc) {
      setSuggestionsLoading(true)
      fetch(`/api/mechanic-skills?type=suggest&job_description=${encodeURIComponent(desc)}`)
        .then(r => r.ok ? r.json() : [])
        .then(data => setSuggestions(Array.isArray(data) ? data.slice(0, 5) : []))
        .catch(() => setSuggestions([]))
        .finally(() => setSuggestionsLoading(false))
    }
  }

  const addMechToList = (uid: string) => {
    if (!uid || assignList.some(a => a.user_id === uid)) return
    const mech = mechanics.find(m => m.id === uid)
    const newList = [...assignList, { user_id: uid, name: mech?.full_name || 'Unknown', percentage: 0 }]
    const pct = Math.floor(100 / newList.length)
    const remainder = 100 - pct * newList.length
    setAssignList(newList.map((a, i) => ({ ...a, percentage: pct + (i === 0 ? remainder : 0) })))
  }

  const removeMechFromList = (idx: number) => {
    const newList = assignList.filter((_, i) => i !== idx)
    if (newList.length === 0) { setAssignList([]); return }
    const pct = Math.floor(100 / newList.length)
    const remainder = 100 - pct * newList.length
    setAssignList(newList.map((a, i) => ({ ...a, percentage: pct + (i === 0 ? remainder : 0) })))
  }

  const saveAssignments = async () => {
    if (!assignModal) return
    const res = await fetch('/api/wo-job-assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line_id: assignModal.lineId, assignments: assignList, wo_id: id }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Assignment failed' }))
      alert(err.error || 'Failed to save assignment')
      return
    }
    setAssignModal(null)
    await loadData()
  }

  const saveTeamAssign = async () => {
    const res = await fetch(`/api/work-orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...teamAssign, expected_updated_at: wo?.updated_at }),
    })
    if (res.status === 409) {
      setToastMsg('This record was updated by someone else. Refresh and try again.')
      setTimeout(() => setToastMsg(''), 4000)
      return
    }
    setShowTeamModal(false)
    await loadData()
  }

  const saveHours = async () => {
    if (!hoursModal) return
    const res = await patchLine(hoursModal.id, {
      estimated_hours: parseFloat(hoursModal.estimated_hours) || 0,
      actual_hours: parseFloat(hoursModal.actual_hours) || 0,
      billed_hours: parseFloat(hoursModal.billed_hours) || 0,
    })
    if (!res || !res.ok) {
      const err = res ? await res.json().catch(() => ({})) : {}
      alert(err.error || 'Failed to save hours')
      return
    }
    setHoursModal(null)
  }

  const addNote = async () => {
    if (!noteText.trim()) return
    setAddingNote(true)
    await fetch('/api/wo-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wo_id: id, note_text: noteText, visible_to_customer: noteVisible }),
    })
    setNoteText('')
    setNoteVisible(false)
    setAddingNote(false)
    await loadData()
  }

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const err = validateFile(file, WO_FILE_EXTENSIONS, WO_FILE_MIMES, MAX_WO_FILE_SIZE)
      if (err) { alert(err); continue }
      const safeName = sanitizeFilename(file.name)
      const shopPrefix = wo?.shop_id || 'unknown'
      const path = `${shopPrefix}/wo-files/${id}/${Date.now()}-${safeName}`
      const { error } = await supabase.storage.from('uploads').upload(path, file)
      if (error) { console.error('Upload error', error); continue }
      const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path)
      await fetch('/api/wo-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wo_id: id, file_url: urlData.publicUrl, filename: safeName }),
      })
    }
    setUploading(false)
    await loadData()
  }

  const deleteWO = async () => {
    if (deleteText !== 'DELETE') return
    await fetch(`/api/work-orders/${id}`, { method: 'DELETE' })
    window.location.href = '/work-orders'
  }

  async function fetchAiSuggestions(lineId: string, description: string) {
    if (!description?.trim() || description.length < 10) return
    setAiLoadingLine(lineId)
    try {
      const res = await fetch('/api/parts/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ so_id: id, complaint: description, truck_info: { year: asset?.year, make: asset?.make, model: asset?.model } }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.suggestions?.length) setAiSuggestions(prev => ({ ...prev, [lineId]: data.suggestions }))
      }
    } catch {}
    setAiLoadingLine(null)
  }

  async function addAiParts(lineId: string, selected: any[]) {
    for (const part of selected) {
      await fetch('/api/wo-parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wo_id: id, line_id: lineId, description: part.description, part_number: part.part_number || null, quantity: part.quantity || 1, unit_cost: part.estimated_sell_price || 0, status: 'needed' }),
      })
    }
    setShowAiPanel(null)
    setAiSuggestions(prev => { const n = { ...prev }; delete n[lineId]; return n })
    await loadData()
  }

  async function toggleApproval(lineId: string, needsApproval: boolean) {
    await fetch(`/api/work-orders/${id}/approval`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_approval', line_id: lineId, needs_approval: needsApproval }),
    })
    await loadData()
  }

  async function approveJob(lineId: string) {
    await fetch(`/api/work-orders/${id}/approval`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve_job', line_id: lineId, notes: approvalNotes }),
    })
    setApprovalNotes('')
    await loadData()
  }

  async function declineJob(lineId: string) {
    await fetch(`/api/work-orders/${id}/approval`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'decline_job', line_id: lineId, notes: approvalNotes }),
    })
    setApprovalNotes('')
    await loadData()
  }

  async function warrantyDecision(decision: string) {
    await fetch(`/api/work-orders/${id}/approval`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'warranty_decision', decision, notes: warrantyNotes }),
    })
    setWarrantyNotes('')
    await loadData()
  }

  async function searchInventory(lineId: string, query: string) {
    if (!query || query.length < 2) { setPartSearchResults(prev => { const n = {...prev}; delete n[lineId]; return n }); return }
    const res = await fetch(`/api/parts/search?q=${encodeURIComponent(query)}`)
    if (res.ok) {
      const results = await res.json()
      setPartSearchResults(prev => ({ ...prev, [lineId]: results }))
    }
  }

  function applyInventoryPart(lineId: string, invPart: any) {
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
    const roundedSell = Math.round(sellPrice * 100) / 100
    const currentLine = (wo?.so_lines || []).find((l: any) => l.id === lineId)
    const qty = currentLine?.quantity || 1
    const nextValues = {
      real_name: invPart.description,
      part_number: invPart.part_number,
      parts_cost_price: costPrice,
      parts_sell_price: roundedSell,
      // total_price is generated by DB — do not write directly
      // Stay rough — Parts dept must confirm. Auto-fill is suggestion only.
    }
    setWo((prev: any) => ({
      ...prev,
      so_lines: (prev?.so_lines || []).map((l: any) => l.id === lineId ? { ...l, ...nextValues } : l),
    }))
    return nextValues
  }

  async function autoFillFromInventory(lineId: string, invPart: any) {
    const nextValues = applyInventoryPart(lineId, invPart)
    const res = await patchLine(lineId, nextValues)
    setPartSearchResults(prev => { const n = {...prev}; delete n[lineId]; return n })
    if (!res || !res.ok) {
      // PATCH failed — keep optimistic state, show error, don't reload stale data
      const err = res ? await res.json().catch(() => ({})) : {}
      alert(err.error || 'Failed to save part')
    }
    // patchLine already calls loadData on success — no second loadData needed
  }

  async function submitParts() {
    if (!user) return
    setPartsSubmitting(true)
    const res = await fetch(`/api/work-orders/${id}/parts-submit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'submit_all' }),
    })
    setPartsSubmitting(false)
    if (res.ok) { setPartsSubmitted(true); await loadData() }
    else { const err = await res.json(); alert(err.error || 'Failed to submit') }
  }

  async function savePartsProgress() {
    if (!user) return
    await fetch(`/api/work-orders/${id}/parts-submit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_progress' }),
    })
  }

  async function checkInvoiceReadiness() {
    setInvoiceLoading(true)
    const res = await fetch(`/api/work-orders/${id}/invoice`)
    if (res.ok) { const data = await res.json(); setInvoiceChecks(data.checks || []) }
    setInvoiceLoading(false)
  }

  async function invoiceAction(action: string, extra?: any) {
    setInvoiceLoading(true)
    const res = await fetch(`/api/work-orders/${id}/invoice`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    })
    setInvoiceLoading(false)
    if (res.ok) { await loadData() }
    else { const err = await res.json(); alert(err.issues ? err.issues.join('\n') : err.error || 'Failed') }
  }

  // Role detection for department views
  const userRole = user?.impersonate_role || user?.role || ''
  const isMechanic = ['technician', 'lead_tech', 'maintenance_technician'].includes(userRole)
  const isMaintenance = ['maintenance_manager', 'fleet_manager', 'dispatcher'].includes(userRole)
  const isPartsRole = ['parts_manager'].includes(userRole)
  const isAccounting = ['accountant', 'accounting_manager'].includes(userRole)
  const isWriter = SERVICE_WRITE_ROLES.includes(userRole)
  const isViewOnly = isMechanic || isMaintenance || isPartsRole
  const canSeePrices = !isMechanic
  const canEditPrices = isAccounting || isWriter

  const addJobLine = async () => {
    if (!newJobText.trim()) return
    if (isUnrecognizedJob(newJobText)) {
      setJobWarning('Unrecognized job description — what did you mean? Use terms like: oil change, brake repair, pm service, tire replacement...')
      return
    }
    setJobWarning('')
    setAddingJob(true)

    const createdLines: { id?: string; description: string }[] = []
    let candidateLines: any[] = [{ description: newJobText.trim() }]

    // Skip AI for simple replacement/single-job patterns — AI can misclassify these
    const words = newJobText.trim().split(/\s+/)
    const isSimpleJob = words.length <= 4

    if (!isSimpleJob) {
      try {
        const res = await fetch('/api/ai/expand-complaint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ complaint: newJobText, asset: wo?.assets }),
        })
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data.lines) && data.lines.length > 0) candidateLines = data.lines
        }
      } catch {}
    }

    for (const line of candidateLines) {
      // Use fallback labor hours (same logic as WO creation) — AI hours override if present
      const fallbackHours = getDefaultLaborHours(line.description)
      const estimatedHours = line.estimated_hours || fallbackHours || null
      const res = await fetch('/api/so-lines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ so_id: id, line_type: 'labor', description: line.description, estimated_hours: estimatedHours, line_status: 'unassigned' }),
      })
      const created = res.ok ? await res.json().catch(() => null) : null
      createdLines.push({ id: created?.id, description: line.description })
      // Auto-set parts_requirement on the new labor so the server approval gate
      // can pass without the labor-level chip UI on the job card. Defers to the
      // canonical verb-intent classifier in @/lib/parts-suggestions
      // (RepairVerb_NoAutoPartsRequirement_Fix): if getAutoRoughParts produces
      // any non-labor rough part candidate, the job expects parts → 'needed';
      // otherwise (labor-only repair/fix/check/adjust/clean/inspect/diagnose/
      // test, or diagnostic-keyword jobs that produce no rough parts) →
      // 'not_needed' with an auto-note. Without this gate, lines like
      // "repair bumper" would force a false unresolved-parts approval block.
      // Writers can still flip the chip via the Parts tab if real parts get
      // added later.
      if (created?.id && created?.updated_at) {
        const expectsParts = getAutoRoughParts(line.description).some(p => !p.is_labor)
        const reqPayload: Record<string, any> = expectsParts
          ? { parts_requirement: 'needed' }
          : {
              parts_requirement: 'not_needed',
              parts_requirement_note: isDiagnosticJob(line.description)
                ? 'Diagnostic — no parts required'
                : 'Labor-only — no parts required',
            }
        try {
          await fetch(`/api/so-lines/${created.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...reqPayload, expected_updated_at: created.updated_at }),
          })
        } catch { /* non-fatal — writer can still resolve via Parts tab */ }
      }
    }

    for (const line of createdLines) {
      if (!isDiagnosticJob(line.description)) {
        const roughParts = getAutoRoughParts(line.description)
        const realParts = roughParts.filter(rp => !rp.is_labor && rp.rough_name)

        if (realParts.length > 0) {
          for (const rp of realParts) {
            const partName = rp.rough_name || ''
            if (!partName) continue
            let invMatch: any = null
            try {
              const searchRes = await fetch(`/api/parts/search?q=${encodeURIComponent(partName)}`)
              if (searchRes.ok) {
                const results = await searchRes.json()
                invMatch = results.find((r: any) => r.on_hand > 0) || null
              }
            } catch {}

            const partPayload: Record<string, any> = {
              so_id: id, line_type: 'part',
              description: invMatch ? invMatch.description : partName,
              rough_name: partName,
              quantity: rp.quantity || 1,
              parts_status: 'rough',
              related_labor_line_id: line.id || null,
            }
            if (invMatch) {
              partPayload.real_name = invMatch.description
              partPayload.part_number = invMatch.part_number
              const cost = invMatch.cost_price || 0
              let sell = invMatch.sell_price || 0
              if (sell <= 0 && cost > 0) sell = cost * 1.3
              partPayload.unit_price = Math.round(sell * 100) / 100
            }
            await fetch('/api/so-lines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(partPayload) })
          }
        } else {
          // Fallback: any non-diagnostic job with no auto-parts gets a rough placeholder
          // Parts dept can cancel if unneeded — better to have a visible row than miss a real part
          const roughName = (line.description || '').replace(/^(replace|install|swap|new)\s+/i, '').trim() || line.description
          await fetch('/api/so-lines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
            so_id: id, line_type: 'part', description: roughName, rough_name: roughName, quantity: 1, parts_status: 'rough',
            related_labor_line_id: line.id || null,
          }) })
        }
      }
      if (line.id) await fetchAiSuggestions(line.id, line.description)
    }

    setNewJobText('')
    setUseAI(false)
    setAddingJob(false)
    // Small delay to ensure all DB inserts commit before re-fetching
    await new Promise(r => setTimeout(r, 300))
    await refreshOpenEstimateIfAny()
    await loadData()
  }

  const addShopCharge = async () => {
    if (!newChargeDesc.trim() || !newChargeAmt) return
    await fetch('/api/wo-charges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wo_id: id, description: newChargeDesc, amount: parseFloat(newChargeAmt), taxable: false }),
    })
    setNewChargeDesc('')
    setNewChargeAmt('')
    await loadData()
  }

  const addPart = async (lineId: string) => {
    const form = newPartForms[lineId]
    if (!form?.desc?.trim()) return
    await fetch('/api/wo-parts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wo_id: id, line_id: lineId, part_number: form.pn, description: form.desc, quantity: form.qty || '1', unit_cost: form.cost || '0' }),
    })
    setNewPartForms(prev => ({ ...prev, [lineId]: { desc: '', pn: '', qty: '', cost: '' } }))
    await loadData()
  }

  const updatePartStatus = async (partId: string, status: string) => {
    const part = woParts.find((p: any) => p.id === partId)
    const res = await fetch('/api/wo-parts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: partId, status, wo_id: id, expected_updated_at: part?.updated_at }),
    })
    if (res.status === 409) {
      setToastMsg('This record was updated by someone else. Refresh and try again.')
      setTimeout(() => setToastMsg(''), 4000)
      return
    }
    await loadData()
  }

  const removeJobLine = async (lineId: string) => {
    await fetch(`/api/so-lines/${lineId}`, { method: 'DELETE' })
    logActivity('Removed a job line')
    await refreshOpenEstimateIfAny()
    await loadData()
  }

  const updateWoStatus = async (status: string) => {
    const res = await fetch(`/api/work-orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, expected_updated_at: wo?.updated_at }),
    })
    if (res.status === 409) {
      setToastMsg('This record was updated by someone else. Refresh and try again.')
      setTimeout(() => setToastMsg(''), 4000)
      return
    }
    setShowMenu(false)
    await loadData()
  }

  const removeCharge = async (chargeId: string) => {
    await fetch(`/api/wo-charges?id=${chargeId}`, { method: 'DELETE' })
    await loadData()
  }

  const removePart = async (partId: string) => {
    await fetch(`/api/wo-parts?id=${partId}`, { method: 'DELETE' })
    await loadData()
  }

  // CONDITIONAL RETURNS — after all hooks
  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: FONT, color: GRAY, fontSize: 15 }}>
      Loading...
    </div>
  )
  if (!wo) {
    const isNotFound = loadError?.status === 404
    const isForbidden = loadError?.status === 403
    const title = isNotFound ? 'Work order not found'
      : isForbidden ? 'You do not have access to this work order'
      : 'Work order failed to load'
    const subtitle = isNotFound ? null
      : isForbidden ? null
      : `Something went wrong while loading this work order. Please retry. ${loadError?.status ? `(status ${loadError.status})` : ''}`.trim()
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: FONT, color: RED, fontSize: 15, flexDirection: 'column', gap: 12, padding: 24, textAlign: 'center' }}>
        <span style={{ fontWeight: 700 }}>{title}</span>
        {subtitle && <span style={{ color: GRAY, fontSize: 13, maxWidth: 520 }}>{subtitle}</span>}
        {loadError?.detail && !isNotFound && !isForbidden && (
          <span style={{ color: GRAY, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", maxWidth: 520, wordBreak: 'break-word' }}>{loadError.detail}</span>
        )}
        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
          {!isNotFound && !isForbidden && (
            <button onClick={() => { setLoadError(null); setLoading(true); loadData() }} style={{ padding: '8px 16px', border: `1px solid ${BLUE}`, background: 'transparent', color: BLUE, borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>Retry</button>
          )}
          <a href="/work-orders" style={{ color: BLUE, fontSize: 13, alignSelf: 'center' }}>Back to Work Orders</a>
        </div>
      </div>
    )
  }

  // DERIVED DATA
  const asset = wo.assets || {}
  const customer = wo.customers || {}
  const jobLines = (wo.so_lines || []).filter((l: any) => l.line_type === 'labor')
  const partLines = (wo.so_lines || []).filter((l: any) => l.line_type === 'part')
  const feeLines = (wo.so_lines || []).filter((l: any) => l.line_type === 'fee')
  // Historical Fullbay grouped source truth, when the import has been
  // backfilled into service_orders.external_data. When present, historical
  // Jobs/Parts/Estimate render directly from this read-only snapshot instead
  // of reconstructing from flat so_lines. Live (non-historical) WOs ignore it.
  const historicalSnapshot: any = wo.is_historical ? (wo.external_data?.historical_fullbay_snapshot ?? null) : null
  const snapshotComplaints: any[] = historicalSnapshot?.complaints ?? []
  const snapshotMiscCharges: any[] = historicalSnapshot?.misc_charges ?? []
  const snapshotTotals: any = historicalSnapshot?.totals ?? null
  const snapshotParts: any[] = snapshotComplaints.flatMap((cmp: any, ci: number) =>
    ((cmp?.corrections) || []).flatMap((corr: any, coi: number) =>
      ((corr?.parts) || []).map((p: any, pi: number) => ({
        ...p,
        _complaint_idx: ci,
        _correction_idx: coi,
        _part_idx: pi,
        _complaint_note: cmp?.note || '',
      }))
    )
  )

  // Historical-only DISPLAY parser. Splits one raw labor row's description
  // into readable items WITHOUT grouping across DB rows or inventing per-item
  // financials. Each raw labor row keeps its own identity, hours, and total —
  // only the description text is parsed for display when it contains an
  // imported numbered or multi-line complaint list.
  const parseHistoricalLaborItems = (desc: any): string[] => {
    const raw = String(desc || '').trim()
    if (!raw) return []
    let items = raw.split(/\r?\n+/).map(s => s.trim()).filter(Boolean)
    if (items.length <= 1) {
      const numbered = raw.split(/(?:^|\s)\d+[\.\)]\s+/).map(s => s.trim()).filter(Boolean)
      if (numbered.length > 1) items = numbered
    }
    items = items.map(s => s.replace(/^\d+[\.\)]\s*/, '').replace(/\s+/g, ' ').trim()).filter(Boolean)
    if (items.length > 1) {
      const PLACEHOLDERS = new Set(['performed', 'service'])
      const meaningful = items.filter(s => !PLACEHOLDERS.has(s.toLowerCase()))
      if (meaningful.length > 0 && meaningful.length < items.length) items = meaningful
    }
    return items.length > 0 ? items : [raw]
  }
  // Display-only post-processor for the parsed list of ONE raw historical
  // labor row. Never merges across rows, never invents totals/hours. Only
  // collapses exact adjacent duplicates and one exact repeated full block
  // (A+B+C+D+A+B+C+D -> A+B+C+D). If no exact duplicate structure is
  // proven, the original list is returned unchanged.
  const dedupeHistoricalLaborDisplayItems = (items: string[]): string[] => {
    if (!Array.isArray(items) || items.length < 2) return items
    const norm = (s: string) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase()
    const adjacent: string[] = []
    for (const it of items) {
      const last = adjacent[adjacent.length - 1]
      if (last === undefined || norm(last) !== norm(it)) adjacent.push(it)
    }
    if (adjacent.length >= 2 && adjacent.length % 2 === 0) {
      const half = adjacent.length / 2
      let exactRepeat = true
      for (let i = 0; i < half; i++) {
        if (norm(adjacent[i]) !== norm(adjacent[i + half])) { exactRepeat = false; break }
      }
      if (exactRepeat) return adjacent.slice(0, half)
    }
    return adjacent
  }
  // Phase 2B: derive per-line validation results so the UI can render
  // warnings and the Send Estimate button can be gated. Pure derivation;
  // safe to compute every render.
  const jobLineValidations: Record<string, JobLineValidationResult> = {}
  for (const line of jobLines) {
    jobLineValidations[line.id] = validateJobLine({
      id: line.id,
      description: line.description,
      line_type: line.line_type,
      line_status: line.line_status,
      status: line.status,
      tire_position: line.tire_position,
    })
  }
  const hasBlockingJobLineIssue = Object.values(jobLineValidations).some(v => !v.valid)
  // Invoice-tab display split. Non-billable rows (customer_supplied /
  // not_needed) sum to $0 in calcInvoiceTotals (parts_sell_price=0 and
  // unit_price=0), so pulling them into a separate display section does
  // not change any total — it only surfaces audit truth to the customer.
  const invoiceBillableParts = partLines.filter((p: any) =>
    p.parts_status !== 'canceled' && !isNonBillablePartRequirementRow(p)
  )
  const invoiceNonBillableParts = partLines.filter((p: any) =>
    p.parts_status !== 'canceled' && isNonBillablePartRequirementRow(p)
  )
  // Parts locked after invoice sent to customer (sent, paid, closed) — NOT during accounting_review
  const partsLocked = isInvoiceHardLocked(wo.invoice_status)
  const shopCharges = wo.wo_shop_charges || []
  const notes = wo.wo_notes || []
  const files = wo.wo_files || []
  const activity = wo.wo_activity_log || []
  const techMap: Record<string, string> = wo.techMap || {}
  const userMap: Record<string, string> = wo.userMap || {}
  const shop = wo.shop || {}
  // For imported historical WOs, do NOT apply current shop labor rate — use imported line prices only
  const isImportedHistory = !!wo.is_historical
  // Labor rate from Settings → Labor Rates by ownership type, fallback to shop default
  const ownershipType = wo?.ownership_type || wo?.assets?.ownership_type || 'outside_customer'
  const ownershipRate = shopLaborRates.find((r: any) => r.ownership_type === ownershipType)
  const laborRate = isImportedHistory ? 0 : (ownershipRate?.rate_per_hour || shop.labor_rate || shop.default_labor_rate || DEFAULT_LABOR_RATE_FALLBACK)
  const taxRate = isImportedHistory ? 0 : (shop.tax_rate || 0)
  const woStatus = WO_STATUS[wo.status] || { label: wo.status, bg: 'var(--tz-surfaceMuted)', color: GRAY }
  const vinDisplay = asset.vin
    ? (wo.is_historical ? asset.vin.toUpperCase() : asset.vin.slice(-6).toUpperCase())
    : '—'
  const createdByName = wo.createdByName || 'Unknown'

  // Compute totals — for imported history, use stored totals instead of recalculating
  const woPartsTotal = woParts.reduce((s: number, p: any) => s + (p.quantity || 1) * (p.unit_cost || 0), 0)
  let laborTotal: number, partsLineTotal: number, chargesTotal: number, subtotal: number, taxAmt: number, grandTotal: number
  if (isImportedHistory) {
    // Compute from actual so_lines when available; fall back to stored columns only if no lines exist
    const hasLines = jobLines.length > 0 || partLines.length > 0 || feeLines.length > 0
    laborTotal = hasLines
      ? jobLines.reduce((s: number, l: any) => s + (l.unit_price || l.total_price || 0), 0)
      : (wo.labor_total || 0)
    partsLineTotal = hasLines
      ? partLines.reduce((s: number, l: any) => s + ((l.parts_sell_price || l.unit_price || 0) * (l.quantity || 1)), 0)
      : (wo.parts_total || 0)
    chargesTotal = feeLines.reduce((s: number, l: any) => s + (l.total_price || (l.quantity || 1) * (l.unit_price || 0)), 0)
    subtotal = laborTotal + partsLineTotal + chargesTotal
    taxAmt = 0
    grandTotal = wo.grand_total || subtotal
  } else {
    const opTotals = calcWoOperationalTotals(wo.so_lines || [], laborRate, taxRate, !!shop.tax_labor, shopCharges)
    laborTotal = opTotals.laborTotal
    partsLineTotal = opTotals.partsTotal
    chargesTotal = opTotals.chargesTotal
    subtotal = opTotals.subtotal + woPartsTotal
    taxAmt = opTotals.taxAmount
    grandTotal = opTotals.grandTotal + woPartsTotal
  }

  const fmt = (n: number) => '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) } catch { return d } }

  // Display-only predicate: customer-intake WO that has not yet been
  // service-reviewed. Source classification comes from the canonical helper
  // at @/lib/services/serviceOrderSource. Does NOT mutate any data;
  // gates only WO-detail presentation.
  const isUnreviewedIntake =
    !wo.is_historical &&
    wo.status === 'draft' &&
    isIntakeSoSource(wo.source) &&
    !wo.estimate_status &&
    !wo.estimate_approved &&
    grandTotal === 0
  const intakeSourceDisplayLabel = intakeSourceLabel(wo.source)

  // RENDER
  return (
    <div style={{ fontFamily: FONT, color: 'var(--tz-text)', background: 'var(--tz-bgCard)', minHeight: '100vh', maxWidth: 960, margin: '0 auto', padding: 'clamp(10px, 3vw, 20px)' }}>

      {/* BACK BUTTON — role-safe: only accounting roles go to /accounting/history */}
      {(() => {
        const isAccountingUser = ACCOUNTING_ROLES.includes(userRole)
        const backHref = wo.is_historical && isAccountingUser ? '/accounting/history' : '/work-orders'
        const backLabel = wo.is_historical && isAccountingUser ? 'Imported History' : 'Work Orders'
        return (
          <a href={backHref} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--tz-surfaceMuted)', color: 'var(--tz-text)', borderRadius: 100, padding: '6px 14px 6px 8px', fontSize: 13, fontWeight: 700, textDecoration: 'none', marginBottom: 16, fontFamily: FONT }}>
            <ChevronLeft size={16} /> {backLabel}
          </a>
        )
      })()}

      {/* HISTORICAL BANNER */}
      {wo.is_historical && (
        <div style={{ background: 'rgba(124,139,160,0.08)', border: '1px solid rgba(124,139,160,0.15)', borderRadius: 8, padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--tz-textSecondary)' }}>
          Historical Record — Imported | WO #{wo.so_number} | {new Date(wo.created_at).toLocaleDateString()}
        </div>
      )}

      {/* CUSTOMER INTAKE BANNER — display-only, gated by isUnreviewedIntake */}
      {isUnreviewedIntake && (
        <div style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.25)', borderRadius: 10, padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: AMBER, textTransform: 'uppercase', letterSpacing: '.04em' }}>Customer Requested Work</span>
            <span style={pillStyle('var(--tz-warningBg)', AMBER)}>Needs Service Review</span>
            <span style={pillStyle('var(--tz-bgHover)', GRAY)}>{intakeSourceDisplayLabel}</span>
          </div>
          <div style={{ fontSize: 14, color: 'var(--tz-text)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {wo.complaint || <span style={{ color: GRAY, fontStyle: 'italic' }}>No request text on file</span>}
          </div>
          {jobLines.length === 0 && (
            <div style={{ fontSize: 12, color: GRAY, marginTop: 8, fontStyle: 'italic' }}>
              No reviewed job lines yet. Use Add Job Line below to confirm scope before estimating.
            </div>
          )}
        </div>
      )}

      <WOHeader>
      {/* HEADER */}
      <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, borderBottom: `2px solid ${'var(--tz-border)'}` }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 26, fontWeight: 800 }}>{wo.so_number || ('WO-' + wo.id?.slice(0, 6))}</span>
            {isUnreviewedIntake ? (
              <>
                <span style={pillStyle('var(--tz-warningBg)', AMBER)}>Customer Intake — Needs Review</span>
                <span style={pillStyle('var(--tz-bgHover)', GRAY)}>{intakeSourceDisplayLabel}</span>
              </>
            ) : (
              <span style={pillStyle(woStatus.bg, woStatus.color)}>{woStatus.label}</span>
            )}
            <SourceBadge source={wo.source} />
            {wo.payment_terms === 'cod' && <span style={pillStyle('var(--tz-dangerBg)', RED)}>COD</span>}
            {wo.invoice_status && wo.invoice_status !== 'draft' && (() => {
              const IS: Record<string, { label: string; bg: string; color: string }> = {
                quality_check_failed: { label: 'QC Failed', bg: 'var(--tz-dangerBg)', color: RED },
                pending_accounting:   { label: 'Pending Accounting', bg: 'var(--tz-warningBg)', color: AMBER },
                accounting_approved:  { label: 'Acct. Approved', bg: 'var(--tz-successBg)', color: GREEN },
                sent_to_customer:     { label: 'Sent to Customer', bg: 'var(--tz-accentBg)', color: BLUE },
              }
              const s = IS[wo.invoice_status]; return s ? <span style={pillStyle(s.bg, s.color)}>{s.label}</span> : null
            })()}
          </div>
          {customer.company_name && (
            <a href={`/customers/${customer.id}`} style={{ color: BLUE, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              {customer.company_name}
            </a>
          )}
          <div style={{ fontSize: 11, color: GRAY, marginTop: 4 }}>Opened by: {createdByName}</div>
          {/* Edit / Submit / Cancel buttons */}
          {!wo.is_historical && isWriter && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: editMode ? 10 : 0 }}>
                {!editMode ? (
                  <button onClick={() => { setEditMode(true); setEditDraft({ complaint: wo.complaint || '', priority: wo.priority || 'normal', cause: wo.cause || '', correction: wo.correction || '' }) }} style={{ ...btnStyle( 'var(--tz-bgLight)', BLUE), border: `1px solid ${BLUE}`, padding: '6px 14px', fontSize: 12 }}>
                    Edit
                  </button>
                ) : (
                  <>
                    <button onClick={() => { setEditMode(false); setEditDraft(null) }} style={{ ...btnStyle( 'var(--tz-bgLight)', GRAY), padding: '6px 14px', fontSize: 12 }}>
                      Cancel
                    </button>
                    <button onClick={async () => {
                      if (!editDraft) return
                      const updates: Record<string, any> = {}
                      if (editDraft.complaint !== (wo.complaint || '')) updates.complaint = editDraft.complaint
                      if (editDraft.priority !== (wo.priority || 'normal')) updates.priority = editDraft.priority
                      if (editDraft.cause !== (wo.cause || '')) updates.cause = editDraft.cause
                      if (editDraft.correction !== (wo.correction || '')) updates.correction = editDraft.correction
                      if (wo.status === 'draft' && editDraft.complaint?.trim()) updates.status = 'open'
                      const res = await fetch(`/api/work-orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...updates, expected_updated_at: wo?.updated_at }) })
                      if (res.status === 409) {
                        setToastMsg('This record was updated by someone else. Refresh and try again.')
                        setTimeout(() => setToastMsg(''), 4000)
                      } else if (res.ok) {
                        setEditMode(false)
                        setEditDraft(null)
                        setToastMsg('Work order updated')
                        setTimeout(() => setToastMsg(''), 4000)
                        await loadData()
                      } else {
                        const err = await res.json()
                        setToastMsg(err.error || 'Failed to save')
                        setTimeout(() => setToastMsg(''), 4000)
                      }
                    }} style={btnStyle(BLUE, 'var(--tz-bgLight)')}>
                      Submit
                    </button>
                  </>
                )}
              </div>
              {/* Editable fields in edit mode */}
              {editMode && editDraft && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '12px 14px', background: 'var(--tz-bgHover)', borderRadius: 8, border: `1px solid ${'var(--tz-border)'}` }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Concern / Complaint</label>
                    <textarea value={editDraft.complaint} onChange={e => setEditDraft({ ...editDraft, complaint: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical', borderColor: 'var(--tz-borderAccent)' }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Priority</label>
                    <select value={editDraft.priority} onChange={e => setEditDraft({ ...editDraft, priority: e.target.value })} style={{ ...inputStyle, borderColor: 'var(--tz-borderAccent)', appearance: 'auto' }}>
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Cause</label>
                    <input value={editDraft.cause} onChange={e => setEditDraft({ ...editDraft, cause: e.target.value })} style={{ ...inputStyle, borderColor: 'var(--tz-borderAccent)' }} placeholder="Root cause" />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Correction</label>
                    <input value={editDraft.correction} onChange={e => setEditDraft({ ...editDraft, correction: e.target.value })} style={{ ...inputStyle, borderColor: 'var(--tz-borderAccent)' }} placeholder="Correction applied" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', minWidth: 200 }}>
          {wo.assets ? (
            <>
              {asset.unit_number && (
                <a href={`/assets/${asset.id}`} style={{ fontSize: 16, fontWeight: 700, color: BLUE, textDecoration: 'none' }}>
                  Unit #{asset.unit_number}
                </a>
              )}
              <div style={{ fontSize: 13, color: 'var(--tz-text)', marginTop: 2 }}>
                {[asset.year, asset.make, asset.model].filter(Boolean).join(' ')}
              </div>
              <div style={{ fontSize: 13, marginTop: 2 }}>
                VIN: <span style={{ fontWeight: 700 }}>{wo.is_historical ? '' : '...'}{vinDisplay}</span>
              </div>
              {mileage && <div style={{ fontSize: 12, color: GRAY, marginTop: 2 }}>{parseInt(mileage).toLocaleString()} mi</div>}
              <div style={{ marginTop: 4 }}><OwnershipTypeBadge type={asset.is_owner_operator ? 'owner_operator' : (wo.ownership_type || asset.ownership_type)} size="lg" /></div>
            </>
          ) : (
            <span style={{ color: 'var(--tz-textTertiary)', fontStyle: 'italic' }}>Walk-in / Unit not on file</span>
          )}
        </div>
      </div>

      </WOHeader>

      {/* OWNER & DRIVER INFO */}
      {wo.assets && (asset.owner_name || asset.driver_name) && (
        <div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '10px 16px', fontSize: 12 }}>
          <div>
            <span style={{ ...labelStyle, marginBottom: 2 }}>Owner</span>
            <div style={{ fontWeight: 600, color: 'var(--tz-text)' }}>
              {asset.owner_name || <span style={{ color: 'var(--tz-textTertiary)', fontStyle: 'italic' }}>Not assigned</span>}
              {asset.owner_phone && (
                <a href={`tel:${asset.owner_phone}`} style={{ color: BLUE, textDecoration: 'none', marginLeft: 8, fontWeight: 400 }}>{asset.owner_phone}</a>
              )}
            </div>
          </div>
          <div>
            <span style={{ ...labelStyle, marginBottom: 2 }}>Driver</span>
            <div style={{ fontWeight: 600, color: 'var(--tz-text)' }}>
              {asset.driver_name || <span style={{ color: 'var(--tz-textTertiary)', fontStyle: 'italic' }}>Not assigned</span>}
              {asset.driver_phone && (
                <a href={`tel:${asset.driver_phone}`} style={{ color: BLUE, textDecoration: 'none', marginLeft: 8, fontWeight: 400 }}>{asset.driver_phone}</a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* WARRANTY BANNER — 3 scenarios */}
      {!wo.is_historical && !isViewOnly && (wo.warranty_status === 'not_checked' || wo.warranty_status === 'none' || !wo.warranty_status) && (() => {
        const isFleet = customer?.is_fleet
        const hasWarranty = isFleet && asset?.warranty_expiry && new Date(asset.warranty_expiry) > new Date() && asset?.warranty_provider
        return (
          <div style={{ background: hasWarranty ? 'rgba(245,158,11,0.08)' : 'rgba(124,139,160,0.06)', border: `1px solid ${hasWarranty ? 'rgba(245,158,11,0.2)' : 'rgba(124,139,160,0.12)'}`, borderRadius: 8, padding: '10px 16px', marginBottom: 12, fontSize: 12 }}>
            {hasWarranty ? (
              /* Scenario 3: Company truck with active warranty */
              <>
                <div style={{ color: AMBER, fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                  Under Warranty — {asset.warranty_provider} — Expires: {new Date(asset.warranty_expiry).toLocaleDateString()}
                  {asset.warranty_mileage_limit ? ` — Mileage limit: ${asset.warranty_mileage_limit.toLocaleString()} mi` : ''}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button onClick={() => warrantyDecision('no_warranty')} style={btnStyle('var(--tz-successBg)', GREEN)}>No Warranty — Proceed</button>
                  <button onClick={() => warrantyDecision('checking')} style={btnStyle('var(--tz-warningBg)', AMBER)}>Send for Warranty Check</button>
                  <button onClick={() => warrantyDecision('send_to_dealer')} style={btnStyle('var(--tz-dangerBg)', RED)}>Send to Dealer</button>
                </div>
              </>
            ) : (
              /* Scenario 1 & 2: No warranty info */
              <>
                <div style={{ color: GRAY, fontSize: 12, marginBottom: 6 }}>
                  {isFleet ? 'No warranty information on file for this unit' : 'Outside customer / Owner operator truck'}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button onClick={() => warrantyDecision('no_warranty')} style={btnStyle('var(--tz-successBg)', GREEN)}>No Warranty — Proceed</button>
                  <button onClick={() => warrantyDecision('checking')} style={btnStyle('var(--tz-warningBg)', AMBER)}>Send for Warranty Check</button>
                  {isFleet && asset?.id && <a href={`/fleet/${asset.id}`} style={{ fontSize: 11, color: BLUE, textDecoration: 'none', marginLeft: 8 }}>Add warranty info →</a>}
                </div>
              </>
            )}
          </div>
        )
      })()}
      {wo.warranty_status === 'checking' && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '8px 16px', marginBottom: 12, fontSize: 12, color: AMBER, fontWeight: 600 }}>
          Warranty check in progress — maintenance team is verifying coverage
        </div>
      )}
      {wo.warranty_status === 'local_repair' && (
        <div style={{ background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.15)', borderRadius: 8, padding: '8px 16px', marginBottom: 12, fontSize: 12, color: GREEN, display: 'flex', alignItems: 'center', gap: 6 }}>
          WARRANTY CLAIM — Local Repair{wo.warranty_notes ? ` — ${wo.warranty_notes}` : ''}
        </div>
      )}
      {wo.warranty_status === 'send_to_dealer' && (
        <div style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 8, padding: '10px 16px', marginBottom: 12, fontSize: 12, color: RED }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>SENT TO DEALER — WO Frozen</div>
          {wo.warranty_dealer_name && <div>Dealer: {wo.warranty_dealer_name}{wo.warranty_dealer_location ? ` — ${wo.warranty_dealer_location}` : ''}</div>}
          {wo.warranty_notes && <div style={{ marginTop: 2, color: GRAY }}>{wo.warranty_notes}</div>}
        </div>
      )}

      {/* PROGRESS PIPELINE */}
      {!wo.is_historical && <WOStepper wo={wo} asset={asset} jobLines={jobLines} jobAssignments={jobAssignments} />}

      {/* AUTOMATION VISIBILITY */}
      {wo.automation && wo.automation.stage !== 'closed' && wo.automation.stage !== 'void' && !wo.is_historical && !isViewOnly && (
        <div style={{
          ...cardStyle,
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
          background: wo.automation.is_overdue ? 'var(--tz-dangerBg)' : wo.automation.blocked_by ? 'var(--tz-warningBg)' : 'var(--tz-successBg)',
          border: `1px solid ${wo.automation.is_overdue ? 'var(--tz-danger)' : wo.automation.blocked_by ? 'var(--tz-warning)' : 'var(--tz-success)'}`,
        }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: wo.automation.is_overdue ? 'var(--tz-danger)' : wo.automation.blocked_by ? 'var(--tz-warning)' : 'var(--tz-success)', marginBottom: 2 }}>
              {wo.automation.is_overdue ? 'Overdue' : wo.automation.blocked_by ? 'Blocked' : 'On Track'}
              {wo.automation.exception && <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: 'rgba(0,0,0,0.06)', textTransform: 'uppercase' }}>{wo.automation.exception.replace(/_/g, ' ')}</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--tz-textSecondary)' }}><strong>Next:</strong> {wo.automation.next_action}</div>
            {wo.automation.blocked_by && <div style={{ fontSize: 11, color: 'var(--tz-warning)', marginTop: 2 }}>{wo.automation.blocked_by}</div>}
          </div>
          <div style={{ textAlign: 'right', fontSize: 11, color: GRAY }}>
            <div>Owner: <strong style={{ color: 'var(--tz-text)' }}>{wo.automation.owner.replace(/_/g, ' ')}</strong></div>
            {wo.etc && wo.etc.confidence !== 'none' && (
              <div style={{ marginTop: 2, fontWeight: 600, color: wo.etc.remaining_hours === 0 ? RED : 'var(--tz-textSecondary)' }}>
                ETC: {wo.etc.etc_label}
                <span style={{ marginLeft: 4, fontSize: 9, fontWeight: 400, opacity: 0.7 }}>({wo.etc.confidence})</span>
              </div>
            )}
            {wo.automation.stage_age_hours != null && <div>{wo.automation.stage_age_hours}h in stage</div>}
            {wo.automation.total_age_hours != null && <div>{wo.automation.total_age_hours}h total</div>}
          </div>
        </div>
      )}

      {/* EXTRA TIME REQUESTS */}
      {extraTimeRequests.length > 0 && (
        <div style={{ ...cardStyle, background: 'var(--tz-warningBg)', border: `1px solid ${'var(--tz-warning)'}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tz-warning)', marginBottom: 8 }}>
            Extra Time Request{extraTimeRequests.length > 1 ? 's' : ''} ({extraTimeRequests.length})
          </div>
          {extraTimeRequests.map((req: any) => (
            <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: `1px solid ${'var(--tz-warning)'}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>
                  {req.users?.full_name || 'Mechanic'} — {req.hours_requested ? `+${req.hours_requested}h` : 'Extra time'}
                </div>
                <div style={{ fontSize: 11, color: GRAY }}>{req.description}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={async () => {
                  await fetch('/api/mechanic-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'respond', request_id: req.id, status: 'approved' }) })
                  setExtraTimeRequests(prev => prev.filter(r => r.id !== req.id))
                }} style={{ ...btnStyle(GREEN, 'var(--tz-bgLight)'), padding: '4px 12px', fontSize: 11 }}>Approve</button>
                <button onClick={async () => {
                  await fetch('/api/mechanic-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'respond', request_id: req.id, status: 'denied' }) })
                  setExtraTimeRequests(prev => prev.filter(r => r.id !== req.id))
                }} style={{ ...btnStyle(RED, 'var(--tz-bgLight)'), padding: '4px 12px', fontSize: 11 }}>Deny</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB BAR — historical WOs hide the Estimate tab; full historical
          detail lives on the Invoice tab. Indices stay aligned with the
          original TABS positions so per-tab `tab === N` content still works. */}
      <div data-no-print style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${'var(--tz-border)'}`, marginBottom: 16, overflowX: 'auto' }}>
        {TABS.map((tabLabel, i) => {
          if (wo.is_historical && tabLabel === 'Estimate') return null
          return (
            <button key={tabLabel} onClick={() => setTab(i)} style={{
              padding: '10px 18px', background: 'transparent', border: 'none', borderBottom: tab === i ? `2px solid ${'var(--tz-accent)'}` : '2px solid transparent',
              color: tab === i ? 'var(--tz-accent)' : 'var(--tz-textTertiary)', fontWeight: tab === i ? 700 : 500, fontSize: 13, cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap',
            }}>
              {tabLabel}
            </button>
          )
        })}
      </div>

      {/* QUICK ACTIONS */}
      {!wo.is_historical && !isViewOnly && (
        <div data-no-print style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {[
            { icon: <Users size={16} />, label: 'Team', onClick: () => {
              const bypassJobTypes = ['diagnostic', 'full_inspection']
              if (wo.estimate_required && !wo.estimate_approved && !bypassJobTypes.includes(wo.job_type)) {
                alert('Estimate must be approved before this work order can be assigned. Go to the Estimate tab to build and send the estimate.')
                return
              }
              setShowTeamModal(true)
            }},
            { icon: <MessageSquare size={16} />, label: 'Notes', onClick: () => setTab(3) },
            { icon: <Clock size={16} />, label: 'Activity', onClick: () => setTab(4) },
            { icon: <DollarSign size={16} />, label: 'Billing', onClick: () => setTab(2) },
          ].map(a => (
            <button key={a.label} onClick={a.onClick} style={{
              width: 38, height: 38, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: 'var(--tz-bgHover)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 8, cursor: 'pointer', padding: 0, gap: 2,
            }}>
              {a.icon}
              <span style={{ fontSize: 10, color: GRAY }}>{a.label}</span>
            </button>
          ))}
          <div style={{ width: 1, height: 30, background: 'var(--tz-border)' }} />
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowMenu(!showMenu)} style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--tz-bgHover)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 8, cursor: 'pointer' }}>
              <MoreHorizontal size={16} />
            </button>
            {showMenu && (
              <div style={{ position: 'absolute', top: 42, left: 0, background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, minWidth: 180, padding: 4 }}>
                {Object.entries(WO_STATUS).map(([k, v]) => (
                  <button key={k} onClick={() => updateWoStatus(k)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: wo.status === k ? 'var(--tz-accentBg)' : 'transparent', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: FONT, color: v.color }}>
                    {v.label}
                  </button>
                ))}
                <div style={{ borderTop: `1px solid ${'var(--tz-border)'}`, margin: '4px 0' }} />
                {isWriter && (
                  <button onClick={() => { setShowMenu(false); setDeleteConfirm(true) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'transparent', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: FONT, color: RED }}>
                    Void Work Order
                  </button>
                )}
              </div>
            )}
          </div>
          <div style={{ flex: 1 }} />
          {/* Accounting handoff moved to Invoice tab — no duplicate button here */}
          {/* Mileage captured at WO creation — shown in header, not editable here */}
        </div>
      )}

      {/* QC ERRORS */}
      {showQcErrors && qcErrors.length > 0 && (
        <div style={{ ...cardStyle, background: 'var(--tz-dangerBg)', border: `1px solid ${'var(--tz-danger)'}`, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: RED }}>Quality Check Failed</span>
            <button onClick={() => setShowQcErrors(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: RED, fontSize: 16, fontFamily: FONT }}>&times;</button>
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: 12, color: 'var(--tz-danger)', lineHeight: 1.8 }}>
            {qcErrors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* ========== TAB 0: OVERVIEW ========== */}
      {tab === 0 && (
        <JobsTab>
        <div>
          {/* Merge controls for service writers */}
          {!wo.is_historical && !isViewOnly && jobLines.length > 1 && mergeSelected.size >= 2 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--tz-accentBg)', border: `1px solid ${'var(--tz-borderAccent)'}`, borderRadius: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tz-accent)' }}>{mergeSelected.size} lines selected</span>
              <button disabled={merging} onClick={async () => {
                const ids = Array.from(mergeSelected)
                const destId = ids[0]
                const srcIds = ids.slice(1)
                // Client-side preflight mirror of server approval-boundary
                // guard (LineMerge_EstimateGroupApprovalGuard_Fix). Server
                // remains authoritative; this preflight avoids a needless
                // round-trip and shows user-facing wording for obvious bad
                // merges without leaking supplement_batch_id.
                const selectedLines = jobLines.filter((l: any) => ids.includes(l.id))
                const mergeGroup = (l: any): string => l.is_additional === true
                  ? (l.supplement_batch_id ? `batch:${l.supplement_batch_id}` : 'unbatched_added')
                  : 'original'
                const mergeState = (l: any): 'approved' | 'declined' | 'pending' => {
                  if (l.is_additional === true) {
                    if (l.customer_approved === true) return 'approved'
                    if (l.customer_approved === false) return 'declined'
                    return 'pending'
                  }
                  if (wo.estimate_approved === true) return 'approved'
                  if (l.approval_status === 'approved') return 'approved'
                  if (l.approval_status === 'declined') return 'declined'
                  return 'pending'
                }
                // LineMerge_AllowApprovedApproved_Fix — mirrors the relaxed
                // server guard. All-approved merges pass; mixed approval
                // states block.
                const preflight: string[] = []
                const preflightStates = new Set(selectedLines.map(mergeState))
                if (preflightStates.has('declined') && preflightStates.size > 1) {
                  preflight.push('Cannot merge declined estimate lines.')
                }
                if (preflightStates.has('approved') && preflightStates.has('pending')) {
                  preflight.push('Cannot merge approved work with work still waiting for approval.')
                }
                if (preflightStates.size === 1 && preflightStates.has('pending')) {
                  const pendingGroups = new Set(selectedLines.map(mergeGroup))
                  if (pendingGroups.size > 1) preflight.push('Cannot merge lines from different pending estimates.')
                }
                if (preflight.length > 0) { alert(preflight.join('\n')); return }
                setMerging(true)
                try {
                  const res = await fetch('/api/so-lines/merge', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ destination_id: destId, source_ids: srcIds }),
                  })
                  if (res.ok) {
                    setMergeSelected(new Set())
                    const woRes = await fetch(`/api/work-orders/${wo.id}`)
                    if (woRes.ok) { const d = await woRes.json(); setWo(d) }
                  } else {
                    const err = await res.json().catch(() => ({}))
                    alert(err.blocked ? err.blocked.join('\n') : err.error || 'Merge failed')
                  }
                } catch { alert('Merge failed — please try again') }
                setMerging(false)
              }} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: 'var(--tz-accent)', color: 'var(--tz-bgLight)', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: merging ? 0.5 : 1 }}>
                {merging ? 'Merging...' : `Merge into first selected`}
              </button>
              <button onClick={() => setMergeSelected(new Set())} style={{ background: 'none', border: 'none', color: 'var(--tz-textTertiary)', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
            </div>
          )}
          {/* Historical-only read-only labor summary. When the imported
              Fullbay snapshot is present we render one card per source
              Complaint (with its Corrections nested as bullet text). Without
              the snapshot we fall back to one card per raw labor so_lines
              row, parsed for multi-line descriptions. Money never appears on
              Jobs cards. */}
          {wo.is_historical && historicalSnapshot && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tz-text)' }}>Imported Labor</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: GRAY, padding: '2px 8px', borderRadius: 100, background: 'var(--tz-bgHover)' }}>read-only</span>
                {snapshotComplaints.length > 0 && <span style={{ fontSize: 11, color: GRAY, marginLeft: 'auto' }}>{snapshotComplaints.length} {snapshotComplaints.length === 1 ? 'complaint' : 'complaints'}</span>}
              </div>
              {snapshotComplaints.length === 0 && (
                <div style={{ fontSize: 12, color: GRAY, fontStyle: 'italic' }}>No complaints recorded on this imported work order.</div>
              )}
              {snapshotComplaints.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {snapshotComplaints.map((cmp: any, ci: number) => {
                    const note = (cmp?.note || '').toString().trim()
                    const noteLines = note ? note.split(/\r?\n+/).map((s: string) => s.trim()).filter(Boolean) : []
                    const hrs = Number(cmp?.labor_hours_total) || 0
                    const corrections = (cmp?.corrections || []).filter((c: any) =>
                      (c?.recommended_correction || c?.actual_correction || c?.correction_performed || c?.title)
                    )
                    return (
                      <div key={ci} style={{ border: `1px solid ${'var(--tz-border)'}`, borderRadius: 8, padding: 12, background: 'var(--tz-bgCard)' }}>
                        {noteLines.length <= 1 ? (
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tz-text)' }}>{noteLines[0] || '—'}</span>
                        ) : (
                          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {noteLines.map((it: string, i: number) => (
                              <li key={i} style={{ fontSize: 13, fontWeight: 600, color: 'var(--tz-text)' }}>{it}</li>
                            ))}
                          </ul>
                        )}
                        {corrections.length > 0 && (
                          <div style={{ marginTop: 8, paddingLeft: 12, borderLeft: `2px solid ${'var(--tz-border)'}` }}>
                            {corrections.map((c: any, i: number) => {
                              const rec = (c?.recommended_correction || '').toString().trim()
                              const act = (c?.actual_correction || '').toString().trim()
                              const perf = (c?.correction_performed || '').toString().trim()
                              return (
                                <div key={i} style={{ fontSize: 12, color: 'var(--tz-textSecondary)', marginLeft: 10, marginBottom: i === corrections.length - 1 ? 0 : 6 }}>
                                  {rec ? <div><strong style={{ color: GRAY }}>Recommended:</strong> {rec}</div> : null}
                                  {act ? <div><strong style={{ color: GRAY }}>Actual:</strong> {act}</div> : null}
                                  {perf && perf !== rec && perf !== act ? <div><strong style={{ color: GRAY }}>Performed:</strong> {perf}</div> : null}
                                </div>
                              )
                            })}
                          </div>
                        )}
                        {hrs > 0 && (
                          <div style={{ fontSize: 11, color: GRAY, marginTop: 6 }}>
                            <strong style={{ color: 'var(--tz-textSecondary)' }}>Hours:</strong> {hrs}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          {wo.is_historical && !historicalSnapshot && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tz-text)' }}>Imported Labor</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: GRAY, padding: '2px 8px', borderRadius: 100, background: 'var(--tz-bgHover)' }}>read-only</span>
                {jobLines.length > 0 && <span style={{ fontSize: 11, color: GRAY, marginLeft: 'auto' }}>{jobLines.length} {jobLines.length === 1 ? 'item' : 'items'}</span>}
              </div>
              {jobLines.length === 0 && (
                <div style={{ fontSize: 12, color: GRAY, fontStyle: 'italic' }}>No labor lines on this imported work order.</div>
              )}
              {jobLines.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {jobLines.map((l: any) => {
                    const items = dedupeHistoricalLaborDisplayItems(parseHistoricalLaborItems(l.description))
                    const hrs = Number(l.billed_hours || l.actual_hours || l.estimated_hours || 0) || 0
                    return (
                      <div key={l.id} style={{ border: `1px solid ${'var(--tz-border)'}`, borderRadius: 8, padding: 12, background: 'var(--tz-bgCard)' }}>
                        {items.length === 1 ? (
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tz-text)' }}>{items[0]}</span>
                        ) : (
                          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {items.map((it, i) => (
                              <li key={i} style={{ fontSize: 13, fontWeight: 600, color: 'var(--tz-text)' }}>{it}</li>
                            ))}
                          </ul>
                        )}
                        {(hrs || l.finding || l.resolution) ? (
                          <div style={{ fontSize: 11, color: GRAY, marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {hrs ? <span><strong style={{ color: 'var(--tz-textSecondary)' }}>Hours:</strong> {hrs}</span> : null}
                            {l.finding ? <span><strong style={{ color: 'var(--tz-textSecondary)' }}>Finding:</strong> {l.finding}</span> : null}
                            {l.resolution ? <span><strong style={{ color: 'var(--tz-textSecondary)' }}>Resolution:</strong> {l.resolution}</span> : null}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          {(wo.is_historical ? [] as any[] : jobLines).map((line: any, idx: number) => {
            const st = LINE_STATUS[line.line_status] || LINE_STATUS.unassigned
            const lineAssignments = jobAssignments.filter((a: any) => a.line_id === line.id)
            const isAdditional = line.is_additional
            // Phase 2B: per-line validation result + helpers for the warning
            // chrome and the inline "Edit Job Line" affordance.
            const lineValidation = jobLineValidations[line.id]
            const lineInvalid = !!lineValidation && !lineValidation.valid
            const isEditingThisLine = editingJobLineId === line.id
            // lineParts retained for future Parts-tab linkage; the visual
            // rendering has moved to the Parts tab per packet-1 intent.
            const lineParts = woParts.filter((p: any) => p.line_id === line.id)
            void lineParts
            const expanded = !!expandedJobLines[line.id]
            // Defense backstop: a line whose created_at is strictly after the
            // parent WO's approval timestamp must be treated as a supplement
            // even when is_additional is missing/false on the row (e.g. when
            // the API SELECT did not project is_additional, or when an older
            // write path created the row before the supplement-flagging fix
            // shipped). Uses already-loaded fields only — no API widening.
            const parentApprovedAt = wo.estimate_approved_date || wo.approved_at || null
            const parentApprovedAtMs = parentApprovedAt ? Date.parse(parentApprovedAt) : NaN
            const lineCreatedAtMs = line.created_at ? Date.parse(line.created_at) : NaN
            const lineCreatedAfterApproval = Number.isFinite(parentApprovedAtMs) && Number.isFinite(lineCreatedAtMs) && lineCreatedAtMs > parentApprovedAtMs
            // Primary status pill — priority-resolved (packet-1: two-row header).
            // Declined > Waiting > Approved > In Progress > Completed > Waiting Assignment > fallback.
            const primary = (() => {
              if (line.is_additional === true && line.customer_approved === false) return { label: 'DECLINED', bg: 'var(--tz-dangerBg)', color: RED }
              if (line.approval_status === 'declined') return { label: 'DECLINED', bg: 'var(--tz-dangerBg)', color: RED }
              // Defense rules for post-approval lines (mirror the explicit
              // is_additional=true triad below). Fire BEFORE the originally-
              // approved rule so a line created after parent approval cannot
              // inherit Estimate-1 approval.
              if (lineCreatedAfterApproval && line.customer_approved === false) return { label: 'DECLINED', bg: 'var(--tz-dangerBg)', color: RED }
              if (lineCreatedAfterApproval && line.customer_approved == null) return { label: 'WAITING FOR APPROVAL', bg: 'var(--tz-warningBg)', color: AMBER }
              if (lineCreatedAfterApproval && line.customer_approved === true) return { label: 'APPROVED', bg: 'var(--tz-accentBg)', color: BLUE }
              if (line.is_additional === true && line.customer_approved == null) return { label: 'WAITING FOR APPROVAL', bg: 'var(--tz-warningBg)', color: AMBER }
              if (!line.is_additional && !wo.estimate_approved && (line.approval_status === 'needs_approval' || line.approval_status === 'pending')) return { label: isUnreviewedIntake ? 'PENDING REVIEW' : 'WAITING FOR APPROVAL', bg: 'var(--tz-warningBg)', color: AMBER }
              if (line.is_additional === true && line.customer_approved === true) return { label: 'APPROVED', bg: 'var(--tz-accentBg)', color: BLUE }
              if (!line.is_additional && wo.estimate_approved) return { label: 'APPROVED', bg: 'var(--tz-successBg)', color: GREEN }
              if (line.approval_status === 'approved') return { label: 'APPROVED', bg: 'var(--tz-successBg)', color: GREEN }
              if (line.line_status === 'in_progress') return { label: 'IN PROGRESS', bg: 'var(--tz-accentBg)', color: BLUE }
              if (line.line_status === 'completed') return { label: 'COMPLETED', bg: 'var(--tz-successBg)', color: GREEN }
              if (lineAssignments.length === 0 || line.line_status === 'unassigned') return { label: 'WAITING ASSIGNMENT', bg: 'var(--tz-bgHover)', color: GRAY }
              return { label: st.label, bg: st.bg, color: st.color }
            })()
            const mechanicLabel = lineAssignments.length > 0
              ? lineAssignments.map((a: any) => a.users?.full_name || 'Unknown').join(', ')
              : 'Unassigned'
            const estHoursCompact = line.estimated_hours || 0
            const isWaitingOrDeclined = primary.label === 'WAITING FOR APPROVAL' || primary.label === 'PENDING REVIEW' || primary.label === 'DECLINED'
            // Display-only splitter for merged concern descriptions. Splits
            // by newline, " + " (merge-helper output), and " • " preview.
            // Falls back to a single item. Stored description is not mutated.
            const splitConcern = (desc: string | null | undefined): string[] => {
              const s = (desc || '').trim()
              if (!s) return []
              const byNewline = s.split(/\r?\n+/).map(p => p.trim()).filter(Boolean)
              if (byNewline.length > 1) return byNewline
              const byPlus = s.split(/\s*\+\s*/).map(p => p.trim()).filter(Boolean)
              if (byPlus.length > 1) return byPlus
              const byBullet = s.split(/\s*•\s*/).map(p => p.trim()).filter(Boolean)
              if (byBullet.length > 1) return byBullet
              return [s]
            }
            const concernItems = splitConcern(line.description)
            void isAdditional

            return (
              <div key={line.id} style={{ ...cardStyle, position: 'relative', padding: 18, borderRadius: 14, ...(lineInvalid ? { boxShadow: 'inset 3px 0 0 0 var(--tz-danger)' } : {}) }}>
                {/* Single-row collapsible header (jobline redesign):
                    chrome (checkbox, chevron, Job #) + complaints count +
                    primary status pill + assignee pill + Est hours pill +
                    right-aligned compact Edit button. */}
                <div onClick={() => setExpandedJobLines(m => ({ ...m, [line.id]: !m[line.id] }))} style={{ cursor: 'pointer', marginBottom: expanded ? 14 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {!wo.is_historical && !isViewOnly && jobLines.length > 1 && (
                      <input type="checkbox" checked={mergeSelected.has(line.id)} onClick={e => e.stopPropagation()} onChange={() => setMergeSelected(prev => { const n = new Set(prev); n.has(line.id) ? n.delete(line.id) : n.add(line.id); return n })} style={{ cursor: 'pointer', accentColor: 'var(--tz-accent)', width: 16, height: 16, flexShrink: 0 }} />
                    )}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      {expanded ? <ChevronDown size={16} color={GRAY} /> : <ChevronRight size={16} color={GRAY} />}
                      <span style={{ fontSize: 16, fontWeight: 700 }}>Job {idx + 1}</span>
                    </span>
                    {concernItems.length >= 1 && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, color: 'var(--tz-textSecondary)', fontSize: 13 }}>
                        <span style={{ width: 1, height: 18, background: 'var(--tz-border)' }} />
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <MessageSquare size={13} />
                          {concernItems.length} {concernItems.length === 1 ? 'complaint' : 'complaints'}
                        </span>
                      </span>
                    )}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 100, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', background: primary.bg, color: primary.color }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: primary.color, flexShrink: 0 }} />
                      {primary.label}
                    </span>
                    {lineInvalid && (
                      <span style={pillStyle('var(--tz-dangerBg)', RED)} title={lineValidation && !lineValidation.valid ? lineValidation.message : ''}>
                        Tire position required
                      </span>
                    )}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 100, fontSize: 13, fontWeight: 500, background: 'var(--tz-bgCard)', color: lineAssignments.length > 0 ? 'var(--tz-text)' : 'var(--tz-textSecondary)', border: `1px solid ${'var(--tz-border)'}` }}>
                      <User size={13} />
                      {mechanicLabel}
                    </span>
                    {estHoursCompact > 0 && !isUnreviewedIntake && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 12px', borderRadius: 100, fontSize: 13, fontWeight: 500, background: 'var(--tz-bgCard)', color: 'var(--tz-text)', border: `1px solid ${'var(--tz-border)'}` }}>
                        Est {estHoursCompact}h
                      </span>
                    )}
                    {!wo.is_historical && !isViewOnly && !isEditingThisLine && (
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          setEditingJobLineForm({
                            description: line.description || '',
                            tire_positions: (line.tire_position || '').split(',').map((p: string) => p.trim()).filter(Boolean),
                            estimated_hours: line.estimated_hours != null ? String(line.estimated_hours) : '',
                          })
                          setEditingJobLineId(line.id)
                          setExpandedJobLines(m => ({ ...m, [line.id]: true }))
                        }}
                        style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', background: 'var(--tz-bgCard)', color: lineInvalid ? RED : 'var(--tz-text)', border: `1px solid ${lineInvalid ? 'var(--tz-danger)' : 'var(--tz-border)'}`, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <Pencil size={13} /> Edit
                      </button>
                    )}
                  </div>
                </div>

                {expanded && (
                <>
                {/* Phase 2B: invalid-line warning + per-line "Edit Job Line"
                    affordance. The warning explains what to fix; the Edit
                    button toggles the small inline editor for description +
                    tire_position. The generic WO-level Edit button does NOT
                    drive this — it controls the WO header. */}
                {lineInvalid && lineValidation && !lineValidation.valid && (
                  <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 8, background: 'var(--tz-dangerBg)', border: '1px solid rgba(220,38,38,0.25)', color: RED, fontSize: 12, lineHeight: 1.4 }}>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>{lineValidation.message}</div>
                    <div style={{ color: 'var(--tz-textSecondary)' }}>
                      Add steer/drive/trailer, axle, DS/PS, or inside/outside detail. Required before this estimate can be sent.
                    </div>
                  </div>
                )}
                {/* Edit-line trigger lives in the header (jobline redesign);
                    the inline editor still renders here when isEditingThisLine. */}
                {isEditingThisLine && (() => {
                  const estHoursRaw = editingJobLineForm.estimated_hours.trim()
                  const estHoursNum = estHoursRaw === '' ? null : Number(estHoursRaw)
                  const estHoursInvalid = estHoursRaw !== '' && (!Number.isFinite(estHoursNum as number) || (estHoursNum as number) < 0)
                  const draftDesc = editingJobLineForm.description
                  const tireRelatedFromDraft = isTireRelatedDescription(draftDesc)
                  const existingHadTire = !!(line.tire_position && String(line.tire_position).trim())
                  const showTireUI = tireRelatedFromDraft || existingHadTire
                  const transitioningOff = existingHadTire && !tireRelatedFromDraft
                  const positionsEmptyButTire = tireRelatedFromDraft && editingJobLineForm.tire_positions.length === 0
                  // Linked auto-generated rough tire parts on the same labor line.
                  // Used to decide whether non-tire transition can safely cancel them.
                  const linkedTireParts = (wo?.so_lines || []).filter((p: any) =>
                    p.line_type === 'part' &&
                    p.related_labor_line_id === line.id &&
                    p.parts_status !== 'canceled' &&
                    isTireRelatedDescription(p.rough_name || p.description || '')
                  )
                  const safeToCancelTireParts = linkedTireParts.filter((p: any) =>
                    p.parts_status === 'rough' &&
                    !p.real_name &&
                    !p.part_number &&
                    !p.parts_cost_price &&
                    !p.parts_sell_price
                  )
                  const unsafeLinkedTireParts = linkedTireParts.filter((p: any) => !safeToCancelTireParts.includes(p))
                  const togglePosition = (pos: string) => setEditingJobLineForm(f => ({
                    ...f,
                    tire_positions: f.tire_positions.includes(pos)
                      ? f.tire_positions.filter(p => p !== pos)
                      : [...f.tire_positions, pos],
                  }))
                  return (
                  <div style={{ marginBottom: 10, padding: '12px 14px', borderRadius: 8, border: `1px solid ${'var(--tz-border)'}`, background: 'var(--tz-bgCard)', color: 'var(--tz-text)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Edit Job Line</div>
                    <label style={{ fontSize: 11, color: GRAY, marginBottom: 4, display: 'block' }}>Description</label>
                    <textarea
                      value={editingJobLineForm.description}
                      onChange={e => setEditingJobLineForm(f => ({ ...f, description: e.target.value }))}
                      rows={3}
                      style={{ ...inputStyle, fontSize: 13, width: '100%', resize: 'vertical', marginBottom: 10 }}
                    />
                    {showTireUI && (
                      <>
                        <label style={{ fontSize: 11, color: GRAY, marginBottom: 4, display: 'block' }}>
                          Tire position{tireRelatedFromDraft ? ' (required for tire jobs)' : ''}
                        </label>
                        {transitioningOff && (
                          <div style={{ fontSize: 11, color: AMBER, background: 'var(--tz-warningBg)', border: `1px solid ${AMBER}33`, borderRadius: 6, padding: '6px 10px', marginBottom: 8, lineHeight: 1.4 }}>
                            Changing this job away from tire will clear the tire position{safeToCancelTireParts.length > 0 ? ` and remove ${safeToCancelTireParts.length} auto-generated tire request${safeToCancelTireParts.length > 1 ? 's' : ''}` : ''}.
                            {unsafeLinkedTireParts.length > 0 && ` ${unsafeLinkedTireParts.length} tire part${unsafeLinkedTireParts.length > 1 ? 's have' : ' has'} activity and will be left for manual review.`}
                          </div>
                        )}
                        {!transitioningOff && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, opacity: tireRelatedFromDraft ? 1 : 0.7 }}>
                            {TIRE_POSITION_OPTIONS.map(g => (
                              <div key={g.group} style={{ width: '100%' }}>
                                <div style={{ fontSize: 10, fontWeight: 600, color: GRAY, marginBottom: 4 }}>{g.group}</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                                  {g.positions.map(pos => {
                                    const selected = editingJobLineForm.tire_positions.includes(pos)
                                    return (
                                      <button
                                        key={pos}
                                        type="button"
                                        onClick={() => togglePosition(pos)}
                                        disabled={!tireRelatedFromDraft}
                                        style={{
                                          padding: '4px 10px',
                                          borderRadius: 6,
                                          fontSize: 11,
                                          fontWeight: 600,
                                          fontFamily: FONT,
                                          cursor: tireRelatedFromDraft ? 'pointer' : 'not-allowed',
                                          background: selected ? BLUE : 'var(--tz-bgCard)',
                                          color: selected ? 'var(--tz-bgLight)' : 'var(--tz-text)',
                                          border: `1px solid ${selected ? BLUE : 'var(--tz-inputBorder)'}`,
                                        }}
                                      >
                                        {pos}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {positionsEmptyButTire && !transitioningOff && (
                          <div style={{ fontSize: 11, color: RED, marginBottom: 8 }}>Select at least one tire position.</div>
                        )}
                      </>
                    )}
                    <label style={{ fontSize: 11, color: GRAY, marginBottom: 4, display: 'block' }}>Estimated Hours</label>
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      name="job-line-estimated-hours"
                      value={editingJobLineForm.estimated_hours}
                      onChange={e => setEditingJobLineForm(f => ({ ...f, estimated_hours: e.target.value }))}
                      style={{ ...inputStyle, fontSize: 13, width: '100%', marginBottom: estHoursInvalid ? 4 : 10, borderColor: estHoursInvalid ? RED : undefined }}
                    />
                    {estHoursInvalid && (
                      <div style={{ fontSize: 11, color: RED, marginBottom: 10 }}>Enter a non-negative number (e.g. 1.5).</div>
                    )}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => { setEditingJobLineId(null); setEditingJobLineForm({ description: '', tire_positions: [], estimated_hours: '' }) }}
                        disabled={savingJobLineEdit}
                        style={{ ...btnStyle('transparent', GRAY), padding: '6px 12px', fontSize: 12, border: `1px solid ${'var(--tz-border)'}` }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          if (savingJobLineEdit) return
                          if (estHoursInvalid) return
                          setSavingJobLineEdit(true)
                          try {
                            const newDesc = draftDesc.trim()
                            const willBeTire = isTireRelatedDescription(newDesc)
                            const trimmedPositions = editingJobLineForm.tire_positions.map(p => p.trim()).filter(Boolean)
                            const newPos: string | null = willBeTire
                              ? (trimmedPositions.length > 0 ? trimmedPositions.join(', ') : null)
                              : null
                            const updates: Record<string, unknown> = {}
                            if (newDesc !== (line.description || '')) updates.description = newDesc
                            if ((newPos || '') !== (line.tire_position || '')) updates.tire_position = newPos
                            const oldHours = line.estimated_hours == null ? null : Number(line.estimated_hours)
                            if (estHoursNum !== oldHours) updates.estimated_hours = estHoursNum

                            const descriptionChanged = newDesc !== (line.description || '')

                            // Generalized parts-truth sync: when the description
                            // changes, the deterministic auto-rough-parts set
                            // shifts. Linked rough children whose name no longer
                            // appears in the new suggestion set are obsolete and
                            // should leave parts truth (hard delete, not just a
                            // canceled-noise row). Children with downstream
                            // activity (real_name, part_number, prices, manual
                            // parts_requirement) stay — surface a non-blocking
                            // toast asking the writer to review them.
                            const linkedActive = (wo?.so_lines || []).filter((p: any) =>
                              p.line_type === 'part' &&
                              p.related_labor_line_id === line.id &&
                              p.parts_status !== 'canceled'
                            )
                            // Workflow + manual-decision check only. Inventory
                            // suggestion fields (real_name / part_number /
                            // parts_cost_price / parts_sell_price) are auto-
                            // populated at rough creation by workOrderCreation
                            // and addJob whenever the shop has a matching part
                            // in inventory — they are NOT proof the writer
                            // touched the row. Treating them as "activity"
                            // (the prior predicate's mistake) caused obsolete
                            // tire roughs to survive a tire→bumper edit
                            // whenever the shop stocked tires. The row is
                            // safe to auto-remove iff:
                            //   1) parts_status is still rough/requested
                            //      (canceled is already filtered upstream),
                            //   2) no explicit parts_requirement decision was
                            //      recorded by the writer (customer_supplied,
                            //      not_needed, override, or writer-typed
                            //      'needed').
                            const ROUGH_STATUSES = new Set(['', 'rough', 'requested'])
                            const isSafeAutoRemove = (p: any): boolean => {
                              const status = String(p.parts_status || '').toLowerCase()
                              if (!ROUGH_STATUSES.has(status)) return false
                              if (p.parts_requirement) return false
                              return true
                            }
                            const newSuggestions = descriptionChanged
                              ? getAutoRoughParts(newDesc).filter(s => !s.is_labor)
                              : []
                            const newSuggestionNamesLower = new Set(
                              newSuggestions
                                .map(s => String(s.rough_name || '').trim().toLowerCase())
                                .filter(Boolean)
                            )
                            const obsoleteAll = descriptionChanged
                              ? linkedActive.filter((p: any) => {
                                  const name = String(p.rough_name || p.description || '').trim().toLowerCase()
                                  return !!name && !newSuggestionNamesLower.has(name)
                                })
                              : []
                            const obsoleteSafeToDelete = obsoleteAll.filter(isSafeAutoRemove)
                            const obsoleteUnsafe = obsoleteAll.filter((p: any) => !isSafeAutoRemove(p))
                            // Survivors after delete — used to dedupe new
                            // suggestion creation so we don't re-insert a part
                            // the writer has already kept on the line.
                            const obsoleteSafeIds = new Set(obsoleteSafeToDelete.map((p: any) => p.id))
                            const survivorNamesLower = new Set(
                              linkedActive
                                .filter((p: any) => !obsoleteSafeIds.has(p.id))
                                .map((p: any) => String(p.rough_name || p.real_name || p.description || '').trim().toLowerCase())
                                .filter(Boolean)
                            )
                            const partsToCreate = newSuggestions.filter(s => {
                              const name = String(s.rough_name || '').trim().toLowerCase()
                              return !!name && !survivorNamesLower.has(name)
                            })

                            // Phase 1: labor PATCH + safe-obsolete DELETE in
                            // parallel. Each so_lines DELETE sub-request returns
                            // 200/204; PATCH may return 409 on stale OCC.
                            const ops: Array<Promise<Response>> = []
                            if (Object.keys(updates).length > 0) {
                              ops.push(fetch(`/api/so-lines/${line.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ ...updates, expected_updated_at: line.updated_at }),
                              }))
                            }
                            for (const p of obsoleteSafeToDelete) {
                              ops.push(fetch(`/api/so-lines/${p.id}`, { method: 'DELETE' }))
                            }

                            let phase1Conflict = false
                            // Tracked so the Activity Log entries reflect what
                            // actually happened, not what was attempted. A
                            // silently-failed DELETE (rare — see safety filter
                            // already restricts this set) shouldn't be logged
                            // as removed.
                            let deletedCount = 0
                            if (ops.length > 0) {
                              const responses = await Promise.all(ops)
                              if (responses.some(r => r.status === 409)) {
                                phase1Conflict = true
                                setToastMsg('This record was updated by someone else. Refresh and try again.')
                                setTimeout(() => setToastMsg(''), 4000)
                              } else {
                                // ops layout: [labor PATCH (if any updates), …obsolete DELETEs].
                                const deleteOffset = Object.keys(updates).length > 0 ? 1 : 0
                                for (let i = deleteOffset; i < responses.length; i++) {
                                  if (responses[i].ok) deletedCount++
                                }
                              }
                            }

                            // Phase 2: insert replacement rough parts. Run
                            // sequentially after Phase 1 so we never insert
                            // duplicates of a row that's still in the process
                            // of being deleted. Skip on Phase 1 conflict.
                            let createdCount = 0
                            if (!phase1Conflict && partsToCreate.length > 0) {
                              for (const s of partsToCreate) {
                                const partName = String(s.rough_name || '').trim()
                                if (!partName) continue
                                const res = await fetch('/api/so-lines', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    so_id: id,
                                    line_type: 'part',
                                    description: partName,
                                    rough_name: partName,
                                    quantity: s.quantity || 1,
                                    parts_status: 'rough',
                                    related_labor_line_id: line.id,
                                  }),
                                })
                                if (res.ok) createdCount++
                              }
                            }

                            // Phase 3: refresh estimate snapshot (no-op when
                            // estimate is approved/locked) and reload WO.
                            const anyMutation = ops.length > 0 || partsToCreate.length > 0
                            if (anyMutation && !phase1Conflict) {
                              await refreshOpenEstimateIfAny()
                            }
                            if (anyMutation) {
                              await loadData()
                            }

                            // Activity Log — emit only on success (no Phase 1
                            // conflict). Truthful counts: only fields that
                            // actually changed and only mutations that actually
                            // succeeded show up. Fire-and-forget via the same
                            // page-local helper used by the rest of the WO
                            // detail page, so one user action becomes at most
                            // three concise entries (labor edit / removed /
                            // created) and zero on a no-op or conflict.
                            if (!phase1Conflict) {
                              const fmtHours = (n: number | null): string => (n == null ? '—' : String(n))
                              const oldDescOrig = line.description || ''
                              const oldPosOrig = line.tire_position || ''
                              const newPosOrig = newPos || ''
                              const laborChanges: string[] = []
                              if (descriptionChanged) laborChanges.push(`"${oldDescOrig}" → "${newDesc}"`)
                              if (estHoursNum !== oldHours) laborChanges.push(`est hrs ${fmtHours(oldHours)} → ${fmtHours(estHoursNum)}`)
                              if (newPosOrig !== oldPosOrig) {
                                const before = oldPosOrig ? `"${oldPosOrig}"` : 'cleared'
                                const after = newPosOrig ? `"${newPosOrig}"` : 'cleared'
                                laborChanges.push(`tire position ${before} → ${after}`)
                              }
                              if (laborChanges.length > 0) {
                                logActivity(`Edited job line: ${laborChanges.join('; ')}`)
                              }
                              if (deletedCount > 0) {
                                logActivity(`Auto-removed ${deletedCount} rough part${deletedCount > 1 ? 's' : ''} no longer needed for the edited job`)
                              }
                              if (createdCount > 0) {
                                logActivity(`Auto-created ${createdCount} rough part suggestion${createdCount > 1 ? 's' : ''} for the edited job`)
                              }
                            }

                            // Toast the unsafe obsolete parts the writer must
                            // resolve manually. Keeps the older tire-specific
                            // banner copy for transitioningOff, otherwise
                            // generic.
                            if (obsoleteUnsafe.length > 0) {
                              const noun = obsoleteUnsafe.length === 1 ? 'part has' : 'parts have'
                              const tireScoped = transitioningOff && obsoleteUnsafe.every((p: any) => isTireRelatedDescription(p.rough_name || p.description || ''))
                              setToastMsg(tireScoped
                                ? `${obsoleteUnsafe.length} tire ${noun} activity — review the Parts tab to clean up manually.`
                                : `${obsoleteUnsafe.length} linked ${noun} activity — review the Parts tab to clean up manually.`)
                              setTimeout(() => setToastMsg(''), 5000)
                            }

                            setEditingJobLineId(null)
                            setEditingJobLineForm({ description: '', tire_positions: [], estimated_hours: '' })
                          } finally {
                            setSavingJobLineEdit(false)
                          }
                        }}
                        disabled={savingJobLineEdit || estHoursInvalid}
                        style={{ ...btnStyle(BLUE, 'var(--tz-bgLight)'), padding: '6px 12px', fontSize: 12, opacity: (savingJobLineEdit || estHoursInvalid) ? 0.5 : 1, cursor: (savingJobLineEdit || estHoursInvalid) ? 'not-allowed' : 'pointer' }}
                      >
                        {savingJobLineEdit ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                  )
                })()}
                {/* Two-column body (jobline redesign):
                    Left = full numbered complaint list (every item visible —
                    no truncation, no "+N more"). Right = three small summary
                    cards for Estimated / Actual / Billed hours. Source fields
                    are unchanged from the prior layout. */}
                {(() => {
                  const actualHours = line.actual_hours || (line.labor_minutes ? line.labor_minutes / 60 : 0)
                  const estimatedHours = line.estimated_hours || 0
                  const billedHours = line.billed_hours || 0
                  const summaryCards: Array<{ label: string; value: number; Icon: typeof Clock; tint: string; iconColor: string }> = [
                    { label: 'Estimated', value: estimatedHours, Icon: Clock, tint: 'var(--tz-warningBg)', iconColor: AMBER },
                    { label: 'Actual', value: Math.round(actualHours * 100) / 100, Icon: TrendingUp, tint: 'var(--tz-successBg)', iconColor: GREEN },
                    { label: 'Billed', value: billedHours, Icon: FileText, tint: 'var(--tz-accentBg)', iconColor: BLUE },
                  ]
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 12, marginBottom: 12, alignItems: 'start' }}>
                      <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 10 }}>
                        {concernItems.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {concernItems.map((c, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', borderTop: i === 0 ? 'none' : `1px solid ${'var(--tz-border)'}` }}>
                                <span style={{ width: 22, height: 22, borderRadius: 5, background: 'var(--tz-bgHover)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: 'var(--tz-textSecondary)', flexShrink: 0 }}>{i + 1}</span>
                                <span style={{ fontSize: 13, color: 'var(--tz-text)', lineHeight: 1.4 }}>{c}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ padding: '12px 14px', fontSize: 13, color: GRAY, fontStyle: 'italic' }}>{wo.is_historical ? 'No work description' : 'No complaints yet'}</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {summaryCards.map(({ label, value, Icon, tint, iconColor }) => (
                          <div key={label} style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 7, background: tint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Icon size={14} color={iconColor} />
                            </div>
                            <span style={{ flex: 1, fontSize: 13, color: 'var(--tz-textSecondary)' }}>{label}</span>
                            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--tz-text)' }}>{value || 0}h</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* Approval-required banner (jobline redesign).
                    Same condition as the prior assignment-row italic span;
                    no logic change, no new derivation. */}
                {!wo.is_historical && !isViewOnly && isWaitingOrDeclined && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'var(--tz-warningBg)', color: AMBER, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
                    <ShieldCheck size={15} />
                    <span>Approval required before assignment.</span>
                  </div>
                )}

                {/* Mechanic Notes — compact row (jobline redesign).
                    All notes still rendered (no truncation, no "+N more").
                    Note data + write flow are unchanged. */}
                {(() => {
                  const notes: any[] = Array.isArray(line.mechanic_notes) ? line.mechanic_notes : []
                  return (
                    <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <MessageSquare size={15} color={GRAY} style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tz-text)', flexShrink: 0 }}>Notes</span>
                      <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--tz-textSecondary)', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {notes.length === 0 ? (
                          <span style={{ fontSize: 13, color: 'var(--tz-textSecondary)' }}>No notes yet</span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {notes.map((n: any, ni: number) => (
                              <div key={ni} style={{ fontSize: 13, color: 'var(--tz-text)', lineHeight: 1.4 }}>
                                <span>{n.text || n.note || String(n)}</span>
                                {n.created_at && <span style={{ fontSize: 11, color: GRAY, marginLeft: 6 }}>· {new Date(n.created_at).toLocaleString()}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <ChevronRight size={15} color={GRAY} style={{ flexShrink: 0 }} />
                    </div>
                  )
                })()}

                {/* Actions — bottom action row (jobline redesign).
                    Handlers unchanged; visual layout only. */}
                {!wo.is_historical && !isViewOnly && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center', borderTop: `1px solid ${'var(--tz-border)'}`, marginTop: 4 }}>
                    <button onClick={() => {
                      setNewPartForms(prev => ({ ...prev, [line.id]: prev[line.id] || { desc: '', pn: '', qty: '', cost: '' } }))
                    }} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-start', gap: 8, padding: '12px 4px', fontSize: 13, fontWeight: 700, fontFamily: FONT, cursor: 'pointer', background: 'transparent', color: BLUE, border: 'none' }}>
                      <Plus size={15} /> Add Parts
                    </button>
                    <button onClick={() => setHoursModal({ id: line.id, estimated_hours: line.estimated_hours || '', actual_hours: line.actual_hours || '', billed_hours: line.billed_hours || '' })} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 4px', fontSize: 13, fontWeight: 700, fontFamily: FONT, cursor: 'pointer', background: 'transparent', color: 'var(--tz-textSecondary)', border: 'none', borderLeft: `1px solid ${'var(--tz-border)'}`, borderRight: `1px solid ${'var(--tz-border)'}` }}>
                      <Clock size={15} /> Log Hours
                    </button>
                    <button onClick={() => removeJobLine(line.id)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '12px 4px', fontSize: 13, fontWeight: 700, fontFamily: FONT, cursor: 'pointer', background: 'transparent', color: RED, border: 'none' }}>
                      <Trash2 size={15} /> Remove Job
                    </button>
                  </div>
                )}

                {/* Inline add part form */}
                {newPartForms[line.id] && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: 2, minWidth: 120 }}>
                      <span style={labelStyle}>Description</span>
                      <input value={newPartForms[line.id].desc} onChange={e => setNewPartForms(p => ({ ...p, [line.id]: { ...p[line.id], desc: e.target.value } }))} style={inputStyle} placeholder="Part description" />
                    </div>
                    <div style={{ flex: 1, minWidth: 80 }}>
                      <span style={labelStyle}>Part #</span>
                      <input value={newPartForms[line.id].pn} onChange={e => setNewPartForms(p => ({ ...p, [line.id]: { ...p[line.id], pn: e.target.value } }))} style={inputStyle} placeholder="PN" />
                    </div>
                    <div style={{ width: 60 }}>
                      <span style={labelStyle}>Qty</span>
                      <input value={newPartForms[line.id].qty} onChange={e => setNewPartForms(p => ({ ...p, [line.id]: { ...p[line.id], qty: e.target.value } }))} style={inputStyle} placeholder="1" type="number" />
                    </div>
                    <div style={{ width: 80 }}>
                      <span style={labelStyle}>Cost</span>
                      <input value={newPartForms[line.id].cost} onChange={e => setNewPartForms(p => ({ ...p, [line.id]: { ...p[line.id], cost: e.target.value } }))} style={inputStyle} placeholder="0.00" type="number" step="0.01" />
                    </div>
                    <button onClick={() => addPart(line.id)} style={btnStyle(BLUE, 'var(--tz-bgLight)')}>Add</button>
                    <button onClick={() => setNewPartForms(p => { const n = { ...p }; delete n[line.id]; return n })} style={btnStyle( 'var(--tz-bgLight)', GRAY)}>Cancel</button>
                  </div>
                )}

                {/* Secondary working sections (correction patch).
                    Restored from the base commit verbatim — handlers,
                    conditions, and behavior unchanged. Placed below the
                    main approved design so they don't dominate the card. */}
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${'var(--tz-border)'}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {/* Editable line_status control (expanded only). For waiting/declined
                    lines the dropdown is suppressed — read-only approval state
                    lives in the header pill (packet-1). */}
                {!isWaitingOrDeclined && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                    {wo.is_historical ? (
                      <span style={pillStyle(st.bg, st.color)}>{st.label}</span>
                    ) : (
                      <select
                        value={line.line_status || 'unassigned'}
                        onChange={e => patchLine(line.id, { line_status: e.target.value })}
                        style={{ ...inputStyle, width: 'auto', padding: '4px 8px', fontSize: 11, fontWeight: 700, background: st.bg, color: st.color, border: 'none', borderRadius: 100 }}
                      >
                        {Object.entries(LINE_STATUS).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* Pre-Approval Toggle */}
                {editMode && !wo.is_historical && !isViewOnly && (line.approval_status === 'pre_approved' || line.approval_status === 'needs_approval' || !line.approval_status) && (
                  <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                    <button onClick={() => toggleApproval(line.id, false)} style={{ padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, background: !line.approval_required ? 'rgba(22,163,74,0.1)' : 'transparent', color: !line.approval_required ? GREEN : GRAY, border: !line.approval_required ? `1px solid ${GREEN}40` : `1px solid ${'var(--tz-border)'}` }}>Pre-Approved</button>
                    <button onClick={() => toggleApproval(line.id, true)} style={{ padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, background: line.approval_required ? 'rgba(217,150,11,0.1)' : 'transparent', color: line.approval_required ? AMBER : GRAY, border: line.approval_required ? `1px solid ${AMBER}40` : `1px solid ${'var(--tz-border)'}` }}>Needs Approval</button>
                  </div>
                )}

                {/* Approval actions (when needs approval) */}
                {!wo.is_historical && !isViewOnly && line.approval_status === 'needs_approval' && !wo.estimate_required && (
                  <div style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 11 }}>
                    <div style={{ color: AMBER, fontWeight: 600, marginBottom: 6 }}>Waiting for customer approval</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input value={approvalNotes} onChange={e => setApprovalNotes(e.target.value)} placeholder="Notes..." style={{ ...inputStyle, flex: 1, padding: '4px 8px', fontSize: 11 }} />
                      <button onClick={() => approveJob(line.id)} style={btnStyle('var(--tz-successBg)', GREEN)}>Approve</button>
                      <button onClick={() => declineJob(line.id)} style={btnStyle('var(--tz-dangerBg)', RED)}>Decline</button>
                    </div>
                  </div>
                )}

                {/* Assignment row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: GRAY }}>ASSIGNED:</span>
                  {lineAssignments.length > 0 ? (
                    lineAssignments.map((a: any) => (
                      <span key={a.id} style={pillStyle('var(--tz-accentBg)', BLUE)}>
                        {a.users?.full_name || 'Unknown'} ({a.percentage}%)
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: 12, color: GRAY, fontStyle: 'italic' }}>Unassigned</span>
                  )}
                  {!wo.is_historical && !isViewOnly && !isWaitingOrDeclined && (
                    <button onClick={() => {
                      const bypassJobTypes = ['diagnostic', 'full_inspection']
                      if (wo.estimate_required && !wo.estimate_approved && !bypassJobTypes.includes(wo.job_type)) {
                        alert('Estimate must be approved before this work order can be assigned. Go to the Estimate tab to build and send the estimate.')
                        return
                      }
                      openAssignModal(line.id, idx)
                    }} style={{ ...btnStyle( 'var(--tz-bgLight)', BLUE), padding: '4px 10px', fontSize: 11 }}>
                      <Users size={12} /> Assign
                    </button>
                  )}
                </div>

                </div>
                </>
                )}
              </div>
            )
          })}

          {/* Add Job Line */}
          {!wo.is_historical && !isViewOnly && (
            <div>
              <div style={{ ...cardStyle, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', borderColor: (newJobText.trim().length >= 2 && isUnrecognizedJob(newJobText)) ? 'var(--tz-danger)' : undefined }}>
                <button onClick={() => setUseAI(!useAI)} style={{ ...pillStyle(useAI ? 'var(--tz-accentBg)' : 'var(--tz-surfaceMuted)', useAI ? BLUE : GRAY), cursor: 'pointer', border: 'none', fontFamily: FONT }}>
                  <Mic size={11} /> AI {useAI ? 'ON' : 'OFF'}
                </button>
                <input
                  value={newJobText}
                  onChange={e => { setNewJobText(e.target.value); setJobWarning('') }}
                  onKeyDown={e => e.key === 'Enter' && addJobLine()}
                  placeholder={newJobText.trim().length >= 2 && isUnrecognizedJob(newJobText) ? 'What did you mean? Use repair terms like: oil change, brake, pm service...' : 'Describe the job concern...'}
                  style={{ ...inputStyle, flex: 1, minWidth: 200, borderColor: (newJobText.trim().length >= 2 && isUnrecognizedJob(newJobText)) ? 'var(--tz-danger)' : undefined }}
                />
                <button onClick={addJobLine} disabled={addingJob || !newJobText.trim()} style={{ ...btnStyle(BLUE, 'var(--tz-bgLight)'), opacity: addingJob || !newJobText.trim() ? 0.5 : 1 }}>
                  <Plus size={14} /> {addingJob ? 'Adding...' : 'Add Job Line'}
                </button>
              </div>
              {newJobText.trim().length >= 2 && isUnrecognizedJob(newJobText) && (
                <div style={{ fontSize: 11, color: RED, fontWeight: 600, marginTop: 4, padding: '0 4px' }}>
                  Unrecognized job — use repair terms like: oil change, brake repair, pm service, tire replacement, alternator, etc.
                </div>
              )}
              {jobWarning && (
                <div style={{ fontSize: 11, color: RED, fontWeight: 600, marginTop: 4, padding: '4px 8px', background: 'var(--tz-dangerBg)', borderRadius: 6, border: `1px solid ${'var(--tz-danger)'}` }}>
                  {jobWarning}
                </div>
              )}
              {newJobText.trim().length >= 2 && !isUnrecognizedJob(newJobText) && !isDiagnosticJob(newJobText) && getAutoRoughParts(newJobText).filter(p => !p.is_labor).length > 0 && (
                <div style={{ fontSize: 11, color: BLUE, marginTop: 4, padding: '0 4px' }}>
                  Will suggest parts: {getAutoRoughParts(newJobText).filter(p => !p.is_labor).map(p => p.rough_name).join(', ')}
                </div>
              )}
            </div>
          )}

          {/* Add Shop Charge */}
          {!wo.is_historical && !isViewOnly && (
            <div style={{ ...cardStyle, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: GRAY }}>Shop Charge:</span>
              <input value={newChargeDesc} onChange={e => setNewChargeDesc(e.target.value)} placeholder="Description" style={{ ...inputStyle, flex: 1, minWidth: 150 }} />
              <input value={newChargeAmt} onChange={e => setNewChargeAmt(e.target.value)} placeholder="Amount" type="number" step="0.01" style={{ ...inputStyle, width: 100 }} />
              <button onClick={addShopCharge} disabled={!newChargeDesc.trim() || !newChargeAmt} style={{ ...btnStyle(GREEN, 'var(--tz-bgLight)'), opacity: !newChargeDesc.trim() || !newChargeAmt ? 0.5 : 1 }}>
                <Plus size={14} /> Add Charge
              </button>
            </div>
          )}

          {/* Shop Charges list */}
          {shopCharges.length > 0 && (
            <div style={cardStyle}>
              <span style={{ ...labelStyle, marginBottom: 8 }}>Shop Charges</span>
              {shopCharges.map((c: any) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: `1px solid ${'var(--tz-border)'}`, fontSize: 13 }}>
                  <span style={{ flex: 1 }}>{c.description}</span>
                  <span style={{ fontWeight: 700 }}>{fmt(c.amount)}</span>
                  <button onClick={() => removeCharge(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: RED }}><X size={14} /></button>
                </div>
              ))}
            </div>
          )}

          {/* Get Approval — only show when estimate required and NOT yet approved.
              Suppressed for unreviewed customer intake (no real estimate yet). */}
          {!wo.is_historical && !isUnreviewedIntake && wo.estimate_required && !wo.estimate_approved && (
            <div style={{ textAlign: 'right', marginTop: 8 }}>
              <button onClick={() => setApprovalModal({ kind: 'estimate_1' })} style={btnStyle(BLUE, 'var(--tz-bgLight)')}>
                <DollarSign size={14} /> Get Approval
              </button>
            </div>
          )}
        </div>
        </JobsTab>
      )}

      {/* ========== TAB 1: PARTS & MATERIALS ========== */}
      {tab === 1 && (
        <PartsTab>
        <div>
          {/* Parts workspace */}
          {/* Historical empty state — pick the right source for "is empty":
              snapshot-based when snapshot present, flat partLines fallback
              otherwise. */}
          {wo.is_historical && historicalSnapshot && snapshotParts.length === 0 && partLines.length === 0 && (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 30 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: GRAY }}>No parts recorded</div>
              <div style={{ fontSize: 12, color: GRAY }}>This imported historical work order has no part line items.</div>
            </div>
          )}
          {wo.is_historical && !historicalSnapshot && partLines.length === 0 && (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 30 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: GRAY }}>No parts recorded</div>
              <div style={{ fontSize: 12, color: GRAY }}>This imported historical work order has no part line items.</div>
            </div>
          )}
          {partLines.length === 0 && !partsLocked && !wo.is_historical && !isViewOnly && (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 30 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: GRAY }}>No parts on this work order</div>
              <button onClick={() => setAddPartModal({ open: true, name: '', saving: false })} style={{ ...btnStyle(BLUE, 'var(--tz-bgLight)'), padding: '8px 20px' }}>
                + Add Part
              </button>
            </div>
          )}
          {/* Historical Imported Parts — snapshot path. Source-grouped truth
              from external_data.historical_fullbay_snapshot. Selling price
              and totals come straight from Fullbay (no markup math). */}
          {wo.is_historical && historicalSnapshot && snapshotParts.length > 0 && partLines.length === 0 && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tz-text)' }}>Imported Parts</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: GRAY, padding: '2px 8px', borderRadius: 100, background: 'var(--tz-bgHover)' }}>read-only</span>
                <span style={{ fontSize: 11, color: GRAY, marginLeft: 'auto' }}>{snapshotParts.length} {snapshotParts.length === 1 ? 'item' : 'items'}</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${'var(--tz-border)'}` }}>
                    <th style={{ fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', padding: '6px 8px' }}>Description</th>
                    <th style={{ fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', padding: '6px 8px', width: 120 }}>Part #</th>
                    <th style={{ fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', padding: '6px 8px', width: 50 }}>Qty</th>
                    <th style={{ fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', padding: '6px 8px', width: 90 }}>Unit Price</th>
                    <th style={{ fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', padding: '6px 8px', width: 100 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshotParts.map((p: any, i: number) => {
                    const desc = p.description || '—'
                    const partNum = p.shop_part_number || p.vendor_part_number || '—'
                    const qty = Number(p.quantity) || 1
                    const unit = Number(p.selling_price) || 0
                    const total = +(qty * unit).toFixed(2)
                    return (
                      <tr key={i} style={{ borderBottom: `1px solid ${'var(--tz-border)'}` }}>
                        <td style={{ padding: '6px 8px' }}>{desc}</td>
                        <td style={{ padding: '6px 8px', color: GRAY }}>{partNum}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>{qty}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(unit)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{fmt(total)}</td>
                      </tr>
                    )
                  })}
                  <tr style={{ fontWeight: 700 }}>
                    <td colSpan={4} style={{ padding: '8px 8px', textAlign: 'right' }}>Parts Total</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmt(Number(snapshotTotals?.parts_total) || 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          {/* Historical Imported Parts — flat fallback when no snapshot. */}
          {wo.is_historical && partLines.length > 0 && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tz-text)' }}>Imported Parts</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: GRAY, padding: '2px 8px', borderRadius: 100, background: 'var(--tz-bgHover)' }}>read-only</span>
                <span style={{ fontSize: 11, color: GRAY, marginLeft: 'auto' }}>{partLines.length} {partLines.length === 1 ? 'item' : 'items'}</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${'var(--tz-border)'}` }}>
                    <th style={{ fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', padding: '6px 8px' }}>Description</th>
                    <th style={{ fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', padding: '6px 8px', width: 120 }}>Part #</th>
                    <th style={{ fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', padding: '6px 8px', width: 50 }}>Qty</th>
                    <th style={{ fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', padding: '6px 8px', width: 90 }}>Unit Price</th>
                    <th style={{ fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', padding: '6px 8px', width: 100 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {partLines.map((p: any) => {
                    const desc = p.description || p.real_name || p.rough_name || '—'
                    const unit = Number(p.parts_sell_price || p.unit_price || 0) || 0
                    const qty = Number(p.quantity || 1) || 1
                    const total = Number(p.total_price || qty * unit) || 0
                    return (
                      <tr key={p.id} style={{ borderBottom: `1px solid ${'var(--tz-border)'}` }}>
                        <td style={{ padding: '6px 8px' }}>{desc}</td>
                        <td style={{ padding: '6px 8px', color: GRAY }}>{p.part_number || '—'}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>{qty}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(unit)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{fmt(total)}</td>
                      </tr>
                    )
                  })}
                  <tr style={{ fontWeight: 700 }}>
                    <td colSpan={4} style={{ padding: '8px 8px', textAlign: 'right' }}>Parts Total</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmt(partsLineTotal || 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          {!wo.is_historical && partLines.length > 0 && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Parts ({partLines.length})</div>
                {!partsLocked && !wo.is_historical && !isViewOnly && (
                  <button onClick={() => setAddPartModal({ open: true, name: '', saving: false })} style={{ ...btnStyle(BLUE, 'var(--tz-bgLight)'), padding: '5px 12px', fontSize: 11 }}>
                    + Add Part
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {partLines.map((p: any) => {
                  const partsEditable = !partsLocked && p.parts_status !== 'canceled'
                  const isConfirmed = p.parts_status && !['rough'].includes(p.parts_status)
                  const statusColors: Record<string, { label: string; bg: string; color: string }> = {
                    rough: { label: 'Requested', bg: 'var(--tz-warningBg)', color: 'var(--tz-warning)' },
                    sourced: { label: 'Confirmed', bg: 'var(--tz-accentBg)', color: BLUE },
                    ordered: { label: 'Ordered', bg: 'var(--tz-warningBg)', color: AMBER },
                    received: { label: 'Preparing', bg: 'var(--tz-accentBg)', color: BLUE },
                    ready_for_job: { label: 'Ready for Pickup', bg: 'var(--tz-successBg)', color: GREEN },
                    picked_up: { label: 'Picked Up', bg: 'var(--tz-successBg)', color: GREEN },
                    installed: { label: 'Installed', bg: 'var(--tz-successBg)', color: 'var(--tz-success)' },
                    canceled: { label: 'Canceled', bg: 'var(--tz-dangerBg)', color: 'var(--tz-danger)' },
                  }
                  const st = statusColors[p.parts_status || 'rough'] || statusColors.rough
                  return (
                    <div key={p.id} style={{ border: `1px solid ${isConfirmed ? 'var(--tz-successBg)' : 'var(--tz-warning)'}`, borderRadius: 10, padding: 12, background: isConfirmed ? 'var(--tz-successBg)' : 'var(--tz-warningBg)' }}>
                      {/* Request layer — always visible */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div style={{ fontSize: 11, color: 'var(--tz-warning)' }}>
                          Request: <strong style={{ color: 'var(--tz-warning)' }}>{p.rough_name || p.description || '—'}</strong>
                        </div>
                        <span style={pillStyle(st.bg, st.color)}>{st.label}</span>
                        {!wo.is_historical && !partsLocked && !isMechanic && p.parts_status !== 'canceled' && !['ready_for_job', 'picked_up', 'installed'].includes(p.parts_status) && (
                          <div style={{ display: 'flex', gap: 4, marginLeft: 6 }}>
                            {p.parts_status !== 'received' && <button onClick={async () => { await patchLine(p.id, { parts_status: 'received' }) }} style={{ padding: '2px 8px', borderRadius: 4, border: `1px solid ${BLUE}44`, background: `${BLUE}0A`, color: BLUE, fontSize: 9, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>Preparing</button>}
                            <button onClick={async () => { await patchLine(p.id, { parts_status: 'ready_for_job' }) }} style={{ padding: '2px 8px', borderRadius: 4, border: `1px solid ${GREEN}44`, background: `${GREEN}0A`, color: GREEN, fontSize: 9, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>Ready for Pickup</button>
                            {p.parts_status !== 'ordered' && <button onClick={async () => { await patchLine(p.id, { parts_status: 'ordered' }) }} style={{ padding: '2px 8px', borderRadius: 4, border: `1px solid ${AMBER}44`, background: `${AMBER}0A`, color: AMBER, fontSize: 9, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>Ordered</button>}
                            <button onClick={() => setPartNoteOpen(partNoteOpen === p.id ? null : p.id)} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(107,114,128,.3)', background: 'transparent', color: GRAY, fontSize: 9, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>Note</button>
                          </div>
                        )}
                        {!wo.is_historical && !partsLocked && !isMechanic && p.parts_status === 'ready_for_job' && (
                          <button onClick={async () => { await patchLine(p.id, { parts_status: 'received' }) }} style={{ padding: '2px 8px', borderRadius: 4, border: `1px solid ${BLUE}44`, background: `${BLUE}0A`, color: BLUE, fontSize: 9, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, marginLeft: 6 }}>Back to Preparing</button>
                        )}
                      </div>

                      {/* Part ownership — Shop supplied / Customer supplied / No part needed.
                          This is the row-level truth the approval gate reads. Shop-supplied
                          requires a sell price > 0 (set via the Sell field below); the other
                          two require a note. */}
                      {!wo.is_historical && !partsLocked && !isMechanic && p.parts_status !== 'canceled' && (() => {
                        const pReq = p.parts_requirement
                        const pNote = p.parts_requirement_note
                        async function setPartReq(next: 'needed' | 'customer_supplied' | 'not_needed') {
                          // Confirmation-only flow — no free-text input required. The
                          // approval gate still needs a note to satisfy API validation,
                          // so we persist a deterministic default. Writers can edit the
                          // note later via a future inline edit if ever needed.
                          let noteVal: string | null = null
                          if (next === 'customer_supplied' || next === 'not_needed') {
                            const ok = window.confirm(PARTS_REQUIREMENT_CONFIRM_COPY[next])
                            if (!ok) return
                            noteVal = PARTS_REQUIREMENT_DEFAULT_NOTES[next]
                          }
                          await patchLine(p.id, { parts_requirement: next, parts_requirement_note: noteVal })
                          await loadData()
                        }
                        const chip = (label: string, value: 'needed' | 'customer_supplied' | 'not_needed', bg: string, color: string) => (
                          <button
                            key={label}
                            onClick={() => setPartReq(value)}
                            style={{
                              padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, fontFamily: FONT, cursor: 'pointer',
                              background: pReq === value || (value === 'needed' && (!pReq || pReq === 'needed')) ? bg : 'transparent',
                              color: pReq === value || (value === 'needed' && (!pReq || pReq === 'needed')) ? color : GRAY,
                              border: pReq === value || (value === 'needed' && (!pReq || pReq === 'needed')) ? `1px solid ${color}` : `1px solid ${'var(--tz-border)'}`,
                            }}>{label}</button>
                        )
                        return (
                          <div style={{ display: 'flex', gap: 6, marginTop: 6, marginBottom: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: GRAY }}>Part source</span>
                            {chip('Shop', 'needed', 'var(--tz-accentBg)', BLUE)}
                            {chip('Customer', 'customer_supplied', 'var(--tz-warningBg)', AMBER)}
                            {chip('None', 'not_needed', 'var(--tz-successBg)', GREEN)}
                            {(pReq === 'customer_supplied' || pReq === 'not_needed') && pNote && (
                              <span style={{ fontSize: 11, color: GRAY, fontStyle: 'italic' }} title={pNote}>
                                &ldquo;{pNote.length > 40 ? pNote.slice(0, 40) + '…' : pNote}&rdquo;
                              </span>
                            )}
                          </div>
                        )
                      })()}

                      {/* Confirmed layer — shown when real_name exists */}
                      {p.real_name && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, padding: '4px 0' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tz-text)' }}>{p.real_name}{p.part_number ? ` (${p.part_number})` : ''}</span>
                          {!isConfirmed && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'var(--tz-warningBg)', color: 'var(--tz-warning)', fontWeight: 600 }}>Auto-matched — needs Parts confirmation</span>}
                        </div>
                      )}

                      {/* Part note input */}
                      {partNoteOpen === p.id && (
                        <div style={{ display: 'flex', gap: 6, marginTop: 6, marginBottom: 6 }}>
                          <input id={`part-note-${p.id}`} defaultValue={p.finding || ''} placeholder="Add note about this part..." style={{ flex: 1, padding: '6px 10px', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 6, fontSize: 12, fontFamily: FONT, outline: 'none' }} onKeyDown={async e => { if (e.key === 'Enter') { await patchLine(p.id, { finding: (e.target as HTMLInputElement).value }); setPartNoteOpen(null) } }} />
                          <button onClick={async () => { const el = document.getElementById(`part-note-${p.id}`) as HTMLInputElement; if (el) await patchLine(p.id, { finding: el.value }); setPartNoteOpen(null) }} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: BLUE, color: 'var(--tz-bgLight)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>Save</button>
                        </div>
                      )}
                      {p.finding && partNoteOpen !== p.id && <div style={{ fontSize: 11, color: GRAY, marginTop: 2, marginBottom: 4, fontStyle: 'italic' }}>Note: {p.finding}</div>}

                      {/* Non-billable stamp — replaces the editable price row when the writer
                          has resolved the placeholder as customer_supplied or not_needed. Keeps
                          the OWNERSHIP chip row above so the row can be switched back to
                          shop-supplied to re-enter normal billable behaviour. */}
                      {isNonBillablePartRequirementRow(p) && (
                        <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 8, background: isCustomerSuppliedPartRow(p) ? 'var(--tz-warningBg)' : 'var(--tz-successBg)', border: `1px dashed ${isCustomerSuppliedPartRow(p) ? AMBER : GREEN}` }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: isCustomerSuppliedPartRow(p) ? AMBER : GREEN, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>
                            {isCustomerSuppliedPartRow(p) ? 'Customer-supplied part — non-billable' : 'No part needed — non-billable'}
                          </div>
                          {p.parts_requirement_note && (
                            <div style={{ fontSize: 12, color: 'var(--tz-text)', marginBottom: 2 }}>{p.parts_requirement_note}</div>
                          )}
                          {isCustomerSuppliedPartRow(p) && (
                            <div style={{ fontSize: 10, color: GRAY, fontStyle: 'italic' }}>Shop is not responsible for customer-supplied part defects or warranty.</div>
                          )}
                        </div>
                      )}

                      {/* Editable fields for parts dept (rough/sourced state).
                          Hidden when the row is non-billable (customer_supplied / not_needed) —
                          the OWNERSHIP chip is the only control needed on those rows. */}
                      {partsEditable && !wo.is_historical && !isViewOnly && !isNonBillablePartRequirementRow(p) && (
                        <div style={{ position: 'relative' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 8, marginTop: 6 }}>
                            <div style={{ position: 'relative' }}>
                              <span style={labelStyle}>Confirmed Part</span>
                              <input value={p.real_name || ''} onChange={e => { const v = e.target.value; const updated = wo.so_lines.map((l: any) => l.id === p.id ? { ...l, real_name: v } : l); setWo((prev: any) => ({ ...prev, so_lines: updated })); searchInventory(p.id, v) }} onBlur={e => { if (partDropdownClicked.current) { partDropdownClicked.current = false; return } if (e.target.value) { patchLine(p.id, { real_name: e.target.value }) } setTimeout(() => setPartSearchResults(prev => { const n = {...prev}; delete n[p.id]; return n }), 200) }} placeholder="Type to search inventory..." style={inputStyle} />
                              {/* Inventory search dropdown */}
                              {partSearchResults[p.id]?.length > 0 && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 8, marginTop: 2, zIndex: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 160, overflowY: 'auto' }}>
                                  {partSearchResults[p.id].map((inv: any) => (
                                    <div key={inv.id} onMouseDown={() => { partDropdownClicked.current = true; autoFillFromInventory(p.id, inv) }} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: `1px solid ${'var(--tz-border)'}`, fontSize: 12 }}
                                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--tz-bgHover)')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                                      <div style={{ fontWeight: 600, color: 'var(--tz-text)' }}>{inv.description}</div>
                                      <div style={{ fontSize: 10, color: GRAY }}>{inv.part_number || '—'} · Cost: {fmt(inv.cost_price || 0)} · Sell: {fmt(inv.sell_price || 0)} · {inv.on_hand || 0} in stock</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div>
                              <span style={labelStyle}>Part #</span>
                              <input value={p.part_number || ''} onChange={e => { const v = e.target.value; const updated = wo.so_lines.map((l: any) => l.id === p.id ? { ...l, part_number: v } : l); setWo((prev: any) => ({ ...prev, so_lines: updated })); searchInventory(p.id, v) }} onBlur={e => { if (partDropdownClicked.current) return; patchLine(p.id, { part_number: e.target.value }); setTimeout(() => setPartSearchResults(prev => { const n = {...prev}; delete n[p.id]; return n }), 200) }} placeholder="PN" style={inputStyle} />
                            </div>
                            <div>
                              <span style={labelStyle}>Qty</span>
                              <input type="number" value={p.quantity || 1} onChange={e => { const v = parseInt(e.target.value) || 1; const updated = wo.so_lines.map((l: any) => l.id === p.id ? { ...l, quantity: v } : l); setWo((prev: any) => ({ ...prev, so_lines: updated })) }} onBlur={e => patchLine(p.id, { quantity: parseInt(e.target.value) || 1 })} style={inputStyle} />
                            </div>
                            <div>
                              <span style={labelStyle}>Cost</span>
                              <input type="number" step="0.01" value={p.parts_cost_price ?? ''} onChange={e => { const v = e.target.value === '' ? null : parseFloat(e.target.value); const updated = wo.so_lines.map((l: any) => l.id === p.id ? { ...l, parts_cost_price: v } : l); setWo((prev: any) => ({ ...prev, so_lines: updated })) }} onBlur={e => patchLine(p.id, { parts_cost_price: parseFloat(e.target.value) || 0 })} placeholder="0.00" style={inputStyle} />
                            </div>
                            <div>
                              <span style={labelStyle}>Sell</span>
                              <input type="number" step="0.01" value={p.parts_sell_price ?? ''} onChange={e => { const v = e.target.value === '' ? null : parseFloat(e.target.value); const updated = wo.so_lines.map((l: any) => l.id === p.id ? { ...l, parts_sell_price: v } : l); setWo((prev: any) => ({ ...prev, so_lines: updated })) }} onBlur={e => patchLine(p.id, { parts_sell_price: parseFloat(e.target.value) || 0 })} placeholder="0.00" style={inputStyle} />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Delete button for editable parts */}
                      {partsEditable && !wo.is_historical && !isViewOnly && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                          <button onClick={async () => { if (!confirm('Delete this part line?')) return; await fetch(`/api/so-lines/${p.id}`, { method: 'DELETE' }); await refreshOpenEstimateIfAny(); await loadData() }} style={{ background: 'none', border: `1px solid ${RED}33`, borderRadius: 6, color: RED, fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: '4px 10px', fontFamily: FONT }}>
                            Delete Part
                          </button>
                        </div>
                      )}

                      {/* Read-only display for received/installed parts */}
                      {!partsEditable && !wo.is_historical && (
                        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: GRAY, marginTop: 4, flexWrap: 'wrap' }}>
                          {p.part_number && <span>Part #: {p.part_number}</span>}
                          <span>Qty: {p.quantity || 1}</span>
                          {canSeePrices && p.parts_cost_price != null && <span>Cost: {fmt(p.parts_cost_price)}</span>}
                          {canSeePrices && p.parts_sell_price != null && <span>Sell: {fmt(p.parts_sell_price)}</span>}
                          {p.tire_position && <span>Position: {p.tire_position}</span>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Request Part (mechanic) */}
          {!wo.is_historical && !partsLocked && !isMaintenance && (
            <div style={{ ...cardStyle, marginTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Request a Part</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <span style={labelStyle}>What part do you need?</span>
                  <input id="mechPartRequest" placeholder="e.g. Water pump, Radiator hose 2 inch" style={inputStyle} />
                </div>
                <button onClick={async () => {
                  const input = document.getElementById('mechPartRequest') as HTMLInputElement
                  if (!input?.value.trim()) return
                  await fetch('/api/so-lines', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ so_id: id, line_type: 'part', description: input.value.trim(), rough_name: input.value.trim(), parts_status: 'rough', quantity: 1 }),
                  })
                  input.value = ''
                  await refreshOpenEstimateIfAny()
                  await loadData()
                }} style={btnStyle(BLUE, 'var(--tz-bgLight)')}>
                  Request
                </button>
              </div>
            </div>
          )}

          {/* Parts status summary + notify mechanic */}
          {!wo.is_historical && !partsLocked && partLines.length > 0 && !isViewOnly && (() => {
            const activeParts = partLines.filter((p: any) => p.parts_status !== 'canceled')
            // CTA ready-set = still pre-pickup (received/ready_for_job). picked_up/installed are post-pickup and handled separately.
            const readyCount = activeParts.filter((p: any) => ['received', 'ready_for_job'].includes(p.parts_status)).length
            const pickedUpCount = activeParts.filter((p: any) => ['picked_up', 'installed'].includes(p.parts_status)).length
            const orderedCount = activeParts.filter((p: any) => p.parts_status === 'ordered').length
            // Pending = anything not yet at or past received stage, and not ordered (ordered has its own counter).
            const roughCount = activeParts.filter((p: any) => !isPartReceived(p.parts_status) && p.parts_status !== 'ordered').length
            const allPickedUp = activeParts.length > 0 && pickedUpCount === activeParts.length
            const allReadyForNotify = activeParts.length > 0 && (readyCount + pickedUpCount) === activeParts.length && readyCount > 0

            if (allPickedUp) {
              return (
                <div style={{ ...cardStyle, marginTop: 12 }}>
                  <div style={{ textAlign: 'center', color: GREEN, fontSize: 13, fontWeight: 700, padding: 8 }}>Mechanic Picked Up All Parts</div>
                </div>
              )
            }

            if (partsSubmitted || allReadyForNotify) {
              return (
                <div style={{ ...cardStyle, marginTop: 12 }}>
                  <div style={{ textAlign: 'center', color: GREEN, fontSize: 13, fontWeight: 700, padding: 8 }}>All Parts Ready</div>
                  {!partsSubmitted && (
                    <button onClick={submitParts} disabled={partsSubmitting} style={{ ...btnStyle(GREEN, 'var(--tz-bgLight)'), width: '100%', justifyContent: 'center', marginTop: 8 }}>
                      {partsSubmitting ? 'Notifying...' : 'Notify Mechanic — Parts Ready'}
                    </button>
                  )}
                  {partsSubmitted && <div style={{ textAlign: 'center', fontSize: 12, color: GRAY, marginTop: 4 }}>Mechanic notified</div>}
                </div>
              )
            }

            return (
              <div style={{ ...cardStyle, marginTop: 12, fontSize: 12 }}>
                <div style={{ display: 'flex', gap: 12, color: GRAY }}>
                  {readyCount > 0 && <span style={{ color: GREEN, fontWeight: 600 }}>{readyCount} ready</span>}
                  {pickedUpCount > 0 && <span style={{ color: GREEN, fontWeight: 600 }}>{pickedUpCount} picked up</span>}
                  {orderedCount > 0 && <span style={{ color: AMBER, fontWeight: 600 }}>{orderedCount} ordered</span>}
                  {roughCount > 0 && <span style={{ color: 'var(--tz-danger)', fontWeight: 600 }}>{roughCount} pending</span>}
                </div>
              </div>
            )
          })()}

          {/* Legacy wo_parts if any */}
          {woParts.length > 0 && (
            <div style={{ ...cardStyle, marginTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: GRAY }}>Additional Parts (wo_parts)</div>
              <div style={{ fontSize: 12, color: GRAY }}>
                {woParts.map((p: any) => (
                  <div key={p.id} style={{ display: 'flex', gap: 8, padding: '4px 0', borderBottom: `1px solid ${'var(--tz-border)'}` }}>
                    <span style={{ flex: 1 }}>{p.description}{p.part_number ? ` (${p.part_number})` : ''}</span>
                    <span>Qty: {p.quantity}</span>
                    {canSeePrices && <span>{fmt(p.unit_cost || 0)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        </PartsTab>
      )}

      {/* ========== TAB 2: ESTIMATE & BILLING ========== */}
      {tab === 2 && (
        <EstimateTab>
        <div>
          {/* Estimate requirement notice */}
          {!wo.estimate_required && !wo.is_historical && (
            <div style={{ ...cardStyle, background: 'var(--tz-successBg)', border: `1px solid ${'var(--tz-success)'}`, marginBottom: 12, fontSize: 13, color: 'var(--tz-success)', fontWeight: 600 }}>
              Estimate not required for company trucks. You can still create one manually if needed.
            </div>
          )}

          {/* Historical full-detail surface lives on the Invoice tab now;
              the Estimate tab is hidden from the historical tab strip. */}

          {/* Estimate approval status + contact fields (only when estimate required) */}
          {wo.estimate_required && !wo.is_historical && (() => {
            const estStatus = wo.estimate_status || 'draft'
            const isApproved = wo.estimate_approved && estStatus !== 'approved_with_notes'
            const isApprovedWithNotes = wo.estimate_approved && estStatus === 'approved_with_notes'
            const isSent = estStatus === 'sent'
            const isDeclined = estStatus === 'declined'

            async function saveContact() {
              if (!customer?.id) return
              const updates: Record<string, any> = {}
              if (contactEmail !== (customer.email || '')) updates.email = contactEmail
              if (contactPhone !== (customer.phone || '')) updates.phone = contactPhone
              if (Object.keys(updates).length > 0) {
                await fetch(`/api/customers/${customer.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(updates),
                })
              }
            }

            return (
              <div style={{ ...cardStyle, marginBottom: 12 }}>
                {/* Status banner inside estimate tab */}
                {isApproved && (
                  <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 12, background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)', color: GREEN, fontSize: 13, fontWeight: 700 }}>
                    Estimate approved{wo.approval_method === 'in_person' ? ' in person' : wo.approval_method === 'printed_signed' ? ' (printed and signed)' : wo.approval_method === 'email_portal' ? ' via customer portal' : ''} — work can begin
                  </div>
                )}
                {isApprovedWithNotes && (
                  <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 12, background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)', color: AMBER, fontSize: 13, fontWeight: 700 }}>
                    Estimate approved with customer notes — review before starting
                    {wo.customer_estimate_notes && <div style={{ fontWeight: 400, marginTop: 4 }}>&ldquo;{wo.customer_estimate_notes}&rdquo;</div>}
                  </div>
                )}
                {isSent && !wo.estimate_approved && (
                  <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 12, background: 'rgba(29,111,232,0.08)', border: '1px solid rgba(29,111,232,0.2)', color: BLUE, fontSize: 13, fontWeight: 700 }}>
                    Estimate sent to customer — awaiting approval
                  </div>
                )}
                {isDeclined && (
                  <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 12, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: RED, fontSize: 13, fontWeight: 700 }}>
                    Estimate declined{wo.estimate_declined_reason ? ` — ${wo.estimate_declined_reason}` : ''} — follow up required
                  </div>
                )}

                {/* Contact fields — always visible */}
                <div style={{ fontSize: 12, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Send Estimate To</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, color: GRAY, marginBottom: 4, display: 'block' }}>Email</label>
                    <input
                      type="email"
                      name="estimate-recipient-email"
                      autoComplete="email"
                      inputMode="email"
                      value={contactEmail}
                      onChange={e => setContactEmail(e.target.value)}
                      onBlur={saveContact}
                      placeholder="customer@email.com"
                      style={{ ...inputStyle, fontSize: 12 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: GRAY, marginBottom: 4, display: 'block' }}>Phone</label>
                    <input
                      type="tel"
                      name="estimate-recipient-phone"
                      autoComplete="tel"
                      inputMode="tel"
                      value={contactPhone}
                      onChange={e => setContactPhone(e.target.value)}
                      onBlur={saveContact}
                      placeholder="+1 (555) 000-0000"
                      style={{ ...inputStyle, fontSize: 12 }}
                    />
                  </div>
                </div>

                {/* Approval buttons — ONLY when not approved */}
                {!wo.estimate_approved && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setApprovalModal({ kind: 'estimate_1' })}
                      style={btnStyle(BLUE, 'var(--tz-bgLight)')}
                    >
                      {estStatus === 'sent' ? 'Resend / Approve' : estStatus === 'declined' ? 'Resend Modified Estimate' : 'Send Estimate'}
                    </button>
                    <button onClick={() => { setApprovalModal({ kind: 'estimate_1' }); setApprovalConfirmModal({ method: 'in_person', notes: '' }) }} style={{ ...btnStyle( 'var(--tz-bgLight)', BLUE), border: `1px solid ${BLUE}` }}>
                      Approve In Person
                    </button>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Summary cards */}
          {!wo.is_historical && (() => {
            const partsAmt = woPartsTotal + partsLineTotal
            const items = [
              laborTotal > 0 ? { label: 'Labor', value: fmt(laborTotal), color: BLUE } : null,
              partsAmt > 0 ? { label: 'Parts', value: fmt(partsAmt), color: AMBER } : null,
              chargesTotal > 0 ? { label: 'Charges', value: fmt(chargesTotal), color: GRAY } : null,
              taxAmt > 0 ? { label: 'Tax', value: fmt(taxAmt), color: GRAY } : null,
              { label: 'Total', value: fmt(grandTotal), color: GREEN },
            ].filter(Boolean) as { label: string; value: string; color: string }[]
            return (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 12, marginBottom: 16 }}>
                {items.map(s => (
                  <div key={s.label} style={{ background: 'var(--tz-bgHover)', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                    <div style={labelStyle}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Per-estimate cards — structure-only packet-2 port
              (TruckZen_WOEstimate_ReauthorPacket2_StructureOnly).
              Each estimate group renders as one clean card: header (title
              + status pill left, Total right), Labor table (left) and
              Parts table (right) side-by-side, totals block bottom-right
              with Labor / Parts / Grand total. Structure only — pending
              supplement cards do NOT render send/approve/decline action
              buttons because destination does not yet expose the required
              /api/estimates/[id]/send-supplement and
              /api/estimates/[id]/supplement-respond routes. Current
              destination approval UX (Send Estimate / Approve In Person
              buttons above, next to the status banner) is preserved. */}
          {!wo.is_historical && (() => {
            type LaborRow = { description: string; hours: number; rate: number; total: number }
            type PartRow = { part: string; qty: number; price: number; total: number; nonBillable?: 'customer_supplied' | 'no_part_needed' | null }
            type CardStatus = { label: string; bg: string; color: string }

            // Display-only splitter for merged labor descriptions — same
            // rule the Jobs tab uses (newline → " + " → " • " → fallback).
            // Stored description is not mutated.
            const splitConcernLocal = (desc: string | null | undefined): string[] => {
              const s = (desc || '').trim()
              if (!s) return []
              const byNewline = s.split(/\r?\n+/).map(p => p.trim()).filter(Boolean)
              if (byNewline.length > 1) return byNewline
              const byPlus = s.split(/\s*\+\s*/).map(p => p.trim()).filter(Boolean)
              if (byPlus.length > 1) return byPlus
              const byBullet = s.split(/\s*•\s*/).map(p => p.trim()).filter(Boolean)
              if (byBullet.length > 1) return byBullet
              return [s]
            }

            // Local table-header style — fixes <th> stacking by avoiding
            // labelStyle's display:'block'. Color upgraded to the brighter
            // textSecondary token for dark-mode contrast inside the Estimate
            // tab (packet-4 visual polish).
            const tableHeaderStyle: React.CSSProperties = {
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--tz-textSecondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }
            // Locally scoped secondary-text color + divider — cool grey that
            // reads cleanly on the dark card background. Existing tokens,
            // no global changes.
            const dimText = 'var(--tz-textSecondary)'
            const dividerStrong = 'var(--tz-border)'

            // Inline non-billable predicates matching source's
            // parts-status helpers (destination does not export these).
            const isCustomerSuppliedPart = (l: any) => l?.line_type === 'part' && l?.parts_requirement === 'customer_supplied'
            const isNoPartNeededPart = (l: any) => l?.line_type === 'part' && l?.parts_requirement === 'not_needed'

            const isCanceled = (row: any) => row?.parts_status === 'canceled' || row?.line_status === 'canceled' || row?.status === 'canceled'

            const renderEstimateCard = (opts: {
              keyId: string
              title: string
              status: CardStatus
              laborRows: LaborRow[]
              partsRows: PartRow[]
              totals: { labor: number; parts: number; grand: number }
              actions?: React.ReactNode
            }) => (
              <div key={opts.keyId} style={{ ...cardStyle, marginBottom: 16 }}>
                {/* Header — title + status pill on the left, Total on the
                    right. Spacing tuned so the badge breathes from the title
                    (packet-4 visual polish). */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--tz-text)' }}>{opts.title}</span>
                  <span style={pillStyle(opts.status.bg, opts.status.color)}>{opts.status.label}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 13, color: dimText }}>
                    Total <strong style={{ color: 'var(--tz-text)', fontSize: 18, marginLeft: 8 }}>{fmt(opts.totals.grand)}</strong>
                  </span>
                </div>
                {/* Body — Labor first, then Parts, vertically stacked
                    (packet-4). Cleaner invoice-like reading flow than the
                    prior side-by-side grid. */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--tz-text)' }}>Labor</div>
                    {opts.laborRows.length > 0 ? (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${dividerStrong}` }}>
                            <th style={{ textAlign: 'left', padding: '8px 10px', ...tableHeaderStyle }}>Description</th>
                            <th style={{ textAlign: 'right', padding: '8px 10px', ...tableHeaderStyle, width: 80 }}>Hours</th>
                            <th style={{ textAlign: 'right', padding: '8px 10px', ...tableHeaderStyle, width: 100 }}>Rate</th>
                            <th style={{ textAlign: 'right', padding: '8px 10px', ...tableHeaderStyle, width: 120 }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {opts.laborRows.map((r, i) => {
                            // Multi-job merged descriptions render as a
                            // numbered list — matches Jobs tab readability.
                            // Single concerns render as plain text.
                            const items = splitConcernLocal(r.description)
                            return (
                              <tr key={i} style={{ borderBottom: `1px solid ${dividerStrong}` }}>
                                <td style={{ padding: '8px 10px', wordBreak: 'break-word', overflowWrap: 'anywhere', color: 'var(--tz-text)' }}>
                                  {items.length > 1 ? (
                                    <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                      {items.map((c, ci) => <li key={ci}>{c}</li>)}
                                    </ol>
                                  ) : r.description}
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--tz-text)' }}>{(Math.round(r.hours * 100) / 100).toFixed(2)}</td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--tz-text)' }}>{fmt(r.rate)}</td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--tz-text)' }}>{fmt(r.total)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <div style={{ fontSize: 12, color: dimText, fontStyle: 'italic', padding: '6px 8px' }}>No labor</div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--tz-text)' }}>Parts</div>
                    {opts.partsRows.length > 0 ? (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${dividerStrong}` }}>
                            <th style={{ textAlign: 'left', padding: '8px 10px', ...tableHeaderStyle }}>Part</th>
                            <th style={{ textAlign: 'right', padding: '8px 10px', ...tableHeaderStyle, width: 80 }}>Qty</th>
                            <th style={{ textAlign: 'right', padding: '8px 10px', ...tableHeaderStyle, width: 100 }}>Price</th>
                            <th style={{ textAlign: 'right', padding: '8px 10px', ...tableHeaderStyle, width: 120 }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {opts.partsRows.map((r, i) => {
                            // Customer-supplied / no-part-needed rows get a
                            // non-billable badge under the part name, and
                            // their price/total render as "—" (they're also
                            // excluded from the Parts total below).
                            const badge = r.nonBillable === 'customer_supplied'
                              ? { text: 'Customer-supplied — non-billable', color: AMBER }
                              : r.nonBillable === 'no_part_needed'
                                ? { text: 'No part needed — non-billable', color: GREEN }
                                : null
                            return (
                              <tr key={i} style={{ borderBottom: `1px solid ${dividerStrong}` }}>
                                <td style={{ padding: '8px 10px', wordBreak: 'break-word', overflowWrap: 'anywhere', color: 'var(--tz-text)' }}>
                                  <div>{r.part}</div>
                                  {badge && (
                                    <div style={{ fontSize: 11, color: badge.color, fontWeight: 700, marginTop: 2 }}>{badge.text}</div>
                                  )}
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--tz-text)' }}>{r.qty}</td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', color: r.nonBillable ? dimText : 'var(--tz-text)' }}>{r.nonBillable ? '—' : fmt(r.price)}</td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: r.nonBillable ? dimText : 'var(--tz-text)' }}>{r.nonBillable ? '—' : fmt(r.total)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <div style={{ fontSize: 12, color: dimText, fontStyle: 'italic', padding: '6px 8px' }}>No parts</div>
                    )}
                  </div>
                </div>
                {/* Totals block (right) + actions (left). Spacing tuned so
                    the grand total never overlaps the action row. */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 18, gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {opts.actions}
                  </div>
                  <div style={{ minWidth: 260, padding: '14px 18px', borderRadius: 8, border: `1px solid ${dividerStrong}`, background: 'var(--tz-bgHover)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
                      <span style={{ color: dimText }}>Labor total</span>
                      <span style={{ fontWeight: 700, color: 'var(--tz-text)' }}>{fmt(opts.totals.labor)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
                      <span style={{ color: dimText }}>Parts total</span>
                      <span style={{ fontWeight: 700, color: 'var(--tz-text)' }}>{fmt(opts.totals.parts)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, padding: '8px 0 4px', borderTop: `1px solid ${dividerStrong}`, marginTop: 6 }}>
                      <span style={{ fontWeight: 800, color: 'var(--tz-text)' }}>Grand total</span>
                      <span style={{ fontWeight: 800, color: 'var(--tz-text)' }}>{fmt(opts.totals.grand)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )

            // ── Estimate 1 — original scope (non-additional lines) ──
            const e1Status: CardStatus = wo.estimate_approved
              ? { label: 'APPROVED', bg: 'var(--tz-successBg)', color: GREEN }
              : wo.estimate_status === 'sent'
                ? { label: 'PENDING APPROVAL', bg: 'var(--tz-warningBg)', color: AMBER }
                : wo.estimate_status === 'declined'
                  ? { label: 'DECLINED', bg: 'var(--tz-dangerBg)', color: RED }
                  : { label: 'DRAFT', bg: 'var(--tz-bgHover)', color: GRAY }

            const e1Labor: LaborRow[] = jobLines
              .filter((l: any) => l.is_additional !== true && !isCanceled(l))
              .map((l: any) => {
                const hrs = l.billed_hours || l.actual_hours || l.estimated_hours || 0
                const rate = isImportedHistory && l.labor_rate ? l.labor_rate : laborRate
                const total = isImportedHistory ? (l.unit_price || 0) : hrs * rate
                return { description: l.description || '—', hours: hrs, rate, total }
              })
            // Non-billable so_lines parts (customer-supplied / no-part-
            // needed) are INCLUDED in the visible Parts list with a
            // non-billable badge so the writer sees them near related
            // work. They are excluded from the Parts total below.
            const e1PartsFromLines: PartRow[] = partLines
              .filter((p: any) => p.is_additional !== true && !isCanceled(p))
              .map((p: any) => {
                const sell = p.parts_sell_price || 0
                const qty = p.quantity || 1
                const nonBillable: PartRow['nonBillable'] = isCustomerSuppliedPart(p)
                  ? 'customer_supplied'
                  : isNoPartNeededPart(p)
                    ? 'no_part_needed'
                    : null
                return { part: p.real_name || p.rough_name || p.description || '—', qty, price: sell, total: sell * qty, nonBillable }
              })
            const e1PartsFromWoParts: PartRow[] = woParts
              .filter((p: any) => p.is_additional !== true && !isCanceled(p))
              .map((p: any) => {
                const cost = p.unit_cost || 0
                const qty = p.quantity || 1
                return { part: p.description || '—', qty, price: cost, total: cost * qty }
              })
            const e1Parts = [...e1PartsFromLines, ...e1PartsFromWoParts]
            const e1LaborTotal = e1Labor.reduce((s, r) => s + r.total, 0)
            const e1PartsTotal = e1Parts.filter(r => !r.nonBillable).reduce((s, r) => s + r.total, 0)
            const e1Grand = e1LaborTotal + e1PartsTotal

            // ── Supplement batches → Estimate 2, 3, … ──
            // Groups additional lines/parts by supplement_batch_id (added to
            // the schema by the remote 20260420 migration). Legacy additional
            // rows without a batch id fall into an __unbatched__ group.
            const suppJobLines = jobLines.filter((l: any) => l.is_additional === true && !isCanceled(l))
            const suppPartLines = partLines.filter((p: any) => p.is_additional === true && !isCanceled(p))
            const suppWoParts = woParts.filter((p: any) => p.is_additional === true && !isCanceled(p))
            type BatchGroup = { id: string; jobs: any[]; parts: any[]; woParts: any[]; minCreated: string; isUnbatched: boolean }
            const groupsMap: Record<string, BatchGroup> = {}
            const seed = (row: any, bucket: 'jobs' | 'parts' | 'woParts') => {
              const bid = row.supplement_batch_id || '__unbatched__'
              if (!groupsMap[bid]) {
                groupsMap[bid] = { id: bid, jobs: [], parts: [], woParts: [], minCreated: row.created_at || '', isUnbatched: bid === '__unbatched__' }
              }
              const g = groupsMap[bid]
              if (!g.minCreated || (row.created_at && row.created_at < g.minCreated)) g.minCreated = row.created_at || g.minCreated
              g[bucket].push(row)
            }
            for (const l of suppJobLines) seed(l, 'jobs')
            for (const p of suppPartLines) seed(p, 'parts')
            for (const p of suppWoParts) seed(p, 'woParts')
            const batches = Object.values(groupsMap).sort((a, b) => a.minCreated.localeCompare(b.minCreated))

            const supStatus = (g: BatchGroup): CardStatus => {
              const all = [...g.jobs, ...g.parts, ...g.woParts]
              if (all.length === 0) return { label: 'WAITING FOR APPROVAL', bg: 'var(--tz-warningBg)', color: AMBER }
              const set = new Set(all.map((r: any) => r.customer_approved))
              if (set.size > 1) return { label: 'REVIEW REQUIRED', bg: 'var(--tz-warningBg)', color: AMBER }
              const v = [...set][0]
              if (v === true) return { label: 'APPROVED', bg: 'var(--tz-successBg)', color: GREEN }
              if (v === false) return { label: 'DECLINED', bg: 'var(--tz-dangerBg)', color: RED }
              return { label: 'WAITING FOR APPROVAL', bg: 'var(--tz-warningBg)', color: AMBER }
            }

            return (
              <>
                {renderEstimateCard({
                  keyId: 'estimate-1',
                  title: 'Estimate 1',
                  status: e1Status,
                  laborRows: e1Labor,
                  partsRows: e1Parts,
                  totals: { labor: e1LaborTotal, parts: e1PartsTotal, grand: e1Grand },
                })}
                {batches.map((b, idx) => {
                  const labor: LaborRow[] = b.jobs.map((l: any) => {
                    const hrs = l.billed_hours || l.actual_hours || l.estimated_hours || 0
                    return { description: l.description || '—', hours: hrs, rate: laborRate, total: hrs * laborRate }
                  })
                  const partsFromLines: PartRow[] = b.parts.map((l: any) => {
                    const sell = l.parts_sell_price || l.unit_price || 0
                    const qty = l.quantity || 1
                    const nonBillable: PartRow['nonBillable'] = isCustomerSuppliedPart(l)
                      ? 'customer_supplied'
                      : isNoPartNeededPart(l)
                        ? 'no_part_needed'
                        : null
                    return { part: l.real_name || l.rough_name || l.description || '—', qty, price: sell, total: sell * qty, nonBillable }
                  })
                  const partsFromWoParts: PartRow[] = b.woParts.map((p: any) => {
                    const cost = p.unit_cost || 0
                    const qty = p.quantity || 1
                    return { part: p.description || '—', qty, price: cost, total: cost * qty }
                  })
                  const parts = [...partsFromLines, ...partsFromWoParts]
                  const laborTotal = labor.reduce((s, r) => s + r.total, 0)
                  const partsTotal = parts.filter(r => !r.nonBillable).reduce((s, r) => s + r.total, 0)
                  const grand = laborTotal + partsTotal
                  const status = supStatus(b)
                  const titleSuffix = b.isUnbatched ? ' — Unbatched' : ''
                  // Packet-3 modal-reuse: pending real batches (not the legacy
                  // __unbatched__ bucket) get a single "Send for Approval" CTA
                  // that opens the shared approval modal in supplement context.
                  // The modal's sendEstimateEmail() / approveEstimate() handlers
                  // branch on approvalModal.kind === 'supplement' and call
                  // /api/estimates/[id]/send-supplement and
                  // /api/estimates/[id]/supplement-respond respectively.
                  const isPending = status.label === 'WAITING FOR APPROVAL' && !b.isUnbatched
                  const estimateNumber = idx + 2
                  const actions = isPending ? (
                    <button
                      onClick={() => setApprovalModal({ kind: 'supplement', batchId: b.id, estimateNumber })}
                      style={btnStyle(BLUE, 'var(--tz-bgLight)')}
                    >
                      <DollarSign size={14} /> Send for Approval
                    </button>
                  ) : undefined
                  return renderEstimateCard({
                    keyId: b.id,
                    title: `Estimate ${estimateNumber}${titleSuffix}`,
                    status,
                    laborRows: labor,
                    partsRows: parts,
                    totals: { labor: laborTotal, parts: partsTotal, grand },
                    actions,
                  })
                })}
              </>
            )
          })()}

          {/* Shop Charges */}
          {shopCharges.length > 0 && (
            <div style={cardStyle}>
              <span style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: 'block' }}>Shop Charges</span>
              {shopCharges.map((c: any) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: `1px solid ${'var(--tz-border)'}`, fontSize: 13 }}>
                  <span style={{ flex: 1 }}>{c.description}</span>
                  <span>{c.taxable ? '(Taxable)' : ''}</span>
                  <span style={{ fontWeight: 700 }}>{fmt(c.amount)}</span>
                  <button onClick={() => removeCharge(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: RED }}><X size={14} /></button>
                </div>
              ))}
            </div>
          )}

          {/* Tax — live WOs only */}
          {!wo.is_historical && taxRate > 0 && taxAmt > 0 && (
            <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>Tax ({taxRate}%{shop.tax_labor ? ' incl. labor' : ' parts only'})</span>
              <span style={{ fontWeight: 700 }}>{fmt(taxAmt)}</span>
            </div>
          )}

          {/* Grand Total — live WOs only; historical grand total is shown
              inside the single read-only Estimate card above. */}
          {!wo.is_historical && (
            <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', background: 'var(--tz-successBg)', border: `1px solid ${GREEN}` }}>
              <span style={{ fontSize: 16, fontWeight: 800 }}>Total</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: GREEN }}>{fmt(grandTotal)}</span>
            </div>
          )}

          {/* Signature area — live workflow only; historical records have no
              real captured signature so the placeholder is misleading there. */}
          {!wo.is_historical && (
            <div style={cardStyle}>
              <span style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: 'block' }}>Authorization</span>
              <div style={{ background: 'var(--tz-bgHover)', borderRadius: 8, padding: 20, textAlign: 'center', border: `1px dashed ${'var(--tz-border)'}`, minHeight: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: GRAY, fontSize: 13 }}>
                Customer signature area (canvas placeholder)
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: GRAY }}>
                Authorized by: {customer.contact_name || customer.company_name || '—'} | {customer.email || '—'}
              </div>
            </div>
          )}
        </div>
        </EstimateTab>
      )}

      {/* ========== TAB 3: FILES & NOTES ========== */}
      {tab === 3 && (
        <div>
          {/* Note input — hidden for historical/imported records */}
          {!wo.is_historical && !isViewOnly && (
          <div style={cardStyle}>
            <span style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: 'block' }}>Add Note</span>
            <AITextInput
              value={noteText}
              onChange={setNoteText}
              context={user?.role === 'technician' || user?.role === 'maintenance_technician' ? 'mechanic' : user?.role === 'shop_manager' ? 'supervisor' : 'service_writer'}
              theme="light"
              shopId={wo?.shop_id}
              userId={user?.id}
              placeholder="Write a note..."
              rows={3}
              style={{ ...inputStyle, minHeight: 70, resize: 'vertical', marginBottom: 8, paddingRight: 48, background: 'var(--tz-bgCard)', color: 'var(--tz-text)', border: `1px solid ${'var(--tz-border)'}` }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={noteVisible} onChange={e => setNoteVisible(e.target.checked)} />
                Visible to customer
              </label>
              <div style={{ flex: 1 }} />
              <button onClick={addNote} disabled={addingNote || !noteText.trim()} style={{ ...btnStyle(BLUE, 'var(--tz-bgLight)'), opacity: addingNote || !noteText.trim() ? 0.5 : 1 }}>
                {addingNote ? 'Saving...' : 'Add Note'}
              </button>
            </div>
          </div>
          )}

          {/* Notes list */}
          {notes.length > 0 && (
            <div style={cardStyle}>
              <span style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: 'block' }}>Notes ({notes.length})</span>
              {notes.map((n: any) => (
                <div key={n.id} style={{ padding: '10px 0', borderBottom: `1px solid ${'var(--tz-border)'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{userMap[n.user_id] || 'System'}</span>
                    <span style={{ fontSize: 11, color: GRAY }}>{fmtDate(n.created_at)}</span>
                    {n.visible_to_customer && <span style={pillStyle('var(--tz-accentBg)', BLUE)}>Customer Visible</span>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--tz-textSecondary)', whiteSpace: 'pre-wrap' }}>{n.note_text}</div>
                </div>
              ))}
            </div>
          )}

          {/* File upload — hidden for historical/imported records */}
          {!wo.is_historical && !isViewOnly && (
          <div style={cardStyle}>
            <span style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: 'block' }}>Files</span>
            <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={e => uploadFiles(e.target.files)} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} style={btnStyle( 'var(--tz-bgLight)', BLUE)}>
              <Upload size={14} /> {uploading ? 'Uploading...' : 'Upload Files'}
            </button>
          </div>
          )}

          {/* Files list */}
          {files.length > 0 && (
            <div style={cardStyle}>
              <span style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: 'block' }}>Uploaded Files ({files.length})</span>
              {files.map((f: any) => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${'var(--tz-border)'}` }}>
                  <Paperclip size={14} color={GRAY} />
                  <a href={`/api/wo-files/${f.id}/download`} target="_blank" rel="noreferrer" style={{ color: BLUE, fontSize: 13, fontWeight: 600, textDecoration: 'none', flex: 1 }}>
                    {f.filename}
                  </a>
                  <span style={{ fontSize: 11, color: GRAY }}>{userMap[f.user_id] || ''}</span>
                  <span style={{ fontSize: 11, color: GRAY }}>{fmtDate(f.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========== TAB 4: ACTIVITY ========== */}
      {tab === 4 && (
        <div style={cardStyle}>
          <span style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'block' }}>Activity Log</span>
          {activity.length === 0 && <div style={{ fontSize: 13, color: GRAY, padding: 20, textAlign: 'center' }}>No activity yet</div>}
          {activity.map((a: any, i: number) => (
            <div key={a.id} style={{ display: 'flex', gap: 12, paddingBottom: 14, marginBottom: 14, borderLeft: i < activity.length - 1 ? `2px solid ${'var(--tz-border)'}` : '2px solid transparent', paddingLeft: 16, position: 'relative' }}>
              <div style={{ position: 'absolute', left: -5, top: 2, width: 8, height: 8, borderRadius: '50%', background: BLUE }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: 'var(--tz-text)' }}>{a.action}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: GRAY }}>{userMap[a.user_id] || a.users?.full_name || 'System'}</span>
                  <span style={{ fontSize: 11, color: 'var(--tz-textTertiary)' }}>{fmtDate(a.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========== TAB 5: INVOICE ========== */}
      {tab === 5 && !wo.is_historical && (
        <div style={{ background: 'var(--tz-bgElevated)', borderRadius: 16, border: `1px solid ${'var(--tz-border)'}`, padding: 'clamp(12px, 3vw, 24px)' }}>

          {/* ── Invoice Title Bar ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${'var(--tz-border)'}` }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--tz-text)', letterSpacing: '-0.02em' }}>Invoice</span>
            {(() => {
              const statusMap: Record<string, { label: string; bg: string; color: string }> = {
                draft: { label: 'Draft', bg: 'var(--tz-surfaceMuted)', color: 'var(--tz-textSecondary)' },
                accounting_review: { label: 'Under Review', bg: 'var(--tz-warningBg)', color: 'var(--tz-warning)' },
                sent: { label: 'Sent to Customer', bg: 'var(--tz-accentBg)', color: 'var(--tz-accent)' },
                paid: { label: 'Paid', bg: 'var(--tz-successBg)', color: 'var(--tz-success)' },
                closed: { label: 'Closed', bg: 'var(--tz-surfaceMuted)', color: 'var(--tz-textSecondary)' },
              }
              const s = statusMap[wo.invoice_status] || statusMap.draft
              return <span style={{ padding: '3px 12px', borderRadius: 100, fontSize: 10, fontWeight: 700, background: s.bg, color: s.color, textTransform: 'uppercase', letterSpacing: '.04em' }}>{s.label}</span>
            })()}
          </div>

          {/* ── Invoice Info: From / Bill To / Details ── */}
          <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20 }}>
              {/* From */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>From</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tz-text)' }}>{shop.payment_payee_name || shop.dba || shop.name || '—'}</div>
                {(shop.payment_mail_address || shop.address) && (
                  <div style={{ fontSize: 12, color: 'var(--tz-textSecondary)', lineHeight: 1.7 }}>
                    {shop.payment_mail_address || shop.address}
                    {(shop.payment_mail_city || shop.payment_mail_state || shop.payment_mail_zip) && <br />}
                    {[shop.payment_mail_city, shop.payment_mail_state].filter(Boolean).join(', ')} {shop.payment_mail_zip || ''}
                  </div>
                )}
                {shop.phone && <div style={{ fontSize: 12, color: 'var(--tz-textSecondary)', marginTop: 2 }}>{shop.phone}</div>}
                {shop.email && <div style={{ fontSize: 12, color: 'var(--tz-textSecondary)' }}>{shop.email}</div>}
              </div>
              {/* Bill To */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Bill To</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tz-text)' }}>{customer?.company_name || '—'}</div>
                {(contactEmail || customer?.email) && (
                  <div style={{ fontSize: 12, color: 'var(--tz-textSecondary)', marginTop: 2 }}>{contactEmail || customer.email}</div>
                )}
                {(contactPhone || customer?.phone) && (
                  <div style={{ fontSize: 12, color: 'var(--tz-textSecondary)' }}>{contactPhone || customer.phone}</div>
                )}
              </div>
              {/* Invoice Details */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Details</div>
                <div style={{ fontSize: 12, color: 'var(--tz-textSecondary)', lineHeight: 1.8 }}>
                  <div><span style={{ color: GRAY }}>WO #:</span> <span style={{ fontWeight: 600 }}>{wo.so_number}</span></div>
                  {wo.invoices?.[0]?.invoice_number && (
                    <div><span style={{ color: GRAY }}>Invoice #:</span> <span style={{ fontWeight: 600 }}>{wo.invoices[0].invoice_number}</span></div>
                  )}
                  <div><span style={{ color: GRAY }}>Date:</span> <span style={{ fontWeight: 600 }}>{wo.created_at ? fmtDate(wo.created_at) : '—'}</span></div>
                  <div><span style={{ color: GRAY }}>Writer:</span> <span style={{ fontWeight: 600 }}>{createdByName}</span></div>
                </div>
              </div>
              {/* Unit Info */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Unit</div>
                <div style={{ fontSize: 12, color: 'var(--tz-textSecondary)', lineHeight: 1.8 }}>
                  <div style={{ fontWeight: 600 }}>#{asset?.unit_number || '—'}</div>
                  {(asset?.year || asset?.make || asset?.model) && (
                    <div>{[asset.year, asset.make, asset.model].filter(Boolean).join(' ')}</div>
                  )}
                  {asset?.vin && <div style={{ color: GRAY, fontSize: 11 }}>VIN: {wo.is_historical ? '' : '...'}{vinDisplay}</div>}
                </div>
              </div>
            </div>
          </div>

          {['sent', 'paid', 'closed'].includes(wo.invoice_status) && (
            <div style={{ background: 'var(--tz-warningBg)', border: `1px solid ${'var(--tz-warning)'}`, borderRadius: 8, padding: '8px 14px', marginBottom: 16, fontSize: 12, color: 'var(--tz-warning)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>&#128274;</span> Editing locked — invoice has been sent to customer
            </div>
          )}

          {/* ── Job-Grouped Invoice Body ── */}
          {(() => {
            const orphanParts = invoiceBillableParts.filter((p: any) => !p.related_labor_line_id || !jobLines.some((j: any) => j.id === p.related_labor_line_id))
            return (
              <>
                {jobLines.map((line: any, idx: number) => {
                  const hrs = line.billed_hours || line.actual_hours || line.estimated_hours || 0
                  const jobLaborAmt = hrs * laborRate
                  const jobParts = invoiceBillableParts.filter((p: any) => p.related_labor_line_id === line.id)
                  const jobPartsTotal = jobParts.reduce((s: number, p: any) => s + ((p.parts_sell_price || p.unit_price || 0) * (p.quantity || 1)), 0)
                  const jobTotal = jobLaborAmt + jobPartsTotal

                  return (
                    <div key={line.id} style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
                      {/* A. Job Header */}
                      <div style={{ padding: '10px 20px', borderBottom: `1px solid ${'var(--tz-border)'}`, background: 'var(--tz-bgCard)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.04em' }}>Job {idx + 1}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tz-text)' }}>{line.description?.slice(0, 60) || `Job ${idx + 1}`}</span>
                      </div>

                      <div style={{ padding: '0 20px' }}>
                        {/* B. Labor Detail */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', padding: '10px 8px 6px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${'var(--tz-border)'}` }}>Labor</th>
                              <th style={{ textAlign: 'center', padding: '10px 8px 6px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${'var(--tz-border)'}`, width: 80 }}>Hours</th>
                              <th style={{ textAlign: 'right', padding: '10px 8px 6px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${'var(--tz-border)'}`, width: 70 }}>Rate</th>
                              <th style={{ textAlign: 'right', padding: '10px 8px 6px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${'var(--tz-border)'}`, width: 80 }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td style={{ padding: '8px 8px', color: 'var(--tz-textSecondary)', fontWeight: 500 }}>{line.description?.slice(0, 50) || `Job ${idx + 1}`}</td>
                              <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                                {canEditPrices ? (
                                  <input type="number" step="0.25" defaultValue={line.billed_hours || ''} onBlur={async e => { const v = parseFloat(e.target.value) || 0; if (v !== (line.billed_hours || 0)) { await patchLine(line.id, { billed_hours: v }); } }} placeholder={String(line.estimated_hours || 0)} style={{ width: 60, textAlign: 'center', padding: '4px 6px', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit', background: 'var(--tz-bgCard)' }} />
                                ) : (
                                  <span style={{ fontWeight: 600 }}>{line.billed_hours || hrs}</span>
                                )}
                              </td>
                              <td style={{ padding: '8px 8px', textAlign: 'right', color: GRAY }}>{isImportedHistory ? (line.labor_rate ? `${fmt(line.labor_rate)}/hr` : '—') : `${fmt(laborRate)}/hr`}</td>
                              <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--tz-text)' }}>{isImportedHistory ? fmt(line.unit_price || 0) : fmt(jobLaborAmt)}</td>
                            </tr>
                          </tbody>
                        </table>

                        {/* C. Parts for this Job */}
                        {jobParts.length > 0 && (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 4 }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'center', padding: '8px 8px 6px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${'var(--tz-border)'}`, width: 36 }}>Qty</th>
                                <th style={{ textAlign: 'left', padding: '8px 8px 6px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${'var(--tz-border)'}` }}>Parts</th>
                                <th style={{ textAlign: 'left', padding: '8px 8px 6px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${'var(--tz-border)'}`, width: 80 }}>Part #</th>
                                <th style={{ textAlign: 'right', padding: '8px 8px 6px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${'var(--tz-border)'}`, width: 60 }}>Cost</th>
                                <th style={{ textAlign: 'right', padding: '8px 8px 6px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${'var(--tz-border)'}`, width: 60 }}>Sell</th>
                                <th style={{ textAlign: 'right', padding: '8px 8px 6px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${'var(--tz-border)'}`, width: 80 }}>Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {jobParts.map((p: any, pi: number) => {
                                const sell = p.parts_sell_price || p.unit_price || 0
                                const cost = p.parts_cost_price || 0
                                const qty = p.quantity || 1
                                const lineTotal = sell * qty
                                const isZero = lineTotal === 0 && sell === 0
                                return (
                                  <tr key={p.id} style={{ borderBottom: pi < jobParts.length - 1 ? `1px solid ${'var(--tz-border)'}` : 'none', opacity: isZero ? 0.45 : 1 }}>
                                    <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600 }}>{qty}</td>
                                    <td style={{ padding: '6px 8px' }}>
                                      <span style={{ color: 'var(--tz-text)', fontWeight: 500 }}>{p.real_name || p.rough_name || p.description || '—'}</span>
                                      {p.real_name && p.rough_name && p.real_name !== p.rough_name && (
                                        <div style={{ fontSize: 9, color: 'var(--tz-textTertiary)', marginTop: 1 }}>Originally: {p.rough_name}</div>
                                      )}
                                    </td>
                                    <td style={{ padding: '6px 8px', color: GRAY, fontSize: 11 }}>{p.part_number || '—'}</td>
                                    <td style={{ padding: '6px 8px', textAlign: 'right', color: GRAY, fontSize: 11 }}>{canSeePrices ? fmt(cost) : '—'}</td>
                                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{canSeePrices ? fmt(sell) : '—'}</td>
                                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--tz-text)' }}>{fmt(lineTotal)}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>

                      {/* D. Job Financial Recap */}
                      <div style={{ padding: '8px 20px', borderTop: `1px solid ${'var(--tz-border)'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 20, fontSize: 11, color: GRAY }}>
                          <span>Labor: {fmt(jobLaborAmt)}</span>
                          {jobParts.length > 0 && <span>Parts: {fmt(jobPartsTotal)}</span>}
                          <span style={{ color: 'var(--tz-textSecondary)', fontWeight: 600 }}>Job Total: {fmt(jobTotal)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Non-billable placeholders — customer-supplied / no-part-needed.
                    Kept out of priced rows/totals; shown once as a compact
                    stamp so the customer/writer can see the audit truth. */}
                {invoiceNonBillableParts.length > 0 && (
                  <div style={{ background: 'var(--tz-bgCard)', border: `1px dashed ${'var(--tz-border)'}`, borderRadius: 12, marginBottom: 16, padding: '12px 18px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Non-billable placeholders</div>
                    {invoiceNonBillableParts.some((p: any) => isCustomerSuppliedPartRow(p)) && (
                      <div style={{ fontSize: 11, color: GRAY, marginBottom: 8 }}>Shop is not responsible for customer-supplied part defect/warranty.</div>
                    )}
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--tz-textSecondary)' }}>
                      {invoiceNonBillableParts.map((p: any) => {
                        const label = isCustomerSuppliedPartRow(p)
                          ? 'Customer supplied part'
                          : isNoPartNeededPartRow(p) ? 'No part needed' : 'Non-billable'
                        const name = p.real_name || p.rough_name || p.description || '—'
                        return (
                          <li key={p.id} style={{ marginBottom: 2 }}>
                            <span style={{ color: 'var(--tz-text)', fontWeight: 500 }}>{label}:</span> {name}
                            <span style={{ color: GRAY }}> — no part charge</span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}

                {/* Orphan Parts — parts not linked to any specific job */}
                {orphanParts.length > 0 && (
                  <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
                    <div style={{ padding: '10px 20px', borderBottom: `1px solid ${'var(--tz-border)'}`, background: 'var(--tz-bgCard)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tz-text)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Additional Parts</span>
                      <span style={{ fontSize: 11, color: GRAY }}>({orphanParts.length} {orphanParts.length === 1 ? 'item' : 'items'})</span>
                    </div>
                    <div style={{ padding: '0 20px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'center', padding: '8px 8px 6px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${'var(--tz-border)'}`, width: 36 }}>Qty</th>
                            <th style={{ textAlign: 'left', padding: '8px 8px 6px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${'var(--tz-border)'}` }}>Part</th>
                            <th style={{ textAlign: 'left', padding: '8px 8px 6px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${'var(--tz-border)'}`, width: 80 }}>Part #</th>
                            <th style={{ textAlign: 'right', padding: '8px 8px 6px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${'var(--tz-border)'}`, width: 60 }}>Cost</th>
                            <th style={{ textAlign: 'right', padding: '8px 8px 6px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${'var(--tz-border)'}`, width: 60 }}>Sell</th>
                            <th style={{ textAlign: 'right', padding: '8px 8px 6px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${'var(--tz-border)'}`, width: 80 }}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orphanParts.map((p: any, pi: number) => {
                            const sell = p.parts_sell_price || p.unit_price || 0
                            const cost = p.parts_cost_price || 0
                            const qty = p.quantity || 1
                            const lineTotal = sell * qty
                            const isZero = lineTotal === 0 && sell === 0
                            return (
                              <tr key={p.id} style={{ borderBottom: pi < orphanParts.length - 1 ? `1px solid ${'var(--tz-border)'}` : 'none', opacity: isZero ? 0.45 : 1 }}>
                                <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600 }}>{qty}</td>
                                <td style={{ padding: '6px 8px' }}>
                                  <span style={{ color: 'var(--tz-text)', fontWeight: 500 }}>{p.real_name || p.rough_name || p.description || '—'}</span>
                                  {p.real_name && p.rough_name && p.real_name !== p.rough_name && (
                                    <div style={{ fontSize: 9, color: 'var(--tz-textTertiary)', marginTop: 1 }}>Originally: {p.rough_name}</div>
                                  )}
                                </td>
                                <td style={{ padding: '6px 8px', color: GRAY, fontSize: 11 }}>{p.part_number || '—'}</td>
                                <td style={{ padding: '6px 8px', textAlign: 'right', color: GRAY, fontSize: 11 }}>{canSeePrices ? fmt(cost) : '—'}</td>
                                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{canSeePrices ? fmt(sell) : '—'}</td>
                                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--tz-text)' }}>{fmt(lineTotal)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )
          })()}

          {/* ── Summary & Totals ── */}
          <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
            <div style={{ padding: '12px 20px', borderBottom: `1px solid ${'var(--tz-border)'}` }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tz-text)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Summary</span>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: 'var(--tz-textSecondary)' }}>
                <span>Labor ({jobLines.length} {jobLines.length === 1 ? 'job' : 'jobs'})</span>
                <span style={{ fontWeight: 600 }}>{fmt(laborTotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: 'var(--tz-textSecondary)' }}>
                <span>Parts ({invoiceBillableParts.length} {invoiceBillableParts.length === 1 ? 'item' : 'items'})</span>
                <span style={{ fontWeight: 600 }}>{fmt(partsLineTotal + woPartsTotal)}</span>
              </div>
              {shopCharges.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: 'var(--tz-textSecondary)' }}>
                  <span>Shop Charges</span>
                  <span style={{ fontWeight: 600 }}>{fmt(shopCharges.reduce((s: number, c: any) => s + (c.amount || 0), 0))}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13, borderTop: `1px solid ${'var(--tz-border)'}`, marginTop: 6 }}>
                <span style={{ color: GRAY }}>Subtotal</span>
                <span style={{ fontWeight: 600 }}>{fmt(subtotal)}</span>
              </div>
              {taxAmt > 0 ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, color: GRAY }}>
                  <span>Tax ({taxRate}%{shop.tax_labor ? ' incl. labor' : ' parts only'})</span>
                  <span>{fmt(taxAmt)}</span>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, color: 'var(--tz-textTertiary)' }}>
                  <span>Tax</span><span>Exempt</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0 4px', borderTop: `1px solid ${'var(--tz-border)'}`, marginTop: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--tz-text)' }}>Invoice Total</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: GREEN }}>{fmt(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* ── Payment Instructions ── */}
          {shop.payment_payee_name && (
          <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
            <div style={{ padding: '10px 20px', borderBottom: `1px solid ${'var(--tz-border)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--tz-textSecondary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Payment Instructions</span>
              <span style={{ fontSize: 11, color: GRAY }}>Payable to: {shop.payment_payee_name}</span>
            </div>
            <div style={{ padding: '12px 20px' }}>
              {shop.payment_bank_name && <div style={{ fontSize: 11, color: GRAY, marginBottom: 10 }}>Bank: {shop.payment_bank_name}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
                {shop.payment_ach_account && (
                <div style={{ background: 'var(--tz-bgCard)', borderRadius: 6, padding: '10px 12px', border: `1px solid ${'var(--tz-border)'}`, overflow: 'hidden' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--tz-textTertiary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>ACH Payment</div>
                  <div style={{ fontSize: 11, color: 'var(--tz-textSecondary)', lineHeight: 1.6 }}>
                    <div>Account: <span style={{ fontWeight: 600 }}>{shop.payment_ach_account}</span></div>
                    {shop.payment_ach_routing && <div>Routing: <span style={{ fontWeight: 600 }}>{shop.payment_ach_routing}</span></div>}
                  </div>
                </div>
                )}
                {shop.payment_wire_account && (
                <div style={{ background: 'var(--tz-bgCard)', borderRadius: 6, padding: '10px 12px', border: `1px solid ${'var(--tz-border)'}`, overflow: 'hidden' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--tz-textTertiary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Wire Transfer</div>
                  <div style={{ fontSize: 11, color: 'var(--tz-textSecondary)', lineHeight: 1.6 }}>
                    <div>Account: <span style={{ fontWeight: 600 }}>{shop.payment_wire_account}</span></div>
                    {shop.payment_wire_routing && <div>Routing: <span style={{ fontWeight: 600 }}>{shop.payment_wire_routing}</span></div>}
                  </div>
                </div>
                )}
                {(shop.payment_zelle_email_1 || shop.payment_zelle_email_2) && (
                <div style={{ background: 'var(--tz-bgCard)', borderRadius: 6, padding: '10px 12px', border: `1px solid ${'var(--tz-border)'}`, overflow: 'hidden' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--tz-textTertiary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Zelle</div>
                  <div style={{ fontSize: 11, color: 'var(--tz-textSecondary)', lineHeight: 1.6, overflowWrap: 'break-word', wordBreak: 'break-all' }}>
                    {shop.payment_zelle_email_1 && <div>{shop.payment_zelle_email_1}</div>}
                    {shop.payment_zelle_email_2 && <div>{shop.payment_zelle_email_2}</div>}
                  </div>
                </div>
                )}
                {shop.payment_mail_payee && (
                <div style={{ background: 'var(--tz-bgCard)', borderRadius: 6, padding: '10px 12px', border: `1px solid ${'var(--tz-border)'}`, overflow: 'hidden' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--tz-textTertiary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Mail Check To</div>
                  <div style={{ fontSize: 11, color: 'var(--tz-textSecondary)', lineHeight: 1.6, overflowWrap: 'break-word' }}>
                    <div style={{ fontWeight: 600 }}>{shop.payment_mail_payee}</div>
                    {shop.payment_mail_address && <div>{shop.payment_mail_address}</div>}
                    {(shop.payment_mail_city || shop.payment_mail_state || shop.payment_mail_zip) && <div>{[shop.payment_mail_city, shop.payment_mail_state].filter(Boolean).join(', ')} {shop.payment_mail_zip || ''}</div>}
                  </div>
                </div>
                )}
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: GRAY }}>
                Please include {wo.invoices?.[0]?.invoice_number ? `invoice #${wo.invoices[0].invoice_number}` : wo.so_number} with your payment. Also accepted: Cash, Check, Credit/Debit Card.
              </div>
            </div>
          </div>
          )}

          {/* ── Actions & Documents ── */}
          <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {wo.invoice_status === 'draft' && !isViewOnly && (
                  <button onClick={() => invoiceAction('submit_to_accounting')} disabled={invoiceLoading} style={{ ...btnStyle(GREEN, 'var(--tz-bgLight)'), padding: '8px 20px', fontSize: 13, borderRadius: 8 }}>
                    {invoiceLoading ? 'Submitting...' : 'Send to Accounting'}
                  </button>
                )}
                {wo.invoice_status === 'accounting_review' && canEditPrices && (
                  <>
                    <button onClick={async () => {
                      setInvoiceLoading(true)
                      const res = await fetch('/api/accounting/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wo_id: wo.id, action: 'approve' }) })
                      setInvoiceLoading(false)
                      if (res.ok) await loadData()
                      else { const err = await res.json(); alert(err.error || 'Approve failed') }
                    }} disabled={invoiceLoading} style={{ ...btnStyle(GREEN, 'var(--tz-bgLight)'), padding: '8px 20px', fontSize: 13, borderRadius: 8 }}>Approve & Send</button>
                    <a href={wo.invoices?.[0]?.id ? `/invoices/${wo.invoices[0].id}` : getWorkorderRoute(wo.id)} style={{ ...btnStyle( 'var(--tz-bgLight)', BLUE), border: `1px solid ${BLUE}33`, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, borderRadius: 8 }}>Edit Invoice</a>
                  </>
                )}
                {wo.invoice_status === 'accounting_review' && !canEditPrices && (
                  <span style={{ fontSize: 12, color: AMBER, fontWeight: 600 }}>Awaiting accounting approval</span>
                )}
                {wo.invoice_status === 'sent' && canEditPrices && (
                  <button onClick={() => invoiceAction('mark_paid')} disabled={invoiceLoading} style={{ ...btnStyle(GREEN, 'var(--tz-bgLight)'), padding: '8px 20px', fontSize: 13, borderRadius: 8 }}>Record Payment</button>
                )}
                {wo.invoice_status === 'paid' && !isViewOnly && (
                  <button onClick={() => invoiceAction('close_wo')} disabled={invoiceLoading} style={{ ...btnStyle(GRAY, 'var(--tz-bgLight)'), padding: '8px 18px', fontSize: 13, borderRadius: 8 }}>Close Work Order</button>
                )}
                {wo.invoice_status === 'closed' && (
                  <span style={{ color: 'var(--tz-textSecondary)', fontWeight: 600, fontSize: 13 }}>Work Order Closed</span>
                )}
                {['sent', 'paid', 'closed'].includes(wo.invoice_status) && ACCOUNTING_ROLES.includes(userRole) && (
                  <button onClick={async () => {
                    if (!confirm('Reopen this invoice for accounting review? This will allow edits again.')) return
                    await invoiceAction('reopen')
                  }} disabled={invoiceLoading} style={{ ...btnStyle('transparent', AMBER), border: `1px solid ${AMBER}33`, padding: '6px 14px', fontSize: 12, borderRadius: 8 }}>
                    Reopen
                  </button>
                )}
              </div>
              {wo.invoices?.[0]?.id && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <a href={`/api/invoices/${wo.invoices[0].id}/pdf`} target="_blank" rel="noopener" style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${'var(--tz-border)'}`, background: 'var(--tz-bgCard)', color: 'var(--tz-textSecondary)', fontSize: 11, fontWeight: 600, textDecoration: 'none', fontFamily: FONT }}>PDF</a>
                  <a href={`/invoices/${wo.invoices[0].id}`} target="_blank" rel="noopener" onClick={e => { e.preventDefault(); const w = window.open(`/invoices/${wo.invoices[0].id}`, '_blank'); if (w) setTimeout(() => w.print(), 1500) }} style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${'var(--tz-border)'}`, background: 'var(--tz-bgCard)', color: 'var(--tz-textSecondary)', fontSize: 11, fontWeight: 600, textDecoration: 'none', cursor: 'pointer', fontFamily: FONT }}>Print</a>
                  <a href={`/invoices/${wo.invoices[0].id}`} style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${'var(--tz-border)'}`, background: 'var(--tz-bgCard)', color: 'var(--tz-textSecondary)', fontSize: 11, fontWeight: 600, textDecoration: 'none', fontFamily: FONT }}>View</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========== TAB 5: IMPORTED HISTORICAL INVOICE (read-only) ==========
          For historical imported WOs the Invoice tab is the single rich
          read-only detail page. Above-the-fold: invoice metadata (number /
          status / balance due). Below: the same Labor / Parts / Fees /
          Grand Total surface that used to live on the Estimate tab,
          rendered from external_data.historical_fullbay_snapshot when
          present, falling back to flat so_lines otherwise. */}
      {tab === 5 && wo.is_historical && (
        <div style={{ background: 'var(--tz-bgElevated)', borderRadius: 16, border: `1px solid ${'var(--tz-border)'}`, padding: 'clamp(12px, 3vw, 24px)' }}>
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--tz-text)' }}>Invoice (Imported History)</span>
          </div>
          {wo.invoices?.[0] && (
            <div style={{ ...cardStyle, marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'baseline', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13 }}>
                <div><span style={{ color: GRAY, marginRight: 6 }}>Invoice #</span><span style={{ fontWeight: 700 }}>{wo.invoices[0].invoice_number || '—'}</span></div>
                <div><span style={{ color: GRAY, marginRight: 6 }}>Status</span><span style={{ fontWeight: 700, color: wo.invoices[0].status === 'paid' ? GREEN : undefined }}>{(wo.invoices[0].status || '—').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</span></div>
                {wo.invoices[0].balance_due > 0 && wo.invoices[0].status !== 'paid' && (
                  <div><span style={{ color: GRAY, marginRight: 6 }}>Balance Due</span><span style={{ fontWeight: 700, color: AMBER }}>{fmt(wo.invoices[0].balance_due)}</span></div>
                )}
              </div>
            </div>
          )}
          {(() => {
            const thStyle: React.CSSProperties = {
              fontSize: 10,
              fontWeight: 700,
              color: GRAY,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              padding: '6px 8px',
            }

            // ── SNAPSHOT PATH ── grouped Fullbay source truth from external_data
            if (historicalSnapshot) {
              const snapLabor = snapshotComplaints.filter((c: any) => Number(c?.labor_total) > 0 || Number(c?.labor_hours_total) > 0 || (c?.note || '').trim())
              // Parts source: prefer repaired so_lines (partLines) over raw snapshot
              // when both exist, so anomaly-clamped quantities render instead of the
              // raw snapshot junk preserved for audit. Snapshot is fallback only.
              const partsUseRel = partLines.length > 0
              const showParts = partsUseRel || snapshotParts.length > 0
              const suppliesAmount = Number(snapshotTotals?.supplies_total) || 0
              const showFees = snapshotMiscCharges.length > 0 || suppliesAmount > 0
              const histGrand = Number(snapshotTotals?.total ?? snapshotTotals?.sub_total) || (wo.grand_total ? wo.grand_total : grandTotal)
              const laborTotalSnap = Number(snapshotTotals?.labor_total) || 0
              const partsTotalSnap = Number(snapshotTotals?.parts_total) || 0
              const miscTotalSnap = Number(snapshotTotals?.misc_charge_total) || 0
              const feesTotalSnap = miscTotalSnap + suppliesAmount
              const allLaborZero = laborTotalSnap === 0 && snapLabor.every((c: any) => Number(c?.labor_total) === 0 && Number(c?.labor_hours_total) === 0)
              const isHistoricalFeeOnly = allLaborZero && partsTotalSnap === 0 && showFees
              const showLabor = snapLabor.length > 0 && !isHistoricalFeeOnly
              const referenceLines: string[] = isHistoricalFeeOnly
                ? snapLabor.flatMap((c: any) => (c?.note || '').toString().trim().split(/\r?\n+/).map((s: string) => s.trim()).filter(Boolean))
                : []
              if (!showLabor && !showParts && !showFees && !histGrand) {
                return <div style={{ color: GRAY, fontSize: 13, padding: 20, textAlign: 'center' }}>No detail recorded for this imported work order.</div>
              }
              return (
                <div style={{ ...cardStyle, marginBottom: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12, color: 'var(--tz-text)' }}>
                    Detail
                    <span style={{ fontSize: 11, fontWeight: 600, color: GRAY, marginLeft: 8, padding: '2px 8px', borderRadius: 100, background: 'var(--tz-bgHover)' }}>read-only</span>
                  </div>

                  {referenceLines.length > 0 && (
                    <div style={{ marginBottom: 16, padding: '8px 10px', borderRadius: 6, background: 'var(--tz-bgHover)', fontSize: 12, color: 'var(--tz-textSecondary)' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Reference</div>
                      {referenceLines.length === 1 ? (
                        <div>{referenceLines[0]}</div>
                      ) : (
                        <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {referenceLines.map((it: string, i: number) => <li key={i}>{it}</li>)}
                        </ul>
                      )}
                    </div>
                  )}

                  {showLabor && (
                    <div style={{ marginBottom: 16 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: 'block' }}>Labor</span>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${'var(--tz-border)'}` }}>
                            <th style={{ ...thStyle, textAlign: 'left' }}>Description</th>
                            <th style={{ ...thStyle, textAlign: 'center', width: 60 }}>Hours</th>
                            <th style={{ ...thStyle, textAlign: 'right', width: 110 }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {snapLabor.map((cmp: any, i: number) => {
                            const note = (cmp?.note || '').toString().trim()
                            const noteLines = note ? note.split(/\r?\n+/).map((s: string) => s.trim()).filter(Boolean) : []
                            const hrs = Number(cmp?.labor_hours_total) || 0
                            const total = Number(cmp?.labor_total) || 0
                            return (
                              <tr key={i} style={{ borderBottom: `1px solid ${'var(--tz-border)'}`, verticalAlign: 'top' }}>
                                <td style={{ padding: '6px 8px' }}>
                                  {noteLines.length <= 1 ? (noteLines[0] || '—') : (
                                    <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                      {noteLines.map((it: string, j: number) => <li key={j}>{it}</li>)}
                                    </ul>
                                  )}
                                </td>
                                <td style={{ padding: '6px 8px', textAlign: 'center' }}>{hrs || '—'}</td>
                                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{fmt(total)}</td>
                              </tr>
                            )
                          })}
                          <tr style={{ fontWeight: 700 }}>
                            <td colSpan={2} style={{ padding: '8px 8px', textAlign: 'right' }}>Labor Total</td>
                            <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmt(laborTotalSnap)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {showParts && (
                    <div style={{ marginBottom: 16 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: 'block' }}>Parts</span>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${'var(--tz-border)'}` }}>
                            <th style={{ ...thStyle, textAlign: 'left' }}>Description</th>
                            <th style={{ ...thStyle, textAlign: 'left', width: 120 }}>Part #</th>
                            <th style={{ ...thStyle, textAlign: 'center', width: 50 }}>Qty</th>
                            <th style={{ ...thStyle, textAlign: 'right', width: 90 }}>Unit Price</th>
                            <th style={{ ...thStyle, textAlign: 'right', width: 100 }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(partsUseRel ? partLines : snapshotParts).map((p: any, i: number) => {
                            const desc = partsUseRel ? (p.description || p.real_name || p.rough_name || '—') : (p.description || '—')
                            const partNum = partsUseRel ? (p.part_number || '—') : (p.shop_part_number || p.vendor_part_number || '—')
                            const qty = partsUseRel ? (Number(p.quantity || 1) || 1) : (Number(p.quantity) || 1)
                            const unit = partsUseRel ? (Number(p.parts_sell_price || p.unit_price || 0) || 0) : (Number(p.selling_price) || 0)
                            const total = partsUseRel ? (Number(p.total_price || qty * unit) || 0) : +(qty * unit).toFixed(2)
                            return (
                              <tr key={partsUseRel ? p.id : `s${i}`} style={{ borderBottom: `1px solid ${'var(--tz-border)'}` }}>
                                <td style={{ padding: '6px 8px' }}>{desc}</td>
                                <td style={{ padding: '6px 8px', color: GRAY }}>{partNum}</td>
                                <td style={{ padding: '6px 8px', textAlign: 'center' }}>{qty}</td>
                                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(unit)}</td>
                                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{fmt(total)}</td>
                              </tr>
                            )
                          })}
                          <tr style={{ fontWeight: 700 }}>
                            <td colSpan={4} style={{ padding: '8px 8px', textAlign: 'right' }}>Parts Total</td>
                            <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmt(partsUseRel ? (partsLineTotal || 0) : partsTotalSnap)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {showFees && (
                    <div style={{ marginBottom: 16 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: 'block' }}>Fees & Charges</span>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${'var(--tz-border)'}` }}>
                            <th style={{ ...thStyle, textAlign: 'left' }}>Description</th>
                            <th style={{ ...thStyle, textAlign: 'center', width: 40 }}>Qty</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {snapshotMiscCharges.map((m: any, i: number) => {
                            const qty = Number(m?.quantity) || 1
                            const rate = Number(m?.rate) || 0
                            const amount = Number(m?.amount) || +(qty * rate).toFixed(2)
                            return (
                              <tr key={`m${i}`} style={{ borderBottom: `1px solid ${'var(--tz-border)'}` }}>
                                <td style={{ padding: '6px 8px' }}>{m?.description || '—'}</td>
                                <td style={{ padding: '6px 8px', textAlign: 'center' }}>{qty}</td>
                                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(rate)}</td>
                                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{fmt(amount)}</td>
                              </tr>
                            )
                          })}
                          {suppliesAmount > 0 && (
                            <tr style={{ borderBottom: `1px solid ${'var(--tz-border)'}` }}>
                              <td style={{ padding: '6px 8px' }}>Shop Supplies (imported)</td>
                              <td style={{ padding: '6px 8px', textAlign: 'center' }}>1</td>
                              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(suppliesAmount)}</td>
                              <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{fmt(suppliesAmount)}</td>
                            </tr>
                          )}
                          <tr style={{ fontWeight: 700 }}>
                            <td colSpan={3} style={{ padding: '8px 8px', textAlign: 'right' }}>Fees Total</td>
                            <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmt(feesTotalSnap)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 12, borderTop: `2px solid ${'var(--tz-border)'}` }}>
                    <span style={{ fontSize: 16, fontWeight: 800 }}>Grand Total</span>
                    <span style={{ fontSize: 20, fontWeight: 800, color: GREEN }}>{fmt(histGrand)}</span>
                  </div>
                </div>
              )
            }

            // ── FALLBACK PATH ── flat so_lines (historical WO without snapshot)
            const importedPartsFallback = partLines.length === 0 && (wo.parts_total || 0) > 0 && !partsLineTotal
            const showParts = partLines.length > 0 || importedPartsFallback
            const showFees = feeLines.length > 0
            const histGrand = wo.grand_total ? wo.grand_total : grandTotal
            const fallbackFeeOnly = (Number(laborTotal) || 0) === 0 && (Number(partsLineTotal) || 0) === 0 && (Number(wo.parts_total) || 0) === 0 && showFees
            const showLabor = jobLines.length > 0 && !fallbackFeeOnly
            const fallbackReferenceLines: string[] = fallbackFeeOnly
              ? jobLines.flatMap((l: any) => dedupeHistoricalLaborDisplayItems(parseHistoricalLaborItems(l.description))).filter(Boolean)
              : []
            if (!showLabor && !showParts && !showFees && !histGrand) {
              return <div style={{ color: GRAY, fontSize: 13, padding: 20, textAlign: 'center' }}>No detail recorded for this imported work order.</div>
            }
            return (
              <div style={{ ...cardStyle, marginBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12, color: 'var(--tz-text)' }}>
                  Detail
                  <span style={{ fontSize: 11, fontWeight: 600, color: GRAY, marginLeft: 8, padding: '2px 8px', borderRadius: 100, background: 'var(--tz-bgHover)' }}>read-only</span>
                </div>

                {fallbackReferenceLines.length > 0 && (
                  <div style={{ marginBottom: 16, padding: '8px 10px', borderRadius: 6, background: 'var(--tz-bgHover)', fontSize: 12, color: 'var(--tz-textSecondary)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Reference</div>
                    {fallbackReferenceLines.length === 1 ? (
                      <div>{fallbackReferenceLines[0]}</div>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {fallbackReferenceLines.map((it: string, i: number) => <li key={i}>{it}</li>)}
                      </ul>
                    )}
                  </div>
                )}

                {showLabor && (
                  <div style={{ marginBottom: 16 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: 'block' }}>Labor</span>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${'var(--tz-border)'}` }}>
                          <th style={{ ...thStyle, textAlign: 'left' }}>Description</th>
                          <th style={{ ...thStyle, textAlign: 'center', width: 60 }}>Hours</th>
                          <th style={{ ...thStyle, textAlign: 'right', width: 110 }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobLines.map((l: any) => {
                          const items = dedupeHistoricalLaborDisplayItems(parseHistoricalLaborItems(l.description))
                          const hrs = Number(l.billed_hours || l.actual_hours || l.estimated_hours || 0) || 0
                          const total = Number(l.total_price || (l.quantity || 1) * (l.unit_price || 0)) || 0
                          return (
                            <tr key={l.id} style={{ borderBottom: `1px solid ${'var(--tz-border)'}`, verticalAlign: 'top' }}>
                              <td style={{ padding: '6px 8px' }}>
                                {items.length === 1 ? items[0] : (
                                  <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {items.map((it, i) => <li key={i}>{it}</li>)}
                                  </ul>
                                )}
                              </td>
                              <td style={{ padding: '6px 8px', textAlign: 'center' }}>{hrs || '—'}</td>
                              <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{fmt(total)}</td>
                            </tr>
                          )
                        })}
                        <tr style={{ fontWeight: 700 }}>
                          <td colSpan={2} style={{ padding: '8px 8px', textAlign: 'right' }}>Labor Total</td>
                          <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmt(laborTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {showParts && (
                  <div style={{ marginBottom: 16 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: 'block' }}>Parts</span>
                    {partLines.length > 0 ? (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${'var(--tz-border)'}` }}>
                            <th style={{ ...thStyle, textAlign: 'left' }}>Description</th>
                            <th style={{ ...thStyle, textAlign: 'left', width: 120 }}>Part #</th>
                            <th style={{ ...thStyle, textAlign: 'center', width: 50 }}>Qty</th>
                            <th style={{ ...thStyle, textAlign: 'right', width: 90 }}>Unit Price</th>
                            <th style={{ ...thStyle, textAlign: 'right', width: 100 }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {partLines.map((p: any) => {
                            const desc = p.description || p.real_name || p.rough_name || '—'
                            const unit = Number(p.parts_sell_price || p.unit_price || 0) || 0
                            const qty = Number(p.quantity || 1) || 1
                            const total = Number(p.total_price || qty * unit) || 0
                            return (
                              <tr key={p.id} style={{ borderBottom: `1px solid ${'var(--tz-border)'}` }}>
                                <td style={{ padding: '6px 8px' }}>{desc}</td>
                                <td style={{ padding: '6px 8px', color: GRAY }}>{p.part_number || '—'}</td>
                                <td style={{ padding: '6px 8px', textAlign: 'center' }}>{qty}</td>
                                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(unit)}</td>
                                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{fmt(total)}</td>
                              </tr>
                            )
                          })}
                          <tr style={{ fontWeight: 700 }}>
                            <td colSpan={4} style={{ padding: '8px 8px', textAlign: 'right' }}>Parts Total</td>
                            <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmt(partsLineTotal || 0)}</td>
                          </tr>
                        </tbody>
                      </table>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 8px', borderTop: `1px solid ${'var(--tz-border)'}`, borderBottom: `1px solid ${'var(--tz-border)'}` }}>
                        <span style={{ color: GRAY }}>Parts (imported summary)</span>
                        <span style={{ fontWeight: 700 }}>{fmt(wo.parts_total || 0)}</span>
                      </div>
                    )}
                  </div>
                )}

                {showFees && (
                  <div style={{ marginBottom: 16 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: 'block' }}>Fees & Charges</span>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${'var(--tz-border)'}` }}>
                          <th style={{ ...thStyle, textAlign: 'left' }}>Description</th>
                          <th style={{ ...thStyle, textAlign: 'center', width: 40 }}>Qty</th>
                          <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                          <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {feeLines.map((f: any) => {
                          const lineTotal = f.total_price || (f.quantity || 1) * (f.unit_price || 0)
                          return (
                            <tr key={f.id} style={{ borderBottom: `1px solid ${'var(--tz-border)'}` }}>
                              <td style={{ padding: '6px 8px' }}>{f.description || '—'}</td>
                              <td style={{ padding: '6px 8px', textAlign: 'center' }}>{f.quantity || 1}</td>
                              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(f.unit_price || 0)}</td>
                              <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{fmt(lineTotal)}</td>
                            </tr>
                          )
                        })}
                        <tr style={{ fontWeight: 700 }}>
                          <td colSpan={3} style={{ padding: '8px 8px', textAlign: 'right' }}>Fees Total</td>
                          <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmt(chargesTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 12, borderTop: `2px solid ${'var(--tz-border)'}` }}>
                  <span style={{ fontSize: 16, fontWeight: 800 }}>Grand Total</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: GREEN }}>{fmt(histGrand)}</span>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* ========== INVOICE STATUS (compact — shown on other tabs, no duplicate actions) ========== */}
      {!wo.is_historical && tab !== 5 && wo.invoice_status && wo.invoice_status !== 'draft' && (
        <div style={{ ...cardStyle, marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: GRAY }}>Invoice</span>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100, textTransform: 'uppercase',
            background: wo.invoice_status === 'closed' ? 'var(--tz-surfaceMuted)' : wo.invoice_status === 'paid' ? 'var(--tz-successBg)' : wo.invoice_status === 'sent' ? 'var(--tz-accentBg)' : 'var(--tz-warningBg)',
            color: wo.invoice_status === 'closed' ? GRAY : wo.invoice_status === 'paid' ? GREEN : wo.invoice_status === 'sent' ? BLUE : AMBER,
          }}>{(wo.invoice_status || '').replace(/_/g, ' ')}</span>
        </div>
      )}

      {/* Mechanic role — hide prices indicator */}
      {isMechanic && !wo.is_historical && (
        <div style={{ ...cardStyle, marginTop: 12, background: 'var(--tz-bgHover)', textAlign: 'center', color: GRAY, fontSize: 12, padding: 12 }}>
          Pricing information is managed by the service department
        </div>
      )}

      {/* ========== MODALS ========== */}

      {/* Team Modal */}
      {showTeamModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowTeamModal(false)}>
          <div style={{ background: 'var(--tz-bgCard)', borderRadius: 12, padding: 24, width: 400, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Team Assignment</span>
              <button onClick={() => setShowTeamModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span style={labelStyle}>Team</span>
              <select value={teamAssign.team || ''} onChange={e => setTeamAssign(p => ({ ...p, team: e.target.value }))} style={inputStyle}>
                <option value="">No Team</option>
                {['A', 'B', 'C', 'D'].map(t => <option key={t} value={t}>Team {t}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span style={labelStyle}>Bay</span>
              <select value={teamAssign.bay || ''} onChange={e => setTeamAssign(p => ({ ...p, bay: e.target.value }))} style={inputStyle}>
                <option value="">No Bay</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(b => <option key={b} value={b.toString()}>Bay {b}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <span style={labelStyle}>Lead Tech</span>
              <select value={teamAssign.assigned_tech || ''} onChange={e => setTeamAssign(p => ({ ...p, assigned_tech: e.target.value }))} style={inputStyle}>
                <option value="">Unassigned</option>
                {mechanics.map(m => <option key={m.id} value={m.id}>{m.full_name} {m.team ? `- Team ${m.team}` : ''}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowTeamModal(false)} style={btnStyle( 'var(--tz-bgLight)', GRAY)}>Cancel</button>
              <button onClick={saveTeamAssign} style={btnStyle(BLUE, 'var(--tz-bgLight)')}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {assignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setAssignModal(null)}>
          <div style={{ background: 'var(--tz-bgCard)', borderRadius: 12, padding: 24, width: 480, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Assign Mechanics — Job {assignModal.idx + 1}</span>
              <button onClick={() => setAssignModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            {/* Suggested mechanics */}
            {(suggestions.length > 0 || suggestionsLoading) && (
              <div style={{ marginBottom: 12 }}>
                <span style={labelStyle}>Suggested</span>
                {suggestionsLoading ? (
                  <div style={{ fontSize: 11, color: GRAY, padding: '6px 0' }}>Loading suggestions...</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {suggestions.filter(s => !assignList.some(a => a.user_id === s.user_id)).map(s => (
                      <div key={s.user_id} onClick={() => addMechToList(s.user_id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, border: `1px solid ${'var(--tz-border)'}`, cursor: 'pointer', background: 'var(--tz-bgCard)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--tz-accentBg)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'var(--tz-bgCard)')}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                          <div style={{ fontSize: 10, color: GRAY }}>
                            {s.matchingSkills?.length > 0
                              ? s.matchingSkills.map((sk: any) => `${sk.skill}${sk.certified ? ' ✓' : ''}`).join(', ')
                              : s.status === 'on_job' ? 'Clocked in' : 'Available'}
                            {s.jobsInQueue > 0 ? ` · ${s.jobsInQueue} active job${s.jobsInQueue > 1 ? 's' : ''}` : ' · No active jobs'}
                          </div>
                        </div>
                        <span style={{ fontSize: 9, fontWeight: 700, color: s.score >= 50 ? GREEN : s.score >= 20 ? AMBER : GRAY, background: s.score >= 50 ? 'var(--tz-successBg)' : s.score >= 20 ? 'var(--tz-warningBg)' : 'var(--tz-surfaceMuted)', padding: '2px 6px', borderRadius: 4 }}>
                          {s.score >= 50 ? 'Strong' : s.score >= 20 ? 'Fair' : 'Low'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Add mechanic dropdown */}
            <div style={{ marginBottom: 12 }}>
              <span style={labelStyle}>{suggestions.length > 0 ? 'Or select manually' : 'Add Mechanic'}</span>
              <select onChange={e => { addMechToList(e.target.value); e.target.value = '' }} style={inputStyle} defaultValue="">
                <option value="" disabled>Select mechanic...</option>
                {mechanics.filter(m => !assignList.some(a => a.user_id === m.id)).map(m => (
                  <option key={m.id} value={m.id}>{m.full_name} {m.team ? `(Team ${m.team})` : ''} {m.skills ? `[${m.skills}]` : ''}</option>
                ))}
              </select>
            </div>

            {/* Assigned list */}
            {assignList.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                {assignList.map((a, i) => (
                  <div key={a.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${'var(--tz-border)'}` }}>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{a.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        type="number"
                        value={a.percentage}
                        onChange={e => {
                          const val = parseInt(e.target.value) || 0
                          setAssignList(prev => prev.map((p, pi) => pi === i ? { ...p, percentage: val } : p))
                        }}
                        style={{ ...inputStyle, width: 60, textAlign: 'center' }}
                        min={0}
                        max={100}
                      />
                      <span style={{ fontSize: 12, color: GRAY }}>%</span>
                    </div>
                    <button onClick={() => removeMechFromList(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: RED }}><X size={16} /></button>
                  </div>
                ))}
                <div style={{ fontSize: 11, color: assignList.reduce((s, a) => s + a.percentage, 0) === 100 ? GREEN : RED, marginTop: 6, fontWeight: 700 }}>
                  Total: {assignList.reduce((s, a) => s + a.percentage, 0)}%
                </div>
              </div>
            )}

            {assignList.length === 0 && <div style={{ fontSize: 13, color: GRAY, padding: 16, textAlign: 'center' }}>No mechanics assigned. Select one above.</div>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setAssignModal(null)} style={btnStyle( 'var(--tz-bgLight)', GRAY)}>Cancel</button>
              <button onClick={saveAssignments} style={btnStyle(BLUE, 'var(--tz-bgLight)')}>Save Assignments</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Part Modal — TruckZen-styled replacement for native prompt() */}
      {addPartModal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => { if (!addPartModal.saving) setAddPartModal({ open: false, name: '', saving: false }) }}>
          <div style={{ background: 'var(--tz-bgCard)', borderRadius: 12, padding: 24, width: 380, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Add Part</span>
              <button onClick={() => { if (!addPartModal.saving) setAddPartModal({ open: false, name: '', saving: false }) }} style={{ background: 'none', border: 'none', cursor: addPartModal.saving ? 'not-allowed' : 'pointer' }} disabled={addPartModal.saving}><X size={18} /></button>
            </div>
            <span style={labelStyle}>Part name or description</span>
            <input
              autoFocus
              type="text"
              value={addPartModal.name}
              onChange={e => setAddPartModal(p => ({ ...p, name: e.target.value }))}
              onKeyDown={async e => {
                if (e.key === 'Enter' && !addPartModal.saving) {
                  const name = addPartModal.name.trim()
                  if (!name) return
                  setAddPartModal(p => ({ ...p, saving: true }))
                  try {
                    await fetch('/api/so-lines', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ so_id: id, line_type: 'part', description: name, rough_name: name, parts_status: 'rough', quantity: 1 }),
                    })
                    await refreshOpenEstimateIfAny()
                    await loadData()
                  } finally {
                    setAddPartModal({ open: false, name: '', saving: false })
                  }
                }
              }}
              placeholder="e.g. Oil Filter"
              style={inputStyle}
              disabled={addPartModal.saving}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setAddPartModal({ open: false, name: '', saving: false })} disabled={addPartModal.saving} style={btnStyle('var(--tz-bgLight)', GRAY)}>Cancel</button>
              <button
                onClick={async () => {
                  const name = addPartModal.name.trim()
                  if (!name || addPartModal.saving) return
                  setAddPartModal(p => ({ ...p, saving: true }))
                  try {
                    await fetch('/api/so-lines', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ so_id: id, line_type: 'part', description: name, rough_name: name, parts_status: 'rough', quantity: 1 }),
                    })
                    await refreshOpenEstimateIfAny()
                    await loadData()
                  } finally {
                    setAddPartModal({ open: false, name: '', saving: false })
                  }
                }}
                disabled={addPartModal.saving || !addPartModal.name.trim()}
                style={{ ...btnStyle(BLUE, 'var(--tz-bgLight)'), opacity: (addPartModal.saving || !addPartModal.name.trim()) ? 0.5 : 1, cursor: (addPartModal.saving || !addPartModal.name.trim()) ? 'not-allowed' : 'pointer' }}
              >
                {addPartModal.saving ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hours Modal */}
      {hoursModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setHoursModal(null)}>
          <div style={{ background: 'var(--tz-bgCard)', borderRadius: 12, padding: 24, width: 360, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Log Hours</span>
              <button onClick={() => setHoursModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            {[
              { key: 'estimated_hours', label: 'Estimated Hours' },
              { key: 'actual_hours', label: 'Actual Hours' },
              { key: 'billed_hours', label: 'Billed Hours' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <span style={labelStyle}>{f.label}</span>
                <input
                  type="number"
                  step="0.25"
                  value={hoursModal[f.key] || ''}
                  onChange={e => setHoursModal((p: any) => ({ ...p, [f.key]: e.target.value }))}
                  style={inputStyle}
                  placeholder="0"
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={() => setHoursModal(null)} style={btnStyle( 'var(--tz-bgLight)', GRAY)}>Cancel</button>
              <button onClick={saveHours} style={btnStyle(BLUE, 'var(--tz-bgLight)')}>Save Hours</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setDeleteConfirm(false)}>
          <div style={{ background: 'var(--tz-bgCard)', borderRadius: 12, padding: 24, width: 380, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: RED }}>Void Work Order</div>
            <div style={{ fontSize: 13, color: GRAY, marginBottom: 16 }}>
              This will void the work order. Type <strong>DELETE</strong> to confirm.
            </div>
            <input
              value={deleteText}
              onChange={e => setDeleteText(e.target.value)}
              placeholder="Type DELETE"
              style={{ ...inputStyle, marginBottom: 12 }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setDeleteConfirm(false); setDeleteText('') }} style={btnStyle( 'var(--tz-bgLight)', GRAY)}>Cancel</button>
              <button onClick={deleteWO} disabled={deleteText !== 'DELETE'} style={{ ...btnStyle(RED, 'var(--tz-bgLight)'), opacity: deleteText !== 'DELETE' ? 0.5 : 1 }}>Void</button>
            </div>
          </div>
        </div>
      )}

      {/* Estimate Approval Modal — 3 paths */}
      {approvalModal && (() => {
        const estimateRecord = wo.estimates?.[0]
        const estimateId = estimateRecord?.id || wo.estimate_id
        const estimateUpdatedAt = estimateRecord?.updated_at
        const hasContact = !!(contactEmail || contactPhone)

        async function saveContactInfo() {
          if (!customer?.id) return
          const updates: Record<string, any> = {}
          if (contactEmail !== (customer.email || '')) updates.email = contactEmail
          if (contactPhone !== (customer.phone || '')) updates.phone = contactPhone
          if (Object.keys(updates).length > 0) {
            await fetch(`/api/customers/${customer.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updates),
            })
          }
          // Also update estimate with contact info
          if (estimateId) {
            const estRes = await fetch(`/api/estimates/${estimateId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ customer_email: contactEmail, customer_phone: contactPhone, expected_updated_at: estimateUpdatedAt }),
            })
            if (estRes.status === 409) {
              setToastMsg('This record was updated by someone else. Refresh and try again.')
              setTimeout(() => setToastMsg(''), 4000)
              return
            }
          }
        }

        // Returns the id + updated_at of either the existing open estimate (from the
        // closure) or a freshly created/reused one from POST /api/estimates. null on
        // failure. updatedAt is required by PATCH /api/estimates/{id} as the optimistic
        // concurrency check; the API returns the full row on create_from_wo so a fresh
        // row carries its own updated_at.
        async function ensureEstimate(): Promise<{ id: string; updatedAt: string | null } | null> {
          if (estimateId) return { id: estimateId, updatedAt: estimateUpdatedAt || null }
          try {
            const r = await fetch('/api/estimates', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'create_from_wo', wo_id: id }),
            })
            const body = await r.json().catch(() => null)
            if (!r.ok || !body?.id) {
              console.error('[wo.estimate.ensure] create_from_wo failed', { woId: id, status: r.status, error: body?.error })
              return null
            }
            return { id: body.id as string, updatedAt: (body.updated_at as string) || null }
          } catch (e: any) {
            console.error('[wo.estimate.ensure] network error', { woId: id, error: e?.message })
            return null
          }
        }

        async function approveEstimate(method: 'in_person' | 'printed_signed', notes?: string) {
          if (approvingEstimate) return
          setApprovingEstimate(true)
          try {
            // Packet-3 modal-reuse: supplement context routes to the batch-scoped
            // staff respond endpoint. Estimate 1 state machine is not touched.
            if (approvalModal && approvalModal.kind === 'supplement') {
              if (!wo.estimate_id) {
                setToastMsg('Estimate not found')
                setTimeout(() => setToastMsg(''), 4000)
                return
              }
              const res = await fetch(`/api/estimates/${wo.estimate_id}/supplement-respond`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'approve',
                  supplement_batch_id: approvalModal.batchId,
                  approval_method: method,
                  approval_notes: notes || null,
                }),
              })
              if (!res.ok) {
                const errBody = await res.json().catch(() => null)
                setToastMsg(errBody?.error || 'Failed to approve estimate')
                setTimeout(() => setToastMsg(''), 4000)
                return
              }
              logActivity(`Estimate ${approvalModal.estimateNumber} approved ${method === 'in_person' ? 'in person' : '(printed and signed)'} by ${user?.full_name || 'service writer'}${notes ? ` — Notes: ${notes}` : ''}`)
              setApprovalModal(null)
              setApprovalConfirmModal(null)
              setPrintedReady(false)
              setToastMsg(`Estimate ${approvalModal.estimateNumber} approved`)
              setTimeout(() => setToastMsg(''), 4000)
              await loadData()
              return
            }
            const result = await ensureEstimate()
            if (!result) {
              setToastMsg('Could not prepare estimate for approval — try again')
              setTimeout(() => setToastMsg(''), 4000)
              return
            }
            const { id: effectiveId, updatedAt } = result
            const estRes = await fetch(`/api/estimates/${effectiveId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'approved', approval_method: method, approved_by: user?.id, approved_at: new Date().toISOString(), customer_notes: notes || null, expected_updated_at: updatedAt }),
            })
            if (estRes.status === 409) {
              setToastMsg('This record was updated by someone else. Refresh and try again.')
              setTimeout(() => setToastMsg(''), 4000)
              return
            }
            if (!estRes.ok) {
              const errBody = await estRes.json().catch(() => null)
              console.error('[wo.estimate.approve] estimates PATCH failed', { woId: id, estimateId: effectiveId, method, status: estRes.status, error: errBody?.error })
              setToastMsg('Failed to approve estimate')
              setTimeout(() => setToastMsg(''), 4000)
              return
            }
            // Only after the estimate row is successfully approved, propagate to the WO.
            // approval_method is intentionally NOT sent here; the method is recorded on
            // estimates.approval_method above.
            // The estimate PATCH handler side-effects service_orders.status on approved
            // transitions (and the trg_so_updated trigger bumps service_orders.updated_at
            // regardless of the handler's intent), so our closure's wo.updated_at is
            // stale by the time we PATCH below. Refresh via a fresh GET; fall back to
            // the closure value on refresh failure and let the existing 409 handling
            // decide.
            let woUpdatedAt: string | undefined = wo?.updated_at
            try {
              const woFreshRes = await fetch(`/api/work-orders/${id}`)
              if (woFreshRes.ok) {
                const woFresh = await woFreshRes.json().catch(() => null)
                if (typeof woFresh?.updated_at === 'string') woUpdatedAt = woFresh.updated_at
              } else {
                console.error('[wo.estimate.approve] WO refresh GET failed', { woId: id, status: woFreshRes.status })
              }
            } catch (e: any) {
              console.error('[wo.estimate.approve] WO refresh network error', { woId: id, error: e?.message })
            }
            const woRes = await fetch(`/api/work-orders/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ estimate_approved: true, estimate_status: 'approved', expected_updated_at: woUpdatedAt }),
            })
            if (woRes.status === 409) {
              setToastMsg('This record was updated by someone else. Refresh and try again.')
              setTimeout(() => setToastMsg(''), 4000)
              return
            }
            if (!woRes.ok) {
              const errBody = await woRes.json().catch(() => null)
              console.error('[wo.estimate.approve] work-orders PATCH failed', { woId: id, estimateId: effectiveId, method, status: woRes.status, error: errBody?.error })
              setToastMsg('Estimate approved but work order update failed — refresh to retry')
              setTimeout(() => setToastMsg(''), 5000)
              return
            }
            const methodLabel = method === 'in_person' ? 'in person' : '(printed and signed)'
            logActivity(`Estimate approved ${methodLabel} by ${user?.full_name || 'service writer'}${notes ? ` — Notes: ${notes}` : ''}`)
            try {
              const { createNotification, getUserIdsByRole } = await import('@/lib/createNotification')
              const mgrs = await getUserIdsByRole(wo.shop_id, ['owner', 'gm', 'shop_manager', 'floor_manager'])
              if (mgrs.length > 0) await createNotification({ shopId: wo.shop_id, recipientId: mgrs, type: 'estimate_approved', title: `Estimate approved — WO #${wo.so_number}`, body: `Ready to assign. Total: ${fmt(grandTotal)}`, link: `/work-orders/${id}`, relatedWoId: id })
            } catch {}
            setApprovalModal(null)
            setApprovalConfirmModal(null)
            setPrintedReady(false)
            setToastMsg('Estimate approved — work order activated')
            setTimeout(() => setToastMsg(''), 4000)
            await loadData()
          } finally {
            setApprovingEstimate(false)
          }
        }

        async function sendEstimateEmail() {
          if (sendingEstimate) return
          setSendingEstimate(true)
          setSendError(null)
          try {
            // Packet-3 modal-reuse: supplement context routes to the batch-scoped
            // send endpoint instead of /api/estimates/[id]/send.
            if (approvalModal && approvalModal.kind === 'supplement') {
              if (!wo.estimate_id) {
                setToastMsg('Estimate not found')
                setTimeout(() => setToastMsg(''), 4000)
                return
              }
              const res = await fetch(`/api/estimates/${wo.estimate_id}/send-supplement`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ supplement_batch_id: approvalModal.batchId }),
              })
              if (res.ok) {
                logActivity(`Estimate ${approvalModal.estimateNumber} sent to ${contactEmail || contactPhone}`)
                setToastMsg(`Estimate ${approvalModal.estimateNumber} sent to customer`)
                setTimeout(() => setToastMsg(''), 4000)
              } else {
                const errBody = await res.json().catch(() => null)
                console.error('[wo.estimate.send-supplement] send failed', { woId: id, estimateId: wo.estimate_id, batchId: approvalModal.batchId, status: res.status, error: errBody?.error })
                setSendError(`Failed to send estimate: ${errBody?.error || `HTTP ${res.status}`}`)
                return
              }
              setApprovalModal(null)
              await loadData()
              return
            }
            await saveContactInfo()
            const result = await ensureEstimate()
            if (!result) {
              setToastMsg('Could not prepare estimate — try again')
              setTimeout(() => setToastMsg(''), 4000)
              return
            }
            const effectiveId = result.id
            // Send the user-selected recipient explicitly so the server does
            // not silently fall back to a stale estimate.customer_email when
            // the saveContactInfo PATCH above 409s or is skipped.
            //
            // Phase 2A: when extra customer_contacts checkboxes are selected,
            // pass them as `to_emails` (server validates each against the
            // estimate's customer_id and sends one email per recipient). The
            // legacy `to_email` field is kept for back-compat when no extras
            // are picked, so existing single-recipient behavior is unchanged.
            const primaryEmail = contactEmail.trim()
            const primaryEmailLower = primaryEmail.toLowerCase()
            const extraEmails = Array.from(selectedExtraEmails).filter(e => e && e !== primaryEmailLower)
            const hasExtras = extraEmails.length > 0
            const sendBody: Record<string, unknown> = {
              to_phone: contactPhone.trim() || undefined,
            }
            if (hasExtras) {
              sendBody.to_emails = primaryEmail ? [primaryEmail, ...extraEmails] : extraEmails
            } else {
              sendBody.to_email = primaryEmail || undefined
            }
            const res = await fetch(`/api/estimates/${effectiveId}/send`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(sendBody),
            })
            if (res.ok) {
              const recipientLabel = hasExtras
                ? `${(primaryEmail ? 1 : 0) + extraEmails.length} recipients`
                : (contactEmail || contactPhone)
              logActivity(`Estimate sent to ${recipientLabel}`)
              setToastMsg('Estimate sent to customer')
              setTimeout(() => setToastMsg(''), 4000)
              setApprovalModal(null)
              await loadData()
            } else {
              const errBody = await res.json().catch(() => null)
              console.error('[wo.estimate.send] send failed', { woId: id, estimateId: effectiveId, status: res.status, error: errBody?.error })
              setSendError(`Failed to send estimate: ${errBody?.error || `HTTP ${res.status}`}`)
              // Keep modal open so the user can read the error and retry.
            }
          } finally {
            setSendingEstimate(false)
          }
        }

        // Packet-3 modal-reuse: modal title + summary total branch on context.
        // For supplement context the total is summed from the specific batch's
        // lines/wo_parts using the same rate/price formulas; Estimate 1 keeps
        // the global grandTotal. Formulas unchanged — display only.
        const modalTitle = approvalModal && approvalModal.kind === 'supplement'
          ? `Get Estimate ${approvalModal.estimateNumber} Approval`
          : 'Get Estimate Approval'
        const modalTotal = (() => {
          if (approvalModal && approvalModal.kind === 'supplement') {
            const bid = approvalModal.batchId
            const labor = jobLines
              .filter((l: any) => l.is_additional === true && l.supplement_batch_id === bid)
              .reduce((s: number, l: any) => s + (Number(l.billed_hours || l.actual_hours || l.estimated_hours || 0) * laborRate), 0)
            const partsFromLines = partLines
              .filter((p: any) => p.is_additional === true && p.supplement_batch_id === bid)
              .reduce((s: number, p: any) => s + (Number(p.parts_sell_price || p.unit_price || 0) * Number(p.quantity || 1)), 0)
            const partsFromWoParts = woParts
              .filter((p: any) => p.is_additional === true && p.supplement_batch_id === bid)
              .reduce((s: number, p: any) => s + (Number(p.unit_cost || 0) * Number(p.quantity || 1)), 0)
            return labor + partsFromLines + partsFromWoParts
          }
          return grandTotal
        })()

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => { setSendError(null); setApprovalModal(null) }}>
            <div style={{ background: 'var(--tz-bgCard)', borderRadius: 12, padding: 24, width: 520, maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--tz-text)' }}>{modalTitle}</span>
                {/* Modal close — dark-mode contrast lift (packet-4).
                    Larger hit target, brighter icon, clear affordance. */}
                <button
                  onClick={() => { setSendError(null); setApprovalModal(null) }}
                  aria-label="Close"
                  style={{
                    background: 'transparent',
                    border: `1px solid ${'var(--tz-border)'}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--tz-text)',
                  }}
                >
                  <X size={18} />
                </button>
              </div>
              <div style={{ fontSize: 13, marginBottom: 16, padding: '10px 14px', background: 'var(--tz-bgHover)', borderRadius: 8 }}>
                <div style={{ marginBottom: 4 }}>Estimate total: <strong style={{ color: GREEN }}>{fmt(modalTotal)}</strong></div>
                <div>Customer: <strong>{customer?.contact_name || customer?.company_name || '—'}</strong></div>
              </div>

              {/* Contact fields — always visible, always editable */}
              <div style={{ marginBottom: 16, padding: '12px 14px', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Send Estimate To</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: GRAY, marginBottom: 4, display: 'block' }}>Email</label>
                    <input
                      type="email"
                      name="estimate-recipient-email"
                      autoComplete="email"
                      inputMode="email"
                      value={contactEmail}
                      onChange={e => setContactEmail(e.target.value)}
                      onBlur={saveContactInfo}
                      placeholder="customer@email.com"
                      style={{ ...inputStyle, fontSize: 12 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: GRAY, marginBottom: 4, display: 'block' }}>Phone</label>
                    <input
                      type="tel"
                      name="estimate-recipient-phone"
                      autoComplete="tel"
                      inputMode="tel"
                      value={contactPhone}
                      onChange={e => setContactPhone(e.target.value)}
                      onBlur={saveContactInfo}
                      placeholder="+1 (555) 000-0000"
                      style={{ ...inputStyle, fontSize: 12 }}
                    />
                  </div>
                </div>
                {!hasContact && (
                  <div style={{ padding: '6px 8px', background: 'var(--tz-warningBg)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 6, fontSize: 11, color: 'var(--tz-warning)', marginTop: 8 }}>
                    Add at least one contact method to send estimate
                  </div>
                )}
              </div>

              {/* Saved customer contacts as additional recipients (Phase 2A).
                  Only shown when the customer has saved contacts. None are
                  preselected — the service writer must opt each one in. The
                  primary email above is always sent if present; checked
                  contacts are sent in addition. Internal app users belong in
                  TruckZen dashboards, not here. */}
              {customerContacts.filter(c => c.email && c.email.trim()).length > 0 && (
                <div style={{ marginBottom: 16, padding: '12px 14px', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Also send to (optional)</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {customerContacts.filter(c => c.email && c.email.trim()).map(contact => {
                      const emailKey = (contact.email || '').trim().toLowerCase()
                      const checked = selectedExtraEmails.has(emailKey)
                      const matchesPrimary = emailKey === contactEmail.trim().toLowerCase()
                      return (
                        <label key={contact.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: matchesPrimary ? 'not-allowed' : 'pointer', opacity: matchesPrimary ? 0.5 : 1 }}>
                          <input
                            type="checkbox"
                            checked={checked && !matchesPrimary}
                            disabled={matchesPrimary}
                            onChange={e => {
                              setSelectedExtraEmails(prev => {
                                const next = new Set(prev)
                                if (e.target.checked) next.add(emailKey); else next.delete(emailKey)
                                return next
                              })
                            }}
                          />
                          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <strong style={{ color: 'var(--tz-text)' }}>{contact.name || contact.email}</strong>
                            <span style={{ color: GRAY }}> — {contact.email}</span>
                            {contact.role && <span style={{ color: GRAY }}> · {contact.role}</span>}
                          </span>
                          {contact.is_primary && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'var(--tz-bgLight)', color: GRAY, border: `1px solid ${'var(--tz-border)'}` }}>PRIMARY</span>
                          )}
                          {matchesPrimary && (
                            <span style={{ fontSize: 10, color: GRAY }}>(already in primary)</span>
                          )}
                        </label>
                      )
                    })}
                  </div>
                  <div style={{ fontSize: 11, color: GRAY, marginTop: 8 }}>
                    Only checked recipients will receive the estimate link. Internal TruckZen app users see estimates in their dashboards.
                  </div>
                </div>
              )}

              {/* Path 1: Send Estimate */}
              <div style={{ marginBottom: 12, padding: '12px 14px', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Send Estimate</div>
                <div style={{ fontSize: 12, color: GRAY, marginBottom: 8 }}>
                  Send estimate via email and/or SMS with approval link
                  {contactEmail && (
                    <span style={{ display: 'block', marginTop: 4, color: 'var(--tz-textSecondary)' }}>
                      Recipient: <strong style={{ color: 'var(--tz-text)' }}>{contactEmail}</strong>
                    </span>
                  )}
                </div>
                {hasBlockingJobLineIssue && (
                  <div role="alert" style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(220,38,38,0.25)', background: 'var(--tz-dangerBg)', color: RED, fontSize: 12, lineHeight: 1.4 }}>
                    Fix highlighted job lines before sending estimate.
                  </div>
                )}
                <button
                  onClick={sendEstimateEmail}
                  disabled={!hasContact || sendingEstimate || hasBlockingJobLineIssue}
                  style={{ ...btnStyle(BLUE, 'var(--tz-bgLight)'), width: '100%', justifyContent: 'center', opacity: (hasContact && !sendingEstimate && !hasBlockingJobLineIssue) ? 1 : 0.5, cursor: (hasContact && !sendingEstimate && !hasBlockingJobLineIssue) ? 'pointer' : 'not-allowed' }}
                >
                  {sendingEstimate ? 'Sending…' : `Send Estimate${contactEmail && contactPhone ? ' (Email + SMS)' : contactEmail ? ' (Email)' : contactPhone ? ' (SMS)' : ''}`}
                </button>
                {sendError && (
                  <div role="alert" style={{ marginTop: 10, padding: '10px 12px', borderRadius: 6, border: '1px solid rgba(220,38,38,0.25)', background: 'var(--tz-dangerBg)', color: 'var(--tz-danger)', fontSize: 12, lineHeight: 1.4, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{sendError}</span>
                    <button
                      onClick={() => setSendError(null)}
                      aria-label="Dismiss error"
                      style={{ background: 'none', border: 'none', color: 'var(--tz-danger)', fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: 0, lineHeight: 1 }}
                    >×</button>
                  </div>
                )}
              </div>

              {/* Path 2: Approve In Person */}
              <div style={{ marginBottom: 12, padding: '12px 14px', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Approve In Person</div>
                <div style={{ fontSize: 12, color: GRAY, marginBottom: 8 }}>Customer has reviewed and verbally approved this estimate</div>
                <button onClick={() => setApprovalConfirmModal({ method: 'in_person', notes: '' })} style={{ ...btnStyle( 'var(--tz-bgLight)', BLUE), width: '100%', justifyContent: 'center', border: `1px solid ${BLUE}` }}>
                  Approve In Person
                </button>
              </div>

              {/* Path 3: Print */}
              <div style={{ padding: '12px 14px', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Print</div>
                <div>
                  <button
                    onClick={async () => {
                      let id = estimateId
                      if (!id) {
                        const result = await ensureEstimate()
                        if (!result) {
                          setToastMsg('Could not prepare estimate — try again')
                          setTimeout(() => setToastMsg(''), 4000)
                          return
                        }
                        id = result.id
                      }
                      const pdfUrl = `/api/estimates/${id}/pdf?mode=print`
                      const w = typeof window !== 'undefined' ? window.open(pdfUrl, '_blank', 'noopener,noreferrer') : null
                      if (!w) {
                        setToastMsg('Popup blocked. Allow popups or use the print link again.')
                        setTimeout(() => setToastMsg(''), 4000)
                        return
                      }
                      setPrintedReady(true)
                    }}
                    style={{ ...btnStyle('var(--tz-bgLight)', GRAY), padding: '6px 14px', fontSize: 12, border: `1px solid ${'var(--tz-border)'}` }}
                  >
                    Print Estimate
                  </button>
                </div>
              </div>
            </div>

            {/* In-Person / Print Confirmation sub-modal */}
            {approvalConfirmModal && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }} onClick={() => setApprovalConfirmModal(null)}>
                <div style={{ background: 'var(--tz-bgCard)', borderRadius: 12, padding: 24, width: 420, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
                    {approvalConfirmModal.method === 'in_person' ? 'Confirm In-Person Approval' : 'Confirm Print & Sign Approval'}
                  </div>
                  <div style={{ fontSize: 13, color: GRAY, marginBottom: 16 }}>
                    {approvalConfirmModal.method === 'in_person'
                      ? 'Customer has reviewed and approved this estimate in person?'
                      : 'Customer has signed the printed estimate?'}
                  </div>
                  <textarea
                    value={approvalConfirmModal.notes}
                    onChange={e => setApprovalConfirmModal({ ...approvalConfirmModal, notes: e.target.value })}
                    placeholder="Add any notes from customer (optional)"
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical', marginBottom: 16 }}
                  />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => setApprovalConfirmModal(null)} disabled={approvingEstimate} style={{ ...btnStyle( 'var(--tz-bgLight)', GRAY), opacity: approvingEstimate ? 0.5 : 1, cursor: approvingEstimate ? 'not-allowed' : 'pointer' }}>Cancel</button>
                    <button
                      onClick={() => approveEstimate(approvalConfirmModal.method as 'in_person' | 'printed_signed', approvalConfirmModal.notes)}
                      disabled={approvingEstimate}
                      style={{ ...btnStyle(BLUE, 'var(--tz-bgLight)'), opacity: approvingEstimate ? 0.5 : 1, cursor: approvingEstimate ? 'not-allowed' : 'pointer' }}
                    >
                      {approvingEstimate ? 'Approving…' : 'Confirm Approval'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* ADDITIONAL INFO (external_data) */}
      {wo.external_data && typeof wo.external_data === 'object' && Object.keys(wo.external_data).length > 0 && (
        <div style={{ ...cardStyle, marginTop: 12 }}>
          <button
            onClick={() => setShowExternalData(!showExternalData)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 700, color: 'var(--tz-textSecondary)', display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}
          >
            <span style={{ transform: showExternalData ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', display: 'inline-block' }}>&#9654;</span>
            Additional Info
          </button>
          {showExternalData && (
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {Object.entries(wo.external_data)
                .filter(([key, val]) => key !== 'historical_fullbay_snapshot' && (val === null || typeof val !== 'object'))
                .map(([key, val]) => (
                <div key={key} style={{ fontSize: 12 }}>
                  <span style={{ color: GRAY, fontWeight: 600 }}>{key.replace(/_/g, ' ')}: </span>
                  <span style={{ color: 'var(--tz-textSecondary)' }}>{val != null ? String(val) : '\u2014'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FOOTER */}
      <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 11, color: 'var(--tz-textTertiary)', borderTop: `1px solid ${'var(--tz-border)'}`, marginTop: 24 }}>
        {shop.name || shop.dba || 'TruckZen'} {shop.phone ? ` | ${shop.phone}` : ''} {shop.email ? ` | ${shop.email}` : ''}
      </div>

      {/* Toast notification */}
      {toastMsg && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--tz-bgElevated)', color: 'var(--tz-bgLight)', padding: '12px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 2000, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', fontFamily: FONT }}>
          {toastMsg}
        </div>
      )}
    </div>
  )
}
