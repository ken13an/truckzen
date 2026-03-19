'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

export default function NewFleetPage() {
  const router = useRouter()
  const supabase = createClient()
  const [customers, setCustomers] = useState<any[]>([])
  const [form, setForm] = useState({ unit_number:'', vin:'', year:'', make:'', model:'', engine:'', odometer:'0', customer_id:'', status:'active' })
  const [saving,    setSaving]    = useState(false)
  const [decoding,  setDecoding]  = useState(false)
  const [error,     setError]     = useState('')
  const [vinMsg,    setVinMsg]    = useState('')

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { router.push('/login'); return }
      const { data } = await supabase.from('customers').select('id, company_name').eq('shop_id', profile.shop_id).order('company_name')
      setCustomers(data || [])
    }
    load()
  }, [])

  async function decodeVIN() {
    if (form.vin.length !== 17) { setVinMsg('VIN must be 17 characters'); return }
    setDecoding(true); setVinMsg('')
    try {
      const res  = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${form.vin.toUpperCase()}?format=json`)
      const data = await res.json()
      const r    = data.Results?.[0]
      if (r?.ErrorCode === '0') {
        setForm(f => ({
          ...f,
          year:  r.ModelYear || f.year,
          make:  r.Make || f.make,
          model: r.Model || f.model,
          engine:[r.DisplacementL ? r.DisplacementL+'L' : '', r.FuelTypePrimary || ''].filter(Boolean).join(' ') || f.engine,
        }))
        setVinMsg(`✅ Decoded: ${r.ModelYear} ${r.Make} ${r.Model}`)
      } else {
        setVinMsg('Could not decode VIN — fill in manually')
      }
    } catch { setVinMsg('VIN decode failed — fill in manually') }
    setDecoding(false)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.unit_number) { setError('Unit number required'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/assets', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ ...form, year: parseInt(form.year)||null, odometer: parseInt(form.odometer)||0 }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to add vehicle'); setSaving(false); return }
    router.push(`/fleet/${data.id}`)
  }

  const S: Record<string, React.CSSProperties> = {
    page:  { background:'#060708', minHeight:'100vh', color:'#DDE3EE', fontFamily:"'Instrument Sans',sans-serif", padding:24, maxWidth:640, margin:'0 auto' },
    card:  { background:'#161B24', border:'1px solid rgba(255,255,255,.055)', borderRadius:12, padding:20, marginBottom:12 },
    label: { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, letterSpacing:'.1em', textTransform:'uppercase' as const, color:'#48536A', marginBottom:5, display:'block' },
    input: { width:'100%', padding:'9px 12px', background:'#1C2130', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, fontSize:12, color:'#DDE3EE', outline:'none', fontFamily:'inherit', minHeight:38, boxSizing:'border-box' as const },
    row2:  { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 },
    row3:  { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 },
    btn:   { padding:'12px 24px', background:'linear-gradient(135deg,#00E0B0,#00805F)', border:'none', borderRadius:9, fontSize:13, fontWeight:700, color:'#fff', cursor:'pointer', fontFamily:'inherit' },
    error: { padding:'10px 12px', background:'rgba(217,79,79,.08)', border:'1px solid rgba(217,79,79,.2)', borderRadius:8, fontSize:12, color:'#D94F4F', marginBottom:12 },
  }

  const inp = (label: string, key: keyof typeof form, type = 'text', placeholder = '') => (
    <div>
      <label style={S.label}>{label}</label>
      <input style={S.input} type={type} placeholder={placeholder} value={(form as any)[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}/>
    </div>
  )

  return (
    <div style={S.page}>
      <a href="/fleet" style={{ fontSize:12, color:'#7C8BA0', textDecoration:'none', display:'block', marginBottom:20 }}>← Fleet</a>
      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:'#F0F4FF', marginBottom:4 }}>Add Vehicle</div>
      <div style={{ fontSize:12, color:'#7C8BA0', marginBottom:20 }}>Enter a VIN to auto-fill year, make, and model — or fill in manually.</div>

      {error && <div style={S.error}>{error}</div>}

      <form onSubmit={submit}>
        {/* VIN decode */}
        <div style={S.card}>
          <div style={{ fontSize:12, fontWeight:700, color:'#F0F4FF', marginBottom:12 }}>VIN Decoder</div>
          <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
            <div style={{ flex:1 }}>
              <label style={S.label}>VIN (17 characters)</label>
              <input style={{ ...S.input, fontFamily:'monospace', textTransform:'uppercase' }} value={form.vin} maxLength={17}
                onChange={e => setForm(f => ({ ...f, vin: e.target.value.toUpperCase() }))} placeholder="1HGBH41JXMN109186"/>
            </div>
            <button type="button" style={{ ...S.btn, padding:'9px 18px', fontSize:11, flexShrink:0, whiteSpace:'nowrap' }} onClick={decodeVIN} disabled={decoding || form.vin.length !== 17}>
              {decoding ? 'Decoding...' : 'Decode VIN'}
            </button>
          </div>
          {vinMsg && <div style={{ fontSize:11, color: vinMsg.startsWith('✅')?'#1DB870':'#D4882A', marginTop:8 }}>{vinMsg}</div>}
        </div>

        {/* Vehicle info */}
        <div style={S.card}>
          <div style={{ fontSize:12, fontWeight:700, color:'#F0F4FF', marginBottom:12 }}>Vehicle Information</div>
          <div style={S.row2}>{inp('Unit Number *','unit_number','text','e.g. 2717')}{inp('Odometer (miles)','odometer','number','0')}</div>
          <div style={S.row3}>{inp('Year','year','number','2022')}{inp('Make','make','text','Kenworth')}{inp('Model','model','text','T680')}</div>
          <div style={S.row2}>{inp('Engine','engine','text','PACCAR MX-13')}<div>
            <label style={S.label}>Status</label>
            <select style={{ ...S.input, appearance:'none', cursor:'pointer' }} value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
              {['active','inactive','decommissioned'].map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div></div>
          <div>
            <label style={S.label}>Owner / Customer</label>
            <select style={{ ...S.input, appearance:'none', cursor:'pointer' }} value={form.customer_id} onChange={e=>setForm(f=>({...f,customer_id:e.target.value}))}>
              <option value="">No customer linked</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          </div>
        </div>

        <button type="submit" style={{ ...S.btn, width:'100%' }} disabled={saving}>{saving?'Adding...':'Add Vehicle →'}</button>
      </form>
    </div>
  )
}
