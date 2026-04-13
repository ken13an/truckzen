'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser, type UserProfile } from '@/lib/auth'
import { ChevronLeft, Users, MessageSquare, Clock, DollarSign, MoreHorizontal, Plus, Mic, Upload, X, Paperclip } from 'lucide-react'
import AITextInput from '@/components/ai-text-input'
import SourceBadge from '@/components/ui/SourceBadge'
import OwnershipTypeBadge from '@/components/OwnershipTypeBadge'
import WOStepper from '@/components/work-orders/WOStepper'
import { validateFile, sanitizeFilename, WO_FILE_EXTENSIONS, WO_FILE_MIMES, MAX_WO_FILE_SIZE } from '@/lib/upload-safety'
import WOHeader from '@/components/work-orders/WOHeader'
import JobsTab from '@/components/work-orders/JobsTab'
import PartsTab from '@/components/work-orders/PartsTab'
import EstimateTab from '@/components/work-orders/EstimateTab'
import { getAutoRoughParts, isDiagnosticJob } from '@/lib/parts-suggestions'
import { getDefaultLaborHours } from '@/lib/labor-hours'
import { calcInvoiceTotals, calcWoOperationalTotals } from '@/lib/invoice-calc'
import { isInvoiceHardLocked, DEFAULT_LABOR_RATE_FALLBACK } from '@/lib/invoice-lock'
import { SERVICE_WRITE_ROLES, ACCOUNTING_ROLES } from '@/lib/roles'
import { useTheme } from '@/hooks/useTheme'
import { getWorkorderRoute } from '@/lib/navigation/workorder-route'
import { THEME } from '@/lib/config/colors'

const KNOWN_REPAIR_WORDS = ['oil', 'brake', 'engine', 'tire', 'tyre', 'pm', 'service', 'inspect', 'replace', 'repair', 'check', 'fix', 'leak', 'light', 'lamp', 'filter', 'belt', 'hose', 'cool', 'heat', 'ac', 'air', 'fuel', 'exhaust', 'trans', 'clutch', 'steer', 'align', 'suspen', 'shock', 'spring', 'weld', 'body', 'frame', 'door', 'window', 'mirror', 'wiper', 'horn', 'def', 'dpf', 'egr', 'turbo', 'alternator', 'starter', 'battery', 'charge', 'electric', 'wire', 'fuse', 'sensor', 'valve', 'pump', 'compressor', 'radiator', 'thermostat', 'diagnostic', 'dot', 'annual', 'wheel', 'hub', 'axle', 'drive', 'shaft', 'bearing', 'seal', 'gasket', 'mount', 'install', 'remove', 'adjust', 'bleed', 'flush', 'change', 'swap', 'lube', 'grease', 'paint', 'cab', 'fender', 'bumper', 'hood', 'trailer', 'fifth', 'glad', 'slack', 'drum', 'rotor', 'pad', 'shoe', 'caliper', 'abs', 'preventive', 'maintenance', 'full inspection', 'safety']

function isUnrecognizedJob(desc: string): boolean {
  if (!desc || desc.trim().length < 2) return false
  const d = desc.toLowerCase()
  return !KNOWN_REPAIR_WORDS.some(w => d.includes(w))
}

const FONT = "'Inter', -apple-system, sans-serif"
const BLUE = THEME.dark.accent, GREEN = THEME.dark.success, RED = THEME.dark.danger, AMBER = THEME.dark.warning, GRAY = THEME.dark.textSecondary

const LINE_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  unassigned:     { label: 'Unassigned',     bg: THEME.dark.dangerBg, color: THEME.dark.danger },
  approved:       { label: 'Approved',       bg: THEME.dark.successBg, color: THEME.dark.success },
  pending_review: { label: 'Pending Review', bg: THEME.dark.warningBg, color: THEME.dark.warning },
  in_progress:    { label: 'In Progress',    bg: THEME.dark.accentBg, color: THEME.dark.accent },
  completed:      { label: 'Completed',      bg: THEME.dark.successBg, color: THEME.dark.success },
}

const WO_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  open:        { label: 'Open',        bg: THEME.dark.accentBg, color: BLUE },
  in_progress: { label: 'In Progress', bg: THEME.dark.accentBg, color: BLUE },
  completed:   { label: 'Completed',   bg: THEME.dark.successBg, color: GREEN },
  invoiced:    { label: 'Invoiced',    bg: THEME.dark.successBg, color: THEME.dark.success },
  closed:      { label: 'Closed',      bg: THEME.dark.surfaceMuted, color: GRAY },
}

const PART_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  needed: { label: 'Needed', bg: THEME.dark.dangerBg, color: RED },
  ordered: { label: 'Ordered', bg: THEME.dark.warningBg, color: AMBER },
  received: { label: 'Received', bg: THEME.dark.accentBg, color: BLUE },
  ready_for_job: { label: 'Ready for Pickup', bg: THEME.dark.successBg, color: GREEN },
  picked_up: { label: 'Picked Up', bg: THEME.dark.successBg, color: GREEN },
  installed: { label: 'Installed', bg: THEME.dark.successBg, color: THEME.dark.success },
}

const TABS = ['Jobs', 'Parts', 'Estimate', 'Files & Notes', 'Activity', 'Invoice']

const pillStyle = (bg: string, color: string): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: bg, color })
const inputStyle: React.CSSProperties = { padding: '8px 12px', border: `1px solid ${THEME.dark.inputBorder}`, borderRadius: 8, fontSize: 13, fontFamily: FONT, outline: 'none', boxSizing: 'border-box', width: '100%', background: THEME.dark.inputBg, color: THEME.dark.text }
const btnStyle = (bg: string, color: string): React.CSSProperties => ({ padding: '8px 16px', background: bg, color, border: bg === 'transparent' ? `1px solid ${THEME.dark.border}` : 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, display: 'inline-flex', alignItems: 'center', gap: 6 })
const cardStyle: React.CSSProperties = { background: THEME.dark.bgCard, border: `1px solid ${THEME.dark.cardBorder}`, borderRadius: 12, padding: 16, marginBottom: 12 }
const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' }

