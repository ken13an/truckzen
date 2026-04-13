'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import OwnershipTypeBadge from '@/components/OwnershipTypeBadge'
import { getWorkorderRoute } from '@/lib/navigation/workorder-route'
import { useTheme } from '@/hooks/useTheme'

type PageTab = 'overview' | 'history'

export default function FleetDetailPage() {
  const { tokens: t } = useTheme()
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
  const [pageTab, setPageTab] = useState<PageTab>('overview')
  const [userRole, setUserRole] = useState('')

  // Full History state
  const [historyData, setHistoryData] = useState<any[]>([])
  const [historySummary, setHistorySummary] = useState<any>(null)
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyPage, setHistoryPage] = useState(1)
  const [historySource, setHistorySource] = useState('all')
  const [historySearch, setHistorySearch] = useState('')
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { router.push('/login'); return }
      setUserRole(profile.role)

      const assetRes = await fetch(`/api/assets/${params.id}`).then(r => r.ok ? r.json() : null)
      const a = assetRes

      if (!a) { router.push('/fleet'); return }

      // Fetch service history and PMs via service_orders from the asset's history API
      const [histRes, activeRes] = await Promise.all([
        fetch(`/api/assets/${params.id}/history?page=1&limit=20&source=inhouse`).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
        fetch(`/api/service-orders?shop_id=${profile.shop_id}&limit=10`).then(r => r.ok ? r.json() : []).catch(() => []),
      ])
      const h = (histRes.data || []).map((r: any) => ({ id: r.id, so_number: r.reference_number, status: r.status, complaint: r.description, grand_total: r.total_cost, completed_at: r.date, created_at: r.date }))
      const activeFiltered = (Array.isArray(activeRes) ? activeRes : []).filter((wo: any) => wo.assets?.id === String(params.id) && !['done','good_to_go','closed','void'].includes(wo.status))

      setAsset(a); setEdit(a); setHistory(h); setPMs([]); setActiveWos(activeFiltered)
      setWarrantyMode(a.warranty_provider || a.warranty_expiry ? 'has' : 'none')
      setLoading(false)
    }
    load()
  }, [params.id])

  const fetchHistory = useCallback(async () => {
    if (!params.id) return
    setHistoryLoading(true)
    let url = `/api/assets/${params.id}/history?page=${historyPage}&limit=50&source=${historySource}`
    if (historySearch) url += `&search=${encodeURIComponent(historySearch)}`
    try {
      const res = await fetch(url)
      if (res.ok) {
        const json = await res.json()
        setHistoryData(json.data || [])
        setHistoryTotal(json.total || 0)
        setHistorySummary(json.summary || null)
      }
    } catch { /* ignore */ }
    setHistoryLoading(false)
  }, [params.id, historyPage, historySource, historySearch])

  useEffect(() => {
    if (pageTab === 'history') fetchHistory()
  }, [pageTab, fetchHistory])

  async function save() {
    setSaving(true)
    await fetch(`/api/assets/${params.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ unit_number:edit.unit_number, year:edit.year, make:edit.make, model:edit.model, engine:edit.engine, odometer:edit.odometer, status:edit.status, ownership_type:edit.ownership_type, unit_type:edit.unit_type }) })
    setAsset(edit); setSaving(false)
  }

  const S: Record<string, React.CSSProperties> = {
    page:  { background:'var(--tz-bg)', minHeight:'100vh', color:'var(--tz-text)', fontFamily:"'Instrument Sans',sans-serif", padding:24 },
    card:  { background:'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius:12, padding:16, marginBottom:12 },
    label: { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, letterSpacing:'.1em', textTransform:'uppercase' as const, color:'var(--tz-textTertiary)', marginBottom:5, display:'block' },
    input: { width:'100%', padding:'8px 11px', background:'var(--tz-inputBg)', border: `1px solid ${'var(--tz-border)'}`, borderRadius:7, fontSize:12, color:'var(--tz-text)', outline:'none', fontFamily:'inherit', minHeight:36, boxSizing:'border-box' as const },
    row2:  { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 },
    th:    { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:'var(--tz-textTertiary)', textTransform:'uppercase', letterSpacing:'.08em', padding:'6px 10px', textAlign:'left', background: 'var(--tz-bgInput)' },
    td:    { padding:'9px 10px', borderBottom: `1px solid ${'var(--tz-border)'}`, fontSize:11 },
    btn:   { padding:'8px 16px', borderRadius:8, border:'none', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  }

  if (loading) return <div style={{ ...S.page, color:'var(--tz-textSecondary)', padding:60 }}>Loading...</div>

  const UNIT_TYPE_LABEL: Record<string, string> = { tractor: 'Tractor', trailer_dry_van: 'Dry Van', trailer_reefer: 'Reefer', trailer_flatbed: 'Flatbed', trailer_tanker: 'Tanker', trailer_lowboy: 'Lowboy', trailer_other: 'Trailer' }
  const statusColor: Record<string, string> = { active:'#1DB870', in_shop: 'var(--tz-accentLight)', inactive:'var(--tz-textSecondary)', decommissioned:'#D94F4F' }

  const fmt = (n: number | null | undefined) => n != null ? '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '$0'
  const historyTotalPages = Math.ceil(historyTotal / 50) || 1

  return (
    <div style={S.page}>
      <a href="/fleet" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--tz-border)', borderRadius: 8, fontSize: 14, fontWeight: 700, color: 'var(--tz-text)', textDecoration: 'none', marginBottom: 20 }}>
  <ChevronLeft size={16} strokeWidth={2} /> Fleet
</a>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:32, color:'var(--tz-text)', letterSpacing:'.02em' }}>Unit #{asset.unit_number}</div>
          <div style={{ fontSize:14, color:'var(--tz-text)', marginTop:2 }}>{asset.year} {asset.make} {asset.model}</div>
          {asset.unit_type && <div style={{ fontSize:12, color:'var(--tz-textSecondary)', marginTop:2 }}>{UNIT_TYPE_LABEL[asset.unit_type] || asset.unit_type}</div>}
          <div style={{ fontSize:12, color:'var(--tz-textSecondary)', marginTop:2 }}>{(asset.customers as any)?.company_name}</div>
          <div style={{ marginTop:6 }}><OwnershipTypeBadge type={asset.is_owner_operator ? 'owner_operator' : asset.ownership_type} dark /></div>
        </div>
        <div style={{ display:'flex', gap:8, flexDirection:'column', alignItems:'flex-end' }}>
          <span style={{ padding:'4px 12px', borderRadius:100, fontFamily:'monospace', fontSize:9, background:(statusColor[asset.status]|| 'var(--tz-textSecondary)')+'18', color:statusColor[asset.status]|| 'var(--tz-textSecondary)', border:`1px solid ${statusColor[asset.status]|| 'var(--tz-textSecondary)'}33` }}>
            {(asset.status||'active').replace(/_/g,' ').toUpperCase()}
          </span>
          <div style={{ fontFamily:'monospace', fontSize:12, color:'var(--tz-textSecondary)' }}>{asset.odometer?.toLocaleString()} mi</div>
        </div>
      </div>

      {/* OWNERSHIP & DRIVER */}
      {(asset.owner_name || asset.driver_name) && (
        <div style={{ background:'var(--tz-border)', border: `1px solid ${'var(--tz-border)'}`, borderRadius:10, padding:'12px 16px', marginBottom:16, display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, fontSize:12 }}>
          <div>
            <div style={{ fontSize:9, fontWeight:700, color:'var(--tz-textSecondary)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:3 }}>Owner</div>
            <div style={{ color:'var(--tz-text)', fontWeight:600 }}>
              {asset.owner_name || <span style={{ color:'var(--tz-textSecondary)', fontStyle:'italic' }}>Not assigned</span>}
            </div>
            {asset.owner_phone && <a href={`tel:${asset.owner_phone}`} style={{ color: 'var(--tz-accent)', textDecoration:'none', fontSize:11, marginTop:2, display:'inline-block' }}>{asset.owner_phone}</a>}
          </div>
          <div>
            <div style={{ fontSize:9, fontWeight:700, color:'var(--tz-textSecondary)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:3 }}>Driver</div>
            <div style={{ color:'var(--tz-text)', fontWeight:600 }}>
              {asset.driver_name || <span style={{ color:'var(--tz-textSecondary)', fontStyle:'italic' }}>Not assigned</span>}
            </div>
            {asset.driver_phone && <a href={`tel:${asset.driver_phone}`} style={{ color: 'var(--tz-accent)', textDecoration:'none', fontSize:11, marginTop:2, display:'inline-block' }}>{asset.driver_phone}</a>}
          </div>
          {asset.lease_info && (
            <div>
              <div style={{ fontSize:9, fontWeight:700, color:'var(--tz-textSecondary)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:3 }}>Lease</div>
              <div style={{ color:'var(--tz-text)' }}>{asset.lease_info}</div>
            </div>
          )}
          {asset.asset_status && asset.asset_status !== 'active' && (
            <div>
              <div style={{ fontSize:9, fontWeight:700, color:'var(--tz-textSecondary)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:3 }}>Status</div>
              <span style={{ padding:'2px 8px', borderRadius:100, fontSize:10, fontWeight:600, background:'rgba(220,38,38,.12)', color:'#DC2626', border:'1px solid rgba(220,38,38,.2)' }}>Removed</span>
            </div>
          )}
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display:'flex', gap:0, borderBottom: `1px solid ${'var(--tz-border)'}`, marginBottom:16 }}>
        {([['overview', 'Overview'], ['history', 'Full History']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setPageTab(key)} style={{
            padding:'10px 20px', background:'none', border:'none',
            borderBottom: pageTab === key ? `2px solid ${'var(--tz-accent)'}` : '2px solid transparent',
            color: pageTab === key ? 'var(--tz-text)' : 'var(--tz-textSecondary)',
            fontWeight: pageTab === key ? 700 : 500, fontSize:13, cursor:'pointer',
            fontFamily:'inherit', marginBottom:-1,
          }}>{label}</button>
        ))}
      </div>

      {/* Overview tab */}
      {pageTab === 'overview' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:14, alignItems:'start' }}>
          <div>
            {/* Edit form */}
            <div style={S.card}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--tz-text)', marginBottom:12 }}>Vehicle Details</div>
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
              <button style={{ ...S.btn, background:'var(--tz-accent)', color: 'var(--tz-bgLight)' }} onClick={save} disabled={saving}>{saving?'Saving...':'Save'}</button>
            </div>

            {/* Warranty section */}
            <div style={S.card}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--tz-text)' }}>Warranty</div>
                <div style={{ display:'flex', gap:4 }}>
                  <button onClick={() => { setWarrantyMode('none'); setEdit((a:any) => ({...a, warranty_provider:null, warranty_start:null, warranty_expiry:null, warranty_mileage_limit:null, warranty_notes:null, warranty_coverage_type:null})) }} style={{ padding:'4px 10px', borderRadius:6, fontSize:10, fontWeight:600, cursor:'pointer', fontFamily:'inherit', background: warrantyMode==='none' ? 'rgba(124,139,160,.12)' : 'transparent', color: warrantyMode==='none' ? 'var(--tz-textSecondary)' : 'var(--tz-textTertiary)', border: warrantyMode==='none' ? '1px solid rgba(124,139,160,.2)' : `1px solid ${'var(--tz-border)'}` }}>No Warranty</button>
                  <button onClick={() => setWarrantyMode('has')} style={{ padding:'4px 10px', borderRadius:6, fontSize:10, fontWeight:600, cursor:'pointer', fontFamily:'inherit', background: warrantyMode==='has' ? 'rgba(29,184,112,.1)' : 'transparent', color: warrantyMode==='has' ? '#1DB870' : 'var(--tz-textTertiary)', border: warrantyMode==='has' ? '1px solid rgba(29,184,112,.2)' : `1px solid ${'var(--tz-border)'}` }}>Has Warranty</button>
                </div>
              </div>
              {warrantyMode === 'none' ? (
                <div style={{ textAlign:'center', padding:12, color:'var(--tz-textTertiary)', fontSize:12 }}>No warranty on file</div>
              ) : (
                <>
                  {edit?.warranty_expiry && (() => {
                    const exp = new Date(edit.warranty_expiry)
                    const isActive = exp > new Date() && (!edit.warranty_mileage_limit || !edit.odometer || edit.odometer < edit.warranty_mileage_limit)
                    const isExpired = exp <= new Date()
                    const isMileageExceeded = edit.warranty_mileage_limit && edit.odometer && edit.odometer >= edit.warranty_mileage_limit
                    const monthsLeft = Math.max(0, Math.round((exp.getTime() - Date.now()) / (30*86400000)))
                    return (
                      <div style={{ marginBottom:10, padding:'6px 10px', borderRadius:6, fontSize:11, fontWeight:600,
                        background: isActive ? 'rgba(29,184,112,.08)' : isMileageExceeded ? 'rgba(212,136,42,.08)' : 'rgba(124,139,160,.06)',
                        color: isActive ? '#1DB870' : isMileageExceeded ? '#D4882A' : 'var(--tz-textSecondary)',
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
                  <button style={{ ...S.btn, background:'var(--tz-accent)', color: 'var(--tz-bgLight)' }} onClick={async () => {
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
                <div style={{ fontSize:12, fontWeight:700, color: 'var(--tz-accentLight)', marginBottom:10 }}>Active Work Orders ({activeWos.length})</div>
                {activeWos.map((wo:any) => (
                  <a key={wo.id} href={getWorkorderRoute(wo.id, undefined, 'fleet')} style={{ display:'block', textDecoration:'none', padding:'8px 10px', borderLeft:`3px solid ${'var(--tz-accent)'}`, background:'rgba(29,111,232,.04)', borderRadius:6, marginBottom:6 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:700, color: 'var(--tz-accentLight)' }}>{wo.so_number}</span>
                      <span style={{ fontSize:9, fontWeight:600, color:'#D4882A', background:'rgba(212,136,42,.1)', padding:'2px 6px', borderRadius:4, textTransform:'uppercase' }}>{wo.status?.replace(/_/g,' ')}</span>
                    </div>
                    <div style={{ fontSize:11, color:'var(--tz-text)', marginTop:2 }}>{wo.complaint?.slice(0,60) || '—'}</div>
                  </a>
                ))}
              </div>
            )}

            {/* Service history */}
            <div style={S.card}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--tz-text)' }}>Service History ({history.length})</div>
                <a href={`/orders/new`} style={{ fontSize:11, color: 'var(--tz-accentLight)', textDecoration:'none' }}>+ New SO</a>
              </div>
              {history.length === 0 ? (
                <div style={{ textAlign:'center', padding:20, color:'var(--tz-textTertiary)', fontSize:12 }}>No service history</div>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><tr>{['SO #','Date','Complaint','Total','Status'].map(h=><th key={h} style={S.th as any}>{h}</th>)}</tr></thead>
                  <tbody>
                    {history.map(so => (
                      <tr key={so.id} style={{ cursor:'pointer' }} onClick={() => window.location.href=`/orders/${so.id}`}>
                        <td style={{ ...S.td, fontFamily:'monospace', fontSize:10, color: 'var(--tz-accentLight)' }}>{so.so_number}</td>
                        <td style={{ ...S.td, color:'var(--tz-textSecondary)' }}>{new Date(so.created_at).toLocaleDateString()}</td>
                        <td style={{ ...S.td, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{so.complaint}</td>
                        <td style={{ ...S.td, fontFamily:'monospace' }}>{so.grand_total?`$${so.grand_total.toFixed(0)}`:'—'}</td>
                        <td style={{ ...S.td, fontFamily:'monospace', fontSize:9, color:'var(--tz-textSecondary)' }}>{so.status?.replace(/_/g,' ')}</td>
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
              <div style={{ fontSize:12, fontWeight:700, color:'var(--tz-text)' }}>PM Schedules</div>
              <a href="/maintenance/new" style={{ fontSize:11, color: 'var(--tz-accentLight)', textDecoration:'none' }}>+ Add</a>
            </div>
            {pms.length === 0 ? (
              <div style={{ textAlign:'center', padding:20, color:'var(--tz-textTertiary)', fontSize:12 }}>No PM schedules</div>
            ) : pms.map(pm => {
              const today   = new Date().toISOString().split('T')[0]
              const isOver  = pm.next_due_date < today
              const color   = isOver ? '#D94F4F' : '#1DB870'
              return (
                <div key={pm.id} style={{ padding:'10px 0', borderBottom: `1px solid ${'var(--tz-border)'}` }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--tz-text)' }}>{pm.service_name}</div>
                  <div style={{ fontSize:10, color:color, marginTop:3, fontFamily:'monospace' }}>{isOver?'OVERDUE — ':''}{pm.next_due_date}</div>
                  {pm.interval_miles && <div style={{ fontSize:10, color:'var(--tz-textTertiary)' }}>Every {pm.interval_miles.toLocaleString()} miles</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Full History tab */}
      {pageTab === 'history' && (
        <div>
          {/* Summary cards + cost comparison */}
          {(() => {
            const COST_ROLES = ['owner', 'gm', 'it_person', 'accountant', 'office_admin', 'floor_manager', 'shop_manager', 'parts_manager']
            const canSeeCost = COST_ROLES.includes(userRole)
            const ihCount = historySummary?.inhouse_count || 0
            const ohCount = historySummary?.outside_count || 0
            const ihTotal = historySummary?.inhouse_total || 0
            const ohTotal = historySummary?.outside_total || 0
            const totalCost = ihTotal + ohTotal
            const ihPct = totalCost > 0 ? Math.round((ihTotal / totalCost) * 100) : 0
            return (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginBottom:12 }}>
                  {[
                    { label: 'Total Records', value: historySummary ? String(ihCount + ohCount) : '—', color: 'var(--tz-text)' },
                    { label: 'In-House Jobs', value: String(ihCount), sub: canSeeCost ? fmt(ihTotal) : '***', color: 'var(--tz-accent)' },
                    { label: 'Outside Repairs', value: String(ohCount), sub: canSeeCost ? fmt(ohTotal) : '***', color: '#D4882A' },
                    { label: 'Total Spent', value: canSeeCost ? fmt(totalCost) : '***', color: '#1DB870' },
                  ].map(c => (
                    <div key={c.label} style={S.card}>
                      <div style={{ ...S.label, marginBottom:8 }}>{c.label}</div>
                      <div style={{ fontSize:22, fontWeight:800, color:c.color, fontFamily:"'IBM Plex Mono',monospace" }}>{c.value}</div>
                      {(c as any).sub && <div style={{ fontSize:11, color:'var(--tz-textSecondary)', marginTop:4, fontFamily:"'IBM Plex Mono',monospace" }}>{(c as any).sub}</div>}
                    </div>
                  ))}
                </div>
                {canSeeCost && totalCost > 0 && (
                  <div style={{ ...S.card, marginBottom:16, padding:'12px 16px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--tz-textSecondary)', marginBottom:6, fontFamily:"'IBM Plex Mono',monospace" }}>
                      <span>In-House {ihPct}%</span>
                      <span>Outside {100 - ihPct}%</span>
                    </div>
                    <div style={{ height:8, borderRadius:4, background:'rgba(212,136,42,.2)', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${ihPct}%`, background: 'var(--tz-accent)', borderRadius:4, transition:'width .3s' }} />
                    </div>
                  </div>
                )}
              </>
            )
          })()}

          {/* Filters */}
          <div style={{ display:'flex', gap:8, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
            <input
              value={historySearch}
              onChange={e => { setHistorySearch(e.target.value); setHistoryPage(1) }}
              placeholder="Search description, ref #, done by..."
              style={{ ...S.input, maxWidth:280, background:'var(--tz-inputBg)' }}
            />
            <select
              value={historySource}
              onChange={e => { setHistorySource(e.target.value); setHistoryPage(1) }}
              style={{ ...S.input, width:'auto', minWidth:140, appearance:'auto', cursor:'pointer', background:'var(--tz-inputBg)' }}
            >
              <option value="all">All Sources</option>
              <option value="inhouse">In-House Only</option>
              <option value="outside">Outside Only</option>
            </select>
            <div style={{ flex:1 }} />
            <div style={{ fontSize:12, color:'var(--tz-textSecondary)' }}>{historyTotal} total records</div>
          </div>

          {/* History table */}
          <div style={S.card}>
            {historyLoading ? (
              <div style={{ textAlign:'center', padding:40, color:'var(--tz-textTertiary)', fontSize:12 }}>Loading...</div>
            ) : historyData.length === 0 ? (
              <div style={{ textAlign:'center', padding:40, color:'var(--tz-textTertiary)', fontSize:12 }}>No history found for this truck yet.</div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr>
                      {['Date','Reference #','Type','Description','Done By','Total Cost','Source'].map(h => (
                        <th key={h} style={S.th as any}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map((row: any) => (
                      <tr key={`${row.source}-${row.id}`} style={{ cursor:'pointer' }}
                        onClick={() => {
                          if (row.source === 'inhouse') window.location.href = getWorkorderRoute(row.id, undefined, 'fleet')
                          else window.location.href = `/maintenance/repairs/${row.id}`
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--tz-bgHover)')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}
                      >
                        <td style={{ ...S.td, color:'var(--tz-textSecondary)', whiteSpace:'nowrap' }}>
                          {row.date ? new Date(row.date).toLocaleDateString() : '—'}
                        </td>
                        <td style={{ ...S.td, fontFamily:'monospace', fontSize:10, color: 'var(--tz-accentLight)' }}>
                          {row.reference_number || '—'}
                        </td>
                        <td style={{ ...S.td, fontSize:10, color:'var(--tz-textSecondary)' }}>
                          {row.source === 'inhouse' ? 'Service Order' : 'Road Repair'}
                        </td>
                        <td style={{ ...S.td, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {row.description || '—'}
                        </td>
                        <td style={{ ...S.td, color:'var(--tz-text)' }}>
                          {row.assigned_to || '—'}
                        </td>
                        <td style={{ ...S.td, fontFamily:'monospace', textAlign:'right' }}>
                          {['owner','gm','it_person','accountant','office_admin','floor_manager','shop_manager','parts_manager'].includes(userRole)
                            ? (row.total_cost != null ? `$${Number(row.total_cost).toLocaleString(undefined, { minimumFractionDigits: 0 })}` : '—')
                            : '***'}
                        </td>
                        <td style={S.td}>
                          <span style={{
                            display:'inline-block', padding:'2px 8px', borderRadius:100,
                            fontSize:9, fontWeight:700, letterSpacing:'.04em',
                            background: row.source === 'inhouse' ? 'rgba(29,111,232,.15)' : 'rgba(212,136,42,.15)',
                            color: row.source === 'inhouse' ? 'var(--tz-accentLight)' : '#D4882A',
                          }}>
                            {row.source === 'inhouse' ? 'In-House' : 'Outside'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {historyTotal > 50 && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, padding:'16px 0' }}>
              <button disabled={historyPage <= 1} onClick={() => setHistoryPage(p => p - 1)}
                style={{ ...S.btn, background: historyPage <= 1 ? 'var(--tz-surfaceMuted)' : 'var(--tz-border)', color: historyPage <= 1 ? 'var(--tz-textTertiary)' : 'var(--tz-text)', cursor: historyPage <= 1 ? 'default' : 'pointer' }}>Previous</button>
              <span style={{ fontSize:12, fontWeight:600, color:'var(--tz-textSecondary)' }}>Page {historyPage} of {historyTotalPages}</span>
              <button disabled={historyPage >= historyTotalPages} onClick={() => setHistoryPage(p => p + 1)}
                style={{ ...S.btn, background: historyPage >= historyTotalPages ? 'var(--tz-surfaceMuted)' : 'var(--tz-border)', color: historyPage >= historyTotalPages ? 'var(--tz-textTertiary)' : 'var(--tz-text)', cursor: historyPage >= historyTotalPages ? 'default' : 'pointer' }}>Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
