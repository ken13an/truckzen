'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { Truck, Calendar, User, MessageSquare, Paperclip, Clock, DollarSign, Plus, Copy, Trash2, Wrench, CheckCircle2, Circle, ArrowRight } from 'lucide-react'

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  draft:                  { label: 'Draft',              color: '#7C8BA0' },
  not_started:            { label: 'Not Started',        color: '#7C8BA0' },
  not_approved:           { label: 'Not Approved',       color: '#D4882A' },
  waiting_approval:       { label: 'Under Review',       color: '#D4882A' },
  in_progress:            { label: 'Repair In Progress', color: '#1D6FE8' },
  waiting_parts:          { label: 'Waiting Parts',      color: '#E8692A' },
  authorized:             { label: 'Pre-Authorized',     color: '#1DB870' },
  done:                   { label: 'Done',               color: '#1DB870' },
  ready_final_inspection: { label: 'Ready Inspection',   color: '#8B5CF6' },
  good_to_go:             { label: 'Good to Go',         color: '#1DB870' },
  completed:              { label: 'Completed',          color: '#1DB870' },
  invoiced:               { label: 'Invoiced',           color: '#4D9EFF' },
  closed:                 { label: 'Closed',             color: '#7C8BA0' },
  void:                   { label: 'Void',               color: '#D94F4F' },
}

const WORKFLOW_STEPS = ['Assign', 'Diagnose', 'Authorize', 'Repair', 'Invoice']
const PARTS_STEPS = ['Quote', 'Order', 'Receive']

