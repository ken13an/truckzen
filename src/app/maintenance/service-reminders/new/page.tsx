'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"

export default function NewServiceReminderPage() {
  const router = useRouter()
  const supabase = createClient()
  const [shopId, setShopId] = useState('')
  const [assets, setAssets] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ asset_id: '', reminder_type: 'oil_change', custom_name: '', interval_miles: '', interval_days: '', threshold_miles: '', threshold_days: '30', last_completed_date: '', last_completed_miles: '', notes: '' })

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
    if (!form.asset_id) { setError('Select a truck'); return }
    setSaving(true); setError('')
    const intDays = parseInt(form.interval_days) || null
    let nextDate: string | null = null
    if (form.last_completed_date && intDays) { const d = new Date(form.last_completed_date); d.setDate(d.getDate() + intDays); nextDate = d.toISOString().split('T')[0] }
    const intMiles = parseInt(form.interval_miles) || null
    const lastMiles = parseInt(form.last_completed_miles) || null
    const nextMiles = intMiles && lastMiles ? lastMiles + intMiles : null
    const res = await fetch('/api/maintenance/crud', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'maint_service_reminders', shop_id: shopId, asset_id: form.asset_id, reminder_type: form.reminder_type, custom_name: form.custom_name || null, interval_miles: intMiles, interval_days: intDays, threshold_miles: parseInt(form.threshold_miles) || null, threshold_days: parseInt(form.threshold_days) || 30, last_completed_date: form.last_completed_date || null, last_completed_miles: lastMiles, next_due_date: nextDate, next_due_miles: nextMiles, status: 'active', notes: form.notes || null }),
    })
    if (!res.ok) { setError('Failed'); setSaving(false); return }
    router.push('/maintenance/service-reminders')
  }

  const S: Record<string, React.CSSProperties> = {
    page: { background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: FONT, padding: 24, maxWidth: 600, margin: '0 auto' },
    card: { background: '#161B24', border: '1px solid rgba(255,255,255,.055)', borderRadius: 12, padding: 20, marginBottom: 12 },
    label: { fontFamily: MONO, fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: '#48536A', marginBottom: 5, display: 'block' },
    input: { width: '100%', padding: '9px 12px', background: '#1C2130', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 12, color: '#DDE3EE', outline: 'none', fontFamily: 'inherit', minHeight: 38, boxSizing: 'border-box' as const },
    row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 },
    btn: { padding: '12px 24px', background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', width: '100%' },
    error: { padding: '10px 12px', background: 'rgba(217,79,79,.08)', border: '1px solid rgba(217,79,79,.2)', borderRadius: 8, fontSize: 12, color: '#D94F4F', marginBottom: 12 },
  }

  return (
    <div style={S.page}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF', marginBottom: 20 }}>New Service Reminder</div>
      {error && <div style={S.error}>{error}</div>}
      <form onSubmit={submit}>
        <div style={S.card}>
          <div style={{ marginBottom: 10 }}><label style={S.label}>Truck *</label><select style={{ ...S.input, appearance: 'none' as const }} value={form.asset_id} onChange={set('asset_id')}><option value="">Select...</option>{assets.map(a => <option key={a.id} value={a.id}>#{a.unit_number} {a.year} {a.make}</option>)}</select></div>
          <div style={S.row2}>
            <div><label style={S.label}>Type</label><select style={{ ...S.input, appearance: 'none' as const }} value={form.reminder_type} onChange={set('reminder_type')}>{['oil_change','dot_annual','brake_inspection','tire_rotation','transmission','coolant_flush','custom'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></div>
            <div><label style={S.label}>Custom Name</label><input style={S.input} value={form.custom_name} onChange={set('custom_name')} /></div>
          </div>
          <div style={S.row2}>
            <div><label style={S.label}>Interval Miles</label><input style={S.input} type="number" value={form.interval_miles} onChange={set('interval_miles')} placeholder="15000" /></div>
            <div><label style={S.label}>Interval Days</label><input style={S.input} type="number" value={form.interval_days} onChange={set('interval_days')} placeholder="90" /></div>
          </div>
          <div style={S.row2}>
            <div><label style={S.label}>Warning Miles Before</label><input style={S.input} type="number" value={form.threshold_miles} onChange={set('threshold_miles')} placeholder="1000" /></div>
            <div><label style={S.label}>Warning Days Before</label><input style={S.input} type="number" value={form.threshold_days} onChange={set('threshold_days')} /></div>
          </div>
          <div style={S.row2}>
            <div><label style={S.label}>Last Completed Date</label><input style={S.input} type="date" value={form.last_completed_date} onChange={set('last_completed_date')} /></div>
            <div><label style={S.label}>Last Completed Miles</label><input style={S.input} type="number" value={form.last_completed_miles} onChange={set('last_completed_miles')} /></div>
          </div>
          <div><label style={S.label}>Notes</label><textarea style={{ ...S.input, minHeight: 48, resize: 'vertical' as const }} value={form.notes} onChange={set('notes')} /></div>
        </div>
        <button type="submit" style={S.btn} disabled={saving}>{saving ? 'Creating...' : 'Create Reminder'}</button>
      </form>
    </div>
  )
}
