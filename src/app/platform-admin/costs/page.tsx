'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { X, Plus, ExternalLink, GripVertical, Trash2 } from 'lucide-react'

const CATEGORIES: Record<string, { label: string; color: string }> = {
  hosting: { label: 'Hosting', color: '#1D6FE8' },
  database: { label: 'Database', color: '#8B5CF6' },
  email: { label: 'Email', color: '#22C55E' },
  sms: { label: 'SMS', color: '#F59E0B' },
  ai: { label: 'AI', color: '#E8692A' },
  proxy: { label: 'Proxy', color: '#0E9F8E' },
  domain: { label: 'Domain', color: '#7C8BA0' },
  mobile: { label: 'Mobile', color: '#D94F4F' },
  api: { label: 'API', color: '#1DB870' },
  other: { label: 'Other', color: '#48536A' },
}

const CAT_BADGE: Record<string, { label: string; color: string }> = {
  feature: { label: 'FEATURE', color: '#1D6FE8' },
  integration: { label: 'INTEGRATION', color: '#8B5CF6' },
  fix: { label: 'FIX', color: '#F59E0B' },
  database: { label: 'DATABASE', color: '#0E9F8E' },
}

const ADDONS = [
  { name: 'Fleetio', desc: 'Fleet module data migration', cost: '$5/mo per vehicle', phase: 'near' },
  { name: 'MOTOR API', desc: 'Standard labor time estimates', cost: 'Usage-based', phase: 'near' },
  { name: 'Stripe', desc: 'Online payments for invoices', cost: '2.9% + $0.30 per txn', phase: 'near' },
  { name: 'QuickBooks Online', desc: 'Accounting sync', cost: 'Free (OAuth)', phase: 'near' },
  { name: 'Sentry', desc: 'Error monitoring (installed, needs DSN)', cost: '$26/mo (Team)', phase: 'growth' },
  { name: 'Twilio Verify', desc: 'Two-factor authentication', cost: '$0.05 per verification', phase: 'growth' },
]

