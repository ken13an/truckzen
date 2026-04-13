'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const TYPES = ['cdl', 'medical_card', 'drug_test', 'mvr', 'other']

export default function NewContactRenewalPage() {
  const { tokens: th } = useTheme()
  const router = useRouter()
  const supabase = createClient()
  const [shopId, setShopId] = useState('')
  const [drivers, setDrivers] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ driver_id: '', renewal_type: 'cdl', custom_name: '', expiry_date: '', reminder_days_before: '30', cost: '', notes: '' })

  useEffect(() => {
    getCurrentUser(supabase).then(async p => {
      if (!p) { router.push('/login'); return }
      setShopId(p.shop_id)
      const { data } = await supabase.from('maint_drivers').select('id, full_name').eq('shop_id', p.shop_id).eq('active', true).order('full_name')
      setDrivers(data || [])
    })
  }, [])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.driver_id || !form.expiry_date) { setError('Driver and expiry date required'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/maintenance/crud', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table: 'maint_contact_renewals', shop_id: shopId, driver_id: form.driver_id, renewal_type: form.renewal_type, custom_name: form.custom_name || null, expiry_date: form.expiry_date, reminder_days_before: parseInt(form.reminder_days_before) || 30, cost: form.cost ? parseFloat(form.cost) : null, notes: form.notes || null, status: 'active' }) })
    if (!res.ok) { setError('Failed'); setSaving(false); return }
    router.push('/maintenance/contact-renewals')
  }

  const S: Record<string, React.CSSProperties> = {
    page: { background: th.bg, minHeight: '100vh', color: th.text, fontFamily: FONT, padding: 24, maxWidth: 520, margin: '0 auto' },
    card: { background: th.bgCard, border: `1px solid ${th.border}`, borderRadius: 12, padding: 20, marginBottom: 12 },
    label: { fontFamily: MONO, fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: th.textTertiary, marginBottom: 5, display: 'block' },
    input: { width: '100%', padding: '9px 12px', background: th.inputBg, border: `1px solid ${th.border}`, borderRadius: 8, fontSize: 12, color: th.text, outline: 'none', fontFamily: 'inherit', minHeight: 38, boxSizing: 'border-box' as const },
    row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 },
    btn: { padding: '12px 24px', background: th.accent, border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, color: th.bgLight, cursor: 'pointer', fontFamily: 'inherit', width: '100%' },
    error: { padding: '10px 12px', background: 'rgba(217,79,79,.08)', border: '1px solid rgba(217,79,79,.2)', borderRadius: 8, fontSize: 12, color: '#D94F4F', marginBottom: 12 },
  }

  return (
    <div style={S.page}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: th.text, marginBottom: 20 }}>New Contact Renewal</div>
      {error && <div style={S.error}>{error}</div>}
      <form onSubmit={submit}>
        <div style={S.card}>
          <div style={{ marginBottom: 10 }}><label style={S.label}>Driver *</label><select style={{ ...S.input, appearance: 'none' as const }} value={form.driver_id} onChange={set('driver_id')}><option value="">Select...</option>{drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}</select></div>
          <div style={S.row2}>
            <div><label style={S.label}>Type</label><select style={{ ...S.input, appearance: 'none' as const }} value={form.renewal_type} onChange={set('renewal_type')}>{TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></div>
            <div><label style={S.label}>Expiry Date *</label><input style={S.input} type="date" value={form.expiry_date} onChange={set('expiry_date')} /></div>
          </div>
          <div style={S.row2}>
            <div><label style={S.label}>Remind Days Before</label><input style={S.input} type="number" value={form.reminder_days_before} onChange={set('reminder_days_before')} /></div>
            <div><label style={S.label}>Cost</label><input style={S.input} type="number" step="0.01" value={form.cost} onChange={set('cost')} /></div>
          </div>
          <div><label style={S.label}>Notes</label><textarea style={{ ...S.input, minHeight: 48, resize: 'vertical' as const }} value={form.notes} onChange={set('notes')} /></div>
        </div>
        <button type="submit" style={S.btn} disabled={saving}>{saving ? 'Creating...' : 'Add Renewal'}</button>
      </form>
    </div>
  )
}
