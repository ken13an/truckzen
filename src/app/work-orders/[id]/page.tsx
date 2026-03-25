'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser, type UserProfile } from '@/lib/auth'
import { ChevronLeft, Users, MessageSquare, Clock, DollarSign, MoreHorizontal, Plus, Mic, Upload, X, Paperclip } from 'lucide-react'
import AITextInput from '@/components/ai-text-input'
import SourceBadge from '@/components/ui/SourceBadge'
import OwnershipTypeBadge from '@/components/OwnershipTypeBadge'

const FONT = "'Inter', -apple-system, sans-serif"
const BLUE = '#1D6FE8', GREEN = '#16A34A', RED = '#DC2626', AMBER = '#D97706', GRAY = '#6B7280'

const LINE_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  unassigned:     { label: 'Unassigned',     bg: '#FEF2F2', color: '#DC2626' },
  approved:       { label: 'Approved',       bg: '#F0FDF4', color: '#16A34A' },
  pending_review: { label: 'Pending Review', bg: '#FFFBEB', color: '#D97706' },
  in_progress:    { label: 'In Progress',    bg: '#EFF6FF', color: '#1D6FE8' },
  completed:      { label: 'Completed',      bg: '#F0FDF4', color: '#15803D' },
}

const WO_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  open:        { label: 'Open',        bg: '#EFF6FF', color: BLUE },
  in_progress: { label: 'In Progress', bg: '#EFF6FF', color: BLUE },
  completed:   { label: 'Completed',   bg: '#F0FDF4', color: GREEN },
  invoiced:    { label: 'Invoiced',    bg: '#ECFDF5', color: '#059669' },
  closed:      { label: 'Closed',      bg: '#F3F4F6', color: GRAY },
}

const PART_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  needed: { label: 'Needed', bg: '#FEF2F2', color: RED },
  ordered: { label: 'Ordered', bg: '#FFFBEB', color: AMBER },
  received: { label: 'Received', bg: '#EFF6FF', color: BLUE },
  installed: { label: 'Installed', bg: '#F0FDF4', color: GREEN },
}

const TABS = ['Jobs', 'Parts', 'Estimate', 'Files & Notes', 'Activity']

const pillStyle = (bg: string, color: string): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: bg, color })
const inputStyle: React.CSSProperties = { padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, fontFamily: FONT, outline: 'none', boxSizing: 'border-box', width: '100%' }
const btnStyle = (bg: string, color: string): React.CSSProperties => ({ padding: '8px 16px', background: bg, color, border: bg === 'transparent' || bg === '#fff' ? '1px solid #E5E7EB' : 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, display: 'inline-flex', alignItems: 'center', gap: 6 })
const cardStyle: React.CSSProperties = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, marginBottom: 12 }
const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' }

