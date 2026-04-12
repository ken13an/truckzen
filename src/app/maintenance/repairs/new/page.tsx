'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { Plus, Trash2 } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"

interface LineItem { description: string; part_number: string; quantity: string; unit_cost: string; line_type: string }

export default function NewRepairPage() {
  const { tokens: t } = useTheme()
  const router = useRouter()
  const supabase = createClient()
  const [shopId, setShopId] = useState('')
  const [assets, setAssets] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [vendors, setVendors] = useState<any[]>([])
  const [form, setForm] = useState({ asset_id: '', driver_id: '', vendor_id: '', location_description: '', description: '', notes: '' })
  const [lines, setLines] = useState<LineItem[]>([{ description: '', part_number: '', quantity: '1', unit_cost: '0', line_type: 'part' }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { router.push('/login'); return }
      setShopId(profile.shop_id)
      const [a, d, v] = await Promise.all([
        supabase.from('assets').select('id, unit_number, year, make, model').eq('shop_id', profile.shop_id).eq('status', 'active').is('deleted_at', null).order('unit_number'),
        supabase.from('maint_drivers').select('id, full_name').eq('shop_id', profile.shop_id).eq('active', true).order('full_name'),
        supabase.from('maint_vendors').select('id, name').eq('shop_id', profile.shop_id).eq('active', true).order('name'),
      ])
      setAssets(a.data || [])
      setDrivers(d.data || [])
      setVendors(v.data || [])
    }
    load()
  }, [])

  const total = lines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_cost) || 0), 0)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.description) { setError('Description required'); return }
    setSaving(true); setError('')

    const res = await fetch('/api/maintenance/crud', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'maint_road_repairs', shop_id: shopId,
        asset_id: form.asset_id || null, driver_id: form.driver_id || null,
        vendor_id: form.vendor_id || null, location_description: form.location_description,
        description: form.description, notes: form.notes, status: 'open',
        total_cost: total, labor_cost: lines.filter(l => l.line_type === 'labor').reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_cost) || 0), 0),
        parts_cost: lines.filter(l => l.line_type === 'part').reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_cost) || 0), 0),
      }),
    })

    if (!res.ok) { setError('Failed to create repair'); setSaving(false); return }
    const repair = await res.json()

    // Create line items
    for (const line of lines.filter(l => l.description)) {
      await fetch('/api/maintenance/crud', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'maint_road_repair_lines', shop_id: shopId,
          road_repair_id: repair.id, description: line.description,
          part_number: line.part_number, quantity: parseFloat(line.quantity) || 1,
          unit_cost: parseFloat(line.unit_cost) || 0,
          total: (parseFloat(line.quantity) || 1) * (parseFloat(line.unit_cost) || 0),
          line_type: line.line_type,
        }),
      })
    }

    router.push(`/maintenance/repairs/${repair.id}`)
  }

  const S: Record<string, React.CSSProperties> = {
    page: { background: t.bg, minHeight: '100vh', color: t.text, fontFamily: FONT, padding: 24, maxWidth: 720, margin: '0 auto' },
    card: { background: t.bgCard, border: '1px solid rgba(255,255,255,.055)', borderRadius: 12, padding: 20, marginBottom: 12 },
    label: { fontFamily: MONO, fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: t.textTertiary, marginBottom: 5, display: 'block' },
    input: { width: '100%', padding: '9px 12px', background: '#1C2130', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 12, color: t.text, outline: 'none', fontFamily: 'inherit', minHeight: 38, boxSizing: 'border-box' as const },
    row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 },
    row3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 },
    btn: { padding: '12px 24px', background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' },
    error: { padding: '10px 12px', background: 'rgba(217,79,79,.08)', border: '1px solid rgba(217,79,79,.2)', borderRadius: 8, fontSize: 12, color: '#D94F4F', marginBottom: 12 },
  }

  return (
    <div style={S.page}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: t.text, marginBottom: 4 }}>New Road Repair</div>
      <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 20 }}>Log a road repair for a fleet truck.</div>

      {error && <div style={S.error}>{error}</div>}

      <form onSubmit={submit}>
        <div style={S.card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 12 }}>Repair Details</div>
          <div style={S.row3}>
            <div>
              <label style={S.label}>Truck</label>
              <select style={{ ...S.input, appearance: 'none' as const }} value={form.asset_id} onChange={e => setForm(f => ({ ...f, asset_id: e.target.value }))}>
                <option value="">Select truck...</option>
                {assets.map(a => <option key={a.id} value={a.id}>#{a.unit_number} {a.year} {a.make} {a.model}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Driver</label>
              <select style={{ ...S.input, appearance: 'none' as const }} value={form.driver_id} onChange={e => setForm(f => ({ ...f, driver_id: e.target.value }))}>
                <option value="">Select driver...</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Vendor</label>
              <select style={{ ...S.input, appearance: 'none' as const }} value={form.vendor_id} onChange={e => setForm(f => ({ ...f, vendor_id: e.target.value }))}>
                <option value="">Select vendor...</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={S.label}>Location</label>
            <input style={S.input} value={form.location_description} onChange={e => setForm(f => ({ ...f, location_description: e.target.value }))} placeholder="e.g. I-95 mile marker 42" />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={S.label}>Description *</label>
            <textarea style={{ ...S.input, minHeight: 64, resize: 'vertical' as const }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What happened / what needs repair..." />
          </div>
          <div>
            <label style={S.label}>Notes</label>
            <textarea style={{ ...S.input, minHeight: 48, resize: 'vertical' as const }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Internal notes..." />
          </div>
        </div>

        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>Line Items</div>
            <button type="button" onClick={() => setLines(l => [...l, { description: '', part_number: '', quantity: '1', unit_cost: '0', line_type: 'part' }])} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: 'rgba(29,111,232,.1)', border: '1px solid rgba(29,111,232,.2)', borderRadius: 6, color: '#4D9EFF', fontSize: 11, cursor: 'pointer', fontFamily: FONT }}>
              <Plus size={12} /> Add Line
            </button>
          </div>
          {lines.map((line, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px 80px 80px 30px', gap: 6, marginBottom: 6, alignItems: 'end' }}>
              <div>
                <label style={{ ...S.label, fontSize: 7 }}>Type</label>
                <select style={{ ...S.input, padding: '6px 4px', fontSize: 10 }} value={line.line_type} onChange={e => { const nl = [...lines]; nl[i].line_type = e.target.value; setLines(nl) }}>
                  <option value="part">Part</option><option value="labor">Labor</option><option value="misc">Misc</option>
                </select>
              </div>
              <div>
                <label style={{ ...S.label, fontSize: 7 }}>Description</label>
                <input style={{ ...S.input, padding: '6px 8px', fontSize: 11 }} value={line.description} onChange={e => { const nl = [...lines]; nl[i].description = e.target.value; setLines(nl) }} placeholder="Description..." />
              </div>
              <div>
                <label style={{ ...S.label, fontSize: 7 }}>Part #</label>
                <input style={{ ...S.input, padding: '6px 8px', fontSize: 11 }} value={line.part_number} onChange={e => { const nl = [...lines]; nl[i].part_number = e.target.value; setLines(nl) }} />
              </div>
              <div>
                <label style={{ ...S.label, fontSize: 7 }}>Qty</label>
                <input style={{ ...S.input, padding: '6px 8px', fontSize: 11 }} type="number" value={line.quantity} onChange={e => { const nl = [...lines]; nl[i].quantity = e.target.value; setLines(nl) }} />
              </div>
              <div>
                <label style={{ ...S.label, fontSize: 7 }}>Unit $</label>
                <input style={{ ...S.input, padding: '6px 8px', fontSize: 11 }} type="number" step="0.01" value={line.unit_cost} onChange={e => { const nl = [...lines]; nl[i].unit_cost = e.target.value; setLines(nl) }} />
              </div>
              <button type="button" onClick={() => setLines(l => l.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D94F4F', padding: 4 }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <div style={{ textAlign: 'right', marginTop: 10, fontFamily: MONO, fontSize: 14, fontWeight: 700, color: t.text }}>
            Total: ${total.toFixed(2)}
          </div>
        </div>

        <button type="submit" style={{ ...S.btn, width: '100%' }} disabled={saving}>{saving ? 'Creating...' : 'Create Road Repair'}</button>
      </form>
    </div>
  )
}
