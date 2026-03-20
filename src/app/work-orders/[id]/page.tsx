'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser, type UserProfile } from '@/lib/auth'
import Logo from '@/components/Logo'
import { ChevronLeft, Users, MessageSquare, Paperclip, Clock, DollarSign, MoreHorizontal, Plus, Mic, Upload, X } from 'lucide-react'

const FONT = "'Inter', -apple-system, sans-serif"
const BLUE = '#1D6FE8'
const GREEN = '#16A34A'
const RED = '#DC2626'
const AMBER = '#D97706'
const GRAY = '#6B7280'

const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  unassigned:     { label: 'Unassigned',     bg: '#FEF2F2', color: '#DC2626' },
  approved:       { label: 'Approved',       bg: '#F0FDF4', color: '#16A34A' },
  pending_review: { label: 'Pending Review', bg: '#FFFBEB', color: '#D97706' },
  in_progress:    { label: 'In Progress',    bg: '#EFF6FF', color: '#1D6FE8' },
  completed:      { label: 'Completed',      bg: '#F0FDF4', color: '#15803D' },
}

const WO_STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  open:        { label: 'Open',        bg: '#EFF6FF', color: '#1D6FE8' },
  in_progress: { label: 'In Progress', bg: '#EFF6FF', color: '#1D6FE8' },
  completed:   { label: 'Completed',   bg: '#F0FDF4', color: '#16A34A' },
  invoiced:    { label: 'Invoiced',    bg: '#ECFDF5', color: '#059669' },
  closed:      { label: 'Closed',      bg: '#F3F4F6', color: '#6B7280' },
}

const PART_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  needed:    { label: 'Needed',    bg: '#FEF2F2', color: '#DC2626' },
  ordered:   { label: 'Ordered',   bg: '#FFFBEB', color: '#D97706' },
  received:  { label: 'Received',  bg: '#EFF6FF', color: '#1D6FE8' },
  installed: { label: 'Installed', bg: '#F0FDF4', color: '#16A34A' },
}

const TABS = ['Overview', 'Parts & Materials', 'Estimate & Billing', 'Files & Notes', 'Activity']

