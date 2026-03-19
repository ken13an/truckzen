'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

export default function InvoiceDetailPage() {
  const params   = useParams()
  const supabase = createClient()
  const [user,    setUser]    = useState<any>(null)
  const [invoice, setInvoice] = useState<any>(null)
  const [checks,  setChecks]  = useState<any>(null)
  const [qrUrl,   setQrUrl]   = useState('')
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { window.location.href = '/login'; return }
      setUser(profile)

      const { data: inv } = await supabase
        .from('invoices')
        .select(`
          *, 
          service_orders(
            id, so_number, status, complaint, cause, correction,
            assets(unit_number, year, make, model, odometer),
            users!assigned_tech(full_name)
          ),
          customers(company_name, contact_name, phone, email),
          so_lines(id, line_type, description, part_number, quantity, unit_price, total_price)
        `)
        .eq('id', params.id)
        .eq('shop_id', profile.shop_id)
        .single()

      if (!inv) { window.location.href = '/invoices'; return }
      setInvoice(inv)
      setLoading(false)
    }
    load()
  }, [params.id])

  async function runInvoiceChecks() {
    const res  = await fetch(`/api/invoices/${params.id}/validate`)
    const data = await res.json()
    setChecks(data)
  }

  async function generateQR() {
    const res  = await fetch(`/api/invoices/${params.id}/qr`)
    const data = await res.json()
    if (data.paymentUrl) setQrUrl(data.paymentUrl)
  }

  async function sendInvoice() {
    setSending(true)
    await runInvoiceChecks()
    // Send via Resend
    await fetch(`/api/invoices/${params.id}/send`, { method: 'POST' })
    setInvoice((i: any) => ({ ...i, status: 'sent' }))
    setSending(false)
  }

  const S: Record<string, React.CSSProperties> = {
    page:   { background:'#060708', minHeight:'100vh', color:'#DDE3EE', fontFamily:"'Instrument Sans',sans-serif", padding:24 },
    card:   { background:'#161B24', border:'1px solid rgba(255,255,255,.055)', borderRadius:12, padding:16, marginBottom:12 },
    label:  { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, letterSpacing:'.1em', textTransform:'uppercase' as const, color:'#48536A', marginBottom:5, display:'block' },
    th:     { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:'#48536A', textTransform:'uppercase', letterSpacing:'.08em', padding:'7px 10px', textAlign:'left', background:'#0B0D11' },
    td:     { padding:'9px 10px', borderBottom:'1px solid rgba(255,255,255,.025)', fontSize:12 },
    btn:    { padding:'9px 18px', borderRadius:8, border:'none', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  }

  if (loading) return <div style={{ ...S.page, color:'#7C8BA0', padding:60 }}>Loading...</div>

  const so     = invoice.service_orders
  const asset  = so?.assets
  const cust   = invoice.customers
  const tech   = so?.users
  const lines  = invoice.so_lines || []
  const isPaid = invoice.status === 'paid'

  const laborLines  = lines.filter((l: any) => l.line_type === 'labor')
  const partLines   = lines.filter((l: any) => l.line_type === 'part')
  const otherLines  = lines.filter((l: any) => !['labor','part'].includes(l.line_type))

  const statusColor: Record<string, string> = { draft:'#7C8BA0', sent:'#00E0B0', paid:'#1DB870', voided:'#48536A' }
  const stColor = statusColor[invoice.status] || '#7C8BA0'

  function lineSection(title: string, color: string, items: any[]) {
    if (!items.length) return null
    return (
      <>
        <tr><td colSpan={5} style={{ padding:'6px 10px', fontFamily:'monospace', fontSize:8, color, textTransform:'uppercase', letterSpacing:'.1em', background:'rgba(255,255,255,.02)', borderBottom:'1px solid rgba(255,255,255,.04)' }}>{title}</td></tr>
        {items.map((l: any) => (
          <tr key={l.id}>
            <td style={S.td}>{l.description}</td>
            <td style={{ ...S.td, fontFamily:'monospace', fontSize:10, color:'#48536A' }}>{l.part_number || '—'}</td>
            <td style={{ ...S.td, fontFamily:'monospace', textAlign:'center' }}>{l.quantity}</td>
            <td style={{ ...S.td, fontFamily:'monospace', color:'#7C8BA0' }}>${(l.unit_price||0).toFixed(2)}</td>
            <td style={{ ...S.td, fontFamily:'monospace', fontWeight:700, color: color }}>${(l.total_price||0).toFixed(2)}</td>
          </tr>
        ))}
      </>
    )
  }

  return (
    <div style={S.page}>
      <a href="/invoices" style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#7C8BA0', textDecoration:'none', marginBottom:20 }}>← Invoices</a>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:12, color:'#00E0B0', fontWeight:700, marginBottom:4 }}>{invoice.invoice_number}</div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:26, color:'#F0F4FF' }}>{cust?.company_name}</div>
          <div style={{ fontSize:12, color:'#7C8BA0', marginTop:4 }}>Unit #{asset?.unit_number} · {so?.so_number}</div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8 }}>
          <span style={{ padding:'4px 12px', borderRadius:100, fontFamily:'monospace', fontSize:9, background:stColor+'18', color:stColor, border:`1px solid ${stColor}33` }}>
            {invoice.status.toUpperCase()}
          </span>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:32, color: isPaid?'#1DB870':'#00E0B0' }}>
            ${(invoice.total||0).toFixed(2)}
          </div>
          {invoice.balance_due > 0 && <div style={{ fontSize:12, color:'#7C8BA0' }}>Balance due: ${invoice.balance_due.toFixed(2)}</div>}
        </div>
      </div>

      {/* Accounting safeguard warnings */}
      {checks && (checks.errors?.length > 0 || checks.warnings?.length > 0) && (
        <div style={{ background:'rgba(212,136,42,.06)', border:'1px solid rgba(212,136,42,.2)', borderRadius:10, padding:14, marginBottom:14 }}>
          {checks.errors?.map((e: string, i: number) => (
            <div key={i} style={{ display:'flex', gap:8, marginBottom:6, fontSize:12, color:'#D94F4F' }}>
              <span>✗</span> {e}
            </div>
          ))}
          {checks.warnings?.map((w: string, i: number) => (
            <div key={i} style={{ display:'flex', gap:8, marginBottom:6, fontSize:12, color:'#D4882A' }}>
              <span>⚠</span> {w}
            </div>
          ))}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:14, alignItems:'start' }}>
        <div>
          {/* Line items */}
          <div style={S.card}>
            <div style={{ fontSize:12, fontWeight:700, color:'#F0F4FF', marginBottom:12 }}>Line Items</div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:440 }}>
                <thead><tr>{['Description','Part #','Qty','Rate','Amount'].map(h => <th key={h} style={S.th as any}>{h}</th>)}</tr></thead>
                <tbody>
                  {lineSection('Labor', '#00E0B0', laborLines)}
                  {lineSection('Parts', '#1DB870', partLines)}
                  {lineSection('Other', '#D4882A', otherLines)}
                </tbody>
              </table>
            </div>
            {/* Totals */}
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, paddingTop:12, marginTop:8, borderTop:'1px solid rgba(255,255,255,.06)' }}>
              {[
                { label:'Subtotal', val: invoice.subtotal||0, color:'#DDE3EE' },
                { label:'Tax',      val: invoice.tax_amount||0, color:'#DDE3EE' },
                ...(invoice.amount_paid>0 ? [{ label:'Amount Paid', val: -(invoice.amount_paid||0), color:'#1DB870' }] : []),
              ].map(r => (
                <div key={r.label} style={{ display:'flex', gap:40 }}>
                  <span style={{ fontSize:12, color:'#7C8BA0' }}>{r.label}</span>
                  <span style={{ fontFamily:'monospace', fontSize:12, color:r.color, minWidth:80, textAlign:'right' }}>{r.val < 0 ? '-' : ''}${Math.abs(r.val).toFixed(2)}</span>
                </div>
              ))}
              <div style={{ display:'flex', gap:40, paddingTop:8, marginTop:4, borderTop:'1px solid rgba(255,255,255,.08)' }}>
                <span style={{ fontSize:15, fontWeight:700, color:'#F0F4FF' }}>Total</span>
                <span style={{ fontFamily:'monospace', fontSize:18, fontWeight:700, color: isPaid?'#1DB870':'#00E0B0', minWidth:80, textAlign:'right' }}>${(invoice.total||0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Service summary */}
          {so?.cause && (
            <div style={S.card}>
              <label style={S.label}>Work Performed</label>
              <div style={{ fontSize:12, color:'#7C8BA0', marginBottom:8 }}>Cause: <span style={{ color:'#DDE3EE' }}>{so.cause}</span></div>
              <div style={{ fontSize:12, color:'#7C8BA0' }}>Correction: <span style={{ color:'#DDE3EE' }}>{so.correction}</span></div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div>
          {/* Actions */}
          <div style={S.card}>
            <label style={S.label}>Actions</label>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {!isPaid && invoice.status !== 'voided' && (
                <>
                  <button style={{ ...S.btn, background:'linear-gradient(135deg,#00E0B0,#00805F)', color:'#fff', width:'100%' }}
                    onClick={sendInvoice} disabled={sending}>
                    {sending ? 'Sending...' : invoice.status === 'draft' ? 'Send to Customer' : 'Resend Invoice'}
                  </button>
                  <button style={{ ...S.btn, background:'rgba(29,184,112,.1)', color:'#1DB870', border:'1px solid rgba(29,184,112,.2)', width:'100%' }}
                    onClick={generateQR}>
                    Generate QR Payment
                  </button>
                  {qrUrl && (
                    <div style={{ textAlign:'center', padding:'12px 0' }}>
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}&bgcolor=161B24&color=ffffff`} alt="QR Code" style={{ width:160, borderRadius:8 }}/>
                      <div style={{ fontSize:10, color:'#48536A', marginTop:6 }}>Customer scans to pay</div>
                    </div>
                  )}
                  <button style={{ ...S.btn, background:'rgba(212,136,42,.08)', color:'#D4882A', border:'1px solid rgba(212,136,42,.2)', width:'100%' }}
                    onClick={runInvoiceChecks}>
                    Run Accounting Checks
                  </button>
                </>
              )}
              {isPaid && (
                <div style={{ textAlign:'center', padding:'12px 0' }}>
                  <div style={{ fontSize:20 }}>✅</div>
                  <div style={{ fontSize:13, fontWeight:700, color:'#1DB870', marginTop:6 }}>Paid</div>
                  {invoice.paid_at && <div style={{ fontSize:10, color:'#48536A', marginTop:4 }}>{new Date(invoice.paid_at).toLocaleDateString()}</div>}
                </div>
              )}
              <a href={`/orders/${so?.id}`} style={{ ...S.btn, background:'transparent', color:'#7C8BA0', border:'1px solid rgba(255,255,255,.08)', textDecoration:'none', textAlign:'center', display:'block' }}>
                View Service Order →
              </a>
            </div>
          </div>

          {/* Details */}
          <div style={S.card}>
            <label style={S.label}>Details</label>
            <div style={{ display:'flex', flexDirection:'column', gap:8, fontSize:12 }}>
              {[
                { label:'Customer',   val: cust?.company_name },
                { label:'Contact',    val: cust?.contact_name },
                { label:'Phone',      val: cust?.phone },
                { label:'Vehicle',    val: asset ? `${asset.year} ${asset.make} ${asset.model}` : null },
                { label:'Unit #',     val: asset?.unit_number ? '#' + asset.unit_number : null },
                { label:'Odometer',   val: asset?.odometer ? asset.odometer.toLocaleString() + ' mi' : null },
                { label:'Technician', val: tech?.full_name },
                { label:'Due Date',   val: invoice.due_date },
              ].filter(r => r.val).map(r => (
                <div key={r.label} style={{ display:'flex', justifyContent:'space-between', paddingBottom:6, borderBottom:'1px solid rgba(255,255,255,.03)' }}>
                  <span style={{ color:'#48536A' }}>{r.label}</span>
                  <span style={{ color:'#DDE3EE', textAlign:'right', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis' }}>{r.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
