'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"

export default function NewPartPage() {
  const { tokens: t } = useTheme()
  const router = useRouter()
  const supabase = createClient()
  const [shopId, setShopId] = useState('')
  const [vendors, setVendors] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ part_number: '', description: '', category: '', on_hand: '0', reorder_point: '0', cost_price: '', vendor_id: '', bin_location: '', notes: '' })

  useEffect(() => {
    getCurrentUser(supabase).then(async p => {
      if (!p) { router.push('/login'); return }
      setShopId(p.shop_id)
      const { data } = await supabase.from('maint_vendors').select('id, name').eq('shop_id', p.shop_id).eq('active', true).order('name')
      setVendors(data || [])
    })
  }, [])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.description) { setError('Description required'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/maintenance/crud', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'maint_parts', shop_id: shopId,
        part_number: form.part_number || null, description: form.description,
        category: form.category || null, on_hand: parseInt(form.on_hand) || 0,
        reorder_point: parseInt(form.reorder_point) || 0,
        cost_price: form.cost_price ? parseFloat(form.cost_price) : 0,
        vendor_id: form.vendor_id || null, bin_location: form.bin_location || null,
        notes: form.notes || null,
      }),
    })
    if (!res.ok) { setError('Failed to create'); setSaving(false); return }
    router.push('/maintenance/parts')
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
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: t.text, marginBottom: 20 }}>New Part</div>
      {error && <div style={S.error}>{error}</div>}
      <form onSubmit={submit}>
        <div style={S.card}>
          <div style={S.row2}>
            <div><label style={S.label}>Part Number</label><input style={S.input} value={form.part_number} onChange={set('part_number')} /></div>
            <div><label style={S.label}>Category</label><input style={S.input} value={form.category} onChange={set('category')} placeholder="e.g. filters, brakes" /></div>
          </div>
          <div style={{ marginBottom: 10 }}><label style={S.label}>Description *</label><input style={S.input} value={form.description} onChange={set('description')} /></div>
          <div style={S.row2}>
            <div><label style={S.label}>On Hand</label><input style={S.input} type="number" value={form.on_hand} onChange={set('on_hand')} /></div>
            <div><label style={S.label}>Reorder Point</label><input style={S.input} type="number" value={form.reorder_point} onChange={set('reorder_point')} /></div>
          </div>
          <div style={S.row2}>
            <div><label style={S.label}>Cost Price</label><input style={S.input} type="number" step="0.01" value={form.cost_price} onChange={set('cost_price')} /></div>
            <div><label style={S.label}>Bin Location</label><input style={S.input} value={form.bin_location} onChange={set('bin_location')} /></div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={S.label}>Vendor</label>
            <select style={{ ...S.input, appearance: 'none' as const }} value={form.vendor_id} onChange={set('vendor_id')}>
              <option value="">Select vendor...</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div><label style={S.label}>Notes</label><textarea style={{ ...S.input, minHeight: 48, resize: 'vertical' as const }} value={form.notes} onChange={set('notes')} /></div>
        </div>
        <button type="submit" style={S.btn} disabled={saving}>{saving ? 'Creating...' : 'Add Part'}</button>
      </form>
    </div>
  )
}
