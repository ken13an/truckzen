'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { Plus, Trash2, Upload } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const BLUE = '#1B6EE6', GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F', MUTED = '#7C8BA0'
const stColor: Record<string, string> = { open: BLUE, in_progress: AMBER, completed: GREEN, invoiced: MUTED }
const STATUS_FLOW = ['open', 'in_progress', 'completed', 'invoiced']

export default function RepairDetailPage() {
  const { tokens: th } = useTheme()
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [repair, setRepair] = useState<any>(null)
  const [lines, setLines] = useState<any[]>([])
  const [tab, setTab] = useState<'overview' | 'lines' | 'files'>('overview')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [shopId, setShopId] = useState('')

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { router.push('/login'); return }
      setShopId(profile.shop_id)
      const [{ data: r }, { data: l }] = await Promise.all([
        supabase.from('maint_road_repairs').select('*, assets(unit_number, year, make, model), maint_drivers(full_name), maint_vendors(name)').eq('id', params.id).single(),
        supabase.from('maint_road_repair_lines').select('*').eq('road_repair_id', params.id).order('created_at'),
      ])
      if (!r) { router.push('/maintenance/repairs'); return }
      setRepair(r)
      setLines(l || [])
      setLoading(false)
    }
    load()
  }, [params.id])

  async function updateStatus(status: string) {
    setSaving(true)
    const updates: any = { status }
    if (status === 'completed') updates.completed_date = new Date().toISOString()
    await fetch('/api/maintenance/crud', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'maint_road_repairs', id: params.id, ...updates }),
    })
    setRepair((r: any) => ({ ...r, ...updates }))
    setSaving(false)
  }

  async function addLine() {
    const res = await fetch('/api/maintenance/crud', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'maint_road_repair_lines', shop_id: shopId, road_repair_id: params.id, description: 'New item', quantity: 1, unit_cost: 0, total: 0, line_type: 'part' }),
    })
    if (res.ok) {
      const line = await res.json()
      setLines(l => [...l, line])
    }
  }

  async function deleteLine(id: string) {
    await fetch('/api/maintenance/crud', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table: 'maint_road_repair_lines', id }) })
    setLines(l => l.filter(x => x.id !== id))
  }

  if (loading) return <div style={{ background: 'var(--tz-bg)', minHeight: '100vh', color: MUTED, fontFamily: FONT, padding: 40, textAlign: 'center' }}>Loading...</div>

  const asset = repair.assets || {}
  const driver = repair.maint_drivers || {}
  const vendor = repair.maint_vendors || {}
  const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(repair.status) + 1]

  const S: Record<string, React.CSSProperties> = {
    card: { background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, padding: 16, marginBottom: 12 },
    label: { fontFamily: MONO, fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: 'var(--tz-textTertiary)' },
    val: { fontSize: 13, color: 'var(--tz-text)', fontWeight: 600 },
  }

  const tabs = ['overview', 'lines', 'files'] as const

  return (
    <div style={{ background: 'var(--tz-bg)', minHeight: '100vh', color: 'var(--tz-text)', fontFamily: FONT, padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: 'var(--tz-text)' }}>{repair.repair_number || 'Repair'}</div>
          <div style={{ fontSize: 13, color: MUTED }}>#{asset.unit_number} {asset.year} {asset.make} {asset.model}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ padding: '4px 12px', borderRadius: 100, fontFamily: MONO, fontSize: 10, fontWeight: 700, background: `${stColor[repair.status] || MUTED}18`, color: stColor[repair.status] || MUTED, textTransform: 'uppercase' }}>{repair.status?.replace(/_/g, ' ')}</span>
          {nextStatus && (
            <button onClick={() => updateStatus(nextStatus)} disabled={saving} style={{ padding: '6px 14px', background: 'var(--tz-accent)', border: 'none', borderRadius: 8, color: 'var(--tz-bgLight)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
              {saving ? '...' : `Mark ${nextStatus.replace(/_/g, ' ')}`}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: `1px solid ${'var(--tz-border)'}` }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 20px', background: 'none', border: 'none', borderBottom: tab === t ? `2px solid ${'var(--tz-accent)'}` : '2px solid transparent',
            color: tab === t ? 'var(--tz-text)' : MUTED, fontSize: 12, fontWeight: tab === t ? 700 : 400, cursor: 'pointer', fontFamily: FONT, textTransform: 'capitalize',
          }}>{t === 'lines' ? 'Line Items' : t}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14, alignItems: 'start' }}>
          <div>
            <div style={S.card}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div><div style={S.label}>Truck</div><div style={S.val}>#{asset.unit_number || '—'}</div></div>
                <div><div style={S.label}>Driver</div><div style={S.val}>{driver.full_name || '—'}</div></div>
                <div><div style={S.label}>Vendor</div><div style={S.val}>{vendor.name || '—'}</div></div>
              </div>
              <div style={{ marginBottom: 12 }}><div style={S.label}>Location</div><div style={{ fontSize: 13, color: 'var(--tz-text)', marginTop: 4 }}>{repair.location_description || '—'}</div></div>
              <div style={{ marginBottom: 12 }}><div style={S.label}>Description</div><div style={{ fontSize: 13, color: 'var(--tz-text)', marginTop: 4 }}>{repair.description || '—'}</div></div>
              {repair.notes && <div><div style={S.label}>Notes</div><div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{repair.notes}</div></div>}
            </div>
          </div>
          <div style={S.card}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tz-text)', marginBottom: 12 }}>Cost Summary</div>
            {[
              { label: 'Parts', val: repair.parts_cost },
              { label: 'Labor', val: repair.labor_cost },
              { label: 'Total', val: repair.total_cost },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${'var(--tz-border)'}`, fontSize: 12 }}>
                <span style={{ color: 'var(--tz-textTertiary)' }}>{r.label}</span>
                <span style={{ fontFamily: MONO, fontWeight: r.label === 'Total' ? 700 : 400, color: r.label === 'Total' ? 'var(--tz-text)' : 'var(--tz-text)' }}>${(r.val || 0).toFixed(2)}</span>
              </div>
            ))}
            <div style={{ marginTop: 12 }}><div style={S.label}>Reported</div><div style={{ fontSize: 12, color: MUTED }}>{repair.reported_date ? new Date(repair.reported_date).toLocaleDateString() : '—'}</div></div>
            {repair.completed_date && <div style={{ marginTop: 8 }}><div style={S.label}>Completed</div><div style={{ fontSize: 12, color: GREEN }}>{new Date(repair.completed_date).toLocaleDateString()}</div></div>}
          </div>
        </div>
      )}

      {tab === 'lines' && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tz-text)' }}>Line Items ({lines.length})</div>
            <button onClick={addLine} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: 'rgba(29,111,232,.1)', border: '1px solid rgba(29,111,232,.2)', borderRadius: 6, color: 'var(--tz-accentLight)', fontSize: 11, cursor: 'pointer', fontFamily: FONT }}>
              <Plus size={12} /> Add
            </button>
          </div>
          {lines.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--tz-textTertiary)', fontSize: 12 }}>No line items yet</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Type', 'Description', 'Part #', 'Qty', 'Unit Cost', 'Total', ''].map(h => (
                  <th key={h} style={{ fontFamily: MONO, fontSize: 8, color: 'var(--tz-textTertiary)', textTransform: 'uppercase', padding: '6px 8px', textAlign: 'left', background: 'var(--tz-bgInput)' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {lines.map(l => (
                  <tr key={l.id}>
                    <td style={{ padding: '8px', fontSize: 10, color: MUTED, textTransform: 'uppercase' }}>{l.line_type}</td>
                    <td style={{ padding: '8px', fontSize: 12, color: 'var(--tz-text)' }}>{l.description}</td>
                    <td style={{ padding: '8px', fontSize: 10, fontFamily: MONO, color: MUTED }}>{l.part_number || '—'}</td>
                    <td style={{ padding: '8px', fontSize: 12, fontFamily: MONO }}>{l.quantity}</td>
                    <td style={{ padding: '8px', fontSize: 12, fontFamily: MONO }}>${(l.unit_cost || 0).toFixed(2)}</td>
                    <td style={{ padding: '8px', fontSize: 12, fontFamily: MONO, fontWeight: 700 }}>${(l.total || 0).toFixed(2)}</td>
                    <td style={{ padding: '8px' }}>
                      <button onClick={() => deleteLine(l.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: RED, padding: 2 }}><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'files' && (
        <div style={S.card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tz-text)', marginBottom: 12 }}>Files & Invoices</div>
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--tz-textTertiary)', fontSize: 12, border: `2px dashed ${'var(--tz-border)'}`, borderRadius: 8 }}>
            <Upload size={24} color={'var(--tz-textTertiary)'} style={{ marginBottom: 8 }} />
            <div>Upload vendor invoices and photos</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>Drag & drop or click to upload</div>
          </div>
          {repair.vendor_invoice_number && (
            <div style={{ marginTop: 12, fontSize: 12, color: MUTED }}>Invoice #: {repair.vendor_invoice_number}</div>
          )}
        </div>
      )}
    </div>
  )
}
