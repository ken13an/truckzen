'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

interface LineItem {
  id?: string
  _tempId?: string
  line_type: string
  description: string
  part_number: string
  quantity: number
  unit_price: number
  total_price: number
}

export default function InvoiceDetailPage() {
  const params   = useParams()
  const supabase = createClient()
  const [user,    setUser]    = useState<any>(null)
  const [invoice, setInvoice] = useState<any>(null)
  const [checks,  setChecks]  = useState<any>(null)
  const [qrUrl,   setQrUrl]   = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [saving,  setSaving]  = useState(false)

  // Editing state
  const [editingLines, setEditingLines] = useState<LineItem[]>([])
  const [isEditing,    setIsEditing]    = useState(false)
  const [editingCell,  setEditingCell]  = useState<string | null>(null)

  // Record Payment modal
  const [showPaidModal, setShowPaidModal]       = useState(false)
  const [paymentMethod, setPaymentMethod]       = useState('cash')
  const [paymentAmount, setPaymentAmount]       = useState('')
  const [paymentRef,    setPaymentRef]          = useState('')
  const [paymentNotes,  setPaymentNotes]        = useState('')
  const [paymentDate,   setPaymentDate]         = useState(new Date().toISOString().split('T')[0])
  const [markingPaid,   setMarkingPaid]         = useState(false)
  const [payments,      setPayments]            = useState<any[]>([])

  const isDraft = invoice?.status === 'draft'

  const recalcTotals = useCallback((lines: LineItem[]) => {
    const subtotal = lines.reduce((s, l) => s + (l.total_price || 0), 0)
    const taxRate = invoice?.tax_rate || 0
    const taxAmount = subtotal * taxRate / 100
    const total = subtotal + taxAmount
    const amountPaid = invoice?.amount_paid || 0
    const balanceDue = total - amountPaid
    return { subtotal, tax_amount: taxAmount, total, balance_due: balanceDue }
  }, [invoice?.tax_rate, invoice?.amount_paid])

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { window.location.href = '/login'; return }
      setUser(profile)

      const res = await fetch(`/api/invoices/${params.id}`)
      if (!res.ok) { window.location.href = '/invoices'; return }
      const inv = await res.json()

      if (!inv || inv.error) { window.location.href = '/invoices'; return }

      // so_lines are nested inside service_orders from the API response
      const soLines: any[] = inv.service_orders?.so_lines || []
      inv.so_lines = soLines

      setInvoice(inv)
      setEditingLines(soLines.map((l: any) => ({ ...l })))

      // Load payment history
      try {
        const payRes = await fetch(`/api/invoice-payments?invoice_id=${params.id}`)
        if (payRes.ok) setPayments(await payRes.json())
      } catch {}

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
    await fetch(`/api/invoices/${params.id}/send`, { method: 'POST' })
    setInvoice((i: any) => ({ ...i, status: 'sent' }))
    setSending(false)
  }

  function handleLineChange(index: number, field: keyof LineItem, value: string | number) {
    setEditingLines(prev => {
      const updated = [...prev]
      const line = { ...updated[index] }
      if (field === 'quantity' || field === 'unit_price') {
        (line as any)[field] = Number(value) || 0
        line.total_price = line.quantity * line.unit_price
      } else {
        (line as any)[field] = value
      }
      updated[index] = line
      return updated
    })
    if (!isEditing) setIsEditing(true)
  }

  function addLine() {
    setEditingLines(prev => [...prev, {
      _tempId: 'new_' + Date.now(),
      line_type: 'labor',
      description: '',
      part_number: '',
      quantity: 1,
      unit_price: 0,
      total_price: 0,
    }])
    setIsEditing(true)
  }

  function removeLine(index: number) {
    setEditingLines(prev => prev.filter((_, i) => i !== index))
    setIsEditing(true)
  }

  async function saveLines() {
    setSaving(true)
    try {
      const soId = invoice.service_orders?.id
      if (!soId) { alert('No service order linked'); setSaving(false); return }

      const originalLines: any[] = invoice.so_lines || []
      const originalIds = new Set(originalLines.map((l: any) => l.id))
      const editedIds = new Set(editingLines.filter(l => l.id).map(l => l.id))

      // PATCH existing lines — only update invoice-editable fields
      for (const line of editingLines) {
        if (line.id && originalIds.has(line.id)) {
          await fetch(`/api/so-lines/${line.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              description: line.description,
              part_number: line.part_number || null,
              quantity: line.quantity,
              unit_price: line.unit_price,
              total_price: line.total_price,
            }),
          })
        }
      }

      // INSERT new lines (those with _tempId, no existing id)
      for (const line of editingLines) {
        if (line._tempId && !line.id) {
          await fetch('/api/so-lines', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              so_id: soId,
              line_type: line.line_type,
              description: line.description,
              part_number: line.part_number || null,
              quantity: line.quantity,
              unit_price: line.unit_price,
              total_price: line.total_price,
            }),
          })
        }
      }

      // DELETE removed lines (existed in original but not in editing)
      for (const origId of originalIds) {
        if (!editedIds.has(origId)) {
          await fetch(`/api/so-lines/${origId}`, { method: 'DELETE' })
        }
      }

      // Recalculate totals
      const totals = recalcTotals(editingLines)
      await fetch(`/api/invoices/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(totals),
      })

      // Refresh
      const refreshRes = await fetch(`/api/invoices/${params.id}`)
      if (refreshRes.ok) {
        const refreshed = await refreshRes.json()
        if (refreshed && !refreshed.error) {
          refreshed.so_lines = refreshed.service_orders?.so_lines || []
          setInvoice(refreshed)
          setEditingLines((refreshed.so_lines || []).map((l: any) => ({ ...l })))
        }
      }
      setIsEditing(false)
    } catch (err) {
      console.error('Save error', err)
      alert('Failed to save changes')
    }
    setSaving(false)
  }

  async function recordPayment() {
    const amt = parseFloat(paymentAmount) || invoice?.balance_due || invoice?.total || 0
    if (amt <= 0) { alert('Enter a valid amount'); return }
    setMarkingPaid(true)
    try {
      const res = await fetch('/api/invoice-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: params.id,
          payment_method: paymentMethod,
          amount: amt,
          reference_number: paymentRef || null,
          received_at: paymentDate ? paymentDate + 'T12:00:00Z' : null,
          notes: paymentNotes || null,
        }),
      })
      if (res.ok) {
        const result = await res.json()
        setInvoice((i: any) => ({
          ...i,
          status: result.status,
          payment_method: paymentMethod,
          paid_at: result.status === 'paid' ? new Date().toISOString() : i.paid_at,
          amount_paid: result.total_paid,
          balance_due: result.balance_due,
        }))
        // Reload payments
        const payRes = await fetch(`/api/invoice-payments?invoice_id=${params.id}`)
        if (payRes.ok) setPayments(await payRes.json())
        setShowPaidModal(false)
        setPaymentAmount(''); setPaymentRef(''); setPaymentNotes('')
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to record payment')
      }
    } catch {
      alert('Failed to record payment')
    }
    setMarkingPaid(false)
  }

  const S: Record<string, React.CSSProperties> = {
    page:   { background:'#060708', minHeight:'100vh', color:'#DDE3EE', fontFamily:"'Inter', -apple-system, sans-serif", padding:24 },
    card:   { background:'#161B24', border:'1px solid rgba(255,255,255,.055)', borderRadius:12, padding:16, marginBottom:12 },
    label:  { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, letterSpacing:'.1em', textTransform:'uppercase' as const, color:'#48536A', marginBottom:5, display:'block' },
    th:     { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:'#48536A', textTransform:'uppercase' as const, letterSpacing:'.08em', padding:'7px 10px', textAlign:'left' as const, background:'#0B0D11' },
    td:     { padding:'9px 10px', borderBottom:'1px solid rgba(255,255,255,.025)', fontSize:12 },
    btn:    { padding:'9px 18px', borderRadius:8, border:'none', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
    input:  { background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:4, color:'#DDE3EE', padding:'4px 8px', fontSize:11, fontFamily:'inherit', outline:'none', width:'100%' },
  }

  if (loading) return <div style={{ ...S.page, color:'#7C8BA0', padding:60 }}>Loading...</div>

  const so     = invoice.service_orders
  const asset  = so?.assets
  const cust   = invoice.customers
  const tech   = so?.users
  const lines  = isDraft && isEditing ? editingLines : (invoice.so_lines || [])
  const isPaid = invoice.status === 'paid'

  const laborLines  = lines.filter((l: any) => l.line_type === 'labor')
  const partLines   = lines.filter((l: any) => l.line_type === 'part')
  const otherLines  = lines.filter((l: any) => !['labor','part'].includes(l.line_type))

  // Live recalc for editing mode
  const liveTotals = isDraft && isEditing ? recalcTotals(editingLines) : null
  const displaySubtotal  = liveTotals ? liveTotals.subtotal  : (invoice.subtotal || 0)
  const displayTax       = liveTotals ? liveTotals.tax_amount : (invoice.tax_amount || 0)
  const displayTotal     = liveTotals ? liveTotals.total      : (invoice.total || 0)
  const displayBalance   = liveTotals ? liveTotals.balance_due : (invoice.balance_due || 0)
  const displayPaid      = invoice.amount_paid || 0

  const statusColor: Record<string, string> = { draft:'#7C8BA0', sent:'#4D9EFF', paid:'#1DB870', voided:'#48536A' }
  const stColor = statusColor[invoice.status] || '#7C8BA0'

  function editableCell(lineIndex: number, field: keyof LineItem, value: any, type: 'text' | 'number' = 'text') {
    if (!isDraft) return <span>{type === 'number' ? (typeof value === 'number' ? value.toFixed(field === 'quantity' ? 0 : 2) : value) : value}</span>
    const cellKey = `${lineIndex}-${field}`
    const isActive = editingCell === cellKey
    return (
      <div
        onClick={(e) => { e.stopPropagation(); setEditingCell(cellKey) }}
        style={{ cursor: 'text', minWidth: type === 'number' ? 60 : 100, padding: '2px 0' }}
      >
        {isActive ? (
          <input
            autoFocus
            type={type}
            value={value}
            onChange={(e) => handleLineChange(lineIndex, field, type === 'number' ? e.target.value : e.target.value)}
            onBlur={() => setEditingCell(null)}
            onKeyDown={(e) => { if (e.key === 'Enter') setEditingCell(null) }}
            style={{ ...S.input, width: type === 'number' ? 70 : '100%' }}
            step={field === 'quantity' ? '1' : '0.01'}
          />
        ) : (
          <span style={{ borderBottom: '1px dashed rgba(255,255,255,.15)', paddingBottom: 1 }}>
            {type === 'number' ? (typeof value === 'number' ? (field === 'quantity' ? value : value.toFixed(2)) : value) : (value || '(click to edit)')}
          </span>
        )}
      </div>
    )
  }

  function lineSection(title: string, color: string, items: any[], globalOffset: number) {
    if (!items.length) return null
    return (
      <>
        <tr><td colSpan={isDraft ? 6 : 5} style={{ padding:'6px 10px', fontFamily:'monospace', fontSize:8, color, textTransform:'uppercase', letterSpacing:'.1em', background:'rgba(255,255,255,.02)', borderBottom:'1px solid rgba(255,255,255,.04)' }}>{title}</td></tr>
        {items.map((l: any, localIdx: number) => {
          const globalIdx = lines.indexOf(l)
          return (
            <tr key={l.id || l._tempId || localIdx}>
              <td style={S.td}>{editableCell(globalIdx, 'description', l.real_name || l.description)}</td>
              <td style={{ ...S.td, fontFamily:'monospace', fontSize:10, color:'#48536A' }}>{l.part_number || '—'}</td>
              <td style={{ ...S.td, fontFamily:'monospace', textAlign:'center' }}>{editableCell(globalIdx, 'quantity', l.quantity, 'number')}</td>
              <td style={{ ...S.td, fontFamily:'monospace', color:'#7C8BA0' }}>
                {isDraft ? editableCell(globalIdx, 'unit_price', l.parts_sell_price || l.unit_price || 0, 'number') : '$' + (l.parts_sell_price || l.unit_price || 0).toFixed(2)}
              </td>
              <td style={{ ...S.td, fontFamily:'monospace', fontWeight:700, color: color }}>${(l.total_price || (l.parts_sell_price || l.unit_price || 0) * (l.quantity || 1)).toFixed(2)}</td>
              {isDraft && (
                <td style={{ ...S.td, textAlign:'center' }}>
                  <button
                    onClick={() => removeLine(globalIdx)}
                    style={{ background:'none', border:'none', color:'#D94F4F', cursor:'pointer', fontSize:14, fontFamily:'inherit', padding:'2px 6px' }}
                    title="Remove line"
                  >x</button>
                </td>
              )}
            </tr>
          )
        })}
      </>
    )
  }

  return (
    <div style={S.page}>
      {/* Record Payment Modal */}
      {showPaidModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'#1C2130', border:'1px solid rgba(255,255,255,.1)', borderRadius:14, padding:28, minWidth:380, maxWidth:440 }}>
            <div style={{ fontSize:16, fontWeight:700, color:'#F0F4FF', marginBottom:4 }}>Record Payment</div>
            <div style={{ fontSize:12, color:'#7C8BA0', marginBottom:20 }}>
              Invoice Total: ${(invoice.total || 0).toFixed(2)} | Balance Due: ${(invoice.balance_due ?? invoice.total ?? 0).toFixed(2)}
            </div>
            <label style={{ ...S.label, marginBottom:4 }}>Payment Method</label>
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} style={{ width:'100%', padding:'8px 10px', background:'#0D0F12', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, color:'#DDE3EE', fontSize:13, marginBottom:12, fontFamily:'inherit' }}>
              {['cash', 'zelle', 'card', 'bank_transfer', 'check', 'ach', 'other'].map(m => (
                <option key={m} value={m}>{m.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
              ))}
            </select>
            <label style={{ ...S.label, marginBottom:4 }}>Amount</label>
            <input type="number" step="0.01" value={paymentAmount || (invoice.balance_due ?? invoice.total ?? 0)} onChange={e => setPaymentAmount(e.target.value)} style={{ width:'100%', padding:'8px 10px', background:'#0D0F12', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, color:'#DDE3EE', fontSize:14, fontFamily:"'IBM Plex Mono',monospace", marginBottom:12, boxSizing:'border-box' }} />
            <label style={{ ...S.label, marginBottom:4 }}>Reference # (optional)</label>
            <input value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder="Check #, Zelle ID, etc." style={{ width:'100%', padding:'8px 10px', background:'#0D0F12', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, color:'#DDE3EE', fontSize:12, marginBottom:12, fontFamily:'inherit', boxSizing:'border-box' }} />
            <label style={{ ...S.label, marginBottom:4 }}>Date Received</label>
            <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} style={{ width:'100%', padding:'8px 10px', background:'#0D0F12', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, color:'#DDE3EE', fontSize:12, marginBottom:12, fontFamily:'inherit', boxSizing:'border-box' }} />
            <label style={{ ...S.label, marginBottom:4 }}>Notes (optional)</label>
            <textarea value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} rows={2} style={{ width:'100%', padding:'8px 10px', background:'#0D0F12', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, color:'#DDE3EE', fontSize:12, marginBottom:16, fontFamily:'inherit', resize:'vertical', boxSizing:'border-box' }} />
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setShowPaidModal(false)} style={{ ...S.btn, background:'transparent', color:'#7C8BA0', border:'1px solid rgba(255,255,255,.1)' }}>Cancel</button>
              <button onClick={recordPayment} disabled={markingPaid} style={{ ...S.btn, background:'linear-gradient(135deg,#1DB870,#15955a)', color:'#fff' }}>
                {markingPaid ? 'Saving...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      <a href="/invoices" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 14, fontWeight: 700, color: '#EDEDF0', textDecoration: 'none', marginBottom: 20 }}>
  <ChevronLeft size={16} strokeWidth={2} /> Invoices
</a>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:12, color:'#4D9EFF', fontWeight:700, marginBottom:4 }}>{invoice.invoice_number}</div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:26, color:'#F0F4FF' }}>{cust?.company_name || '—'}</div>
          <div style={{ fontSize:12, color:'#7C8BA0', marginTop:4 }}>
            {asset?.unit_number ? `Unit #${asset.unit_number}` : ''}{asset?.unit_number && so?.so_number ? ' · ' : ''}{so?.so_number || ''}
          </div>
          {so?.is_historical && (
            <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 4, background: 'rgba(124,139,160,0.1)', color: '#7C8BA0', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', fontFamily: "'IBM Plex Mono', monospace" }}>Historical — {so.source === 'fullbay' ? 'Fullbay' : 'Imported'}</span>
          )}
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8 }}>
          <span style={{ padding:'4px 12px', borderRadius:100, fontFamily:'monospace', fontSize:9, background:stColor+'18', color:stColor, border:`1px solid ${stColor}33` }}>
            {(invoice.status || 'unknown').toUpperCase()}
          </span>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:32, color: isPaid?'#1DB870':'#4D9EFF' }}>
            ${displayTotal.toFixed(2)}
          </div>
          {displayBalance > 0 && <div style={{ fontSize:12, color:'#7C8BA0' }}>Balance due: ${displayBalance.toFixed(2)}</div>}
        </div>
      </div>

      {/* Accounting safeguard warnings */}
      {checks && (checks.errors?.length > 0 || checks.warnings?.length > 0) && (
        <div style={{ background:'rgba(212,136,42,.06)', border:'1px solid rgba(212,136,42,.2)', borderRadius:10, padding:14, marginBottom:14 }}>
          {checks.errors?.map((e: string, i: number) => (
            <div key={i} style={{ display:'flex', gap:8, marginBottom:6, fontSize:12, color:'#D94F4F' }}>
              <span>x</span> {e}
            </div>
          ))}
          {checks.warnings?.map((w: string, i: number) => (
            <div key={i} style={{ display:'flex', gap:8, marginBottom:6, fontSize:12, color:'#D4882A' }}>
              <span>!</span> {w}
            </div>
          ))}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:14, alignItems:'start' }}>
        <div>
          {/* Line items */}
          <div style={S.card}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#F0F4FF' }}>Line Items</div>
              {isDraft && (
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={addLine} style={{ ...S.btn, padding:'5px 12px', background:'rgba(29,111,232,.1)', color:'#4D9EFF', border:'1px solid rgba(29,111,232,.2)', fontSize:10 }}>
                    + Add Line
                  </button>
                  {isEditing && (
                    <button onClick={saveLines} disabled={saving} style={{ ...S.btn, padding:'5px 12px', background:'linear-gradient(135deg,#1D6FE8,#1248B0)', color:'#fff', fontSize:10 }}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  )}
                </div>
              )}
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:440 }}>
                <thead><tr>
                  {['Description','Part #','Qty','Rate','Amount', ...(isDraft ? [''] : [])].map(h =>
                    <th key={h} style={S.th as any}>{h}</th>
                  )}
                </tr></thead>
                <tbody>
                  {lines.length > 0 ? (
                    <>
                      {lineSection('Labor', '#4D9EFF', laborLines, 0)}
                      {lineSection('Parts', '#1DB870', partLines, laborLines.length)}
                      {lineSection('Other', '#D4882A', otherLines, laborLines.length + partLines.length)}
                    </>
                  ) : (
                    <>
                      {/* No line items — show WO summary for Fullbay invoices */}
                      {so?.labor_total > 0 && (
                        <tr>
                          <td style={S.td}>Labor (from Work Order)</td>
                          <td style={{ ...S.td, color: '#48536A' }}>—</td>
                          <td style={{ ...S.td, textAlign: 'center' }}>—</td>
                          <td style={{ ...S.td, color: '#7C8BA0' }}>—</td>
                          <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 700, color: '#4D9EFF' }}>${(so.labor_total || 0).toFixed(2)}</td>
                        </tr>
                      )}
                      {so?.parts_total > 0 && (
                        <tr>
                          <td style={S.td}>Parts (from Work Order)</td>
                          <td style={{ ...S.td, color: '#48536A' }}>—</td>
                          <td style={{ ...S.td, textAlign: 'center' }}>—</td>
                          <td style={{ ...S.td, color: '#7C8BA0' }}>—</td>
                          <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 700, color: '#1DB870' }}>${(so.parts_total || 0).toFixed(2)}</td>
                        </tr>
                      )}
                      {lines.length === 0 && !so?.labor_total && !so?.parts_total && (
                        <tr>
                          <td colSpan={5} style={{ ...S.td, textAlign: 'center', color: '#7C8BA0', padding: 24, fontSize: 12 }}>
                            Invoice generated from Fullbay WO — <a href={`/work-orders/${so?.id}`} style={{ color: '#4D9EFF', textDecoration: 'none' }}>see Work Order for details</a>
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
            {/* Totals */}
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, paddingTop:12, marginTop:8, borderTop:'1px solid rgba(255,255,255,.06)' }}>
              {[
                { label:'Subtotal', val: displaySubtotal, color:'#DDE3EE' },
                { label:'Tax',      val: displayTax, color:'#DDE3EE' },
                ...(displayPaid > 0 ? [{ label:'Amount Paid', val: -displayPaid, color:'#1DB870' }] : []),
              ].map(r => (
                <div key={r.label} style={{ display:'flex', gap:40 }}>
                  <span style={{ fontSize:12, color:'#7C8BA0' }}>{r.label}</span>
                  <span style={{ fontFamily:'monospace', fontSize:12, color:r.color, minWidth:80, textAlign:'right' }}>{r.val < 0 ? '-' : ''}${Math.abs(r.val).toFixed(2)}</span>
                </div>
              ))}
              <div style={{ display:'flex', gap:40, paddingTop:8, marginTop:4, borderTop:'1px solid rgba(255,255,255,.08)' }}>
                <span style={{ fontSize:15, fontWeight:700, color:'#F0F4FF' }}>Total</span>
                <span style={{ fontFamily:'monospace', fontSize:18, fontWeight:700, color: isPaid?'#1DB870':'#4D9EFF', minWidth:80, textAlign:'right' }}>${displayTotal.toFixed(2)}</span>
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
                  <button style={{ ...S.btn, background:'linear-gradient(135deg,#1D6FE8,#1248B0)', color:'#fff', width:'100%' }}
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
                  <button style={{ ...S.btn, background:'rgba(29,184,112,.15)', color:'#1DB870', border:'1px solid rgba(29,184,112,.25)', width:'100%' }}
                    onClick={() => setShowPaidModal(true)}>
                    Mark as Paid
                  </button>
                  <button style={{ ...S.btn, background:'rgba(212,136,42,.08)', color:'#D4882A', border:'1px solid rgba(212,136,42,.2)', width:'100%' }}
                    onClick={runInvoiceChecks}>
                    Run Accounting Checks
                  </button>
                </>
              )}
              {isPaid && (
                <div style={{ textAlign:'center', padding:'12px 0' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#1DB870' }}>Paid</div>
                  {invoice.payment_method && <div style={{ fontSize:11, color:'#7C8BA0', marginTop:4 }}>via {invoice.payment_method}</div>}
                  {invoice.paid_at && <div style={{ fontSize:10, color:'#48536A', marginTop:4 }}>{new Date(invoice.paid_at).toLocaleDateString()}</div>}
                </div>
              )}
              <a href={`/api/invoices/${params.id}/pdf`} target="_blank" style={{ ...S.btn, background:'transparent', color:'#7C8BA0', border:'1px solid rgba(255,255,255,.08)', textDecoration:'none', textAlign:'center', display:'block' }}>
                Download PDF
              </a>
              {so?.id && (
                <a href={`/work-orders/${so.id}`} style={{ ...S.btn, background:'transparent', color:'#7C8BA0', border:'1px solid rgba(255,255,255,.08)', textDecoration:'none', textAlign:'center', display:'block' }}>
                  View Work Order
                </a>
              )}
            </div>
          </div>

          {/* Payment History */}
          {payments.length > 0 && (
            <div style={S.card}>
              <label style={S.label}>Payment History</label>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {payments.map((p: any) => (
                  <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,.03)', fontSize:12 }}>
                    <div>
                      <div style={{ color:'#DDE3EE', fontWeight:600 }}>${Number(p.amount).toFixed(2)}</div>
                      <div style={{ color:'#48536A', fontSize:10, marginTop:2 }}>{p.payment_method?.replace(/_/g,' ')} {p.reference_number ? `- ${p.reference_number}` : ''}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ color:'#7C8BA0', fontSize:10 }}>{p.received_at ? new Date(p.received_at).toLocaleDateString() : ''}</div>
                      <div style={{ color:'#48536A', fontSize:9 }}>{(p.users as any)?.full_name || ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
