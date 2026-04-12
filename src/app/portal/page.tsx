'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/hooks/useTheme'

// Customer portal — customers log in with their own Supabase account (role: customer)
// They see only their own vehicles and service orders

export default function PortalPage() {
  const { tokens: t } = useTheme()
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
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(20)
      setOrders(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const STATUS_COLOR: Record<string, string> = {
    in_progress:'#4D9EFF', waiting_parts:'#E8692A', good_to_go:'#1DB870', done:'#1DB870',
    not_started:t.textSecondary, waiting_approval:'#D4882A',
  }
  const STATUS_LABEL: Record<string, string> = {
    in_progress:'In Progress', waiting_parts:'Waiting on Parts', good_to_go:'Ready for Pickup',
    done:'Complete', not_started:'Not Started', waiting_approval:'Awaiting Approval',
  }

  const S: Record<string, React.CSSProperties> = {
    page:   { background:t.bg, minHeight:'100vh', color:t.text, fontFamily:"'Instrument Sans',sans-serif", padding:'24px 16px', maxWidth:640, margin:'0 auto' },
    header: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 },
    title:  { fontFamily:"'Bebas Neue',sans-serif", fontSize:26, color:t.text },
    card:   { background:'#161B24', border:'1px solid rgba(255,255,255,.06)', borderRadius:12, padding:16, marginBottom:12 },
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:28, height:28, background:'linear-gradient(135deg,#1D6FE8,#1248B0)', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="white" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:16, letterSpacing:'.1em', color:t.text }}>TRUCK<span style={{ color:'#4D9EFF' }}>ZEN</span></span>
        </div>
        <button onClick={() => supabase.auth.signOut().then(() => window.location.href='/login')}
          style={{ padding:'5px 12px', background:'transparent', border:'1px solid rgba(255,255,255,.08)', borderRadius:7, color:t.textSecondary, fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>Sign Out</button>
      </div>

      <div style={S.title}>Service History</div>
      <div style={{ fontSize:12, color:t.textSecondary, marginBottom:20 }}>{customer?.customers?.company_name}</div>

      {loading ? <div style={{ color:t.textSecondary, textAlign:'center', padding:40 }}>Loading your vehicles...</div>
      : orders.length === 0 ? <div style={{ color:t.textSecondary, textAlign:'center', padding:40 }}>No service orders yet.</div>
      : orders.map(so => {
        const asset = so.assets as any
        const inv   = Array.isArray(so.invoices) ? so.invoices[0] : so.invoices
        const st    = STATUS_COLOR[so.status] || '#7C8BA0'
        return (
          <div key={so.id} style={S.card}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
              <div>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'#4D9EFF', marginBottom:3 }}>{so.so_number}</div>
                <div style={{ fontSize:14, fontWeight:700, color:t.text }}>Unit #{asset?.unit_number} — {asset?.year} {asset?.make}</div>
                <div style={{ fontSize:11, color:t.textSecondary, marginTop:3, lineHeight:1.4 }}>{so.complaint}</div>
              </div>
              <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'3px 9px', borderRadius:100, fontFamily:"'IBM Plex Mono',monospace", fontSize:8, background:st+'18', color:st, border:'1px solid '+st+'33', flexShrink:0, marginLeft:10 }}>
                <span style={{ width:4, height:4, borderRadius:'50%', background:'currentColor' }}/>{STATUS_LABEL[so.status] || so.status}
              </span>
            </div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:10, borderTop:'1px solid rgba(255,255,255,.05)' }}>
              <div style={{ fontSize:11, color:t.textTertiary }}>{new Date(so.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}</div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                {so.grand_total && <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:12, fontWeight:700, color:t.text }}>${so.grand_total.toFixed(0)}</span>}
                {inv && inv.balance_due > 0 && (
                  <a href={`/pay/${inv.id}`} style={{ padding:'5px 12px', background:'linear-gradient(135deg,#1D6FE8,#1248B0)', borderRadius:7, color:'#fff', fontSize:11, fontWeight:700, textDecoration:'none' }}>
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
