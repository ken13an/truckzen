'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

export default function PartDetailPage() {
  const params = useParams(); const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [part, setPart] = useState<any>(null)
  const [edit, setEdit] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { router.push('/login'); return }
      setUser(profile)
      const res = await fetch(`/api/parts/${params.id}`)
      if (!res.ok) { router.push('/parts'); return }
      const data = await res.json()
      setPart(data); setEdit(data); setLoading(false)
    }
    load()
  }, [params.id])

  async function save() {
    setSaving(true)
    await fetch(`/api/parts/${params.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(edit) })
    setPart(edit); setSaving(false)
  }

  const canEdit = ['owner','gm','it_person','shop_manager','parts_manager','office_admin'].includes(user?.role)
  const margin  = edit?.sell_price && edit?.cost_price ? Math.round((edit.sell_price - edit.cost_price) / edit.sell_price * 100) : 0
  const isLow   = part?.on_hand <= part?.reorder_point
  const isOut   = part?.on_hand === 0

  const S: Record<string, React.CSSProperties> = {
    page:   { background:'#060708', minHeight:'100vh', color:'#DDE3EE', fontFamily:"'Instrument Sans',sans-serif", padding:24, maxWidth:720, margin:'0 auto' },
    card:   { background:'#161B24', border:'1px solid rgba(255,255,255,.055)', borderRadius:12, padding:18, marginBottom:12 },
    label:  { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, letterSpacing:'.1em', textTransform:'uppercase' as const, color:'#48536A', marginBottom:5, display:'block' },
    input:  { width:'100%', padding:'9px 12px', background:'#1C2130', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, fontSize:12, color:'#DDE3EE', outline:'none', fontFamily:'inherit', minHeight:38, boxSizing:'border-box' as const },
    row2:   { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 },
    row3:   { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 },
    btn:    { padding:'9px 18px', borderRadius:8, border:'none', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  }

  if (loading) return <div style={{ ...S.page, color:'#7C8BA0', padding:60 }}>Loading...</div>

  return (
    <div style={S.page}>
      <a href="/parts" style={{ fontSize:12, color:'#7C8BA0', textDecoration:'none', display:'block', marginBottom:20 }}>← Parts Inventory</a>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:'#4D9EFF', marginBottom:4 }}>{part.part_number || 'No Part #'}</div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:26, color:'#F0F4FF' }}>{part.description}</div>
          <div style={{ fontSize:12, color:'#7C8BA0', marginTop:4 }}>{part.category}</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ padding:'4px 12px', borderRadius:100, fontFamily:'monospace', fontSize:9, background: isOut?'rgba(217,79,79,.1)':isLow?'rgba(212,136,42,.1)':'rgba(29,184,112,.1)', color: isOut?'#D94F4F':isLow?'#D4882A':'#1DB870', border:`1px solid ${isOut?'#D94F4F':isLow?'#D4882A':'#1DB870'}33` }}>
            {isOut ? 'OUT OF STOCK' : isLow ? 'LOW STOCK' : 'IN STOCK'} · {part.on_hand} units
          </span>
        </div>
      </div>

      {canEdit && edit && (
        <div style={S.card}>
          <div style={{ fontSize:13, fontWeight:700, color:'#F0F4FF', marginBottom:14 }}>Edit Part</div>
          <div style={S.row2}>
            <div><label style={S.label}>Part Number</label><input style={S.input} value={edit.part_number||''} onChange={e=>setEdit((p:any)=>({...p,part_number:e.target.value}))}/></div>
            <div><label style={S.label}>Category</label>
              <select style={{ ...S.input, appearance:'none', cursor:'pointer' }} value={edit.category||''} onChange={e=>setEdit((p:any)=>({...p,category:e.target.value}))}>
                {['Engine','Brakes','Electrical','Filters & Fluids','Body & Chassis','Tires','Lights','Transmission','Other'].map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom:10 }}><label style={S.label}>Description</label><input style={S.input} value={edit.description||''} onChange={e=>setEdit((p:any)=>({...p,description:e.target.value}))}/></div>
          <div style={S.row3}>
            <div><label style={S.label}>On Hand</label><input style={S.input} type="number" value={edit.on_hand||0} onChange={e=>setEdit((p:any)=>({...p,on_hand:parseInt(e.target.value)||0}))}/></div>
            <div><label style={S.label}>Reorder At</label><input style={S.input} type="number" value={edit.reorder_point||0} onChange={e=>setEdit((p:any)=>({...p,reorder_point:parseInt(e.target.value)||0}))}/></div>
            <div><label style={S.label}>Bin Location</label><input style={S.input} value={edit.bin_location||''} onChange={e=>setEdit((p:any)=>({...p,bin_location:e.target.value}))}/></div>
          </div>
          <div style={S.row3}>
            <div><label style={S.label}>Cost Price</label><input style={S.input} type="number" value={edit.cost_price||0} onChange={e=>setEdit((p:any)=>({...p,cost_price:parseFloat(e.target.value)||0}))}/></div>
            <div><label style={S.label}>Sell Price</label><input style={S.input} type="number" value={edit.sell_price||0} onChange={e=>setEdit((p:any)=>({...p,sell_price:parseFloat(e.target.value)||0}))}/></div>
            <div><label style={S.label}>Margin</label><div style={{ padding:'9px 12px', background:'#0B0D11', borderRadius:8, fontSize:13, fontWeight:700, color: margin>=40?'#1DB870':margin>=25?'#D4882A':'#D94F4F', fontFamily:'monospace' }}>{margin}%</div></div>
          </div>
          <div style={S.row2}>
            <div><label style={S.label}>Vendor</label><input style={S.input} value={edit.vendor||''} onChange={e=>setEdit((p:any)=>({...p,vendor:e.target.value}))}/></div>
            <div><label style={S.label}>Core Charge</label><input style={S.input} type="number" value={edit.core_charge||0} onChange={e=>setEdit((p:any)=>({...p,core_charge:parseFloat(e.target.value)||0}))}/></div>
          </div>
          <button style={{ ...S.btn, background:'linear-gradient(135deg,#1D6FE8,#1248B0)', color:'#fff' }} onClick={save} disabled={saving}>{saving?'Saving...':'Save Changes'}</button>
        </div>
      )}

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:10, marginBottom:14 }}>
        {[
          { label:'On Hand',    val: part.on_hand,       color: isOut?'#D94F4F':isLow?'#D4882A':'#F0F4FF' },
          { label:'Reorder At', val: part.reorder_point, color:'#7C8BA0' },
          { label:'Cost',       val: `$${(part.cost_price||0).toFixed(2)}`, color:'#7C8BA0' },
          { label:'Sell Price', val: `$${(part.sell_price||0).toFixed(2)}`, color:'#DDE3EE' },
          { label:'Margin',     val: `${margin}%`, color: margin>=40?'#1DB870':margin>=25?'#D4882A':'#D94F4F' },
          { label:'Core Charge',val: part.core_charge > 0 ? `$${part.core_charge}` : '—', color:'#D4882A' },
        ].map(s => (
          <div key={s.label} style={{ background:'#161B24', border:'1px solid rgba(255,255,255,.055)', borderRadius:10, padding:'10px 12px' }}>
            <div style={{ fontFamily:'monospace', fontSize:8, letterSpacing:'.1em', textTransform:'uppercase', color:'#48536A', marginBottom:5 }}>{s.label}</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:s.color }}>{s.val}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
