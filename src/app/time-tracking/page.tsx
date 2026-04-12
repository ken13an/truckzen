'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { useTheme } from '@/hooks/useTheme'

export default function TimeTrackingPage() {
  const { tokens: t } = useTheme()
  const supabase = createClient()
  const [data,    setData]    = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [range,   setRange]   = useState('7')
  const [user,    setUser]    = useState<any>(null)

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { window.location.href = '/login'; return }
      setUser(profile)
      const from = new Date(Date.now() - parseInt(range)*86400000).toISOString().split('T')[0]
      const to   = new Date().toISOString().split('T')[0]
      const res  = await fetch(`/api/time-tracking?from=${from}&to=${to}`)
      setData(await res.json())
      setLoading(false)
    }
    load()
  }, [range])

  function fmtMin(m: number) {
    return `${Math.floor(m/60)}h ${String(m%60).padStart(2,'0')}m`
  }

  const S: Record<string, React.CSSProperties> = {
    page:  { background:t.bg, minHeight:'100vh', color:t.text, fontFamily:"'Instrument Sans',sans-serif", padding:24 },
    title: { fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:t.text, marginBottom:4 },
    card:  { background:t.bgCard, border:'1px solid rgba(255,255,255,.055)', borderRadius:12, padding:16, marginBottom:12 },
    th:    { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:t.textTertiary, textTransform:'uppercase', letterSpacing:'.1em', padding:'6px 10px', textAlign:'left', background:'#0B0D11', whiteSpace:'nowrap' },
    td:    { padding:'8px 10px', borderBottom:'1px solid rgba(255,255,255,.025)', fontSize:11 },
    chip:  { padding:'5px 12px', borderRadius:100, fontSize:10, fontWeight:600, cursor:'pointer', border:'1px solid rgba(255,255,255,.08)', background:'#1C2130', color:t.textSecondary, fontFamily:'inherit' },
    on:    { background:'rgba(29,111,232,.1)', color:'#4D9EFF', border:'1px solid rgba(29,111,232,.3)' },
  }

  return (
    <div style={S.page}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={S.title}>Time Tracking</div>
          <div style={{ fontSize:12, color:t.textSecondary }}>
            {data ? `${data.total_hours}h total · ${data.by_tech?.length || 0} technicians` : 'Loading...'}
          </div>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {[['7','7 days'],['14','14 days'],['30','30 days']].map(([v,l]) => (
            <button key={v} onClick={() => setRange(v)} style={{ ...S.chip, ...(range===v?S.on:{}) }}>{l}</button>
          ))}
        </div>
      </div>

      {loading ? <div style={{ color:t.textSecondary, textAlign:'center', padding:40 }}>Loading...</div>
      : !data?.by_tech?.length ? <div style={{ ...S.card, textAlign:'center', padding:40, color:t.textSecondary }}>No time entries in this period</div>
      : data.by_tech.map((tech: any) => (
        <div key={tech.id} style={S.card}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:t.text }}>{tech.name}</div>
              {tech.team && <div style={{ fontSize:10, color:t.textSecondary }}>Team {tech.team}</div>}
            </div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:24, color:'#4D9EFF' }}>{fmtMin(tech.total_minutes)}</div>
          </div>

          {/* Bar showing proportion */}
          <div style={{ height:4, background:'#1C2130', borderRadius:100, marginBottom:10, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${Math.min(100, tech.total_minutes / (data.total_minutes / data.by_tech.length) * 50)}%`, background:'linear-gradient(90deg,#1D6FE8,#4D9EFF)', borderRadius:100, transition:'width .3s' }}/>
          </div>

          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:400 }}>
              <thead><tr>{['Date','SO #','Truck','Customer','Time'].map(h=><th key={h} style={S.th as any}>{h}</th>)}</tr></thead>
              <tbody>
                {tech.entries.map((e: any, i: number) => (
                  <tr key={i}>
                    <td style={{ ...S.td, fontFamily:'monospace', fontSize:10, color:t.textTertiary }}>{e.date}</td>
                    <td style={{ ...S.td, fontFamily:'monospace', fontSize:10, color:'#4D9EFF' }}>{e.so_number || '—'}</td>
                    <td style={{ ...S.td, color:t.text }}>{e.truck || '—'}</td>
                    <td style={{ ...S.td, color:t.textSecondary }}>{e.customer || '—'}</td>
                    <td style={{ ...S.td, fontFamily:'monospace', fontWeight:700, color:'#1DB870' }}>{fmtMin(e.minutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
