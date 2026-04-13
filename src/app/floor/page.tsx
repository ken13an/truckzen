'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { useTheme } from '@/hooks/useTheme'

const STATUS_ORDER = [
  'not_started','not_approved','waiting_approval','in_progress',
  'waiting_parts','done','ready_final_inspection','good_to_go','failed_inspection',
]
const STATUS_CFG: Record<string, { label: string; color: string; dot: string }> = {
  not_started:           { label:'Not Started',          color:'rgba(72,83,106,.12)',    dot:'#7C8BA0' },
  not_approved:          { label:'Not Approved',          color:'rgba(212,136,42,.10)',   dot:'#D4882A' },
  waiting_approval:      { label:'Waiting Approval',      color:'rgba(212,136,42,.10)',   dot:'#D4882A' },
  in_progress:           { label:'In Progress',           color:'rgba(29,111,232,.10)',   dot:'#4D9EFF' },
  waiting_parts:         { label:'Waiting Parts',         color:'rgba(232,105,42,.10)',   dot:'#E8692A' },
  done:                  { label:'Done',                  color:'rgba(29,184,112,.10)',   dot:'#1DB870' },
  ready_final_inspection:{ label:'Ready for Inspection',  color:'rgba(139,92,246,.10)',   dot:'#8B5CF6' },
  good_to_go:            { label:'Good to Go',            color:'rgba(29,184,112,.14)',   dot:'#1DB870' },
  failed_inspection:     { label:'Failed — Needs Work',   color:'rgba(217,79,79,.10)',    dot:'#D94F4F' },
}

