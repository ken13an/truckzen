'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { useTheme } from '@/hooks/useTheme'

export default function PMDetailPage() {
  const { tokens: t } = useTheme()
  const params = useParams(); const router = useRouter()
  const supabase = createClient()
  const [pm,      setPM]      = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [edit,    setEdit]    = useState<any>(null)
  const [saving,  setSaving]  = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { router.push('/login'); return }

      const { data: p } = await supabase
        .from('pm_schedules')
        .select('*, assets(unit_number, year, make, model, odometer)')
        .eq('id', params.id)
        .eq('shop_id', profile.shop_id)
        .single()

      if (!p) { router.push('/maintenance'); return }
      setPM(p); setEdit(p)

      // Service history for this truck + this service type
      const { data: h } = await supabase
        .from('service_orders')
        .select('id, so_number, status, complaint, completed_at, created_at, grand_total')
        .eq('asset_id', p.asset_id)
        .ilike('complaint', `%${p.service_name.split(' ')[0]}%`)
        .order('created_at', { ascending: false })
        .limit(10)

      setHistory(h || [])
      setLoading(false)
    }
    load()
  }, [params.id])

  async function save() {
    setSaving(true)
    await supabase.from('pm_schedules').update({
      service_name:      edit.service_name,
      interval_miles:    parseInt(edit.interval_miles) || null,
      interval_days:     parseInt(edit.interval_days)  || null,
      next_due_date:     edit.next_due_date || null,
      next_due_reading:  parseInt(edit.next_due_reading) || null,
      notes:             edit.notes || null,
    }).eq('id', params.id)
    setPM(edit); setSaving(false)
  }

  const S: Record<string, React.CSSProperties> = {
    page:  { background:t.bg, minHeight:'100vh', color:t.text, fontFamily:"'Instrument Sans',sans-serif", padding:24, maxWidth:680, margin:'0 auto' },
    card:  { background:t.bgCard, border:'1px solid rgba(255,255,255,.055)', borderRadius:12, padding:16, marginBottom:12 },
    label: { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, letterSpacing:'.1em', textTransform:'uppercase' as const, color:t.textTertiary, marginBottom:5, display:'block' },
    input: { width:'100%', padding:'8px 11px', background:t.inputBg, border:'1px solid rgba(255,255,255,.08)', borderRadius:7, fontSize:12, color:t.text, outline:'none', fontFamily:'inherit', minHeight:36, boxSizing:'border-box' as const },
    row2:  { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 },
    th:    { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:t.textTertiary, textTransform:'uppercase', padding:'6px 10px', textAlign:'left', background:'#0B0D11' },
    td:    { padding:'9px 10px', borderBottom:'1px solid rgba(255,255,255,.025)', fontSize:11 },
    btn:   { padding:'8px 16px', borderRadius:8, border:'none', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  }

  if (loading) return <div style={{ ...S.page, color:t.textSecondary, padding:60 }}>Loading...</div>

  const today  = new Date().toISOString().split('T')[0]
  const isOver = pm.next_due_date && pm.next_due_date < today
  const isSoon = !isOver && pm.next_due_date && pm.next_due_date <= new Date(Date.now()+7*86400000).toISOString().split('T')[0]
  const stColor = isOver?'#D94F4F':isSoon?'#D4882A':'#1DB870'
  const asset   = pm.assets

  return (
    <div style={S.page}>
      <a href="/maintenance" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: t.border, borderRadius: 8, fontSize: 14, fontWeight: 700, color: t.text, textDecoration: 'none', marginBottom: 20 }}>
  <ChevronLeft size={16} strokeWidth={2} /> Maintenance