export default function WorkOrderDetailPage() {
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

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
  const [teamAssign, setTeamAssign] = useState({ writer: '', tech: '', parts: '' })
  const [assignModal, setAssignModal] = useState<{ lineId: string; idx: number } | null>(null)
  const [assignList, setAssignList] = useState<{ user_id: string; name: string; percentage: number }[]>([])
  const [hoursModal, setHoursModal] = useState<any>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [noteText, setNoteText] = useState('')
  const [noteVisible, setNoteVisible] = useState(false)
  const [addingNote, setAddingNote] = useState(false)
  const [mileage, setMileage] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [newJobText, setNewJobText] = useState('')
  const [useAI, setUseAI] = useState(true)
  const [addingJob, setAddingJob] = useState(false)

  /* ── Data Loading ── */
  const loadData = useCallback(async () => {
    const profile = await getCurrentUser(supabase)
    if (!profile) { window.location.href = '/login'; return }
    setUser(profile)
    const [woRes, usersRes] = await Promise.all([
      fetch(`/api/work-orders/${id}`),
      fetch(`/api/users?shop_id=${profile.shop_id}`),
    ])
    if (woRes.ok) {
      const d = await woRes.json()
      setWo(d)
      setJobAssignments(d.jobAssignments || [])
      setWoParts(d.woParts || [])
      setTeamAssign({ writer: d.service_writer_id || '', tech: d.assigned_tech || '', parts: d.parts_person_id || '' })
      if (d.assets?.odometer) setMileage(String(d.assets.odometer))
    }
    if (usersRes.ok) {
      const users = await usersRes.json()
      setAllUsers(users)
      setMechanics(users.filter((u: any) => ['technician', 'maintenance_technician'].includes(u.role)))
    }
    setLoading(false)
  }, [id, supabase])

  useEffect(() => { loadData() }, [loadData])

  /* ── Helpers ── */
  const patchLine = async (lineId: string, data: any) => {
    await fetch(`/api/so-lines/${lineId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    if (wo && user) {
      await fetch('/api/wo-activity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wo_id: id, user_id: user.id, action: `Updated job line` }) })
    }
  }

  const logActivity = async (action: string) => {
    if (!wo || !user) return
    await fetch('/api/wo-activity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wo_id: id, user_id: user.id, action }) })
  }

  const openAssignModal = (lineId: string, idx: number) => {
    const existing = jobAssignments.filter((ja: any) => ja.line_id === lineId).map((ja: any) => ({
      user_id: ja.user_id,
      name: ja.users?.full_name || 'Unknown',
      percentage: ja.percentage || 100,
    }))
    setAssignList(existing.length > 0 ? existing : [])
    setAssignModal({ lineId, idx })
  }

  const addMechToList = (mechId: string) => {
    if (!mechId || assignList.find(a => a.user_id === mechId)) return
    const mech = mechanics.find(m => m.id === mechId)
    if (!mech) return
    const next = [...assignList, { user_id: mechId, name: mech.full_name, percentage: 0 }]
    const even = Math.floor(100 / next.length)
    const remainder = 100 - even * next.length
    setAssignList(next.map((a, i) => ({ ...a, percentage: even + (i === 0 ? remainder : 0) })))
  }

  const removeMechFromList = (idx: number) => {
    const next = assignList.filter((_, i) => i !== idx)
    if (next.length === 0) { setAssignList([]); return }
    const even = Math.floor(100 / next.length)
    const remainder = 100 - even * next.length
    setAssignList(next.map((a, i) => ({ ...a, percentage: even + (i === 0 ? remainder : 0) })))
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
      body: JSON.stringify({ service_writer_id: teamAssign.writer || null, assigned_tech: teamAssign.tech || null, parts_person_id: teamAssign.parts || null, user_id: user?.id }),
    })
    setShowTeamModal(false)
    await loadData()
  }

  const saveHours = async () => {
    if (!hoursModal) return
    await patchLine(hoursModal.lineId, {
      estimated_hours: parseFloat(hoursModal.estimated) || 0,
      actual_hours: parseFloat(hoursModal.actual) || 0,
      billed_hours: parseFloat(hoursModal.billed) || 0,
      labor_rate: parseFloat(hoursModal.rate) || 0,
    })
    setHoursModal(null)
    await loadData()
  }

  const addNote = async () => {
    if (!noteText.trim()) return
    setAddingNote(true)
    await fetch('/api/wo-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wo_id: id, user_id: user?.id, note_text: noteText.trim(), visible_to_customer: noteVisible }),
    })
    setNoteText('')
    setNoteVisible(false)
    setAddingNote(false)
    await loadData()
  }

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      const path = `wo/${id}/${Date.now()}_${f.name}`
      const { error } = await supabase.storage.from('wo-files').upload(path, f)
      if (!error) {
        const { data: urlData } = supabase.storage.from('wo-files').getPublicUrl(path)
        await fetch('/api/wo-files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wo_id: id, user_id: user?.id, file_url: urlData.publicUrl, filename: f.name }),
        })
      }
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
    await loadData()
  }

  const deleteWO = async () => {
    if (deleteText.toUpperCase() !== 'DELETE') return
    await fetch(`/api/work-orders/${id}`, { method: 'DELETE' })
    window.location.href = '/work-orders'
  }

  const addJobLine = async () => {
    if (!newJobText.trim()) return
    setAddingJob(true)
    if (useAI) {
      const aiRes = await fetch('/api/ai/action-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ complaint: newJobText.trim() }),
      })
      if (aiRes.ok) {
        const { action_items } = await aiRes.json()
        for (const item of action_items) {
          await fetch('/api/so-lines', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ so_id: id, line_type: 'labor', description: item, line_status: 'unassigned' }),
          })
        }
      }
    } else {
      await fetch('/api/so-lines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ so_id: id, line_type: 'labor', description: newJobText.trim().toUpperCase(), line_status: 'unassigned' }),
      })
    }
    await logActivity(`Added job line: ${newJobText.trim()}`)
    setNewJobText('')
    setAddingJob(false)
    await loadData()
  }

  const addShopCharge = async () => {
    const desc = prompt('Shop charge description:')
    if (!desc) return
    const amt = prompt('Amount ($):')
    if (!amt) return
    await fetch('/api/wo-charges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wo_id: id, description: desc.trim(), amount: parseFloat(amt) || 0, taxable: false }),
    })
    await logActivity(`Added shop charge: ${desc.trim()}`)
    await loadData()
  }

  const addPart = async (lineId: string, partData: { part_number: string; description: string; quantity: number; unit_cost: number }) => {
    await fetch('/api/wo-parts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wo_id: id, line_id: lineId, ...partData, user_id: user?.id }),
    })
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

  const autoUpdateWoStatus = async () => {
    if (!wo) return
    const lines = (wo.so_lines || []).filter((l: any) => l.line_type === 'labor' || l.line_type === 'job')
    if (lines.length === 0) return
    const allCompleted = lines.every((l: any) => l.line_status === 'completed')
    const anyInProgress = lines.some((l: any) => l.line_status === 'in_progress')
    let newStatus = 'open'
    if (allCompleted) newStatus = 'completed'
    else if (anyInProgress) newStatus = 'in_progress'
    await fetch(`/api/work-orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, user_id: user?.id }),
    })
  }

  /* ── Loading / Error States ── */
  if (loading) return <div style={{ minHeight: '100vh', background: '#fff', fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: GRAY }}>Loading...</div>
  if (!wo) return <div style={{ minHeight: '100vh', background: '#fff', fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: RED }}>Work order not found</div>

  /* ── Derived Data ── */
  const asset = wo.assets || {}
  const customer = wo.customers || {}
  const jobLines = (wo.so_lines || []).filter((l: any) => l.line_type === 'labor' || l.line_type === 'job')
  const partLines = (wo.so_lines || []).filter((l: any) => l.line_type === 'part')
  const shopCharges = wo.wo_shop_charges || []
  const notes = wo.wo_notes || []
  const files = wo.wo_files || []
  const activity = wo.wo_activity_log || []
  const techMap: Record<string, string> = wo.techMap || {}
  const userMap: Record<string, string> = wo.userMap || {}
  const shop = wo.shop || {}
  const laborRate = shop.default_labor_rate || shop.labor_rate || 105
  const taxRate = shop.tax_rate || 0
  const woStatus = wo.wo_status || wo.status || 'open'
  const woStatusCfg = WO_STATUS_CFG[woStatus] || WO_STATUS_CFG.open

  /* ── Style Helpers ── */
  const pill = (bg: string, color: string, extra?: React.CSSProperties): React.CSSProperties => ({
    display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: bg, color, letterSpacing: 0.3, ...extra,
  })

  const btn = (bg: string, color: string, extra?: React.CSSProperties): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 6, border: 'none', background: bg, color, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, ...extra,
  })

  const card: React.CSSProperties = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 16, marginBottom: 12 }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13, fontFamily: FONT, color: '#1A1A1A', outline: 'none', background: '#fff' }

  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }

  const modalOverlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }

  const modalBox: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 24, width: '90%', maxWidth: 480, maxHeight: '80vh', overflowY: 'auto', fontFamily: FONT }

  /* ── Compute totals ── */
  const laborTotal = jobLines.reduce((s: number, l: any) => s + ((l.billed_hours || l.actual_hours || l.estimated_hours || 0) * (l.labor_rate || laborRate)), 0)
  const partsTotal = woParts.reduce((s: number, p: any) => s + ((p.quantity || 1) * (p.unit_cost || 0)), 0)
  const chargesTotal = shopCharges.reduce((s: number, c: any) => s + (c.amount || 0), 0)
  const subtotal = laborTotal + partsTotal + chargesTotal
  const taxAmount = subtotal * (taxRate / 100)
  const grandTotal = subtotal + taxAmount

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
  const fmtTime = (d: string) => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''
  const fmtMoney = (n: number) => '$' + n.toFixed(2)

  return (
    <>
      <style>{`@media print { aside, nav, [data-no-print] { display:none!important; } body,html { background:#fff!important; } }`}</style>
      <div style={{ minHeight: '100vh', background: '#F8F9FB', fontFamily: FONT, color: '#1A1A1A' }}>

        {/* ── BACK BUTTON ── */}
        <a href="/work-orders" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#ECEEF2', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#374151', textDecoration: 'none', margin: '16px 24px 0' }}>
          <ChevronLeft size={16} strokeWidth={2} /> Work Orders
        </a>

        {/* ── HEADER ── */}
        <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginTop: 8 }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: '#1A1A1A' }}>WO #{wo.wo_number || wo.id?.slice(0, 8)}</span>
              <span style={pill(woStatusCfg.bg, woStatusCfg.color)}>{woStatusCfg.label}</span>
              {customer.company_name && <a href={`/customers/${customer.id}`} style={{ fontSize: 14, fontWeight: 600, color: BLUE, textDecoration: 'none' }}>{customer.company_name}</a>}
              {wo.payment_method === 'cod' && <span style={pill('#FEF2F2', RED)}>COD</span>}
            </div>
            <div style={{ fontSize: 11, color: GRAY }}>
              Opened by: {wo.createdByName || 'System'} &middot; {fmtDate(wo.created_at)}
            </div>
          </div>
          <div style={{ textAlign: 'right', minWidth: 220 }}>
            {asset.unit_number && <a href={`/assets/${asset.id}`} style={{ fontSize: 16, fontWeight: 700, color: BLUE, textDecoration: 'none', display: 'block' }}>Unit {asset.unit_number}</a>}
            <div style={{ fontSize: 13, color: '#374151' }}>{[asset.year, asset.make, asset.model].filter(Boolean).join(' ')}</div>
            {asset.vin && <div style={{ fontSize: 12, color: GRAY }}>VIN: ...{String(asset.vin).slice(-6).toUpperCase()}</div>}
            {asset.odometer && <div style={{ fontSize: 12, color: GRAY }}>Last: {Number(asset.odometer).toLocaleString()} mi</div>}
            {asset.ownership_type && <span style={pill('#EFF6FF', BLUE, { marginTop: 4 })}>{asset.ownership_type}</span>}
          </div>
        </div>

        {/* ── TAB BAR ── */}
        <div data-no-print style={{ display: 'flex', gap: 0, background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '0 24px', overflowX: 'auto' }}>
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)} style={{ padding: '12px 18px', fontSize: 13, fontWeight: tab === i ? 700 : 500, color: tab === i ? BLUE : GRAY, background: 'none', border: 'none', borderBottom: tab === i ? `2px solid ${BLUE}` : '2px solid transparent', cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap' }}>{t}</button>
          ))}
        </div>

        {/* ── QUICK ACTIONS BAR ── */}
        <div data-no-print style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, margin: '12px 24px 0', padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {[
            { icon: <Users size={20} />, label: 'Team', action: () => setShowTeamModal(true) },
            { icon: <MessageSquare size={20} />, label: 'Notes', action: () => setTab(3) },
            { icon: <Clock size={20} />, label: 'Activity', action: () => setTab(4) },
            { icon: <DollarSign size={20} />, label: 'Billing', action: () => setTab(2) },
          ].map((b, i) => (
            <button key={i} onClick={b.action} style={{ width: 38, height: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 6, cursor: 'pointer', color: '#4B5563', padding: 0 }}>
              {b.icon}
              <span style={{ fontSize: 10, color: GRAY }}>{b.label}</span>
            </button>
          ))}
          <div style={{ width: 1, height: 20, background: '#E5E7EB' }} />
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowMenu(!showMenu)} style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 6, cursor: 'pointer', color: '#4B5563' }}><MoreHorizontal size={20} /></button>
            {showMenu && (
              <div style={{ position: 'absolute', right: 0, top: 38, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, minWidth: 160, overflow: 'hidden' }}>
                <button onClick={() => { setShowMenu(false); window.print() }} style={{ display: 'block', width: '100%', padding: '10px 16px', border: 'none', background: 'none', textAlign: 'left', fontSize: 13, cursor: 'pointer', fontFamily: FONT, color: '#1A1A1A' }}>Print WO</button>
                <button onClick={() => { setShowMenu(false); setDeleteConfirm(true) }} style={{ display: 'block', width: '100%', padding: '10px 16px', border: 'none', background: 'none', textAlign: 'left', fontSize: 13, cursor: 'pointer', fontFamily: FONT, color: RED }}>Delete WO</button>
              </div>
            )}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: GRAY, textTransform: 'uppercase' }}>Chassis (Miles)</span>
            <input value={mileage} onChange={e => setMileage(e.target.value)} onBlur={async () => {
              if (mileage && asset.id) {
                await fetch(`/api/assets/${asset.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ odometer: parseInt(mileage) || 0 }) })
                await logActivity(`Updated mileage to ${mileage}`)
              }
            }} style={{ ...inputStyle, width: 120 }} placeholder="0" />
            {asset.odometer && <span style={{ fontSize: 11, color: GRAY }}>Last: {Number(asset.odometer).toLocaleString()}</span>}
          </div>
        </div>

        {/* ── TAB CONTENT ── */}
        <div style={{ padding: '16px 24px', maxWidth: 1100 }}>

          {/* ════════ TAB 0: OVERVIEW ════════ */}
          {tab === 0 && (
            <div>
              {jobLines.map((line: any, idx: number) => {
                const st = STATUS_CFG[line.line_status] || STATUS_CFG.unassigned
                const lineAssignments = jobAssignments.filter((ja: any) => ja.line_id === line.id)
                const assignedNames = lineAssignments.map((ja: any) => `${ja.users?.full_name || 'Unknown'} (${ja.percentage}%)`).join(', ')
                return (
                  <div key={line.id} style={{ ...card, borderLeft: `3px solid ${line.is_additional ? AMBER : st.color}` }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 700 }}>Job {idx + 1}</span>
                      <select value={line.line_status || 'unassigned'} onChange={async (e) => {
                        await patchLine(line.id, { line_status: e.target.value })
                        await autoUpdateWoStatus()
                        await loadData()
                      }} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 12, fontWeight: 600, background: st.bg, color: st.color, cursor: 'pointer', fontFamily: FONT }}>
                        {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                      <span style={pill('#F3F4F6', '#374151')}>Concern</span>
                      {line.is_additional && <span style={pill('#FFFBEB', AMBER)}>ADDITIONAL</span>}
                    </div>

                    {/* Assignment */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Users size={14} color={GRAY} />
                        {assignedNames ? (
                          <span style={{ fontSize: 13, color: '#374151', cursor: 'pointer' }} onClick={() => openAssignModal(line.id, idx)}>{assignedNames}</span>
                        ) : (
                          <span style={{ fontSize: 13, color: RED, cursor: 'pointer', fontWeight: 600 }} onClick={() => openAssignModal(line.id, idx)}>Assign</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: GRAY }}>
                        <span>Est: {line.estimated_hours || 0}h</span>
                        <span>Act: {line.actual_hours || 0}h</span>
                        <span>Bill: {line.billed_hours || 0}h</span>
                      </div>
                    </div>

                    {/* Concern Box */}
                    <div style={{ background: '#F8F9FB', borderRadius: 6, padding: '10px 12px', marginBottom: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: '#1A1A1A' }}>{line.description}</span>
                    </div>

                    {/* Finding */}
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={labelStyle}>Finding</span>
                        <Mic size={13} color={GRAY} style={{ cursor: 'pointer' }} />
                      </div>
                      <textarea defaultValue={line.finding || ''} onBlur={(e) => patchLine(line.id, { finding: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Inspection findings..." />
                    </div>

                    {/* Resolution */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={labelStyle}>Resolution</span>
                        <Mic size={13} color={GRAY} style={{ cursor: 'pointer' }} />
                      </div>
                      <textarea defaultValue={line.resolution || ''} onBlur={(e) => patchLine(line.id, { resolution: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Work performed..." />
                    </div>

                    {/* Bottom actions */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button onClick={() => { setTab(1) }} style={btn('#EFF6FF', BLUE)}>+ Add Parts</button>
                      <button onClick={() => setHoursModal({ lineId: line.id, estimated: line.estimated_hours || '', actual: line.actual_hours || '', billed: line.billed_hours || '', rate: line.labor_rate || laborRate })} style={btn('#F3F4F6', '#374151')}>Log Hours</button>
                      <button onClick={async () => {
                        if (!confirm('Remove this job line?')) return
                        await fetch(`/api/so-lines/${line.id}`, { method: 'DELETE' })
                        await logActivity(`Removed job: ${line.description}`)
                        await loadData()
                      }} style={btn('#FEF2F2', RED)}>Remove Job</button>
                    </div>
                  </div>
                )
              })}

              {/* Add Job Line */}
              <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input value={newJobText} onChange={e => setNewJobText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !addingJob) addJobLine() }} placeholder="Describe customer complaint or job..." style={{ ...inputStyle, flex: 1 }} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: GRAY, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <input type="checkbox" checked={useAI} onChange={e => setUseAI(e.target.checked)} />
                    AI Split
                  </label>
                  <button onClick={addJobLine} disabled={addingJob || !newJobText.trim()} style={btn(BLUE, '#fff', { opacity: addingJob || !newJobText.trim() ? 0.5 : 1 })}>
                    <Plus size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    {addingJob ? 'Adding...' : 'Add Job'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={addShopCharge} style={btn('#F3F4F6', '#374151')}>
                  <Plus size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  Add Shop Charge
                </button>
                <button onClick={async () => {
                  await fetch(`/api/work-orders/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'pending_review', user_id: user?.id }),
                  })
                  await logActivity('Requested approval')
                  await loadData()
                }} style={btn(GREEN, '#fff')}>Get Approval</button>
              </div>
            </div>
          )}

          {/* ════════ TAB 1: PARTS & MATERIALS ════════ */}
          {tab === 1 && (
            <div>
              {jobLines.map((line: any, idx: number) => {
                const lineParts = woParts.filter((p: any) => p.line_id === line.id)
                return (
                  <div key={line.id} style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: '#374151' }}>Job {idx + 1}: {line.description}</div>
                    {lineParts.length > 0 && (
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8, fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: '#F8F9FB' }}>
                            <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 700, fontSize: 11, color: GRAY, textTransform: 'uppercase' }}>Part #</th>
                            <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 700, fontSize: 11, color: GRAY, textTransform: 'uppercase' }}>Description</th>
                            <th style={{ textAlign: 'center', padding: '8px 10px', fontWeight: 700, fontSize: 11, color: GRAY, textTransform: 'uppercase' }}>Qty</th>
                            <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 700, fontSize: 11, color: GRAY, textTransform: 'uppercase' }}>Unit Cost</th>
                            <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 700, fontSize: 11, color: GRAY, textTransform: 'uppercase' }}>Total</th>
                            <th style={{ textAlign: 'center', padding: '8px 10px', fontWeight: 700, fontSize: 11, color: GRAY, textTransform: 'uppercase' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineParts.map((p: any) => {
                            const ps = PART_STATUS[p.status] || PART_STATUS.needed
                            return (
                              <tr key={p.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                <td style={{ padding: '8px 10px' }}>{p.part_number || '-'}</td>
                                <td style={{ padding: '8px 10px' }}>{p.description}</td>
                                <td style={{ padding: '8px 10px', textAlign: 'center' }}>{p.quantity || 1}</td>
                                <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmtMoney(p.unit_cost || 0)}</td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{fmtMoney((p.quantity || 1) * (p.unit_cost || 0))}</td>
                                <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                  <select value={p.status || 'needed'} onChange={e => updatePartStatus(p.id, e.target.value)} style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #E5E7EB', fontSize: 11, fontWeight: 600, background: ps.bg, color: ps.color, cursor: 'pointer', fontFamily: FONT }}>
                                    {Object.entries(PART_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                  </select>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                    {/* Inline add part form */}
                    <PartForm lineId={line.id} onAdd={addPart} />
                  </div>
                )
              })}
              <div style={{ ...card, background: '#F8F9FB', marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700 }}>
                  <span>Parts Total</span>
                  <span>{fmtMoney(partsTotal)}</span>
                </div>
              </div>
            </div>
          )}

          {/* ════════ TAB 2: ESTIMATE & BILLING ════════ */}
          {tab === 2 && (
            <div>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Labor', value: fmtMoney(laborTotal), color: BLUE },
                  { label: 'Parts', value: fmtMoney(partsTotal), color: AMBER },
                  { label: 'Shop Charges', value: fmtMoney(chargesTotal), color: GRAY },
                  { label: `Tax (${taxRate}%)`, value: fmtMoney(taxAmount), color: GRAY },
                  { label: 'Total', value: fmtMoney(grandTotal), color: GREEN },
                ].map(s => (
                  <div key={s.label} style={{ ...card, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Job Lines Table */}
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Labor</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F8F9FB' }}>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 700, fontSize: 11, color: GRAY, textTransform: 'uppercase' }}>Job</th>
                    <th style={{ textAlign: 'center', padding: '8px 10px', fontWeight: 700, fontSize: 11, color: GRAY, textTransform: 'uppercase' }}>Est Hrs</th>
                    <th style={{ textAlign: 'center', padding: '8px 10px', fontWeight: 700, fontSize: 11, color: GRAY, textTransform: 'uppercase' }}>Act Hrs</th>
                    <th style={{ textAlign: 'center', padding: '8px 10px', fontWeight: 700, fontSize: 11, color: GRAY, textTransform: 'uppercase' }}>Bill Hrs</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 700, fontSize: 11, color: GRAY, textTransform: 'uppercase' }}>Rate</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 700, fontSize: 11, color: GRAY, textTransform: 'uppercase' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {jobLines.map((line: any) => {
                    const hrs = line.billed_hours || line.actual_hours || line.estimated_hours || 0
                    const rate = line.labor_rate || laborRate
                    return (
                      <tr key={line.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '8px 10px', maxWidth: 200 }}>{line.description}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <input type="number" step="0.5" defaultValue={line.estimated_hours || ''} onBlur={e => patchLine(line.id, { estimated_hours: parseFloat(e.target.value) || 0 }).then(loadData)} style={{ ...inputStyle, width: 60, textAlign: 'center', padding: '4px 6px' }} />
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <input type="number" step="0.5" defaultValue={line.actual_hours || ''} onBlur={e => patchLine(line.id, { actual_hours: parseFloat(e.target.value) || 0 }).then(loadData)} style={{ ...inputStyle, width: 60, textAlign: 'center', padding: '4px 6px' }} />
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <input type="number" step="0.5" defaultValue={line.billed_hours || ''} onBlur={e => patchLine(line.id, { billed_hours: parseFloat(e.target.value) || 0 }).then(loadData)} style={{ ...inputStyle, width: 60, textAlign: 'center', padding: '4px 6px' }} />
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                          <input type="number" step="1" defaultValue={rate} onBlur={e => patchLine(line.id, { labor_rate: parseFloat(e.target.value) || 0 }).then(loadData)} style={{ ...inputStyle, width: 70, textAlign: 'right', padding: '4px 6px' }} />
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>{fmtMoney(hrs * rate)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Shop Charges */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Shop Charges</div>
                <button onClick={addShopCharge} style={btn('#F3F4F6', '#374151', { fontSize: 12 })}>
                  <Plus size={13} style={{ marginRight: 3, verticalAlign: 'middle' }} /> Add
                </button>
              </div>
              {shopCharges.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 13 }}>
                  <tbody>
                    {shopCharges.map((c: any) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '8px 10px' }}>{c.description}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{fmtMoney(c.amount || 0)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', width: 40 }}>
                          <button onClick={async () => {
                            if (!confirm('Remove this charge?')) return
                            await fetch(`/api/wo-charges?id=${c.id}`, { method: 'DELETE' })
                            await logActivity(`Removed charge: ${c.description}`)
                            await loadData()
                          }} style={{ background: 'none', border: 'none', color: RED, cursor: 'pointer', fontSize: 14 }}><X size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Totals */}
              <div style={{ ...card, background: '#F8F9FB' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}><span>Labor</span><span>{fmtMoney(laborTotal)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}><span>Parts</span><span>{fmtMoney(partsTotal)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}><span>Shop Charges</span><span>{fmtMoney(chargesTotal)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, color: GRAY }}><span>Tax ({taxRate}%)</span><span>{fmtMoney(taxAmount)}</span></div>
                <div style={{ borderTop: '2px solid #E5E7EB', paddingTop: 8, marginTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800 }}><span>Grand Total</span><span style={{ color: GREEN }}>{fmtMoney(grandTotal)}</span></div>
              </div>
            </div>
          )}

          {/* ════════ TAB 3: FILES & NOTES ════════ */}
          {tab === 3 && (
            <div>
              {/* Add Note */}
              <div style={{ ...card, marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Add Note</div>
                <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={3} style={{ ...inputStyle, marginBottom: 8, resize: 'vertical' }} placeholder="Write a note..." />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: GRAY, cursor: 'pointer' }}>
                    <input type="checkbox" checked={noteVisible} onChange={e => setNoteVisible(e.target.checked)} />
                    Visible to customer
                  </label>
                  <button onClick={addNote} disabled={addingNote || !noteText.trim()} style={btn(BLUE, '#fff', { opacity: addingNote || !noteText.trim() ? 0.5 : 1 })}>
                    {addingNote ? 'Saving...' : 'Add Note'}
                  </button>
                </div>
              </div>

              {/* Notes List */}
              {notes.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Notes ({notes.length})</div>
                  {[...notes].reverse().map((n: any) => (
                    <div key={n.id} style={{ ...card, borderLeft: n.visible_to_customer ? `3px solid ${BLUE}` : '3px solid #E5E7EB' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{userMap[n.user_id] || 'Unknown'}</span>
                        <span style={{ fontSize: 11, color: GRAY }}>{fmtTime(n.created_at)}</span>
                      </div>
                      <div style={{ fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap' }}>{n.note_text}</div>
                      {n.visible_to_customer && <span style={{ ...pill('#EFF6FF', BLUE), marginTop: 6 }}>Customer Visible</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* File Upload */}
              <div style={{ ...card }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Files</div>
                <input ref={fileRef} type="file" multiple onChange={e => uploadFiles(e.target.files)} style={{ display: 'none' }} />
                <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed #D1D5DB', borderRadius: 8, padding: '24px 16px', textAlign: 'center', cursor: 'pointer', background: '#FAFAFA', marginBottom: 12 }}>
                  <Upload size={24} color={GRAY} style={{ marginBottom: 6 }} />
                  <div style={{ fontSize: 13, color: GRAY }}>{uploading ? 'Uploading...' : 'Click or drag files to upload'}</div>
                </div>
                {files.length > 0 && (
                  <div>
                    {[...files].reverse().map((f: any) => (
                      <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
                        <div>
                          <a href={f.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: BLUE, textDecoration: 'none', fontWeight: 600 }}>{f.filename}</a>
                          <div style={{ fontSize: 11, color: GRAY }}>{userMap[f.user_id] || 'Unknown'} &middot; {fmtTime(f.created_at)}</div>
                        </div>
                        <Paperclip size={14} color={GRAY} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════ TAB 4: ACTIVITY ════════ */}
          {tab === 4 && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Activity Log</div>
              {activity.length === 0 && <div style={{ fontSize: 13, color: GRAY, padding: 16 }}>No activity yet.</div>}
              {[...activity].reverse().map((a: any, i: number) => {
                const isLast = i === activity.length - 1
                return (
                  <div key={a.id} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: isLast ? 0 : 16 }}>
                    {/* Timeline */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 999, background: i === 0 ? BLUE : '#D1D5DB', flexShrink: 0 }} />
                      {!isLast && <div style={{ width: 2, flex: 1, background: '#E5E7EB' }} />}
                    </div>
                    {/* Content */}
                    <div style={{ flex: 1, paddingBottom: 4 }}>
                      <div style={{ fontSize: 13, color: '#1A1A1A' }}>{a.action}</div>
                      <div style={{ fontSize: 11, color: GRAY }}>{userMap[a.user_id] || 'System'} &middot; {fmtTime(a.created_at)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ══════════════════════ MODALS ══════════════════════ */}

        {/* ── Team & Contacts Modal ── */}
        {showTeamModal && (
          <div style={modalOverlay} onClick={() => setShowTeamModal(false)}>
            <div style={modalBox} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 18, fontWeight: 700 }}>Team & Contacts</span>
                <button onClick={() => setShowTeamModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GRAY }}><X size={20} /></button>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={labelStyle}>Service Writer</div>
                <select value={teamAssign.writer} onChange={e => setTeamAssign(p => ({ ...p, writer: e.target.value }))} style={inputStyle}>
                  <option value="">-- None --</option>
                  {allUsers.map((u: any) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={labelStyle}>Lead Tech</div>
                <select value={teamAssign.tech} onChange={e => setTeamAssign(p => ({ ...p, tech: e.target.value }))} style={inputStyle}>
                  <option value="">-- None --</option>
                  {mechanics.map((u: any) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={labelStyle}>Parts Person</div>
                <select value={teamAssign.parts} onChange={e => setTeamAssign(p => ({ ...p, parts: e.target.value }))} style={inputStyle}>
                  <option value="">-- None --</option>
                  {allUsers.map((u: any) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setShowTeamModal(false)} style={btn('#F3F4F6', '#374151')}>Cancel</button>
                <button onClick={saveTeamAssign} style={btn(BLUE, '#fff')}>Save</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Mechanic Assignment Modal ── */}
        {assignModal && (
          <div style={modalOverlay} onClick={() => setAssignModal(null)}>
            <div style={modalBox} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 18, fontWeight: 700 }}>Assign Mechanics - Job {assignModal.idx + 1}</span>
                <button onClick={() => setAssignModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GRAY }}><X size={20} /></button>
              </div>
              <div style={{ marginBottom: 12 }}>
                <select onChange={e => { addMechToList(e.target.value); e.target.value = '' }} style={inputStyle} defaultValue="">
                  <option value="" disabled>Add a mechanic...</option>
                  {(() => {
                    const available = mechanics.filter((m: any) => m.active && !assignList.find(a => a.user_id === m.id))
                    const teams = [...new Set(available.map((m: any) => m.team || 'Unassigned'))]
                    return teams.map(team => (
                      <optgroup key={team} label={team}>
                        {available.filter((m: any) => (m.team || 'Unassigned') === team).map((m: any) => (
                          <option key={m.id} value={m.id}>{m.role === 'lead_tech' ? '* ' : ''}{m.full_name}{m.skills?.length ? ` — ${m.skills.slice(0,2).join(', ')}` : ''}</option>
                        ))}
                      </optgroup>
                    ))
                  })()}
                </select>
              </div>
              {assignList.length === 0 && <div style={{ fontSize: 13, color: GRAY, padding: 12, textAlign: 'center' }}>No mechanics assigned</div>}
              {assignList.map((a, i) => {
                const mechData = mechanics.find((m: any) => m.id === a.user_id)
                return (
                <div key={a.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{a.name}</span>
                    {mechData?.skills?.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                        {mechData.skills.slice(0, 3).map((s: string) => (
                          <span key={s} style={{ fontSize: 9, padding: '1px 6px', background: '#F3F4F6', borderRadius: 4, color: GRAY }}>{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <input type="number" min={0} max={100} value={a.percentage} onChange={e => {
                    const next = [...assignList]
                    next[i] = { ...next[i], percentage: parseInt(e.target.value) || 0 }
                    setAssignList(next)
                  }} style={{ ...inputStyle, width: 60, textAlign: 'center', padding: '4px 6px' }} />
                  <span style={{ fontSize: 12, color: GRAY }}>%</span>
                  <button onClick={() => removeMechFromList(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: RED }}><X size={16} /></button>
                </div>
              )})}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button onClick={() => setAssignModal(null)} style={btn('#F3F4F6', '#374151')}>Cancel</button>
                <button onClick={saveAssignments} style={btn(BLUE, '#fff')}>Save Assignments</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Log Hours Modal ── */}
        {hoursModal && (
          <div style={modalOverlay} onClick={() => setHoursModal(null)}>
            <div style={modalBox} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 18, fontWeight: 700 }}>Log Hours</span>
                <button onClick={() => setHoursModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GRAY }}><X size={20} /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <div style={labelStyle}>Estimated Hours</div>
                  <input type="number" step="0.5" value={hoursModal.estimated} onChange={e => setHoursModal((p: any) => ({ ...p, estimated: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <div style={labelStyle}>Actual Hours</div>
                  <input type="number" step="0.5" value={hoursModal.actual} onChange={e => setHoursModal((p: any) => ({ ...p, actual: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <div style={labelStyle}>Billed Hours</div>
                  <input type="number" step="0.5" value={hoursModal.billed} onChange={e => setHoursModal((p: any) => ({ ...p, billed: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <div style={labelStyle}>Labor Rate ($/hr)</div>
                  <input type="number" step="1" value={hoursModal.rate} onChange={e => setHoursModal((p: any) => ({ ...p, rate: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setHoursModal(null)} style={btn('#F3F4F6', '#374151')}>Cancel</button>
                <button onClick={saveHours} style={btn(BLUE, '#fff')}>Save Hours</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Delete WO Modal ── */}
        {deleteConfirm && (
          <div style={modalOverlay} onClick={() => setDeleteConfirm(false)}>
            <div style={modalBox} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: RED }}>Delete Work Order</span>
                <button onClick={() => setDeleteConfirm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GRAY }}><X size={20} /></button>
              </div>
              <div style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>This will void WO #{wo.wo_number || wo.id?.slice(0, 8)}. Type <strong>DELETE</strong> to confirm.</div>
              <input value={deleteText} onChange={e => setDeleteText(e.target.value)} placeholder="Type DELETE" style={{ ...inputStyle, marginBottom: 12 }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => { setDeleteConfirm(false); setDeleteText('') }} style={btn('#F3F4F6', '#374151')}>Cancel</button>
                <button onClick={deleteWO} disabled={deleteText.toUpperCase() !== 'DELETE'} style={btn(RED, '#fff', { opacity: deleteText.toUpperCase() !== 'DELETE' ? 0.4 : 1 })}>Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* ── FOOTER ── */}
        <div style={{ padding: '24px', textAlign: 'center', fontSize: 11, color: GRAY, marginTop: 24 }}>
          Powered by TruckZen
        </div>
      </div>
    </>
  )
}

/* ═══════════════════════════════════════════════════ */
/* Inline Part Form (sub-component to manage its own state) */
/* ═══════════════════════════════════════════════════ */
function PartForm({ lineId, onAdd }: { lineId: string; onAdd: (lineId: string, data: { part_number: string; description: string; quantity: number; unit_cost: number }) => Promise<void> }) {
  const [show, setShow] = useState(false)
  const [pn, setPn] = useState('')
  const [desc, setDesc] = useState('')
  const [qty, setQty] = useState('1')
  const [cost, setCost] = useState('')
  const [saving, setSaving] = useState(false)

  const FONT = "'Inter', -apple-system, sans-serif"
  const BLUE = '#1D6FE8'
  const inputStyle: React.CSSProperties = { width: '100%', padding: '6px 8px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13, fontFamily: FONT, color: '#1A1A1A', outline: 'none', background: '#fff' }

  if (!show) {
    return (
      <button onClick={() => setShow(true)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px dashed #D1D5DB', background: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, color: BLUE }}>
        <Plus size={13} style={{ marginRight: 3, verticalAlign: 'middle' }} />Add Part
      </button>
    )
  }

  const handleSave = async () => {
    if (!desc.trim()) return
    setSaving(true)
    await onAdd(lineId, { part_number: pn.trim(), description: desc.trim(), quantity: parseInt(qty) || 1, unit_cost: parseFloat(cost) || 0 })
    setPn(''); setDesc(''); setQty('1'); setCost(''); setSaving(false); setShow(false)
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', flexWrap: 'wrap', padding: '8px 0' }}>
      <div style={{ width: 100 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: 2 }}>Part #</div>
        <input value={pn} onChange={e => setPn(e.target.value)} style={inputStyle} placeholder="PN" />
      </div>
      <div style={{ flex: 1, minWidth: 140 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: 2 }}>Description</div>
        <input value={desc} onChange={e => setDesc(e.target.value)} style={inputStyle} placeholder="Part description" />
      </div>
      <div style={{ width: 60 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: 2 }}>Qty</div>
        <input type="number" value={qty} onChange={e => setQty(e.target.value)} style={{ ...inputStyle, textAlign: 'center' }} />
      </div>
      <div style={{ width: 80 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: 2 }}>Cost</div>
        <input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)} style={inputStyle} placeholder="0.00" />
      </div>
      <button onClick={handleSave} disabled={saving || !desc.trim()} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: BLUE, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, opacity: saving || !desc.trim() ? 0.5 : 1 }}>
        {saving ? '...' : 'Add'}
      </button>
      <button onClick={() => setShow(false)} style={{ padding: '6px 8px', borderRadius: 6, border: 'none', background: '#F3F4F6', color: '#374151', fontSize: 12, cursor: 'pointer', fontFamily: FONT }}>
        <X size={14} />
      </button>
    </div>
  )
}
