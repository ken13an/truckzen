'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"

const SERVICE_TYPES = [
  { value: 'oil_change', label: 'Oil Change' },
  { value: 'dot_annual', label: 'DOT Annual' },
  { value: 'brake_inspection', label: 'Brake Inspection' },
  { value: 'tire_rotation', label: 'Tire Rotation' },
  { value: 'transmission_service', label: 'Transmission Service' },
  { value: 'coolant_flush', label: 'Coolant Flush' },
  { value: 'def_system', label: 'DEF System' },
  { value: 'air_dryer', label: 'Air Dryer' },
  { value: 'pm_a', label: 'PM A' },
  { value: 'pm_b', label: 'PM B' },
  { value: 'pm_c', label: 'PM C' },
  { value: 'custom', label: 'Custom' },
]

export default function NewPMSchedulePage() {
  const { tokens: th } = useTheme()
  const router = useRouter()
  const supabase = createClient()
  const [shopId, setShopId] = useState('')
  const [assets, setAssets] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    asset_id: '', service_type: 'oil_change', custom_name: '',
    interval_miles: '', interval_days: '',
    last_completed_date: '', last_completed_miles: '',
    priority: 'normal', notes: '',
  })

  useEffect(() => {
    getCurrentUser(supabase).then(async p => {
      if (!p) { router.push('/login'); return }
      setShopId(p.shop_id)
      const { data } = await supabase.from('assets').select('id, unit_number, year, make, model').eq('shop_id', p.shop_id).eq('status', 'active').is('deleted_at', null).order('unit_number')
      setAssets(data || [])
    })
  }, [])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.asset_id) { setError('Select a vehicle'); return }
    if (!form.interval_miles && !form.interval_days) { setError('Set at least one interval'); return }
    setSaving(true); setError('')

    // Auto-calculate next due
    const intDays = parseInt(form.interval_days) || null
    const intMiles = parseInt(form.interval_miles) || null
    let nextDate: string | null = null
    let nextMiles: number | null = null
    if (form.last_completed_date && intDays) {
      const d = new Date(form.last_completed_date)
      d.setDate(d.getDate() + intDays)
      nextDate = d.toISOString().split('T')[0]
    }
    if (form.last_completed_miles && intMiles) {
      nextMiles = parseInt(form.last_completed_miles) + intMiles
    }

    const res = await fetch('/api/maintenance/crud', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'maint_pm_schedules', shop_id: shopId,
        asset_id: form.asset_id, service_type: form.service_type,
        custom_name: form.service_type === 'custom' ? form.custom_name : null,
        interval_miles: intMiles, interval_days: intDays,
        last_completed_date: form.last_completed_date || null,
        last_completed_miles: form.last_completed_miles ? parseInt(form.last_completed_miles) : null,
        next_due_date: nextDate, next_due_miles: nextMiles,
        priority: form.priority, notes: form.notes || null,
        status: 'active',
      }),
    })
    if (!res.ok) { setError('Failed to create'); setSaving(false); return }
    const pm = await res.json()
    router.push(`/maintenance/pm/${pm.id}`)
  }

  const S: Record<string, React.CSSProperties> = {
    page: { background: 'var(--tz-bg)', minHeight: '100vh', color: 'var(--tz-text)', fontFamily: FONT, padding: 24, maxWidth: 640, margin: '0 auto' },
    card: { background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, padding: 20, marginBottom: 12 },
    label: { fontFamily: MONO, fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: 'var(--tz-textTertiary)', marginBottom: 5, display: 'block' },
    input: { width: '100%', padding: '9px 12px', background: 'var(--tz-inputBg)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 8, fontSize: 12, color: 'var(--tz-text)', outline: 'none', fontFamily: 'inherit', minHeight: 38, boxSizing: 'border-box' as const },
    row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 },
    btn: { padding: '12px 24px', background: 'var(--tz-accent)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, color: 'var(--tz-bgLight)', cursor: 'pointer', fontFamily: 'inherit', width: '100%' },
    error: { padding: '10px 12px', background: 'rgba(217,79,79,.08)', border: '1px solid rgba(217,79,79,.2)', borderRadius: 8, fontSize: 12, color: '#D94F4F', marginBottom: 12 },
  }

  return (
    <div style={S.page}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: 'var(--tz-text)', marginBottom: 4 }}>New PM Schedule</div>
      <div style={{ fontSize: 12, color: 'var(--tz-textSecondary)', marginBottom: 20 }}>Set up a recurring maintenance schedule.</div>
      {error && <div style={S.error}>{error}</div>}
      <form onSubmit={submit}>
        <div style={S.card}>
          <div style={{ marginBottom: 10 }}>
            <label style={S.label}>Vehicle *</label>
            <select style={{ ...S.input, appearance: 'none' as const }} value={form.asset_id} onChange={set('asset_id')}>
              <option value="">Select truck...</option>
              {assets.map(a => <option key={a.id} value={a.id}>#{a.unit_number} {a.year} {a.make} {a.model}</option>)}
            </select>
          </div>
          <div style={S.row2}>
            <div>
              <label style={S.label}>Service Type *</label>
              <select style={{ ...S.input, appearance: 'none' as const }} value={form.service_type} onChange={set('service_type')}>
                {SERVICE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            {form.service_type === 'custom' && (
              <div><label style={S.label}>Custom Name</label><input style={S.input} value={form.custom_name} onChange={set('custom_name')} placeholder="Service name..." /></div>
            )}
            <div>
              <label style={S.label}>Priority</label>
              <select style={{ ...S.input, appearance: 'none' as const }} value={form.priority} onChange={set('priority')}>
                <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option>
              </select>
            </div>
          </div>
        </div>

        <div style={S.card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tz-text)', marginBottom: 10 }}>Intervals</div>
          <div style={{ fontSize: 11, color: 'var(--tz-textTertiary)', marginBottom: 8 }}>Set one or both — alert triggers when either is reached.</div>
          <div style={S.row2}>
            <div><label style={S.label}>Every X Miles</label><input style={S.input} type="number" value={form.interval_miles} onChange={set('interval_miles')} placeholder="15000" /></div>
            <div><label style={S.label}>Every X Days</label><input style={S.input} type="number" value={form.interval_days} onChange={set('interval_days')} placeholder="90" /></div>
          </div>
        </div>

        <div style={S.card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tz-text)', marginBottom: 10 }}>Last Completed</div>
          <div style={S.row2}>
            <div><label style={S.label}>Date</label><input style={S.input} type="date" value={form.last_completed_date} onChange={set('last_completed_date')} /></div>
            <div><label style={S.label}>Miles</label><input style={S.input} type="number" value={form.last_completed_miles} onChange={set('last_completed_miles')} placeholder="472000" /></div>
          </div>
        </div>

        <div style={S.card}>
          <label style={S.label}>Notes</label>
          <textarea style={{ ...S.input, minHeight: 64, resize: 'vertical' as const }} value={form.notes} onChange={set('notes')} />
        </div>

        <button type="submit" style={S.btn} disabled={saving}>{saving ? 'Creating...' : 'Create PM Schedule'}</button>
      </form>
    </div>
  )
}
