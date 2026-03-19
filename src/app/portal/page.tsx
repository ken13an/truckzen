'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Customer portal — customers log in with their own Supabase account (role: customer)
// They see only their own vehicles and service orders

export default function PortalPage() {
  const supabase = createClient()
  const [orders, setOrders] = useState<any[]>([])
  const [customer, setCustomer] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      const { data: profile } = await supabase.from('users').select('*, customers(company_name, email, phone)').eq('id', user.id).single()
      if (!profile || profile.role !== 'customer') { window.location.href = '/dashboard'; return }
      setCustomer(profile)
      const { data } = await supabase
        .from('service_orders')
        .select('id, so_number, status, complaint, grand_total, created_at, assets(unit_number, year, make, model), invoices(id, invoice_number, status, balance_due)')
        .eq('customer_id', (profile as any).customers?.id)
        .order('created_at', { ascending: false })
        .limit(20)
      setOrders(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const STATUS_COLOR: Record<string, string> = {
    in_progress:'#00E0B0', waiting_parts:'#FFB84D', good_to_go:'#00E0B0', done:'#00E0B0',
    not_started:'#9D9DA1', waiting_approval:'#FFB84D',
  }
  const STATUS_LABEL: Record<string, string> = {
    in_progress:'In Progress', waiting_parts:'Waiting on Parts', good_to_go:'Ready for Pickup',
    done:'Complete', not_started:'Not Started', waiting_approval:'Awaiting Approval',
  }

  const S: Record<string, React.CSSProperties> = {
    page:   { background:'#08080C', minHeight:'100vh', color:'#EDEDF0', fontFamily:"'Instrument Sans',sans-serif", padding:'24px 16px', maxWidth:640, margin:'0 auto' },
    header: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 },
    title:  { fontFamily:"'Bebas Neue',sans-serif", fontSize:26, color:'#EDEDF0' },
    card:   { background:'#1A1A24', border:'1px solid rgba(255,255,255,.06)', borderRadius:12, padding:16, marginBottom:12 },
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:28, height:28, background:'linear-gradient(135deg,#00E0B0,#00E0B0)', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="white" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:16, letterSpacing:'.1em', color:'#EDEDF0' }}>TRUCK<span style={{ color:'#00E0B0' }}>ZEN</span></span>
        </div>
        <button onClick={() => supabase.auth.signOut().then(() => window.location.href='/login')}
          style={{ padding:'5px 12px', background:'transparent', border:'1px solid rgba(255,255,255,.08)', borderRadius:7, color:'#9D9DA1', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>Sign Out</button>
      </div>

      <div style={S.title}>Service History</div>
      <div style={{ fontSize:12, color:'#9D9DA1', marginBottom:20 }}>{customer?.customers?.company_name}</div>

      {loading ? <div style={{ color:'#9D9DA1', textAlign:'center', padding:40 }}>Loading your vehicles...</div>
      : orders.length === 0 ? <div style={{ color:'#9D9DA1', textAlign:'center', padding:40 }}>No service orders yet.</div>
      : orders.map(so => {
        const asset = so.assets as any
        const inv   = Array.isArray(so.invoices) ? so.invoices[0] : so.invoices
        const st    = STATUS_COLOR[so.status] || '#9D9DA1'
        return (
          <div key={so.id} style={S.card}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
              <div>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'#00E0B0', marginBottom:3 }}>{so.so_number}</div>
                <div style={{ fontSize:14, fontWeight:700, color:'#EDEDF0' }}>Unit #{asset?.unit_number} — {asset?.year} {asset?.make}</div>
                <div style={{ fontSize:11, color:'#9D9DA1', marginTop:3, lineHeight:1.4 }}>{so.complaint}</div>
              </div>
              <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'3px 9px', borderRadius:100, fontFamily:"'IBM Plex Mono',monospace", fontSize:8, background:st+'18', color:st, border:'1px solid '+st+'33', flexShrink:0, marginLeft:10 }}>
                <span style={{ width:4, height:4, borderRadius:'50%', background:'currentColor' }}/>{STATUS_LABEL[so.status] || so.status}
              </span>
            </div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:10, borderTop:'1px solid rgba(255,255,255,.05)' }}>
              <div style={{ fontSize:11, color:'#9D9DA1' }}>{new Date(so.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}</div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                {so.grand_total && <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:12, fontWeight:700, color:'#EDEDF0' }}>${so.grand_total.toFixed(0)}</span>}
                {inv && inv.balance_due > 0 && (
                  <a href={`/pay/${inv.id}`} style={{ padding:'5px 12px', background:'linear-gradient(135deg,#00E0B0,#00E0B0)', borderRadius:7, color:'#fff', fontSize:11, fontWeight:700, textDecoration:'none' }}>
                    Pay ${inv.balance_due.toFixed(0)}
                  </a>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