export default function WorkOrderDetail() {
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
  const [showMenu, setShowMenu] = useState(false)
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [teamAssign, setTeamAssign] = useState<{ team?: string; bay?: string; assigned_tech?: string }>({})
  const [assignModal, setAssignModal] = useState<{ lineId: string; idx: number } | null>(null)
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
  const [partsSubmitted, setPartsSubmitted] = useState(false)
  const [partsSubmitting, setPartsSubmitting] = useState(false)
  const [shopLaborRates, setShopLaborRates] = useState<any[]>([])

  // DATA LOADING
  const loadData = useCallback(async () => {
    if (!id) return
    try {
      const u = await getCurrentUser(supabase)
      setUser(u)

      const [woRes, usersRes, ratesRes] = await Promise.all([
        fetch(`/api/work-orders/${id}`),
        u?.shop_id ? fetch(`/api/users?shop_id=${u.shop_id}`) : Promise.resolve(null),
        u?.shop_id ? fetch(`/api/settings/labor-rates?shop_id=${u.shop_id}`) : Promise.resolve(null),
      ])

      if (!woRes.ok) { setLoading(false); return }
      const woData = await woRes.json()
      setWo(woData)
      setJobAssignments(woData.jobAssignments || [])
      setWoParts(woData.woParts || [])
      setMileage(woData.assets?.odometer?.toString() || '')
      setTeamAssign({ team: woData.team || '', bay: woData.bay || '', assigned_tech: woData.assigned_tech || '' })

      if (usersRes) {
        const usersData = await usersRes.json()
        setAllUsers(usersData)
        setMechanics(usersData.filter((u: any) => ['technician', 'lead_tech', 'maintenance_technician'].includes(u.role)))
      }
      if (ratesRes) {
        try { setShopLaborRates(await ratesRes.json()) } catch {}
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
    if (!user?.id) return
    fetch('/api/wo-activity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wo_id: id, user_id: user.id, action }) }).catch(() => {})
  }

  const openAssignModal = (lineId: string, idx: number) => {
    const existing = jobAssignments.filter((a: any) => a.line_id === lineId).map((a: any) => ({
      user_id: a.user_id,
      name: a.users?.full_name || 'Unknown',
      percentage: a.percentage || 100,
    }))
    setAssignList(existing.length > 0 ? existing : [])
    setAssignModal({ lineId, idx })
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
    await fetch('/api/wo-job-assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line_id: assignModal.lineId, assignments: assignList, wo_id: id, user_id: user?.id }),
    })
    setAssignModal(null)
    await loadData()
  }

  const saveTeamAssign = async () => {
    await fetch(`/api/work-orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...teamAssign, user_id: user?.id }),
    })
    setShowTeamModal(false)
    await loadData()
  }

  const saveHours = async () => {
    if (!hoursModal) return
    await patchLine(hoursModal.id, {
      estimated_hours: parseFloat(hoursModal.estimated_hours) || 0,
      actual_hours: parseFloat(hoursModal.actual_hours) || 0,
      billed_hours: parseFloat(hoursModal.billed_hours) || 0,
    })
    setHoursModal(null)
  }

  const addNote = async () => {
    if (!noteText.trim()) return
    setAddingNote(true)
    await fetch('/api/wo-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wo_id: id, user_id: user?.id, note_text: noteText, visible_to_customer: noteVisible }),
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
      const path = `wo-files/${id}/${Date.now()}-${file.name}`
      const { error } = await supabase.storage.from('uploads').upload(path, file)
      if (error) { console.error('Upload error', error); continue }
      const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path)
      await fetch('/api/wo-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wo_id: id, user_id: user?.id, file_url: urlData.publicUrl, filename: file.name }),
      })
    }
    setUploading(false)
    await loadData()
  }

  const deleteWO = async () => {
    if (deleteText !== 'DELETE') return
    await fetch(`/api/work-orders/${id}?user_id=${user?.id}`, { method: 'DELETE' })
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
      body: JSON.stringify({ action: 'toggle_approval', user_id: user?.id, line_id: lineId, needs_approval: needsApproval }),
    })
    await loadData()
  }

  async function approveJob(lineId: string) {
    await fetch(`/api/work-orders/${id}/approval`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve_job', user_id: user?.id, line_id: lineId, notes: approvalNotes }),
    })
    setApprovalNotes('')
    await loadData()
  }

  async function declineJob(lineId: string) {
    await fetch(`/api/work-orders/${id}/approval`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'decline_job', user_id: user?.id, line_id: lineId, notes: approvalNotes }),
    })
    setApprovalNotes('')
    await loadData()
  }

  async function warrantyDecision(decision: string) {
    await fetch(`/api/work-orders/${id}/approval`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'warranty_decision', user_id: user?.id, decision, notes: warrantyNotes }),
    })
    setWarrantyNotes('')
    await loadData()
  }

  async function searchInventory(lineId: string, query: string) {
    if (!query || query.length < 2 || !wo?.shop_id) { setPartSearchResults(prev => { const n = {...prev}; delete n[lineId]; return n }); return }
    const res = await fetch(`/api/parts/search?shop_id=${wo.shop_id}&q=${encodeURIComponent(query)}`)
    if (res.ok) {
      const results = await res.json()
      setPartSearchResults(prev => ({ ...prev, [lineId]: results }))
    }
  }

  async function autoFillFromInventory(lineId: string, invPart: any) {
    // Calculate sell price based on customer type and shop markup settings
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
    await patchLine(lineId, { real_name: invPart.description, part_number: invPart.part_number, parts_cost_price: costPrice, parts_sell_price: Math.round(sellPrice * 100) / 100, parts_status: 'sourced' })
    setPartSearchResults(prev => { const n = {...prev}; delete n[lineId]; return n })
    await loadData()
  }

  async function submitParts() {
    if (!user) return
    setPartsSubmitting(true)
    const res = await fetch(`/api/work-orders/${id}/parts-submit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, action: 'submit_all' }),
    })
    setPartsSubmitting(false)
    if (res.ok) { setPartsSubmitted(true); await loadData() }
    else { const err = await res.json(); alert(err.error || 'Failed to submit') }
  }

  async function savePartsProgress() {
    if (!user) return
    await fetch(`/api/work-orders/${id}/parts-submit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, action: 'save_progress' }),
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
      body: JSON.stringify({ action, user_id: user?.id, ...extra }),
    })
    setInvoiceLoading(false)
    if (res.ok) { await loadData() }
    else { const err = await res.json(); alert(err.issues ? err.issues.join('\n') : err.error || 'Failed') }
  }

  // Role detection for department views
  const userRole = user?.role || ''
  const isMechanic = ['technician', 'lead_tech', 'maintenance_technician'].includes(userRole)
  const isPartsRole = ['parts_manager'].includes(userRole)
  const isAccounting = ['accountant'].includes(userRole)
  const isWriter = ['owner', 'gm', 'it_person', 'shop_manager', 'service_writer', 'office_admin'].includes(userRole)
  const canSeePrices = !isMechanic
  const canEditPrices = isAccounting || isWriter

  const addJobLine = async () => {
    if (!newJobText.trim()) return
    setAddingJob(true)
    if (useAI) {
      try {
        const res = await fetch('/api/ai/expand-complaint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ complaint: newJobText, asset: wo?.assets }),
        })
        if (res.ok) {
          const data = await res.json()
          const lines = data.lines || [{ description: newJobText }]
          for (const line of lines) {
            await fetch('/api/so-lines', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ so_id: id, line_type: 'labor', description: line.description, estimated_hours: line.estimated_hours || 0, line_status: 'unassigned' }),
            })
          }
        }
      } catch {
        await fetch('/api/so-lines', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ so_id: id, line_type: 'labor', description: newJobText, line_status: 'unassigned' }),
        })
      }
    } else {
      await fetch('/api/so-lines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ so_id: id, line_type: 'labor', description: newJobText, line_status: 'unassigned' }),
      })
    }
    setNewJobText('')
    setUseAI(false)
    setAddingJob(false)
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
      body: JSON.stringify({ wo_id: id, line_id: lineId, part_number: form.pn, description: form.desc, quantity: form.qty || '1', unit_cost: form.cost || '0', user_id: user?.id }),
    })
    setNewPartForms(prev => ({ ...prev, [lineId]: { desc: '', pn: '', qty: '', cost: '' } }))
    await loadData()
  }

  const updatePartStatus = async (partId: string, status: string) => {
    await fetch('/api/wo-parts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: partId, status, wo_id: id, user_id: user?.id }),
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
      body: JSON.stringify({ status, user_id: user?.id }),
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
  const shopCharges = wo.wo_shop_charges || []
  const notes = wo.wo_notes || []
  const files = wo.wo_files || []
  const activity = wo.wo_activity_log || []
  const techMap: Record<string, string> = wo.techMap || {}
  const userMap: Record<string, string> = wo.userMap || {}
  const shop = wo.shop || {}
  const laborRate = shop.labor_rate || shop.default_labor_rate || 125
  const taxRate = shop.tax_rate || 0
  const woStatus = WO_STATUS[wo.status] || { label: wo.status, bg: '#F3F4F6', color: GRAY }
  const vinDisplay = asset.vin ? asset.vin.slice(-6).toUpperCase() : '—'
  const createdByName = wo.createdByName || 'Unknown'

  // Compute totals
  const laborTotal = jobLines.reduce((s: number, l: any) => s + (l.billed_hours || l.actual_hours || l.estimated_hours || 0) * laborRate, 0)
  const partsLineTotal = partLines.reduce((s: number, l: any) => s + (l.total_price || 0), 0)
  const woPartsTotal = woParts.reduce((s: number, p: any) => s + (p.quantity || 1) * (p.unit_cost || 0), 0)
  const chargesTotal = shopCharges.reduce((s: number, c: any) => s + (c.amount || 0), 0)
  const subtotal = laborTotal + partsLineTotal + woPartsTotal + chargesTotal
  const taxAmt = taxRate > 0 ? (woPartsTotal + (shop.tax_labor ? laborTotal : 0)) * (taxRate / 100) : 0
  const grandTotal = subtotal + taxAmt

  const fmt = (n: number) => '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) } catch { return d } }

  // RENDER
  return (
    <div style={{ fontFamily: FONT, color: '#1A1A1A', background: '#fff', minHeight: '100vh', maxWidth: 960, margin: '0 auto', padding: '16px 20px' }}>

      {/* BACK BUTTON */}
      <a href="/work-orders" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#ECEEF2', color: '#1A1A1A', borderRadius: 100, padding: '6px 14px 6px 8px', fontSize: 13, fontWeight: 700, textDecoration: 'none', marginBottom: 16, fontFamily: FONT }}>
        <ChevronLeft size={16} /> Work Orders
      </a>

      {/* HISTORICAL BANNER */}
      {wo.is_historical && (
        <div style={{ background: 'rgba(124,139,160,0.08)', border: '1px solid rgba(124,139,160,0.15)', borderRadius: 8, padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#7C8BA0' }}>
          Historical Record — Imported from {wo.source === 'fullbay' ? 'Fullbay' : wo.source || 'external system'} | WO #{wo.so_number} | {new Date(wo.created_at).toLocaleDateString()}
        </div>
      )}

      {/* HEADER */}
      <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, borderBottom: '2px solid #E5E7EB' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 26, fontWeight: 800 }}>WO-{wo.wo_number || wo.id?.slice(0, 6)}</span>
            <span style={pillStyle(woStatus.bg, woStatus.color)}>{woStatus.label}</span>
            <SourceBadge source={wo.source} />
            {wo.payment_terms === 'cod' && <span style={pillStyle('#FEF2F2', RED)}>COD</span>}
            {wo.invoice_status && wo.invoice_status !== 'draft' && (() => {
              const IS: Record<string, { label: string; bg: string; color: string }> = {
                quality_check_failed: { label: 'QC Failed', bg: '#FEF2F2', color: RED },
                pending_accounting:   { label: 'Pending Accounting', bg: '#FFFBEB', color: AMBER },
                accounting_approved:  { label: 'Acct. Approved', bg: '#F0FDF4', color: GREEN },
                sent_to_customer:     { label: 'Sent to Customer', bg: '#EFF6FF', color: BLUE },
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
        </div>
        <div style={{ textAlign: 'right', minWidth: 200 }}>
          {wo.assets ? (
            <>
              {asset.unit_number && (
                <a href={`/assets/${asset.id}`} style={{ fontSize: 16, fontWeight: 700, color: BLUE, textDecoration: 'none' }}>
                  Unit #{asset.unit_number}
                </a>
              )}
              <div style={{ fontSize: 13, color: '#1A1A1A', marginTop: 2 }}>
                {[asset.year, asset.make, asset.model].filter(Boolean).join(' ')}
              </div>
              <div style={{ fontSize: 13, marginTop: 2 }}>
                VIN: <span style={{ fontWeight: 700 }}>...{vinDisplay}</span>
              </div>
              {mileage && <div style={{ fontSize: 12, color: GRAY, marginTop: 2 }}>{parseInt(mileage).toLocaleString()} mi</div>}
              <div style={{ marginTop: 4 }}><OwnershipTypeBadge type={asset.is_owner_operator ? 'owner_operator' : (wo.ownership_type || asset.ownership_type)} size="lg" /></div>
            </>
          ) : (
            <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>Walk-in / Unit not on file</span>
          )}
        </div>
      </div>

      {/* ESTIMATE REQUIREMENT BANNER */}
      {!wo.is_historical && wo.estimate_required && (
        <div style={{
          padding: '12px 16px', borderRadius: 8, marginBottom: 12, fontSize: 13, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          ...(wo.estimate_approved
            ? { background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)', color: GREEN }
            : wo.estimate_status === 'sent'
            ? { background: 'rgba(29,111,232,0.08)', border: '1px solid rgba(29,111,232,0.2)', color: BLUE }
            : wo.estimate_status === 'declined'
            ? { background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: RED }
            : { background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)', color: AMBER })
        }}>
          <span>
            {wo.estimate_approved
              ? `Estimate approved${wo.approval_method === 'in_person' ? ' in person' : wo.approval_method === 'printed_signed' ? ' (printed and signed)' : wo.approval_method === 'email' ? ' via email' : ''} — work can begin`
            : wo.estimate_status === 'sent' ? 'Estimate sent to customer — awaiting approval'
            : wo.estimate_status === 'declined' ? `Estimate declined${wo.estimate_declined_reason ? ` — ${wo.estimate_declined_reason}` : ''} — follow up required`
            : 'Estimate required — build and send before assigning work'}
          </span>
          {!wo.estimate_approved && <a href="#estimate" onClick={() => setTab(2)} style={{ fontSize: 12, fontWeight: 600, color: BLUE, textDecoration: 'none', marginLeft: 12 }}>Go to Estimate</a>}
        </div>
      )}

      {/* WARRANTY BANNER — 3 scenarios */}
      {!wo.is_historical && (wo.warranty_status === 'not_checked' || wo.warranty_status === 'none' || !wo.warranty_status) && (() => {
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
                  <button onClick={() => warrantyDecision('no_warranty')} style={btnStyle('#F0FDF4', GREEN)}>No Warranty — Proceed</button>
                  <button onClick={() => warrantyDecision('checking')} style={btnStyle('#FFFBEB', AMBER)}>Send for Warranty Check</button>
                  <button onClick={() => warrantyDecision('send_to_dealer')} style={btnStyle('#FEF2F2', RED)}>Send to Dealer</button>
                </div>
              </>
            ) : (
              /* Scenario 1 & 2: No warranty info */
              <>
                <div style={{ color: GRAY, fontSize: 12, marginBottom: 6 }}>
                  {isFleet ? 'No warranty information on file for this unit' : 'Outside customer / Owner operator truck'}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button onClick={() => warrantyDecision('no_warranty')} style={btnStyle('#F0FDF4', GREEN)}>No Warranty — Proceed</button>
                  <button onClick={() => warrantyDecision('checking')} style={btnStyle('#FFFBEB', AMBER)}>Send for Warranty Check</button>
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
      {!wo.is_historical && (wo.ownership_type === 'owner_operator' || wo.assets?.is_owner_operator) && jobLines.some((l: any) => l.approval_status === 'needs_approval') && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '8px 16px', marginBottom: 12, fontSize: 12, color: AMBER, fontWeight: 600 }}>
          Owner Operator truck — customer approval required before work begins
        </div>
      )}

      {/* PROGRESS PIPELINE */}
      {!wo.is_historical && (() => {
        const hasAssign = jobLines.some((l: any) => jobAssignments.some((ja: any) => ja.line_id === l.id))
        const hasDiagnose = jobLines.every((l: any) => l.description?.trim())
        const hasAuthorize = ['authorized', 'in_progress', 'done', 'good_to_go', 'invoiced', 'closed'].includes(wo.status)
        const hasRepair = jobLines.length > 0 && jobLines.every((l: any) => l.line_status === 'completed' || l.status === 'completed')
        const hasInvoice = ['invoiced', 'closed'].includes(wo.status) || wo.invoice_status === 'sent_to_customer'
        const steps = [
          { label: 'Assign', done: hasAssign },
          { label: 'Diagnose', done: hasDiagnose },
          { label: 'Authorize', done: hasAuthorize },
          { label: 'Repair', done: hasRepair },
          { label: 'Invoice', done: hasInvoice },
        ]
        const activeIdx = steps.findIndex(s => !s.done)
        return (
          <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, padding: '12px 20px' }}>
            {steps.map((s, i) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace",
                    background: s.done ? '#16A34A' : i === activeIdx ? BLUE : '#E5E7EB',
                    color: s.done || i === activeIdx ? '#fff' : '#9CA3AF',
                  }}>
                    {s.done ? '\u2713' : i + 1}
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 600, color: s.done ? '#16A34A' : i === activeIdx ? BLUE : '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.04em' }}>{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div style={{ width: 40, height: 2, background: s.done ? '#16A34A' : '#E5E7EB', margin: '0 4px', marginBottom: 16 }} />
                )}
              </div>
            ))}
          </div>
        )
      })()}

      {/* TAB BAR */}
      <div data-no-print style={{ display: 'flex', gap: 0, borderBottom: '1px solid #E5E7EB', marginBottom: 16, overflowX: 'auto' }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            padding: '10px 18px', background: 'transparent', border: 'none', borderBottom: tab === i ? `2px solid ${BLUE}` : '2px solid transparent',
            color: tab === i ? BLUE : GRAY, fontWeight: tab === i ? 700 : 500, fontSize: 13, cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap',
          }}>
            {t}
          </button>
        ))}
      </div>

      {/* QUICK ACTIONS */}
      {!wo.is_historical && (
        <div data-no-print style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {[
            { icon: <Users size={16} />, label: 'Team', onClick: () => {
              if (wo.estimate_required && !wo.estimate_approved) {
                alert('Estimate must be approved before this WO can be assigned. Go to the Estimate tab to build and send the estimate.')
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
              background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, cursor: 'pointer', padding: 0, gap: 2,
            }}>
              {a.icon}
              <span style={{ fontSize: 10, color: GRAY }}>{a.label}</span>
            </button>
          ))}
          <div style={{ width: 1, height: 30, background: '#E5E7EB' }} />
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowMenu(!showMenu)} style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, cursor: 'pointer' }}>
              <MoreHorizontal size={16} />
            </button>
            {showMenu && (
              <div style={{ position: 'absolute', top: 42, left: 0, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, minWidth: 180, padding: 4 }}>
                {Object.entries(WO_STATUS).map(([k, v]) => (
                  <button key={k} onClick={() => updateWoStatus(k)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: wo.status === k ? '#EFF6FF' : 'transparent', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: FONT, color: v.color }}>
                    {v.label}
                  </button>
                ))}
                <div style={{ borderTop: '1px solid #E5E7EB', margin: '4px 0' }} />
                <button onClick={() => { setShowMenu(false); setDeleteConfirm(true) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'transparent', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: FONT, color: RED }}>
                  Void Work Order
                </button>
              </div>
            )}
          </div>
          <div style={{ flex: 1 }} />
          {(!wo.invoice_status || wo.invoice_status === 'draft' || wo.invoice_status === 'quality_check_failed') && (
            <button
              onClick={async () => {
                setQcLoading(true); setQcErrors([]); setShowQcErrors(false)
                try {
                  const res = await fetch(`/api/work-orders/${id}/quality-check`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'check', user_id: user?.id }),
                  })
                  const data = await res.json()
                  if (data.passed) {
                    if (confirm('Quality check passed! Send to accounting for review?')) {
                      const res2 = await fetch(`/api/work-orders/${id}/quality-check`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'send_to_accounting', user_id: user?.id }),
                      })
                      if (res2.ok) await loadData()
                    }
                  } else {
                    setQcErrors(data.errors || ['Unknown error']); setShowQcErrors(true)
                  }
                } catch { setQcErrors(['Failed to run quality check']); setShowQcErrors(true) }
                setQcLoading(false)
              }}
              disabled={qcLoading}
              style={{ ...btnStyle(BLUE, '#fff'), opacity: qcLoading ? 0.5 : 1, whiteSpace: 'nowrap' }}
            >
              {qcLoading ? 'Checking...' : 'Send to Accounting'}
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Mileage</label>
            <input
              value={mileage}
              onChange={e => setMileage(e.target.value)}
              onBlur={() => {
                if (asset.id && mileage !== (asset.odometer?.toString() || '')) {
                  fetch(`/api/work-orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user?.id }) }).catch(() => {})
                }
              }}
              style={{ ...inputStyle, width: 100 }}
              placeholder="0"
            />
          </div>
        </div>
      )}

      {/* QC ERRORS */}
      {showQcErrors && qcErrors.length > 0 && (
        <div style={{ ...cardStyle, background: '#FEF2F2', border: '1px solid #FECACA', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: RED }}>Quality Check Failed</span>
            <button onClick={() => setShowQcErrors(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: RED, fontSize: 16, fontFamily: FONT }}>&times;</button>
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: 12, color: '#991B1B', lineHeight: 1.8 }}>
            {qcErrors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* ========== TAB 0: OVERVIEW ========== */}
      {tab === 0 && (
        <div>
          {jobLines.map((line: any, idx: number) => {
            const st = LINE_STATUS[line.line_status] || LINE_STATUS.unassigned
            const lineAssignments = jobAssignments.filter((a: any) => a.line_id === line.id)
            const isAdditional = line.is_additional
            const lineParts = woParts.filter((p: any) => p.line_id === line.id)

            return (
              <div key={line.id} style={{ ...cardStyle, borderLeft: `3px solid ${isAdditional ? AMBER : st.color}`, position: 'relative' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
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
                  {isAdditional && <span style={pillStyle('#FFFBEB', AMBER)}>ADDITIONAL</span>}
                  {/* Approval badge */}
                  {!wo.is_historical && (() => {
                    const as = line.approval_status || 'pre_approved'
                    const AB: Record<string, { bg: string; color: string; label: string }> = {
                      pre_approved: { bg: '#F0FDF4', color: GREEN, label: 'Pre-Approved' },
                      needs_approval: { bg: '#FFFBEB', color: AMBER, label: 'Needs Approval' },
                      pending: { bg: '#FFFBEB', color: AMBER, label: 'Pending' },
                      approved: { bg: '#F0FDF4', color: GREEN, label: 'Approved' },
                      declined: { bg: '#FEF2F2', color: RED, label: 'Declined' },
                    }
                    const b = AB[as] || AB.pre_approved
                    return <span style={pillStyle(b.bg, b.color)}>{b.label}</span>
                  })()}
                </div>

                {/* Pre-Approval Toggle */}
                {!wo.is_historical && (line.approval_status === 'pre_approved' || line.approval_status === 'needs_approval' || !line.approval_status) && (
                  <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                    <button onClick={() => toggleApproval(line.id, false)} style={{ padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, background: !line.approval_required ? 'rgba(22,163,74,0.1)' : 'transparent', color: !line.approval_required ? GREEN : GRAY, border: !line.approval_required ? `1px solid ${GREEN}40` : '1px solid #E5E7EB' }}>Pre-Approved</button>
                    <button onClick={() => toggleApproval(line.id, true)} style={{ padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, background: line.approval_required ? 'rgba(217,150,11,0.1)' : 'transparent', color: line.approval_required ? AMBER : GRAY, border: line.approval_required ? `1px solid ${AMBER}40` : '1px solid #E5E7EB' }}>Needs Approval</button>
                  </div>
                )}

                {/* Approval actions (when needs approval) */}
                {!wo.is_historical && line.approval_status === 'needs_approval' && (
                  <div style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 11 }}>
                    <div style={{ color: AMBER, fontWeight: 600, marginBottom: 6 }}>Waiting for customer approval</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input value={approvalNotes} onChange={e => setApprovalNotes(e.target.value)} placeholder="Notes..." style={{ ...inputStyle, flex: 1, padding: '4px 8px', fontSize: 11 }} />
                      <button onClick={() => approveJob(line.id)} style={btnStyle('#F0FDF4', GREEN)}>Approve</button>
                      <button onClick={() => declineJob(line.id)} style={btnStyle('#FEF2F2', RED)}>Decline</button>
                    </div>
                  </div>
                )}

                {/* Assignment row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: GRAY }}>ASSIGNED:</span>
                  {lineAssignments.length > 0 ? (
                    lineAssignments.map((a: any) => (
                      <span key={a.id} style={pillStyle('#EFF6FF', BLUE)}>
                        {a.users?.full_name || 'Unknown'} ({a.percentage}%)
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: 12, color: GRAY, fontStyle: 'italic' }}>Unassigned</span>
                  )}
                  {!wo.is_historical && (
                    <button onClick={() => openAssignModal(line.id, idx)} style={{ ...btnStyle('#fff', BLUE), padding: '4px 10px', fontSize: 11 }}>
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
                        <div key={h.label} style={{ background: '#F9FAFB', borderRadius: 8, padding: '8px 12px' }}>
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
                  <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '10px 12px', marginBottom: 6, fontSize: 13, color: '#374151' }}>
                    <span style={{ ...labelStyle, marginBottom: 6 }}>{wo.is_historical ? 'Work Description' : 'Concern'}</span>
                    {line.description}
                  </div>
                )}

                {/* Mechanic Notes */}
                {(() => {
                  const notes: any[] = Array.isArray(line.mechanic_notes) ? line.mechanic_notes : []
                  return (
                    <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '10px 12px', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: notes.length > 0 ? 8 : 0 }}>
                        <MessageSquare size={12} style={{ color: GRAY }} />
                        <span style={{ ...labelStyle, marginBottom: 0 }}>Mechanic Notes</span>
                      </div>
                      {notes.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {notes.map((n: any, ni: number) => (
                            <div key={ni} style={{ fontSize: 12, color: '#374151', padding: '4px 0', borderBottom: ni < notes.length - 1 ? '1px solid #E5E7EB' : 'none' }}>
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
                {!wo.is_historical && line.description && line.description.length >= 10 && (
                  <>
                    {!aiSuggestions[line.id] && aiLoadingLine !== line.id && (
                      <button onClick={() => fetchAiSuggestions(line.id, line.description)} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 12px', marginBottom: 10, background: 'rgba(139,92,246,.06)', border: '1px solid rgba(139,92,246,.15)', borderRadius: 8, color: '#8B5CF6', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>
                        AI: Suggest parts for this job
                      </button>
                    )}
                    {aiLoadingLine === line.id && (
                      <div style={{ padding: '8px 12px', marginBottom: 10, background: 'rgba(139,92,246,.06)', border: '1px solid rgba(139,92,246,.15)', borderRadius: 8, color: '#8B5CF6', fontSize: 11, fontWeight: 600 }}>
                        Analyzing job description...
                      </div>
                    )}
                    {aiSuggestions[line.id] && !showAiPanel && (
                      <button onClick={() => setShowAiPanel(line.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 12px', marginBottom: 10, background: 'rgba(139,92,246,.08)', border: '1px solid rgba(139,92,246,.2)', borderRadius: 8, color: '#8B5CF6', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>
                        AI suggested {aiSuggestions[line.id].length} parts — tap to review
                      </button>
                    )}
                    {showAiPanel === line.id && aiSuggestions[line.id] && (() => {
                      const suggestions = aiSuggestions[line.id]
                      return (
                        <div style={{ background: '#FAFBFE', border: '1px solid rgba(139,92,246,.2)', borderRadius: 10, padding: 14, marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#8B5CF6' }}>AI Suggested Parts</span>
                            <button onClick={() => setShowAiPanel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GRAY, fontSize: 11 }}>Close</button>
                          </div>
                          {suggestions.map((s: any, si: number) => (
                            <label key={si} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: si < suggestions.length - 1 ? '1px solid #F3F4F6' : 'none', cursor: 'pointer' }}>
                              <input type="checkbox" defaultChecked style={{ accentColor: '#8B5CF6' }} data-idx={si} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{s.description}</div>
                                <div style={{ fontSize: 10, color: GRAY }}>Qty: {s.quantity || 1}{s.part_number ? ` · ${s.part_number}` : ''}{s.reason ? ` · ${s.reason}` : ''}</div>
                              </div>
                              <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 3, background: s.confidence === 'very_high' ? '#F0FDF4' : s.confidence === 'high' ? '#EFF6FF' : '#FFFBEB', color: s.confidence === 'very_high' ? GREEN : s.confidence === 'high' ? BLUE : AMBER }}>{s.confidence || 'medium'}</span>
                            </label>
                          ))}
                          <button onClick={() => {
                            const checks = document.querySelectorAll(`input[data-idx]`) as NodeListOf<HTMLInputElement>
                            const selected = suggestions.filter((_: any, i: number) => checks[i]?.checked)
                            if (selected.length) addAiParts(line.id, selected)
                          }} style={{ marginTop: 10, padding: '8px 16px', background: '#8B5CF6', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, width: '100%' }}>
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
                              <li key={i} style={{ fontSize: 13, color: '#374151', marginBottom: 2 }}>{l}</li>
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
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12, borderBottom: '1px solid #F3F4F6' }}>
                        <span style={{ flex: 1 }}>{p.description} {p.part_number ? `(${p.part_number})` : ''}</span>
                        <span>{p.quantity}x</span>
                        <span style={{ fontWeight: 600 }}>{fmt(p.unit_cost || 0)}</span>
                        <select
                          value={p.status || 'needed'}
                          onChange={e => updatePartStatus(p.id, e.target.value)}
                          style={{ padding: '2px 6px', fontSize: 11, borderRadius: 6, border: '1px solid #E5E7EB', fontFamily: FONT }}
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
                {!wo.is_historical && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => {
                      setNewPartForms(prev => ({ ...prev, [line.id]: prev[line.id] || { desc: '', pn: '', qty: '', cost: '' } }))
                    }} style={{ ...btnStyle('#fff', BLUE), padding: '6px 12px', fontSize: 11 }}>
                      <Plus size={12} /> Add Parts
                    </button>
                    <button onClick={() => setHoursModal({ id: line.id, estimated_hours: line.estimated_hours || '', actual_hours: line.actual_hours || '', billed_hours: line.billed_hours || '' })} style={{ ...btnStyle('#fff', GRAY), padding: '6px 12px', fontSize: 11 }}>
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
                    <button onClick={() => addPart(line.id)} style={btnStyle(BLUE, '#fff')}>Add</button>
                    <button onClick={() => setNewPartForms(p => { const n = { ...p }; delete n[line.id]; return n })} style={btnStyle('#fff', GRAY)}>Cancel</button>
                  </div>
                )}
              </div>
            )
          })}

          {/* Add Job Line */}
          {!wo.is_historical && (
            <div style={{ ...cardStyle, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => setUseAI(!useAI)} style={{ ...pillStyle(useAI ? '#EFF6FF' : '#F3F4F6', useAI ? BLUE : GRAY), cursor: 'pointer', border: 'none', fontFamily: FONT }}>
                <Mic size={11} /> AI {useAI ? 'ON' : 'OFF'}
              </button>
              <input
                value={newJobText}
                onChange={e => setNewJobText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addJobLine()}
                placeholder="Describe the job concern..."
                style={{ ...inputStyle, flex: 1, minWidth: 200 }}
              />
              <button onClick={addJobLine} disabled={addingJob || !newJobText.trim()} style={{ ...btnStyle(BLUE, '#fff'), opacity: addingJob || !newJobText.trim() ? 0.5 : 1 }}>
                <Plus size={14} /> {addingJob ? 'Adding...' : 'Add Job Line'}
              </button>
            </div>
          )}

          {/* Add Shop Charge */}
          {!wo.is_historical && (
            <div style={{ ...cardStyle, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: GRAY }}>Shop Charge:</span>
              <input value={newChargeDesc} onChange={e => setNewChargeDesc(e.target.value)} placeholder="Description" style={{ ...inputStyle, flex: 1, minWidth: 150 }} />
              <input value={newChargeAmt} onChange={e => setNewChargeAmt(e.target.value)} placeholder="Amount" type="number" step="0.01" style={{ ...inputStyle, width: 100 }} />
              <button onClick={addShopCharge} disabled={!newChargeDesc.trim() || !newChargeAmt} style={{ ...btnStyle(GREEN, '#fff'), opacity: !newChargeDesc.trim() || !newChargeAmt ? 0.5 : 1 }}>
                <Plus size={14} /> Add Charge
              </button>
            </div>
          )}

          {/* Shop Charges list */}
          {shopCharges.length > 0 && (
            <div style={cardStyle}>
              <span style={{ ...labelStyle, marginBottom: 8 }}>Shop Charges</span>
              {shopCharges.map((c: any) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #F3F4F6', fontSize: 13 }}>
                  <span style={{ flex: 1 }}>{c.description}</span>
                  <span style={{ fontWeight: 700 }}>{fmt(c.amount)}</span>
                  <button onClick={() => removeCharge(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: RED }}><X size={14} /></button>
                </div>
              ))}
            </div>
          )}

          {/* Get Approval */}
          {!wo.is_historical && (
            <div style={{ textAlign: 'right', marginTop: 8 }}>
              <button onClick={() => setApprovalModal(true)} style={btnStyle(GREEN, '#fff')}>
                <DollarSign size={14} /> Get Approval
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========== TAB 1: PARTS & MATERIALS ========== */}
      {tab === 1 && (
        <div>
          {/* Rough → Real Parts Flow (from so_lines) */}
          {partLines.length > 0 && (
            <div style={cardStyle}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Parts ({partLines.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {partLines.map((p: any) => {
                  const isRough = !p.real_name
                  const statusColors: Record<string, { label: string; bg: string; color: string }> = {
                    rough: { label: 'Rough', bg: '#F3F4F6', color: GRAY },
                    sourced: { label: 'Sourced', bg: '#EFF6FF', color: BLUE },
                    ordered: { label: 'Ordered', bg: '#FFFBEB', color: AMBER },
                    received: { label: 'Received', bg: '#F0FDF4', color: GREEN },
                    installed: { label: 'Installed', bg: '#ECFDF5', color: '#059669' },
                  }
                  const st = statusColors[p.parts_status || 'rough'] || statusColors.rough
                  return (
                    <div key={p.id} style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: 12, background: isRough ? '#FAFBFC' : '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div>
                          {isRough ? (
                            <span style={{ fontSize: 12, color: GRAY }}>Suggested: <strong style={{ color: '#374151' }}>{p.rough_name || p.description}</strong></span>
                          ) : (
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>{p.real_name}{p.part_number ? ` (${p.part_number})` : ''}</span>
                          )}
                        </div>
                        {!wo.is_historical && (
                          <select value={p.parts_status || 'rough'} onChange={async e => { await patchLine(p.id, { parts_status: e.target.value }); await loadData() }}
                            style={{ ...pillStyle(st.bg, st.color), border: 'none', fontFamily: FONT, cursor: 'pointer', padding: '3px 10px', fontSize: 10 }}>
                            {Object.entries(statusColors).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                          </select>
                        )}
                        {wo.is_historical && <span style={pillStyle(st.bg, st.color)}>{st.label}</span>}
                      </div>

                      {/* Editable fields for parts dept (rough state) */}
                      {isRough && !wo.is_historical && !isMechanic && (
                        <div style={{ position: 'relative' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 8, marginTop: 6 }}>
                            <div style={{ position: 'relative' }}>
                              <span style={labelStyle}>Real Name</span>
                              <input defaultValue={p.real_name || ''} onChange={e => searchInventory(p.id, e.target.value)} onBlur={e => { if (e.target.value) { patchLine(p.id, { real_name: e.target.value }); setTimeout(() => setPartSearchResults(prev => { const n = {...prev}; delete n[p.id]; return n }), 200) } }} placeholder="Type to search inventory..." style={inputStyle} />
                              {/* Inventory search dropdown */}
                              {partSearchResults[p.id]?.length > 0 && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, marginTop: 2, zIndex: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 160, overflowY: 'auto' }}>
                                  {partSearchResults[p.id].map((inv: any) => (
                                    <div key={inv.id} onMouseDown={() => autoFillFromInventory(p.id, inv)} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #F3F4F6', fontSize: 12 }}
                                      onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                                      <div style={{ fontWeight: 600, color: '#1A1A1A' }}>{inv.description}</div>
                                      <div style={{ fontSize: 10, color: GRAY }}>{inv.part_number || '—'} · Cost: {fmt(inv.cost_price || 0)} · Sell: {fmt(inv.sell_price || 0)} · {inv.on_hand || 0} in stock</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div>
                              <span style={labelStyle}>Part #</span>
                              <input defaultValue={p.part_number || ''} onChange={e => searchInventory(p.id, e.target.value)} onBlur={e => { patchLine(p.id, { part_number: e.target.value }); setTimeout(() => setPartSearchResults(prev => { const n = {...prev}; delete n[p.id]; return n }), 200) }} placeholder="PN" style={inputStyle} />
                            </div>
                            <div>
                              <span style={labelStyle}>Qty</span>
                              <input type="number" defaultValue={p.quantity || 1} onBlur={e => patchLine(p.id, { quantity: parseInt(e.target.value) || 1 })} style={inputStyle} />
                            </div>
                            <div>
                              <span style={labelStyle}>Cost</span>
                              <input type="number" step="0.01" defaultValue={p.parts_cost_price || ''} onBlur={e => patchLine(p.id, { parts_cost_price: parseFloat(e.target.value) || 0 })} placeholder="0.00" style={inputStyle} />
                            </div>
                            <div>
                              <span style={labelStyle}>Sell</span>
                              <input type="number" step="0.01" defaultValue={p.parts_sell_price || ''} onBlur={e => patchLine(p.id, { parts_sell_price: parseFloat(e.target.value) || 0, total_price: parseFloat(e.target.value) * (p.quantity || 1) })} placeholder="0.00" style={inputStyle} />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Read-only display for sourced parts */}
                      {!isRough && !wo.is_historical && (
                        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: GRAY, marginTop: 4 }}>
                          {p.part_number && <span>Part #: {p.part_number}</span>}
                          <span>Qty: {p.quantity || 1}</span>
                          {canSeePrices && p.parts_sell_price && <span>Sell: {fmt(p.parts_sell_price)}</span>}
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
          {!wo.is_historical && (
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
                }} style={btnStyle(BLUE, '#fff')}>
                  Request
                </button>
              </div>
            </div>
          )}

          {/* Parts Submit / Save buttons */}
          {!wo.is_historical && partLines.length > 0 && !isMechanic && (() => {
            const allFilled = partLines.every((p: any) => p.real_name || !p.rough_name)
            const someFilled = partLines.some((p: any) => p.real_name)
            const filledCount = partLines.filter((p: any) => p.real_name).length
            const roughCount = partLines.filter((p: any) => p.rough_name && !p.real_name).length
            const allReceived = partLines.every((p: any) => p.parts_status === 'received' || p.parts_status === 'installed')

            if (partsSubmitted || allReceived) {
              return <div style={{ ...cardStyle, marginTop: 12, textAlign: 'center', color: GREEN, fontSize: 13, fontWeight: 700, padding: 14, background: 'rgba(22,163,74,0.04)', border: '1px solid rgba(22,163,74,0.15)' }}>Parts Submitted — Mechanic Notified</div>
            }

            return (
              <div style={{ ...cardStyle, marginTop: 12 }}>
                {roughCount > 0 && <div style={{ fontSize: 12, color: AMBER, marginBottom: 8 }}>{filledCount} of {partLines.length} parts complete — fill remaining to submit</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  {someFilled && <button onClick={savePartsProgress} style={{ ...btnStyle('#fff', BLUE), border: `1px solid ${BLUE}`, flex: 1, justifyContent: 'center' }}>Save Progress</button>}
                  <button onClick={submitParts} disabled={!allFilled || partsSubmitting} style={{ ...btnStyle(allFilled ? '#1D6FE8' : '#E5E7EB', allFilled ? '#fff' : GRAY), flex: 2, justifyContent: 'center', opacity: allFilled ? 1 : 0.5 }}>
                    {partsSubmitting ? 'Submitting...' : 'Submit All Parts'}
                  </button>
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
                  <div key={p.id} style={{ display: 'flex', gap: 8, padding: '4px 0', borderBottom: '1px solid #F3F4F6' }}>
                    <span style={{ flex: 1 }}>{p.description}{p.part_number ? ` (${p.part_number})` : ''}</span>
                    <span>Qty: {p.quantity}</span>
                    {canSeePrices && <span>{fmt(p.unit_cost || 0)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========== TAB 2: ESTIMATE & BILLING ========== */}
      {tab === 2 && (
        <div>
          {/* Estimate requirement notice */}
          {!wo.estimate_required && !wo.is_historical && (
            <div style={{ ...cardStyle, background: '#F0FDF4', border: '1px solid #BBF7D0', marginBottom: 12, fontSize: 13, color: '#15803D', fontWeight: 600 }}>
              Estimate not required for company trucks. You can still create one manually if needed.
            </div>
          )}

          {/* Summary cards */}
          {(() => {
            const partsAmt = woPartsTotal + partsLineTotal + (wo.is_historical && partLines.length === 0 ? (wo.parts_total || 0) : 0)
            const otherCharges = wo.tax_total || 0
            const taxLabel = otherCharges > laborTotal ? 'Sublet / Other' : 'Tax'
            const displayTotal = wo.is_historical && wo.grand_total ? wo.grand_total : grandTotal
            const items = [
              laborTotal > 0 ? { label: 'Labor', value: fmt(laborTotal), color: BLUE } : null,
              partsAmt > 0 ? { label: 'Parts', value: fmt(partsAmt), color: AMBER } : null,
              chargesTotal > 0 ? { label: 'Charges', value: fmt(chargesTotal), color: GRAY } : null,
              otherCharges > 0 ? { label: taxLabel, value: fmt(otherCharges), color: GRAY } : null,
              { label: 'Total', value: fmt(displayTotal), color: GREEN },
            ].filter(Boolean) as { label: string; value: string; color: string }[]
            return (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 12, marginBottom: 16 }}>
                {items.map(s => (
                  <div key={s.label} style={{ background: '#F9FAFB', borderRadius: 10, padding: 14, textAlign: 'center' }}>
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
                <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
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
                    <tr key={line.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '6px 8px' }}>Job {idx + 1}: {line.description?.slice(0, 40)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>{line.estimated_hours || 0}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>{line.actual_hours || 0}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>{line.billed_hours || 0}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(laborRate)}/hr</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{fmt(hrs * laborRate)}</td>
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

          {/* Shop Charges */}
          {shopCharges.length > 0 && (
            <div style={cardStyle}>
              <span style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: 'block' }}>Shop Charges</span>
              {shopCharges.map((c: any) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #F3F4F6', fontSize: 13 }}>
                  <span style={{ flex: 1 }}>{c.description}</span>
                  <span>{c.taxable ? '(Taxable)' : ''}</span>
                  <span style={{ fontWeight: 700 }}>{fmt(c.amount)}</span>
                  <button onClick={() => removeCharge(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: RED }}><X size={14} /></button>
                </div>
              ))}
            </div>
          )}

          {/* Historical parts summary */}
          {wo.is_historical && partLines.length === 0 && wo.parts_total > 0 && (
            <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', fontSize: 13, background: '#FAFBFC' }}>
              <span style={{ color: GRAY }}>Parts (imported summary)</span>
              <span style={{ fontWeight: 700 }}>{fmt(wo.parts_total)}</span>
            </div>
          )}

          {/* Sublet / Other or Tax */}
          {(() => {
            const otherAmt = wo.tax_total || 0
            if (otherAmt <= 0 && taxAmt <= 0) return null
            if (wo.is_historical && otherAmt > 0) {
              const label = otherAmt > laborTotal ? 'Sublet / Other' : 'Tax'
              return (
                <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>{label}</span>
                  <span style={{ fontWeight: 700 }}>{fmt(otherAmt)}</span>
                </div>
              )
            }
            if (taxRate > 0 && taxAmt > 0) {
              return (
                <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>Tax ({taxRate}%{shop.tax_labor ? ' incl. labor' : ' parts only'})</span>
                  <span style={{ fontWeight: 700 }}>{fmt(taxAmt)}</span>
                </div>
              )
            }
            return null
          })()}

          {/* Grand Total */}
          <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', background: '#F0FDF4', border: `1px solid ${GREEN}` }}>
            <span style={{ fontSize: 16, fontWeight: 800 }}>Total</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: GREEN }}>{fmt(wo.is_historical && wo.grand_total ? wo.grand_total : grandTotal)}</span>
          </div>

          {/* Signature area */}
          <div style={cardStyle}>
            <span style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: 'block' }}>Authorization</span>
            <div style={{ background: '#F9FAFB', borderRadius: 8, padding: 20, textAlign: 'center', border: '1px dashed #D1D5DB', minHeight: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: GRAY, fontSize: 13 }}>
              Customer signature area (canvas placeholder)
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: GRAY }}>
              Authorized by: {customer.contact_name || customer.company_name || '—'} | {customer.email || '—'}
            </div>
          </div>
        </div>
      )}

      {/* ========== TAB 3: FILES & NOTES ========== */}
      {tab === 3 && (
        <div>
          {/* Note input */}
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
              style={{ ...inputStyle, minHeight: 70, resize: 'vertical', marginBottom: 8, paddingRight: 48, background: '#fff', color: '#111', border: '1px solid #E5E7EB' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={noteVisible} onChange={e => setNoteVisible(e.target.checked)} />
                Visible to customer
              </label>
              <div style={{ flex: 1 }} />
              <button onClick={addNote} disabled={addingNote || !noteText.trim()} style={{ ...btnStyle(BLUE, '#fff'), opacity: addingNote || !noteText.trim() ? 0.5 : 1 }}>
                {addingNote ? 'Saving...' : 'Add Note'}
              </button>
            </div>
          </div>

          {/* Notes list */}
          {notes.length > 0 && (
            <div style={cardStyle}>
              <span style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: 'block' }}>Notes ({notes.length})</span>
              {notes.map((n: any) => (
                <div key={n.id} style={{ padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{userMap[n.user_id] || 'System'}</span>
                    <span style={{ fontSize: 11, color: GRAY }}>{fmtDate(n.created_at)}</span>
                    {n.visible_to_customer && <span style={pillStyle('#EFF6FF', BLUE)}>Customer Visible</span>}
                  </div>
                  <div style={{ fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap' }}>{n.note_text}</div>
                </div>
              ))}
            </div>
          )}

          {/* File upload */}
          <div style={cardStyle}>
            <span style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: 'block' }}>Files</span>
            <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={e => uploadFiles(e.target.files)} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} style={btnStyle('#fff', BLUE)}>
              <Upload size={14} /> {uploading ? 'Uploading...' : 'Upload Files'}
            </button>
          </div>

          {/* Files list */}
          {files.length > 0 && (
            <div style={cardStyle}>
              <span style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: 'block' }}>Uploaded Files ({files.length})</span>
              {files.map((f: any) => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
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
            <div key={a.id} style={{ display: 'flex', gap: 12, paddingBottom: 14, marginBottom: 14, borderLeft: i < activity.length - 1 ? `2px solid #E5E7EB` : '2px solid transparent', paddingLeft: 16, position: 'relative' }}>
              <div style={{ position: 'absolute', left: -5, top: 2, width: 8, height: 8, borderRadius: '50%', background: BLUE }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: '#1A1A1A' }}>{a.action}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: GRAY }}>{userMap[a.user_id] || a.users?.full_name || 'System'}</span>
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>{fmtDate(a.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========== INVOICE WORKFLOW ========== */}
      {!wo.is_historical && (
        <div style={{ ...cardStyle, marginTop: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Invoice Workflow</div>

          {/* Invoice status stepper */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 16, padding: '8px 0' }}>
            {['draft', 'accounting_review', 'sent', 'paid', 'closed'].map((stage, i, arr) => {
              const labels: Record<string, string> = { draft: 'Draft', accounting_review: 'Accounting', sent: 'Sent', paid: 'Paid', closed: 'Closed' }
              const currentIdx = arr.indexOf(wo.invoice_status || 'draft')
              const isDone = i < currentIdx
              const isCurrent = i === currentIdx
              return (
                <div key={stage} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace",
                      background: isDone ? GREEN : isCurrent ? BLUE : '#E5E7EB',
                      color: isDone || isCurrent ? '#fff' : '#9CA3AF',
                    }}>
                      {isDone ? '\u2713' : i + 1}
                    </div>
                    <span style={{ fontSize: 8, fontWeight: 600, color: isDone ? GREEN : isCurrent ? BLUE : '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.03em', whiteSpace: 'nowrap' }}>{labels[stage]}</span>
                  </div>
                  {i < arr.length - 1 && <div style={{ width: 24, height: 2, background: isDone ? GREEN : '#E5E7EB', margin: '0 2px', marginBottom: 14 }} />}
                </div>
              )
            })}
          </div>

          {/* Stage-specific actions */}
          {wo.invoice_status === 'draft' && (
            <div>
              <button onClick={checkInvoiceReadiness} disabled={invoiceLoading} style={btnStyle(BLUE, '#fff')}>
                {invoiceLoading ? 'Checking...' : 'Check Readiness'}
              </button>
              {invoiceChecks.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  {invoiceChecks.map((c: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12 }}>
                      <span style={{ color: c.passed ? GREEN : RED, fontWeight: 700 }}>{c.passed ? '\u2713' : '\u2717'}</span>
                      <span style={{ color: c.passed ? '#374151' : RED }}>{c.label}</span>
                      <span style={{ color: GRAY, fontSize: 11 }}>({c.detail})</span>
                    </div>
                  ))}
                  {invoiceChecks.every((c: any) => c.passed) && (
                    <button onClick={() => invoiceAction('submit_to_accounting')} disabled={invoiceLoading} style={{ ...btnStyle(GREEN, '#fff'), marginTop: 8 }}>
                      Submit to Accounting
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {wo.invoice_status === 'accounting_review' && canEditPrices && (
            <button onClick={() => invoiceAction('approve_invoicing')} disabled={invoiceLoading} style={btnStyle(BLUE, '#fff')}>Approve & Send Invoice</button>
          )}

          {wo.invoice_status === 'sent' && canEditPrices && (
            <button onClick={() => invoiceAction('mark_paid')} disabled={invoiceLoading} style={btnStyle(GREEN, '#fff')}>Mark as Paid</button>
          )}

          {wo.invoice_status === 'paid' && (
            <button onClick={() => invoiceAction('close_wo')} disabled={invoiceLoading} style={btnStyle(GRAY, '#fff')}>Close Work Order</button>
          )}

          {wo.invoice_status === 'closed' && (
            <div style={{ textAlign: 'center', color: GRAY, fontSize: 13, padding: 8 }}>Work order closed{wo.closed_at ? ` on ${new Date(wo.closed_at).toLocaleDateString()}` : ''}</div>
          )}
        </div>
      )}

      {/* Mechanic role — hide prices indicator */}
      {isMechanic && !wo.is_historical && (
        <div style={{ ...cardStyle, marginTop: 12, background: '#F9FAFB', textAlign: 'center', color: GRAY, fontSize: 12, padding: 12 }}>
          Pricing information is managed by the service department
        </div>
      )}

      {/* ========== MODALS ========== */}

      {/* Team Modal */}
      {showTeamModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowTeamModal(false)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 400, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
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
              <button onClick={() => setShowTeamModal(false)} style={btnStyle('#fff', GRAY)}>Cancel</button>
              <button onClick={saveTeamAssign} style={btnStyle(BLUE, '#fff')}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {assignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setAssignModal(null)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 480, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Assign Mechanics — Job {assignModal.idx + 1}</span>
              <button onClick={() => setAssignModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            {/* Add mechanic dropdown */}
            <div style={{ marginBottom: 12 }}>
              <span style={labelStyle}>Add Mechanic</span>
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
                  <div key={a.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
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
              <button onClick={() => setAssignModal(null)} style={btnStyle('#fff', GRAY)}>Cancel</button>
              <button onClick={saveAssignments} style={btnStyle(BLUE, '#fff')}>Save Assignments</button>
            </div>
          </div>
        </div>
      )}

      {/* Hours Modal */}
      {hoursModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setHoursModal(null)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 360, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
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
              <button onClick={() => setHoursModal(null)} style={btnStyle('#fff', GRAY)}>Cancel</button>
              <button onClick={saveHours} style={btnStyle(BLUE, '#fff')}>Save Hours</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setDeleteConfirm(false)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 380, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
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
              <button onClick={() => { setDeleteConfirm(false); setDeleteText('') }} style={btnStyle('#fff', GRAY)}>Cancel</button>
              <button onClick={deleteWO} disabled={deleteText !== 'DELETE'} style={{ ...btnStyle(RED, '#fff'), opacity: deleteText !== 'DELETE' ? 0.5 : 1 }}>Void</button>
            </div>
          </div>
        </div>
      )}

      {/* Estimate Approval Modal — 3 paths */}
      {approvalModal && (() => {
        const hasContact = !!(customer?.email || customer?.phone)
        const estimateId = wo.estimates?.[0]?.id || wo.estimate_id

        async function approveEstimate(method: 'email' | 'in_person' | 'printed_signed') {
          if (estimateId) {
            await fetch(`/api/estimates/${estimateId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'approved', approval_method: method, approved_by: user?.id, approved_at: new Date().toISOString() }),
            })
          }
          await fetch(`/api/work-orders/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estimate_approved: true, estimate_status: 'approved' }),
          })
          const methodLabel = method === 'email' ? 'via email' : method === 'in_person' ? 'in person' : '(printed and signed)'
          logActivity(`Estimate approved ${methodLabel} by ${user?.full_name || 'service writer'}`)
          try {
            const { createNotification, getUserIdsByRole } = await import('@/lib/createNotification')
            const mgrs = await getUserIdsByRole(wo.shop_id, ['owner', 'gm', 'shop_manager', 'floor_manager'])
            if (mgrs.length > 0) await createNotification({ shopId: wo.shop_id, recipientId: mgrs, type: 'estimate_approved', title: `Estimate approved — WO #${wo.so_number}`, body: `Ready to assign. Total: ${fmt(grandTotal)}`, link: `/work-orders/${id}`, relatedWoId: id })
          } catch {}
          setApprovalModal(false)
          await loadData()
        }

        async function sendEstimateEmail() {
          if (!estimateId) { alert('Build an estimate first'); return }
          const res = await fetch(`/api/estimates/${estimateId}/send`, { method: 'POST' })
          if (res.ok) {
            logActivity(`Estimate sent to ${customer.email || customer.phone}`)
            alert('Estimate sent to customer')
          } else {
            alert('Failed to send estimate')
          }
          setApprovalModal(false)
          await loadData()
        }

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setApprovalModal(false)}>
            <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 480, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>Get Estimate Approval</span>
                <button onClick={() => setApprovalModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <div style={{ fontSize: 13, marginBottom: 16, padding: '10px 14px', background: '#F9FAFB', borderRadius: 8 }}>
                <div style={{ marginBottom: 4 }}>Estimate total: <strong style={{ color: GREEN }}>{fmt(grandTotal)}</strong></div>
                <div>Customer: <strong>{customer?.contact_name || customer?.company_name || '—'}</strong></div>
              </div>

              {/* Path 1: Send to Customer */}
              <div style={{ marginBottom: 12, padding: '12px 14px', border: '1px solid #E5E7EB', borderRadius: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Send to Customer</div>
                {hasContact ? (
                  <button onClick={sendEstimateEmail} style={{ ...btnStyle(BLUE, '#fff'), width: '100%', justifyContent: 'center' }}>
                    Send via {customer?.email ? 'Email' : 'SMS'}
                  </button>
                ) : (
                  <div>
                    <div style={{ padding: '8px 10px', background: '#FFFBEB', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 6, fontSize: 12, color: '#D97706', marginBottom: 8 }}>
                      No email or phone on file — add contact info or approve in person
                    </div>
                  </div>
                )}
              </div>

              {/* Path 2: Approved In Person */}
              <div style={{ marginBottom: 12, padding: '12px 14px', border: '1px solid #E5E7EB', borderRadius: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Approved In Person</div>
                <div style={{ fontSize: 12, color: GRAY, marginBottom: 8 }}>Customer has reviewed and verbally approved this estimate</div>
                <button onClick={() => { if (confirm('Confirm: Customer approved this estimate in person?')) approveEstimate('in_person') }} style={{ ...btnStyle('#fff', BLUE), width: '100%', justifyContent: 'center', border: `1px solid ${BLUE}` }}>
                  Confirm In-Person Approval
                </button>
              </div>

              {/* Path 3: Print & Sign */}
              <div style={{ padding: '12px 14px', border: '1px solid #E5E7EB', borderRadius: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Print and Sign</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {estimateId && (
                    <a href={`/api/estimates/${estimateId}/pdf`} target="_blank" style={{ ...btnStyle('#fff', GRAY), flex: 1, justifyContent: 'center', textDecoration: 'none', textAlign: 'center', border: '1px solid #D1D5DB' }}>
                      Print Estimate
                    </a>
                  )}
                  <button onClick={() => { if (confirm('Confirm: Customer has signed the printed estimate?')) approveEstimate('printed_signed') }} style={{ ...btnStyle('#fff', BLUE), flex: 1, justifyContent: 'center', border: `1px solid ${BLUE}` }}>
                    Mark Signed
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ADDITIONAL INFO (external_data) */}
      {wo.external_data && typeof wo.external_data === 'object' && Object.keys(wo.external_data).length > 0 && (
        <div style={{ ...cardStyle, marginTop: 12 }}>
          <button
            onClick={() => setShowExternalData(!showExternalData)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}
          >
            <span style={{ transform: showExternalData ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', display: 'inline-block' }}>&#9654;</span>
            Additional Info
          </button>
          {showExternalData && (
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {Object.entries(wo.external_data).map(([key, val]) => (
                <div key={key} style={{ fontSize: 12 }}>
                  <span style={{ color: GRAY, fontWeight: 600 }}>{key.replace(/_/g, ' ')}: </span>
                  <span style={{ color: '#374151' }}>{val != null ? String(val) : '\u2014'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FOOTER */}
      <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 11, color: '#9CA3AF', borderTop: '1px solid #F3F4F6', marginTop: 24 }}>
        {shop.name || shop.dba || 'TruckZen'} {shop.phone ? ` | ${shop.phone}` : ''} {shop.email ? ` | ${shop.email}` : ''}
      </div>
    </div>
  )
}
