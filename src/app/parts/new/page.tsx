'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewPartPage() {
  const router = useRouter()
  const [form, setForm] = useState({ part_number:'', description:'', category:'Engine', on_hand:0, reorder_point:2, cost_price:'', sell_price:'', vendor:'', bin_location:'', core_charge:0, warranty_months:0 })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.description) { setError('Description required'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/parts', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed'); setSaving(false); return }
    router.push(`/parts/${data.id}`)
  }

  const margin = form.sell_price && form.cost_price ? Math.round((parseFloat(form.sell_price) - parseFloat(form.cost_price)) / parseFloat(form.sell_price) * 100) : 0

  const S: Record<string, React.CSSProperties> = {
    page:  { background:'#0A0A0A', minHeight:'100vh', color:'#F5F5F7', fontFamily:"'Instrument Sans',sans-serif", padding:24, maxWidth:640, margin:'0 auto' },
    title: { fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:'#F5F5F7', marginBottom:4 },
    card:  { background:'#2A2A2A', border:'1px solid rgba(255,255,255,.055)', borderRadius:12, padding:20, marginBottom:12 },
    label: { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, letterSpacing:'.1em', textTransform:'uppercase' as const, color:'#8E8E93', marginBottom:5, display:'block' },
    input: { width:'100%', padding:'9px 12px', background:'#2A2A2A', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, fontSize:12, color:'#F5F5F7', outline:'none', fontFamily:'inherit', minHeight:38, boxSizing:'border-box' as const },
    row2:  { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 },
    row3:  { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 },
    btn:   { padding:'12px 24px', background:'linear-gradient(135deg,#0A84FF,#0A84FF)', border:'none', borderRadius:9, fontSize:13, fontWeight:700, color:'#fff', cursor:'pointer', fontFamily:'inherit' },
    error: { padding:'10px 12px', background:'rgba(217,79,79,.08)', border:'1px solid rgba(217,79,79,.2)', borderRadius:8, fontSize:12, color:'#FF453A', marginBottom:12 },
  }

  const inp = (label: string, key: keyof typeof form, type = 'text', placeholder = '') => (
    <div><label style={S.label}>{label}</label><input style={S.input} type={type} placeholder={placeholder} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: type==='number'?parseFloat(e.target.value)||0:e.target.value }))}/></div>
  )

  return (
    <div style={S.page}>
      <a href="/parts" style={{ fontSize:12, color:'#8E8E93', textDecoration:'none', display:'block', marginBottom:20 }}>← Parts Inventory</a>
      <div style={S.title}>Add New Part</div>
      <div style={{ fontSize:12, color:'#8E8E93', marginBottom:20 }}>Add a part to your catalog. You can edit it anytime.</div>
      {error && <div style={S.error}>{error}</div>}
      <form onSubmit={submit}>
        <div style={S.card}>
          <div style={{ fontSize:12, fontWeight:700, color:'#F5F5F7', marginBottom:12 }}>Part Details</div>
          <div style={S.row2}>{inp('Part Number','part_number','text','e.g. 1923274PE')}<div><label style={S.label}>Category</label><select style={{ ...S.input, appearance:'none' }} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
            {['Engine','Brakes','Electrical','Filters & Fluids','Body & Chassis','Tires','Lights','Transmission','Other'].map(c=><option key={c}>{c}</option>)}
          </select></div></div>
          <div style={{ marginBottom:10 }}>{inp('Description','description','text','Full part description — be specific')}</div>
          <div style={S.row2}>{inp('Vendor','vendor','text','FinditParts / Local / etc')}{inp('Bin Location','bin_location','text','e.g. A-12')}</div>
        </div>

        <div style={S.card}>
          <div style={{ fontSize:12, fontWeight:700, color:'#F5F5F7', marginBottom:12 }}>Stock & Pricing</div>
          <div style={S.row3}>{inp('On Hand','on_hand','number')}{inp('Reorder At','reorder_point','number')}<div><label style={S.label}>Warranty (months)</label><input style={S.input} type="number" value={form.warranty_months} onChange={e=>setForm(f=>({...f,warranty_months:parseInt(e.target.value)||0}))}/></div></div>
          <div style={S.row3}>{inp('Cost Price','cost_price','number','0.00')}{inp('Sell Price','sell_price','number','0.00')}
            <div><label style={S.label}>Margin</label><div style={{ padding:'9px 12px', background:'#0A0A0A', borderRadius:8, fontSize:14, fontWeight:700, color: margin>=40?'#0A84FF':margin>=25?'#FFD60A':'#FF453A', fontFamily:'monospace' }}>{margin}%</div></div>
          </div>
          <div style={S.row2}>{inp('Core Charge','core_charge','number','0 if no core')}<div/></div>
        </div>

        <button type="submit" style={{ ...S.btn, width:'100%' }} disabled={saving}>{saving?'Adding...':'Add Part →'}</button>
      </form>
    </div>
  )
}