export default function SODetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState<any>(null)
  const [so, setSO] = useState<any>(null)
  const [lines, setLines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('action_items')
  const [mileage, setMileage] = useState('')

  // AI Writer state
  const [editCause, setEditCause] = useState('')
  const [editCorr, setEditCorr] = useState('')

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { router.push('/login'); return }
      setUser(profile)

      // Fetch SO via API route (uses service role key — bypasses RLS)
      const res = await fetch(`/api/service-orders/${params.id}?shop_id=${profile.shop_id}`)
      if (!res.ok) {
        console.error('[SO Detail] API returned', res.status)
        router.push('/orders')
        return
      }

      const soData = await res.json()
      setSO(soData)
      setLines(soData.so_lines || [])
      setEditCause(soData.cause || '')
      setEditCorr(soData.correction || '')
      if (soData.assets?.odometer) setMileage(String(soData.assets.odometer))
      setLoading(false)
    }
    load()
  }, [params.id])

  async function updateStatus(newStatus: string) {
    setSaving(true)
    await fetch(`/api/service-orders/${so.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setSO((s: any) => ({ ...s, status: newStatus }))
    setSaving(false)
  }

  async function saveCauseCorrection() {
    setSaving(true)
    await fetch(`/api/service-orders/${so.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cause: editCause, correction: editCorr }),
    })
    setSO((s: any) => ({ ...s, cause: editCause, correction: editCorr }))
    setSaving(false)
  }

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F5F7', fontFamily: "'Instrument Sans',sans-serif", color: '#7C8BA0' }}>Loading...</div>
  if (!so) return null

  const asset = so.assets
  const cust = so.customers
  const stCfg = STATUS_CFG[so.status] || { label: so.status, color: '#7C8BA0' }

  const laborLines = lines.filter((l: any) => l.line_type === 'labor')
  const partLines = lines.filter((l: any) => l.line_type === 'part')
  const laborTotal = laborLines.reduce((s: number, l: any) => s + (l.total_price || 0), 0)
  const partsTotal = partLines.reduce((s: number, l: any) => s + (l.total_price || 0), 0)

  // VIN with bold last 6
  const vinDisplay = asset?.vin ? (
    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#666' }}>
      {asset.vin.slice(0, -6)}<strong style={{ color: '#1A1A1A' }}>{asset.vin.slice(-6)}</strong>
    </span>
  ) : null

  // Determine workflow step based on status
  const workflowStep = so.status === 'draft' || so.status === 'not_started' ? 0
    : so.status === 'not_approved' || so.status === 'waiting_approval' ? 2
    : so.status === 'authorized' ? 3
    : so.status === 'in_progress' || so.status === 'waiting_parts' ? 3
    : so.status === 'done' || so.status === 'good_to_go' || so.status === 'completed' ? 4
    : so.status === 'invoiced' || so.status === 'closed' ? 5 : 1

  const tabs = [
    { key: 'action_items', label: 'Action Items' },
    { key: 'parts', label: 'Parts List' },
    { key: 'estimate', label: 'Estimate' },
    { key: 'edit', label: 'Edit' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#F4F5F7', fontFamily: "'Instrument Sans', -apple-system, sans-serif" }}>
      {/* HEADER */}
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid #E5E7EB', padding: '16px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          {/* Left: SO number + customer */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <a href="/orders" style={{ fontSize: 12, color: '#7C8BA0', textDecoration: 'none' }}>Orders</a>
              <span style={{ color: '#D1D5DB' }}>/</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#1A1A1A' }}>{so.so_number}</span>
              <span style={{ padding: '2px 10px', borderRadius: 100, fontSize: 10, fontWeight: 700, background: stCfg.color + '18', color: stCfg.color, border: `1px solid ${stCfg.color}33` }}>
                {stCfg.label}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {cust && <a href={`/customers/${cust.id}`} style={{ fontSize: 13, color: '#1D6FE8', textDecoration: 'none', fontWeight: 600 }}>{cust.company_name}</a>}
              <span style={{ padding: '1px 8px', borderRadius: 100, fontSize: 9, fontWeight: 700, background: '#FEE2E2', color: '#DC2626' }}>COD</span>
            </div>
          </div>

          {/* Right: Unit info */}
          <div style={{ textAlign: 'right' }}>
            {asset && (
              <>
                <a href={`/fleet/${asset.id}`} style={{ fontSize: 14, fontWeight: 700, color: '#1D6FE8', textDecoration: 'none' }}>Unit {asset.unit_number}</a>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{asset.year} {asset.make} {asset.model}</div>
                {vinDisplay && <div style={{ marginTop: 2 }}>{vinDisplay}</div>}
              </>
            )}
          </div>
        </div>
      </div>

      {/* TAB BAR */}
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid #E5E7EB', padding: '0 24px', display: 'flex', gap: 0 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{ padding: '10px 20px', fontSize: 13, fontWeight: activeTab === t.key ? 700 : 500, color: activeTab === t.key ? '#1A1A1A' : '#6B7280', background: activeTab === t.key ? '#F3F4F6' : 'transparent', border: 'none', borderBottom: activeTab === t.key ? '2px solid #1D6FE8' : '2px solid transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* TOOLBAR */}
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid #E5E7EB', padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {[Truck, Calendar, User, MessageSquare, Paperclip, Clock, DollarSign].map((Icon, i) => (
            <button key={i} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 6, cursor: 'pointer' }}>
              <Icon size={14} strokeWidth={1.5} color="#6B7280" />
            </button>
          ))}
          <span style={{ width: 1, height: 20, background: '#E5E7EB', margin: '0 6px' }} />
          <button style={{ padding: '5px 12px', background: '#FEE2E2', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, color: '#DC2626', cursor: 'pointer', fontFamily: 'inherit' }}>Delete SO</button>
          <button style={{ padding: '5px 12px', background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 11, fontWeight: 600, color: '#374151', cursor: 'pointer', fontFamily: 'inherit' }}>Duplicate SO</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#6B7280' }}>Chassis (Miles)</span>
          <input value={mileage} onChange={e => setMileage(e.target.value)} style={{ width: 100, padding: '4px 8px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, fontFamily: 'monospace', color: '#1A1A1A' }} />
          {asset?.odometer && <span style={{ fontSize: 10, color: '#9CA3AF' }}>Last: {asset.odometer.toLocaleString()}</span>}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ padding: 24 }}>

        {/* ACTION ITEMS TAB */}
        {activeTab === 'action_items' && (
          <div>
            {/* Action item cards from complaint / so_lines */}
            {so.complaint && (
              <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderLeft: `3px solid ${stCfg.color}`, borderRadius: 8, padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>Action Item 1</span>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: stCfg.color + '18', color: stCfg.color }}>{stCfg.label}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: partLines.length > 0 ? '#1DB870' : '#9CA3AF' }}>
                        <Circle size={8} strokeWidth={2} /> {partLines.length > 0 ? 'Parts Received' : 'No Parts'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: so.assigned_tech ? '#1A1A1A' : '#DC2626', marginTop: 4 }}>
                      {so.assigned_tech ? <><strong>Assigned:</strong> {(so.users as any)?.full_name || 'Tech'}</> : 'No tech assigned'}
                    </div>
                  </div>
                  <span style={{ padding: '4px 12px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: '#1A1A1A', color: '#FFFFFF' }}>Complaint</span>
                </div>

                {/* Hours table */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                  <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '2px 12px', color: '#9CA3AF', fontWeight: 500, textAlign: 'left' }}></th>
                        <th style={{ padding: '2px 12px', color: '#9CA3AF', fontWeight: 500 }}>Hours</th>
                        <th style={{ padding: '2px 12px', color: '#9CA3AF', fontWeight: 500 }}>Diff w/ Actual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Invoiced', val: laborLines.reduce((s: number, l: any) => s + (l.quantity || 0), 0) },
                        { label: 'Actual', val: 0 },
                        { label: 'Expected', val: laborLines.reduce((s: number, l: any) => s + (l.quantity || 0), 0) },
                      ].map(r => (
                        <tr key={r.label}>
                          <td style={{ padding: '2px 12px', color: '#6B7280' }}>{r.label}</td>
                          <td style={{ padding: '2px 12px', fontFamily: 'monospace', fontWeight: 600, textAlign: 'center', color: '#1A1A1A' }}>{r.val.toFixed(1)}</td>
                          <td style={{ padding: '2px 12px', fontFamily: 'monospace', textAlign: 'center', color: r.val >= 0 ? '#1DB870' : '#DC2626' }}>{r.val.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Complaint text */}
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', textTransform: 'uppercase', lineHeight: 1.6, padding: '8px 0', borderTop: '1px solid #F3F4F6' }}>
                  {so.complaint}
                </div>

                {/* Cause/Correction if exists */}
                {(so.cause || so.correction) && (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: '#F9FAFB', borderRadius: 6, fontSize: 12, color: '#374151', lineHeight: 1.5 }}>
                    {so.cause && <div><strong>Cause:</strong> {so.cause}</div>}
                    {so.correction && <div style={{ marginTop: 4 }}><strong>Correction:</strong> {so.correction}</div>}
                  </div>
                )}
              </div>
            )}

            {/* Additional action items from lines */}
            {laborLines.map((line: any, i: number) => (
              <div key={line.id} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderLeft: '3px solid #1D6FE8', borderRadius: 8, padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>Action Item {i + 2}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: 'rgba(29,111,232,.12)', color: '#1D6FE8' }}>Labor</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', textTransform: 'uppercase' }}>{line.description}</div>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4, fontFamily: 'monospace' }}>{line.quantity} hrs x ${(line.unit_price || 0).toFixed(2)} = ${(line.total_price || 0).toFixed(2)}</div>
              </div>
            ))}

            {/* SERVICE WORKFLOW DIAGRAM */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, padding: 20, marginTop: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>Service</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 16, flexWrap: 'wrap' }}>
                {WORKFLOW_STEPS.map((step, i) => (
                  <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      {i < workflowStep ? (
                        <CheckCircle2 size={24} strokeWidth={2} color="#1DB870" fill="#1DB870" style={{ color: '#fff' }} />
                      ) : i === workflowStep ? (
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#1D6FE8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Wrench size={12} color="#fff" strokeWidth={2} />
                        </div>
                      ) : (
                        <Circle size={24} strokeWidth={1.5} color="#D1D5DB" />
                      )}
                      <span style={{ fontSize: 10, fontWeight: 600, color: i <= workflowStep ? '#1A1A1A' : '#9CA3AF' }}>{step}</span>
                    </div>
                    {i < WORKFLOW_STEPS.length - 1 && (
                      <div style={{ width: 40, height: 2, background: i < workflowStep ? '#1DB870' : '#E5E7EB', margin: '0 4px', marginBottom: 18 }} />
                    )}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>Parts</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                {PARTS_STEPS.map((step, i) => {
                  const partsStep = partLines.length > 0 ? (so.status === 'waiting_parts' ? 1 : 2) : 0
                  return (
                    <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        {i < partsStep ? (
                          <CheckCircle2 size={24} strokeWidth={2} color="#1DB870" fill="#1DB870" />
                        ) : (
                          <Circle size={24} strokeWidth={1.5} color="#D1D5DB" />
                        )}
                        <span style={{ fontSize: 10, fontWeight: 600, color: i < partsStep ? '#1A1A1A' : '#9CA3AF' }}>{step}</span>
                      </div>
                      {i < PARTS_STEPS.length - 1 && (
                        <div style={{ width: 40, height: 2, background: i < partsStep ? '#1DB870' : '#E5E7EB', margin: '0 4px', marginBottom: 18 }} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* BOTTOM BUTTONS */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button style={{ padding: '10px 20px', background: '#1DB870', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={14} strokeWidth={2} /> Add Action Item
              </button>
              <button style={{ padding: '10px 20px', background: '#1D6FE8', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                <DollarSign size={14} strokeWidth={2} /> Add Misc Charge
              </button>
              <button style={{ padding: '10px 20px', background: '#059669', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                Capture Signature
              </button>
            </div>
          </div>
        )}

        {/* PARTS LIST TAB */}
        {activeTab === 'parts' && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', marginBottom: 12 }}>Parts List</div>
            {partLines.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: '#9CA3AF', fontSize: 13 }}>No parts added yet</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                    {['Part #', 'Description', 'Qty', 'Unit Price', 'Total'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {partLines.map((l: any) => (
                    <tr key={l.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 12, color: '#1D6FE8' }}>{l.part_number || '—'}</td>
                      <td style={{ padding: '8px 10px', fontSize: 12, color: '#1A1A1A' }}>{l.description}</td>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 12, textAlign: 'center' }}>{l.quantity}</td>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 12 }}>${(l.unit_price || 0).toFixed(2)}</td>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>${(l.total_price || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ textAlign: 'right', marginTop: 12, fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>Parts Total: ${partsTotal.toFixed(2)}</div>
          </div>
        )}

        {/* ESTIMATE TAB */}
        {activeTab === 'estimate' && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', marginBottom: 12 }}>Estimate Summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div style={{ padding: 16, background: '#F9FAFB', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>Labor</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1D6FE8', fontFamily: 'monospace' }}>${laborTotal.toFixed(2)}</div>
              </div>
              <div style={{ padding: 16, background: '#F9FAFB', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>Parts</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1DB870', fontFamily: 'monospace' }}>${partsTotal.toFixed(2)}</div>
              </div>
              <div style={{ padding: 16, background: '#F9FAFB', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>Total</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1A1A1A', fontFamily: 'monospace' }}>${(so.grand_total || laborTotal + partsTotal).toFixed(2)}</div>
              </div>
            </div>
          </div>
        )}

        {/* EDIT TAB */}
        {activeTab === 'edit' && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', marginBottom: 16 }}>Edit Service Order</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Status</label>
                <select value={so.status} onChange={e => updateStatus(e.target.value)} disabled={saving}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, color: '#1A1A1A', fontFamily: 'inherit' }}>
                  {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Priority</label>
                <select value={so.priority || 'normal'} style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, color: '#1A1A1A', fontFamily: 'inherit' }}>
                  {['low', 'normal', 'high', 'critical'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Cause</label>
              <textarea value={editCause} onChange={e => setEditCause(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, minHeight: 80, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} placeholder="Technical diagnosis..." />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Correction</label>
              <textarea value={editCorr} onChange={e => setEditCorr(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, minHeight: 80, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} placeholder="Repair procedure..." />
            </div>
            <button onClick={saveCauseCorrection} disabled={saving}
              style={{ padding: '10px 24px', background: '#1D6FE8', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div style={{ textAlign: 'center', padding: '16px 24px', fontSize: 10, color: '#9CA3AF' }}>
        Powered by TruckZen
      </div>
    </div>
  )
}
