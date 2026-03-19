'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

export default function DriversPage() {
  const supabase = createClient()
  const [drivers, setDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { window.location.href = '/login'; return }
      const res  = await fetch(`/api/drivers?shop_id=${profile.shop_id}`)
      setDrivers(await res.json() || [])
      setLoading(false)
    }
    load()
  }, [])

  const today    = new Date().toISOString().split('T')[0]
  const in30days = new Date(Date.now() + 30*86400000).toISOString().split('T')[0]

  const expiryStatus = (date?: string) => {
    if (!date) return { color:'#48536A', label:'No Date' }
    if (date < today)     return { color:'#D94F4F', label:'EXPIRED' }
    if (date <= in30days) return { color:'#D4882A', label:'Expiring Soon' }
    return { color:'#1DB870', label:'OK' }
  }

  const filtered = drivers.filter(d =>
    !search || d.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    d.cdl_number?.toLowerCase().includes(search.toLowerCase())
  )

  const S: Record<string, React.CSSProperties> = {
    page:  { background:'#060708', minHeight:'100vh', color:'#DDE3EE', fontFamily:"'Instrument Sans',sans-serif", padding:24 },
    title: { fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:'#F0F4FF', marginBottom:4 },
    th:    { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:'#48536A', textTransform:'uppercase', letterSpacing:'.1em', padding:'7px 12px', textAlign:'left', background:'#0B0D11', whiteSpace:'nowrap' },
    td:    { padding:'10px 12px', borderBottom:'1px solid rgba(255,255,255,.025)', fontSize:12 },
  }

  return (
    <div style={S.page}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={S.title}>Drivers</div>
          <div style={{ fontSize:12, color:'#7C8BA0' }}>{filtered.length} drivers</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, CDL..."
            style={{ padding:'7px 12px', background:'#1C2130', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, color:'#DDE3EE', fontSize:11, fontFamily:'inherit', outline:'none', width:200 }}/>
          <button onClick={() => window.location.href='/drivers/new'}
            style={{ padding:'7px 14px', background:'linear-gradient(135deg,#1D6FE8,#1248B0)', border:'none', borderRadius:8, color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            + Add Driver
          </button>
        </div>
      </div>

      <div style={{ background:'#161B24', border:'1px solid rgba(255,255,255,.055)', borderRadius:12, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:640 }}>
            <thead><tr>{['Name','Phone','CDL #','CDL Class','CDL Expiry','Medical Expiry','Status'].map(h =>
              <th key={h} style={S.th as any}>{h}</th>)}</tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} style={{ ...S.td, textAlign:'center', color:'#7C8BA0', padding:40 }}>Loading...</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={7} style={{ ...S.td, textAlign:'center', color:'#7C8BA0', padding:40 }}>No drivers yet</td></tr>
              : filtered.map(d => {
                const cdlSt = expiryStatus(d.cdl_expiry)
                const medSt = expiryStatus(d.medical_expiry)
                return (
                  <tr key={d.id} style={{ cursor:'pointer', opacity: d.active===false?0.5:1 }}
                    onClick={() => window.location.href = `/drivers/${d.id}`}>
                    <td style={{ ...S.td, fontWeight:700, color:'#F0F4FF' }}>{d.full_name}</td>
                    <td style={{ ...S.td, fontFamily:'monospace', fontSize:11, color:'#7C8BA0' }}>{d.phone || '—'}</td>
                    <td style={{ ...S.td, fontFamily:'monospace', fontSize:11, color:'#4D9EFF' }}>{d.cdl_number || '—'}</td>
                    <td style={{ ...S.td, fontFamily:'monospace', fontSize:11, color:'#7C8BA0' }}>{d.cdl_class || '—'}</td>
                    <td style={{ ...S.td }}>
                      <span style={{ fontFamily:'monospace', fontSize:10, fontWeight:700, color:cdlSt.color }}>{d.cdl_expiry || '—'}</span>
                      {d.cdl_expiry && <div style={{ fontSize:8, color:cdlSt.color, fontFamily:'monospace' }}>{cdlSt.label}</div>}
                    </td>
                    <td style={{ ...S.td }}>
                      <span style={{ fontFamily:'monospace', fontSize:10, fontWeight:700, color:medSt.color }}>{d.medical_expiry || '—'}</span>
                      {d.medical_expiry && <div style={{ fontSize:8, color:medSt.color, fontFamily:'monospace' }}>{medSt.label}</div>}
                    </td>
                    <td style={{ ...S.td }}>
                      <span style={{ fontSize:10, fontWeight:600, color: d.active!==false?'#1DB870':'#48536A' }}>{d.active!==false?'ACTIVE':'INACTIVE'}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
