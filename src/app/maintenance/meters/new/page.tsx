'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"

export default function NewMeterPage() {
  const { tokens: t } = useTheme()
  const router = useRouter()
  const supabase = createClient()
  const [shopId, setShopId] = useState('')
  const [assets, setAssets] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ asset_id: '', reading_date: new Date().toISOString().split('T')[0], odometer: '', hourmeter: '' })

  useEffect(() => {
    getCurrentUser(supabase).then(async p => {
      if (!p) { router.push('/login'); return }
      setShopId(p.shop_id)
      const { data } = await supabase.from('assets').select('id, unit_number, year, make').eq('shop_id', p.shop_id).eq('status', 'active').is('deleted_at', null).order('unit_number')
      setAssets(data || [])
    })
  }, [])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.asset_id) { setError('Select a truck'); return }
    if (!form.odometer && !form.hourmeter) { setError('Enter odometer or hourmeter'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/maintenance/crud', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'maint_meter_entries', shop_id: shopId,
        asset_id: form.asset_id, reading_date: form.reading_date,
        odometer: form.odometer ? parseInt(form.odometer) : null,
        hourmeter: form.hourmeter ? parseFloat(form.hourmeter) : null,
      }),
    })
    if (!res.ok) { setError('Failed'); setSaving(false); return }
    router.push('/maintenance/meters')
  }

  const S: Record<string, React.CSSProperties> = {
    page: { background: t.bg, minHeight: '100vh', color: t.text, fontFamily: FONT, padding: 24, maxWidth: 480, margin: '0 auto' },
    card: { background: '#161B24', border: '1px solid rgba(255,255,255,.055)', borderRadius: 12, padding: 20, marginBottom: 12 },
    label: { fontFamily: MONO, fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: t.textTertiary, marginBottom: 5, display: 'block' },
    input: { width: '100%', padding: '9px 12px', background: '#1C2130', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 12, color: t.text, outline: 'none', fontFamily: 'inherit', minHeight: 38, boxSizing: 'border-box' as const },
    row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 },
    btn: { padding: '12px 24px', background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', width: '100%' },
    error: { padding: '10px 12px', background: 'rgba(217,79,79,.08)', border: '1px solid rgba(217,79,79,.2)', borderRadius: 8, fontSize: 12, color: '#D94F4F', marginBottom: 12 },
  }

  return (
    <div style={S.page}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: t.text, marginBottom: 20 }}>New Meter Reading</div>
      {error && <div style={S.error}>{error}</div>}
      <form onSubmit={submit}>
        <div style={S.card}>
          <div style={{ marginBottom: 10 }}>
            <label style={S.label}>Truck *</label>
            <select style={{ ...S.input, appearance: 'none' as const }} value={form.asset_id} onChange={set('asset_id')}>
              <option value="">Select truck...</option>
              {assets.map(a => <option key={a.id} value={a.id}>#{a.unit_number} {a.year} {a.make}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 10 }}><label style={S.label}>Date</label><input style={S.input} type="date" value={form.reading_date} onChange={set('reading_date')} /></div>
          <div style={S.row2}>
            <div><label style={S.label}>Odometer</label><input style={S.input} type="number" value={form.odometer} onChange={set('odometer')} placeholder="Miles" /></div>
            <div><label style={S.label}>Hourmeter</label><input style={S.input} type="number" step="0.1" value={form.hourmeter} onChange={set('hourmeter')} placeholder="Hours" /></div>
          </div>
        </div>
        <button type="submit" style={S.btn} disabled={saving}>{saving ? 'Saving...' : 'Add Reading'}</button>
      </form>
    </div>
  )
}
