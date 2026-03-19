'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewCustomerPage() {
  const router = useRouter()
  const [form, setForm] = useState({ company_name:'', contact_name:'', phone:'', email:'', address:'', city:'', state:'TX', zip:'', payment_terms:'Net 30', notes:'' })
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
    page:  { background:'#060708', minHeight:'100vh', color:'#DDE3EE', fontFamily:"'Instrument Sans',sans-serif", padding:24, maxWidth:600, margin:'0 auto' },
    title: { fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:'#F0F4FF', marginBottom:4 },
    card:  { background:'#161B24', border:'1px solid rgba(255,255,255,.055)', borderRadius:12, padding:20, marginBottom:12 },
    label: { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, letterSpacing:'.1em', textTransform:'uppercase' as const, color:'#48536A', marginBottom:5, display:'block' },
    input: { width:'100%', padding:'9px 12px', background:'#1C2130', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, fontSize:12, color:'#DDE3EE', outline:'none', fontFamily:'inherit', minHeight:38, boxSizing:'border-box' as const },
    row2:  { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 },
    row3:  { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 },
    btn:   { padding:'12px 24px', background:'linear-gradient(135deg,#00E0B0,#00805F)', border:'none', borderRadius:9, fontSize:13, fontWeight:700, color:'#fff', cursor:'pointer', fontFamily:'inherit', width:'100%' },
    error: { padding:'10px 12px', background:'rgba(217,79,79,.08)', border:'1px solid rgba(217,79,79,.2)', borderRadius:8, fontSize:12, color:'#D94F4F', marginBottom:12 },
  }

  return (
    <div style={S.page}>
      <a href="/customers" style={{ fontSize:12, color:'#7C8BA0', textDecoration:'none', display:'block', marginBottom:20 }}>← Customers</a>
      <div style={S.title}>Add Customer</div>
      <div style={{ fontSize:12, color:'#7C8BA0', marginBottom:20 }}>Add a new fleet company or owner to your customer list.</div>
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
            <div><label style={S.label}>Notes</label><input style={S.input} value={form.notes} onChange={upd('notes')} placeholder="Optional notes"/></div>
          </div>
        </div>
        <button type="submit" style={S.btn} disabled={saving}>{saving?'Adding...':'Add Customer →'}</button>
      </form>
    </div>
  )
}
