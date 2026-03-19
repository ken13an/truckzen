'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

const STATUS_CFG: Record<string, { label:string; color:string }> = {
  draft:   { label:'Draft',    color:'#7C8BA0' },
  sent:    { label:'Sent',     color:'#00E0B0' },
  paid:    { label:'Paid',     color:'#1DB870' },
  overdue: { label:'Overdue',  color:'#D94F4F' },
  voided:  { label:'Voided',   color:'#48536A' },
}

export default function InvoicesPage() {
  const supabase = createClient()
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter,  setFilter]    = useState('all')

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { window.location.href = '/login'; return }
      let q = supabase.from('invoices')
        .select('id, invoice_number, status, subtotal, tax_amount, total, balance_due, amount_paid, due_date, paid_at, customers(company_name), service_orders(so_number, assets(unit_number))')
        .eq('shop_id', profile.shop_id)
        .order('created_at', { ascending: false })
      if (filter !== 'all') q = q.eq('status', filter)
      const { data } = await q.limit(100)
      setInvoices(data || [])
      setLoading(false)
    }
    load()
  }, [filter])

  const total_outstanding = invoices.filter(i => i.status === 'sent').reduce((s, i) => s + (i.balance_due || 0), 0)
  const total_paid_month  = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0)

  return (
    <div style={{ background:'#060708', minHeight:'100vh', color:'#DDE3EE', fontFamily:"'Instrument Sans',sans-serif", padding:24 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:'#F0F4FF' }}>Invoices</div>
          <div style={{ fontSize:12, color:'#7C8BA0' }}>Outstanding: \${total_outstanding.toFixed(0)} · Paid MTD: \${total_paid_month.toFixed(0)}</div>
        </div>
        <button onClick={() => window.location.href = '/invoices/new'} style={{ padding:'7px 14px', background:'linear-gradient(135deg,#00E0B0,#00805F)', border:'none', borderRadius:8, color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ New Invoice</button>
      </div>
      <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
        {['all','draft','sent','paid','overdue'].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{ padding:'5px 12px', borderRadius:100, fontSize:10, fontWeight:600, cursor:'pointer', border:'1px solid rgba(255,255,255,.08)', background: filter===s?'rgba(0,224,176,.1)':'#1C2130', color: filter===s?'#00E0B0':'#7C8BA0', fontFamily:'inherit', minHeight:30 }}>
            {s==='all'?'All':STATUS_CFG[s]?.label||s}
          </button>
        ))}
      </div>
      <div style={{ background:'#161B24', border:'1px solid rgba(255,255,255,.055)', borderRadius:12, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:560 }}>
            <thead><tr>{['Invoice #','Customer','SO / Truck','Total','Balance Due','Due Date','Status','Actions'].map(h =>
              <th key={h} style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:'#48536A', textTransform:'uppercase', letterSpacing:'.1em', padding:'7px 10px', textAlign:'left', background:'#0B0D11', whiteSpace:'nowrap' }}>{h}</th>
            )}</tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:'#7C8BA0' }}>Loading...</td></tr>
              : invoices.map(inv => {
                const cust = inv.customers as any
                const so   = inv.service_orders as any
                const cfg  = STATUS_CFG[inv.status] || { label: inv.status, color: '#7C8BA0' }
                const isOverdue = inv.status === 'sent' && inv.due_date && inv.due_date < new Date().toISOString().split('T')[0]
                return (
                  <tr key={inv.id} style={{ borderBottom:'1px solid rgba(255,255,255,.025)', cursor:'pointer' }} onClick={() => window.location.href = '/invoices/' + inv.id}>
                    <td style={{ padding:'9px 10px', fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'#00E0B0', fontWeight:700 }}>{inv.invoice_number}</td>
                    <td style={{ padding:'9px 10px', color:'#F0F4FF' }}>{cust?.company_name}</td>
                    <td style={{ padding:'9px 10px', fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'#7C8BA0' }}>{so?.so_number}{so?.assets?.unit_number ? ' · #'+so.assets.unit_number : ''}</td>
                    <td style={{ padding:'9px 10px', fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:'#DDE3EE', fontWeight:700 }}>\${(inv.total||0).toFixed(2)}</td>
                    <td style={{ padding:'9px 10px', fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color: inv.balance_due>0?'#00E0B0':'#1DB870', fontWeight:700 }}>\${(inv.balance_due||0).toFixed(2)}</td>
                    <td style={{ padding:'9px 10px', fontSize:11, color: isOverdue?'#D94F4F':'#7C8BA0' }}>{inv.due_date||'—'}</td>
                    <td style={{ padding:'9px 10px' }}>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 8px', borderRadius:100, fontFamily:"'IBM Plex Mono',monospace", fontSize:8, background:cfg.color+'18', color:cfg.color, border:'1px solid '+cfg.color+'33' }}>
                        <span style={{ width:4, height:4, borderRadius:'50%', background:'currentColor' }}/>{isOverdue?'Overdue':cfg.label}
                      </span>
                    </td>
                    <td style={{ padding:'9px 10px' }}>
                      <div style={{ display:'flex', gap:4 }}>
                        <button onClick={e => { e.stopPropagation(); window.open('/pay/'+inv.id+'/qr') }} style={{ padding:'3px 8px', borderRadius:5, background:'rgba(0,224,176,.1)', border:'1px solid rgba(0,224,176,.2)', color:'#00E0B0', fontSize:9, cursor:'pointer', fontFamily:'inherit' }}>QR Pay</button>
                      </div>
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