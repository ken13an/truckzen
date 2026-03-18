'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

const TYPE_LABELS: Record<string, string> = {
  dot_inspection:'DOT Inspection', cdl:'CDL License', medical_card:'Medical Card',
  vehicle_registration:'Registration', insurance:'Insurance', ifta:'IFTA',
  hazmat:'HazMat Permit', other:'Other',
}

export default function CompliancePage() {
  const supabase = createClient()
  const [items,   setItems]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState<'all'|'expiring'|'expired'>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [form,    setForm]    = useState({ document_name:'', item_type:'dot_inspection', expiry_date:'', asset_id:'', driver_id:'', notes:'' })
  const [assets,  setAssets]  = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [saving,  setSaving]  = useState(false)
  const [user,    setUser]    = useState<any>(null)

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { window.location.href='/login'; return }
      setUser(profile)
      const [compRes, assRes, drvRes] = await Promise.all([
        fetch('/api/compliance'),
        supabase.from('assets').select('id, unit_number, make, model').eq('shop_id', profile.shop_id).eq('status','active').order('unit_number'),
        supabase.from('drivers').select('id, full_name').eq('shop_id', profile.shop_id).order('full_name'),
      ])
      setItems(await compRes.json())
      setAssets(assRes.data || [])
      setDrivers(drvRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  async function addItem(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const res = await fetch('/api/compliance', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) })
    const data = await res.json()
    if (res.ok) { setItems(prev => [...prev, data]); setShowAdd(false); setForm({ document_name:'', item_type:'dot_inspection', expiry_date:'', asset_id:'', driver_id:'', notes:'' }) }
    setSaving(false)
  }

  const today    = new Date()
  const in30days = new Date(Date.now() + 30 * 86400000)

  const filtered = items.filter(item => {
    if (!item.expiry_date) return filter === 'all'
    const exp = new Date(item.expiry_date)
    if (filter === 'expired')  return exp < today
    if (filter === 'expiring') return exp >= today && exp <= in30days
    return true
  })

  const expired  = items.filter(i => i.expiry_date && new Date(i.expiry_date) < today).length
  const expiring = items.filter(i => i.expiry_date && new Date(i.expiry_date) >= today && new Date(i.expiry_date) <= in30days).length

  const statusOf = (item: any) => {
    if (!item.expiry_date) return { color:'#7C8BA0', label:'No Date' }
    const d = new Date(item.expiry_date)
    if (d < today)      return { color:'#D94F4F', label:`${Math.abs(item.days_until_expiry)}d EXPIRED` }
    if (d <= in30days)  return { color:'#D4882A', label:`${item.days_until_expiry}d left` }
    return { color:'#1DB870', label:`${item.days_until_expiry}d left` }
  }

  const S: Record<string, React.CSSProperties> = {
    page:  { background:'#060708', minHeight:'100vh', color:'#DDE3EE', fontFamily:"'Instrument Sans',sans-serif", padding:24 },
    title: { fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:'#F0F4FF', marginBottom:20 },
    card:  { background:'#161B24', border:'1px solid rgba(255,255,255,.055)', borderRadius:12, overflow:'hidden', marginBottom:12 },
    th:    { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:'#48536A', textTransform:'uppercase', letterSpacing:'.1em', padding:'7px 12px', textAlign:'left', background:'#0B0D11', whiteSpace:'nowrap' },
    td:    { padding:'10px 12px', borderBottom:'1px solid rgba(255,255,255,.025)', fontSize:12 },
    label: { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, letterSpacing:'.1em', textTransform:'uppercase' as const, color:'#48536A', marginBottom:5, display:'block' },
    input: { width:'100%', padding:'8px 11px', background:'#1C2130', border:'1px solid rgba(255,255,255,.08)', borderRadius:7, fontSize:12, color:'#DDE3EE', outline:'none', fontFamily:'inherit', minHeight:36, boxSizing:'border-box' as const },
  }

  return (
    <div style={S.page}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div style={S.title}>Compliance</div>
        <button onClick={() => setShowAdd(!showAdd)}
          style={{ padding:'7px 14px', background:'linear-gradient(135deg,#1D6FE8,#1248B0)', border:'none', borderRadius:8, color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          + Add Item
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:10, marginBottom:16 }}>
        {[
          { label:'Total Items', val: items.length,  color:'#F0F4FF' },
          { label:'Expired',     val: expired,        color: expired>0?'#D94F4F':'#1DB870' },
          { label:'Expiring 30d',val: expiring,       color: expiring>0?'#D4882A':'#1DB870' },
          { label:'OK',          val: items.length - expired - expiring, color:'#1DB870' },
        ].map(s => (
          <div key={s.label} style={{ background:'#161B24', border:'1px solid rgba(255,255,255,.055)', borderRadius:10, padding:'10px 12px' }}>
            <div style={{ fontFamily:'monospace', fontSize:8, color:'#48536A', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:5 }}>{s.label}</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:26, color:s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{ background:'#161B24', border:'1px solid rgba(29,111,232,.2)', borderRadius:12, padding:18, marginBottom:14 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#F0F4FF', marginBottom:12 }}>Add Compliance Item</div>
          <form onSubmit={addItem}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
              <div><label style={S.label}>Type</label>
                <select style={{ ...S.input, appearance:'none', cursor:'pointer' }} value={form.item_type} onChange={e=>setForm(f=>({...f,item_type:e.target.value}))}>
                  {Object.entries(TYPE_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div><label style={S.label}>Document Name</label><input style={S.input} value={form.document_name} onChange={e=>setForm(f=>({...f,document_name:e.target.value}))} placeholder="e.g. Annual DOT Inspection" required/></div>
              <div><label style={S.label}>Expiry Date</label><input style={S.input} type="date" value={form.expiry_date} onChange={e=>setForm(f=>({...f,expiry_date:e.target.value}))} required/></div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
              <div><label style={S.label}>Vehicle (optional)</label>
                <select style={{ ...S.input, appearance:'none', cursor:'pointer' }} value={form.asset_id} onChange={e=>setForm(f=>({...f,asset_id:e.target.value}))}>
                  <option value="">No vehicle</option>
                  {assets.map(a=><option key={a.id} value={a.id}>#{a.unit_number} — {a.make} {a.model}</option>)}
                </select>
              </div>
              <div><label style={S.label}>Driver (optional)</label>
                <select style={{ ...S.input, appearance:'none', cursor:'pointer' }} value={form.driver_id} onChange={e=>setForm(f=>({...f,driver_id:e.target.value}))}>
                  <option value="">No driver</option>
                  {drivers.map(d=><option key={d.id} value={d.id}>{d.full_name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button type="submit" style={{ padding:'8px 18px', background:'linear-gradient(135deg,#1D6FE8,#1248B0)', border:'none', borderRadius:8, color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }} disabled={saving}>{saving?'Adding...':'Add Item'}</button>
              <button type="button" onClick={() => setShowAdd(false)} style={{ padding:'8px 14px', background:'transparent', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, color:'#7C8BA0', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display:'flex', gap:6, marginBottom:12 }}>
        {[['all','All'] as const, ['expiring','Expiring Soon'] as const, ['expired','Expired'] as const].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v as any)}
            style={{ padding:'5px 12px', borderRadius:100, fontSize:10, fontWeight:600, cursor:'pointer', border:'1px solid rgba(255,255,255,.08)', background: filter===v?'rgba(29,111,232,.1)':'#1C2130', color: filter===v?'#4D9EFF':'#7C8BA0', fontFamily:'inherit', minHeight:30 }}>
            {l}
          </button>
        ))}
      </div>

      <div style={S.card}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:560 }}>
            <thead><tr>{['Type','Document','Vehicle / Driver','Expiry Date','Status'].map(h=><th key={h} style={S.th as any}>{h}</th>)}</tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={5} style={{ ...S.td, textAlign:'center', color:'#7C8BA0', padding:40 }}>Loading...</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={5} style={{ ...S.td, textAlign:'center', color:'#7C8BA0', padding:40 }}>No items</td></tr>
              : filtered.map(item => {
                const st = statusOf(item)
                const who = (item.assets as any)?.unit_number ? `Truck #${(item.assets as any).unit_number}` : (item.drivers as any)?.full_name || '—'
                return (
                  <tr key={item.id}>
                    <td style={{ ...S.td, fontSize:10, color:'#7C8BA0', fontFamily:'monospace' }}>{TYPE_LABELS[item.item_type] || item.item_type}</td>
                    <td style={{ ...S.td, fontWeight:600, color:'#F0F4FF' }}>{item.document_name}</td>
                    <td style={{ ...S.td, color:'#DDE3EE' }}>{who}</td>
                    <td style={{ ...S.td, fontFamily:'monospace', fontSize:11 }}>{item.expiry_date || '—'}</td>
                    <td style={{ ...S.td }}>
                      <span style={{ fontFamily:'monospace', fontSize:10, fontWeight:700, color:st.color }}>{st.label}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