export default function WorkOrderDetail() {
  const { tokens: t } = useTheme()
  const params = useParams()
  const id = params?.id as string
  const supabase = createClient()

  // ALL useState hooks — BEFORE any conditional returns
  const [user, setUser] = useState<UserProfile | null>(null)
  const [wo, setWo] = useState<any>(null)
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
  const [approvalModal, setApprovalModal] = useState(false)
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
  const [merging, setMerging] = useState(false)
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [approvalConfirmModal, setApprovalConfirmModal] = useState<{ method: string; notes: string } | null>(null)
  const [printedReady, setPrintedReady] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editDraft, setEditDraft] = useState<any>(null)
  const [toastMsg, setToastMsg] = useState('')

  // DATA LOADING
  const loadData = useCallback(async () => {
    if (!id) return
    try {
      const u = await getCurrentUser(supabase)
      setUser(u)

      // Mechanic roles use the dedicated mechanic dashboard, not the full WO editor
      if (u && ['technician', 'lead_tech', 'maintenance_technician'].includes(u.impersonate_role || u.role)) {
        window.location.href = '/mechanic/dashboard'
        return
      }

      // Fetch WO with retry — handles transient failures after create redirect or auth delay
      let woRes = await fetch(`/api/work-orders/${id}`)
      if (!woRes.ok) {
        await new Promise(r => setTimeout(r, 1000))
        woRes = await fetch(`/api/work-orders/${id}`)
      }
      if (!woRes.ok) {
        await new Promise(r => setTimeout(r, 2000))
        woRes = await fetch(`/api/work-orders/${id}`)
      }
      if (!woRes.ok) {
        await new Promise(r => setTimeout(r, 3000))
        woRes = await fetch(`/api/work-orders/${id}`)
      }

      const [usersRes, ratesRes] = await Promise.all([
        fetch('/api/users') ,
        u?.shop_id ? fetch(`/api/settings/labor-rates?shop_id=${u.shop_id}`) : Promise.resolve(null),
      ])

      if (!woRes.ok) { setLoading(false); return }
      const woData = await woRes.json()
      setWo(woData)
      setJobAssignments(woData.jobAssignments || [])
      setWoParts(woData.woParts || [])
      setMileage(woData.assets?.odometer?.toString() || '')
      setTeamAssign({ team: woData.team || '', bay: woData.bay || '', assigned_tech: woData.assigned_tech || '' })
      setContactEmail(woData.customers?.email || '')
      setContactPhone(woData.customers?.phone || '')
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
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  // HELPER FUNCTIONS
  const patchLine = async (lineId: string, data: Record<string, any>) => {
    const res = await fetch(`/api/so-lines/${lineId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    if (res.ok) await loadData()
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
    await fetch(`/api/work-orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...teamAssign }),
    })
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
    await fetch('/api/wo-parts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: partId, status, wo_id: id }),
    })
    await loadData()
  }

  const removeJobLine = async (lineId: string) => {
    await fetch(`/api/so-lines/${lineId}`, { method: 'DELETE' })
    logActivity('Removed a job line')
    await loadData()
  }

  const updateWoStatus = async (status: string) => {
    await fetch(`/api/work-orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
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
  if (!wo) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: FONT, color: RED, fontSize: 15, flexDirection: 'column', gap: 12 }}>
      <span>Work order not found</span>
      <a href="/work-orders" style={{ color: BLUE, fontSize: 13 }}>Back to Work Orders</a>
    </div>
  )

  // DERIVED DATA
  const asset = wo.assets || {}
  const customer = wo.customers || {}
  const jobLines = (wo.so_lines || []).filter((l: any) => l.line_type === 'labor')
  const partLines = (wo.so_lines || []).filter((l: any) => l.line_type === 'part')
  const feeLines = (wo.so_lines || []).filter((l: any) => l.line_type === 'fee')
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
  const woStatus = WO_STATUS[wo.status] || { label: wo.status, bg: t.surfaceMuted, color: GRAY }
  const vinDisplay = asset.vin ? asset.vin.slice(-6).toUpperCase() : '—'
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

  // RENDER
  return (
    <div style={{ fontFamily: FONT, color: t.text, background: t.bgCard, minHeight: '100vh', maxWidth: 960, margin: '0 auto', padding: 'clamp(10px, 3vw, 20px)' }}>

      {/* BACK BUTTON — role-safe: only accounting roles go to /accounting/history */}
      {(() => {
        const isAccountingUser = ACCOUNTING_ROLES.includes(userRole)
        const backHref = wo.is_historical && isAccountingUser ? '/accounting/history' : '/work-orders'
        const backLabel = wo.is_historical && isAccountingUser ? 'Imported History' : 'Work Orders'
        return (
          <a href={backHref} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: t.surfaceMuted, color: t.text, borderRadius: 100, padding: '6px 14px 6px 8px', fontSize: 13, fontWeight: 700, textDecoration: 'none', marginBottom: 16, fontFamily: FONT }}>
            <ChevronLeft size={16} /> {backLabel}
          </a>
        )
      })()}

      {/* HISTORICAL BANNER */}
      {wo.is_historical && (
        <div style={{ background: 'rgba(124,139,160,0.08)', border: '1px solid rgba(124,139,160,0.15)', borderRadius: 8, padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: t.textSecondary }}>
          Historical Record — Imported | WO #{wo.so_number} | {new Date(wo.created_at).toLocaleDateString()}
        </div>
      )}

      <WOHeader>
      {/* HEADER */}
      <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, borderBottom: '2px solid ${t.border}' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 26, fontWeight: 800 }}>{wo.so_number || ('WO-' + wo.id?.slice(0, 6))}</span>
            <span style={pillStyle(woStatus.bg, woStatus.color)}>{woStatus.label}</span>
            <SourceBadge source={wo.source} />
            {wo.payment_terms === 'cod' && <span style={pillStyle(t.dangerBg, RED)}>COD</span>}
            {wo.invoice_status && wo.invoice_status !== 'draft' && (() => {
              const IS: Record<string, { label: string; bg: string; color: string }> = {
                quality_check_failed: { label: 'QC Failed', bg: t.dangerBg, color: RED },
                pending_accounting:   { label: 'Pending Accounting', bg: t.warningBg, color: AMBER },
                accounting_approved:  { label: 'Acct. Approved', bg: t.successBg, color: GREEN },
                sent_to_customer:     { label: 'Sent to Customer', bg: t.accentBg, color: BLUE },
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
                  <button onClick={() => { setEditMode(true); setEditDraft({ complaint: wo.complaint || '', priority: wo.priority || 'normal', cause: wo.cause || '', correction: wo.correction || '' }) }} style={{ ...btnStyle( t.bgLight, BLUE), border: `1px solid ${BLUE}`, padding: '6px 14px', fontSize: 12 }}>
                    Edit
                  </button>
                ) : (
                  <>
                    <button onClick={() => { setEditMode(false); setEditDraft(null) }} style={{ ...btnStyle( t.bgLight, GRAY), padding: '6px 14px', fontSize: 12 }}>
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
                      const res = await fetch(`/api/work-orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) })
                      if (res.ok) {
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
                    }} style={btnStyle(BLUE, t.bgLight)}>
                      Submit
                    </button>
                  </>
                )}
              </div>
              {/* Editable fields in edit mode */}
              {editMode && editDraft && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '12px 14px', background: t.bgHover, borderRadius: 8, border: `1px solid ${t.border}` }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Concern / Complaint</label>
                    <textarea value={editDraft.complaint} onChange={e => setEditDraft({ ...editDraft, complaint: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical', borderColor: t.borderAccent }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Priority</label>
                    <select value={editDraft.priority} onChange={e => setEditDraft({ ...editDraft, priority: e.target.value })} style={{ ...inputStyle, borderColor: t.borderAccent, appearance: 'auto' }}>
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Cause</label>
                    <input value={editDraft.cause} onChange={e => setEditDraft({ ...editDraft, cause: e.target.value })} style={{ ...inputStyle, borderColor: t.borderAccent }} placeholder="Root cause" />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Correction</label>
                    <input value={editDraft.correction} onChange={e => setEditDraft({ ...editDraft, correction: e.target.value })} style={{ ...inputStyle, borderColor: t.borderAccent }} placeholder="Correction applied" />
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
              <div style={{ fontSize: 13, color: t.text, marginTop: 2 }}>
                {[asset.year, asset.make, asset.model].filter(Boolean).join(' ')}
              </div>
              <div style={{ fontSize: 13, marginTop: 2 }}>
                VIN: <span style={{ fontWeight: 700 }}>...{vinDisplay}</span>
              </div>
              {mileage && <div style={{ fontSize: 12, color: GRAY, marginTop: 2 }}>{parseInt(mileage).toLocaleString()} mi</div>}
              <div style={{ marginTop: 4 }}><OwnershipTypeBadge type={asset.is_owner_operator ? 'owner_operator' : (wo.ownership_type || asset.ownership_type)} size="lg" /></div>
            </>
          ) : (
            <span style={{ color: t.textTertiary, fontStyle: 'italic' }}>Walk-in / Unit not on file</span>
          )}
        </div>
      </div>

      </WOHeader>

      {/* OWNER & DRIVER INFO */}
      {wo.assets && (asset.owner_name || asset.driver_name) && (
        <div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '10px 16px', fontSize: 12 }}>
          <div>
            <span style={{ ...labelStyle, marginBottom: 2 }}>Owner</span>
            <div style={{ fontWeight: 600, color: t.text }}>
              {asset.owner_name || <span style={{ color: t.textTertiary, fontStyle: 'italic' }}>Not assigned</span>}
              {asset.owner_phone && (
                <a href={`tel:${asset.owner_phone}`} style={{ color: BLUE, textDecoration: 'none', marginLeft: 8, fontWeight: 400 }}>{asset.owner_phone}</a>
              )}
            </div>
          </div>
          <div>
            <span style={{ ...labelStyle, marginBottom: 2 }}>Driver</span>
            <div style={{ fontWeight: 600, color: t.text }}>
              {asset.driver_name || <span style={{ color: t.textTertiary, fontStyle: 'italic' }}>Not assigned</span>}
              {asset.driver_phone && (
                <a href={`tel:${asset.driver_phone}`} style={{ color: BLUE, textDecoration: 'none', marginLeft: 8, fontWeight: 400 }}>{asset.driver_phone}</a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ESTIMATE REQUIREMENT BANNER */}
      {!wo.is_historical && wo.estimate_required && (() => {
        const estStatus = wo.estimate_status || 'draft'
        const isApproved = wo.estimate_approved && estStatus !== 'approved_with_notes'
        const isApprovedWithNotes = wo.estimate_approved && estStatus === 'approved_with_notes'
        const isSent = estStatus === 'sent'
        const isDeclined = estStatus === 'declined'
        const bannerStyle = isApproved
          ? { background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)', color: GREEN }
          : isApprovedWithNotes
          ? { background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)', color: AMBER }
          : isSent
          ? { background: 'rgba(29,111,232,0.08)', border: '1px solid rgba(29,111,232,0.2)', color: BLUE }
          : isDeclined
          ? { background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: RED }
          : { background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)', color: AMBER }
        const methodLabel = wo.approval_method === 'in_person' ? ' in person' : wo.approval_method === 'printed_signed' ? ' (printed and signed)' : wo.approval_method === 'email_portal' ? ' via customer portal' : wo.approval_method === 'email' ? ' via email' : ''
        return (
          <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 12, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, ...bannerStyle }}>
            <span>
              {isApproved ? `Estimate approved${methodLabel} — work can begin`
                : isApprovedWithNotes ? `Estimate approved with customer notes — review before starting`
                : isSent ? 'Estimate sent to customer — awaiting approval'
                : isDeclined ? `Estimate declined${wo.estimate_declined_reason ? ` — ${wo.estimate_declined_reason}` : ''} — follow up required`
                : 'Estimate required — build and send before assigning work'}
            </span>
            {isApprovedWithNotes && wo.customer_estimate_notes && (
              <div style={{ width: '100%', fontSize: 12, fontWeight: 400, marginTop: 4, padding: '6px 10px', background: 'rgba(217,119,6,0.06)', borderRadius: 6 }}>
                Customer notes: &ldquo;{wo.customer_estimate_notes}&rdquo;
              </div>
            )}
            {!wo.estimate_approved && <a href="#estimate" onClick={() => setTab(2)} style={{ fontSize: 12, fontWeight: 600, color: BLUE, textDecoration: 'none', marginLeft: 12 }}>Go to Estimate</a>}
          </div>
        )
      })()}

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
                  <button onClick={() => warrantyDecision('no_warranty')} style={btnStyle(t.successBg, GREEN)}>No Warranty — Proceed</button>
                  <button onClick={() => warrantyDecision('checking')} style={btnStyle(t.warningBg, AMBER)}>Send for Warranty Check</button>
                  <button onClick={() => warrantyDecision('send_to_dealer')} style={btnStyle(t.dangerBg, RED)}>Send to Dealer</button>
                </div>
              </>
            ) : (
              /* Scenario 1 & 2: No warranty info */
              <>
                <div style={{ color: GRAY, fontSize: 12, marginBottom: 6 }}>
                  {isFleet ? 'No warranty information on file for this unit' : 'Outside customer / Owner operator truck'}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button onClick={() => warrantyDecision('no_warranty')} style={btnStyle(t.successBg, GREEN)}>No Warranty — Proceed</button>
                  <button onClick={() => warrantyDecision('checking')} style={btnStyle(t.warningBg, AMBER)}>Send for Warranty Check</button>
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

      {/* OWNER OPERATOR BANNER */}
      {!wo.is_historical && !isViewOnly && (wo.ownership_type === 'owner_operator' || wo.assets?.is_owner_operator) && jobLines.some((l: any) => l.approval_status === 'needs_approval') && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '8px 16px', marginBottom: 12, fontSize: 12, color: AMBER, fontWeight: 600 }}>
          Owner Operator truck — customer approval required before work begins
        </div>
      )}

      {/* PROGRESS PIPELINE */}
      {!wo.is_historical && <WOStepper wo={wo} asset={asset} jobLines={jobLines} jobAssignments={jobAssignments} />}

      {/* AUTOMATION VISIBILITY */}
      {wo.automation && wo.automation.stage !== 'closed' && wo.automation.stage !== 'void' && !wo.is_historical && !isViewOnly && (
        <div style={{
          ...cardStyle,
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
          background: wo.automation.is_overdue ? t.dangerBg : wo.automation.blocked_by ? t.warningBg : t.successBg,
          border: `1px solid ${wo.automation.is_overdue ? t.danger : wo.automation.blocked_by ? t.warning : t.success}`,
        }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: wo.automation.is_overdue ? t.danger : wo.automation.blocked_by ? t.warning : t.success, marginBottom: 2 }}>
              {wo.automation.is_overdue ? 'Overdue' : wo.automation.blocked_by ? 'Blocked' : 'On Track'}
              {wo.automation.exception && <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: 'rgba(0,0,0,0.06)', textTransform: 'uppercase' }}>{wo.automation.exception.replace(/_/g, ' ')}</span>}
            </div>
            <div style={{ fontSize: 12, color: t.textSecondary }}><strong>Next:</strong> {wo.automation.next_action}</div>
            {wo.automation.blocked_by && <div style={{ fontSize: 11, color: t.warning, marginTop: 2 }}>{wo.automation.blocked_by}</div>}
          </div>
          <div style={{ textAlign: 'right', fontSize: 11, color: GRAY }}>
            <div>Owner: <strong style={{ color: t.text }}>{wo.automation.owner.replace(/_/g, ' ')}</strong></div>
            {wo.etc && wo.etc.confidence !== 'none' && (
              <div style={{ marginTop: 2, fontWeight: 600, color: wo.etc.remaining_hours === 0 ? RED : t.textSecondary }}>
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
        <div style={{ ...cardStyle, background: t.warningBg, border: '1px solid ${t.warning}' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.warning, marginBottom: 8 }}>
            Extra Time Request{extraTimeRequests.length > 1 ? 's' : ''} ({extraTimeRequests.length})
          </div>
          {extraTimeRequests.map((req: any) => (
            <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid ${t.warning}' }}>
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
                }} style={{ ...btnStyle(GREEN, t.bgLight), padding: '4px 12px', fontSize: 11 }}>Approve</button>
                <button onClick={async () => {
                  await fetch('/api/mechanic-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'respond', request_id: req.id, status: 'denied' }) })
                  setExtraTimeRequests(prev => prev.filter(r => r.id !== req.id))
                }} style={{ ...btnStyle(RED, t.bgLight), padding: '4px 12px', fontSize: 11 }}>Deny</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB BAR */}
      <div data-no-print style={{ display: 'flex', gap: 0, borderBottom: '1px solid ${t.border}', marginBottom: 16, overflowX: 'auto' }}>
        {TABS.map((tabLabel, i) => (
          <button key={tabLabel} onClick={() => setTab(i)} style={{
            padding: '10px 18px', background: 'transparent', border: 'none', borderBottom: tab === i ? `2px solid ${t.accent}` : '2px solid transparent',
            color: tab === i ? t.accent : t.textTertiary, fontWeight: tab === i ? 700 : 500, fontSize: 13, cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap',
          }}>
            {tabLabel}
          </button>
        ))}
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
              background: t.bgHover, border: `1px solid ${t.border}`, borderRadius: 8, cursor: 'pointer', padding: 0, gap: 2,
            }}>
              {a.icon}
              <span style={{ fontSize: 10, color: GRAY }}>{a.label}</span>
            </button>
          ))}
          <div style={{ width: 1, height: 30, background: t.border }} />
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowMenu(!showMenu)} style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bgHover, border: `1px solid ${t.border}`, borderRadius: 8, cursor: 'pointer' }}>
              <MoreHorizontal size={16} />
            </button>
            {showMenu && (
              <div style={{ position: 'absolute', top: 42, left: 0, background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, minWidth: 180, padding: 4 }}>
                {Object.entries(WO_STATUS).map(([k, v]) => (
                  <button key={k} onClick={() => updateWoStatus(k)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: wo.status === k ? t.accentBg : 'transparent', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: FONT, color: v.color }}>
                    {v.label}
                  </button>
                ))}
                <div style={{ borderTop: '1px solid ${t.border}', margin: '4px 0' }} />
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
        <div style={{ ...cardStyle, background: t.dangerBg, border: '1px solid ${t.danger}', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: RED }}>Quality Check Failed</span>
            <button onClick={() => setShowQcErrors(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: RED, fontSize: 16, fontFamily: FONT }}>&times;</button>
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: 12, color: t.danger, lineHeight: 1.8 }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: t.accentBg, border: '1px solid ${t.borderAccent}', borderRadius: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: t.accent }}>{mergeSelected.size} lines selected</span>
              <button disabled={merging} onClick={async () => {
                const ids = Array.from(mergeSelected)
                const destId = ids[0]
                const srcIds = ids.slice(1)
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
              }} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: t.accent, color: t.bgLight, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: merging ? 0.5 : 1 }}>
                {merging ? 'Merging...' : `Merge into first selected`}
              </button>
              <button onClick={() => setMergeSelected(new Set())} style={{ background: 'none', border: 'none', color: t.textTertiary, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
            </div>
          )}
          {jobLines.map((line: any, idx: number) => {
            const st = LINE_STATUS[line.line_status] || LINE_STATUS.unassigned
            const lineAssignments = jobAssignments.filter((a: any) => a.line_id === line.id)
            const isAdditional = line.is_additional
            const lineParts = woParts.filter((p: any) => p.line_id === line.id)

            return (
              <div key={line.id} style={{ ...cardStyle, borderLeft: `3px solid ${isAdditional ? AMBER : st.color}`, position: 'relative' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  {!wo.is_historical && !isViewOnly && jobLines.length > 1 && (
                    <input type="checkbox" checked={mergeSelected.has(line.id)} onChange={() => setMergeSelected(prev => { const n = new Set(prev); n.has(line.id) ? n.delete(line.id) : n.add(line.id); return n })} style={{ cursor: 'pointer', accentColor: t.accent, width: 16, height: 16, flexShrink: 0 }} />
                  )}
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Job {idx + 1}</span>
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
                  {isAdditional && <span style={pillStyle(t.warningBg, AMBER)}>ADDITIONAL</span>}
                  {/* Approval badge */}
                  {!wo.is_historical && !isViewOnly && (() => {
                    const as = line.approval_status || 'pre_approved'
                    const AB: Record<string, { bg: string; color: string; label: string }> = {
                      pre_approved: { bg: t.successBg, color: GREEN, label: 'Pre-Approved' },
                      needs_approval: { bg: t.warningBg, color: AMBER, label: 'Needs Approval' },
                      pending: { bg: t.warningBg, color: AMBER, label: 'Pending' },
                      approved: { bg: t.successBg, color: GREEN, label: 'Approved' },
                      declined: { bg: t.dangerBg, color: RED, label: 'Declined' },
                    }
                    const b = AB[as] || AB.pre_approved
                    return <span style={pillStyle(b.bg, b.color)}>{b.label}</span>
                  })()}
                </div>

                {/* Pre-Approval Toggle */}
                {!wo.is_historical && !isViewOnly && (line.approval_status === 'pre_approved' || line.approval_status === 'needs_approval' || !line.approval_status) && (
                  <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                    <button onClick={() => toggleApproval(line.id, false)} style={{ padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, background: !line.approval_required ? 'rgba(22,163,74,0.1)' : 'transparent', color: !line.approval_required ? GREEN : GRAY, border: !line.approval_required ? `1px solid ${GREEN}40` : '1px solid ${t.border}' }}>Pre-Approved</button>
                    <button onClick={() => toggleApproval(line.id, true)} style={{ padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, background: line.approval_required ? 'rgba(217,150,11,0.1)' : 'transparent', color: line.approval_required ? AMBER : GRAY, border: line.approval_required ? `1px solid ${AMBER}40` : '1px solid ${t.border}' }}>Needs Approval</button>
                  </div>
                )}

                {/* Approval actions (when needs approval) */}
                {!wo.is_historical && !isViewOnly && line.approval_status === 'needs_approval' && (
                  <div style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 11 }}>
                    <div style={{ color: AMBER, fontWeight: 600, marginBottom: 6 }}>Waiting for customer approval</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input value={approvalNotes} onChange={e => setApprovalNotes(e.target.value)} placeholder="Notes..." style={{ ...inputStyle, flex: 1, padding: '4px 8px', fontSize: 11 }} />
                      <button onClick={() => approveJob(line.id)} style={btnStyle(t.successBg, GREEN)}>Approve</button>
                      <button onClick={() => declineJob(line.id)} style={btnStyle(t.dangerBg, RED)}>Decline</button>
                    </div>
                  </div>
                )}

                {/* Assignment row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: GRAY }}>ASSIGNED:</span>
                  {lineAssignments.length > 0 ? (
                    lineAssignments.map((a: any) => (
                      <span key={a.id} style={pillStyle(t.accentBg, BLUE)}>
                        {a.users?.full_name || 'Unknown'} ({a.percentage}%)
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: 12, color: GRAY, fontStyle: 'italic' }}>Unassigned</span>
                  )}
                  {!wo.is_historical && !isViewOnly && (
                    <button onClick={() => {
                      const bypassJobTypes = ['diagnostic', 'full_inspection']
                      if (wo.estimate_required && !wo.estimate_approved && !bypassJobTypes.includes(wo.job_type)) {
                        alert('Estimate must be approved before this work order can be assigned. Go to the Estimate tab to build and send the estimate.')
                        return
                      }
                      openAssignModal(line.id, idx)
                    }} style={{ ...btnStyle( t.bgLight, BLUE), padding: '4px 10px', fontSize: 11 }}>
                      <Users size={12} /> Assign
                    </button>
                  )}
                </div>

                {/* Hours grid */}
                {(() => {
                  const actualHours = line.actual_hours || (line.labor_minutes ? line.labor_minutes / 60 : 0)
                  const estimatedHours = line.estimated_hours || 0
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
                      {[
                        { label: 'Est. Hours', value: estimatedHours },
                        { label: 'Actual', value: Math.round(actualHours * 100) / 100 },
                        { label: 'Billed', value: line.billed_hours || 0 },
                      ].map(h => (
                        <div key={h.label} style={{ background: t.bgHover, borderRadius: 8, padding: '8px 12px' }}>
                          <div style={labelStyle}>{h.label}</div>
                          <div style={{ fontSize: 16, fontWeight: 700 }}>{h.value || 0}</div>
                        </div>
                      ))}
                      {(estimatedHours > 0 || actualHours > 0) && (
                        <div style={{ gridColumn: '1 / -1', fontSize: 12, color: GRAY }}>
                          {estimatedHours > 0 && <span>Est: {estimatedHours}h</span>}
                          {estimatedHours > 0 && actualHours > 0 && <span> | </span>}
                          {actualHours > 0 && <span>Actual: {Math.round(actualHours * 100) / 100}h</span>}
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Concern / Work Description */}
                {line.description && (
                  <div style={{ background: t.bgHover, borderRadius: 8, padding: '10px 12px', marginBottom: 6, fontSize: 13, color: t.textSecondary }}>
                    <span style={{ ...labelStyle, marginBottom: 6 }}>{wo.is_historical ? 'Work Description' : 'Concern'}</span>
                    {line.description}
                  </div>
                )}

                {/* Mechanic Notes */}
                {(() => {
                  const notes: any[] = Array.isArray(line.mechanic_notes) ? line.mechanic_notes : []
                  return (
                    <div style={{ background: t.bgHover, borderRadius: 8, padding: '10px 12px', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: notes.length > 0 ? 8 : 0 }}>
                        <MessageSquare size={12} style={{ color: GRAY }} />
                        <span style={{ ...labelStyle, marginBottom: 0 }}>Mechanic Notes</span>
                      </div>
                      {notes.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {notes.map((n: any, ni: number) => (
                            <div key={ni} style={{ fontSize: 12, color: t.textSecondary, padding: '4px 0', borderBottom: ni < notes.length - 1 ? '1px solid ${t.border}' : 'none' }}>
                              <div>{n.text || n.note || String(n)}</div>
                              {n.created_at && <div style={{ fontSize: 10, color: GRAY, marginTop: 2 }}>{new Date(n.created_at).toLocaleString()}</div>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: GRAY, fontStyle: 'italic' }}>No mechanic notes yet</span>
                      )}
                    </div>
                  )
                })()}

                {/* AI Parts Suggestion Bar */}
                {!wo.is_historical && !isViewOnly && line.description && line.description.length >= 10 && (
                  <>
                    {!aiSuggestions[line.id] && aiLoadingLine !== line.id && (
                      <button onClick={() => fetchAiSuggestions(line.id, line.description)} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 12px', marginBottom: 10, background: t.aiPurpleBg, border: '1px solid ${t.aiPurple}', borderRadius: 8, color: t.aiPurple, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>
                        AI: Suggest parts for this job
                      </button>
                    )}
                    {aiLoadingLine === line.id && (
                      <div style={{ padding: '8px 12px', marginBottom: 10, background: t.aiPurpleBg, border: '1px solid ${t.aiPurple}', borderRadius: 8, color: t.aiPurple, fontSize: 11, fontWeight: 600 }}>
                        Analyzing job description...
                      </div>
                    )}
                    {aiSuggestions[line.id] && !showAiPanel && (
                      <button onClick={() => setShowAiPanel(line.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 12px', marginBottom: 10, background: t.aiPurpleBg, border: '1px solid ${t.aiPurple}', borderRadius: 8, color: t.aiPurple, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>
                        AI suggested {aiSuggestions[line.id].length} parts — tap to review
                      </button>
                    )}
                    {showAiPanel === line.id && aiSuggestions[line.id] && (() => {
                      const suggestions = aiSuggestions[line.id]
                      return (
                        <div style={{ background: t.bgElevated, border: '1px solid ${t.aiPurple}', borderRadius: 10, padding: 14, marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: t.aiPurple }}>AI Suggested Parts</span>
                            <button onClick={() => setShowAiPanel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GRAY, fontSize: 11 }}>Close</button>
                          </div>
                          {suggestions.map((s: any, si: number) => (
                            <label key={si} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: si < suggestions.length - 1 ? '1px solid ${t.border}' : 'none', cursor: 'pointer' }}>
                              <input type="checkbox" defaultChecked style={{ accentColor: t.aiPurple }} data-idx={si} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary }}>{s.description}</div>
                                <div style={{ fontSize: 10, color: GRAY }}>Qty: {s.quantity || 1}{s.part_number ? ` · ${s.part_number}` : ''}{s.reason ? ` · ${s.reason}` : ''}</div>
                              </div>
                              <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 3, background: s.confidence === 'very_high' ? t.successBg : s.confidence === 'high' ? t.accentBg : t.warningBg, color: s.confidence === 'very_high' ? GREEN : s.confidence === 'high' ? BLUE : AMBER }}>{s.confidence || 'medium'}</span>
                            </label>
                          ))}
                          <button onClick={() => {
                            const checks = document.querySelectorAll(`input[data-idx]`) as NodeListOf<HTMLInputElement>
                            const selected = suggestions.filter((_: any, i: number) => checks[i]?.checked)
                            if (selected.length) addAiParts(line.id, selected)
                          }} style={{ marginTop: 10, padding: '8px 16px', background: t.aiPurple, color: t.bgLight, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, width: '100%' }}>
                            Add Selected Parts
                          </button>
                        </div>
                      )
                    })()}
                  </>
                )}

                {/* Work Performed */}
                {(() => {
                  const showWorkPerformed = line.resolution && line.resolution.trim().toLowerCase() !== (line.description || '').trim().toLowerCase()
                  if (!showWorkPerformed && wo.is_historical) return null
                  return (
                    <div style={{ marginBottom: 10 }}>
                      <span style={labelStyle}>Work Performed</span>
                      {wo.is_historical && line.resolution ? (
                        <div style={{ marginTop: 6 }}>
                          <ul style={{ margin: '4px 0 0 16px', padding: 0, listStyle: 'disc' }}>
                            {line.resolution.split('\n').filter(Boolean).map((l: string, i: number) => (
                              <li key={i} style={{ fontSize: 13, color: t.textSecondary, marginBottom: 2 }}>{l}</li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <textarea
                          defaultValue={line.resolution || ''}
                          onBlur={e => { if (e.target.value !== (line.resolution || '')) patchLine(line.id, { resolution: e.target.value }) }}
                          placeholder="What was done..."
                          style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                        />
                      )}
                    </div>
                  )
                })()}

                {/* Parts for this job */}
                {lineParts.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <span style={labelStyle}>Parts</span>
                    {lineParts.map((p: any) => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12, borderBottom: '1px solid ${t.border}' }}>
                        <span style={{ flex: 1 }}>{p.description} {p.part_number ? `(${p.part_number})` : ''}</span>
                        <span>{p.quantity}x</span>
                        <span style={{ fontWeight: 600 }}>{fmt(p.unit_cost || 0)}</span>
                        <select
                          value={p.status || 'needed'}
                          onChange={e => updatePartStatus(p.id, e.target.value)}
                          style={{ padding: '2px 6px', fontSize: 11, borderRadius: 6, border: `1px solid ${t.border}`, fontFamily: FONT }}
                        >
                          {Object.entries(PART_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                        <button onClick={() => removePart(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: RED, fontSize: 11 }}>
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                {!wo.is_historical && !isViewOnly && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => {
                      setNewPartForms(prev => ({ ...prev, [line.id]: prev[line.id] || { desc: '', pn: '', qty: '', cost: '' } }))
                    }} style={{ ...btnStyle( t.bgLight, BLUE), padding: '6px 12px', fontSize: 11 }}>
                      <Plus size={12} /> Add Parts
                    </button>
                    <button onClick={() => setHoursModal({ id: line.id, estimated_hours: line.estimated_hours || '', actual_hours: line.actual_hours || '', billed_hours: line.billed_hours || '' })} style={{ ...btnStyle( t.bgLight, GRAY), padding: '6px 12px', fontSize: 11 }}>
                      <Clock size={12} /> Log Hours
                    </button>
                    <button onClick={() => removeJobLine(line.id)} style={{ ...btnStyle('transparent', RED), padding: '6px 12px', fontSize: 11, border: 'none' }}>
                      <X size={12} /> Remove Job
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
                    <button onClick={() => addPart(line.id)} style={btnStyle(BLUE, t.bgLight)}>Add</button>
                    <button onClick={() => setNewPartForms(p => { const n = { ...p }; delete n[line.id]; return n })} style={btnStyle( t.bgLight, GRAY)}>Cancel</button>
                  </div>
                )}
              </div>
            )
          })}

          {/* Add Job Line */}
          {!wo.is_historical && !isViewOnly && (
            <div>
              <div style={{ ...cardStyle, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', borderColor: (newJobText.trim().length >= 2 && isUnrecognizedJob(newJobText)) ? t.danger : undefined }}>
                <button onClick={() => setUseAI(!useAI)} style={{ ...pillStyle(useAI ? t.accentBg : t.surfaceMuted, useAI ? BLUE : GRAY), cursor: 'pointer', border: 'none', fontFamily: FONT }}>
                  <Mic size={11} /> AI {useAI ? 'ON' : 'OFF'}
                </button>
                <input
                  value={newJobText}
                  onChange={e => { setNewJobText(e.target.value); setJobWarning('') }}
                  onKeyDown={e => e.key === 'Enter' && addJobLine()}
                  placeholder={newJobText.trim().length >= 2 && isUnrecognizedJob(newJobText) ? 'What did you mean? Use repair terms like: oil change, brake, pm service...' : 'Describe the job concern...'}
                  style={{ ...inputStyle, flex: 1, minWidth: 200, borderColor: (newJobText.trim().length >= 2 && isUnrecognizedJob(newJobText)) ? t.danger : undefined }}
                />
                <button onClick={addJobLine} disabled={addingJob || !newJobText.trim()} style={{ ...btnStyle(BLUE, t.bgLight), opacity: addingJob || !newJobText.trim() ? 0.5 : 1 }}>
                  <Plus size={14} /> {addingJob ? 'Adding...' : 'Add Job Line'}
                </button>
              </div>
              {newJobText.trim().length >= 2 && isUnrecognizedJob(newJobText) && (
                <div style={{ fontSize: 11, color: RED, fontWeight: 600, marginTop: 4, padding: '0 4px' }}>
                  Unrecognized job — use repair terms like: oil change, brake repair, pm service, tire replacement, alternator, etc.
                </div>
              )}
              {jobWarning && (
                <div style={{ fontSize: 11, color: RED, fontWeight: 600, marginTop: 4, padding: '4px 8px', background: t.dangerBg, borderRadius: 6, border: '1px solid ${t.danger}' }}>
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
              <button onClick={addShopCharge} disabled={!newChargeDesc.trim() || !newChargeAmt} style={{ ...btnStyle(GREEN, t.bgLight), opacity: !newChargeDesc.trim() || !newChargeAmt ? 0.5 : 1 }}>
                <Plus size={14} /> Add Charge
              </button>
            </div>
          )}

          {/* Shop Charges list */}
          {shopCharges.length > 0 && (
            <div style={cardStyle}>
              <span style={{ ...labelStyle, marginBottom: 8 }}>Shop Charges</span>
              {shopCharges.map((c: any) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid ${t.border}', fontSize: 13 }}>
                  <span style={{ flex: 1 }}>{c.description}</span>
                  <span style={{ fontWeight: 700 }}>{fmt(c.amount)}</span>
                  <button onClick={() => removeCharge(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: RED }}><X size={14} /></button>
                </div>
              ))}
            </div>
          )}

          {/* Get Approval — only show when estimate required and NOT yet approved */}
          {!wo.is_historical && wo.estimate_required && !wo.estimate_approved && (
            <div style={{ textAlign: 'right', marginTop: 8 }}>
              <button onClick={() => setApprovalModal(true)} style={btnStyle(BLUE, t.bgLight)}>
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
          {partLines.length === 0 && wo.is_historical && (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 30 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: GRAY }}>No parts recorded</div>
              <div style={{ fontSize: 12, color: GRAY }}>This imported historical work order has no part line items.</div>
            </div>
          )}
          {partLines.length === 0 && !partsLocked && !wo.is_historical && !isViewOnly && (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 30 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: GRAY }}>No parts on this work order</div>
              <button onClick={() => {
                const name = prompt('Part name or description:')
                if (!name?.trim()) return
                fetch('/api/so-lines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ so_id: id, line_type: 'part', description: name.trim(), rough_name: name.trim(), parts_status: 'rough', quantity: 1 }) }).then(() => loadData())
              }} style={{ ...btnStyle(BLUE, t.bgLight), padding: '8px 20px' }}>
                + Add Part
              </button>
            </div>
          )}
          {partLines.length > 0 && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Parts ({partLines.length})</div>
                {!partsLocked && !wo.is_historical && !isViewOnly && (
                  <button onClick={() => {
                    const name = prompt('Part name or description:')
                    if (!name?.trim()) return
                    fetch('/api/so-lines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ so_id: id, line_type: 'part', description: name.trim(), rough_name: name.trim(), parts_status: 'rough', quantity: 1 }) }).then(() => loadData())
                  }} style={{ ...btnStyle(BLUE, t.bgLight), padding: '5px 12px', fontSize: 11 }}>
                    + Add Part
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {partLines.map((p: any) => {
                  const partsEditable = !partsLocked && p.parts_status !== 'canceled'
                  const isConfirmed = p.parts_status && !['rough'].includes(p.parts_status)
                  const statusColors: Record<string, { label: string; bg: string; color: string }> = {
                    rough: { label: 'Requested', bg: t.warningBg, color: t.warning },
                    sourced: { label: 'Confirmed', bg: t.accentBg, color: BLUE },
                    ordered: { label: 'Ordered', bg: t.warningBg, color: AMBER },
                    received: { label: 'Preparing', bg: t.accentBg, color: BLUE },
                    ready_for_job: { label: 'Ready for Pickup', bg: t.successBg, color: GREEN },
                    picked_up: { label: 'Picked Up', bg: t.successBg, color: GREEN },
                    installed: { label: 'Installed', bg: t.successBg, color: t.success },
                    canceled: { label: 'Canceled', bg: t.dangerBg, color: t.danger },
                  }
                  const st = statusColors[p.parts_status || 'rough'] || statusColors.rough
                  return (
                    <div key={p.id} style={{ border: `1px solid ${isConfirmed ? t.successBg : t.warning}`, borderRadius: 10, padding: 12, background: isConfirmed ? t.bgLight : t.warningBg }}>
                      {/* Request layer — always visible */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div style={{ fontSize: 11, color: t.warning }}>
                          Request: <strong style={{ color: t.warning }}>{p.rough_name || p.description || '—'}</strong>
                        </div>
                        <span style={pillStyle(st.bg, st.color)}>{st.label}</span>
                        {!wo.is_historical && !partsLocked && !isMechanic && p.parts_status !== 'canceled' && !['ready_for_job', 'installed'].includes(p.parts_status) && (
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

                      {/* Confirmed layer — shown when real_name exists */}
                      {p.real_name && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, padding: '4px 0' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{p.real_name}{p.part_number ? ` (${p.part_number})` : ''}</span>
                          {!isConfirmed && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: t.warningBg, color: t.warning, fontWeight: 600 }}>Auto-matched — needs Parts confirmation</span>}
                        </div>
                      )}

                      {/* Part note input */}
                      {partNoteOpen === p.id && (
                        <div style={{ display: 'flex', gap: 6, marginTop: 6, marginBottom: 6 }}>
                          <input id={`part-note-${p.id}`} defaultValue={p.finding || ''} placeholder="Add note about this part..." style={{ flex: 1, padding: '6px 10px', border: `1px solid ${t.border}`, borderRadius: 6, fontSize: 12, fontFamily: FONT, outline: 'none' }} onKeyDown={async e => { if (e.key === 'Enter') { await patchLine(p.id, { finding: (e.target as HTMLInputElement).value }); setPartNoteOpen(null) } }} />
                          <button onClick={async () => { const el = document.getElementById(`part-note-${p.id}`) as HTMLInputElement; if (el) await patchLine(p.id, { finding: el.value }); setPartNoteOpen(null) }} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: BLUE, color: t.bgLight, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>Save</button>
                        </div>
                      )}
                      {p.finding && partNoteOpen !== p.id && <div style={{ fontSize: 11, color: GRAY, marginTop: 2, marginBottom: 4, fontStyle: 'italic' }}>Note: {p.finding}</div>}

                      {/* Editable fields for parts dept (rough/sourced state) */}
                      {partsEditable && !wo.is_historical && !isViewOnly && (
                        <div style={{ position: 'relative' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 8, marginTop: 6 }}>
                            <div style={{ position: 'relative' }}>
                              <span style={labelStyle}>Confirmed Part</span>
                              <input value={p.real_name || ''} onChange={e => { const v = e.target.value; const updated = wo.so_lines.map((l: any) => l.id === p.id ? { ...l, real_name: v } : l); setWo((prev: any) => ({ ...prev, so_lines: updated })); searchInventory(p.id, v) }} onBlur={e => { if (partDropdownClicked.current) { partDropdownClicked.current = false; return } if (e.target.value) { patchLine(p.id, { real_name: e.target.value }) } setTimeout(() => setPartSearchResults(prev => { const n = {...prev}; delete n[p.id]; return n }), 200) }} placeholder="Type to search inventory..." style={inputStyle} />
                              {/* Inventory search dropdown */}
                              {partSearchResults[p.id]?.length > 0 && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 8, marginTop: 2, zIndex: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 160, overflowY: 'auto' }}>
                                  {partSearchResults[p.id].map((inv: any) => (
                                    <div key={inv.id} onMouseDown={() => { partDropdownClicked.current = true; autoFillFromInventory(p.id, inv) }} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid ${t.border}', fontSize: 12 }}
                                      onMouseEnter={e => (e.currentTarget.style.background = t.bgHover)} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                                      <div style={{ fontWeight: 600, color: t.text }}>{inv.description}</div>
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
                          <button onClick={async () => { if (!confirm('Delete this part line?')) return; await fetch(`/api/so-lines/${p.id}`, { method: 'DELETE' }); await loadData() }} style={{ background: 'none', border: `1px solid ${RED}33`, borderRadius: 6, color: RED, fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: '4px 10px', fontFamily: FONT }}>
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
                  await loadData()
                }} style={btnStyle(BLUE, t.bgLight)}>
                  Request
                </button>
              </div>
            </div>
          )}

          {/* Parts status summary + notify mechanic */}
          {!wo.is_historical && !partsLocked && partLines.length > 0 && !isViewOnly && (() => {
            const activeParts = partLines.filter((p: any) => p.parts_status !== 'canceled')
            const readyCount = activeParts.filter((p: any) => ['received', 'ready_for_job', 'installed'].includes(p.parts_status)).length
            const orderedCount = activeParts.filter((p: any) => p.parts_status === 'ordered').length
            const roughCount = activeParts.filter((p: any) => !['received', 'ready_for_job', 'installed', 'ordered'].includes(p.parts_status)).length
            const allReady = activeParts.length > 0 && readyCount === activeParts.length

            if (partsSubmitted || allReady) {
              return (
                <div style={{ ...cardStyle, marginTop: 12 }}>
                  <div style={{ textAlign: 'center', color: GREEN, fontSize: 13, fontWeight: 700, padding: 8 }}>All Parts Ready</div>
                  {!partsSubmitted && (
                    <button onClick={submitParts} disabled={partsSubmitting} style={{ ...btnStyle(GREEN, t.bgLight), width: '100%', justifyContent: 'center', marginTop: 8 }}>
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
                  {orderedCount > 0 && <span style={{ color: AMBER, fontWeight: 600 }}>{orderedCount} ordered</span>}
                  {roughCount > 0 && <span style={{ color: t.danger, fontWeight: 600 }}>{roughCount} pending</span>}
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
                  <div key={p.id} style={{ display: 'flex', gap: 8, padding: '4px 0', borderBottom: '1px solid ${t.border}' }}>
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
            <div style={{ ...cardStyle, background: t.successBg, border: '1px solid ${t.success}', marginBottom: 12, fontSize: 13, color: t.success, fontWeight: 600 }}>
              Estimate not required for company trucks. You can still create one manually if needed.
            </div>
          )}

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
                      onClick={() => setApprovalModal(true)}
                      style={btnStyle(BLUE, t.bgLight)}
                    >
                      {estStatus === 'sent' ? 'Resend / Approve' : estStatus === 'declined' ? 'Resend Modified Estimate' : 'Send Estimate'}
                    </button>
                    <button onClick={() => { setApprovalModal(true); setApprovalConfirmModal({ method: 'in_person', notes: '' }) }} style={{ ...btnStyle( t.bgLight, BLUE), border: `1px solid ${BLUE}` }}>
                      Approve In Person
                    </button>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Summary cards */}
          {(() => {
            const partsAmt = woPartsTotal + partsLineTotal
            const displayTotal = wo.is_historical && wo.grand_total ? wo.grand_total : grandTotal
            const items = [
              laborTotal > 0 ? { label: 'Labor', value: fmt(laborTotal), color: BLUE } : null,
              partsAmt > 0 ? { label: 'Parts', value: fmt(partsAmt), color: AMBER } : null,
              chargesTotal > 0 ? { label: 'Charges', value: fmt(chargesTotal), color: GRAY } : null,
              // Tax: only show for live WOs with real calculated tax
              !wo.is_historical && taxAmt > 0 ? { label: 'Tax', value: fmt(taxAmt), color: GRAY } : null,
              { label: 'Total', value: fmt(displayTotal), color: GREEN },
            ].filter(Boolean) as { label: string; value: string; color: string }[]
            return (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 12, marginBottom: 16 }}>
                {items.map(s => (
                  <div key={s.label} style={{ background: t.bgHover, borderRadius: 10, padding: 14, textAlign: 'center' }}>
                    <div style={labelStyle}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Labor detail per job */}
          <div style={cardStyle}>
            <span style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: 'block' }}>Labor</span>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid ${t.border}' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', ...labelStyle }}>Job</th>
                  <th style={{ textAlign: 'center', padding: '6px 8px', ...labelStyle }}>Est Hours</th>
                  <th style={{ textAlign: 'center', padding: '6px 8px', ...labelStyle }}>Actual</th>
                  <th style={{ textAlign: 'center', padding: '6px 8px', ...labelStyle }}>Billed</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', ...labelStyle }}>Rate</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', ...labelStyle }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {jobLines.map((line: any, idx: number) => {
                  const hrs = line.billed_hours || line.actual_hours || line.estimated_hours || 0
                  return (
                    <tr key={line.id} style={{ borderBottom: '1px solid ${t.border}' }}>
                      <td style={{ padding: '6px 8px' }}>Job {idx + 1}: {line.description?.slice(0, 40)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>{line.estimated_hours || 0}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>{line.actual_hours || 0}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>{line.billed_hours || 0}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{isImportedHistory ? (line.labor_rate ? `${fmt(line.labor_rate)}/hr` : '—') : `${fmt(laborRate)}/hr`}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{isImportedHistory ? fmt(line.unit_price || 0) : fmt(hrs * laborRate)}</td>
                    </tr>
                  )
                })}
                <tr style={{ fontWeight: 700 }}>
                  <td colSpan={5} style={{ padding: '8px 8px', textAlign: 'right' }}>Labor Total</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmt(laborTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Parts detail */}
          {partLines.length > 0 && (
            <div style={cardStyle}>
              <span style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: 'block' }}>Parts</span>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid ${t.border}' }}>
                    <th style={{ textAlign: 'center', padding: '6px 8px', ...labelStyle, width: 40 }}>Qty</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', ...labelStyle }}>Part</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', ...labelStyle }}>Part #</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', ...labelStyle }}>Sell</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', ...labelStyle }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {partLines.map((p: any) => {
                    const sell = p.parts_sell_price || 0
                    const qty = p.quantity || 1
                    const lineTotal = sell * qty
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid ${t.border}' }}>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>{qty}</td>
                        <td style={{ padding: '6px 8px' }}>{p.real_name || p.rough_name || p.description || '—'}</td>
                        <td style={{ padding: '6px 8px', color: GRAY }}>{p.part_number || '—'}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(sell)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{fmt(lineTotal)}</td>
                      </tr>
                    )
                  })}
                  <tr style={{ fontWeight: 700 }}>
                    <td colSpan={4} style={{ padding: '8px 8px', textAlign: 'right' }}>Parts Total</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmt(partsLineTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* wo_parts (inline added parts) */}
          {woParts.length > 0 && (
            <div style={cardStyle}>
              <span style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: 'block' }}>Additional Parts</span>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid ${t.border}' }}>
                    <th style={{ textAlign: 'center', padding: '6px 8px', ...labelStyle, width: 40 }}>Qty</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', ...labelStyle }}>Part</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', ...labelStyle }}>Unit Cost</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', ...labelStyle }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {woParts.map((p: any) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid ${t.border}' }}>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>{p.quantity || 1}</td>
                      <td style={{ padding: '6px 8px' }}>{p.description || '—'}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(p.unit_cost)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{fmt((p.quantity || 1) * (p.unit_cost || 0))}</td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 700 }}>
                    <td colSpan={3} style={{ padding: '8px 8px', textAlign: 'right' }}>Additional Parts Total</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmt(woPartsTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Shop Charges */}
          {shopCharges.length > 0 && (
            <div style={cardStyle}>
              <span style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: 'block' }}>Shop Charges</span>
              {shopCharges.map((c: any) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid ${t.border}', fontSize: 13 }}>
                  <span style={{ flex: 1 }}>{c.description}</span>
                  <span>{c.taxable ? '(Taxable)' : ''}</span>
                  <span style={{ fontWeight: 700 }}>{fmt(c.amount)}</span>
                  <button onClick={() => removeCharge(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: RED }}><X size={14} /></button>
                </div>
              ))}
            </div>
          )}

          {/* Imported fee / misc / supplies detail */}
          {wo.is_historical && feeLines.length > 0 && (
            <div style={cardStyle}>
              <span style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: 'block' }}>Fees & Charges</span>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid ${t.border}' }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px', ...labelStyle }}>Description</th>
                    <th style={{ textAlign: 'center', padding: '6px 8px', ...labelStyle, width: 40 }}>Qty</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', ...labelStyle }}>Amount</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', ...labelStyle }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {feeLines.map((f: any) => {
                    const lineTotal = f.total_price || (f.quantity || 1) * (f.unit_price || 0)
                    return (
                      <tr key={f.id} style={{ borderBottom: '1px solid ${t.border}' }}>
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

          {/* Historical parts summary — shown only when no summary card above already displays parts */}
          {wo.is_historical && partLines.length === 0 && wo.parts_total > 0 && !partsLineTotal && (
            <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', fontSize: 13, background: t.bgCard }}>
              <span style={{ color: GRAY }}>Parts (imported summary)</span>
              <span style={{ fontWeight: 700 }}>{fmt(wo.parts_total)}</span>
            </div>
          )}

          {/* Tax — live WOs only */}
          {!wo.is_historical && taxRate > 0 && taxAmt > 0 && (
            <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>Tax ({taxRate}%{shop.tax_labor ? ' incl. labor' : ' parts only'})</span>
              <span style={{ fontWeight: 700 }}>{fmt(taxAmt)}</span>
            </div>
          )}

          {/* Grand Total */}
          <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', background: t.successBg, border: `1px solid ${GREEN}` }}>
            <span style={{ fontSize: 16, fontWeight: 800 }}>Total</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: GREEN }}>{fmt(wo.is_historical && wo.grand_total ? wo.grand_total : grandTotal)}</span>
          </div>

          {/* Signature area */}
          <div style={cardStyle}>
            <span style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: 'block' }}>Authorization</span>
            <div style={{ background: t.bgHover, borderRadius: 8, padding: 20, textAlign: 'center', border: `1px dashed ${t.border}`, minHeight: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: GRAY, fontSize: 13 }}>
              Customer signature area (canvas placeholder)
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: GRAY }}>
              Authorized by: {customer.contact_name || customer.company_name || '—'} | {customer.email || '—'}
            </div>
          </div>
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
              style={{ ...inputStyle, minHeight: 70, resize: 'vertical', marginBottom: 8, paddingRight: 48, background: t.bgCard, color: '#111', border: `1px solid ${t.border}` }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={noteVisible} onChange={e => setNoteVisible(e.target.checked)} />
                Visible to customer
              </label>
              <div style={{ flex: 1 }} />
              <button onClick={addNote} disabled={addingNote || !noteText.trim()} style={{ ...btnStyle(BLUE, t.bgLight), opacity: addingNote || !noteText.trim() ? 0.5 : 1 }}>
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
                <div key={n.id} style={{ padding: '10px 0', borderBottom: '1px solid ${t.border}' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{userMap[n.user_id] || 'System'}</span>
                    <span style={{ fontSize: 11, color: GRAY }}>{fmtDate(n.created_at)}</span>
                    {n.visible_to_customer && <span style={pillStyle(t.accentBg, BLUE)}>Customer Visible</span>}
                  </div>
                  <div style={{ fontSize: 13, color: t.textSecondary, whiteSpace: 'pre-wrap' }}>{n.note_text}</div>
                </div>
              ))}
            </div>
          )}

          {/* File upload — hidden for historical/imported records */}
          {!wo.is_historical && !isViewOnly && (
          <div style={cardStyle}>
            <span style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: 'block' }}>Files</span>
            <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={e => uploadFiles(e.target.files)} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} style={btnStyle( t.bgLight, BLUE)}>
              <Upload size={14} /> {uploading ? 'Uploading...' : 'Upload Files'}
            </button>
          </div>
          )}

          {/* Files list */}
          {files.length > 0 && (
            <div style={cardStyle}>
              <span style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: 'block' }}>Uploaded Files ({files.length})</span>
              {files.map((f: any) => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid ${t.border}' }}>
                  <Paperclip size={14} color={GRAY} />
                  <a href={f.file_url} target="_blank" rel="noreferrer" style={{ color: BLUE, fontSize: 13, fontWeight: 600, textDecoration: 'none', flex: 1 }}>
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
            <div key={a.id} style={{ display: 'flex', gap: 12, paddingBottom: 14, marginBottom: 14, borderLeft: i < activity.length - 1 ? `2px solid ${t.border}` : '2px solid transparent', paddingLeft: 16, position: 'relative' }}>
              <div style={{ position: 'absolute', left: -5, top: 2, width: 8, height: 8, borderRadius: '50%', background: BLUE }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: t.text }}>{a.action}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: GRAY }}>{userMap[a.user_id] || a.users?.full_name || 'System'}</span>
                  <span style={{ fontSize: 11, color: t.textTertiary }}>{fmtDate(a.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========== TAB 5: INVOICE ========== */}
      {tab === 5 && !wo.is_historical && (
        <div style={{ background: t.bgElevated, borderRadius: 16, border: '1px solid ${t.border}', padding: 'clamp(12px, 3vw, 24px)' }}>

          {/* ── Invoice Title Bar ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid ${t.border}' }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: t.text, letterSpacing: '-0.02em' }}>Invoice</span>
            {(() => {
              const statusMap: Record<string, { label: string; bg: string; color: string }> = {
                draft: { label: 'Draft', bg: t.surfaceMuted, color: t.textSecondary },
                accounting_review: { label: 'Under Review', bg: t.warningBg, color: t.warning },
                sent: { label: 'Sent to Customer', bg: t.accentBg, color: t.accent },
                paid: { label: 'Paid', bg: t.successBg, color: t.success },
                closed: { label: 'Closed', bg: t.surfaceMuted, color: t.textSecondary },
              }
              const s = statusMap[wo.invoice_status] || statusMap.draft
              return <span style={{ padding: '3px 12px', borderRadius: 100, fontSize: 10, fontWeight: 700, background: s.bg, color: s.color, textTransform: 'uppercase', letterSpacing: '.04em' }}>{s.label}</span>
            })()}
          </div>

          {/* ── Invoice Info: From / Bill To / Details ── */}
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20 }}>
              {/* From */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>From</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{shop.payment_payee_name || shop.dba || shop.name || '—'}</div>
                {(shop.payment_mail_address || shop.address) && (
                  <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.7 }}>
                    {shop.payment_mail_address || shop.address}
                    {(shop.payment_mail_city || shop.payment_mail_state || shop.payment_mail_zip) && <br />}
                    {[shop.payment_mail_city, shop.payment_mail_state].filter(Boolean).join(', ')} {shop.payment_mail_zip || ''}
                  </div>
                )}
                {shop.phone && <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>{shop.phone}</div>}
                {shop.email && <div style={{ fontSize: 12, color: t.textSecondary }}>{shop.email}</div>}
              </div>
              {/* Bill To */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Bill To</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{customer?.company_name || '—'}</div>
                {(contactEmail || customer?.email) && (
                  <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>{contactEmail || customer.email}</div>
                )}
                {(contactPhone || customer?.phone) && (
                  <div style={{ fontSize: 12, color: t.textSecondary }}>{contactPhone || customer.phone}</div>
                )}
              </div>
              {/* Invoice Details */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Details</div>
                <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.8 }}>
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
                <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.8 }}>
                  <div style={{ fontWeight: 600 }}>#{asset?.unit_number || '—'}</div>
                  {(asset?.year || asset?.make || asset?.model) && (
                    <div>{[asset.year, asset.make, asset.model].filter(Boolean).join(' ')}</div>
                  )}
                  {asset?.vin && <div style={{ color: GRAY, fontSize: 11 }}>VIN: ...{vinDisplay}</div>}
                </div>
              </div>
            </div>
          </div>

          {['sent', 'paid', 'closed'].includes(wo.invoice_status) && (
            <div style={{ background: t.warningBg, border: '1px solid ${t.warning}', borderRadius: 8, padding: '8px 14px', marginBottom: 16, fontSize: 12, color: t.warning, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>&#128274;</span> Editing locked — invoice has been sent to customer
            </div>
          )}

          {/* ── Job-Grouped Invoice Body ── */}
          {(() => {
            const orphanParts = partLines.filter((p: any) => !p.related_labor_line_id || !jobLines.some((j: any) => j.id === p.related_labor_line_id))
            return (
              <>
                {jobLines.map((line: any, idx: number) => {
                  const hrs = line.billed_hours || line.actual_hours || line.estimated_hours || 0
                  const jobLaborAmt = hrs * laborRate
                  const jobParts = partLines.filter((p: any) => p.related_labor_line_id === line.id)
                  const jobPartsTotal = jobParts.reduce((s: number, p: any) => s + ((p.parts_sell_price || p.unit_price || 0) * (p.quantity || 1)), 0)
                  const jobTotal = jobLaborAmt + jobPartsTotal

                  return (
                    <div key={line.id} style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
                      {/* A. Job Header */}
                      <div style={{ padding: '10px 20px', borderBottom: '1px solid ${t.border}', background: t.bgCard, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.04em' }}>Job {idx + 1}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{line.description?.slice(0, 60) || `Job ${idx + 1}`}</span>
                      </div>

                      <div style={{ padding: '0 20px' }}>
                        {/* B. Labor Detail */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', padding: '10px 8px 6px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid ${t.border}' }}>Labor</th>
                              <th style={{ textAlign: 'center', padding: '10px 8px 6px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid ${t.border}', width: 80 }}>Hours</th>
                              <th style={{ textAlign: 'right', padding: '10px 8px 6px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid ${t.border}', width: 70 }}>Rate</th>
                              <th style={{ textAlign: 'right', padding: '10px 8px 6px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid ${t.border}', width: 80 }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td style={{ padding: '8px 8px', color: t.textSecondary, fontWeight: 500 }}>{line.description?.slice(0, 50) || `Job ${idx + 1}`}</td>
                              <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                                {canEditPrices ? (
                                  <input type="number" step="0.25" defaultValue={line.billed_hours || ''} onBlur={async e => { const v = parseFloat(e.target.value) || 0; if (v !== (line.billed_hours || 0)) { await patchLine(line.id, { billed_hours: v }); } }} placeholder={String(line.estimated_hours || 0)} style={{ width: 60, textAlign: 'center', padding: '4px 6px', border: `1px solid ${t.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit', background: t.bgCard }} />
                                ) : (
                                  <span style={{ fontWeight: 600 }}>{line.billed_hours || hrs}</span>
                                )}
                              </td>
                              <td style={{ padding: '8px 8px', textAlign: 'right', color: GRAY }}>{isImportedHistory ? (line.labor_rate ? `${fmt(line.labor_rate)}/hr` : '—') : `${fmt(laborRate)}/hr`}</td>
                              <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700, color: t.text }}>{isImportedHistory ? fmt(line.unit_price || 0) : fmt(jobLaborAmt)}</td>
                            </tr>
                          </tbody>
                        </table>

                        {/* C. Parts for this Job */}
                        {jobParts.length > 0 && (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 4 }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'center', padding: '8px 8px 6px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid ${t.border}', width: 36 }}>Qty</th>
                                <th style={{ textAlign: 'left', padding: '8px 8px 6px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid ${t.border}' }}>Parts</th>
                                <th style={{ textAlign: 'left', padding: '8px 8px 6px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid ${t.border}', width: 80 }}>Part #</th>
                                <th style={{ textAlign: 'right', padding: '8px 8px 6px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid ${t.border}', width: 60 }}>Cost</th>
                                <th style={{ textAlign: 'right', padding: '8px 8px 6px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid ${t.border}', width: 60 }}>Sell</th>
                                <th style={{ textAlign: 'right', padding: '8px 8px 6px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid ${t.border}', width: 80 }}>Amount</th>
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
                                  <tr key={p.id} style={{ borderBottom: pi < jobParts.length - 1 ? '1px solid ${t.border}' : 'none', opacity: isZero ? 0.45 : 1 }}>
                                    <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600 }}>{qty}</td>
                                    <td style={{ padding: '6px 8px' }}>
                                      <span style={{ color: t.text, fontWeight: 500 }}>{p.real_name || p.rough_name || p.description || '—'}</span>
                                      {p.real_name && p.rough_name && p.real_name !== p.rough_name && (
                                        <div style={{ fontSize: 9, color: t.textTertiary, marginTop: 1 }}>Originally: {p.rough_name}</div>
                                      )}
                                    </td>
                                    <td style={{ padding: '6px 8px', color: GRAY, fontSize: 11 }}>{p.part_number || '—'}</td>
                                    <td style={{ padding: '6px 8px', textAlign: 'right', color: GRAY, fontSize: 11 }}>{canSeePrices ? fmt(cost) : '—'}</td>
                                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{canSeePrices ? fmt(sell) : '—'}</td>
                                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: t.text }}>{fmt(lineTotal)}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>

                      {/* D. Job Financial Recap */}
                      <div style={{ padding: '8px 20px', borderTop: '1px solid ${t.border}' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 20, fontSize: 11, color: GRAY }}>
                          <span>Labor: {fmt(jobLaborAmt)}</span>
                          {jobParts.length > 0 && <span>Parts: {fmt(jobPartsTotal)}</span>}
                          <span style={{ color: t.textSecondary, fontWeight: 600 }}>Job Total: {fmt(jobTotal)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Orphan Parts — parts not linked to any specific job */}
                {orphanParts.length > 0 && (
                  <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
                    <div style={{ padding: '10px 20px', borderBottom: '1px solid ${t.border}', background: t.bgCard, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: t.text, textTransform: 'uppercase', letterSpacing: '.04em' }}>Additional Parts</span>
                      <span style={{ fontSize: 11, color: GRAY }}>({orphanParts.length} {orphanParts.length === 1 ? 'item' : 'items'})</span>
                    </div>
                    <div style={{ padding: '0 20px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'center', padding: '8px 8px 6px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid ${t.border}', width: 36 }}>Qty</th>
                            <th style={{ textAlign: 'left', padding: '8px 8px 6px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid ${t.border}' }}>Part</th>
                            <th style={{ textAlign: 'left', padding: '8px 8px 6px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid ${t.border}', width: 80 }}>Part #</th>
                            <th style={{ textAlign: 'right', padding: '8px 8px 6px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid ${t.border}', width: 60 }}>Cost</th>
                            <th style={{ textAlign: 'right', padding: '8px 8px 6px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid ${t.border}', width: 60 }}>Sell</th>
                            <th style={{ textAlign: 'right', padding: '8px 8px 6px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid ${t.border}', width: 80 }}>Amount</th>
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
                              <tr key={p.id} style={{ borderBottom: pi < orphanParts.length - 1 ? '1px solid ${t.border}' : 'none', opacity: isZero ? 0.45 : 1 }}>
                                <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600 }}>{qty}</td>
                                <td style={{ padding: '6px 8px' }}>
                                  <span style={{ color: t.text, fontWeight: 500 }}>{p.real_name || p.rough_name || p.description || '—'}</span>
                                  {p.real_name && p.rough_name && p.real_name !== p.rough_name && (
                                    <div style={{ fontSize: 9, color: t.textTertiary, marginTop: 1 }}>Originally: {p.rough_name}</div>
                                  )}
                                </td>
                                <td style={{ padding: '6px 8px', color: GRAY, fontSize: 11 }}>{p.part_number || '—'}</td>
                                <td style={{ padding: '6px 8px', textAlign: 'right', color: GRAY, fontSize: 11 }}>{canSeePrices ? fmt(cost) : '—'}</td>
                                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{canSeePrices ? fmt(sell) : '—'}</td>
                                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: t.text }}>{fmt(lineTotal)}</td>
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
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid ${t.border}' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: t.text, textTransform: 'uppercase', letterSpacing: '.04em' }}>Summary</span>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: t.textSecondary }}>
                <span>Labor ({jobLines.length} {jobLines.length === 1 ? 'job' : 'jobs'})</span>
                <span style={{ fontWeight: 600 }}>{fmt(laborTotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: t.textSecondary }}>
                <span>Parts ({partLines.length} {partLines.length === 1 ? 'item' : 'items'})</span>
                <span style={{ fontWeight: 600 }}>{fmt(partsLineTotal + woPartsTotal)}</span>
              </div>
              {shopCharges.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: t.textSecondary }}>
                  <span>Shop Charges</span>
                  <span style={{ fontWeight: 600 }}>{fmt(shopCharges.reduce((s: number, c: any) => s + (c.amount || 0), 0))}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13, borderTop: '1px solid ${t.border}', marginTop: 6 }}>
                <span style={{ color: GRAY }}>Subtotal</span>
                <span style={{ fontWeight: 600 }}>{fmt(subtotal)}</span>
              </div>
              {taxAmt > 0 ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, color: GRAY }}>
                  <span>Tax ({taxRate}%{shop.tax_labor ? ' incl. labor' : ' parts only'})</span>
                  <span>{fmt(taxAmt)}</span>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, color: t.textTertiary }}>
                  <span>Tax</span><span>Exempt</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0 4px', borderTop: '1px solid ${t.border}', marginTop: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: t.text }}>Invoice Total</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: GREEN }}>{fmt(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* ── Payment Instructions ── */}
          {shop.payment_payee_name && (
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
            <div style={{ padding: '10px 20px', borderBottom: '1px solid ${t.border}', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '.04em' }}>Payment Instructions</span>
              <span style={{ fontSize: 11, color: GRAY }}>Payable to: {shop.payment_payee_name}</span>
            </div>
            <div style={{ padding: '12px 20px' }}>
              {shop.payment_bank_name && <div style={{ fontSize: 11, color: GRAY, marginBottom: 10 }}>Bank: {shop.payment_bank_name}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
                {shop.payment_ach_account && (
                <div style={{ background: t.bgCard, borderRadius: 6, padding: '10px 12px', border: `1px solid ${t.border}`, overflow: 'hidden' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>ACH Payment</div>
                  <div style={{ fontSize: 11, color: t.textSecondary, lineHeight: 1.6 }}>
                    <div>Account: <span style={{ fontWeight: 600 }}>{shop.payment_ach_account}</span></div>
                    {shop.payment_ach_routing && <div>Routing: <span style={{ fontWeight: 600 }}>{shop.payment_ach_routing}</span></div>}
                  </div>
                </div>
                )}
                {shop.payment_wire_account && (
                <div style={{ background: t.bgCard, borderRadius: 6, padding: '10px 12px', border: `1px solid ${t.border}`, overflow: 'hidden' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Wire Transfer</div>
                  <div style={{ fontSize: 11, color: t.textSecondary, lineHeight: 1.6 }}>
                    <div>Account: <span style={{ fontWeight: 600 }}>{shop.payment_wire_account}</span></div>
                    {shop.payment_wire_routing && <div>Routing: <span style={{ fontWeight: 600 }}>{shop.payment_wire_routing}</span></div>}
                  </div>
                </div>
                )}
                {(shop.payment_zelle_email_1 || shop.payment_zelle_email_2) && (
                <div style={{ background: t.bgCard, borderRadius: 6, padding: '10px 12px', border: `1px solid ${t.border}`, overflow: 'hidden' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Zelle</div>
                  <div style={{ fontSize: 11, color: t.textSecondary, lineHeight: 1.6, overflowWrap: 'break-word', wordBreak: 'break-all' }}>
                    {shop.payment_zelle_email_1 && <div>{shop.payment_zelle_email_1}</div>}
                    {shop.payment_zelle_email_2 && <div>{shop.payment_zelle_email_2}</div>}
                  </div>
                </div>
                )}
                {shop.payment_mail_payee && (
                <div style={{ background: t.bgCard, borderRadius: 6, padding: '10px 12px', border: `1px solid ${t.border}`, overflow: 'hidden' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Mail Check To</div>
                  <div style={{ fontSize: 11, color: t.textSecondary, lineHeight: 1.6, overflowWrap: 'break-word' }}>
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
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {wo.invoice_status === 'draft' && !isViewOnly && (
                  <button onClick={() => invoiceAction('submit_to_accounting')} disabled={invoiceLoading} style={{ ...btnStyle(GREEN, t.bgLight), padding: '8px 20px', fontSize: 13, borderRadius: 8 }}>
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
                    }} disabled={invoiceLoading} style={{ ...btnStyle(GREEN, t.bgLight), padding: '8px 20px', fontSize: 13, borderRadius: 8 }}>Approve & Send</button>
                    <a href={wo.invoices?.[0]?.id ? `/invoices/${wo.invoices[0].id}` : getWorkorderRoute(wo.id)} style={{ ...btnStyle( t.bgLight, BLUE), border: `1px solid ${BLUE}33`, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, borderRadius: 8 }}>Edit Invoice</a>
                  </>
                )}
                {wo.invoice_status === 'accounting_review' && !canEditPrices && (
                  <span style={{ fontSize: 12, color: AMBER, fontWeight: 600 }}>Awaiting accounting approval</span>
                )}
                {wo.invoice_status === 'sent' && canEditPrices && (
                  <button onClick={() => invoiceAction('mark_paid')} disabled={invoiceLoading} style={{ ...btnStyle(GREEN, t.bgLight), padding: '8px 20px', fontSize: 13, borderRadius: 8 }}>Record Payment</button>
                )}
                {wo.invoice_status === 'paid' && !isViewOnly && (
                  <button onClick={() => invoiceAction('close_wo')} disabled={invoiceLoading} style={{ ...btnStyle(GRAY, t.bgLight), padding: '8px 18px', fontSize: 13, borderRadius: 8 }}>Close Work Order</button>
                )}
                {wo.invoice_status === 'closed' && (
                  <span style={{ color: t.textSecondary, fontWeight: 600, fontSize: 13 }}>Work Order Closed</span>
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
                  <a href={`/api/invoices/${wo.invoices[0].id}/pdf`} target="_blank" rel="noopener" style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid ${t.border}', background: t.bgCard, color: t.textSecondary, fontSize: 11, fontWeight: 600, textDecoration: 'none', fontFamily: FONT }}>PDF</a>
                  <a href={`/invoices/${wo.invoices[0].id}`} target="_blank" rel="noopener" onClick={e => { e.preventDefault(); const w = window.open(`/invoices/${wo.invoices[0].id}`, '_blank'); if (w) setTimeout(() => w.print(), 1500) }} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid ${t.border}', background: t.bgCard, color: t.textSecondary, fontSize: 11, fontWeight: 600, textDecoration: 'none', cursor: 'pointer', fontFamily: FONT }}>Print</a>
                  <a href={`/invoices/${wo.invoices[0].id}`} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid ${t.border}', background: t.bgCard, color: t.textSecondary, fontSize: 11, fontWeight: 600, textDecoration: 'none', fontFamily: FONT }}>View</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========== TAB 5: IMPORTED HISTORICAL INVOICE (read-only) ========== */}
      {tab === 5 && wo.is_historical && (
        <div style={{ background: t.bgElevated, borderRadius: 16, border: '1px solid ${t.border}', padding: 'clamp(12px, 3vw, 24px)' }}>
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: t.text }}>Invoice (Imported History)</span>
          </div>
          {wo.invoices?.[0] ? (
            <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: t.textSecondary }}>
                <span>Invoice #</span><span style={{ fontWeight: 600 }}>{wo.invoices[0].invoice_number || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: t.textSecondary }}>
                <span>Status</span><span style={{ fontWeight: 600, color: wo.invoices[0].status === 'paid' ? GREEN : undefined }}>{(wo.invoices[0].status || '—').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: t.textSecondary }}>
                <span>Labor</span><span style={{ fontWeight: 600 }}>{fmt(laborTotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: t.textSecondary }}>
                <span>Parts</span><span style={{ fontWeight: 600 }}>{fmt(partsLineTotal)}</span>
              </div>
              {chargesTotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: t.textSecondary }}>
                  <span>Fees</span><span style={{ fontWeight: 600 }}>{fmt(chargesTotal)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0 4px', borderTop: '1px solid ${t.border}', marginTop: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: t.text }}>Total</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: GREEN }}>{fmt(wo.invoices[0].total || wo.grand_total || 0)}</span>
              </div>
              {wo.invoices[0].balance_due > 0 && wo.invoices[0].status !== 'paid' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, color: AMBER }}>
                  <span>Balance Due</span><span style={{ fontWeight: 600 }}>{fmt(wo.invoices[0].balance_due)}</span>
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: GRAY, fontSize: 13, padding: 20, textAlign: 'center' }}>No invoice record available for this imported work order.</div>
          )}
        </div>
      )}

      {/* ========== INVOICE STATUS (compact — shown on other tabs, no duplicate actions) ========== */}
      {!wo.is_historical && tab !== 5 && wo.invoice_status && wo.invoice_status !== 'draft' && (
        <div style={{ ...cardStyle, marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: GRAY }}>Invoice</span>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100, textTransform: 'uppercase',
            background: wo.invoice_status === 'closed' ? t.surfaceMuted : wo.invoice_status === 'paid' ? t.successBg : wo.invoice_status === 'sent' ? t.accentBg : t.warningBg,
            color: wo.invoice_status === 'closed' ? GRAY : wo.invoice_status === 'paid' ? GREEN : wo.invoice_status === 'sent' ? BLUE : AMBER,
          }}>{(wo.invoice_status || '').replace(/_/g, ' ')}</span>
        </div>
      )}

      {/* Mechanic role — hide prices indicator */}
      {isMechanic && !wo.is_historical && (
        <div style={{ ...cardStyle, marginTop: 12, background: t.bgHover, textAlign: 'center', color: GRAY, fontSize: 12, padding: 12 }}>
          Pricing information is managed by the service department
        </div>
      )}

      {/* ========== MODALS ========== */}

      {/* Team Modal */}
      {showTeamModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowTeamModal(false)}>
          <div style={{ background: t.bgCard, borderRadius: 12, padding: 24, width: 400, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
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
              <button onClick={() => setShowTeamModal(false)} style={btnStyle( t.bgLight, GRAY)}>Cancel</button>
              <button onClick={saveTeamAssign} style={btnStyle(BLUE, t.bgLight)}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {assignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setAssignModal(null)}>
          <div style={{ background: t.bgCard, borderRadius: 12, padding: 24, width: 480, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
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
                      <div key={s.user_id} onClick={() => addMechToList(s.user_id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, border: `1px solid ${t.border}`, cursor: 'pointer', background: t.bgCard }}
                        onMouseEnter={e => (e.currentTarget.style.background = t.accentBg)}
                        onMouseLeave={e => (e.currentTarget.style.background = t.bgCard)}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                          <div style={{ fontSize: 10, color: GRAY }}>
                            {s.matchingSkills?.length > 0
                              ? s.matchingSkills.map((sk: any) => `${sk.skill}${sk.certified ? ' ✓' : ''}`).join(', ')
                              : s.status === 'on_job' ? 'Clocked in' : 'Available'}
                            {s.jobsInQueue > 0 ? ` · ${s.jobsInQueue} active job${s.jobsInQueue > 1 ? 's' : ''}` : ' · No active jobs'}
                          </div>
                        </div>
                        <span style={{ fontSize: 9, fontWeight: 700, color: s.score >= 50 ? GREEN : s.score >= 20 ? AMBER : GRAY, background: s.score >= 50 ? t.successBg : s.score >= 20 ? t.warningBg : t.surfaceMuted, padding: '2px 6px', borderRadius: 4 }}>
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
                  <div key={a.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid ${t.border}' }}>
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
              <button onClick={() => setAssignModal(null)} style={btnStyle( t.bgLight, GRAY)}>Cancel</button>
              <button onClick={saveAssignments} style={btnStyle(BLUE, t.bgLight)}>Save Assignments</button>
            </div>
          </div>
        </div>
      )}

      {/* Hours Modal */}
      {hoursModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setHoursModal(null)}>
          <div style={{ background: t.bgCard, borderRadius: 12, padding: 24, width: 360, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
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
              <button onClick={() => setHoursModal(null)} style={btnStyle( t.bgLight, GRAY)}>Cancel</button>
              <button onClick={saveHours} style={btnStyle(BLUE, t.bgLight)}>Save Hours</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setDeleteConfirm(false)}>
          <div style={{ background: t.bgCard, borderRadius: 12, padding: 24, width: 380, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
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
              <button onClick={() => { setDeleteConfirm(false); setDeleteText('') }} style={btnStyle( t.bgLight, GRAY)}>Cancel</button>
              <button onClick={deleteWO} disabled={deleteText !== 'DELETE'} style={{ ...btnStyle(RED, t.bgLight), opacity: deleteText !== 'DELETE' ? 0.5 : 1 }}>Void</button>
            </div>
          </div>
        </div>
      )}

      {/* Estimate Approval Modal — 3 paths */}
      {approvalModal && (() => {
        const estimateId = wo.estimates?.[0]?.id || wo.estimate_id
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
            await fetch(`/api/estimates/${estimateId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ customer_email: contactEmail, customer_phone: contactPhone }),
            })
          }
        }

        async function approveEstimate(method: 'in_person' | 'printed_signed', notes?: string) {
          if (estimateId) {
            await fetch(`/api/estimates/${estimateId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'approved', approval_method: method, approved_by: user?.id, approved_at: new Date().toISOString(), customer_notes: notes || null }),
            })
          }
          await fetch(`/api/work-orders/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estimate_approved: true, estimate_status: 'approved', approval_method: method }),
          })
          const methodLabel = method === 'in_person' ? 'in person' : '(printed and signed)'
          logActivity(`Estimate approved ${methodLabel} by ${user?.full_name || 'service writer'}${notes ? ` — Notes: ${notes}` : ''}`)
          try {
            const { createNotification, getUserIdsByRole } = await import('@/lib/createNotification')
            const mgrs = await getUserIdsByRole(wo.shop_id, ['owner', 'gm', 'shop_manager', 'floor_manager'])
            if (mgrs.length > 0) await createNotification({ shopId: wo.shop_id, recipientId: mgrs, type: 'estimate_approved', title: `Estimate approved — WO #${wo.so_number}`, body: `Ready to assign. Total: ${fmt(grandTotal)}`, link: `/work-orders/${id}`, relatedWoId: id })
          } catch {}
          setApprovalModal(false)
          setApprovalConfirmModal(null)
          setPrintedReady(false)
          setToastMsg('Estimate approved — work order activated')
          setTimeout(() => setToastMsg(''), 4000)
          await loadData()
        }

        async function sendEstimateEmail() {
          if (!estimateId) { alert('Build an estimate first'); return }
          // Save contact info first
          await saveContactInfo()
          const res = await fetch(`/api/estimates/${estimateId}/send`, { method: 'POST' })
          if (res.ok) {
            logActivity(`Estimate sent to ${contactEmail || contactPhone}`)
            setToastMsg('Estimate sent to customer')
            setTimeout(() => setToastMsg(''), 4000)
          } else {
            alert('Failed to send estimate')
          }
          setApprovalModal(false)
          await loadData()
        }

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setApprovalModal(false)}>
            <div style={{ background: t.bgCard, borderRadius: 12, padding: 24, width: 520, maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>Get Estimate Approval</span>
                <button onClick={() => setApprovalModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <div style={{ fontSize: 13, marginBottom: 16, padding: '10px 14px', background: t.bgHover, borderRadius: 8 }}>
                <div style={{ marginBottom: 4 }}>Estimate total: <strong style={{ color: GREEN }}>{fmt(grandTotal)}</strong></div>
                <div>Customer: <strong>{customer?.contact_name || customer?.company_name || '—'}</strong></div>
              </div>

              {/* Contact fields — always visible, always editable */}
              <div style={{ marginBottom: 16, padding: '12px 14px', border: `1px solid ${t.border}`, borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Send Estimate To</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: GRAY, marginBottom: 4, display: 'block' }}>Email</label>
                    <input
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
                      value={contactPhone}
                      onChange={e => setContactPhone(e.target.value)}
                      onBlur={saveContactInfo}
                      placeholder="+1 (555) 000-0000"
                      style={{ ...inputStyle, fontSize: 12 }}
                    />
                  </div>
                </div>
                {!hasContact && (
                  <div style={{ padding: '6px 8px', background: t.warningBg, border: '1px solid rgba(217,119,6,0.2)', borderRadius: 6, fontSize: 11, color: t.warning, marginTop: 8 }}>
                    Add at least one contact method to send estimate
                  </div>
                )}
              </div>

              {/* Path 1: Send Estimate */}
              <div style={{ marginBottom: 12, padding: '12px 14px', border: `1px solid ${t.border}`, borderRadius: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Send Estimate</div>
                <div style={{ fontSize: 12, color: GRAY, marginBottom: 8 }}>Send estimate via email and/or SMS with approval link</div>
                <button
                  onClick={sendEstimateEmail}
                  disabled={!hasContact}
                  style={{ ...btnStyle(BLUE, t.bgLight), width: '100%', justifyContent: 'center', opacity: hasContact ? 1 : 0.5, cursor: hasContact ? 'pointer' : 'not-allowed' }}
                >
                  Send Estimate{contactEmail && contactPhone ? ' (Email + SMS)' : contactEmail ? ' (Email)' : contactPhone ? ' (SMS)' : ''}
                </button>
              </div>

              {/* Path 2: Approve In Person */}
              <div style={{ marginBottom: 12, padding: '12px 14px', border: `1px solid ${t.border}`, borderRadius: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Approve In Person</div>
                <div style={{ fontSize: 12, color: GRAY, marginBottom: 8 }}>Customer has reviewed and verbally approved this estimate</div>
                <button onClick={() => setApprovalConfirmModal({ method: 'in_person', notes: '' })} style={{ ...btnStyle( t.bgLight, BLUE), width: '100%', justifyContent: 'center', border: `1px solid ${BLUE}` }}>
                  Approve In Person
                </button>
              </div>

              {/* Path 3: Print & Sign */}
              <div style={{ padding: '12px 14px', border: `1px solid ${t.border}`, borderRadius: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Print and Sign</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {estimateId ? (
                    <a
                      href={`/api/estimates/${estimateId}/pdf`}
                      target="_blank"
                      onClick={() => setPrintedReady(true)}
                      style={{ ...btnStyle( t.bgLight, GRAY), flex: 1, justifyContent: 'center', textDecoration: 'none', textAlign: 'center', border: '1px solid ${t.border}' }}
                    >
                      Print Estimate
                    </a>
                  ) : (
                    <button disabled style={{ ...btnStyle( t.bgLight, GRAY), flex: 1, justifyContent: 'center', border: '1px solid ${t.border}', opacity: 0.5, cursor: 'not-allowed' }}>
                      Build estimate first
                    </button>
                  )}
                  {printedReady ? (
                    <button onClick={() => setApprovalConfirmModal({ method: 'printed_signed', notes: '' })} style={{ ...btnStyle(BLUE, t.bgLight), flex: 1, justifyContent: 'center' }}>
                      Mark as Signed &amp; Approved
                    </button>
                  ) : (
                    <button disabled style={{ ...btnStyle( t.bgLight, GRAY), flex: 1, justifyContent: 'center', border: '1px solid ${t.border}', opacity: 0.5, cursor: 'not-allowed' }}>
                      Print first →
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* In-Person / Print Confirmation sub-modal */}
            {approvalConfirmModal && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }} onClick={() => setApprovalConfirmModal(null)}>
                <div style={{ background: t.bgCard, borderRadius: 12, padding: 24, width: 420, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
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
                    <button onClick={() => setApprovalConfirmModal(null)} style={btnStyle( t.bgLight, GRAY)}>Cancel</button>
                    <button onClick={() => approveEstimate(approvalConfirmModal.method as 'in_person' | 'printed_signed', approvalConfirmModal.notes)} style={btnStyle(BLUE, t.bgLight)}>
                      Confirm Approval
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
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 700, color: t.textSecondary, display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}
          >
            <span style={{ transform: showExternalData ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', display: 'inline-block' }}>&#9654;</span>
            Additional Info
          </button>
          {showExternalData && (
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {Object.entries(wo.external_data).map(([key, val]) => (
                <div key={key} style={{ fontSize: 12 }}>
                  <span style={{ color: GRAY, fontWeight: 600 }}>{key.replace(/_/g, ' ')}: </span>
                  <span style={{ color: t.textSecondary }}>{val != null ? String(val) : '\u2014'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FOOTER */}
      <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 11, color: t.textTertiary, borderTop: '1px solid ${t.border}', marginTop: 24 }}>
        {shop.name || shop.dba || 'TruckZen'} {shop.phone ? ` | ${shop.phone}` : ''} {shop.email ? ` | ${shop.email}` : ''}
      </div>

      {/* Toast notification */}
      {toastMsg && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: t.bgElevated, color: t.bgLight, padding: '12px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 2000, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', fontFamily: FONT }}>
          {toastMsg}
        </div>
      )}
    </div>
  )
}
