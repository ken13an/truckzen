'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

export default function FleetPage() {
  const supabase = createClient()
  const [assets,  setAssets]  = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { window.location.href = '/login'; return }
      const res = await fetch(`/api/assets?shop_id=${profile.shop_id}`)
      if (res.ok) {
        const data = await res.json()
        setAssets(Array.isArray(data) ? data : [])
      }
      setLoading(false)
    }
    load()
  }, [])

  const filtered = assets.filter(a => {
    if (!search) return true
    const q = search.toLowerCase()
    return a.unit_number?.toLowerCase().includes(q) || a.make?.toLowerCase().includes(q) || (a.customers as any)?.company_name?.toLowerCase().includes(q)
  })

  const S: Record<string, React.CSSProperties> = {
    page:  { background:'#060708', minHeight:'100vh', color:'#DDE3EE', fontFamily:"'Instrument Sans',sans-serif", padding:24 },
    title: { fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:'#F0F4FF', marginBottom:4 },
    th:    { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:'#48536A', textTransform:'uppercase', letterSpacing:'.1em', padding:'7px 10px', textAlign:'left', background:'#0B0D11', whiteSpace:'nowrap' },
    td:    { padding:'9px 10px', borderBottom:'1px solid rgba(255,255,255,.025)', fontSize:11 },
  }

  const statusColor: Record<string, string> = { active:'#1DB870', inactive:'#7C8BA0', in_shop:'#4D9EFF', decommissioned:'#D94F4F' }

  return (
    <div style={S.page}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={S.title}>Fleet</div>
          <div style={{ fontSize:12, color:'#7C8BA0' }}>{filtered.length} vehicles</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search unit, make, customer..." style={{ padding:'7px 12px', background:'#1C2130', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, color:'#DDE3EE', fontSize:11, fontFamily:'inherit', outline:'none', width:220 }}/>
          <button onClick={() => window.location.href='/fleet/new'} style={{ padding:'7px 14px', background:'linear-gradient(135deg,#1D6FE8,#1248B0)', border:'none', borderRadius:8, color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ Add Vehicle</button>
        </div>
      </div>
      <div style={{ background:'#161B24', border:'1px solid rgba(255,255,255,.055)', borderRadius:12, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:560 }}>
            <thead><tr>{['Unit #','Year','Make / Model','VIN','Odometer','Owner','Status'].map(h =>
              <th key={h} style={S.th as any}>{h}</th>)}</tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} style={{ ...S.td, textAlign:'center', color:'#7C8BA0' }}>Loading...</td></tr>
              : filtered.map(a => (
                <tr key={a.id} style={{ cursor:'pointer' }} onClick={() => window.location.href = '/fleet/' + a.id}>
                  <td style={{ ...S.td, fontFamily:"'IBM Plex Mono',monospace", color:'#4D9EFF', fontWeight:700 }}>{a.unit_number}</td>
                  <td style={{ ...S.td, color:'#7C8BA0' }}>{a.year}</td>
                  <td style={{ ...S.td, color:'#F0F4FF', fontWeight:600 }}>{a.make} {a.model}</td>
                  <td style={{ ...S.td, fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:'#48536A' }}>{a.vin || '—'}</td>
                  <td style={{ ...S.td, fontFamily:"'IBM Plex Mono',monospace", color:'#DDE3EE' }}>{a.odometer?.toLocaleString() || '—'}</td>
                  <td style={{ ...S.td, color:'#DDE3EE' }}>{(a.customers as any)?.company_name || '—'}</td>
                  <td style={S.td as any}>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 8px', borderRadius:100, fontFamily:"'IBM Plex Mono',monospace", fontSize:8, background:(statusColor[a.status]||'#7C8BA0')+'18', color:statusColor[a.status]||'#7C8BA0', border:'1px solid '+(statusColor[a.status]||'#7C8BA0')+'33' }}>
                      <span style={{ width:4, height:4, borderRadius:'50%', background:'currentColor' }}/>{(a.status||'active').replace(/_/g,' ').toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
