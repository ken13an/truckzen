'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

const STATUS_ORDER = ['not_started','not_approved','waiting_approval','in_progress','waiting_parts','done','ready_final_inspection','good_to_go','failed_inspection']
const STATUS_CFG: Record<string, { label: string; color: string }> = {
  not_started:           { label:'Not Started',          color:'#9D9DA1' },
  not_approved:          { label:'Not Approved',          color:'#FFB84D' },
  waiting_approval:      { label:'Waiting Approval',      color:'#FFB84D' },
  in_progress:           { label:'In Progress',           color:'#00E0B0' },
  waiting_parts:         { label:'Waiting Parts',         color:'#FFB84D' },
  done:                  { label:'Done',                  color:'#00E0B0' },
  ready_final_inspection:{ label:'Ready for Inspection',  color:'#00E0B0' },
  good_to_go:            { label:'Good to Go',            color:'#00E0B0' },
  failed_inspection:     { label:'Failed — Needs Work',   color:'#FF5C5C' },
}

export default function SODetailPage() {
  const params  = useParams()
  const router  = useRouter()
  const supabase = createClient()

  const [user,    setUser]    = useState<any>(null)
  const [so,      setSO]      = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  // AI Writer state
  const [aiLoading,    setAiLoading]    = useState(false)
  const [aiCause,      setAiCause]      = useState('')
  const [aiCorrection, setAiCorrection] = useState('')
  const [editCause,    setEditCause]    = useState('')
  const [editCorr,     setEditCorr]     = useState('')

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { router.push('/login'); return }
      setUser(profile)

      const res  = await fetch(`/api/service-orders/${params.id}`)
      const data = await res.json()
      if (!res.ok) { router.push('/orders'); return }
      setSO(data)
      setEditCause(data.cause || '')
      setEditCorr(data.correction || '')
      setLoading(false)
    }
    load()
  }, [params.id])

  async function updateStatus(newStatus: string) {
    setSaving(true)
    await fetch(`/api/service-orders/${so.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setSO((s: any) => ({ ...s, status: newStatus }))
    setSaving(false)
  }

  async function saveCauseCorrection() {
    setSaving(true)
    await fetch(`/api/service-orders/${so.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cause: editCause, correction: editCorr }),
    })
    setSO((s: any) => ({ ...s, cause: editCause, correction: editCorr }))
    setSaving(false)
  }

  async function generateAI() {
    setAiLoading(true)
    const res = await fetch('/api/ai/service-writer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: so.complaint,
        language: user?.language || 'en',
        truck_info: {
          year:  so.assets?.year,
          make:  so.assets?.make,
          model: so.assets?.model,
        },
        complaint: so.complaint,
        so_id: so.id,
      }),
    })
    const data = await res.json()
    if (data.cause)      { setAiCause(data.cause);      setEditCause(data.cause) }
    if (data.correction) { setAiCorrection(data.correction); setEditCorr(data.correction) }
    setAiLoading(false)
  }

  const S: Record<string, React.CSSProperties> = {
    page:  { background:'#08080C', minHeight:'100vh', color:'#EDEDF0', fontFamily:"'Instrument Sans',sans-serif", padding:24 },
    back:  { display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#9D9DA1', cursor:'pointer', marginBottom:20, textDecoration:'none' },
    grid:  { display:'grid', gridTemplateColumns:'1fr 340px', gap:16, alignItems:'start' },
    card:  { background:'#1A1A24', border:'1px solid rgba(255,255,255,.055)', borderRadius:12, padding:16, marginBottom:12 },
    label: { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, letterSpacing:'.1em', textTransform:'uppercase' as const, color:'#9D9DA1', marginBottom:6, display:'block' },
    val:   { fontSize:13, color:'#EDEDF0', lineHeight:1.5 },
    ta:    { width:'100%', padding:'10px 12px', background:'#1A1A24', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, fontSize:12, color:'#EDEDF0', outline:'none', fontFamily:'inherit', resize:'vertical' as const, minHeight:80, boxSizing:'border-box' as const },
    btn:   { padding:'8px 16px', borderRadius:8, border:'none', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', transition:'all .14s' },
  }

  if (loading) return <div style={{ ...S.page, display:'flex', alignItems:'center', justifyContent:'center', color:'#9D9DA1' }}>Loading...</div>
  if (!so) return null

  const asset  = so.assets
  const cust   = so.customers
  const tech   = so.users
  const lines  = so.so_lines || []
  const inv    = Array.isArray(so.invoices) ? so.invoices[0] : so.invoices
  const stCfg  = STATUS_CFG[so.status] || { label: so.status, color: '#9D9DA1' }

  const curIdx    = STATUS_ORDER.indexOf(so.status)
  const nextStatus = STATUS_ORDER[curIdx + 1]
  const nextCfg   = nextStatus ? STATUS_CFG[nextStatus] : null

  const laborTotal = lines.filter((l: any) => l.line_type === 'labor').reduce((s: number, l: any) => s + (l.total_price || 0), 0)
  const partsTotal = lines.filter((l: any) => l.line_type === 'part').reduce((s: number, l: any) => s + (l.total_price || 0), 0)

  return (
    <div style={S.page}>
      <a href="/orders" style={S.back}>
        ← Service Orders
      </a>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:12, color:'#00E0B0', fontWeight:700, marginBottom:4 }}>{so.so_number}</div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:'#EDEDF0', letterSpacing:'.02em' }}>
            {asset?.year} {asset?.make} {asset?.model} — Unit #{asset?.unit_number}
          </div>
          <div style={{ fontSize:13, color:'#9D9DA1', marginTop:4 }}>{cust?.company_name}</div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8 }}>
          <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'4px 12px', borderRadius:100, fontFamily:"'IBM Plex Mono',monospace", fontSize:9, background:stCfg.color+'18', color:stCfg.color, border:`1px solid ${stCfg.color}33` }}>
            <span style={{ width:5, height:5, borderRadius:'50%', background:'currentColor' }}/>
            {stCfg.label}
          </span>
          {nextCfg && nextStatus && (
            <button style={{ ...S.btn, background:`${nextCfg.color}18`, color:nextCfg.color, border:`1px solid ${nextCfg.color}33` }}
              onClick={() => updateStatus(nextStatus)} disabled={saving}>
              Move to {nextCfg.label} →
            </button>
          )}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:12 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:12, alignItems:'start' }}>

          {/* LEFT COLUMN */}
          <div>
            {/* Complaint */}
            <div style={S.card}>
              <label style={S.label}>Customer Complaint</label>
              <div style={S.val}>{so.complaint || '—'}</div>
            </div>

            {/* AI Service Writer */}
            <div style={{ ...S.card, border:'1px solid rgba(139,92,246,.2)', background:'rgba(139,92,246,.03)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#EDEDF0', display:'flex', alignItems:'center', gap:7 }}>
                  <div style={{ width:20, height:20, background:'linear-gradient(135deg,#00E0B0,#00E0B0)', borderRadius:5, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="white" strokeWidth="2"><path d="M12 2a3 3 0 013 3v7a3 3 0 01-6 0V5a3 3 0 013-3z"/></svg>
                  </div>
                  AI Service Writer
                </div>
                <button style={{ ...S.btn, background:'linear-gradient(135deg,#00E0B0,#00E0B0)', color:'#fff', padding:'6px 14px' }}
                  onClick={generateAI} disabled={aiLoading}>
                  {aiLoading ? 'Generating...' : so.cause ? 'Regenerate' : 'Generate from Complaint'}
                </button>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={S.label}>Cause</label>
                  <textarea style={S.ta} value={editCause} onChange={e => setEditCause(e.target.value)} placeholder="What caused the problem..."/>
                </div>
                <div>
                  <label style={S.label}>Correction</label>
                  <textarea style={S.ta} value={editCorr} onChange={e => setEditCorr(e.target.value)} placeholder="What was done to fix it..."/>
                </div>
              </div>

              <div style={{ marginTop:10, display:'flex', gap:8 }}>
                <button style={{ ...S.btn, background:'linear-gradient(135deg,#00E0B0,#00E0B0)', color:'#fff' }}
                  onClick={saveCauseCorrection} disabled={saving}>
                  {saving ? 'Saving...' : 'Save to Service Order'}
                </button>
              </div>
            </div>

            {/* Line Items */}
            <div style={S.card}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#EDEDF0' }}>Labor & Parts</div>
                <div style={{ display:'flex', gap:6 }}>
                  <button style={{ ...S.btn, background:'rgba(0,224,176,.1)', color:'#00E0B0', border:'1px solid rgba(0,224,176,.2)' }}>+ Labor</button>
                  <button style={{ ...S.btn, background:'rgba(29,184,112,.1)', color:'#00E0B0', border:'1px solid rgba(29,184,112,.2)' }}>+ Part</button>
                </div>
              </div>
              {lines.length === 0 ? (
                <div style={{ textAlign:'center', padding:20, color:'#9D9DA1', fontSize:12 }}>No line items yet</div>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr>{['Type','Description','Qty','Unit Price','Total'].map(h =>
                      <th key={h} style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:'#9D9DA1', textTransform:'uppercase', letterSpacing:'.08em', padding:'6px 8px', textAlign:'left', borderBottom:'1px solid rgba(255,255,255,.06)' }}>{h}</th>
                    )}</tr>
                  </thead>
                  <tbody>
                    {lines.map((l: any) => (
                      <tr key={l.id} style={{ borderBottom:'1px solid rgba(255,255,255,.03)' }}>
                        <td style={{ padding:'7px 8px' }}>
                          <span style={{ fontSize:8, fontWeight:700, fontFamily:'monospace', padding:'2px 6px', borderRadius:4, background: l.line_type==='labor'?'rgba(0,224,176,.15)':'rgba(29,184,112,.15)', color: l.line_type==='labor'?'#00E0B0':'#00E0B0' }}>
                            {l.line_type.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding:'7px 8px', fontSize:12, color:'#EDEDF0' }}>{l.description}</td>
                        <td style={{ padding:'7px 8px', fontFamily:'monospace', fontSize:11, textAlign:'center', color:'#9D9DA1' }}>{l.quantity}</td>
                        <td style={{ padding:'7px 8px', fontFamily:'monospace', fontSize:11, color:'#9D9DA1' }}>${(l.unit_price||0).toFixed(2)}</td>
                        <td style={{ padding:'7px 8px', fontFamily:'monospace', fontSize:11, fontWeight:700, color:'#EDEDF0' }}>${(l.total_price||0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {lines.length > 0 && (
                <div style={{ display:'flex', justifyContent:'flex-end', gap:24, paddingTop:10, marginTop:10, borderTop:'1px solid rgba(255,255,255,.06)' }}>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:10, color:'#9D9DA1', fontFamily:'monospace' }}>LABOR</div>
                    <div style={{ fontFamily:'monospace', fontWeight:700, color:'#00E0B0' }}>${laborTotal.toFixed(2)}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:10, color:'#9D9DA1', fontFamily:'monospace' }}>PARTS</div>
                    <div style={{ fontFamily:'monospace', fontWeight:700, color:'#00E0B0' }}>${partsTotal.toFixed(2)}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:10, color:'#9D9DA1', fontFamily:'monospace' }}>TOTAL</div>
                    <div style={{ fontFamily:'monospace', fontWeight:700, color:'#EDEDF0', fontSize:16 }}>${(so.grand_total||0).toFixed(2)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div>
            {/* Vehicle */}
            <div style={S.card}>
              <label style={S.label}>Vehicle</label>
              <div style={{ fontSize:15, fontWeight:700, color:'#EDEDF0', marginBottom:4 }}>Unit #{asset?.unit_number}</div>
              <div style={{ fontSize:12, color:'#EDEDF0' }}>{asset?.year} {asset?.make} {asset?.model}</div>
              {asset?.vin && <div style={{ fontSize:10, color:'#9D9DA1', fontFamily:'monospace', marginTop:4 }}>VIN: {asset.vin}</div>}
              {asset?.odometer && <div style={{ fontSize:11, color:'#9D9DA1', marginTop:4 }}>{asset.odometer.toLocaleString()} mi</div>}
              <a href={`/fleet/${asset?.id}`} style={{ fontSize:11, color:'#00E0B0', textDecoration:'none', display:'block', marginTop:8 }}>View vehicle history →</a>
            </div>

            {/* Customer */}
            <div style={S.card}>
              <label style={S.label}>Customer</label>
              <div style={{ fontSize:14, fontWeight:700, color:'#EDEDF0' }}>{cust?.company_name}</div>
              {cust?.contact_name && <div style={{ fontSize:12, color:'#9D9DA1', marginTop:2 }}>{cust.contact_name}</div>}
              {cust?.phone && <div style={{ fontSize:11, color:'#EDEDF0', marginTop:4 }}>{cust.phone}</div>}
              {cust?.email && <div style={{ fontSize:11, color:'#9D9DA1' }}>{cust.email}</div>}
            </div>

            {/* Assignment */}
            <div style={S.card}>
              <label style={S.label}>Assignment</label>
              <div style={{ fontSize:13, fontWeight:600, color:'#EDEDF0' }}>{tech?.full_name || 'Unassigned'}</div>
              {so.team && <div style={{ fontSize:11, color:'#9D9DA1', marginTop:2 }}>Team {so.team} · {so.bay || 'No bay'}</div>}
            </div>

            {/* Invoice */}
            {inv && (
              <div style={S.card}>
                <label style={S.label}>Invoice</label>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#EDEDF0', fontFamily:'monospace' }}>{inv.invoice_number}</div>
                    <div style={{ fontSize:11, color: inv.status==='paid'?'#00E0B0':'#00E0B0', marginTop:2 }}>{inv.status?.toUpperCase()} · ${(inv.total||0).toFixed(0)}</div>
                  </div>
                  {inv.balance_due > 0 && (
                    <a href={`/invoices/${inv.id}`} style={{ padding:'6px 12px', background:'linear-gradient(135deg,#00E0B0,#00E0B0)', borderRadius:7, color:'#fff', fontSize:11, fontWeight:700, textDecoration:'none' }}>
                      View Invoice
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* All status transitions */}
            <div style={S.card}>
              <label style={S.label}>Status</label>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                {STATUS_ORDER.map(s => {
                  const cfg = STATUS_CFG[s]
                  const isCurrent = so.status === s
                  return (
                    <button key={s} disabled={isCurrent || saving}
                      onClick={() => updateStatus(s)}
                      style={{ padding:'7px 10px', borderRadius:7, border:'none', textAlign:'left', cursor: isCurrent?'default':'pointer', fontFamily:'inherit', fontSize:11, fontWeight: isCurrent?700:500,
                        background: isCurrent?`${cfg.color}20`:'transparent',
                        color: isCurrent?cfg.color:'#9D9DA1',
                        transition:'all .13s',
                      }}>
                      {isCurrent ? '● ' : '○ '}{cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
