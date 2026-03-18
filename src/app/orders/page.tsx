'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  not_started:          { label: 'Not Started',         color: '#7C8BA0' },
  not_approved:         { label: 'Not Approved',         color: '#D4882A' },
  waiting_approval:     { label: 'Waiting Approval',     color: '#D4882A' },
  in_progress:          { label: 'In Progress',          color: '#4D9EFF' },
  waiting_parts:        { label: 'Waiting Parts',        color: '#E8692A' },
  done:                 { label: 'Done',                 color: '#1DB870' },
  ready_final_inspection:{ label: 'Ready for Inspection',color: '#8B5CF6' },
  good_to_go:           { label: 'Good to Go',           color: '#1DB870' },
  failed_inspection:    { label: 'Failed Inspection',    color: '#D94F4F' },
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: '#D94F4F', high: '#D4882A', medium: '#D4882A', low: '#7C8BA0',
}

export default function OrdersPage() {
  const supabase = createClient()
  const [user,    setUser]    = useState<any>(null)
  const [orders,  setOrders]  = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [teamFilter,   setTeamFilter]   = useState('all')

  const loadOrders = useCallback(async (shopId: string, role: string, team: string) => {
    let q = supabase
      .from('service_orders')
      .select(`
        id, so_number, status, priority, complaint, bay, team,
        created_at, updated_at, grand_total,
        assets(unit_number, year, make, model),
        customers(company_name),
        users!assigned_tech(full_name)
      `)
      .eq('shop_id', shopId)
      .not('status', 'eq', 'void')
      .order('created_at', { ascending: false })

    // Techs only see their own team
    if (!['owner','gm','it_person','shop_manager','service_advisor','service_writer','accountant','office_admin'].includes(role)) {
      if (team) q = q.eq('team', team)
    }
    if (statusFilter !== 'all') q = q.eq('status', statusFilter)
    if (teamFilter   !== 'all') q = q.eq('team', teamFilter)

    const { data } = await q.limit(100)
    setOrders(data || [])
    setLoading(false)
  }, [statusFilter, teamFilter])

  useEffect(() => {
    async function init() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { window.location.href = '/login'; return }
      setUser(profile)
      await loadOrders(profile.shop_id, profile.role, profile.team || '')
    }
    init()
  }, [loadOrders])

  const filtered = orders.filter(so => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      so.so_number?.toLowerCase().includes(q) ||
      (so.assets as any)?.unit_number?.toLowerCase().includes(q) ||
      (so.customers as any)?.company_name?.toLowerCase().includes(q) ||
      so.complaint?.toLowerCase().includes(q)
    )
  })

  const S: Record<string, React.CSSProperties> = {
    page:   { background:'#060708', minHeight:'100vh', color:'#DDE3EE', fontFamily:"'Instrument Sans',sans-serif", padding:24 },
    header: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 },
    title:  { fontFamily:"'Bebas Neue',sans-serif", fontSize:28, letterSpacing:'.02em', color:'#F0F4FF' },
    tbar:   { display:'flex', gap:8, flexWrap:'wrap', marginBottom:14, alignItems:'center' },
    search: { display:'flex', alignItems:'center', gap:6, padding:'6px 10px', borderRadius:8, background:'#1C2130', border:'1px solid rgba(255,255,255,.08)', color:'#7C8BA0', fontSize:11 },
    input:  { background:'none', border:'none', outline:'none', color:'#DDE3EE', fontSize:11, fontFamily:'inherit', width:180 },
    chip:   { padding:'5px 12px', borderRadius:100, fontSize:10, fontWeight:600, cursor:'pointer', border:'1px solid rgba(255,255,255,.08)', background:'#1C2130', color:'#7C8BA0', transition:'all .13s', minHeight:32 },
    chipOn: { background:'rgba(29,111,232,.10)', color:'#4D9EFF', border:'1px solid rgba(29,111,232,.3)' },
    btn:    { padding:'8px 16px', borderRadius:8, background:'linear-gradient(135deg,#1D6FE8,#1248B0)', border:'none', color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
    table:  { width:'100%', borderCollapse:'collapse' as const, minWidth:640 },
    th:     { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:'#48536A', textTransform:'uppercase' as const, letterSpacing:'.1em', padding:'7px 10px', textAlign:'left' as const, background:'#0B0D11', whiteSpace:'nowrap' as const },
    td:     { fontSize:11, padding:'10px', borderBottom:'1px solid rgba(255,255,255,.025)', verticalAlign:'middle' as const },
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <div style={S.title}>Service Orders</div>
          <div style={{ fontSize:12, color:'#7C8BA0' }}>{filtered.length} orders</div>
        </div>
        <button style={S.btn} onClick={() => window.location.href = '/orders/new'}>+ New Service Order</button>
      </div>

      <div style={S.tbar}>
        <div style={S.search}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input style={S.input} placeholder="SO #, truck, customer..." value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        {['all','in_progress','waiting_parts','waiting_approval','good_to_go'].map(s => (
          <button key={s} style={{ ...S.chip, ...(statusFilter===s ? S.chipOn : {}) }}
            onClick={() => setStatusFilter(s)}>
            {s === 'all' ? 'All' : STATUS_MAP[s]?.label || s}
          </button>
        ))}
        <div style={{ width:1, height:20, background:'rgba(255,255,255,.08)', margin:'0 4px' }}/>
        {['all','A','B','C','D'].map(t => (
          <button key={t} style={{ ...S.chip, ...(teamFilter===t ? S.chipOn : {}) }}
            onClick={() => setTeamFilter(t)}>
            {t === 'all' ? 'All Teams' : `Team ${t}`}
          </button>
        ))}
      </div>

      <div style={{ background:'#161B24', border:'1px solid rgba(255,255,255,.055)', borderRadius:12, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          {loading ? (
            <div style={{ padding:40, textAlign:'center', color:'#7C8BA0' }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding:40, textAlign:'center', color:'#7C8BA0' }}>No service orders found</div>
          ) : (
            <table style={S.table}>
              <thead>
                <tr>{['SO #','Truck','Customer','Complaint','Tech','Team/Bay','Status','Priority','Total'].map(h =>
                  <th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map(so => {
                  const asset = so.assets as any
                  const cust  = so.customers as any
                  const tech  = (so as any).users as any
                  const st    = STATUS_MAP[so.status] || { label: so.status, color: '#7C8BA0' }
                  return (
                    <tr key={so.id} style={{ cursor:'pointer' }} onClick={() => window.location.href = `/orders/${so.id}`}>
                      <td style={{ ...S.td, fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'#4D9EFF', fontWeight:700 }}>{so.so_number}</td>
                      <td style={S.td}>
                        <span style={{ fontWeight:700, color:'#F0F4FF' }}>#{asset?.unit_number}</span>
                        <div style={{ fontSize:9, color:'#7C8BA0', marginTop:1 }}>{asset?.year} {asset?.make}</div>
                      </td>
                      <td style={{ ...S.td, color:'#DDE3EE' }}>{cust?.company_name}</td>
                      <td style={{ ...S.td, color:'#7C8BA0', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{so.complaint}</td>
                      <td style={{ ...S.td, color:'#DDE3EE' }}>{tech?.full_name || <span style={{ color:'#48536A' }}>Unassigned</span>}</td>
                      <td style={{ ...S.td, fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'#7C8BA0' }}>
                        {so.team && `Team ${so.team}`}{so.bay && ` · ${so.bay}`}
                      </td>
                      <td style={S.td}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 8px', borderRadius:100, fontFamily:"'IBM Plex Mono',monospace", fontSize:8, background:`${st.color}18`, color:st.color, border:`1px solid ${st.color}33` }}>
                          <span style={{ width:4, height:4, borderRadius:'50%', background:'currentColor' }}/>
                          {st.label}
                        </span>
                      </td>
                      <td style={S.td}>
                        <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, fontWeight:700, color: PRIORITY_COLOR[so.priority] || '#7C8BA0' }}>
                          {so.priority?.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ ...S.td, fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'#DDE3EE' }}>
                        {so.grand_total ? `$${so.grand_total.toFixed(0)}` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
