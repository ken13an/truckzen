'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { PageFooter } from '@/components/ui/PageControls'
import FilterBar from '@/components/FilterBar'
import { calcInvoiceTotals } from '@/lib/invoice-calc'

const FONT = "'Inter', -apple-system, sans-serif"
const BLUE = '#1D6FE8', GREEN = '#16A34A', RED = '#DC2626', AMBER = '#D97706', GRAY = '#6B7280'

const TABS = ['Pending Review', 'Sent / Unpaid', 'Paid', 'All']

const INVOICE_STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  draft:                { label: 'Draft',            bg: '#F3F4F6', color: GRAY },
  quality_check_failed: { label: 'QC Failed',        bg: '#FEF2F2', color: RED },
  accounting_review:    { label: 'Pending Review',   bg: '#FFFBEB', color: AMBER },
  sent:                 { label: 'Sent',             bg: '#EFF6FF', color: BLUE },
  paid:                 { label: 'Paid',             bg: '#F0FDF4', color: GREEN },
  closed:               { label: 'Closed',           bg: '#F3F4F6', color: GRAY },
}

export default function AccountingPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [tab, setTab] = useState(0)
  const [wos, setWos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [acctPage, setAcctPage] = useState(1)
  const [acctPerPage, setAcctPerPage] = useState(25)
  const [reviewWo, setReviewWo] = useState<any>(null)
  const [reviewLines, setReviewLines] = useState<any[]>([])
  const [reviewAssignments, setReviewAssignments] = useState<any[]>([])
  const [reviewShop, setReviewShop] = useState<any>(null)
  const [returnNotes, setReturnNotes] = useState('')
  const [showReturnInput, setShowReturnInput] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [acctSearch, setAcctSearch] = useState('')
  const [acctDateFrom, setAcctDateFrom] = useState('')
  const [acctDateTo, setAcctDateTo] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const profile = await getCurrentUser(supabase)
    if (!profile) { window.location.href = '/login'; return }
    const allowed = ['owner', 'gm', 'it_person', 'accountant', 'office_admin', 'accounting_manager']
    const effectiveRole = profile.impersonate_role || profile.role
    if (!allowed.includes(effectiveRole) && !profile.is_platform_owner) { window.location.href = '/dashboard'; return }
    setUser(profile)

    // Direct client-side query — same auth session, no server-side API dependency
    const { data, error } = await supabase
      .from('service_orders')
      .select('id, so_number, status, invoice_status, complaint, grand_total, created_at, updated_at, accounting_notes, accounting_approved_at, accounting_approved_by, invoices(id, invoice_number), customers(id, company_name, contact_name), assets(id, unit_number, year, make, model)')
      .eq('shop_id', profile.shop_id)
      .is('deleted_at', null)
      .neq('status', 'void')
      .not('so_number', 'like', 'DRAFT-%')
      .neq('is_historical', true)
      .neq('source', 'fullbay')
      .in('invoice_status', ['accounting_review', 'pending_accounting', 'sent', 'paid', 'closed', 'quality_check_failed'])
      .order('updated_at', { ascending: false })
      .limit(200)

    setWos(error ? [] : (data || []))
    setLoading(false)
  }

  async function openReview(wo: any) {
    // Fetch full WO detail for review
    const res = await fetch(`/api/work-orders/${wo.id}`)
    if (!res.ok) return
    const data = await res.json()
    setReviewWo(data)
    setReviewLines(data.so_lines || [])
    setReviewAssignments(data.jobAssignments || [])
    setReviewShop(data.shop || {})
    setShowReturnInput(false)
    setReturnNotes('')
  }

  async function handleApprove() {
    if (!reviewWo || !user) return
    if (!confirm('Approve this invoice and send to customer?')) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/accounting/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wo_id: reviewWo.id, action: 'approve', user_id: user.id }),
      })
      if (res.ok) {
        setReviewWo(null)
        await loadData()
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to approve')
      }
    } catch { alert('Failed to approve') }
    setActionLoading(false)
  }

  async function handleReturn() {
    if (!reviewWo || !user || !returnNotes.trim()) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/accounting/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wo_id: reviewWo.id, action: 'return', user_id: user.id, notes: returnNotes.trim() }),
      })
      if (res.ok) {
        setReviewWo(null)
        await loadData()
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to return')
      }
    } catch { alert('Failed to return') }
    setActionLoading(false)
  }

  const filteredWos = useMemo(() => {
    let list = wos.filter(wo => {
      if (tab === 0) return ['accounting_review', 'pending_accounting', 'quality_check_failed'].includes(wo.invoice_status)
      if (tab === 1) return wo.invoice_status === 'sent'
      if (tab === 2) return ['paid', 'closed'].includes(wo.invoice_status)
      return true
    })
    if (acctSearch.trim()) {
      const q = acctSearch.toLowerCase()
      list = list.filter(wo => {
        const cust = wo.customers as any
        return wo.so_number?.toLowerCase().includes(q) ||
          cust?.company_name?.toLowerCase().includes(q) ||
          (wo.assets as any)?.unit_number?.toLowerCase().includes(q)
      })
    }
    if (acctDateFrom) {
      const from = new Date(acctDateFrom)
      list = list.filter(wo => (wo.created_at || wo.updated_at) && new Date(wo.created_at || wo.updated_at) >= from)
    }
    if (acctDateTo) {
      const to = new Date(acctDateTo + 'T23:59:59')
      list = list.filter(wo => (wo.created_at || wo.updated_at) && new Date(wo.created_at || wo.updated_at) <= to)
    }
    return list
  }, [wos, tab, acctSearch, acctDateFrom, acctDateTo])

  const paginatedWos = useMemo(() => {
    if (acctPerPage === 0) return filteredWos
    const start = (acctPage - 1) * acctPerPage
    return filteredWos.slice(start, start + acctPerPage)
  }, [filteredWos, acctPage, acctPerPage])

  const fmt = (n: number) => '$' + (n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const fmtDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
    catch { return d }
  }

  const S = {
    page: { fontFamily: FONT, background: '#0C0C12', minHeight: '100vh', color: '#EDEDF0', padding: 24 } as React.CSSProperties,
    card: { background: '#151520', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 16, marginBottom: 12 } as React.CSSProperties,
    label: { fontSize: 10, fontWeight: 700, color: '#9D9DA1', textTransform: 'uppercase' as const, letterSpacing: '.04em' } as React.CSSProperties,
    pill: (bg: string, color: string): React.CSSProperties => ({ display: 'inline-flex', padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: bg, color }),
    btn: (bg: string, color: string, outline?: boolean): React.CSSProperties => ({
      padding: '9px 20px', background: outline ? 'transparent' : bg, color,
      border: outline ? `1px solid ${color}` : 'none',
      borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
    }),
    input: { width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 13, color: '#EDEDF0', outline: 'none', fontFamily: FONT, boxSizing: 'border-box' as const, minHeight: 80, resize: 'vertical' as const } as React.CSSProperties,
  }

  if (loading) {
    return <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><div style={{ color: '#9D9DA1' }}>Loading...</div></div>
  }

  // Review detail view
  if (reviewWo) {
    const laborRate = reviewShop?.labor_rate || reviewShop?.default_labor_rate || 125
    const taxRate = reviewShop?.tax_rate || 0
    const laborLines = reviewLines.filter((l: any) => l.line_type === 'labor')
    const partLines = reviewLines.filter((l: any) => l.line_type === 'part' && l.parts_status !== 'canceled')
    const invCalc = calcInvoiceTotals(reviewLines, laborRate, taxRate, !!reviewShop?.tax_labor)
    const { laborTotal, partsTotal } = invCalc

    const saveLine = async (lineId: string, data: Record<string, any>) => {
      const res = await fetch(`/api/so-lines/${lineId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (res.ok) {
        // Refresh review data
        const refreshRes = await fetch(`/api/work-orders/${reviewWo.id}`)
        if (refreshRes.ok) {
          const d = await refreshRes.json()
          setReviewWo(d)
          setReviewLines(d.so_lines || [])
        }
      } else { alert('Failed to save') }
    }
    const { subtotal, taxAmount: taxAmt, grandTotal: total } = invCalc

    return (
      <div style={S.page}>
        <button onClick={() => setReviewWo(null)} style={{ background: 'none', border: 'none', color: '#9D9DA1', fontSize: 13, cursor: 'pointer', marginBottom: 20, fontFamily: FONT }}>&larr; Back to Accounting</button>

        {/* Invoice header + status + actions */}
        <div style={{ ...S.card, marginBottom: 16, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 22, fontWeight: 800 }}>WO-{reviewWo.so_number || reviewWo.id?.slice(0, 6)}</span>
              {reviewWo.invoices?.[0]?.invoice_number && <span style={{ fontSize: 13, color: '#9D9DA1' }}>{reviewWo.invoices[0].invoice_number}</span>}
              {(() => { const st = INVOICE_STATUS_MAP[reviewWo.invoice_status] || INVOICE_STATUS_MAP.draft; return <span style={S.pill(st.bg, st.color)}>{st.label}</span> })()}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {reviewWo.invoices?.[0]?.id && (
                <>
                  <a href={`/invoices/${reviewWo.invoices[0].id}`} target="_blank" rel="noopener" style={{ ...S.btn(BLUE, '#fff'), textDecoration: 'none', fontSize: 12, padding: '6px 14px' }}>Preview Invoice</a>
                  <a href={`/api/invoices/${reviewWo.invoices[0].id}/pdf`} target="_blank" rel="noopener" style={{ ...S.btn('transparent', '#9D9DA1', true), textDecoration: 'none', fontSize: 12, padding: '6px 14px' }}>Download PDF</a>
                </>
              )}
            </div>
          </div>
          {/* Summary strip */}
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13 }}>
            <div><span style={{ color: '#9D9DA1' }}>Total: </span><strong style={{ fontSize: 16 }}>{fmt(total)}</strong></div>
            {reviewWo.invoices?.[0] && (reviewWo.invoices[0].amount_paid || 0) > 0 && (
              <div><span style={{ color: '#9D9DA1' }}>Paid: </span><strong style={{ color: GREEN }}>{fmt(reviewWo.invoices[0].amount_paid)}</strong></div>
            )}
            {reviewWo.invoices?.[0] && (
              <div><span style={{ color: '#9D9DA1' }}>Balance: </span><strong style={{ color: (reviewWo.invoices[0].balance_due ?? total) > 0 ? RED : GREEN }}>{fmt(reviewWo.invoices[0].balance_due ?? total)}</strong></div>
            )}
            {(reviewWo.invoices?.[0]?.due_date || (reviewWo.customers as any)?.payment_terms) && (
              <div style={{ color: '#9D9DA1' }}>
                {reviewWo.invoices?.[0]?.due_date && <>Due: {reviewWo.invoices[0].due_date}</>}
                {(reviewWo.customers as any)?.payment_terms && <> · {(reviewWo.customers as any).payment_terms}</>}
              </div>
            )}
          </div>
          {/* Editable vs locked warning */}
          {['sent', 'paid', 'closed'].includes(reviewWo.invoice_status) && (
            <div style={{ marginTop: 8, fontSize: 11, color: AMBER, fontWeight: 600 }}>Invoice has been sent to customer — editing locked</div>
          )}
        </div>

        {/* Bill To + Remit To + Vehicle + Details */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div style={S.card}>
            <div style={S.label}>Bill To</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{(reviewWo.customers as any)?.company_name || 'N/A'}</div>
            {(reviewWo.customers as any)?.contact_name && <div style={{ fontSize: 11, color: '#9D9DA1', marginTop: 2 }}>{(reviewWo.customers as any).contact_name}</div>}
            {(reviewWo.customers as any)?.address && <div style={{ fontSize: 10, color: '#9D9DA1' }}>{(reviewWo.customers as any).address}</div>}
            {(reviewWo.customers as any)?.phone && <div style={{ fontSize: 10, color: '#9D9DA1' }}>{(reviewWo.customers as any).phone}</div>}
          </div>
          <div style={S.card}>
            <div style={S.label}>Remit Payment To</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{reviewShop?.dba || reviewShop?.name || 'Shop'}</div>
            {reviewShop?.address && <div style={{ fontSize: 10, color: '#9D9DA1', marginTop: 2 }}>{reviewShop.address}</div>}
            {[reviewShop?.city, reviewShop?.state, reviewShop?.zip].filter(Boolean).join(', ') && <div style={{ fontSize: 10, color: '#9D9DA1' }}>{[reviewShop.city, reviewShop.state, reviewShop.zip].filter(Boolean).join(', ')}</div>}
            {reviewShop?.phone && <div style={{ fontSize: 10, color: '#9D9DA1' }}>{reviewShop.phone}</div>}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div style={S.card}>
            <div style={S.label}>Vehicle</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
              {(reviewWo.assets as any)?.unit_number ? `#${(reviewWo.assets as any).unit_number}` : 'N/A'}
              {' '}{[(reviewWo.assets as any)?.year, (reviewWo.assets as any)?.make, (reviewWo.assets as any)?.model].filter(Boolean).join(' ')}
            </div>
            {(reviewWo.assets as any)?.vin && <div style={{ fontSize: 10, color: '#9D9DA1', marginTop: 2 }}>VIN: {(reviewWo.assets as any).vin}</div>}
            {(reviewWo.mileage_at_service || (reviewWo.assets as any)?.odometer) && <div style={{ fontSize: 10, color: '#9D9DA1' }}>Mileage: {Number(reviewWo.mileage_at_service || (reviewWo.assets as any)?.odometer).toLocaleString()}</div>}
          </div>
          <div style={S.card}>
            <div style={S.label}>Details</div>
            <div style={{ fontSize: 11, color: '#EDEDF0', marginTop: 4, lineHeight: 1.6 }}>
              {reviewWo.invoices?.[0]?.invoice_number && <div>Invoice: <strong>{reviewWo.invoices[0].invoice_number}</strong></div>}
              {reviewWo.invoices?.[0]?.due_date && <div>Due: {reviewWo.invoices[0].due_date}</div>}
              {(reviewWo.customers as any)?.payment_terms && <div>Terms: {(reviewWo.customers as any).payment_terms}</div>}
              {reviewWo.service_writer_name && <div>Service Writer: {reviewWo.service_writer_name}</div>}
              {reviewWo.createdByName && <div>Created By: {reviewWo.createdByName}</div>}
            </div>
          </div>
        </div>

        {/* Complaint / work context */}
        {(reviewWo.complaint || reviewWo.cause || reviewWo.correction) && (
          <div style={{ ...S.card, marginBottom: 12, fontSize: 12 }}>
            {reviewWo.complaint && <div style={{ marginBottom: 4 }}><span style={{ color: '#9D9DA1' }}>Complaint:</span> {reviewWo.complaint}</div>}
            {reviewWo.cause && <div style={{ marginBottom: 4 }}><span style={{ color: '#9D9DA1' }}>Cause:</span> {reviewWo.cause}</div>}
            {reviewWo.correction && <div><span style={{ color: '#9D9DA1' }}>Correction:</span> {reviewWo.correction}</div>}
          </div>
        )}

        {/* Labor Lines */}
        <div style={{ ...S.card, marginBottom: 12 }}>
          <div style={{ ...S.label, marginBottom: 10 }}>Labor / Jobs</div>
          {laborLines.length === 0 && <div style={{ color: '#9D9DA1', fontSize: 13 }}>No labor lines</div>}
          {laborLines.map((line: any) => {
            const hours = line.billed_hours || 0
            return (
              <div key={line.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{line.description}</div>
                    {line.estimated_hours > 0 && <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>Book: {line.estimated_hours}h</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10, color: '#6B7280' }}>Billed Hours</div>
                      <input type="number" step="0.25" defaultValue={hours || ''} placeholder={String(line.estimated_hours || 0)}
                        onBlur={e => { const v = parseFloat(e.target.value) || 0; if (v !== hours) saveLine(line.id, { billed_hours: v }) }}
                        style={{ width: 60, textAlign: 'center', padding: '3px 6px', border: '1px solid rgba(255,255,255,.12)', borderRadius: 4, background: 'rgba(255,255,255,.04)', color: '#DDE3EE', fontSize: 13, fontFamily: 'inherit' }} />
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 70 }}>
                      <div style={{ fontSize: 10, color: '#6B7280' }}>@ {fmt(laborRate)}/hr</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#DDE3EE' }}>{fmt(hours * laborRate)}</div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Part Lines */}
        <div style={{ ...S.card, marginBottom: 12 }}>
          <div style={{ ...S.label, marginBottom: 10 }}>Parts</div>
          {partLines.length === 0 && <div style={{ color: '#9D9DA1', fontSize: 13 }}>No part lines</div>}
          {partLines.map((line: any) => {
            const partName = line.real_name || line.description || line.rough_name || '—'
            const sellPrice = line.parts_sell_price || line.unit_price || 0
            const qty = line.quantity || 1
            const lineTotal = line.total_price || sellPrice * qty
            return (
            <div key={line.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{partName}</div>
                {line.part_number && <div style={{ fontSize: 11, color: '#9D9DA1' }}>PN: {line.part_number}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: '#6B7280' }}>Qty</div>
                  <input type="number" defaultValue={qty} min={1}
                    onBlur={e => { const v = parseInt(e.target.value) || 1; if (v !== qty) saveLine(line.id, { quantity: v }) }}
                    style={{ width: 40, textAlign: 'center', padding: '3px 4px', border: '1px solid rgba(255,255,255,.12)', borderRadius: 4, background: 'rgba(255,255,255,.04)', color: '#DDE3EE', fontSize: 12, fontFamily: 'inherit' }} />
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: '#6B7280' }}>Sell $</div>
                  <input type="number" step="0.01" defaultValue={sellPrice || ''}
                    onBlur={e => { const v = parseFloat(e.target.value) || 0; if (v !== sellPrice) saveLine(line.id, { parts_sell_price: v }) }}
                    style={{ width: 65, textAlign: 'right', padding: '3px 4px', border: '1px solid rgba(255,255,255,.12)', borderRadius: 4, background: 'rgba(255,255,255,.04)', color: '#DDE3EE', fontSize: 12, fontFamily: 'inherit' }} />
                </div>
                <div style={{ textAlign: 'right', minWidth: 60 }}>
                  <div style={{ fontSize: 10, color: '#6B7280' }}>Total</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{fmt(lineTotal)}</div>
                </div>
              </div>
            </div>
          )})}
        </div>

        {/* Totals — accounting-grade */}
        <div style={{ ...S.card, marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9D9DA1', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Invoice Summary</div>
          {[
            { label: 'Labor', value: laborTotal },
            { label: 'Parts', value: partsTotal },
            ...(invCalc.chargesTotal > 0 ? [{ label: 'Shop Charges', value: invCalc.chargesTotal }] : []),
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
              <span style={{ color: '#9D9DA1' }}>{r.label}</span><span>{fmt(r.value)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderTop: '1px solid rgba(255,255,255,.08)', marginTop: 4 }}>
            <span style={{ color: '#9D9DA1' }}>Subtotal</span><span>{fmt(subtotal)}</span>
          </div>
          {taxAmt > 0 ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
              <span style={{ color: '#9D9DA1' }}>Tax ({taxRate}%{reviewShop?.tax_labor ? ' incl. labor' : ' parts only'})</span><span>{fmt(taxAmt)}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 12, color: '#6B7280' }}>
              <span>Tax</span><span>Exempt</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 16, fontWeight: 800, borderTop: '1px solid rgba(255,255,255,.12)', marginTop: 4 }}>
            <span>Invoice Total</span><span>{fmt(total)}</span>
          </div>
          {/* Payments & Balance — always show for sent/paid */}
          {(() => {
            const inv = reviewWo.invoices?.[0]
            const paid = inv?.amount_paid || 0
            const balance = inv?.balance_due ?? total
            return (
              <>
                {paid > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, color: GREEN }}>
                    <span>Payments & Credits</span><span>-{fmt(paid)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14, fontWeight: 700, color: balance > 0 ? '#EDEDF0' : GREEN, borderTop: paid > 0 ? '1px solid rgba(255,255,255,.08)' : 'none' }}>
                  <span>Balance Due</span><span>{fmt(Math.max(0, balance))}</span>
                </div>
              </>
            )
          })()}
        </div>

        {/* Action Buttons */}
        {/* Pending Review actions */}
        {['accounting_review', 'pending_accounting', 'quality_check_failed'].includes(reviewWo.invoice_status) && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={handleApprove} disabled={actionLoading} style={{ ...S.btn(GREEN, '#fff'), opacity: actionLoading ? 0.5 : 1 }}>
              {actionLoading ? 'Processing...' : 'Approve & Send to Customer'}
            </button>
            {!showReturnInput ? (
              <button onClick={() => setShowReturnInput(true)} style={S.btn('transparent', RED, true)}>
                Return to Writer
              </button>
            ) : (
              <div style={{ flex: '1 1 100%' }}>
                <textarea
                  value={returnNotes}
                  onChange={e => setReturnNotes(e.target.value)}
                  placeholder="Reason for returning (required)..."
                  style={S.input}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={handleReturn} disabled={actionLoading || !returnNotes.trim()} style={{ ...S.btn(RED, '#fff'), opacity: actionLoading || !returnNotes.trim() ? 0.5 : 1 }}>
                    {actionLoading ? 'Returning...' : 'Confirm Return'}
                  </button>
                  <button onClick={() => { setShowReturnInput(false); setReturnNotes('') }} style={S.btn('transparent', '#9D9DA1', true)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
        {/* Sent / Unpaid actions */}
        {reviewWo.invoice_status === 'sent' && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={async () => {
              if (!confirm('Mark this invoice as paid?')) return
              setActionLoading(true)
              try {
                const res = await fetch(`/api/work-orders/${reviewWo.id}/invoice`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'mark_paid' }),
                })
                if (res.ok) { setReviewWo(null); await loadData() }
                else { const err = await res.json(); alert(err.error || 'Failed') }
              } catch { alert('Failed') }
              setActionLoading(false)
            }} disabled={actionLoading} style={{ ...S.btn(GREEN, '#fff'), opacity: actionLoading ? 0.5 : 1 }}>
              {actionLoading ? 'Processing...' : 'Mark as Paid'}
            </button>
          </div>
        )}
      </div>
    )
  }

  // Main list view
  return (
    <div style={S.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>Invoice Review Queue</div>
          <div style={{ fontSize: 12, color: '#9D9DA1', marginTop: 4 }}>
            {wos.length > 0 ? `${wos.length} work order${wos.length !== 1 ? 's' : ''} in queue` : 'No work orders in accounting queue'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,.08)', marginBottom: 20 }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            padding: '10px 20px', background: 'transparent', border: 'none',
            borderBottom: tab === i ? `2px solid ${BLUE}` : '2px solid transparent',
            color: tab === i ? '#EDEDF0' : '#9D9DA1', fontWeight: tab === i ? 700 : 500,
            fontSize: 13, cursor: 'pointer', fontFamily: FONT,
          }}>
            {t}
            {i === 0 && (() => { const c = wos.filter(w => ['accounting_review', 'pending_accounting', 'quality_check_failed'].includes(w.invoice_status)).length; return c > 0 ? ` (${c})` : '' })()}
          </button>
        ))}
      </div>

      {/* FilterBar */}
      <FilterBar
        search={acctSearch}
        onSearchChange={val => { setAcctSearch(val); setAcctPage(1) }}
        searchPlaceholder="Search WO #, customer, unit..."
        dateFrom={acctDateFrom}
        dateTo={acctDateTo}
        onDateFromChange={val => { setAcctDateFrom(val); setAcctPage(1) }}
        onDateToChange={val => { setAcctDateTo(val); setAcctPage(1) }}
        theme="dark"
      />

      {/* WO Cards */}
      {filteredWos.length === 0 && (
        <div style={{ ...S.card, textAlign: 'center', color: '#9D9DA1', padding: 40 }}>
          {acctSearch || acctDateFrom || acctDateTo ? 'No results found. Try adjusting your filters.' : tab === 0 ? 'No work orders pending review' : tab === 1 ? 'No approved invoices' : 'No work orders found'}
        </div>
      )}
      {paginatedWos.map(wo => {
        const st = INVOICE_STATUS_MAP[wo.invoice_status] || INVOICE_STATUS_MAP.draft
        const customer = wo.customers as any
        const asset = wo.assets as any
        return (
          <div key={wo.id} style={{ ...S.card, cursor: 'pointer' }} onClick={() => openReview(wo)}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,.15)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,.08)')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>WO-{wo.so_number}</span>
                  <span style={S.pill(st.bg, st.color)}>{st.label}</span>
                </div>
                <div style={{ fontSize: 13, color: '#EDEDF0' }}>{customer?.company_name || 'No customer'}</div>
                {asset && <div style={{ fontSize: 12, color: '#9D9DA1', marginTop: 2 }}>Unit #{asset.unit_number} {[asset.year, asset.make, asset.model].filter(Boolean).join(' ')}</div>}
                {wo.accounting_notes && <div style={{ fontSize: 12, color: AMBER, marginTop: 4 }}>Notes: {wo.accounting_notes}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{fmt(wo.grand_total || 0)}</div>
                <div style={{ fontSize: 11, color: '#9D9DA1', marginTop: 2 }}>{fmtDate(wo.updated_at || wo.created_at)}</div>
              </div>
            </div>
            {wo.invoice_status === 'accounting_review' && (
              <div style={{ marginTop: 10 }}>
                <button style={{ ...S.btn(BLUE, '#fff'), fontSize: 12, padding: '6px 14px' }}>Review</button>
              </div>
            )}
          </div>
        )
      })}
      <PageFooter total={filteredWos.length} page={acctPage} perPage={acctPerPage} onPageChange={setAcctPage} onPerPageChange={setAcctPerPage} />
    </div>
  )
}
