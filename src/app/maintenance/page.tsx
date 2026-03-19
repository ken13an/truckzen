'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

export default function MaintenancePage() {
  const supabase = createClient()
  const [pms, setPMs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { window.location.href = '/login'; return }
      const { data } = await supabase
        .from('pm_schedules')
        .select('id, service_name, interval_miles, interval_days, next_due_date, next_due_reading, active, assets(unit_number, make, model, odometer)')
        .eq('shop_id', profile.shop_id)
        .eq('active', true)
        .order('next_due_date')
      setPMs(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const today = new Date().toISOString().split('T')[0]

  const S: Record<string, React.CSSProperties> = {
    page:  { background:'#060708', minHeight:'100vh', color:'#DDE3EE', fontFamily:"'Instrument Sans',sans-serif", padding:24 },
    title: { fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:'#F0F4FF', marginBottom:4 },
    th:    { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:'#48536A', textTransform:'uppercase', letterSpacing:'.1em', padding:'7px 10px', textAlign:'left', background:'#0B0D11', whiteSpace:'nowrap' },
    td:    { padding:'9px 10px', borderBottom:'1px solid rgba(255,255,255,.025)', fontSize:11 },
  }

  return (
    <div style={S.page}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={S.title}>Maintenance & PM</div>
          <div style={{ fontSize:12, color:'#7C8BA0' }}>{pms.filter(p => p.next_due_date < today).length} overdue · {pms.length} total schedules</div>
        </div>
        <button onClick={() => window.location.href='/maintenance/new'} style={{ padding:'7px 14px', background:'linear-gradient(135deg,#00E0B0,#00805F)', border:'none', borderRadius:8, color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ Add PM Schedule</button>
      </div>
      <div style={{ background:'#161B24', border:'1px solid rgba(255,255,255,.055)', borderRadius:12, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:520 }}>
            <thead><tr>{['Truck','Service','Interval','Next Due Date','Next Due Miles','Status'].map(h =>
              <th key={h} style={S.th as any}>{h}</th>)}</tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} style={{ ...S.td, textAlign:'center', color:'#7C8BA0' }}>Loading...</td></tr>
              : pms.map(pm => {
                const asset   = pm.assets as any
                const isOver  = pm.next_due_date && pm.next_due_date < today
                const isSoon  = pm.next_due_date && pm.next_due_date <= new Date(Date.now() + 7*86400000).toISOString().split('T')[0]
                const color   = isOver ? '#D94F4F' : isSoon ? '#D4882A' : '#1DB870'
                return (
                  <tr key={pm.id} style={{ cursor:'pointer' }} onClick={() => window.location.href = '/maintenance/' + pm.id}>
                    <td style={{ ...S.td, fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'#00E0B0', fontWeight:700 }}>#{asset?.unit_number}</td>
                    <td style={{ ...S.td, color:'#F0F4FF', fontWeight:600 }}>{pm.service_name}</td>
                    <td style={{ ...S.td, color:'#7C8BA0' }}>{pm.interval_miles ? `${pm.interval_miles.toLocaleString()} mi` : `${pm.interval_days}d`}</td>
                    <td style={{ ...S.td, fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color }}>{pm.next_due_date || '—'}</td>
                    <td style={{ ...S.td, fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'#7C8BA0' }}>{pm.next_due_reading ? pm.next_due_reading.toLocaleString() : '—'}</td>
                    <td style={S.td as any}>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 8px', borderRadius:100, fontFamily:"'IBM Plex Mono',monospace", fontSize:8, background:color+'18', color, border:'1px solid '+color+'33' }}>
                        <span style={{ width:4, height:4, borderRadius:'50%', background:'currentColor' }}/>{isOver?'OVERDUE':isSoon?'DUE SOON':'OK'}
                      </span>
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
