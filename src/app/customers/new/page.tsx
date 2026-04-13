'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

export default function NewCustomerPage() {
  const { tokens: th } = useTheme()
  const router = useRouter()
  const [form, setForm] = useState({ company_name:'', contact_name:'', phone:'', email:'', address:'', city:'', state:'TX', zip:'', payment_terms:'Net 30', default_ownership_type:'fleet_asset', notes:'' })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.company_name) { setError('Company name required'); return }
    setSaving(true); setError('')
    const res  = await fetch('/api/customers', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed'); setSaving(false); return }
    router.push(`/customers/${data.id}`)
  }

  const upd = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  const S: Record<string, React.CSSProperties> = {
    page:  { background:'var(--tz-bg)', minHeight:'100vh', color:'var(--tz-text)', fontFamily:"'Instrument Sans',sans-serif", padding:24, maxWidth:600, margin:'0 auto' },
    title: { fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:'var(--tz-text)', marginBottom:4 },
    card:  { background:'var(--tz-bgCard)', border:`1px solid ${'var(--tz-border)'}`, borderRadius:12, padding:20, marginBottom:12 },
    label: { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, letterSpacing:'.1em', textTransform:'uppercase' as const, color:'var(--tz-textTertiary)', marginBottom:5, display:'block' },
    input: { width:'100%', padding:'9px 12px', background:'var(--tz-inputBg)', border:`1px solid ${'var(--tz-border)'}`, borderRadius:8, fontSize:12, color:'var(--tz-text)', outline:'none', fontFamily:'inherit', minHeight:38, boxSizing:'border-box' as const },
    row2:  { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 },
    row3:  { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 },
    btn:   { padding:'12px 24px', background:'var(--tz-accent)', border:'none', borderRadius:9, fontSize:13, fontWeight:700, color:'var(--tz-bgLight)', cursor:'pointer', fontFamily:'inherit', width:'100%' },
    error: { padding:'10px 12px', background:'rgba(217,79,79,.08)', border:'1px solid rgba(217,79,79,.2)', borderRadius:8, fontSize:12, color:'#D94F4F', marginBottom:12 },
  }

  return (
    <div style={S.page}>
      <a href="/customers" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--tz-border)', borderRadius: 8, fontSize: 14, fontWeight: 700, color: 'var(--tz-text)', textDecoration: 'none', marginBottom: 20 }}>
  <ChevronLeft size={16} strokeWidth={2} /> Customers
</a>
      <div style={S.title}>Add Customer</div>
      <div style={{ fontSize:12, color:'var(--tz-textSecondary)', marginBottom:20 }}>Add a new fleet company or owner to your customer list.</div>
      {error && <div style={S.error}>{error}</div>}
      <form onSubmit={submit}>
        <div style={S.card}>
          <div style={S.row2}>
            <div><label style={S.label}>Company Name *</label><input style={S.input} value={form.company_name} onChange={upd('company_name')} placeholder="e.g. TURON Transport LLC" required/></div>
            <div><label style={S.label}>Contact Name</label><input style={S.input} value={form.contact_name} onChange={upd('contact_name')} placeholder="Primary contact"/></div>
          </div>
          <div style={S.row2}>
            <div><label style={S.label}>Phone</label><input style={S.input} value={form.phone} onChange={upd('phone')} placeholder="(713) 000-0000"/></div>
            <div><label style={S.label}>Email</label><input style={S.input} type="email" value={form.email} onChange={upd('email')} placeholder="billing@company.com"/></div>
          </div>
          <div style={S.row3}>
            <div><label style={S.label}>City</label><input style={S.input} value={form.city} onChange={upd('city')} placeholder="Houston"/></div>
            <div><label style={S.label}>State</label><input style={S.input} value={form.state} onChange={upd('state')} maxLength={2}/></div>
            <div><label style={S.label}>ZIP</label><input style={S.input} value={form.zip} onChange={upd('zip')}/></div>
          </div>
          <div style={S.row2}>
            <div><label style={S.label}>Payment Terms</label>
              <select style={{ ...S.input, appearance:'none', cursor:'pointer' }} value={form.payment_terms} onChange={upd('payment_terms')}>
                {['Net 30','Net 15','Net 60','COD','Credit Card','Prepaid'].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div><label style={S.label}>Default Truck Type *</label>
              <select style={{ ...S.input, appearance:'none', cursor:'pointer' }} value={form.default_ownership_type} onChange={upd('default_ownership_type')}>
                <option value="fleet_asset">Company Truck</option>
                <option value="owner_operator">Owner Operator</option>
                <option value="outside_customer">Outside Customer</option>
              </select>
              <div style={{ fontSize: 10, color: 'var(--tz-textTertiary)', marginTop: 3 }}>New trucks default to this type</div>
            </div>
          </div>
          <div><label style={S.label}>Notes</label><input style={S.input} value={form.notes} onChange={upd('notes')} placeholder="Optional notes"/></div>
        </div>
        <button type="submit" style={S.btn} disabled={saving}>{saving?'Adding...':'Add Customer →'}</button>
      </form>
    </div>
  )
}