</a>

      <div style={{ marginBottom:20 }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:t.text }}>{pm.service_name}</div>
        <div style={{ fontSize:13, color:t.textSecondary, marginTop:4 }}>Unit #{asset?.unit_number} · {asset?.year} {asset?.make} {asset?.model}</div>
        <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
          <span style={{ padding:'4px 12px', borderRadius:100, fontFamily:'monospace', fontSize:9, background:stColor+'18', color:stColor, border:`1px solid ${stColor}33` }}>
            {isOver?'OVERDUE':isSoon?'DUE SOON':'OK'} · {pm.next_due_date||'No date set'}
          </span>
          {pm.next_due_reading && (
            <span style={{ padding:'4px 12px', borderRadius:100, fontFamily:'monospace', fontSize:9, background:'rgba(29,111,232,.1)', color:'#4D9EFF', border:'1px solid rgba(29,111,232,.2)' }}>
              {pm.next_due_reading.toLocaleString()} mi
            </span>
          )}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:14, alignItems:'start' }}>
        <div>
          <div style={S.card}>
            <div style={{ fontSize:12, fontWeight:700, color:t.text, marginBottom:12 }}>Edit Schedule</div>
            <div style={{ marginBottom:10 }}><label style={S.label}>Service Name</label><input style={S.input} value={edit?.service_name||''} onChange={e=>setEdit((p:any)=>({...p,service_name:e.target.value}))}/></div>
            <div style={S.row2}>
              <div><label style={S.label}>Interval (miles)</label><input style={S.input} type="number" value={edit?.interval_miles||''} onChange={e=>setEdit((p:any)=>({...p,interval_miles:e.target.value}))}/></div>
              <div><label style={S.label}>Interval (days)</label><input style={S.input} type="number" value={edit?.interval_days||''} onChange={e=>setEdit((p:any)=>({...p,interval_days:e.target.value}))}/></div>
            </div>
            <div style={S.row2}>
              <div><label style={S.label}>Next Due Date</label><input style={S.input} type="date" value={edit?.next_due_date||''} onChange={e=>setEdit((p:any)=>({...p,next_due_date:e.target.value}))}/></div>
              <div><label style={S.label}>Next Due Mileage</label><input style={S.input} type="number" value={edit?.next_due_reading||''} onChange={e=>setEdit((p:any)=>({...p,next_due_reading:e.target.value}))}/></div>
            </div>
            <div style={{ marginBottom:10 }}><label style={S.label}>Notes</label><textarea style={{ ...S.input, minHeight:64, resize:'vertical' as const }} value={edit?.notes||''} onChange={e=>setEdit((p:any)=>({...p,notes:e.target.value}))}/></div>
            <div style={{ display:'flex', gap:8 }}>
              <button style={{ ...S.btn, background:t.accent, color:'#fff' }} onClick={save} disabled={saving}>{saving?'Saving...':'Save'}</button>
              <a href={`/orders/new`} style={{ ...S.btn, background:'rgba(29,184,112,.1)', color:'#1DB870', border:'1px solid rgba(29,184,112,.2)', textDecoration:'none', display:'inline-flex', alignItems:'center' }}>
                Create Service Order
              </a>
            </div>
          </div>

          <div style={S.card}>
            <div style={{ fontSize:12, fontWeight:700, color:t.text, marginBottom:12 }}>Service History</div>
            {history.length === 0 ? (
              <div style={{ textAlign:'center', padding:16, color:t.textTertiary, fontSize:12 }}>No recorded services yet</div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>{['SO #','Date','Total','Status'].map(h=><th key={h} style={S.th as any}>{h}</th>)}</tr></thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id} style={{ cursor:'pointer' }} onClick={()=>window.location.href=`/orders/${h.id}`}>
                      <td style={{ ...S.td, fontFamily:'monospace', fontSize:10, color:'#4D9EFF' }}>{h.so_number}</td>
                      <td style={{ ...S.td, color:t.textSecondary }}>{new Date(h.created_at).toLocaleDateString()}</td>
                      <td style={{ ...S.td, fontFamily:'monospace' }}>{h.grand_total?`$${h.grand_total.toFixed(0)}`:'—'}</td>
                      <td style={{ ...S.td, fontSize:9, color:t.textSecondary, fontFamily:'monospace' }}>{h.status?.replace(/_/g,' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Truck info */}
        <div style={S.card}>
          <div style={{ fontSize:12, fontWeight:700, color:t.text, marginBottom:12 }}>Vehicle</div>
          {[
            { label:'Unit #', val:'#'+asset?.unit_number },
            { label:'Year',   val: asset?.year },
            { label:'Make',   val: asset?.make },
            { label:'Model',  val: asset?.model },
            { label:'Engine', val: asset?.engine },
            { label:'Current Odometer', val: asset?.odometer ? asset.odometer.toLocaleString()+' mi' : null },
          ].filter(r=>r.val).map(r => (
            <div key={r.label} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,.04)', fontSize:12 }}>
              <span style={{ color:t.textTertiary }}>{r.label}</span>
              <span style={{ color:t.text }}>{r.val}</span>
            </div>
          ))}
          <a href={`/fleet`} style={{ display:'block', marginTop:12, fontSize:11, color:'#4D9EFF', textDecoration:'none' }}>View full truck profile →</a>
        </div>
      </div>
    </div>
  )
}
