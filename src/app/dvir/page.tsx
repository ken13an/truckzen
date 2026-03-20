'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

const DVIR_ITEMS = [
  { category:'Brakes', items:['Service brakes','Parking brake','Brake hoses'] },
  { category:'Lights', items:['Headlights','Tail lights','Turn signals','Clearance lights'] },
  { category:'Steering', items:['Steering wheel','Steering mechanism','Tie rods'] },
  { category:'Tires & Wheels', items:['Tire condition','Tire pressure','Wheel fasteners'] },
  { category:'Engine', items:['Oil level','Coolant level','Belts','Hoses'] },
  { category:'Cab', items:['Horn','Windshield wipers','Mirrors','Seat belts'] },
  { category:'Trailer (if applicable)', items:['Coupling devices','Lights','Brakes'] },
]

export default function DVIRPage() {
  const supabase = createClient()
  const [user,    setUser]    = useState<any>(null)
  const [truck,   setTruck]   = useState('')
  const [odometer,setOdometer]= useState('')
  const [checks,  setChecks]  = useState<Record<string, 'ok'|'defect'|null>>({})
  const [notes,   setNotes]   = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting,setSubmitting]= useState(false)

  useEffect(() => {
    getCurrentUser(supabase).then(p => { if (p) setUser(p) })
  }, [])

  const allChecked = DVIR_ITEMS.every(cat => cat.items.every(item => checks[item] !== undefined && checks[item] !== null))
  const hasDefects = Object.values(checks).some(v => v === 'defect')

  async function submitDVIR() {
    if (!truck) { alert('Enter your truck unit number'); return }
    setSubmitting(true)
    const { data: asset } = await supabase.from('assets').select('id').eq('shop_id', user.shop_id).ilike('unit_number', truck).single()
    await supabase.from('dvir_submissions').insert({
      shop_id:        user.shop_id,
      driver_id:      user.id,
      asset_id:       asset?.id || null,
      unit_number:    truck,
      odometer:       parseInt(odometer) || null,
      inspection_data:checks,
      defects_found:  hasDefects,
      driver_notes:   notes,
      signature:      user.full_name,
      submitted_at:   new Date().toISOString(),
    })
    setSubmitting(false)
    setSubmitted(true)
  }

  const S: Record<string, React.CSSProperties> = {
    page:  { background:'#0A0A0A', minHeight:'100vh', color:'#F5F5F7', fontFamily:"'Instrument Sans',sans-serif", padding:20, maxWidth:480, margin:'0 auto' },
    title: { fontFamily:"'Bebas Neue',sans-serif", fontSize:24, color:'#F5F5F7', marginBottom:4 },
    label: { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, letterSpacing:'.1em', textTransform:'uppercase' as const, color:'#8E8E93', marginBottom:4, display:'block' },
    input: { width:'100%', padding:'10px 12px', background:'#2A2A2A', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, fontSize:13, color:'#F5F5F7', outline:'none', fontFamily:'inherit', minHeight:40, boxSizing:'border-box' as const, marginBottom:12 },
    btn:   { width:'100%', padding:14, background:'linear-gradient(135deg,#0A84FF,#0A84FF)', border:'none', borderRadius:10, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', marginTop:16 },
  }

  if (submitted) return (
    <div style={{ ...S.page, textAlign:'center', paddingTop:80 }}>
      <div style={{ fontSize:24, fontWeight: 700, color: hasDefects ? '#FFD60A' : '#0A84FF' }}>{hasDefects ? 'DEFECTS REPORTED' : 'COMPLETE'}</div>
      <div style={{ ...S.title, marginTop:16 }}>{hasDefects ? 'DVIR Submitted — Defects Reported' : 'DVIR Complete — No Defects'}</div>
      <div style={{ fontSize:13, color:'#8E8E93', lineHeight:1.6, marginTop:8 }}>
        {hasDefects ? 'Maintenance team has been notified. Do not operate the vehicle until defects are cleared.' : 'Vehicle is safe to operate. Have a safe trip.'}
      </div>
      <button style={{ ...S.btn, marginTop:24 }} onClick={() => { setSubmitted(false); setChecks({}); setTruck(''); setNotes('') }}>New DVIR</button>
    </div>
  )

  return (
    <div style={S.page}>
      <div style={S.title}>Driver Vehicle Inspection</div>
      <div style={{ fontSize:11, color:'#8E8E93', marginBottom:20 }}>Pre-trip or post-trip inspection report</div>
      <label style={S.label}>Truck Unit Number</label>
      <input style={S.input} placeholder="e.g. 2717" value={truck} onChange={e => setTruck(e.target.value)}/>
      <label style={S.label}>Odometer Reading</label>
      <input style={S.input} type="number" placeholder="e.g. 487293" value={odometer} onChange={e => setOdometer(e.target.value)}/>

      {DVIR_ITEMS.map(cat => (
        <div key={cat.category} style={{ marginBottom:16 }}>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, letterSpacing:'.1em', textTransform:'uppercase', color:'#8E8E93', marginBottom:8 }}>{cat.category}</div>
          {cat.items.map(item => (
            <div key={item} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', background:'#2A2A2A', border:'1px solid rgba(255,255,255,.06)', borderRadius:8, marginBottom:6 }}>
              <span style={{ fontSize:12, color:'#F5F5F7' }}>{item}</span>
              <div style={{ display:'flex', gap:6 }}>
                {(['ok','defect'] as const).map(v => (
                  <button key={v} onClick={() => setChecks(c => ({...c, [item]: checks[item]===v ? null : v}))}
                    style={{ padding:'4px 10px', borderRadius:6, fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:'none',
                      background: checks[item]===v ? (v==='ok'?'#0A84FF':'#FF453A') : '#2A2A2A',
                      color: checks[item]===v ? '#fff' : '#8E8E93' }}>
                    {v === 'ok' ? 'OK' : 'Defect'}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      <label style={S.label}>Notes / Defect Description</label>
      <textarea style={{ ...S.input, minHeight:80, resize:'vertical' as const }} placeholder="Describe any defects or observations..." value={notes} onChange={e => setNotes(e.target.value)}/>

      <button style={{ ...S.btn, opacity: allChecked ? 1 : 0.5 }} onClick={submitDVIR} disabled={!allChecked || submitting}>
        {submitting ? 'Submitting...' : allChecked ? 'Submit DVIR — ' + user?.full_name : 'Complete All Checks First'}
      </button>
    </div>
  )
}
