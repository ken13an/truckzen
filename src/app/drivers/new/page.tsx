'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

export default function NewDriverPage() {
  const router = useRouter()
  const supabase = createClient()
  const [customers, setCustomers] = useState<any[]>([])
  const [form, setForm] = useState({ full_name:'', phone:'', email:'', cdl_number:'', cdl_class:'A', cdl_expiry:'', medical_card_expiry:'', customer_id:'', notes:'' })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { router.push('/login'); return }
      const { data } = await supabase.from('customers').select('id, company_name').eq('shop_id', profile.shop_id).order('company_name')
      setCustomers(data || [])
    }
    load()
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name) { setError('Full name required'); return }
    setSaving(true); setError('')
    const res  = await fetch('/api/drivers', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed'); setSaving(false); return }
    router.push(`/drivers/${data.id}`)
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
    btn:   { padding:'12px 24px', background:'linear-gradient(135deg,#1D6FE8,#1248B0)', border:'none', borderRadius:9, fontSize:13, fontWeight:700, color:'#fff', cursor:'pointer', fontFamily:'inherit', width:'100%' },
    error: { padding:'10px 12px', background:'rgba(217,79,79,.08)', border:'1px solid rgba(217,79,79,.2)', borderRadius:8, fontSize:12, color:'#D94F4F', marginBottom:12 },
  }

  return (
    <div style={S.page}>
      <a href="/drivers" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 14, fontWeight: 700, color: '#EDEDF0', textDecoration: 'none', marginBottom: 20 }}>
  <ChevronLeft size={16} strokeWidth={2} /> Drivers
</a>
      <div style={S.title}>Add Driver</div>
      <div style={{ fontSize:12, color:'#7C8BA0', marginBottom:20 }}>Add a driver to track CDL and medical card expiry.</div>
      {error && <div style={S.error}>{error}</div>}
      <form onSubmit={submit}>
        <div style={S.card}>
          <div style={{ fontSize:12, fontWeight:700, color:'#F0F4FF', marginBottom:12 }}>Personal Info</div>
          <div style={S.row2}>
            <div><label style={S.label}>Full Name *</label><input style={S.input} value={form.full_name} onChange={upd('full_name')} placeholder="First Last" required/></div>
            <div><label style={S.label}>Phone</label><input style={S.input} value={form.phone} onChange={upd('phone')} placeholder="(713) 000-0000"/></div>
          </div>
          <div style={S.row2}>
            <div><label style={S.label}>Email</label><input style={S.input} type="email" value={form.email} onChange={upd('email')} placeholder="driver@company.com"/></div>
            <div><label style={S.label}>Employer</label>
              <select style={{ ...S.input, appearance:'none', cursor:'pointer' }} value={form.customer_id} onChange={upd('customer_id')}>
                <option value="">No company assigned</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={S.card}>
          <div style={{ fontSize:12, fontWeight:700, color:'#F0F4FF', marginBottom:12 }}>CDL & Compliance</div>
          <div style={S.row3}>
            <div><label style={S.label}>CDL Number</label><input style={S.input} value={form.cdl_number} onChange={upd('cdl_number')} placeholder="TX12345678"/></div>
            <div><label style={S.label}>CDL Class</label>
              <select style={{ ...S.input, appearance:'none', cursor:'pointer' }} value={form.cdl_class} onChange={upd('cdl_class')}>
                {['A','B','C'].map(c=><option key={c} value={c}>Class {c}</option>)}
              </select>
            </div>
            <div><label style={S.label}>CDL Expiry</label><input style={S.input} type="date" value={form.cdl_expiry} onChange={upd('cdl_expiry')}/></div>
          </div>
          <div style={S.row2}>
            <div><label style={S.label}>Medical Card Expiry</label><input style={S.input} type="date" value={form.medical_card_expiry} onChange={upd('medical_card_expiry')}/></div>
            <div><label style={S.label}>Notes</label><input style={S.input} value={form.notes} onChange={upd('notes')} placeholder="Optional notes"/></div>
          </div>
        </div>

        <button type="submit" style={S.btn} disabled={saving}>{saving ? 'Adding...' : 'Add Driver →'}</button>
      </form>
    </div>
  )
}
