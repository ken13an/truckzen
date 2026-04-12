'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"

export default function NewShopPage() {
  const { tokens: t } = useTheme()
  const router = useRouter()
  const supabase = createClient()
  const [shopId, setShopId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', address: '', city: '', state: '', zip: '', phone: '', email: '', contact_person: '', pricing_notes: '' })

  useEffect(() => { getCurrentUser(supabase).then(p => { if (!p) router.push('/login'); else setShopId(p.shop_id) }) }, [])
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name) { setError('Name required'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/maintenance/crud', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table: 'maint_vendors', shop_id: shopId, name: form.name, address: form.address || null, city: form.city || null, state: form.state || null, zip: form.zip || null, phone: form.phone || null, email: form.email || null, contact_person: form.contact_person || null, specialties: ['road_repair'], pricing_notes: form.pricing_notes || null, active: true }) })
    if (!res.ok) { setError('Failed'); setSaving(false); return }
    router.push('/maintenance/shop-network')
  }

  const S: Record<string, React.CSSProperties> = {
    page: { background: t.bg, minHeight: '100vh', color: t.text, fontFamily: FONT, padding: 24, maxWidth: 560, margin: '0 auto' },
    card: { background: t.bgCard, border: '1px solid rgba(255,255,255,.055)', borderRadius: 12, padding: 20, marginBottom: 12 },
    label: { fontFamily: MONO, fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: t.textTertiary, marginBottom: 5, display: 'block' },
    input: { width: '100%', padding: '9px 12px', background: '#1C2130', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 12, color: t.text, outline: 'none', fontFamily: 'inherit', minHeight: 38, boxSizing: 'border-box' as const },
    row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 },
    row3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 },
    btn: { padding: '12px 24px', background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', width: '100%' },
    error: { padding: '10px 12px', background: 'rgba(217,79,79,.08)', border: '1px solid rgba(217,79,79,.2)', borderRadius: 8, fontSize: 12, color: '#D94F4F', marginBottom: 12 },
  }

  return (
    <div style={S.page}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: t.text, marginBottom: 20 }}>Add Shop to Network</div>
      {error && <div style={S.error}>{error}</div>}
      <form onSubmit={submit}>
        <div style={S.card}>
          <div style={{ marginBottom: 10 }}><label style={S.label}>Shop Name *</label><input style={S.input} value={form.name} onChange={set('name')} /></div>
          <div style={{ marginBottom: 10 }}><label style={S.label}>Address</label><input style={S.input} value={form.address} onChange={set('address')} /></div>
          <div style={S.row3}>
            <div><label style={S.label}>City</label><input style={S.input} value={form.city} onChange={set('city')} /></div>
            <div><label style={S.label}>State</label><input style={S.input} value={form.state} onChange={set('state')} /></div>
            <div><label style={S.label}>Zip</label><input style={S.input} value={form.zip} onChange={set('zip')} /></div>
          </div>
          <div style={S.row2}>
            <div><label style={S.label}>Phone</label><input style={S.input} value={form.phone} onChange={set('phone')} /></div>
            <div><label style={S.label}>Contact</label><input style={S.input} value={form.contact_person} onChange={set('contact_person')} /></div>
          </div>
          <div><label style={S.label}>Notes</label><textarea style={{ ...S.input, minHeight: 48, resize: 'vertical' as const }} value={form.pricing_notes} onChange={set('pricing_notes')} /></div>
        </div>
        <button type="submit" style={S.btn} disabled={saving}>{saving ? 'Adding...' : 'Add Shop'}</button>
      </form>
    </div>
  )
}
