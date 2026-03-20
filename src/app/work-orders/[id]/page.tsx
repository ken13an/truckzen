'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser, type UserProfile } from '@/lib/auth'
import { Truck, Calendar, Users, MessageSquare, Paperclip, Clock, DollarSign, MoreHorizontal, Plus, Mic } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  unassigned: '#DC2626',
  approved: '#16A34A',
  pending_review: '#D97706',
  in_progress: '#1D6FE8',
  completed: '#059669',
}

const STATUS_LABELS: Record<string, string> = {
  unassigned: 'Unassigned',
  approved: 'Approved',
  pending_review: 'Pending Review',
  in_progress: 'In Progress',
  completed: 'Completed',
}

const TABS = ['Overview', 'Parts & Materials', 'Estimate & Billing', 'Files & Notes', 'Activity']

const font = "'Instrument Sans', sans-serif"

export default function WorkOrderDetailPage() {
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  const [user, setUser] = useState<UserProfile | null>(null)
  const [wo, setWo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(0)
  const [mechanics, setMechanics] = useState<any[]>([])
  const [savingLine, setSavingLine] = useState<string | null>(null)
  const [assigningLine, setAssigningLine] = useState<string | null>(null)

  // Notes form
  const [noteText, setNoteText] = useState('')
  const [noteVisible, setNoteVisible] = useState(false)
  const [addingNote, setAddingNote] = useState(false)

  // Files
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [teamAssign, setTeamAssign] = useState({ writer: '', tech: '', parts: '' })
  const [assignModal, setAssignModal] = useState<{ lineId: string; lineIdx: number } | null>(null)
  const [assignList, setAssignList] = useState<{ user_id: string; name: string; percentage: number }[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [jobAssignments, setJobAssignments] = useState<any[]>([])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const profile = await getCurrentUser(supabase)
    if (!profile) { window.location.href = '/login'; return }
    setUser(profile)

    const [woRes, mechRes] = await Promise.all([
      fetch(`/api/work-orders/${id}`),
      fetch(`/api/users?shop_id=${profile.shop_id}&role=technician`),
    ])
    if (woRes.ok) {
      const woData = await woRes.json()
      setWo(woData)
      setTeamAssign({ writer: woData.service_writer_id || '', tech: woData.assigned_tech || '', parts: woData.parts_person_id || '' })
      setJobAssignments(woData.jobAssignments || [])
    }
    if (mechRes.ok) {
      const users = await mechRes.json()
      setAllUsers(users)
      setMechanics(users.filter((u: any) => ['technician', 'maintenance_technician'].includes(u.role)))
    }
    setLoading(false)
  }

  async function patchLine(lineId: string, data: Record<string, any>) {
    setSavingLine(lineId)
    await fetch(`/api/so-lines/${lineId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    setSavingLine(null)
  }

  function openAssignModal(lineId: string, lineIdx: number) {
    const existing = jobAssignments.filter((a: any) => a.line_id === lineId)
    setAssignList(existing.map((a: any) => ({ user_id: a.user_id, name: a.users?.full_name || 'Unknown', percentage: a.percentage || 100 })))
    setAssignModal({ lineId, lineIdx })
  }

  function addMechToList(mechId: string) {
    const m = mechanics.find((u: any) => u.id === mechId)
    if (!m || assignList.find(a => a.user_id === mechId)) return
    const newList = [...assignList, { user_id: mechId, name: m.full_name, percentage: 100 }]
    // Auto-distribute percentages evenly
    const even = Math.floor(100 / newList.length)
    const remainder = 100 - even * newList.length
    setAssignList(newList.map((a, i) => ({ ...a, percentage: even + (i === newList.length - 1 ? remainder : 0) })))
  }

  function removeMechFromList(idx: number) {
    const newList = assignList.filter((_, i) => i !== idx)
    if (newList.length === 0) { setAssignList([]); return }
    const even = Math.floor(100 / newList.length)
    const remainder = 100 - even * newList.length
    setAssignList(newList.map((a, i) => ({ ...a, percentage: even + (i === newList.length - 1 ? remainder : 0) })))
  }

  async function saveAssignments() {
    if (!assignModal) return
    await fetch('/api/wo-job-assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line_id: assignModal.lineId, wo_id: wo.id, user_id: user?.id, assignments: assignList }),
    })
    setAssignModal(null)
    await loadData()
  }

  async function addNote() {
    if (!noteText.trim() || !wo) return
    setAddingNote(true)
    await fetch('/api/wo-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wo_id: wo.id, note_text: noteText, visible_to_customer: noteVisible, user_id: user?.id }),
    })
    setNoteText('')
    setNoteVisible(false)
    setAddingNote(false)
    await loadData()
  }

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0 || !wo || !user) return
    setUploadingFile(true)
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const ext = file.name.split('.').pop() || 'bin'
      const path = `${wo.shop_id}/${wo.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

      // Upload to Supabase Storage
      const { error: uploadErr } = await supabase.storage.from('wo-files').upload(path, file)
      if (uploadErr) { console.error('Upload error:', uploadErr); continue }

      // Get public URL
      const { data: urlData } = supabase.storage.from('wo-files').getPublicUrl(path)
      const fileUrl = urlData?.publicUrl || ''

      // Save record
      await fetch('/api/wo-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wo_id: wo.id, user_id: user.id, file_url: fileUrl, filename: file.name }),
      })
    }
    setUploadingFile(false)
    await loadData()
  }

  async function removeLine(lineId: string) {
    if (!confirm('Remove this job line?')) return
    await fetch(`/api/so-lines/${lineId}`, { method: 'DELETE' })
    await loadData()
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#fff', fontFamily: font, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>
        Loading...
      </div>
    )
  }

  if (!wo) {
    return (
      <div style={{ minHeight: '100vh', background: '#fff', fontFamily: font, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626' }}>
        Work order not found
      </div>
    )
  }

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
  const taxRate = shop.tax_rate || 0

  const laborTotal = jobLines.reduce((s: number, l: any) => s + (parseFloat(l.billed_hours || 0) * parseFloat(l.labor_rate || 0)), 0)
  const partsTotal = partLines.reduce((s: number, l: any) => s + (parseFloat(l.quantity || 0) * parseFloat(l.unit_price || 0)), 0)
  const chargesTotal = shopCharges.reduce((s: number, c: any) => s + parseFloat(c.amount || 0), 0)
  const tax = partsTotal * taxRate / 100
  const grandTotal = laborTotal + partsTotal + chargesTotal + tax

  const vin = asset.vin || ''
  const vinLast6 = vin.length >= 6 ? vin.slice(0, -6) : ''
  const vinBold = vin.length >= 6 ? vin.slice(-6) : vin

  async function deleteWO() {
    if (!confirm('Delete this work order? This cannot be undone.')) return
    await fetch(`/api/work-orders/${wo.id}`, { method: 'DELETE' })
    window.location.href = '/work-orders'
  }

  async function saveTeamAssign() {
    await fetch(`/api/work-orders/${wo.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service_writer_id: teamAssign.writer || null, assigned_tech: teamAssign.tech || null, parts_person_id: teamAssign.parts || null, user_id: user?.id }),
    })
    setShowTeamModal(false)
    await loadData()
  }

  function quickAction(idx: number) {
    if (idx === 0) setShowTeamModal(true) // Team assign
    if (idx === 1 || idx === 2) setActiveTab(3) // Notes / Files
    if (idx === 3) setActiveTab(4) // Activity
    if (idx === 4) setActiveTab(2) // Billing
    if (idx === 5) setShowMenu(!showMenu) // Menu
  }

  const quickIcons = [Users, MessageSquare, Paperclip, Clock, DollarSign, MoreHorizontal]

  return (
    <>
      <style>{`
        @media print {
          aside, nav, .no-print, [data-no-print] { display: none !important; }
          body, html { background: #fff !important; margin: 0 !important; padding: 0 !important; }
          * { color: #1A1A1A !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          a { text-decoration: none !important; }
          button, select, textarea, input { border: 1px solid #ccc !important; }
        }
      `}</style>
      <div style={{ minHeight: '100vh', background: '#fff', fontFamily: font, color: '#1A1A1A' }}>
        {/* HEADER */}
        <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '16px 24px' }}>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>
            <a href="/work-orders" style={{ color: '#1D6FE8', textDecoration: 'none' }}>Work Orders</a>
            <span style={{ margin: '0 6px' }}>/</span>
            <span>{wo.so_number || `WO-${id.slice(0, 8)}`}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                <span style={{ fontSize: 20, fontWeight: 800 }}>{wo.so_number || `WO-${id.slice(0, 8)}`}</span>
                {customer.company_name && (
                  <a href={`/customers/${customer.id || wo.customer_id}`} style={{ color: '#1D6FE8', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
                    {customer.company_name}
                  </a>
                )}
                <span style={{ background: '#FEF2F2', color: '#DC2626', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 100 }}>COD</span>
              </div>
              {wo.createdByName && (
                <div style={{ fontSize: 12, color: '#6B7280' }}>Opened by: <strong style={{ color: '#374151' }}>{wo.createdByName}</strong></div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              {asset.unit_number && (
                <a href={`/fleet/${asset.id || wo.asset_id}`} style={{ color: '#1D6FE8', textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>
                  Unit {asset.unit_number}
                </a>
              )}
              <div style={{ fontSize: 12, color: '#6B7280' }}>
                {[asset.year, asset.make, asset.model].filter(Boolean).join(' ')}
              </div>
              {vin && (
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                  VIN: {vinLast6}<span style={{ fontWeight: 800 }}>{vinBold}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* TAB BAR */}
        <div data-no-print className="tab-bar" style={{ display: 'flex', gap: 0, borderBottom: '1px solid #E5E7EB', background: '#fff', paddingLeft: 24 }}>
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setActiveTab(i)}
              style={{
                padding: '12px 20px',
                fontSize: 13,
                fontWeight: activeTab === i ? 700 : 500,
                color: activeTab === i ? '#1D6FE8' : '#6B7280',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === i ? '2px solid #1D6FE8' : '2px solid transparent',
                cursor: 'pointer',
                fontFamily: font,
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* QUICK ACTIONS BAR */}
        <div data-no-print className="quick-actions" style={{ display: 'flex', gap: 8, padding: '12px 24px', borderBottom: '1px solid #E5E7EB', position: 'relative' }}>
          {quickIcons.map((Icon, i) => (
            <button
              key={i}
              onClick={() => quickAction(i)}
              style={{
                width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#F3F4F6',
                border: '1px solid #E5E7EB',
                borderRadius: 6,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <Icon size={16} color="#6B7280" />
            </button>
          ))}
          {/* Menu dropdown anchored to last button */}
          <div style={{ position: 'relative' }}>
            {showMenu && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowMenu(false)} />
                <div style={{ position: 'absolute', right: 0, top: 36, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.12)', zIndex: 50, overflow: 'hidden', minWidth: 150 }}>
                  <button onClick={() => { setShowMenu(false); window.print() }} style={{ display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: 13, color: '#374151', cursor: 'pointer', fontFamily: font }}>Print WO</button>
                  <button onClick={() => { setShowMenu(false); deleteWO() }} style={{ display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: 13, color: '#DC2626', cursor: 'pointer', fontFamily: font, borderTop: '1px solid #F3F4F6' }}>Delete WO</button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* TAB CONTENT */}
        <div style={{ padding: 24 }}>
          {activeTab === 0 && renderOverview()}
          {activeTab === 1 && renderParts()}
          {activeTab === 2 && renderBilling()}
          {activeTab === 3 && renderFilesNotes()}
          {activeTab === 4 && renderActivity()}
        </div>

        {/* FOOTER */}
        <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 11, color: '#9CA3AF' }}>
          Powered by TruckZen
        </div>
      </div>

      {/* Team Assign Modal */}
      {showTeamModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowTeamModal(false) }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 8px 32px rgba(0,0,0,.15)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A', marginBottom: 16 }}>Team & Contacts</div>
            {[
              { label: 'Service Writer', key: 'writer', filter: (u: any) => ['owner', 'gm', 'service_writer', 'office_admin', 'shop_manager'].includes(u.role) },
              { label: 'Lead Technician', key: 'tech', filter: (u: any) => ['technician', 'maintenance_technician', 'shop_manager'].includes(u.role) },
              { label: 'Parts Person', key: 'parts', filter: (u: any) => ['parts_manager', 'owner', 'gm', 'office_admin'].includes(u.role) },
            ].map(field => (
              <div key={field.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{field.label}</label>
                <select value={(teamAssign as any)[field.key] || ''} onChange={e => setTeamAssign({ ...teamAssign, [field.key]: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, fontFamily: font }}>
                  <option value="">Unassigned</option>
                  {allUsers.filter(field.filter).map((u: any) => (
                    <option key={u.id} value={u.id}>{u.full_name} ({u.role?.replace(/_/g, ' ')})</option>
                  ))}
                </select>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setShowTeamModal(false)} style={{ padding: '8px 18px', background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>Cancel</button>
              <button onClick={saveTeamAssign} style={{ padding: '8px 18px', background: '#1D6FE8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Mechanics Modal */}
      {assignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setAssignModal(null) }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 8px 32px rgba(0,0,0,.15)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A', marginBottom: 16 }}>Assign Mechanics to Job {assignModal.lineIdx + 1}</div>

            {assignList.length === 0 && <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 12 }}>No mechanics assigned yet</div>}

            {assignList.map((a, i) => {
              const pctTotal = assignList.reduce((s, x) => s + x.percentage, 0)
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '8px 12px', background: '#F9FAFB', borderRadius: 8 }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{a.name}</span>
                  <input type="number" min={0} max={100} value={a.percentage}
                    onChange={e => { const v = parseInt(e.target.value) || 0; setAssignList(prev => prev.map((x, j) => j === i ? { ...x, percentage: v } : x)) }}
                    style={{ width: 60, padding: '4px 8px', border: '1px solid #D1D5DB', borderRadius: 4, fontSize: 12, textAlign: 'center', fontFamily: 'monospace' }} />
                  <span style={{ fontSize: 12, color: '#6B7280' }}>%</span>
                  <button onClick={() => removeMechFromList(i)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 16, padding: 2 }}>x</button>
                </div>
              )
            })}

            {(() => { const total = assignList.reduce((s, a) => s + a.percentage, 0); return total !== 100 && assignList.length > 0 ? (
              <div style={{ fontSize: 11, color: total > 100 ? '#DC2626' : '#D97706', marginBottom: 8 }}>Total: {total}% — must equal 100%</div>
            ) : null })()}

            <div style={{ marginBottom: 16 }}>
              <select defaultValue=""
                onChange={e => { if (e.target.value) { addMechToList(e.target.value); e.target.value = '' } }}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, fontFamily: font, color: '#6B7280' }}>
                <option value="">+ Add Mechanic...</option>
                {mechanics.filter(m => !assignList.find(a => a.user_id === m.id)).map((m: any) => (
                  <option key={m.id} value={m.id}>{m.full_name}{m.team ? ` (Team ${m.team})` : ''}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setAssignModal(null)} style={{ padding: '8px 18px', background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>Cancel</button>
              <button onClick={saveAssignments}
                disabled={assignList.length > 0 && assignList.reduce((s, a) => s + a.percentage, 0) !== 100}
                style={{ padding: '8px 18px', background: '#1D6FE8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font, opacity: assignList.length > 0 && assignList.reduce((s, a) => s + a.percentage, 0) !== 100 ? 0.5 : 1 }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )

  // ─── TAB 1: OVERVIEW ────────────────────────────────────────────────────────
  function renderOverview() {
    return (
      <div>
        {jobLines.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>No job lines yet.</div>
        )}
        {jobLines.map((line: any, idx: number) => {
          const status = line.line_status || line.status || 'unassigned'
          const color = STATUS_COLORS[status] || '#6B7280'
          const lineAssigns = jobAssignments.filter((a: any) => a.line_id === line.id)
          const assignDisplay = lineAssigns.length > 0
            ? lineAssigns.map((a: any) => `${a.users?.full_name || 'Unknown'}${lineAssigns.length > 1 ? ` (${a.percentage}%)` : ''}`).join(', ')
            : null

          return (
            <div
              key={line.id}
              style={{
                background: '#fff',
                border: '1px solid #E5E7EB',
                borderLeft: `3px solid ${color}`,
                borderRadius: 8,
                padding: 16,
                marginBottom: 12,
              }}
            >
              {/* Header row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Job {idx + 1}</span>
                  <select
                    value={status}
                    onChange={async (e) => {
                      const newStatus = e.target.value
                      const updated = { ...wo }
                      const li = updated.so_lines.find((l: any) => l.id === line.id)
                      if (li) li.line_status = newStatus
                      setWo(updated)
                      await patchLine(line.id, { line_status: newStatus })
                    }}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: STATUS_COLORS[status] || '#6B7280',
                      background: '#F9FAFB',
                      border: '1px solid #E5E7EB',
                      borderRadius: 6,
                      padding: '4px 8px',
                      fontFamily: font,
                      cursor: 'pointer',
                    }}
                  >
                    {Object.keys(STATUS_LABELS).map(s => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, background: '#1A1A1A', color: '#fff', padding: '2px 10px', borderRadius: 100 }}>
                  Concern
                </span>
              </div>

              {/* Assignment + Hours row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  {assignDisplay ? (
                    <span style={{ fontSize: 13, fontWeight: 700, cursor: 'pointer' }} onClick={() => openAssignModal(line.id, idx)}>
                      Assigned: {assignDisplay}
                    </span>
                  ) : (
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#DC2626', cursor: 'pointer' }} onClick={() => openAssignModal(line.id, idx)}>
                      Assign
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#6B7280' }}>
                  <span>Est: <strong>{line.estimated_hours ?? '—'}</strong></span>
                  <span>Actual: <strong>{line.actual_hours ?? '—'}</strong></span>
                  <span>Billed: <strong>{line.billed_hours ?? '—'}</strong></span>
                </div>
              </div>

              {/* Concern */}
              {line.description && (
                <div style={{ background: '#F9FAFB', padding: 10, borderRadius: 6, fontSize: 13, color: '#6B7280', marginBottom: 10 }}>
                  {line.description}
                </div>
              )}

              {/* Finding */}
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Finding</label>
                <textarea
                  defaultValue={line.finding || ''}
                  onBlur={(e) => {
                    if (e.target.value !== (line.finding || '')) {
                      patchLine(line.id, { finding: e.target.value })
                      const updated = { ...wo }
                      const li = updated.so_lines.find((l: any) => l.id === line.id)
                      if (li) li.finding = e.target.value
                      setWo(updated)
                    }
                  }}
                  rows={2}
                  style={{
                    width: '100%', fontSize: 13, fontFamily: font, padding: 10, border: '1px solid #E5E7EB',
                    borderRadius: 6, resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Resolution */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Resolution</label>
                <textarea
                  defaultValue={line.resolution || ''}
                  onBlur={(e) => {
                    if (e.target.value !== (line.resolution || '')) {
                      patchLine(line.id, { resolution: e.target.value })
                      const updated = { ...wo }
                      const li = updated.so_lines.find((l: any) => l.id === line.id)
                      if (li) li.resolution = e.target.value
                      setWo(updated)
                    }
                  }}
                  rows={2}
                  style={{
                    width: '100%', fontSize: 13, fontFamily: font, padding: 10, border: '1px solid #E5E7EB',
                    borderRadius: 6, resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Bottom buttons */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setActiveTab(1)}
                  style={{
                    fontSize: 12, fontWeight: 600, color: '#1D6FE8', background: '#EFF6FF',
                    border: '1px solid #BFDBFE', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontFamily: font,
                  }}
                >
                  Add Parts
                </button>
                <button
                  onClick={() => {
                    const hrs = prompt('Enter hours worked:', String(line.actual_hours || 0))
                    if (hrs !== null) {
                      const v = parseFloat(hrs) || 0
                      patchLine(line.id, { actual_hours: v })
                      const updated = { ...wo }; const li = updated.so_lines.find((l: any) => l.id === line.id); if (li) li.actual_hours = v; setWo(updated)
                    }
                  }}
                  style={{
                    fontSize: 12, fontWeight: 600, color: '#1D6FE8', background: '#EFF6FF',
                    border: '1px solid #BFDBFE', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontFamily: font,
                  }}
                >
                  Log Hours
                </button>
                <span
                  onClick={() => removeLine(line.id)}
                  style={{ fontSize: 12, fontWeight: 600, color: '#DC2626', cursor: 'pointer', marginLeft: 'auto' }}
                >
                  Remove Job
                </span>
                {savingLine === line.id && (
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>Saving...</span>
                )}
              </div>
            </div>
          )
        })}

        {/* Bottom actions */}
        <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
          <button
            onClick={async () => {
              await fetch('/api/so-lines', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ so_id: wo.id, line_type: 'labor', description: 'New job line', line_status: 'unassigned' }),
              })
              await loadData()
            }}
            style={{
              padding: '10px 20px', background: '#1D6FE8', color: '#fff', border: 'none',
              borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Plus size={14} /> Add Job Line
          </button>
          <button
            onClick={async () => {
              await fetch('/api/wo-charges', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wo_id: wo.id, description: 'Shop charge', amount: 0 }),
              })
              await loadData()
            }}
            style={{
              padding: '10px 20px', background: '#fff', color: '#1D6FE8', border: '1px solid #1D6FE8',
              borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Plus size={14} /> Add Shop Charge
          </button>
          <button
            onClick={() => alert('Approval request sent')}
            style={{
              padding: '10px 20px', background: '#16A34A', color: '#fff', border: 'none',
              borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font,
            }}
          >
            Get Approval
          </button>
        </div>
      </div>
    )
  }

  // ─── TAB 2: PARTS & MATERIALS ───────────────────────────────────────────────
  function renderParts() {
    // Group parts by their parent job line
    const jobLineIds = jobLines.map((l: any) => l.id)

    return (
      <div>
        {jobLines.map((job: any, idx: number) => {
          const jobParts = partLines.filter((p: any) => p.parent_line_id === job.id)
          return (
            <div key={job.id} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
                Job {idx + 1}: {(job.description || '').slice(0, 60) || '(no description)'}
              </div>
              {jobParts.length === 0 ? (
                <div style={{ fontSize: 12, color: '#9CA3AF', padding: 12 }}>No parts for this job</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                      {['Part #', 'Description', 'Qty', 'Unit Cost', 'Total'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {jobParts.map((p: any) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '8px 12px' }}>{p.part_number || '—'}</td>
                        <td style={{ padding: '8px 12px' }}>{p.description || '—'}</td>
                        <td style={{ padding: '8px 12px' }}>{p.quantity ?? 0}</td>
                        <td style={{ padding: '8px 12px' }}>${parseFloat(p.unit_price || 0).toFixed(2)}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>${(parseFloat(p.quantity || 0) * parseFloat(p.unit_price || 0)).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )
        })}
        {/* Unassigned parts (no parent) */}
        {(() => {
          const unassigned = partLines.filter((p: any) => !p.parent_line_id || !jobLines.find((j: any) => j.id === p.parent_line_id))
          if (unassigned.length === 0) return null
          return (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Other Parts</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                    {['Part #', 'Description', 'Qty', 'Unit Cost', 'Total'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {unassigned.map((p: any) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '8px 12px' }}>{p.part_number || '—'}</td>
                      <td style={{ padding: '8px 12px' }}>{p.description || '—'}</td>
                      <td style={{ padding: '8px 12px' }}>{p.quantity ?? 0}</td>
                      <td style={{ padding: '8px 12px' }}>${parseFloat(p.unit_price || 0).toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>${(parseFloat(p.quantity || 0) * parseFloat(p.unit_price || 0)).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })()}
        <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, padding: '12px 0', borderTop: '1px solid #E5E7EB' }}>
          Total Parts: ${partsTotal.toFixed(2)}
        </div>
      </div>
    )
  }

  // ─── TAB 3: ESTIMATE & BILLING ──────────────────────────────────────────────
  function renderBilling() {
    const inp = { padding: '6px 8px', border: '1px solid #D1D5DB', borderRadius: 4, fontSize: 12, width: 80, fontFamily: 'monospace', textAlign: 'right' as const, outline: 'none' }

    // Recalculate live from current wo state
    const liveLabor = jobLines.reduce((s: number, l: any) => s + (parseFloat(l.billed_hours || 0) * parseFloat(l.labor_rate || shop.labor_rate || 0)), 0)
    const liveParts = partLines.reduce((s: number, l: any) => s + (parseFloat(l.quantity || 0) * parseFloat(l.unit_price || 0)), 0)
    const liveCharges = shopCharges.reduce((s: number, c: any) => s + parseFloat(c.amount || 0), 0)
    const liveTax = liveParts * taxRate / 100
    const liveTotal = liveLabor + liveParts + liveCharges + liveTax

    return (
      <div>
        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Labor', value: liveLabor, color: '#1D6FE8' },
            { label: 'Parts', value: liveParts, color: '#7C3AED' },
            { label: 'Shop Charges', value: liveCharges, color: '#EA580C' },
            { label: `Tax (${taxRate}%)`, value: liveTax, color: '#6B7280' },
            { label: 'Grand Total', value: liveTotal, color: '#059669' },
          ].map(c => (
            <div key={c.label} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: c.color }}>${c.value.toFixed(2)}</div>
            </div>
          ))}
        </div>

        {/* Editable job lines */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Job Lines</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                {['Job', 'Description', 'Hours', 'Rate ($/hr)', 'Labor Total'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobLines.map((l: any, i: number) => (
                <tr key={l.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>Job {i + 1}</td>
                  <td style={{ padding: '8px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(l.description || '').slice(0, 50) || '—'}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <input type="number" step="0.5" min="0" defaultValue={l.billed_hours || 0} style={inp}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        patchLine(l.id, { billed_hours: v })
                        const updated = { ...wo }; const li = updated.so_lines.find((x: any) => x.id === l.id); if (li) li.billed_hours = v; setWo(updated)
                      }} />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <input type="number" step="1" min="0" defaultValue={l.labor_rate || shop.labor_rate || 145} style={inp}
                      onBlur={e => {
                        const v = parseFloat(e.target.value) || 0
                        patchLine(l.id, { labor_rate: v })
                        const updated = { ...wo }; const li = updated.so_lines.find((x: any) => x.id === l.id); if (li) li.labor_rate = v; setWo(updated)
                      }} />
                  </td>
                  <td style={{ padding: '8px 12px', fontWeight: 600, fontFamily: 'monospace' }}>${(parseFloat(l.billed_hours || 0) * parseFloat(l.labor_rate || shop.labor_rate || 0)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Editable parts */}
        {partLines.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Parts</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                  {['Part #', 'Description', 'Qty', 'Unit Cost', 'Total'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {partLines.map((p: any) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{p.part_number || '—'}</td>
                    <td style={{ padding: '8px 12px' }}>{p.description || '—'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <input type="number" min="0" step="1" defaultValue={p.quantity || 0} style={{ ...inp, width: 60 }}
                        onBlur={e => {
                          const v = parseFloat(e.target.value) || 0
                          patchLine(p.id, { quantity: v, total_price: v * parseFloat(p.unit_price || 0) })
                          const updated = { ...wo }; const li = updated.so_lines.find((x: any) => x.id === p.id); if (li) { li.quantity = v; li.total_price = v * parseFloat(li.unit_price || 0) }; setWo(updated)
                        }} />
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <input type="number" min="0" step="0.01" defaultValue={p.unit_price || 0} style={inp}
                        onBlur={e => {
                          const v = parseFloat(e.target.value) || 0
                          patchLine(p.id, { unit_price: v, total_price: parseFloat(p.quantity || 0) * v })
                          const updated = { ...wo }; const li = updated.so_lines.find((x: any) => x.id === p.id); if (li) { li.unit_price = v; li.total_price = parseFloat(li.quantity || 0) * v }; setWo(updated)
                        }} />
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 600, fontFamily: 'monospace' }}>${(parseFloat(p.quantity || 0) * parseFloat(p.unit_price || 0)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Editable shop charges */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Shop Charges</div>
          {shopCharges.length === 0 && <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>No shop charges</div>}
          {shopCharges.map((c: any) => (
            <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #F3F4F6' }}>
              <input defaultValue={c.description || ''} style={{ flex: 1, padding: '6px 8px', border: '1px solid #D1D5DB', borderRadius: 4, fontSize: 12, outline: 'none' }}
                onBlur={async e => { await fetch('/api/wo-charges', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, description: e.target.value }) }) }} />
              <input type="number" step="0.01" defaultValue={c.amount || 0} style={inp}
                onBlur={async e => {
                  const v = parseFloat(e.target.value) || 0
                  await fetch('/api/wo-charges', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, amount: v }) })
                  const updated = { ...wo }; const ch = updated.wo_shop_charges.find((x: any) => x.id === c.id); if (ch) ch.amount = v; setWo(updated)
                }} />
              <button onClick={async () => { await fetch(`/api/wo-charges?id=${c.id}`, { method: 'DELETE' }); await loadData() }} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 14 }}>x</button>
            </div>
          ))}
        </div>

        {/* Tax + Total */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13, color: '#6B7280' }}>
          <span>Tax ({taxRate}% on parts)</span>
          <span>${liveTax.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: 16, fontWeight: 800, borderTop: '2px solid #1A1A1A', marginTop: 8 }}>
          <span>Grand Total</span>
          <span>${liveTotal.toFixed(2)}</span>
        </div>
      </div>
    )
  }

  // ─── TAB 4: FILES & NOTES ───────────────────────────────────────────────────
  function renderFilesNotes() {
    return (
      <div>
        {/* Add Note */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Notes</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <input
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Write a note..."
              onKeyDown={e => { if (e.key === 'Enter') addNote() }}
              style={{
                flex: 1, minWidth: 200, padding: '10px 12px', fontSize: 13, fontFamily: font,
                border: '1px solid #E5E7EB', borderRadius: 6, outline: 'none',
              }}
            />
            <button
              onClick={addNote}
              disabled={addingNote || !noteText.trim()}
              style={{
                padding: '10px 16px', background: '#1D6FE8', color: '#fff', border: 'none',
                borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font,
                opacity: addingNote || !noteText.trim() ? 0.5 : 1,
              }}
            >
              {addingNote ? 'Adding...' : 'Add Note'}
            </button>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B7280', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={noteVisible}
              onChange={e => setNoteVisible(e.target.checked)}
              style={{ accentColor: '#1D6FE8' }}
            />
            Visible to customer
          </label>

          {/* Notes list */}
          <div style={{ marginTop: 16 }}>
            {notes.length === 0 && <div style={{ fontSize: 12, color: '#9CA3AF' }}>No notes yet</div>}
            {notes.map((n: any) => (
              <div key={n.id} style={{ padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{userMap[n.user_id] || 'Unknown'}</span>
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                    {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                  </span>
                  {n.visible_to_customer && (
                    <span style={{ fontSize: 10, background: '#EFF6FF', color: '#1D6FE8', padding: '1px 6px', borderRadius: 100 }}>Customer visible</span>
                  )}
                </div>
                <div style={{ fontSize: 13 }}>{n.note_text || n.text}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Files */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Files</div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={e => uploadFiles(e.target.files)}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingFile}
            style={{
              padding: '10px 16px', background: '#F3F4F6', color: '#1A1A1A', border: '1px solid #E5E7EB',
              borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: font,
              marginBottom: 12,
            }}
          >
            {uploadingFile ? 'Uploading...' : 'Choose Files'}
          </button>

          {files.length === 0 && <div style={{ fontSize: 12, color: '#9CA3AF' }}>No files uploaded</div>}
          {files.map((f: any) => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
              <Paperclip size={14} color="#6B7280" />
              <a
                href={f.url || f.file_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 13, color: '#1D6FE8', textDecoration: 'none' }}
              >
                {f.filename || f.file_name || 'File'}
              </a>
              <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                {f.created_at ? new Date(f.created_at).toLocaleString() : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ─── TAB 5: ACTIVITY ────────────────────────────────────────────────────────
  function renderActivity() {
    return (
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Activity Log</div>
        {activity.length === 0 && <div style={{ fontSize: 12, color: '#9CA3AF' }}>No activity recorded</div>}
        {activity.map((a: any, i: number) => (
          <div key={a.id || i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
            <div style={{ minWidth: 140, fontSize: 11, color: '#9CA3AF' }}>
              {a.created_at ? new Date(a.created_at).toLocaleString() : ''}
            </div>
            <div>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{userMap[a.user_id] || 'System'}</span>
              <span style={{ fontSize: 13, marginLeft: 6 }}>{a.action || a.description || ''}</span>
            </div>
          </div>
        ))}
      </div>
    )
  }
}
