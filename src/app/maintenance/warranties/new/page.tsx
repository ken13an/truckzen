'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const TYPES = ['powertrain', 'bumper_to_bumper', 'tire', 'aftermarket', 'extended', 'other']

export default function NewWarrantyPage() {
  const { tokens: th } = useTheme()
  const router = useRouter()
  const supabase = createClient()
  const [shopId, setShopId] = useState('')
  const [assets, setAssets] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ asset_id: '', warranty_type: 'powertrain', provider: '', coverage_description: '', start_date: '', end_date: '', start_miles: '', end_miles: '', notes: '' })

  useEffect(() => {
    getCurrentUser(supabase).then(async p => {
      if (!p) { router.push('/login'); return }
      setShopId(p.shop_id)
      const { data } = await supabase.from('assets').select('id, unit_number, year, make').eq('shop_id', p.shop_id).eq('status', 'active').is('deleted_at', null).order('unit_number')
      setAssets(data || [])
    })
  }, [])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.asset_id || !form.warranty_type) { setError('Truck and type required'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/maintenance/crud', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table: 'maint_warranties', shop_id: shopId, asset_id: form.asset_id, warranty_type: form.warranty_type, provider: form.provider || null, coverage_description: form.coverage_description || null, start_date: form.start_date || null, end_date: form.end_date || null, start_miles: form.start_miles ? parseInt(form.start_miles) : null, end_miles: form.end_miles ? parseInt(form.end_miles) : null, current_status: 'active', notes: form.notes || null }) })
    if (!res.ok) { setError('Failed'); setSaving(false); return }
    router.push('/maintenance/warranties')
  }

  const S: Record<string, React.CSSProperties> = {
    page: { background: 'var(--tz-bg)', minHeight: '100vh', color: 'var(--tz-text)', fontFamily: FONT, padding: 24, maxWidth: 600, margin: '0 auto' },
    card: { background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, padding: 20, marginBottom: 12 },
    label: { fontFamily: MONO, fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: 'var(--tz-textTertiary)', marginBottom: 5, display: 'block' },
    input: { width: '100%', padding: '9px 12px', background: 'var(--tz-inputBg)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 8, fontSize: 12, color: 'var(--tz-text)', outline: 'none', fontFamily: 'inherit', minHeight: 38, boxSizing: 'border-box' as const },
    row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 },
    btn: { padding: '12px 24px', background: 'var(--tz-accent)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, color: 'var(--tz-bgLight)', cursor: 'pointer', fontFamily: 'inherit', width: '100%' },
    error: { padding: '10px 12px', background: 'rgba(217,79,79,.08)', border: '1px solid rgba(217,79,79,.2)', borderRadius: 8, fontSize: 12, color: '#D94F4F', marginBottom: 12 },
  }

  return (
    <div style={S.page}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: 'var(--tz-text)', marginBottom: 20 }}>New Warranty</div>
      {error && <div style={S.error}>{error}</div>}
      <form onSubmit={submit}>
        <div style={S.card}>
          <div style={{ marginBottom: 10 }}><label style={S.label}>Truck *</label><select style={{ ...S.input, appearance: 'none' as const }} value={form.asset_id} onChange={set('asset_id')}><option value="">Select...</option>{assets.map(a => <option key={a.id} value={a.id}>#{a.unit_number} {a.year} {a.make}</option>)}</select></div>
          <div style={S.row2}>
            <div><label style={S.label}>Type *</label><select style={{ ...S.input, appearance: 'none' as const }} value={form.warranty_type} onChange={set('warranty_type')}>{TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></div>
            <div><label style={S.label}>Provider</label><input style={S.input} value={form.provider} onChange={set('provider')} /></div>
          </div>
          <div style={{ marginBottom: 10 }}><label style={S.label}>Coverage</label><textarea style={{ ...S.input, minHeight: 48, resize: 'vertical' as const }} value={form.coverage_description} onChange={set('coverage_description')} /></div>
          <div style={S.row2}>
            <div><label style={S.label}>Start Date</label><input style={S.input} type="date" value={form.start_date} onChange={set('start_date')} /></div>
            <div><label style={S.label}>End Date</label><input style={S.input} type="date" value={form.end_date} onChange={set('end_date')} /></div>
          </div>
          <div style={S.row2}>
            <div><label style={S.label}>Start Miles</label><input style={S.input} type="number" value={form.start_miles} onChange={set('start_miles')} /></div>
            <div><label style={S.label}>End Miles</label><input style={S.input} type="number" value={form.end_miles} onChange={set('end_miles')} /></div>
          </div>
          <div><label style={S.label}>Notes</label><textarea style={{ ...S.input, minHeight: 48, resize: 'vertical' as const }} value={form.notes} onChange={set('notes')} /></div>
        </div>
        <button type="submit" style={S.btn} disabled={saving}>{saving ? 'Creating...' : 'Add Warranty'}</button>
      </form>
    </div>
  )
}
