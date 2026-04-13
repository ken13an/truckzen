'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"

export default function NewEquipmentPage() {
  const { tokens: t } = useTheme()
  const router = useRouter()
  const supabase = createClient()
  const [shopId, setShopId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', serial_number: '', equipment_type: '', purchase_date: '', purchase_cost: '', location: '', assigned_to: '', pm_interval_days: '', notes: '' })

  useEffect(() => { getCurrentUser(supabase).then(p => { if (!p) router.push('/login'); else setShopId(p.shop_id) }) }, [])
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name) { setError('Name required'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/maintenance/crud', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'maint_equipment', shop_id: shopId,
        name: form.name, serial_number: form.serial_number || null,
        equipment_type: form.equipment_type || null, purchase_date: form.purchase_date || null,
        purchase_cost: form.purchase_cost ? parseFloat(form.purchase_cost) : null,
        location: form.location || null, assigned_to: form.assigned_to || null,
        pm_interval_days: form.pm_interval_days ? parseInt(form.pm_interval_days) : null,
        status: 'active', notes: form.notes || null,
      }),
    })
    if (!res.ok) { setError('Failed'); setSaving(false); return }
    router.push('/maintenance/equipment')
  }

  const S: Record<string, React.CSSProperties> = {
    page: { background: t.bg, minHeight: '100vh', color: t.text, fontFamily: FONT, padding: 24, maxWidth: 560, margin: '0 auto' },
    card: { background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, padding: 20, marginBottom: 12 },
    label: { fontFamily: MONO, fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: t.textTertiary, marginBottom: 5, display: 'block' },
    input: { width: '100%', padding: '9px 12px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 12, color: t.text, outline: 'none', fontFamily: 'inherit', minHeight: 38, boxSizing: 'border-box' as const },
    row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 },
    btn: { padding: '12px 24px', background: t.accent, border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, color: t.bgLight, cursor: 'pointer', fontFamily: 'inherit', width: '100%' },
    error: { padding: '10px 12px', background: 'rgba(217,79,79,.08)', border: '1px solid rgba(217,79,79,.2)', borderRadius: 8, fontSize: 12, color: '#D94F4F', marginBottom: 12 },
  }

  return (
    <div style={S.page}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: t.text, marginBottom: 20 }}>New Equipment</div>
      {error && <div style={S.error}>{error}</div>}
      <form onSubmit={submit}>
        <div style={S.card}>
          <div style={S.row2}>
            <div><label style={S.label}>Name *</label><input style={S.input} value={form.name} onChange={set('name')} /></div>
            <div><label style={S.label}>Serial #</label><input style={S.input} value={form.serial_number} onChange={set('serial_number')} /></div>
          </div>
          <div style={S.row2}>
            <div><label style={S.label}>Type</label><input style={S.input} value={form.equipment_type} onChange={set('equipment_type')} placeholder="e.g. compressor, lift" /></div>
            <div><label style={S.label}>Location</label><input style={S.input} value={form.location} onChange={set('location')} /></div>
          </div>
          <div style={S.row2}>
            <div><label style={S.label}>Purchase Date</label><input style={S.input} type="date" value={form.purchase_date} onChange={set('purchase_date')} /></div>
            <div><label style={S.label}>Purchase Cost</label><input style={S.input} type="number" step="0.01" value={form.purchase_cost} onChange={set('purchase_cost')} /></div>
          </div>
          <div style={S.row2}>
            <div><label style={S.label}>Assigned To</label><input style={S.input} value={form.assigned_to} onChange={set('assigned_to')} /></div>
            <div><label style={S.label}>PM Interval (days)</label><input style={S.input} type="number" value={form.pm_interval_days} onChange={set('pm_interval_days')} /></div>
          </div>
          <div><label style={S.label}>Notes</label><textarea style={{ ...S.input, minHeight: 48, resize: 'vertical' as const }} value={form.notes} onChange={set('notes')} /></div>
        </div>
        <button type="submit" style={S.btn} disabled={saving}>{saving ? 'Saving...' : 'Add Equipment'}</button>
      </form>
    </div>
  )
}
