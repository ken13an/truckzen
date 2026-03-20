'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

export default function FleetDetailPage() {
  const params = useParams(); const router = useRouter()
  const supabase = createClient()
  const [asset,   setAsset]   = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [pms,     setPMs]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [edit,    setEdit]    = useState<any>(null)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { router.push('/login'); return }

      const [{ data: a }, { data: h }, { data: p }] = await Promise.all([
        supabase.from('assets').select('*, customers(company_name)').eq('id', params.id).eq('shop_id', profile.shop_id).single(),
        supabase.from('service_orders').select('id, so_number, status, complaint, grand_total, completed_at, created_at').eq('asset_id', params.id).order('created_at', { ascending:false }).limit(20),
        supabase.from('pm_schedules').select('*').eq('asset_id', params.id).eq('active', true),
      ])

      if (!a) { router.push('/fleet'); return }
      setAsset(a); setEdit(a); setHistory(h || []); setPMs(p || [])
      setLoading(false)
    }
    load()
  }, [params.id])

  async function save() {
    setSaving(true)
    await fetch(`/api/assets/${params.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ unit_number:edit.unit_number, year:edit.year, make:edit.make, model:edit.model, engine:edit.engine, odometer:edit.odometer, status:edit.status, ownership_type:edit.ownership_type }) })
    setAsset(edit); setSaving(false)
  }

  const S: Record<string, React.CSSProperties> = {
    page:  { background:'#060708', minHeight:'100vh', color:'#DDE3EE', fontFamily:"'Instrument Sans',sans-serif", padding:24 },
    card:  { background:'#161B24', border:'1px solid rgba(255,255,255,.055)', borderRadius:12, padding:16, marginBottom:12 },
    label: { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, letterSpacing:'.1em', textTransform:'uppercase' as const, color:'#48536A', marginBottom:5, display:'block' },
    input: { width:'100%', padding:'8px 11px', background:'#1C2130', border:'1px solid rgba(255,255,255,.08)', borderRadius:7, fontSize:12, color:'#DDE3EE', outline:'none', fontFamily:'inherit', minHeight:36, boxSizing:'border-box' as const },
    row2:  { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 },
    th:    { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:'#48536A', textTransform:'uppercase', letterSpacing:'.08em', padding:'6px 10px', textAlign:'left', background:'#0B0D11' },
    td:    { padding:'9px 10px', borderBottom:'1px solid rgba(255,255,255,.025)', fontSize:11 },
    btn:   { padding:'8px 16px', borderRadius:8, border:'none', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  }

  if (loading) return <div style={{ ...S.page, color:'#7C8BA0', padding:60 }}>Loading...</div>

  const statusColor: Record<string, string> = { active:'#1DB870', in_shop:'#4D9EFF', inactive:'#7C8BA0', decommissioned:'#D94F4F' }

  return (
    <div style={S.page}>
      <a href="/fleet" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 14, fontWeight: 700, color: '#EDEDF0', textDecoration: 'none', marginBottom: 20 }}>
  <ChevronLeft size={16} strokeWidth={2} /> Fleet
</a>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:32, color:'#F0F4FF', letterSpacing:'.02em' }}>Unit #{asset.unit_number}</div>
          <div style={{ fontSize:14, color:'#DDE3EE', marginTop:2 }}>{asset.year} {asset.make} {asset.model}</div>
          <div style={{ fontSize:12, color:'#7C8BA0', marginTop:2 }}>{(asset.customers as any)?.company_name}{asset.ownership_type && asset.ownership_type !== 'fleet_asset' ? ` — ${asset.ownership_type.replace(/_/g, ' ')}` : ''}</div>
        </div>
        <div style={{ display:'flex', gap:8, flexDirection:'column', alignItems:'flex-end' }}>
          <span style={{ padding:'4px 12px', borderRadius:100, fontFamily:'monospace', fontSize:9, background:(statusColor[asset.status]||'#7C8BA0')+'18', color:statusColor[asset.status]||'#7C8BA0', border:`1px solid ${statusColor[asset.status]||'#7C8BA0'}33` }}>
            {(asset.status||'active').replace(/_/g,' ').toUpperCase()}
          </span>
          <div style={{ fontFamily:'monospace', fontSize:12, color:'#7C8BA0' }}>{asset.odometer?.toLocaleString()} mi</div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:14, alignItems:'start' }}>
        <div>
          {/* Edit form */}
          <div style={S.card}>
            <div style={{ fontSize:12, fontWeight:700, color:'#F0F4FF', marginBottom:12 }}>Vehicle Details</div>
            <div style={S.row2}>
              <div><label style={S.label}>Unit Number</label><input style={S.input} value={edit?.unit_number||''} onChange={e=>setEdit((a:any)=>({...a,unit_number:e.target.value}))}/></div>
              <div><label style={S.label}>VIN</label><input value={edit?.vin||''} readOnly style={{ ...S.input, opacity:.6 }}/></div>
            </div>
            <div style={S.row2}>
              <div><label style={S.label}>Year</label><input style={S.input} type="number" value={edit?.year||''} onChange={e=>setEdit((a:any)=>({...a,year:parseInt(e.target.value)||null}))}/></div>
              <div><label style={S.label}>Make</label><input style={S.input} value={edit?.make||''} onChange={e=>setEdit((a:any)=>({...a,make:e.target.value}))}/></div>
            </div>
            <div style={S.row2}>
              <div><label style={S.label}>Model</label><input style={S.input} value={edit?.model||''} onChange={e=>setEdit((a:any)=>({...a,model:e.target.value}))}/></div>
              <div><label style={S.label}>Engine</label><input style={S.input} value={edit?.engine||''} onChange={e=>setEdit((a:any)=>({...a,engine:e.target.value}))}/></div>
            </div>
            <div style={S.row2}>
              <div><label style={S.label}>Current Odometer</label><input style={S.input} type="number" value={edit?.odometer||0} onChange={e=>setEdit((a:any)=>({...a,odometer:parseInt(e.target.value)||0}))}/></div>
              <div><label style={S.label}>Ownership Type</label>
                <select style={{ ...S.input, appearance:'none', cursor:'pointer' }} value={edit?.ownership_type||'fleet_asset'} onChange={e=>setEdit((a:any)=>({...a,ownership_type:e.target.value}))}>
                  <option value="fleet_asset">Fleet Asset</option>
                  <option value="owner_operator">Owner Operator</option>
                  <option value="outside_customer">Outside Customer</option>
                </select>
              </div>
            </div>
            <div style={S.row2}>
              <div><label style={S.label}>Status</label>
                <select style={{ ...S.input, appearance:'none', cursor:'pointer' }} value={edit?.status||'active'} onChange={e=>setEdit((a:any)=>({...a,status:e.target.value}))}>
                  {['active','in_shop','inactive','decommissioned'].map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
                </select>
              </div>
            </div>
            <button style={{ ...S.btn, background:'linear-gradient(135deg,#1D6FE8,#1248B0)', color:'#fff' }} onClick={save} disabled={saving}>{saving?'Saving...':'Save'}</button>
          </div>

          {/* Service history */}
          <div style={S.card}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#F0F4FF' }}>Service History ({history.length})</div>
              <a href={`/orders/new`} style={{ fontSize:11, color:'#4D9EFF', textDecoration:'none' }}>+ New SO</a>
            </div>
            {history.length === 0 ? (
              <div style={{ textAlign:'center', padding:20, color:'#48536A', fontSize:12 }}>No service history</div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>{['SO #','Date','Complaint','Total','Status'].map(h=><th key={h} style={S.th as any}>{h}</th>)}</tr></thead>
                <tbody>
                  {history.map(so => (
                    <tr key={so.id} style={{ cursor:'pointer' }} onClick={() => window.location.href=`/orders/${so.id}`}>
                      <td style={{ ...S.td, fontFamily:'monospace', fontSize:10, color:'#4D9EFF' }}>{so.so_number}</td>
                      <td style={{ ...S.td, color:'#7C8BA0' }}>{new Date(so.created_at).toLocaleDateString()}</td>
                      <td style={{ ...S.td, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{so.complaint}</td>
                      <td style={{ ...S.td, fontFamily:'monospace' }}>{so.grand_total?`$${so.grand_total.toFixed(0)}`:'—'}</td>
                      <td style={{ ...S.td, fontFamily:'monospace', fontSize:9, color:'#7C8BA0' }}>{so.status?.replace(/_/g,' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: PM schedules */}
        <div style={S.card}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#F0F4FF' }}>PM Schedules</div>
            <a href="/maintenance/new" style={{ fontSize:11, color:'#4D9EFF', textDecoration:'none' }}>+ Add</a>
          </div>
          {pms.length === 0 ? (
            <div style={{ textAlign:'center', padding:20, color:'#48536A', fontSize:12 }}>No PM schedules</div>
          ) : pms.map(pm => {
            const today   = new Date().toISOString().split('T')[0]
            const isOver  = pm.next_due_date < today
            const color   = isOver ? '#D94F4F' : '#1DB870'
            return (
              <div key={pm.id} style={{ padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                <div style={{ fontSize:12, fontWeight:600, color:'#F0F4FF' }}>{pm.service_name}</div>
                <div style={{ fontSize:10, color:color, marginTop:3, fontFamily:'monospace' }}>{isOver?'OVERDUE — ':''}{pm.next_due_date}</div>
                {pm.interval_miles && <div style={{ fontSize:10, color:'#48536A' }}>Every {pm.interval_miles.toLocaleString()} miles</div>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
