'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"

export default function NewRecallPage() {
  const { tokens: t } = useTheme()
  const router = useRouter()
  const supabase = createClient()
  const [shopId, setShopId] = useState('')
  const [assets, setAssets] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ asset_id: '', recall_number: '', nhtsa_id: '', title: '', description: '', manufacturer: '', remedy: '' })

  useEffect(() => {
    getCurrentUser(supabase).then(async p => {
      if (!p) { router.push('/login'); return }
      setShopId(p.shop_id)
      const { data } = await supabase.from('assets').select('id, unit_number, year, make').eq('shop_id', p.shop_id).eq('status', 'active').is('deleted_at', null).order('unit_number')
      setAssets(data || [])
    })
  }, [])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title) { setError('Title required'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/maintenance/crud', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'maint_recalls', shop_id: shopId, asset_id: form.asset_id || null, recall_number: form.recall_number || null, nhtsa_id: form.nhtsa_id || null, title: form.title, description: form.description || null, manufacturer: form.manufacturer || null, remedy: form.remedy || null, status: 'open' }),
    })
    if (!res.ok) { setError('Failed'); setSaving(false); return }
    const recall = await res.json()
    router.push(`/maintenance/recalls/${recall.id}`)
  }

  const S: Record<string, React.CSSProperties> = {
    page: { background: t.bg, minHeight: '100vh', color: t.text, fontFamily: FONT, padding: 24, maxWidth: 600, margin: '0 auto' },
    card: { background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, padding: 20, marginBottom: 12 },
    label: { fontFamily: MONO, fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: t.textTertiary, marginBottom: 5, display: 'block' },
    input: { width: '100%', padding: '9px 12px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 12, color: t.text, outline: 'none', fontFamily: 'inherit', minHeight: 38, boxSizing: 'border-box' as const },
    row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 },
    btn: { padding: '12px 24px', background: t.accent, border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, color: t.bgLight, cursor: 'pointer', fontFamily: 'inherit', width: '100%' },
    error: { padding: '10px 12px', background: 'rgba(217,79,79,.08)', border: '1px solid rgba(217,79,79,.2)', borderRadius: 8, fontSize: 12, color: '#D94F4F', marginBottom: 12 },
  }

  return (
    <div style={S.page}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: t.text, marginBottom: 20 }}>New Recall</div>
      {error && <div style={S.error}>{error}</div>}
      <form onSubmit={submit}>
        <div style={S.card}>
          <div style={{ marginBottom: 10 }}><label style={S.label}>Truck</label><select style={{ ...S.input, appearance: 'none' as const }} value={form.asset_id} onChange={set('asset_id')}><option value="">Select...</option>{assets.map(a => <option key={a.id} value={a.id}>#{a.unit_number} {a.year} {a.make}</option>)}</select></div>
          <div style={{ marginBottom: 10 }}><label style={S.label}>Title *</label><input style={S.input} value={form.title} onChange={set('title')} /></div>
          <div style={S.row2}>
            <div><label style={S.label}>Recall Number</label><input style={S.input} value={form.recall_number} onChange={set('recall_number')} /></div>
            <div><label style={S.label}>NHTSA ID</label><input style={S.input} value={form.nhtsa_id} onChange={set('nhtsa_id')} /></div>
          </div>
          <div style={{ marginBottom: 10 }}><label style={S.label}>Manufacturer</label><input style={S.input} value={form.manufacturer} onChange={set('manufacturer')} /></div>
          <div style={{ marginBottom: 10 }}><label style={S.label}>Description</label><textarea style={{ ...S.input, minHeight: 64, resize: 'vertical' as const }} value={form.description} onChange={set('description')} /></div>
          <div><label style={S.label}>Remedy</label><textarea style={{ ...S.input, minHeight: 48, resize: 'vertical' as const }} value={form.remedy} onChange={set('remedy')} /></div>
        </div>
        <button type="submit" style={S.btn} disabled={saving}>{saving ? 'Creating...' : 'Add Recall'}</button>
      </form>
    </div>
  )
}
