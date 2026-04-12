'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"

export default function NewDriverPage() {
  const { tokens: t } = useTheme()
  const router = useRouter()
  const supabase = createClient()
  const [shopId, setShopId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    full_name: '', phone: '', email: '',
    cdl_number: '', cdl_class: 'A', cdl_state: '', cdl_expiry: '', cdl_endorsements: '', cdl_restrictions: '',
    medical_card_expiry: '', medical_card_provider: '',
    last_drug_test: '', next_drug_test_due: '',
    hire_date: '', notes: '',
  })

  useEffect(() => {
    getCurrentUser(supabase).then(p => { if (!p) router.push('/login'); else setShopId(p.shop_id) })
  }, [])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name) { setError('Full name required'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/maintenance/crud', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'maint_drivers', shop_id: shopId,
        full_name: form.full_name, phone: form.phone || null, email: form.email || null,
        cdl_number: form.cdl_number || null, cdl_class: form.cdl_class,
        cdl_state: form.cdl_state || null, cdl_expiry: form.cdl_expiry || null,
        cdl_endorsements: form.cdl_endorsements || null, cdl_restrictions: form.cdl_restrictions || null,
        medical_card_expiry: form.medical_card_expiry || null, medical_card_provider: form.medical_card_provider || null,
        last_drug_test: form.last_drug_test || null, next_drug_test_due: form.next_drug_test_due || null,
        hire_date: form.hire_date || null, notes: form.notes || null,
        active: true,
      }),
    })
    if (!res.ok) { setError('Failed to create driver'); setSaving(false); return }
    const driver = await res.json()
    router.push(`/maintenance/drivers/${driver.id}`)
  }

  const S: Record<string, React.CSSProperties> = {
    page: { background: t.bg, minHeight: '100vh', color: t.text, fontFamily: FONT, padding: 24, maxWidth: 680, margin: '0 auto' },
    card: { background: t.bgCard, border: '1px solid rgba(255,255,255,.055)', borderRadius: 12, padding: 20, marginBottom: 12 },
    label: { fontFamily: MONO, fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: t.textTertiary, marginBottom: 5, display: 'block' },
    input: { width: '100%', padding: '9px 12px', background: t.inputBg, border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 12, color: t.text, outline: 'none', fontFamily: 'inherit', minHeight: 38, boxSizing: 'border-box' as const },
    row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 },
    row3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 },
    btn: { padding: '12px 24px', background: t.accent, border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', width: '100%' },
    error: { padding: '10px 12px', background: 'rgba(217,79,79,.08)', border: '1px solid rgba(217,79,79,.2)', borderRadius: 8, fontSize: 12, color: '#D94F4F', marginBottom: 12 },
  }

  return (
    <div style={S.page}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: t.text, marginBottom: 4 }}>New Driver</div>
      <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 20 }}>Add a new driver to the fleet.</div>
      {error && <div style={S.error}>{error}</div>}
      <form onSubmit={submit}>
        <div style={S.card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 12 }}>Personal Info</div>
          <div style={{ marginBottom: 10 }}><label style={S.label}>Full Name *</label><input style={S.input} value={form.full_name} onChange={set('full_name')} placeholder="John Doe" /></div>
          <div style={S.row2}>
            <div><label style={S.label}>Phone</label><input style={S.input} value={form.phone} onChange={set('phone')} placeholder="(555) 123-4567" /></div>
            <div><label style={S.label}>Email</label><input style={S.input} type="email" value={form.email} onChange={set('email')} /></div>
          </div>
          <div><label style={S.label}>Hire Date</label><input style={S.input} type="date" value={form.hire_date} onChange={set('hire_date')} /></div>
        </div>

        <div style={S.card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 12 }}>CDL Information</div>
          <div style={S.row3}>
            <div><label style={S.label}>CDL Number</label><input style={S.input} value={form.cdl_number} onChange={set('cdl_number')} /></div>
            <div><label style={S.label}>CDL Class</label>
              <select style={{ ...S.input, appearance: 'none' as const }} value={form.cdl_class} onChange={set('cdl_class')}>
                <option value="A">Class A</option><option value="B">Class B</option><option value="C">Class C</option>
              </select>
            </div>
            <div><label style={S.label}>CDL State</label><input style={S.input} value={form.cdl_state} onChange={set('cdl_state')} placeholder="TX" /></div>
          </div>
          <div style={S.row2}>
            <div><label style={S.label}>CDL Expiry</label><input style={S.input} type="date" value={form.cdl_expiry} onChange={set('cdl_expiry')} /></div>
            <div><label style={S.label}>Endorsements</label><input style={S.input} value={form.cdl_endorsements} onChange={set('cdl_endorsements')} placeholder="H, N, T..." /></div>
          </div>
          <div><label style={S.label}>Restrictions</label><input style={S.input} value={form.cdl_restrictions} onChange={set('cdl_restrictions')} /></div>
        </div>

        <div style={S.card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 12 }}>Medical & Compliance</div>
          <div style={S.row2}>
            <div><label style={S.label}>Medical Card Expiry</label><input style={S.input} type="date" value={form.medical_card_expiry} onChange={set('medical_card_expiry')} /></div>
            <div><label style={S.label}>Medical Provider</label><input style={S.input} value={form.medical_card_provider} onChange={set('medical_card_provider')} /></div>
          </div>
          <div style={S.row2}>
            <div><label style={S.label}>Last Drug Test</label><input style={S.input} type="date" value={form.last_drug_test} onChange={set('last_drug_test')} /></div>
            <div><label style={S.label}>Next Drug Test Due</label><input style={S.input} type="date" value={form.next_drug_test_due} onChange={set('next_drug_test_due')} /></div>
          </div>
        </div>

        <div style={S.card}>
          <label style={S.label}>Notes</label>
          <textarea style={{ ...S.input, minHeight: 64, resize: 'vertical' as const }} value={form.notes} onChange={set('notes')} />
        </div>

        <button type="submit" style={S.btn} disabled={saving}>{saving ? 'Creating...' : 'Create Driver'}</button>
      </form>
    </div>
  )
}