export default function CostsPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [services, setServices] = useState<any[]>([])
  const [progress, setProgress] = useState<any[]>([])
  const [shopUsage, setShopUsage] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editSvc, setEditSvc] = useState<any>(null)
  const [newSvc, setNewSvc] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newItem, setNewItem] = useState('')
  const [newItemCat, setNewItemCat] = useState('feature')
  const [toast, setToast] = useState('')
  const [dragItem, setDragItem] = useState<string | null>(null)

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    getCurrentUser(supabase).then(async (u: any) => {
      if (!u) return
      setUser(u)
      await loadData(u.id)
      setLoading(false)
    })
  }, [])

  async function loadData(userId: string) {
    const res = await fetch(`/api/platform-admin/costs?user_id=${userId}&type=all`)
    if (res.ok) {
      const data = await res.json()
      setServices(data.services || [])
      setProgress(data.progress || [])
      setShopUsage(data.shop_usage || [])
    }
  }

  async function saveSvc(svc: any) {
    if (!user) return
    setSaving(true)
    const isNew = !svc.id
    const { id, created_at, updated_at, ...fields } = svc
    const res = await fetch('/api/platform-admin/costs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, action: isNew ? 'add_service' : 'update_service', id, ...fields }),
    })
    setSaving(false)
    if (res.ok) { flash('Saved'); setEditSvc(null); setNewSvc(false); await loadData(user.id) }
    else flash('Failed to save')
  }

  async function updateProgressStatus(id: string, status: string) {
    if (!user) return
    await fetch('/api/platform-admin/costs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, action: 'update_progress', id, status }),
    })
    setProgress(prev => prev.map(p => p.id === id ? { ...p, status } : p))
  }

  async function addProgressItem() {
    if (!user || !newItem.trim()) return
    const res = await fetch('/api/platform-admin/costs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, action: 'add_progress', title: newItem.trim(), category: newItemCat, status: 'planned' }),
    })
    if (res.ok) {
      const item = await res.json()
      setProgress(prev => [...prev, item])
      setNewItem('')
      flash('Added')
    }
  }

  async function deleteProgressItem(id: string) {
    if (!user || !confirm('Delete this item?')) return
    await fetch('/api/platform-admin/costs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, action: 'delete_progress', id }),
    })
    setProgress(prev => prev.filter(p => p.id !== id))
  }

  function handleDrop(status: string) {
    if (dragItem) { updateProgressStatus(dragItem, status); setDragItem(null) }
  }

  const fmt = (n: number) => '$' + (n || 0).toFixed(2)
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

  // Compute stats
  const fixedCosts = services.filter(s => s.is_active && ['monthly', 'annual'].includes(s.billing_cycle)).reduce((sum, s) => sum + parseFloat(s.monthly_cost || 0), 0)
  const variableCosts = shopUsage.reduce((sum, u) => sum + u.est_cost, 0)
  const totalMonthly = fixedCosts + variableCosts

  const isRenewalSoon = (d: string) => {
    if (!d) return false
    const diff = (new Date(d).getTime() - Date.now()) / 86400000
    return diff > 0 && diff <= 30
  }

  if (loading) return <div style={{ color: '#7C8BA0', fontSize: 13, padding: 40 }}>Loading...</div>

  const svcForm = editSvc || (newSvc ? editSvc : null)
  function openNewSvc() {
    setEditSvc({ name: '', category: 'other', provider: '', monthly_cost: 0, billing_cycle: 'monthly', start_date: '', renewal_date: '', dashboard_url: '', notes: '', is_active: true, auto_renews: true })
    setNewSvc(true)
  }
  function closeModal() { setEditSvc(null); setNewSvc(false) }

  return (
    <div>
      {toast && <div style={{ position: 'fixed', top: 20, right: 20, background: '#1D6FE8', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 9999 }}>{toast}</div>}

      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F0F4FF', margin: '0 0 24px' }}>Costs & Services</h1>

      {/* ═══ Section 1: Stats ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Monthly Fixed Costs', value: fmt(fixedCosts), color: '#1D6FE8' },
          { label: 'Variable Costs (This Month)', value: fmt(variableCosts), color: '#F59E0B' },
          { label: 'Total Monthly Spend', value: fmt(totalMonthly), color: '#22C55E' },
        ].map(c => (
          <div key={c.label} style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '20px 18px' }}>
            <div style={{ fontSize: 10, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: "'IBM Plex Mono', monospace", marginBottom: 8 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* ═══ Section 2: Subscriptions ═══ */}
      <div style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 20, marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#F0F4FF', margin: 0 }}>Subscriptions & Services</h2>
          <button onClick={openNewSvc} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', background: 'rgba(29,111,232,.12)', color: '#4D9EFF', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Plus size={12} /> Add Service
          </button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Service', 'Provider', 'Category', 'Monthly Cost', 'Billing', 'Start', 'Renewal', 'Dashboard', 'Status', ''].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 8px', fontSize: 9, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: "'IBM Plex Mono', monospace", borderBottom: '1px solid rgba(255,255,255,.06)', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {services.map(svc => {
              const cat = CATEGORIES[svc.category] || CATEGORIES.other
              return (
                <tr key={svc.id}>
                  <td style={td}><span style={{ fontWeight: 600, color: '#F0F4FF' }}>{svc.name}</span></td>
                  <td style={td}>{svc.provider}</td>
                  <td style={td}><span style={{ fontSize: 9, fontWeight: 600, color: cat.color, background: `${cat.color}1a`, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>{cat.label}</span></td>
                  <td style={td}>{svc.billing_cycle === 'usage_based' ? <span style={{ color: '#48536A' }}>{fmt(0)} (usage)</span> : <span style={{ fontWeight: 700, color: '#F0F4FF' }}>{fmt(svc.monthly_cost)}</span>}</td>
                  <td style={{ ...td, fontSize: 11 }}>{svc.billing_cycle.replace('_', ' ')}</td>
                  <td style={{ ...td, fontSize: 11 }}>{fmtDate(svc.start_date)}</td>
                  <td style={td}>
                    {svc.renewal_date ? (
                      <span style={{ fontSize: 11, fontWeight: isRenewalSoon(svc.renewal_date) ? 700 : 400, color: isRenewalSoon(svc.renewal_date) ? '#D94F4F' : '#7C8BA0', background: isRenewalSoon(svc.renewal_date) ? 'rgba(217,79,79,.12)' : 'transparent', padding: isRenewalSoon(svc.renewal_date) ? '2px 6px' : 0, borderRadius: 4 }}>
                        {fmtDate(svc.renewal_date)}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={td}>
                    {svc.dashboard_url && <a href={svc.dashboard_url} target="_blank" rel="noreferrer" style={{ color: '#4D9EFF' }}><ExternalLink size={12} /></a>}
                  </td>
                  <td style={td}>
                    <span style={{ fontSize: 9, fontWeight: 600, color: svc.is_active ? '#22C55E' : '#D94F4F', background: svc.is_active ? 'rgba(34,197,94,.12)' : 'rgba(217,79,79,.12)', padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>{svc.is_active ? 'active' : 'inactive'}</span>
                  </td>
                  <td style={td}>
                    <button onClick={() => setEditSvc({ ...svc })} style={{ background: 'rgba(255,255,255,.06)', color: '#7C8BA0', border: 'none', borderRadius: 4, padding: '3px 8px', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ═══ Section 3: Per-Shop Usage ═══ */}
      <div style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 20, marginBottom: 28 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#F0F4FF', margin: '0 0 14px' }}>Per-Shop Usage This Month</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Shop', 'SMS', 'Calls', 'AI Requests', 'Emails', 'Est. Cost'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 8px', fontSize: 9, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: "'IBM Plex Mono', monospace", borderBottom: '1px solid rgba(255,255,255,.06)', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shopUsage.map(u => (
              <tr key={u.shop_id}>
                <td style={{ ...td, fontWeight: 600, color: '#F0F4FF' }}>{u.shop_name}</td>
                <td style={td}>{u.sms}</td>
                <td style={td}>{u.calls}</td>
                <td style={td}>{u.ai_requests}</td>
                <td style={td}>{u.emails}</td>
                <td style={{ ...td, fontWeight: 700, color: u.est_cost > 0 ? '#F59E0B' : '#48536A' }}>{fmt(u.est_cost)}</td>
              </tr>
            ))}
            {shopUsage.length === 0 && <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: '#48536A' }}>No usage data yet</td></tr>}
          </tbody>
        </table>
      </div>

      {/* ═══ Section 4: Progress Tracker (Kanban) ═══ */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#F0F4FF', margin: 0 }}>Project Progress</h2>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <select value={newItemCat} onChange={e => setNewItemCat(e.target.value)} style={{ padding: '5px 8px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 6, fontSize: 11, color: '#DDE3EE', fontFamily: 'inherit' }}>
              <option value="feature">Feature</option>
              <option value="integration">Integration</option>
              <option value="fix">Fix</option>
              <option value="database">Database</option>
            </select>
            <input value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && addProgressItem()} placeholder="Add new item..." style={{ padding: '5px 10px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 6, fontSize: 11, color: '#DDE3EE', outline: 'none', fontFamily: 'inherit', width: 200 }} />
            <button onClick={addProgressItem} disabled={!newItem.trim()} style={{ padding: '5px 10px', background: newItem.trim() ? '#1D6FE8' : 'rgba(255,255,255,.06)', color: newItem.trim() ? '#fff' : '#48536A', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: newItem.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>
              <Plus size={12} />
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {(['done', 'in_progress', 'planned'] as const).map(status => {
            const items = progress.filter(p => p.status === status)
            const label = status === 'done' ? 'DONE' : status === 'in_progress' ? 'IN PROGRESS' : 'PLANNED'
            const headerColor = status === 'done' ? '#22C55E' : status === 'in_progress' ? '#1D6FE8' : '#7C8BA0'
            return (
              <div key={status}
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(status)}
                style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: 12, minHeight: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: headerColor, letterSpacing: '.08em', fontFamily: "'IBM Plex Mono', monospace" }}>{label}</span>
                  <span style={{ fontSize: 9, color: '#48536A', background: 'rgba(255,255,255,.06)', padding: '1px 5px', borderRadius: 100 }}>{items.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {items.map(item => {
                    const cat = CAT_BADGE[item.category] || CAT_BADGE.feature
                    return (
                      <div key={item.id}
                        draggable
                        onDragStart={() => setDragItem(item.id)}
                        style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, padding: '8px 10px', cursor: 'grab', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <GripVertical size={10} color="#48536A" style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, color: '#DDE3EE', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                          <span style={{ fontSize: 8, fontWeight: 700, color: cat.color, background: `${cat.color}1a`, padding: '1px 4px', borderRadius: 3, textTransform: 'uppercase' }}>{cat.label}</span>
                        </div>
                        <button onClick={() => deleteProgressItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#48536A', padding: 2, flexShrink: 0 }}><Trash2 size={10} /></button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ═══ Section 5: Add-Ons ═══ */}
      <div>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#F0F4FF', margin: '0 0 14px' }}>Add-Ons & Planned Integrations</h2>
        <div style={{ fontSize: 11, color: '#7C8BA0', marginBottom: 10, fontWeight: 600 }}>Near Term</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
          {ADDONS.filter(a => a.phase === 'near').map(a => (
            <div key={a.name} style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F4FF', marginBottom: 4 }}>{a.name}</div>
              <div style={{ fontSize: 11, color: '#7C8BA0', marginBottom: 8, lineHeight: 1.4 }}>{a.desc}</div>
              <div style={{ fontSize: 10, color: '#48536A', fontFamily: "'IBM Plex Mono', monospace", marginBottom: 8 }}>{a.cost}</div>
              <button style={{ padding: '4px 10px', background: 'rgba(29,111,232,.12)', color: '#4D9EFF', border: 'none', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Add</button>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: '#7C8BA0', marginBottom: 10, fontWeight: 600 }}>Growth Phase</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {ADDONS.filter(a => a.phase === 'growth').map(a => (
            <div key={a.name} style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F4FF', marginBottom: 4 }}>{a.name}</div>
              <div style={{ fontSize: 11, color: '#7C8BA0', marginBottom: 8, lineHeight: 1.4 }}>{a.desc}</div>
              <div style={{ fontSize: 10, color: '#48536A', fontFamily: "'IBM Plex Mono', monospace", marginBottom: 8 }}>{a.cost}</div>
              <button style={{ padding: '4px 10px', background: 'rgba(255,255,255,.06)', color: '#7C8BA0', border: 'none', borderRadius: 4, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}>Add</button>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ Edit/Add Service Modal ═══ */}
      {editSvc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={closeModal}>
          <div style={{ background: '#12131a', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: 28, width: 440, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#F0F4FF', margin: 0 }}>{newSvc ? 'Add Service' : 'Edit Service'}</h3>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#48536A' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Name', key: 'name', type: 'text' },
                { label: 'Provider', key: 'provider', type: 'text' },
                { label: 'Monthly Cost', key: 'monthly_cost', type: 'number' },
                { label: 'Dashboard URL', key: 'dashboard_url', type: 'url' },
                { label: 'Start Date', key: 'start_date', type: 'date' },
                { label: 'Renewal Date', key: 'renewal_date', type: 'date' },
              ].map(f => (
                <div key={f.key}>
                  <label style={labelStyle}>{f.label}</label>
                  <input type={f.type} value={editSvc[f.key] || ''} onChange={e => {
                    const val = f.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value
                    setEditSvc({ ...editSvc, [f.key]: val })
                  }} style={inputStyle} />
                </div>
              ))}

              <div>
                <label style={labelStyle}>Category</label>
                <select value={editSvc.category} onChange={e => setEditSvc({ ...editSvc, category: e.target.value })} style={inputStyle}>
                  {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Billing Cycle</label>
                <select value={editSvc.billing_cycle} onChange={e => setEditSvc({ ...editSvc, billing_cycle: e.target.value })} style={inputStyle}>
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual</option>
                  <option value="one_time">One-time</option>
                  <option value="usage_based">Usage-based</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Notes</label>
                <textarea value={editSvc.notes || ''} onChange={e => setEditSvc({ ...editSvc, notes: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#7C8BA0', cursor: 'pointer' }}>
                  <input type="checkbox" checked={editSvc.is_active} onChange={e => setEditSvc({ ...editSvc, is_active: e.target.checked })} /> Active
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#7C8BA0', cursor: 'pointer' }}>
                  <input type="checkbox" checked={editSvc.auto_renews} onChange={e => setEditSvc({ ...editSvc, auto_renews: e.target.checked })} /> Auto-renews
                </label>
              </div>

              <button onClick={() => saveSvc(editSvc)} disabled={saving} style={{ width: '100%', padding: 11, background: '#1D6FE8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', marginTop: 4 }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const td: React.CSSProperties = { padding: '8px 8px', fontSize: 12, color: '#7C8BA0', borderBottom: '1px solid rgba(255,255,255,.04)' }
const labelStyle: React.CSSProperties = { fontSize: 10, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: "'IBM Plex Mono', monospace", display: 'block', marginBottom: 3 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 12, color: '#DDE3EE', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }
