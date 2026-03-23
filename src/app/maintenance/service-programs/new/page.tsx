'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"

export default function NewServiceProgramPage() {
  const router = useRouter()
  const supabase = createClient()
  const [shopId, setShopId] = useState('')
  const [assets, setAssets] = useState<any[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', description: '', service_type: 'oil_change', interval_miles: '', interval_days: '', notes: '' })

  useEffect(() => {
    getCurrentUser(supabase).then(async p => {
      if (!p) { router.push('/login'); return }
      setShopId(p.shop_id)
      const { data } = await supabase.from('assets').select('id, unit_number, year, make').eq('shop_id', p.shop_id).eq('status', 'active').order('unit_number')
      setAssets(data || [])
    })
  }, [])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name) { setError('Name required'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/maintenance/crud', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table: 'maint_service_programs', shop_id: shopId, name: form.name, description: form.description || null, service_type: form.service_type, interval_miles: parseInt(form.interval_miles) || null, interval_days: parseInt(form.interval_days) || null, applies_to: selected, vehicles_count: selected.length, active: true, notes: form.notes || null }) })
    if (!res.ok) { setError('Failed'); setSaving(false); return }
    router.push('/maintenance/service-programs')
  }

  const S: Record<string, React.CSSProperties> = {
    page: { background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: FONT, padding: 24, maxWidth: 640, margin: '0 auto' },
    card: { background: '#161B24', border: '1px solid rgba(255,255,255,.055)', borderRadius: 12, padding: 20, marginBottom: 12 },
    label: { fontFamily: MONO, fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: '#48536A', marginBottom: 5, display: 'block' },
    input: { width: '100%', padding: '9px 12px', background: '#1C2130', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 12, color: '#DDE3EE', outline: 'none', fontFamily: 'inherit', minHeight: 38, boxSizing: 'border-box' as const },
    row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 },
    btn: { padding: '12px 24px', background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', width: '100%' },
    error: { padding: '10px 12px', background: 'rgba(217,79,79,.08)', border: '1px solid rgba(217,79,79,.2)', borderRadius: 8, fontSize: 12, color: '#D94F4F', marginBottom: 12 },
  }

  return (
    <div style={S.page}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF', marginBottom: 20 }}>New Service Program</div>
      {error && <div style={S.error}>{error}</div>}
      <form onSubmit={submit}>
        <div style={S.card}>
          <div style={{ marginBottom: 10 }}><label style={S.label}>Program Name *</label><input style={S.input} value={form.name} onChange={set('name')} /></div>
          <div style={{ marginBottom: 10 }}><label style={S.label}>Description</label><textarea style={{ ...S.input, minHeight: 48, resize: 'vertical' as const }} value={form.description} onChange={set('description')} /></div>
          <div style={S.row2}>
            <div><label style={S.label}>Service Type</label><select style={{ ...S.input, appearance: 'none' as const }} value={form.service_type} onChange={set('service_type')}>{['oil_change','dot_annual','brake_inspection','tire_rotation','transmission','pm_a','pm_b','custom'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></div>
            <div />
          </div>
          <div style={S.row2}>
            <div><label style={S.label}>Interval Miles</label><input style={S.input} type="number" value={form.interval_miles} onChange={set('interval_miles')} /></div>
            <div><label style={S.label}>Interval Days</label><input style={S.input} type="number" value={form.interval_days} onChange={set('interval_days')} /></div>
          </div>
        </div>
        <div style={S.card}>
          <label style={S.label}>Apply to Vehicles ({selected.length} selected)</label>
          <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 6 }}>
            {assets.map(a => (
              <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer', fontSize: 12, color: '#DDE3EE' }}>
                <input type="checkbox" checked={selected.includes(a.id)} onChange={e => setSelected(s => e.target.checked ? [...s, a.id] : s.filter(x => x !== a.id))} />
                #{a.unit_number} {a.year} {a.make}
              </label>
            ))}
          </div>
        </div>
        <button type="submit" style={S.btn} disabled={saving}>{saving ? 'Creating...' : 'Create Program'}</button>
      </form>
    </div>
  )
}
