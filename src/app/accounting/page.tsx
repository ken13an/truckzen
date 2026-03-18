'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

export default function AccountingPage() {
  const supabase = createClient()
  const [stats,    setStats]    = useState<any>(null)
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { window.location.href = '/login'; return }
      if (!['owner','gm','it_person','accountant','office_admin'].includes(profile.role)) { window.location.href = '/dashboard'; return }

      const [{ data: invData }, { data: allInv }] = await Promise.all([
        supabase.from('invoices').select('status, total, balance_due, due_date, paid_at').eq('shop_id', profile.shop_id),
        supabase.from('invoices').select('id, invoice_number, status, total, balance_due, due_date, customers(company_name)').eq('shop_id', profile.shop_id).order('created_at', { ascending: false }).limit(20),
      ])

      const today = new Date().toISOString().split('T')[0]
      const paid  = invData?.filter(i => i.status === 'paid')
      const sent  = invData?.filter(i => i.status === 'sent')

      setStats({
        revenue_mtd:    paid?.reduce((s, i) => s + (i.total || 0), 0) || 0,
        outstanding:    sent?.reduce((s, i) => s + (i.balance_due || 0), 0) || 0,
        overdue:        sent?.filter(i => i.due_date && i.due_date < today).reduce((s, i) => s + (i.balance_due || 0), 0) || 0,
        invoice_count:  invData?.length || 0,
      })
      setInvoices(allInv || [])
      setLoading(false)
    }
    load()
  }, [])

  const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  const S: Record<string, React.CSSProperties> = {
    page:    { background:'#060708', minHeight:'100vh', color:'#DDE3EE', fontFamily:"'Instrument Sans',sans-serif", padding:24 },
    title:   { fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:'#F0F4FF', marginBottom:20 },
    statRow: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10, marginBottom:20 },
    card:    { background:'#161B24', border:'1px solid rgba(255,255,255,.055)', borderRadius:10, padding:'12px 14px' },
    lbl:     { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, letterSpacing:'.1em', textTransform:'uppercase', color:'#48536A', marginBottom:6 },
    val:     { fontFamily:"'Bebas Neue',sans-serif", fontSize:28, lineHeight:1 },
    th:      { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:'#48536A', textTransform:'uppercase', letterSpacing:'.1em', padding:'7px 10px', textAlign:'left', background:'#0B0D11', whiteSpace:'nowrap' },
    td:      { padding:'9px 10px', borderBottom:'1px solid rgba(255,255,255,.025)', fontSize:11 },
  }

  const statusCfg: Record<string, { color: string; label: string }> = {
    draft:  { color:'#7C8BA0', label:'Draft' }, sent:  { color:'#4D9EFF', label:'Sent' },
    paid:   { color:'#1DB870', label:'Paid' },  voided:{ color:'#48536A', label:'Voided' },
  }

  return (
    <div style={S.page}>
      <div style={S.title}>Accounting</div>
      {loading ? <div style={{ color:'#7C8BA0' }}>Loading...</div> : (
        <>
          <div style={S.statRow}>
            {[
              { lbl:'Revenue MTD',   val: fmt(stats.revenue_mtd),   color:'#F0F4FF' },
              { lbl:'Outstanding',   val: fmt(stats.outstanding),   color: stats.outstanding > 0 ? '#D4882A' : '#1DB870' },
              { lbl:'Overdue',       val: fmt(stats.overdue),       color: stats.overdue > 0 ? '#D94F4F' : '#1DB870' },
              { lbl:'Total Invoices',val: stats.invoice_count,      color:'#F0F4FF' },
            ].map(s => (
              <div key={s.lbl} style={S.card}>
                <div style={S.lbl}>{s.lbl}</div>
                <div style={{ ...S.val, color:s.color }}>{s.val}</div>
              </div>
            ))}
          </div>

          <div style={{ display:'flex', gap:8, marginBottom:14 }}>
            <button style={{ padding:'7px 14px', background:'rgba(29,111,232,.1)', border:'1px solid rgba(29,111,232,.25)', borderRadius:8, color:'#4D9EFF', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Sync to QuickBooks</button>
            <button style={{ padding:'7px 14px', background:'#161B24', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, color:'#7C8BA0', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Export CSV</button>
          </div>

          <div style={{ background:'#161B24', border:'1px solid rgba(255,255,255,.055)', borderRadius:12, overflow:'hidden' }}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:480 }}>
                <thead><tr>{['Invoice #','Customer','Total','Balance Due','Due Date','Status'].map(h =>
                  <th key={h} style={S.th as any}>{h}</th>)}</tr></thead>
                <tbody>
                  {invoices.map(inv => {
                    const cfg  = statusCfg[inv.status] || { color:'#7C8BA0', label: inv.status }
                    const today = new Date().toISOString().split('T')[0]
                    const over  = inv.status === 'sent' && inv.due_date < today
                    return (
                      <tr key={inv.id} style={{ cursor:'pointer' }} onClick={() => window.location.href = '/invoices/' + inv.id}>
                        <td style={{ ...S.td, fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'#4D9EFF', fontWeight:700 }}>{inv.invoice_number}</td>
                        <td style={{ ...S.td, color:'#F0F4FF' }}>{(inv.customers as any)?.company_name}</td>
                        <td style={{ ...S.td, fontFamily:"'IBM Plex Mono',monospace", color:'#DDE3EE', fontWeight:700 }}>{fmt(inv.total || 0)}</td>
                        <td style={{ ...S.td, fontFamily:"'IBM Plex Mono',monospace", color: inv.balance_due > 0 ? '#4D9EFF' : '#1DB870', fontWeight:700 }}>{fmt(inv.balance_due || 0)}</td>
                        <td style={{ ...S.td, color: over ? '#D94F4F' : '#7C8BA0' }}>{inv.due_date || '—'}</td>
                        <td style={S.td as any}>
                          <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 8px', borderRadius:100, fontFamily:"'IBM Plex Mono',monospace", fontSize:8, background:(over?'#D94F4F':cfg.color)+'18', color:over?'#D94F4F':cfg.color, border:'1px solid '+(over?'#D94F4F':cfg.color)+'33' }}>
                            <span style={{ width:4, height:4, borderRadius:'50%', background:'currentColor' }}/>{over?'Overdue':cfg.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