export default function FloorPage() {
  const { tokens: t } = useTheme()
  const supabase = createClient()
  const [user,   setUser]   = useState<any>(null)
  const [jobs,   setJobs]   = useState<any[]>([])
  const [view,   setView]   = useState<'table' | 'kanban'>('table')
  const [loading,setLoading]= useState(true)

  const loadJobs = useCallback(async (shopId: string) => {
    const res = await fetch(`/api/service-orders?shop_id=${shopId}&limit=200`)
    const data: any[] = res.ok ? await res.json() : []
    const filtered = data.filter((j: any) => j.status !== 'good_to_go')
    setJobs(filtered)
    setLoading(false)
  }, [])

  useEffect(() => {
    let channel: any = null
    async function init() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { window.location.href = '/login'; return }
      setUser(profile)
      await loadJobs(profile.shop_id)

      // Realtime subscription — scoped to shop, cleaned up on unmount
      channel = supabase.channel(`floor-realtime:${profile.shop_id}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'service_orders',
          filter: `shop_id=eq.${profile.shop_id}`,
        }, () => loadJobs(profile.shop_id))
        .subscribe()
    }
    init()
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [loadJobs])

  async function updateStatus(soId: string, newStatus: string) {
    await supabase.from('service_orders').update({ status: newStatus }).eq('id', soId)
    setJobs(prev => prev.map(j => j.id === soId ? { ...j, status: newStatus } : j))
  }

  const S: Record<string, React.CSSProperties> = {
    page:    { background:t.bg, minHeight:'100vh', color:t.text, fontFamily:"'Instrument Sans',sans-serif", padding:24 },
    header:  { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 },
    title:   { fontFamily:"'Bebas Neue',sans-serif", fontSize:28, letterSpacing:'.02em', color:t.text },
    viewBtn: { padding:'6px 14px', borderRadius:7, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${t.border}`, background:t.inputBg, color:t.textSecondary, fontFamily:'inherit' },
    viewOn:  { background:'rgba(29,111,232,.1)', color:t.accentLight, border:'1px solid rgba(29,111,232,.3)' },
  }

  const pill = (status: string) => {
    const cfg = STATUS_CFG[status] || { label: status, color: 'rgba(72,83,106,.1)', dot: t.textSecondary }
    return (
      <span key={status} style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 8px', borderRadius:100, fontFamily:"'IBM Plex Mono',monospace", fontSize:8, background:cfg.color, color:cfg.dot, border:`1px solid ${cfg.dot}33` }}>
        <span style={{ width:4, height:4, borderRadius:'50%', background:'currentColor' }}/>
        {cfg.label}
      </span>
    )
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <div style={S.title}>Shop Floor</div>
          <div style={{ fontSize:12, color:t.textSecondary }}>{jobs.length} active jobs · Live</div>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {(['table','kanban'] as const).map(v => (
            <button key={v} style={{ ...S.viewBtn, ...(view===v ? S.viewOn : {}) }} onClick={() => setView(v)}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:t.textSecondary }}>Loading floor...</div>
      ) : view === 'table' ? (
        // TABLE VIEW
        <div style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:12, overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:600 }}>
              <thead>
                <tr>
                  {['Bay','Truck','Customer','Job','Tech','Status','Next Status'].map(h => (
                    <th key={h} style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:t.textTertiary, textTransform:'uppercase', letterSpacing:'.1em', padding:'7px 10px', textAlign:'left', background:t.bgInput, whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map(j => {
                  const asset = j.assets as any
                  const cust  = j.customers as any
                  const tech  = (j as any).users as any
                  const curIdx = STATUS_ORDER.indexOf(j.status)
                  const nextStatus = STATUS_ORDER[curIdx + 1]
                  const nextCfg   = nextStatus ? STATUS_CFG[nextStatus] : null
                  return (
                    <tr key={j.id} style={{ borderBottom:`1px solid ${t.border}` }}>
                      <td style={{ padding:'10px', fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:t.accentLight }}>
                        {j.team && `T${j.team}`} {j.bay || '—'}
                      </td>
                      <td style={{ padding:'10px' }}>
                        <div style={{ fontWeight:700, color:t.text }}>#{asset?.unit_number}</div>
                        <div style={{ fontSize:9, color:t.textSecondary }}>{asset?.year} {asset?.make}</div>
                      </td>
                      <td style={{ padding:'10px', color:t.text }}>{cust?.company_name}</td>
                      <td style={{ padding:'10px', color:t.textSecondary, fontSize:11, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{j.complaint}</td>
                      <td style={{ padding:'10px', color:t.text, fontSize:11 }}>{tech?.full_name || '—'}</td>
                      <td style={{ padding:'10px' }}>{pill(j.status)}</td>
                      <td style={{ padding:'10px' }}>
                        {nextCfg && nextStatus && (
                          <button onClick={() => updateStatus(j.id, nextStatus)}
                            style={{ padding:'4px 10px', borderRadius:6, border:`1px solid ${nextCfg.dot}33`, background:`${nextCfg.color}`, color:nextCfg.dot, fontSize:9, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                            → {nextCfg.label}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // KANBAN VIEW
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:10 }}>
          {STATUS_ORDER.filter(s => s !== 'void').map(status => {
            const cfg        = STATUS_CFG[status]
            const statusJobs = jobs.filter(j => j.status === status)
            return (
              <div key={status} style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:11, overflow:'hidden' }}>
                <div style={{ padding:'10px 12px', borderBottom:`1px solid ${t.border}`, display:'flex', alignItems:'center', gap:7 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:cfg.dot, flexShrink:0 }}/>
                  <span style={{ fontSize:11, fontWeight:700, color:t.text }}>{cfg.label}</span>
                  <span style={{ marginLeft:'auto', fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:t.textSecondary }}>{statusJobs.length}</span>
                </div>
                <div style={{ padding:8, display:'flex', flexDirection:'column', gap:6, minHeight:60 }}>
                  {statusJobs.length === 0 ? (
                    <div style={{ fontSize:10, color:t.textTertiary, textAlign:'center', padding:10 }}>Empty</div>
                  ) : statusJobs.map(j => {
                    const asset = j.assets as any
                    const cust  = j.customers as any
                    return (
                      <div key={j.id} style={{ background:t.inputBg, border:`1px solid ${t.border}`, borderRadius:8, padding:10, cursor:'pointer' }}
                        onClick={() => window.location.href = `/orders/${j.id}`}>
                        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:t.accentLight, marginBottom:3 }}>{j.so_number}</div>
                        <div style={{ fontSize:12, fontWeight:700, color:t.text }}>#{asset?.unit_number}</div>
                        <div style={{ fontSize:10, color:t.textSecondary, marginTop:2 }}>{cust?.company_name}</div>
                        <div style={{ fontSize:10, color:t.textTertiary, marginTop:4 }}>{j.bay || 'No bay'}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
