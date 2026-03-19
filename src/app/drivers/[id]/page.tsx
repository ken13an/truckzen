'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

export default function DriverDetailPage() {
  const params = useParams(); const router = useRouter()
  const supabase = createClient()
  const [driver,  setDriver]  = useState<any>(null)
  const [edit,    setEdit]    = useState<any>(null)
  const [saving,  setSaving]  = useState(false)
  const [loading, setLoading] = useState(true)
  const [dvirs,   setDvirs]   = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { router.push('/login'); return }
      const res = await fetch(`/api/drivers/${params.id}`)
      if (!res.ok) { router.push('/drivers'); return }
      const data = await res.json()
      setDriver(data); setEdit(data)
      setDvirs((data.dvir_submissions || []).slice(0, 10))
      setLoading(false)
    }
    load()
  }, [params.id])

  async function save() {
    setSaving(true)
    await fetch(`/api/drivers/${params.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: edit.full_name, phone: edit.phone, email: edit.email,
        cdl_number: edit.cdl_number, cdl_class: edit.cdl_class,
        cdl_expiry: edit.cdl_expiry, medical_card_expiry: edit.medical_card_expiry,
        notes: edit.notes,
      }),
    })
    setDriver(edit); setSaving(false)
  }

  const today    = new Date().toISOString().split('T')[0]
  const in30days = new Date(Date.now() + 30*86400000).toISOString().split('T')[0]

  const expiryStatus = (date?: string) => {
    if (!date) return { color:'#9D9DA1', label:'No date set' }
    if (date < today)     return { color:'#FF5C5C', label:'EXPIRED' }
    if (date <= in30days) return { color:'#FFB84D', label:'Expiring soon' }
    return { color:'#00E0B0', label:'Valid' }
  }

  const S: Record<string, React.CSSProperties> = {
    page:  { background:'#08080C', minHeight:'100vh', color:'#EDEDF0', fontFamily:"'Instrument Sans',sans-serif", padding:24, maxWidth:720, margin:'0 auto' },
    card:  { background:'#1A1A24', border:'1px solid rgba(255,255,255,.055)', borderRadius:12, padding:18, marginBottom:12 },
    label: { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, letterSpacing:'.1em', textTransform:'uppercase' as const, color:'#9D9DA1', marginBottom:5, display:'block' },
    input: { width:'100%', padding:'9px 12px', background:'#1A1A24', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, fontSize:12, color:'#EDEDF0', outline:'none', fontFamily:'inherit', minHeight:38, boxSizing:'border-box' as const },
    row2:  { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 },
    row3:  { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 },
    th:    { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:'#9D9DA1', textTransform:'uppercase', letterSpacing:'.08em', padding:'6px 10px', textAlign:'left', background:'#08080C' },
    td:    { padding:'9px 10px', borderBottom:'1px solid rgba(255,255,255,.025)', fontSize:11 },
    btn:   { padding:'9px 18px', borderRadius:8, border:'none', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  }

  if (loading) return <div style={{ ...S.page, color:'#9D9DA1', padding:60 }}>Loading...</div>

  const cdlSt = expiryStatus(driver.cdl_expiry)
  const medSt = expiryStatus(driver.medical_card_expiry)

  return (
    <div style={S.page}>
      <a href="/drivers" style={{ fontSize:12, color:'#9D9DA1', textDecoration:'none', display:'block', marginBottom:20 }}>← Drivers</a>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:'#EDEDF0' }}>{driver.full_name}</div>
          <div style={{ fontSize:12, color:'#9D9DA1', marginTop:4 }}>{(driver.customers as any)?.company_name}</div>
        </div>
        <span style={{ padding:'4px 12px', borderRadius:100, fontFamily:'monospace', fontSize:9, background: driver.status==='active'?'rgba(29,184,112,.1)':'rgba(72,83,106,.1)', color: driver.status==='active'?'#00E0B0':'#9D9DA1', border:`1px solid currentColor` }}>
          {driver.status?.toUpperCase()}
        </span>
      </div>

      {/* Compliance status cards */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
        {[
          { label:'CDL Expiry',     date: driver.cdl_expiry,           st: cdlSt, sub: driver.cdl_class ? `Class ${driver.cdl_class}` : 'No class set' },
          { label:'Medical Card',   date: driver.medical_card_expiry,  st: medSt, sub: 'DOT Medical Certificate' },
        ].map(item => (
          <div key={item.label} style={{ background:'#1A1A24', border:`1px solid ${item.st.color}33`, borderRadius:12, padding:14 }}>
            <div style={{ fontFamily:'monospace', fontSize:8, letterSpacing:'.1em', textTransform:'uppercase', color:'#9D9DA1', marginBottom:6 }}>{item.label}</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:24, color:item.st.color }}>{item.date || '—'}</div>
            <div style={{ fontSize:10, color:item.st.color, marginTop:3 }}>{item.st.label} · {item.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:14, alignItems:'start' }}>
        <div>
          {/* Edit form */}
          <div style={S.card}>
            <div style={{ fontSize:12, fontWeight:700, color:'#EDEDF0', marginBottom:12 }}>Driver Details</div>
            <div style={S.row2}>
              <div><label style={S.label}>Full Name</label><input style={S.input} value={edit?.full_name||''} onChange={e=>setEdit((d:any)=>({...d,full_name:e.target.value}))}/></div>
              <div><label style={S.label}>Phone</label><input style={S.input} value={edit?.phone||''} onChange={e=>setEdit((d:any)=>({...d,phone:e.target.value}))}/></div>
            </div>
            <div style={{ marginBottom:10 }}><label style={S.label}>Email</label><input style={S.input} type="email" value={edit?.email||''} onChange={e=>setEdit((d:any)=>({...d,email:e.target.value}))}/></div>
            <div style={S.row3}>
              <div><label style={S.label}>CDL Number</label><input style={S.input} value={edit?.cdl_number||''} onChange={e=>setEdit((d:any)=>({...d,cdl_number:e.target.value}))}/></div>
              <div><label style={S.label}>CDL Class</label>
                <select style={{ ...S.input, appearance:'none', cursor:'pointer' }} value={edit?.cdl_class||''} onChange={e=>setEdit((d:any)=>({...d,cdl_class:e.target.value}))}>
                  <option value="">Select class</option>
                  {['A','B','C'].map(c=><option key={c} value={c}>Class {c}</option>)}
                </select>
              </div>
              <div><label style={S.label}>CDL Expiry</label><input style={S.input} type="date" value={edit?.cdl_expiry||''} onChange={e=>setEdit((d:any)=>({...d,cdl_expiry:e.target.value}))}/></div>
            </div>
            <div style={S.row2}>
              <div><label style={S.label}>Medical Card Expiry</label><input style={S.input} type="date" value={edit?.medical_card_expiry||''} onChange={e=>setEdit((d:any)=>({...d,medical_card_expiry:e.target.value}))}/></div>
              <div><label style={S.label}>Status</label>
                <select style={{ ...S.input, appearance:'none', cursor:'pointer' }} value={edit?.status||'active'} onChange={e=>setEdit((d:any)=>({...d,status:e.target.value}))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom:12 }}><label style={S.label}>Notes</label><textarea style={{ ...S.input, minHeight:60, resize:'vertical' as const }} value={edit?.notes||''} onChange={e=>setEdit((d:any)=>({...d,notes:e.target.value}))}/></div>
            <button style={{ ...S.btn, background:'linear-gradient(135deg,#00E0B0,#00E0B0)', color:'#fff' }} onClick={save} disabled={saving}>{saving?'Saving...':'Save Changes'}</button>
          </div>
        </div>

        {/* DVIR history sidebar */}
        <div style={S.card}>
          <div style={{ fontSize:12, fontWeight:700, color:'#EDEDF0', marginBottom:12 }}>Recent DVIRs</div>
          {dvirs.length === 0 ? <div style={{ color:'#9D9DA1', fontSize:12, textAlign:'center', padding:16 }}>No DVIRs on file</div>
          : dvirs.map((d:any) => (
            <div key={d.id} style={{ padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,.04)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ fontSize:11, color:'#EDEDF0' }}>{d.submitted_at?.split('T')[0]}</div>
                <span style={{ fontSize:9, fontWeight:700, fontFamily:'monospace', color: d.defects_found?'#FF5C5C':'#00E0B0' }}>
                  {d.defects_found ? 'DEFECTS' : 'CLEAN'}
                </span>
              </div>
              <div style={{ fontSize:10, color:'#9D9DA1', marginTop:2 }}>{d.trip_type === 'pre' ? 'Pre-Trip' : 'Post-Trip'}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
