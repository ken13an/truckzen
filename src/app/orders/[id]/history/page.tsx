'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

export default function SOHistoryPage() {
  const params = useParams()
  const supabase = createClient()
  const [timeline, setTimeline] = useState<any[]>([])
  const [soNumber, setSoNumber] = useState('')
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { window.location.href = '/login'; return }
      const res  = await fetch(`/api/service-orders/${params.id}/history`)
      const data = await res.json()
      setTimeline(data.timeline || [])
      setSoNumber(data.so_number || '')
      setLoading(false)
    }
    load()
  }, [params.id])

  const S: Record<string, React.CSSProperties> = {
    page:  { background:'#08080C', minHeight:'100vh', color:'#EDEDF0', fontFamily:"'Instrument Sans',sans-serif", padding:24, maxWidth:640, margin:'0 auto' },
    title: { fontFamily:"'Bebas Neue',sans-serif", fontSize:26, color:'#EDEDF0', marginBottom:20 },
  }

  return (
    <div style={S.page}>
      <a href={`/orders/${params.id}`} style={{ fontSize:12, color:'#9D9DA1', textDecoration:'none', display:'block', marginBottom:20 }}>← {soNumber}</a>
      <div style={S.title}>Audit History</div>

      {loading ? <div style={{ color:'#9D9DA1', textAlign:'center', padding:40 }}>Loading...</div>
      : timeline.length === 0 ? <div style={{ color:'#9D9DA1', textAlign:'center', padding:40 }}>No history yet</div>
      : (
        <div style={{ position:'relative' }}>
          <div style={{ position:'absolute', left:20, top:0, bottom:0, width:1, background:'rgba(255,255,255,.06)' }}/>
          {timeline.map((event, i) => (
            <div key={i} style={{ display:'flex', gap:16, marginBottom:16, paddingLeft:0 }}>
              <div style={{ width:40, height:40, borderRadius:'50%', background:'#1A1A24', border:'1px solid rgba(255,255,255,.08)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0, zIndex:1 }}>
                {event.icon}
              </div>
              <div style={{ background:'#1A1A24', border:'1px solid rgba(255,255,255,.055)', borderRadius:10, padding:'10px 14px', flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'#EDEDF0', textTransform:'capitalize' }}>{event.action}</div>
                  <div style={{ fontFamily:'monospace', fontSize:10, color:'#9D9DA1' }}>
                    {new Date(event.timestamp).toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
                  </div>
                </div>
                {event.detail && <div style={{ fontSize:11, color:'#9D9DA1', marginBottom:4 }}>{event.detail}</div>}
                {event.user_name && <div style={{ fontSize:10, color:'#9D9DA1' }}>{event.user_name}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
