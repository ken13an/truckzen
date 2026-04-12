'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"

export default function NewFuelEntryPage() {
  const { tokens: t } = useTheme()
  const router = useRouter()
  const supabase = createClient()
  const [shopId, setShopId] = useState('')
  const [assets, setAssets] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    asset_id: '', driver_id: '', fuel_date: new Date().toISOString().split('T')[0],
    location: '', gallons: '', cost_per_gallon: '', odometer: '',
    fuel_type: 'diesel', notes: '',
  })

  useEffect(() => {
    getCurrentUser(supabase).then(async p => {
      if (!p) { router.push('/login'); return }
      setShopId(p.shop_id)
      const [a, d] = await Promise.all([
        supabase.from('assets').select('id, unit_number, year, make, model').eq('shop_id', p.shop_id).eq('status', 'active').is('deleted_at', null).order('unit_number'),
        supabase.from('maint_drivers').select('id, full_name').eq('shop_id', p.shop_id).eq('active', true).order('full_name'),
      ])
      setAssets(a.data || [])
      setDrivers(d.data || [])
    })
  }, [])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }))
  const totalCost = (parseFloat(form.gallons) || 0) * (parseFloat(form.cost_per_gallon) || 0)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.gallons) { setError('Gallons required'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/maintenance/crud', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'maint_fuel_entries', shop_id: shopId,
        asset_id: form.asset_id || null, driver_id: form.driver_id || null,
        fuel_date: form.fuel_date, location: form.location || null,
        gallons: parseFloat(form.gallons), cost_per_gallon: form.cost_per_gallon ? parseFloat(form.cost_per_gallon) : null,
        total_cost: totalCost || null, odometer: form.odometer ? parseInt(form.odometer) : null,
        fuel_type: form.fuel_type, notes: form.notes || null,
      }),
    })
    if (!res.ok) { setError('Failed to create'); setSaving(false); return }
    router.push('/maintenance/fuel')
  }

  const S: Record<string, React.CSSProperties> = {
    page: { background: t.bg, minHeight: '100vh', color: t.text, fontFamily: FONT, padding: 24, maxWidth: 600, margin: '0 auto' },
    card: { background: '#161B24', border: '1px solid rgba(255,255,255,.055)', borderRadius: 12, padding: 20, marginBottom: 12 },
    label: { fontFamily: MONO, fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: t.textTertiary, marginBottom: 5, display: 'block' },
    input: { width: '100%', padding: '9px 12px', background: '#1C2130', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 12, color: t.text, outline: 'none', fontFamily: 'inherit', minHeight: 38, boxSizing: 'border-box' as const },
    row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 },
    row3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 },
    btn: { padding: '12px 24px', background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', width: '100%' },
    error: { padding: '10px 12px', background: 'rgba(217,79,79,.08)', border: '1px solid rgba(217,79,79,.2)', borderRadius: 8, fontSize: 12, color: '#D94F4F', marginBottom: 12 },
  }

  return (
    <div style={S.page}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: t.text, marginBottom: 4 }}>New Fuel Entry</div>
      <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 20 }}>Log a fuel fill-up.</div>
      {error && <div style={S.error}>{error}</div>}
      <form onSubmit={submit}>
        <div style={S.card}>
          <div style={S.row2}>
            <div>
              <label style={S.label}>Truck</label>
              <select style={{ ...S.input, appearance: 'none' as const }} value={form.asset_id} onChange={set('asset_id')}>
                <option value="">Select truck...</option>
                {assets.map(a => <option key={a.id} value={a.id}>#{a.unit_number} {a.year} {a.make}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Driver</label>
              <select style={{ ...S.input, appearance: 'none' as const }} value={form.driver_id} onChange={set('driver_id')}>
                <option value="">Select driver...</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
              </select>
            </div>
          </div>
          <div style={S.row2}>
            <div><label style={S.label}>Date</label><input style={S.input} type="date" value={form.fuel_date} onChange={set('fuel_date')} /></div>
            <div><label style={S.label}>Location</label><input style={S.input} value={form.location} onChange={set('location')} placeholder="Station name/address" /></div>
          </div>
          <div style={S.row3}>
            <div><label style={S.label}>Gallons *</label><input style={S.input} type="number" step="0.001" value={form.gallons} onChange={set('gallons')} /></div>
            <div><label style={S.label}>Cost/Gallon</label><input style={S.input} type="number" step="0.001" value={form.cost_per_gallon} onChange={set('cost_per_gallon')} /></div>
            <div>
              <label style={S.label}>Total</label>
              <div style={{ ...S.input, display: 'flex', alignItems: 'center', color: t.text, fontFamily: MONO, fontWeight: 700 }}>${totalCost.toFixed(2)}</div>
            </div>
          </div>
          <div style={S.row2}>
            <div><label style={S.label}>Odometer</label><input style={S.input} type="number" value={form.odometer} onChange={set('odometer')} placeholder="Current mileage" /></div>
            <div>
              <label style={S.label}>Fuel Type</label>
              <select style={{ ...S.input, appearance: 'none' as const }} value={form.fuel_type} onChange={set('fuel_type')}>
                <option value="diesel">Diesel</option><option value="def">DEF</option><option value="gasoline">Gasoline</option>
              </select>
            </div>
          </div>
          <div><label style={S.label}>Notes</label><textarea style={{ ...S.input, minHeight: 48, resize: 'vertical' as const }} value={form.notes} onChange={set('notes')} /></div>
        </div>
        <button type="submit" style={S.btn} disabled={saving}>{saving ? 'Saving...' : 'Add Fuel Entry'}</button>
      </form>
    </div>
  )
}
