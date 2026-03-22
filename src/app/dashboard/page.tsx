'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser, type UserProfile } from '@/lib/auth'

interface DashStats {
  open_jobs: number
  in_progress: number
  waiting_parts: number
  good_to_go: number
  low_stock_parts: number
  overdue_invoices: number
  overdue_pm: number
  idle_techs: number
}

export default function DashboardPage() {
  const supabase = createClient()
  const [user,  setUser]  = useState<UserProfile | null>(null)
  const [stats, setStats] = useState<DashStats | null>(null)
  const [recentSOs, setRecentSOs] = useState<any[]>([])
  const [checkins, setCheckins] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [kioskCode, setKioskCode] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { window.location.href = '/login'; return }
      setUser(profile)

      const shopId = profile.shop_id

      // Fetch kiosk code
      supabase.from('shops').select('kiosk_code').eq('id', shopId).single()
        .then(({ data }: { data: { kiosk_code: string | null } | null }) => { if (data?.kiosk_code) setKioskCode(data.kiosk_code) })

      // Fetch all stats in parallel
      const [
        { data: soData },
        { data: partsData },
        { data: invoiceData },
        { data: pmData },
      ] = await Promise.all([
        supabase.from('service_orders').select('status').eq('shop_id', shopId).not('status', 'in', '("void")').or('is_historical.is.null,is_historical.eq.false'),
        supabase.from('parts').select('on_hand, reorder_point').eq('shop_id', shopId),
        supabase.from('invoices').select('status, due_date').eq('shop_id', shopId).eq('status', 'sent'),
        supabase.from('pm_schedules').select('next_due_date').eq('shop_id', shopId).eq('active', true),
      ])

      const today = new Date().toISOString().split('T')[0]

      setStats({
        open_jobs:       soData?.filter((s: any) => !['good_to_go','void'].includes(s.status)).length ?? 0,
        in_progress:     soData?.filter((s: any) => s.status === 'in_progress').length ?? 0,
        waiting_parts:   soData?.filter((s: any) => s.status === 'waiting_parts').length ?? 0,
        good_to_go:      soData?.filter((s: any) => s.status === 'good_to_go').length ?? 0,
        low_stock_parts: partsData?.filter((p: any) => p.on_hand <= p.reorder_point).length ?? 0,
        overdue_invoices:invoiceData?.filter((i: any) => i.due_date && i.due_date < today).length ?? 0,
        overdue_pm:      pmData?.filter((p: any) => p.next_due_date && p.next_due_date < today).length ?? 0,
        idle_techs:      0, // computed separately
      })

      // Recent SOs
      const { data: sos } = await supabase
        .from('service_orders')
        .select(`so_number, status, priority, created_at,
          assets(unit_number, make, model),
          customers(company_name),
          users!assigned_tech(full_name)`)
        .eq('shop_id', shopId)
        .not('status', 'in', '("void")')
        .order('created_at', { ascending: false })
        .limit(8)

      setRecentSOs(sos || [])

      // Recent kiosk check-ins
      const ciRes = await fetch(`/api/kiosk?shop_id=${shopId}&limit=5`)
      if (ciRes.ok) { const ciData = await ciRes.json(); setCheckins(Array.isArray(ciData) ? ciData : []) }

      setLoading(false)
    }
    load()
  }, [])

  // Realtime — live SO updates
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('dashboard-sos')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'service_orders',
        filter: `shop_id=eq.${user.shop_id}`,
      }, () => { /* re-fetch on change */ })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  const STATUS_COLOR: Record<string, string> = {
    in_progress:        '#4D9EFF',
    waiting_parts:      '#E8692A',
    waiting_approval:   '#D4882A',
    not_approved:       '#D4882A',
    done:               '#1DB870',
    good_to_go:         '#1DB870',
    ready_final_inspection: '#8B5CF6',
    failed_inspection:  '#D94F4F',
    draft:              '#7C8BA0',
    not_started:        '#7C8BA0',
  }

  const STATUS_LABEL: Record<string, string> = {
    in_progress: 'In Progress', waiting_parts: 'Waiting Parts',
    waiting_approval: 'Waiting Approval', not_approved: 'Not Approved',
    done: 'Done', good_to_go: 'Good to Go',
    ready_final_inspection: 'Ready for Inspection',
    failed_inspection: 'Failed Inspection',
    draft: 'Draft', not_started: 'Not Started',
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#060708', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:28, height:28, border:'2px solid rgba(29,111,232,.2)', borderTopColor:'#1D6FE8', borderRadius:'50%', animation:'spin .7s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div style={{ background:'#060708', minHeight:'100vh', color:'#DDE3EE', fontFamily:"'Instrument Sans',sans-serif", padding:'24px' }}>

      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:28, letterSpacing:'.02em', color:'#F0F4FF' }}>
          {greeting()}, {user?.full_name.split(' ')[0]}
        </div>
        <div style={{ fontSize:12, color:'#7C8BA0', marginTop:4 }}>
          {new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })} · UGL Shop Main
        </div>
      </div>

      {/* Stat cards */}
      {stats && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10, marginBottom:24 }}>
          {[
            { label:'Open Jobs',      val: stats.open_jobs,       color:'#F0F4FF', href:'/orders' },
            { label:'In Progress',    val: stats.in_progress,     color:'#4D9EFF', href:'/floor' },
            { label:'Waiting Parts',  val: stats.waiting_parts,   color:'#E8692A', href:'/orders?status=waiting_parts' },
            { label:'Good to Go',     val: stats.good_to_go,      color:'#1DB870', href:'/orders?status=good_to_go' },
            { label:'Low Stock Parts',val: stats.low_stock_parts, color: stats.low_stock_parts>0?'#D94F4F':'#1DB870', href:'/parts' },
            { label:'Overdue Invoices',val:stats.overdue_invoices,color: stats.overdue_invoices>0?'#D4882A':'#1DB870', href:'/invoices' },
            { label:'PM Overdue',     val: stats.overdue_pm,      color: stats.overdue_pm>0?'#D94F4F':'#1DB870', href:'/maintenance' },
          ].map(s => (
            <a key={s.label} href={s.href} style={{ textDecoration:'none' }}>
              <div style={{ background:'#161B24', border:'1px solid rgba(255,255,255,.055)', borderRadius:10, padding:'12px 14px', cursor:'pointer', transition:'all .14s' }}>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, letterSpacing:'.1em', textTransform:'uppercase', color:'#48536A', marginBottom:6 }}>{s.label}</div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:28, letterSpacing:'.02em', color:s.color }}>{s.val}</div>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Recent service orders */}
      <div style={{ background:'#161B24', border:'1px solid rgba(255,255,255,.055)', borderRadius:12, overflow:'hidden' }}>
        <div style={{ padding:'11px 14px', borderBottom:'1px solid rgba(255,255,255,.055)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#F0F4FF' }}>Recent Service Orders</div>
          <a href="/orders" style={{ fontSize:11, color:'#4D9EFF', textDecoration:'none' }}>View all →</a>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:500 }}>
            <thead>
              <tr style={{ background:'#0B0D11' }}>
                {['SO #','Truck','Customer','Tech','Status','Priority'].map(h => (
                  <th key={h} style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:'#48536A', textTransform:'uppercase', letterSpacing:'.1em', padding:'7px 10px', textAlign:'left', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentSOs.map((so, i) => (
                <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,.025)', cursor:'pointer' }}
                  onClick={() => window.location.href = `/orders/${so.id}`}>
                  <td style={{ padding:'9px 10px', fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'#4D9EFF', fontWeight:700 }}>{so.so_number}</td>
                  <td style={{ padding:'9px 10px', color:'#F0F4FF', fontWeight:600 }}>
                    #{(so.assets as any)?.unit_number}
                    <div style={{ fontSize:9, color:'#7C8BA0', marginTop:1 }}>{(so.assets as any)?.make} {(so.assets as any)?.model}</div>
                  </td>
                  <td style={{ padding:'9px 10px', color:'#DDE3EE' }}>{(so.customers as any)?.company_name}</td>
                  <td style={{ padding:'9px 10px', color:'#7C8BA0', fontSize:11 }}>{(so.users as any)?.full_name || '—'}</td>
                  <td style={{ padding:'9px 10px' }}>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 8px', borderRadius:100, fontFamily:"'IBM Plex Mono',monospace", fontSize:8, background:`${STATUS_COLOR[so.status] || '#7C8BA0'}18`, color:STATUS_COLOR[so.status] || '#7C8BA0', border:`1px solid ${STATUS_COLOR[so.status] || '#7C8BA0'}33` }}>
                      <span style={{ width:4, height:4, borderRadius:'50%', background:'currentColor' }}/>
                      {STATUS_LABEL[so.status] || so.status}
                    </span>
                  </td>
                  <td style={{ padding:'9px 10px' }}>
                    <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, fontWeight:600, color: so.priority==='critical'?'#D94F4F':so.priority==='high'?'#D4882A':'#7C8BA0' }}>
                      {so.priority?.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Kiosk Check-ins */}
      {checkins.length > 0 && (
        <div style={{ background:'#161B24', border:'1px solid rgba(255,255,255,.055)', borderRadius:12, overflow:'hidden', marginTop:16 }}>
          <div style={{ padding:'11px 14px', borderBottom:'1px solid rgba(255,255,255,.055)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#F0F4FF' }}>Recent Check-ins</div>
            <a href={kioskCode ? `/kiosk/${kioskCode}` : '/kiosk'} target="_blank" style={{ fontSize:11, color:'#4D9EFF', textDecoration:'none' }}>Open Kiosk →</a>
          </div>
          {checkins.map((ci: any) => (
            <div key={ci.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderBottom:'1px solid rgba(255,255,255,.025)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:32, height:32, borderRadius:8, background:'rgba(29,111,232,.08)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#4D9EFF' }}>TRK</div>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:'#F0F4FF' }}>
                    {ci.company_name || (ci.customers as any)?.company_name || 'Walk-in'} — #{ci.unit_number}
                  </div>
                  <div style={{ fontSize:10, color:'#7C8BA0', marginTop:1 }}>
                    {ci.complaint_en ? ci.complaint_en.slice(0, 60) + (ci.complaint_en.length > 60 ? '...' : '') : 'No description'}
                  </div>
                </div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontSize:11, fontFamily:"'IBM Plex Mono',monospace", color:'#7C8BA0' }}>
                  {new Date(ci.created_at).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' })}
                </div>
                <div style={{ fontSize:9, color:'#48536A', fontFamily:'monospace' }}>{ci.checkin_ref}</div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
