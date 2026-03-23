'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import OwnershipTypeBadge from '@/components/OwnershipTypeBadge'

export default function FleetDetailPage() {
  const params = useParams(); const router = useRouter()
  const supabase = createClient()
  const [asset,   setAsset]   = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [pms,     setPMs]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [edit,    setEdit]    = useState<any>(null)
  const [saving,  setSaving]  = useState(false)
  const [activeWos, setActiveWos] = useState<any[]>([])
  const [warrantyMode, setWarrantyMode] = useState<'none' | 'has'>('none')

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { router.push('/login'); return }

      const [{ data: a }, { data: h }, { data: p }, { data: activeWos }] = await Promise.all([
        supabase.from('assets').select('*, customers(company_name, is_fleet)').eq('id', params.id).eq('shop_id', profile.shop_id).single(),
        supabase.from('service_orders').select('id, so_number, status, complaint, grand_total, completed_at, created_at').eq('asset_id', params.id).is('deleted_at', null).or('status.in.(done,good_to_go,closed),is_historical.eq.true').order('created_at', { ascending:false }).limit(20),
        supabase.from('pm_schedules').select('*').eq('asset_id', params.id).eq('active', true),
        supabase.from('service_orders').select('id, so_number, status, complaint, created_at').eq('asset_id', params.id).is('deleted_at', null).not('status', 'in', '("done","good_to_go","closed","void")').or('is_historical.is.null,is_historical.eq.false').order('created_at', { ascending:false }).limit(10),
      ])

      if (!a) { router.push('/fleet'); return }
      setAsset(a); setEdit(a); setHistory(h || []); setPMs(p || []); setActiveWos(activeWos || [])
      setWarrantyMode(a.warranty_provider || a.warranty_expiry ? 'has' : 'none')
      setLoading(false)
    }
    load()
  }, [params.id])

  async function save() {
    setSaving(true)
    await fetch(`/api/assets/${params.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ unit_number:edit.unit_number, year:edit.year, make:edit.make, model:edit.model, engine:edit.engine, odometer:edit.odometer, status:edit.status, ownership_type:edit.ownership_type, unit_type:edit.unit_type }) })
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

  const UNIT_TYPE_LABEL: Record<string, string> = { tractor: 'Tractor', trailer_dry_van: 'Dry Van', trailer_reefer: 'Reefer', trailer_flatbed: 'Flatbed', trailer_tanker: 'Tanker', trailer_lowboy: 'Lowboy', trailer_other: 'Trailer' }
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
          {asset.unit_type && <div style={{ fontSize:12, color:'#7C8BA0', marginTop:2 }}>{UNIT_TYPE_LABEL[asset.unit_type] || asset.unit_type}</div>}
          <div style={{ fontSize:12, color:'#7C8BA0', marginTop:2 }}>{(asset.customers as any)?.company_name}</div>
          <div style={{ marginTop:6 }}><OwnershipTypeBadge type={asset.ownership_type} dark /></div>
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
              <div><label style={S.label}>Truck Type</label>
                <select style={{ ...S.input, appearance:'none', cursor:'pointer' }} value={edit?.ownership_type||'fleet_asset'} onChange={e=>setEdit((a:any)=>({...a,ownership_type:e.target.value}))}>
                  <option value="fleet_asset">Company Truck</option>
                  <option value="owner_operator">Owner Operator</option>
                  <option value="outside_customer">Outside Customer</option>
                </select>
                {edit?.ownership_type !== asset?.ownership_type && <div style={{ fontSize: 10, color: '#D97706', marginTop: 3 }}>Changing truck type affects estimate requirements and pricing for future WOs</div>}
              </div>
            </div>
            <div style={S.row2}>
              <div><label style={S.label}>Status</label>
                <select style={{ ...S.input, appearance:'none', cursor:'pointer' }} value={edit?.status||'active'} onChange={e=>setEdit((a:any)=>({...a,status:e.target.value}))}>
                  {['active','in_shop','inactive','decommissioned'].map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
                </select>
              </div>
              <div><label style={S.label}>Unit Type</label>
                <select style={{ ...S.input, appearance:'none', cursor:'pointer' }} value={edit?.unit_type||'tractor'} onChange={e=>setEdit((a:any)=>({...a,unit_type:e.target.value}))}>
                  <option value="tractor">Tractor</option>
                  <option value="trailer_dry_van">Trailer - Dry Van</option>
                  <option value="trailer_reefer">Trailer - Reefer</option>
                  <option value="trailer_flatbed">Trailer - Flatbed</option>
                  <option value="trailer_tanker">Trailer - Tanker</option>
                  <option value="trailer_lowboy">Trailer - Lowboy</option>
                  <option value="trailer_other">Trailer - Other</option>
                </select>
              </div>
            </div>
            <button style={{ ...S.btn, background:'linear-gradient(135deg,#1D6FE8,#1248B0)', color:'#fff' }} onClick={save} disabled={saving}>{saving?'Saving...':'Save'}</button>
          </div>

          {/* Warranty section — toggle */}
          <div style={S.card}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#F0F4FF' }}>Warranty</div>
              <div style={{ display:'flex', gap:4 }}>
                <button onClick={() => { setWarrantyMode('none'); setEdit((a:any) => ({...a, warranty_provider:null, warranty_start:null, warranty_expiry:null, warranty_mileage_limit:null, warranty_notes:null, warranty_coverage_type:null})) }} style={{ padding:'4px 10px', borderRadius:6, fontSize:10, fontWeight:600, cursor:'pointer', fontFamily:'inherit', background: warrantyMode==='none' ? 'rgba(124,139,160,.12)' : 'transparent', color: warrantyMode==='none' ? '#7C8BA0' : '#48536A', border: warrantyMode==='none' ? '1px solid rgba(124,139,160,.2)' : '1px solid rgba(255,255,255,.06)' }}>No Warranty</button>
                <button onClick={() => setWarrantyMode('has')} style={{ padding:'4px 10px', borderRadius:6, fontSize:10, fontWeight:600, cursor:'pointer', fontFamily:'inherit', background: warrantyMode==='has' ? 'rgba(29,184,112,.1)' : 'transparent', color: warrantyMode==='has' ? '#1DB870' : '#48536A', border: warrantyMode==='has' ? '1px solid rgba(29,184,112,.2)' : '1px solid rgba(255,255,255,.06)' }}>Has Warranty</button>
              </div>
            </div>
            {warrantyMode === 'none' ? (
              <div style={{ textAlign:'center', padding:12, color:'#48536A', fontSize:12 }}>No warranty on file</div>
            ) : (
              <>
                {/* Auto status badge */}
                {edit?.warranty_expiry && (() => {
                  const exp = new Date(edit.warranty_expiry)
                  const isActive = exp > new Date() && (!edit.warranty_mileage_limit || !edit.odometer || edit.odometer < edit.warranty_mileage_limit)
                  const isExpired = exp <= new Date()
                  const isMileageExceeded = edit.warranty_mileage_limit && edit.odometer && edit.odometer >= edit.warranty_mileage_limit
                  const monthsLeft = Math.max(0, Math.round((exp.getTime() - Date.now()) / (30*86400000)))
                  return (
                    <div style={{ marginBottom:10, padding:'6px 10px', borderRadius:6, fontSize:11, fontWeight:600,
                      background: isActive ? 'rgba(29,184,112,.08)' : isMileageExceeded ? 'rgba(212,136,42,.08)' : 'rgba(124,139,160,.06)',
                      color: isActive ? '#1DB870' : isMileageExceeded ? '#D4882A' : '#7C8BA0',
                      border: `1px solid ${isActive ? 'rgba(29,184,112,.15)' : isMileageExceeded ? 'rgba(212,136,42,.15)' : 'rgba(124,139,160,.1)'}` }}>
                      {isActive ? `Active — expires in ${monthsLeft} month${monthsLeft!==1?'s':''}` : isMileageExceeded ? 'Mileage Exceeded' : isExpired ? 'Expired' : 'Unknown'}
                    </div>
                  )
                })()}
                <div style={S.row2}>
                  <div><label style={S.label}>Provider</label>
                    <select style={{...S.input, appearance:'auto'}} value={edit?.warranty_provider||''} onChange={e=>setEdit((a:any)=>({...a,warranty_provider:e.target.value}))}>
                      <option value="">Select...</option>
                      <option value="Freightliner / Daimler">Freightliner / Daimler</option>
                      <option value="PACCAR (Kenworth / Peterbilt)">PACCAR (Kenworth / Peterbilt)</option>
                      <option value="Volvo">Volvo</option>
                      <option value="Navistar (International)">Navistar (International)</option>
                      <option value="Mack">Mack</option>
                      <option value="Hino">Hino</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div><label style={S.label}>Coverage Type</label>
                    <select style={{...S.input, appearance:'auto'}} value={edit?.warranty_coverage_type||''} onChange={e=>setEdit((a:any)=>({...a,warranty_coverage_type:e.target.value}))}>
                      <option value="">Select...</option>
                      <option value="Powertrain">Powertrain</option>
                      <option value="Full Vehicle">Full Vehicle</option>
                      <option value="Extended">Extended</option>
                      <option value="Emissions">Emissions</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <div style={S.row2}>
                  <div><label style={S.label}>Start Date</label><input style={S.input} type="date" value={edit?.warranty_start||''} onChange={e=>setEdit((a:any)=>({...a,warranty_start:e.target.value}))}/></div>
                  <div><label style={S.label}>Expiry Date</label><input style={S.input} type="date" value={edit?.warranty_expiry||''} onChange={e=>setEdit((a:any)=>({...a,warranty_expiry:e.target.value}))}/></div>
                </div>
                <div style={S.row2}>
                  <div><label style={S.label}>Mileage Limit</label><input style={S.input} type="number" value={edit?.warranty_mileage_limit||''} onChange={e=>setEdit((a:any)=>({...a,warranty_mileage_limit:parseInt(e.target.value)||null}))} placeholder="e.g. 500000"/></div>
                  <div />
                </div>
                <div style={{ marginBottom:10 }}>
                  <label style={S.label}>Notes</label>
                  <textarea style={{ ...S.input, minHeight:50, resize:'vertical' }} value={edit?.warranty_notes||''} onChange={e=>setEdit((a:any)=>({...a,warranty_notes:e.target.value}))} placeholder="Dealer contact, coverage details..."/>
                </div>
                <button style={{ ...S.btn, background:'linear-gradient(135deg,#1D6FE8,#1248B0)', color:'#fff' }} onClick={async () => {
                  setSaving(true)
                  await fetch(`/api/assets/${params.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ warranty_provider:edit.warranty_provider||null, warranty_start:edit.warranty_start||null, warranty_expiry:edit.warranty_expiry||null, warranty_mileage_limit:edit.warranty_mileage_limit||null, warranty_notes:edit.warranty_notes||null, warranty_coverage_type:edit.warranty_coverage_type||null }) })
                  setAsset(edit); setSaving(false)
                }} disabled={saving}>{saving?'Saving...':'Save Warranty Info'}</button>
              </>
            )}
          </div>

          {/* Active Work Orders */}
          {activeWos.length > 0 && (
            <div style={{ ...S.card, borderColor:'rgba(29,111,232,.2)' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#4D9EFF', marginBottom:10 }}>Active Work Orders ({activeWos.length})</div>
              {activeWos.map((wo:any) => (
                <a key={wo.id} href={`/work-orders/${wo.id}`} style={{ display:'block', textDecoration:'none', padding:'8px 10px', borderLeft:'3px solid #1D6FE8', background:'rgba(29,111,232,.04)', borderRadius:6, marginBottom:6 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:700, color:'#4D9EFF' }}>{wo.so_number}</span>
                    <span style={{ fontSize:9, fontWeight:600, color:'#D4882A', background:'rgba(212,136,42,.1)', padding:'2px 6px', borderRadius:4, textTransform:'uppercase' }}>{wo.status?.replace(/_/g,' ')}</span>
                  </div>
                  <div style={{ fontSize:11, color:'#DDE3EE', marginTop:2 }}>{wo.complaint?.slice(0,60) || '—'}</div>
                </a>
              ))}
            </div>
          )}

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
