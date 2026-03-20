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
    if (woRes.ok) setWo(await woRes.json())
    if (mechRes.ok) setMechanics(await mechRes.json())
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

  async function assignTech(lineId: string, userId: string) {
    setAssigningLine(null)
    await fetch('/api/wo-assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ so_line_id: lineId, user_id: userId, wo_id: wo.id }),
    })
    await loadData()
  }

  async function addNote() {
    if (!noteText.trim() || !wo) return
    setAddingNote(true)
    await fetch('/api/wo-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wo_id: wo.id, text: noteText, visible_to_customer: noteVisible, user_id: user?.id }),
    })
    setNoteText('')
    setNoteVisible(false)
    setAddingNote(false)
    await loadData()
  }

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0 || !wo) return
    setUploadingFile(true)
    for (let i = 0; i < files.length; i++) {
      const form = new FormData()
      form.append('file', files[i])
      form.append('wo_id', wo.id)
      form.append('user_id', user?.id || '')
      await fetch('/api/wo-files', { method: 'POST', body: form })
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

  function quickAction(idx: number) {
    // 0=Truck, 1=Calendar, 2=Users, 3=MessageSquare(Notes), 4=Paperclip(Files), 5=Clock, 6=DollarSign(Billing), 7=MoreHorizontal(Activity)
    if (idx === 3 || idx === 4) setActiveTab(3) // Files & Notes
    if (idx === 7) setActiveTab(4) // Activity
    if (idx === 6) setActiveTab(2) // Estimate & Billing
  }

  const quickIcons = [Truck, Calendar, Users, MessageSquare, Paperclip, Clock, DollarSign, MoreHorizontal]

  return (
    <>
      <style>{`
        @media print {
          .sidebar, aside, nav { display: none !important; }
          .tab-bar, .quick-actions, .no-print { display: none !important; }
          body { background: #fff !important; }
          * { color: #1A1A1A !important; }
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
                {wo.payment_type === 'cod' && (
                  <span style={{ background: '#FEF2F2', color: '#DC2626', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 100 }}>COD</span>
                )}
              </div>
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
        <div className="tab-bar" style={{ display: 'flex', gap: 0, borderBottom: '1px solid #E5E7EB', background: '#fff', paddingLeft: 24 }}>
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
        <div className="quick-actions" style={{ display: 'flex', gap: 8, padding: '12px 24px', borderBottom: '1px solid #E5E7EB' }}>
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
          const status = line.status || 'unassigned'
          const color = STATUS_COLORS[status] || '#6B7280'
          const assignedName = line.assigned_to && techMap[line.assigned_to] ? techMap[line.assigned_to] : null

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
                      if (li) li.status = newStatus
                      setWo(updated)
                      await patchLine(line.id, { status: newStatus })
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
                <div style={{ position: 'relative' }}>
                  {assignedName ? (
                    <span
                      style={{ fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                      onClick={() => setAssigningLine(assigningLine === line.id ? null : line.id)}
                    >
                      Assigned: {assignedName}
                    </span>
                  ) : (
                    <span
                      style={{ fontSize: 13, fontWeight: 700, color: '#DC2626', cursor: 'pointer' }}
                      onClick={() => setAssigningLine(assigningLine === line.id ? null : line.id)}
                    >
                      Assign
                    </span>
                  )}
                  {assigningLine === line.id && (
                    <div style={{
                      position: 'absolute', top: 24, left: 0, background: '#fff',
                      border: '1px solid #E5E7EB', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      zIndex: 50, minWidth: 200, padding: 4,
                    }}>
                      {mechanics.length === 0 && (
                        <div style={{ padding: 12, fontSize: 12, color: '#9CA3AF' }}>No technicians found</div>
                      )}
                      {mechanics.map((m: any) => (
                        <div
                          key={m.id}
                          onClick={() => assignTech(line.id, m.id)}
                          style={{
                            padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 4,
                            fontWeight: line.assigned_to === m.id ? 700 : 400,
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          {m.full_name || m.email}
                        </div>
                      ))}
                    </div>
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
                  onClick={() => {/* Could open a hours logging modal */ }}
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
                body: JSON.stringify({ wo_id: wo.id, so_id: wo.id, line_type: 'job', description: '', status: 'unassigned' }),
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
              await fetch('/api/wo-shop-charges', {
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
    return (
      <div>
        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Labor', value: laborTotal, color: '#1D6FE8' },
            { label: 'Parts', value: partsTotal, color: '#7C3AED' },
            { label: 'Shop Charges', value: chargesTotal, color: '#EA580C' },
            { label: `Tax (${taxRate}%)`, value: tax, color: '#6B7280' },
            { label: 'Grand Total', value: grandTotal, color: '#059669' },
          ].map(c => (
            <div key={c.label} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: c.color }}>${c.value.toFixed(2)}</div>
            </div>
          ))}
        </div>

        {/* Job lines breakdown */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Job Lines</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                {['Job', 'Description', 'Hours', 'Rate', 'Labor Total'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobLines.map((l: any, i: number) => (
                <tr key={l.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>Job {i + 1}</td>
                  <td style={{ padding: '8px 12px' }}>{(l.description || '').slice(0, 60) || '—'}</td>
                  <td style={{ padding: '8px 12px' }}>{l.billed_hours ?? l.actual_hours ?? '—'}</td>
                  <td style={{ padding: '8px 12px' }}>${parseFloat(l.labor_rate || 0).toFixed(2)}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>${(parseFloat(l.billed_hours || 0) * parseFloat(l.labor_rate || 0)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Shop charges */}
        {shopCharges.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Shop Charges</div>
            {shopCharges.map((c: any) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F3F4F6', fontSize: 13 }}>
                <span>{c.description || 'Shop charge'}</span>
                <span style={{ fontWeight: 600 }}>${parseFloat(c.amount || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Tax line */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13, color: '#6B7280' }}>
          <span>Tax ({taxRate}% on parts)</span>
          <span>${tax.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: 16, fontWeight: 800, borderTop: '2px solid #1A1A1A', marginTop: 8 }}>
          <span>Grand Total</span>
          <span>${grandTotal.toFixed(2)}</span>
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
                <div style={{ fontSize: 13 }}>{n.text}</div>
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
                {f.file_name || f.name || 'File'}
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
