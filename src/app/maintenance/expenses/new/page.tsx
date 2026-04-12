'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const TYPES = ['toll', 'permit', 'registration', 'weigh_station', 'parking', 'towing', 'fine', 'other']

export default function NewExpensePage() {
  const { tokens: th } = useTheme()
  const router = useRouter()
  const supabase = createClient()
  const [shopId, setShopId] = useState('')
  const [assets, setAssets] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ asset_id: '', driver_id: '', expense_date: new Date().toISOString().split('T')[0], expense_type: 'toll', amount: '', description: '', notes: '' })

  useEffect(() => {
    getCurrentUser(supabase).then(async p => {
      if (!p) { router.push('/login'); return }
      setShopId(p.shop_id)
      const [a, d] = await Promise.all([
        supabase.from('assets').select('id, unit_number').eq('shop_id', p.shop_id).eq('status', 'active').is('deleted_at', null).order('unit_number'),
        supabase.from('maint_drivers').select('id, full_name').eq('shop_id', p.shop_id).eq('active', true).order('full_name'),
      ])
      setAssets(a.data || [])
      setDrivers(d.data || [])
    })
  }, [])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount) { setError('Amount required'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/maintenance/crud', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'maint_expenses', shop_id: shopId,
        asset_id: form.asset_id || null, driver_id: form.driver_id || null,
        expense_date: form.expense_date, expense_type: form.expense_type,
        amount: parseFloat(form.amount), description: form.description || null, notes: form.notes || null,
      }),
    })
    if (!res.ok) { setError('Failed'); setSaving(false); return }
    router.push('/maintenance/expenses')
  }

  const S: Record<string, React.CSSProperties> = {
    page: { background: th.bg, minHeight: '100vh', color: th.text, fontFamily: FONT, padding: 24, maxWidth: 560, margin: '0 auto' },
    card: { background: '#161B24', border: '1px solid rgba(255,255,255,.055)', borderRadius: 12, padding: 20, marginBottom: 12 },
    label: { fontFamily: MONO, fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: th.textTertiary, marginBottom: 5, display: 'block' },
    input: { width: '100%', padding: '9px 12px', background: '#1C2130', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 12, color: th.text, outline: 'none', fontFamily: 'inherit', minHeight: 38, boxSizing: 'border-box' as const },
    row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 },
    btn: { padding: '12px 24px', background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', width: '100%' },
    error: { padding: '10px 12px', background: 'rgba(217,79,79,.08)', border: '1px solid rgba(217,79,79,.2)', borderRadius: 8, fontSize: 12, color: '#D94F4F', marginBottom: 12 },
  }

  return (
    <div style={S.page}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: th.text, marginBottom: 20 }}>New Expense</div>
      {error && <div style={S.error}>{error}</div>}
      <form onSubmit={submit}>
        <div style={S.card}>
          <div style={S.row2}>
            <div><label style={S.label}>Truck</label><select style={{ ...S.input, appearance: 'none' as const }} value={form.asset_id} onChange={set('asset_id')}><option value="">Select...</option>{assets.map(a => <option key={a.id} value={a.id}>#{a.unit_number}</option>)}</select></div>
            <div><label style={S.label}>Driver</label><select style={{ ...S.input, appearance: 'none' as const }} value={form.driver_id} onChange={set('driver_id')}><option value="">Select...</option>{drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}</select></div>
          </div>
          <div style={S.row2}>
            <div><label style={S.label}>Date</label><input style={S.input} type="date" value={form.expense_date} onChange={set('expense_date')} /></div>
            <div><label style={S.label}>Type</label><select style={{ ...S.input, appearance: 'none' as const }} value={form.expense_type} onChange={set('expense_type')}>{TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></div>
          </div>
          <div style={{ marginBottom: 10 }}><label style={S.label}>Amount *</label><input style={S.input} type="number" step="0.01" value={form.amount} onChange={set('amount')} /></div>
          <div style={{ marginBottom: 10 }}><label style={S.label}>Description</label><input style={S.input} value={form.description} onChange={set('description')} /></div>
          <div><label style={S.label}>Notes</label><textarea style={{ ...S.input, minHeight: 48, resize: 'vertical' as const }} value={form.notes} onChange={set('notes')} /></div>
        </div>
        <button type="submit" style={S.btn} disabled={saving}>{saving ? 'Saving...' : 'Add Expense'}</button>
      </form>
    </div>
  )
}
