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
    page:   { background:'#08080C', minHeight:'100vh', color:'#EDEDF0', fontFamily:"'Instrument Sans',sans-serif", padding:24, maxWidth:720, margin:'0 auto' },
    card:   { background:'#1A1A24', border:'1px solid rgba(255,255,255,.055)', borderRadius:12, padding:18, marginBottom:12 },
    label:  { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, letterSpacing:'.1em', textTransform:'uppercase' as const, color:'#9D9DA1', marginBottom:5, display:'block' },
    input:  { width:'100%', padding:'9px 12px', background:'#1A1A24', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, fontSize:12, color:'#EDEDF0', outline:'none', fontFamily:'inherit', minHeight:38, boxSizing:'border-box' as const },
    row2:   { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 },
    row3:   { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 },
    btn:    { padding:'9px 18px', borderRadius:8, border:'none', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  }

  if (loading) return <div style={{ ...S.page, color:'#9D9DA1', padding:60 }}>Loading...</div>

  return (
    <div style={S.page}>
      <a href="/parts" style={{ fontSize:12, color:'#9D9DA1', textDecoration:'none', display:'block', marginBottom:20 }}>← Parts Inventory</a>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:'#00E0B0', marginBottom:4 }}>{part.part_number || 'No Part #'}</div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:26, color:'#EDEDF0' }}>{part.description}</div>
          <div style={{ fontSize:12, color:'#9D9DA1', marginTop:4 }}>{part.category}</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ padding:'4px 12px', borderRadius:100, fontFamily:'monospace', fontSize:9, background: isOut?'rgba(217,79,79,.1)':isLow?'rgba(212,136,42,.1)':'rgba(29,184,112,.1)', color: isOut?'#FF5C5C':isLow?'#FFB84D':'#00E0B0', border:`1px solid ${isOut?'#FF5C5C':isLow?'#FFB84D':'#00E0B0'}33` }}>
            {isOut ? 'OUT OF STOCK' : isLow ? 'LOW STOCK' : 'IN STOCK'} · {part.on_hand} units
          </span>
        </div>
      </div>

      {canEdit && edit && (
        <div style={S.card}>
          <div style={{ fontSize:13, fontWeight:700, color:'#EDEDF0', marginBottom:14 }}>Edit Part</div>
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
            <div><label style={S.label}>Margin</label><div style={{ padding:'9px 12px', background:'#08080C', borderRadius:8, fontSize:13, fontWeight:700, color: margin>=40?'#00E0B0':margin>=25?'#FFB84D':'#FF5C5C', fontFamily:'monospace' }}>{margin}%</div></div>
          </div>
          <div style={S.row2}>
            <div><label style={S.label}>Vendor</label><input style={S.input} value={edit.vendor||''} onChange={e=>setEdit((p:any)=>({...p,vendor:e.target.value}))}/></div>
            <div><label style={S.label}>Core Charge</label><input style={S.input} type="number" value={edit.core_charge||0} onChange={e=>setEdit((p:any)=>({...p,core_charge:parseFloat(e.target.value)||0}))}/></div>
          </div>
          <button style={{ ...S.btn, background:'linear-gradient(135deg,#00E0B0,#00E0B0)', color:'#fff' }} onClick={save} disabled={saving}>{saving?'Saving...':'Save Changes'}</button>
        </div>
      )}

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:10, marginBottom:14 }}>
        {[
          { label:'On Hand',    val: part.on_hand,       color: isOut?'#FF5C5C':isLow?'#FFB84D':'#EDEDF0' },
          { label:'Reorder At', val: part.reorder_point, color:'#9D9DA1' },
          { label:'Cost',       val: `$${(part.cost_price||0).toFixed(2)}`, color:'#9D9DA1' },
          { label:'Sell Price', val: `$${(part.sell_price||0).toFixed(2)}`, color:'#EDEDF0' },
          { label:'Margin',     val: `${margin}%`, color: margin>=40?'#00E0B0':margin>=25?'#FFB84D':'#FF5C5C' },
          { label:'Core Charge',val: part.core_charge > 0 ? `$${part.core_charge}` : '—', color:'#FFB84D' },
        ].map(s => (
          <div key={s.label} style={{ background:'#1A1A24', border:'1px solid rgba(255,255,255,.055)', borderRadius:10, padding:'10px 12px' }}>
            <div style={{ fontFamily:'monospace', fontSize:8, letterSpacing:'.1em', textTransform:'uppercase', color:'#9D9DA1', marginBottom:5 }}>{s.label}</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:s.color }}>{s.val}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
