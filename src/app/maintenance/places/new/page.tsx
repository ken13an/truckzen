'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const TYPES = ['yard', 'shop', 'customer', 'fuel_stop', 'weigh_station', 'other']

export default function NewPlacePage() {
  const { tokens: th } = useTheme()
  const router = useRouter()
  const supabase = createClient()
  const [shopId, setShopId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', place_type: 'other', address: '', city: '', state: '', zip: '', latitude: '', longitude: '', phone: '', contact_person: '', notes: '' })

  useEffect(() => { getCurrentUser(supabase).then(p => { if (!p) router.push('/login'); else setShopId(p.shop_id) }) }, [])
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name) { setError('Name required'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/maintenance/crud', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table: 'maint_places', shop_id: shopId, name: form.name, place_type: form.place_type, address: form.address || null, city: form.city || null, state: form.state || null, zip: form.zip || null, latitude: form.latitude ? parseFloat(form.latitude) : null, longitude: form.longitude ? parseFloat(form.longitude) : null, phone: form.phone || null, contact_person: form.contact_person || null, notes: form.notes || null }) })
    if (!res.ok) { setError('Failed'); setSaving(false); return }
    router.push('/maintenance/places')
  }

  const S: Record<string, React.CSSProperties> = {
    page: { background: th.bg, minHeight: '100vh', color: th.text, fontFamily: FONT, padding: 24, maxWidth: 560, margin: '0 auto' },
    card: { background: th.bgCard, border: '1px solid rgba(255,255,255,.055)', borderRadius: 12, padding: 20, marginBottom: 12 },
    label: { fontFamily: MONO, fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: th.textTertiary, marginBottom: 5, display: 'block' },
    input: { width: '100%', padding: '9px 12px', background: '#1C2130', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 12, color: th.text, outline: 'none', fontFamily: 'inherit', minHeight: 38, boxSizing: 'border-box' as const },
    row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 },
    row3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 },
    btn: { padding: '12px 24px', background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', width: '100%' },
    error: { padding: '10px 12px', background: 'rgba(217,79,79,.08)', border: '1px solid rgba(217,79,79,.2)', borderRadius: 8, fontSize: 12, color: '#D94F4F', marginBottom: 12 },
  }

  return (
    <div style={S.page}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: th.text, marginBottom: 20 }}>New Place</div>
      {error && <div style={S.error}>{error}</div>}
      <form onSubmit={submit}>
        <div style={S.card}>
          <div style={S.row2}>
            <div><label style={S.label}>Name *</label><input style={S.input} value={form.name} onChange={set('name')} /></div>
            <div><label style={S.label}>Type</label><select style={{ ...S.input, appearance: 'none' as const }} value={form.place_type} onChange={set('place_type')}>{TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></div>
          </div>
          <div style={{ marginBottom: 10 }}><label style={S.label}>Address</label><input style={S.input} value={form.address} onChange={set('address')} /></div>
          <div style={S.row3}>
            <div><label style={S.label}>City</label><input style={S.input} value={form.city} onChange={set('city')} /></div>
            <div><label style={S.label}>State</label><input style={S.input} value={form.state} onChange={set('state')} /></div>
            <div><label style={S.label}>Zip</label><input style={S.input} value={form.zip} onChange={set('zip')} /></div>
          </div>
          <div style={S.row2}>
            <div><label style={S.label}>Latitude</label><input style={S.input} type="number" step="any" value={form.latitude} onChange={set('latitude')} /></div>
            <div><label style={S.label}>Longitude</label><input style={S.input} type="number" step="any" value={form.longitude} onChange={set('longitude')} /></div>
          </div>
          <div style={S.row2}>
            <div><label style={S.label}>Phone</label><input style={S.input} value={form.phone} onChange={set('phone')} /></div>
            <div><label style={S.label}>Contact</label><input style={S.input} value={form.contact_person} onChange={set('contact_person')} /></div>
          </div>
          <div><label style={S.label}>Notes</label><textarea style={{ ...S.input, minHeight: 48, resize: 'vertical' as const }} value={form.notes} onChange={set('notes')} /></div>
        </div>
        <button type="submit" style={S.btn} disabled={saving}>{saving ? 'Creating...' : 'Add Place'}</button>
      </form>
    </div>
  )
}
