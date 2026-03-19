'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

export default function ReportsPage() {
  const supabase = createClient()
  const [overview,  setOverview]  = useState<any>(null)
  const [byDay,     setByDay]    = useState<any[]>([])
  const [byTech,    setByTech]   = useState<any[]>([])
  const [topParts,  setTopParts] = useState<any[]>([])
  const [loading,   setLoading]  = useState(true)
  const [range,     setRange]    = useState('30')
  const [shopId,    setShopId]   = useState<string|null>(null)

  useEffect(() => {
    async function init() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { window.location.href = '/login'; return }
      setShopId(profile.shop_id)
    }
    init()
  }, [])

  useEffect(() => {
    if (!shopId) return
    async function load() {
      setLoading(true)
      const from = new Date(Date.now() - parseInt(range) * 86400000).toISOString().split('T')[0]
      const to   = new Date().toISOString().split('T')[0]

      const [ov, rev, tech, parts] = await Promise.all([
        fetch(`/api/reports?type=overview&from=${from}&to=${to}&shop_id=${shopId}`).then(r => r.json()),
        fetch(`/api/reports?type=revenue_by_day&from=${from}&to=${to}&shop_id=${shopId}`).then(r => r.json()),
        fetch(`/api/reports?type=labor_by_tech&from=${from}&to=${to}&shop_id=${shopId}`).then(r => r.json()),
        fetch(`/api/reports?type=parts_profitability&from=${from}&to=${to}&shop_id=${shopId}`).then(r => r.json()),
      ])
      setOverview(ov); setByDay(rev || []); setByTech(tech || []); setTopParts(parts || [])
      setLoading(false)
    }
    load()
  }, [range, shopId])

  const fmt = (n: number) => '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits:0, maximumFractionDigits:0 })

  const S: Record<string, React.CSSProperties> = {
    page:  { background:'#08080C', minHeight:'100vh', color:'#EDEDF0', fontFamily:"'Instrument Sans',sans-serif", padding:24 },
    title: { fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:'#EDEDF0', marginBottom:4 },
    card:  { background:'#1A1A24', border:'1px solid rgba(255,255,255,.055)', borderRadius:12, padding:16, marginBottom:12 },
    th:    { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:'#9D9DA1', textTransform:'uppercase', letterSpacing:'.1em', padding:'7px 10px', textAlign:'left', background:'#08080C' },
    td:    { padding:'9px 10px', borderBottom:'1px solid rgba(255,255,255,.025)', fontSize:12 },
    lbl:   { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, letterSpacing:'.1em', textTransform:'uppercase', color:'#9D9DA1', marginBottom:6 },
    val:   { fontFamily:"'Bebas Neue',sans-serif", fontSize:28, lineHeight:1 },
    chip:  { padding:'5px 12px', borderRadius:100, fontSize:10, fontWeight:600, cursor:'pointer', border:'1px solid rgba(255,255,255,.08)', background:'#1A1A24', color:'#9D9DA1', fontFamily:'inherit', minHeight:30 },
    on:    { background:'rgba(0,224,176,.1)', color:'#00E0B0', border:'1px solid rgba(0,224,176,.3)' },
  }

  // Simple bar chart for revenue by day
  const maxRev = Math.max(...byDay.map(d => d.revenue), 1)

  return (
    <div style={S.page}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={S.title}>Reports</div>
          <div style={{ fontSize:12, color:'#9D9DA1' }}>Revenue, labor, and parts analytics</div>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {[['7','7 days'],['30','30 days'],['90','90 days']].map(([v,l]) => (
            <button key={v} onClick={() => setRange(v)} style={{ ...S.chip, ...(range===v?S.on:{}) }}>{l}</button>
          ))}
          <button style={{ padding:'7px 14px', background:'#1A1A24', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, color:'#9D9DA1', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>Export CSV</button>
        </div>
      </div>

      {loading ? <div style={{ textAlign:'center', padding:60, color:'#9D9DA1' }}>Loading...</div> : (
        <>
          {/* Overview stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10, marginBottom:20 }}>
            {[
              { label:'Revenue',          val: fmt(overview?.revenue),          color:'#EDEDF0' },
              { label:'Outstanding',      val: fmt(overview?.outstanding),       color: overview?.outstanding>0?'#FFB84D':'#00E0B0' },
              { label:'Jobs Completed',   val: overview?.so_completed || 0,      color:'#00E0B0' },
              { label:'Avg Cycle Time',   val: `${overview?.avg_cycle_hours}h`,  color:'#00E0B0' },
              { label:'Inventory Value',  val: fmt(overview?.inventory_value),   color:'#00E0B0' },
              { label:'Total Jobs',       val: overview?.so_count || 0,          color:'#EDEDF0' },
            ].map(s => (
              <div key={s.label} style={{ background:'#1A1A24', border:'1px solid rgba(255,255,255,.055)', borderRadius:10, padding:'12px 14px' }}>
                <div style={S.lbl}>{s.label}</div>
                <div style={{ ...S.val, color:s.color, fontSize: typeof s.val === 'string' && s.val.length > 6 ? 20 : 28 }}>{s.val}</div>
              </div>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
            {/* Revenue by day bar chart */}
            <div style={S.card}>
              <div style={{ fontSize:12, fontWeight:700, color:'#EDEDF0', marginBottom:14 }}>Revenue by Day</div>
              {byDay.length === 0 ? <div style={{ textAlign:'center', padding:20, color:'#9D9DA1' }}>No data</div>
              : (
                <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:100 }}>
                  {byDay.slice(-14).map((d, i) => (
                    <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, position:'relative' }}>
                      <div title={`$${d.revenue.toFixed(0)}`} style={{ width:'100%', background:'linear-gradient(0deg,#00E0B0,#00E0B0)', borderRadius:'3px 3px 0 0', height:`${Math.max(4, (d.revenue / maxRev) * 90)}px`, transition:'height .2s' }}/>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Labor by tech */}
            <div style={S.card}>
              <div style={{ fontSize:12, fontWeight:700, color:'#EDEDF0', marginBottom:12 }}>Labor Revenue by Technician</div>
              {byTech.length === 0 ? <div style={{ textAlign:'center', padding:20, color:'#9D9DA1' }}>No data</div>
              : byTech.slice(0,6).map((t, i) => {
                const maxT = byTech[0]?.revenue || 1
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                    <div style={{ width:90, fontSize:11, color:'#EDEDF0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flexShrink:0 }}>{t.name?.split(' ')[0] || 'Unknown'}</div>
                    <div style={{ flex:1, height:6, background:'#1A1A24', borderRadius:100, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${(t.revenue/maxT*100).toFixed(0)}%`, background:'linear-gradient(90deg,#00E0B0,#00E0B0)', borderRadius:100 }}/>
                    </div>
                    <div style={{ fontFamily:'monospace', fontSize:10, color:'#00E0B0', width:60, textAlign:'right', flexShrink:0 }}>{fmt(t.revenue)}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Top parts */}
          <div style={S.card}>
            <div style={{ fontSize:12, fontWeight:700, color:'#EDEDF0', marginBottom:12 }}>Top Parts by Revenue</div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:400 }}>
                <thead><tr>{['Part','Revenue','Qty Used'].map(h=><th key={h} style={S.th as any}>{h}</th>)}</tr></thead>
                <tbody>
                  {topParts.length === 0 ? <tr><td colSpan={3} style={{ ...S.td, textAlign:'center', color:'#9D9DA1', padding:20 }}>No data</td></tr>
                  : topParts.slice(0,10).map((p, i) => (
                    <tr key={i}>
                      <td style={{ ...S.td, color:'#EDEDF0', maxWidth:300, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.description}</td>
                      <td style={{ ...S.td, fontFamily:'monospace', fontWeight:700, color:'#00E0B0' }}>{fmt(p.revenue)}</td>
                      <td style={{ ...S.td, fontFamily:'monospace', color:'#9D9DA1' }}>{p.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
