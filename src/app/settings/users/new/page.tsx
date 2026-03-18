'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewUserPage() {
  const router = useRouter()
  const [form, setForm] = useState({ full_name:'', email:'', role:'technician', team:'A', language:'en' })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const [done,   setDone]   = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name || !form.email) { setError('Name and email required'); return }
    setSaving(true); setError('')
    const res  = await fetch('/api/users', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to invite staff member'); setSaving(false); return }
    setDone(true)
  }

  const S: Record<string, React.CSSProperties> = {
    page:  { background:'#060708', minHeight:'100vh', color:'#DDE3EE', fontFamily:"'Instrument Sans',sans-serif", padding:24, maxWidth:560, margin:'0 auto' },
    card:  { background:'#161B24', border:'1px solid rgba(255,255,255,.055)', borderRadius:12, padding:20, marginBottom:12 },
    label: { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, letterSpacing:'.1em', textTransform:'uppercase' as const, color:'#48536A', marginBottom:5, display:'block' },
    input: { width:'100%', padding:'9px 12px', background:'#1C2130', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, fontSize:12, color:'#DDE3EE', outline:'none', fontFamily:'inherit', minHeight:38, boxSizing:'border-box' as const, marginBottom:10 },
    row2:  { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 },
    btn:   { width:'100%', padding:'12px 24px', background:'linear-gradient(135deg,#1D6FE8,#1248B0)', border:'none', borderRadius:9, fontSize:13, fontWeight:700, color:'#fff', cursor:'pointer', fontFamily:'inherit', marginTop:4 },
    error: { padding:'10px 12px', background:'rgba(217,79,79,.08)', border:'1px solid rgba(217,79,79,.2)', borderRadius:8, fontSize:12, color:'#D94F4F', marginBottom:12 },
  }

  if (done) return (
    <div style={{ ...S.page, display:'flex', alignItems:'center', justifyContent:'center', minHeight:'80vh' }}>
      <div style={{ ...S.card, textAlign:'center', padding:40 }}>
        <div style={{ fontSize:40, marginBottom:16 }}>✅</div>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:24, color:'#F0F4FF', marginBottom:8 }}>Invite Sent</div>
        <div style={{ fontSize:13, color:'#7C8BA0', lineHeight:1.6, marginBottom:20 }}>
          {form.full_name} will receive a welcome email at <strong style={{ color:'#DDE3EE' }}>{form.email}</strong> with instructions to set their password and log in.
        </div>
        <div style={{ display:'flex', gap:8', justifyContent:'center', flexWrap:'wrap' }}>
          <button style={{ ...S.btn, width:'auto', padding:'10px 20px', fontSize:12 }} onClick={()=>{ setDone(false); setForm({ full_name:'', email:'', role:'technician', team:'A', language:'en' }) }}>+ Invite Another</button>
          <a href="/settings/users" style={{ ...S.btn, width:'auto', padding:'10px 20px', fontSize:12, background:'transparent', border:'1px solid rgba(255,255,255,.08)', color:'#7C8BA0', textDecoration:'none', textAlign:'center' }}>Back to Staff List</a>
        </div>
      </div>
    </div>
  )

  return (
    <div style={S.page}>
      <a href="/settings/users" style={{ fontSize:12, color:'#7C8BA0', textDecoration:'none', display:'block', marginBottom:20 }}>← Staff</a>
      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:'#F0F4FF', marginBottom:4 }}>Invite Staff Member</div>
      <div style={{ fontSize:12, color:'#7C8BA0', marginBottom:20 }}>They'll receive a welcome email with a link to set their password.</div>

      {error && <div style={S.error}>{error}</div>}

      <form onSubmit={submit}>
        <div style={S.card}>
          <div style={{ fontSize:12, fontWeight:700, color:'#F0F4FF', marginBottom:12 }}>Account Details</div>
          <label style={S.label}>Full Name</label>
          <input style={S.input} value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))} placeholder="Carlos Martinez" autoFocus/>
          <label style={S.label}>Work Email</label>
          <input style={S.input} type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="carlos@yourshop.com"/>

          <div style={S.row2}>
            <div>
              <label style={S.label}>Role</label>
              <select style={{ ...S.input, appearance:'none', cursor:'pointer' }} value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
                {[
                  ['technician','Technician'],['service_advisor','Service Advisor'],['service_writer','Service Writer'],
                  ['parts_manager','Parts Manager'],['fleet_manager','Fleet Manager'],['maintenance_manager','Maintenance Manager'],
                  ['maintenance_technician','Maintenance Tech'],['accountant','Accountant'],['office_admin','Office Admin'],
                  ['dispatcher','Dispatcher'],['driver','Driver'],['shop_manager','Shop Manager'],['gm','GM'],
                ].map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Team Assignment</label>
              <select style={{ ...S.input, appearance:'none', cursor:'pointer' }} value={form.team} onChange={e=>setForm(f=>({...f,team:e.target.value}))}>
                <option value="A">Team A — Engine</option>
                <option value="B">Team B — Electrical</option>
                <option value="C">Team C — Body</option>
                <option value="D">Team D — Inspection</option>
              </select>
            </div>
          </div>

          <label style={S.label}>Language</label>
          <select style={{ ...S.input, appearance:'none', cursor:'pointer' }} value={form.language} onChange={e=>setForm(f=>({...f,language:e.target.value}))}>
            <option value="en">English 🇺🇸</option>
            <option value="ru">Russian 🇷🇺</option>
            <option value="uz">Uzbek 🇺🇿</option>
            <option value="es">Spanish 🇲🇽</option>
          </select>
        </div>

        <div style={{ background:'rgba(29,111,232,.06)', border:'1px solid rgba(29,111,232,.15)', borderRadius:9, padding:'12px 14px', fontSize:11, color:'#7C8BA0', marginBottom:12 }}>
          A welcome email will be sent with a login link. They set their own password on first login. No password is sent via email.
        </div>

        <button type="submit" style={S.btn} disabled={saving}>{saving?'Sending invite...':'Send Invite →'}</button>
      </form>
    </div>
  )
}
