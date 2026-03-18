'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

export default function CustomerDetailPage() {
  const params = useParams(); const router = useRouter()
  const supabase = createClient()
  const [customer, setCustomer] = useState<any>(null)
  const [edit,     setEdit]     = useState<any>(null)
  const [saving,   setSaving]   = useState(false)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { router.push('/login'); return }
      const res  = await fetch(`/api/customers/${params.id}`)
      if (!res.ok) { router.push('/customers'); return }
      const data = await res.json()
      setCustomer(data); setEdit(data); setLoading(false)
    }
    load()
  }, [params.id])

  async function save() {
    setSaving(true)
    await fetch(`/api/customers/${params.id}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ company_name:edit.company_name, contact_name:edit.contact_name, phone:edit.phone, email:edit.email, address:edit.address, payment_terms:edit.payment_terms, notes:edit.notes }),
    })
    setCustomer(edit); setSaving(false)
  }

  const S: Record<string, React.CSSProperties> = {
    page:  { background:'#060708', minHeight:'100vh', color:'#DDE3EE', fontFamily:"'Instrument Sans',sans-serif", padding:24 },
    card:  { background:'#161B24', border:'1px solid rgba(255,255,255,.055)', borderRadius:12, padding:18, marginBottom:12 },
    label: { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, letterSpacing:'.1em', textTransform:'uppercase' as const, color:'#48536A', marginBottom:5, display:'block' },
    input: { width:'100%', padding:'9px 12px', background:'#1C2130', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, fontSize:12, color:'#DDE3EE', outline:'none', fontFamily:'inherit', minHeight:38, boxSizing:'border-box' as const },
    row2:  { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 },
    th:    { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:'#48536A', textTransform:'uppercase', letterSpacing:'.08em', padding:'6px 10px', textAlign:'left', background:'#0B0D11' },
    td:    { padding:'9px 10px', borderBottom:'1px solid rgba(255,255,255,.025)', fontSize:11 },
    btn:   { padding:'9px 18px', borderRadius:8, border:'none', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  }

  if (loading) return <div style={{ ...S.page, color:'#7C8BA0', padding:60 }}>Loading...</div>

  const vehicles = customer.assets || []
  const invoices = customer.invoices || []
  const outstanding = invoices.filter((i: any) => i.status === 'sent').reduce((s: number, i: any) => s + (i.balance_due || 0), 0)

  return (
    <div style={S.page}>
      <a href="/customers" style={{ fontSize:12, color:'#7C8BA0', textDecoration:'none', display:'block', marginBottom:20 }}>← Customers</a>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:'#F0F4FF' }}>{customer.company_name}</div>
          <div style={{ fontSize:12, color:'#7C8BA0', marginTop:4 }}>{vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''} · {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</div>
        </div>
        {outstanding > 0 && (
          <div style={{ padding:'8px 14px', background:'rgba(212,136,42,.08)', border:'1px solid rgba(212,136,42,.2)', borderRadius:9 }}>
            <div style={{ fontSize:10, color:'#D4882A', fontFamily:'monospace' }}>OUTSTANDING BALANCE</div>
            <div style={{ fontSize:20, fontWeight:700, color:'#D4882A', fontFamily:'monospace' }}>${outstanding.toFixed(0)}</div>
          </div>
        )}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:14, alignItems:'start' }}>
        <div>
          <div style={S.card}>
            <div style={{ fontSize:12, fontWeight:700, color:'#F0F4FF', marginBottom:12 }}>Contact Information</div>
            <div style={S.row2}>
              <div><label style={S.label}>Company Name</label><input style={S.input} value={edit?.company_name||''} onChange={e=>setEdit((c:any)=>({...c,company_name:e.target.value}))}/></div>
              <div><label style={S.label}>Contact Name</label><input style={S.input} value={edit?.contact_name||''} onChange={e=>setEdit((c:any)=>({...c,contact_name:e.target.value}))}/></div>
            </div>
            <div style={S.row2}>
              <div><label style={S.label}>Phone</label><input style={S.input} value={edit?.phone||''} onChange={e=>setEdit((c:any)=>({...c,phone:e.target.value}))}/></div>
              <div><label style={S.label}>Email</label><input style={S.input} type="email" value={edit?.email||''} onChange={e=>setEdit((c:any)=>({...c,email:e.target.value}))}/></div>
            </div>
            <div style={S.row2}>
              <div><label style={S.label}>Address</label><input style={S.input} value={edit?.address||''} onChange={e=>setEdit((c:any)=>({...c,address:e.target.value}))}/></div>
              <div><label style={S.label}>Payment Terms</label>
                <select style={{ ...S.input, appearance:'none', cursor:'pointer' }} value={edit?.payment_terms||'Net 30'} onChange={e=>setEdit((c:any)=>({...c,payment_terms:e.target.value}))}>
                  {['Net 30','Net 15','Net 60','COD','Credit Card','Prepaid'].map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom:12 }}><label style={S.label}>Notes</label><textarea style={{ ...S.input, minHeight:60, resize:'vertical' as const }} value={edit?.notes||''} onChange={e=>setEdit((c:any)=>({...c,notes:e.target.value}))}/></div>
            <button style={{ ...S.btn, background:'linear-gradient(135deg,#1D6FE8,#1248B0)', color:'#fff' }} onClick={save} disabled={saving}>{saving?'Saving...':'Save Changes'}</button>
          </div>

          {/* Vehicles */}
          <div style={S.card}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#F0F4FF' }}>Vehicles ({vehicles.length})</div>
              <a href={`/fleet/new`} style={{ fontSize:11, color:'#4D9EFF', textDecoration:'none' }}>+ Add</a>
            </div>
            {vehicles.length === 0 ? <div style={{ color:'#48536A', fontSize:12, textAlign:'center', padding:16 }}>No vehicles</div>
            : vehicles.map((v: any) => (
              <a key={v.id} href={`/fleet/${v.id}`} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,.04)', textDecoration:'none' }}>
                <div>
                  <span style={{ fontFamily:'monospace', fontWeight:700, color:'#4D9EFF', fontSize:11 }}>#{v.unit_number}</span>
                  <span style={{ color:'#DDE3EE', fontSize:11, marginLeft:8 }}>{v.year} {v.make} {v.model}</span>
                </div>
                <span style={{ fontSize:9, color: v.status==='active'?'#1DB870':'#7C8BA0', fontFamily:'monospace' }}>{v.status?.toUpperCase()}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Invoice sidebar */}
        <div style={S.card}>
          <div style={{ fontSize:12, fontWeight:700, color:'#F0F4FF', marginBottom:12 }}>Recent Invoices</div>
          {invoices.length === 0 ? <div style={{ color:'#48536A', fontSize:12, textAlign:'center', padding:16 }}>No invoices</div>
          : invoices.slice(0,8).map((inv: any) => (
            <a key={inv.id} href={`/invoices/${inv.id}`} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,.04)', textDecoration:'none' }}>
              <div>
                <div style={{ fontFamily:'monospace', fontSize:10, color:'#4D9EFF' }}>{inv.invoice_number}</div>
                <div style={{ fontSize:10, color:'#7C8BA0', marginTop:1 }}>{inv.created_at?.split('T')[0]}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontFamily:'monospace', fontSize:11, fontWeight:700, color:'#DDE3EE' }}>${(inv.total||0).toFixed(0)}</div>
                <div style={{ fontSize:9, color: inv.status==='paid'?'#1DB870':inv.status==='sent'?'#4D9EFF':'#7C8BA0', fontFamily:'monospace' }}>{inv.status?.toUpperCase()}</div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
