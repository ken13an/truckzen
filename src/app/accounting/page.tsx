'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { PageFooter } from '@/components/ui/PageControls'

const FONT = "'Inter', -apple-system, sans-serif"
const BLUE = '#1D6FE8', GREEN = '#16A34A', RED = '#DC2626', AMBER = '#D97706', GRAY = '#6B7280'

const TABS = ['Pending Review', 'Approved', 'All', 'Payroll']

const PAY_TYPE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  hourly:           { label: 'Hourly',     bg: '#EFF6FF', color: '#1D6FE8' },
  weekly_salary:    { label: 'Weekly',     bg: '#F0FDF4', color: '#16A34A' },
  biweekly_salary:  { label: 'Bi-Weekly',  bg: '#F5F3FF', color: '#7C3AED' },
  monthly_salary:   { label: 'Monthly',    bg: '#FFFBEB', color: '#D97706' },
}

function calcWeeklyCost(p: any): number {
  if (!p) return 0
  switch (p.pay_type) {
    case 'hourly': return (p.hourly_rate || 0) * (p.weekly_hours || 40)
    case 'weekly_salary': return p.salary_amount || 0
    case 'biweekly_salary': return (p.salary_amount || 0) / 2
    case 'monthly_salary': return (p.salary_amount || 0) * 12 / 52
    default: return 0
  }
}

const INVOICE_STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  draft:                { label: 'Draft',            bg: '#F3F4F6', color: GRAY },
  quality_check_failed: { label: 'QC Failed',        bg: '#FEF2F2', color: RED },
  pending_accounting:   { label: 'Pending Review',   bg: '#FFFBEB', color: AMBER },
  accounting_approved:  { label: 'Approved',          bg: '#F0FDF4', color: GREEN },
  sent_to_customer:     { label: 'Sent to Customer', bg: '#EFF6FF', color: BLUE },
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
  const [payrollData, setPayrollData] = useState<any[]>([])
  const [payrollSearch, setPayrollSearch] = useState('')
  const [payrollFilter, setPayrollFilter] = useState('all')
  const [editingPayroll, setEditingPayroll] = useState<string | null>(null)
  const [payrollForm, setPayrollForm] = useState({ pay_type: 'hourly', hourly_rate: '0', salary_amount: '0', weekly_hours: '40', effective_date: '', notes: '' })
  const [payrollSaving, setPayrollSaving] = useState(false)

  useEffect(() => { loadData() }, [])
  useEffect(() => {
    if (tab === 3 && user?.shop_id && payrollData.length === 0) {
      fetch(`/api/accounting/payroll?shop_id=${user.shop_id}`).then(r => r.json()).then(d => setPayrollData(Array.isArray(d) ? d : []))
    }
  }, [tab, user])

  async function loadData() {
    const profile = await getCurrentUser(supabase)
    if (!profile) { window.location.href = '/login'; return }
    const allowed = ['owner', 'gm', 'it_person', 'accountant', 'office_admin']
    if (!allowed.includes(profile.role)) { window.location.href = '/dashboard'; return }
    setUser(profile)

    const { data } = await supabase
      .from('service_orders')
      .select('id, so_number, status, invoice_status, complaint, grand_total, created_at, updated_at, accounting_notes, accounting_approved_at, accounting_approved_by, customers(id, company_name, contact_name), assets(id, unit_number, year, make, model)')
      .eq('shop_id', profile.shop_id)
      .is('deleted_at', null)
      .neq('status', 'void')
      .in('invoice_status', ['pending_accounting', 'accounting_approved', 'sent_to_customer', 'quality_check_failed', 'draft'])
      .order('updated_at', { ascending: false })
      .limit(200)

    setWos(data || [])
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

  const filteredWos = wos.filter(wo => {
    if (tab === 0) return wo.invoice_status === 'pending_accounting'
    if (tab === 1) return wo.invoice_status === 'accounting_approved' || wo.invoice_status === 'sent_to_customer'
    return true
  })

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
    const partLines = reviewLines.filter((l: any) => l.line_type === 'part')
    const laborTotal = laborLines.reduce((s: number, l: any) => s + (l.billed_hours || l.actual_hours || l.estimated_hours || 0) * laborRate, 0)
    const partsTotal = partLines.reduce((s: number, l: any) => s + (l.total_price || 0), 0)
    const subtotal = laborTotal + partsTotal
    const taxAmt = taxRate > 0 ? (partsTotal + (reviewShop?.tax_labor ? laborTotal : 0)) * (taxRate / 100) : 0
    const total = subtotal + taxAmt

    return (
      <div style={S.page}>
        <button onClick={() => setReviewWo(null)} style={{ background: 'none', border: 'none', color: '#9D9DA1', fontSize: 13, cursor: 'pointer', marginBottom: 20, fontFamily: FONT }}>&larr; Back to Accounting</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <span style={{ fontSize: 24, fontWeight: 800 }}>WO-{reviewWo.so_number || reviewWo.wo_number || reviewWo.id?.slice(0, 6)}</span>
          {(() => { const st = INVOICE_STATUS_MAP[reviewWo.invoice_status] || INVOICE_STATUS_MAP.draft; return <span style={S.pill(st.bg, st.color)}>{st.label}</span> })()}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div style={S.card}>
            <div style={S.label}>Customer</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{(reviewWo.customers as any)?.company_name || 'N/A'}</div>
          </div>
          <div style={S.card}>
            <div style={S.label}>Unit</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
              {(reviewWo.assets as any)?.unit_number ? `#${(reviewWo.assets as any).unit_number}` : 'N/A'}
              {' '}{[(reviewWo.assets as any)?.year, (reviewWo.assets as any)?.make, (reviewWo.assets as any)?.model].filter(Boolean).join(' ')}
            </div>
          </div>
        </div>

        {/* Labor Lines */}
        <div style={{ ...S.card, marginBottom: 12 }}>
          <div style={{ ...S.label, marginBottom: 10 }}>Labor / Jobs</div>
          {laborLines.length === 0 && <div style={{ color: '#9D9DA1', fontSize: 13 }}>No labor lines</div>}
          {laborLines.map((line: any) => {
            const lineAssignments = reviewAssignments.filter((a: any) => a.line_id === line.id)
            const hours = line.billed_hours || line.actual_hours || line.estimated_hours || 0
            return (
              <div key={line.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{line.description}</div>
                    <div style={{ fontSize: 11, color: '#9D9DA1', marginTop: 2 }}>
                      {lineAssignments.map((a: any) => (a.users as any)?.full_name || 'Unknown').join(', ') || 'Unassigned'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{fmt(hours * laborRate)}</div>
                    <div style={{ fontSize: 11, color: '#9D9DA1' }}>{hours.toFixed(1)} hrs @ {fmt(laborRate)}/hr</div>
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
          {partLines.map((line: any) => (
            <div key={line.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{line.description}</div>
                {line.part_number && <div style={{ fontSize: 11, color: '#9D9DA1' }}>PN: {line.part_number}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{fmt(line.total_price || 0)}</div>
                <div style={{ fontSize: 11, color: '#9D9DA1' }}>{line.quantity || 1} x {fmt(line.unit_price || 0)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div style={{ ...S.card, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
            <span style={{ color: '#9D9DA1' }}>Labor</span><span>{fmt(laborTotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
            <span style={{ color: '#9D9DA1' }}>Parts</span><span>{fmt(partsTotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderTop: '1px solid rgba(255,255,255,.08)' }}>
            <span style={{ color: '#9D9DA1' }}>Subtotal</span><span>{fmt(subtotal)}</span>
          </div>
          {taxAmt > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
              <span style={{ color: '#9D9DA1' }}>Tax ({taxRate}%)</span><span>{fmt(taxAmt)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 16, fontWeight: 800, borderTop: '1px solid rgba(255,255,255,.12)' }}>
            <span>Total</span><span>{fmt(total)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        {reviewWo.invoice_status === 'pending_accounting' && (
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
      </div>
    )
  }

  // Main list view
  return (
    <div style={S.page}>
      <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 20 }}>Accounting</div>

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
            {i === 0 && (() => { const c = wos.filter(w => w.invoice_status === 'pending_accounting').length; return c > 0 ? ` (${c})` : '' })()}
          </button>
        ))}
      </div>

      {/* WO Cards */}
      {filteredWos.length === 0 && (
        <div style={{ ...S.card, textAlign: 'center', color: '#9D9DA1', padding: 40 }}>
          {tab === 0 ? 'No work orders pending review' : tab === 1 ? 'No approved invoices' : 'No work orders found'}
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
            {wo.invoice_status === 'pending_accounting' && (
              <div style={{ marginTop: 10 }}>
                <button style={{ ...S.btn(BLUE, '#fff'), fontSize: 12, padding: '6px 14px' }}>Review</button>
              </div>
            )}
          </div>
        )
      })}
      {tab !== 3 && <PageFooter total={filteredWos.length} page={acctPage} perPage={acctPerPage} onPageChange={setAcctPage} onPerPageChange={setAcctPerPage} />}

      {/* ═══ PAYROLL TAB ═══ */}
      {tab === 3 && (() => {
        const filtered = payrollData.filter(e => {
          if (payrollSearch) {
            const q = payrollSearch.toLowerCase()
            if (!(e.full_name || '').toLowerCase().includes(q)) return false
          }
          if (payrollFilter === 'hourly') return e.payroll?.pay_type === 'hourly'
          if (payrollFilter === 'salaried') return e.payroll && e.payroll.pay_type !== 'hourly'
          return true
        })
        const totalWeekly = filtered.reduce((s: number, e: any) => s + calcWeeklyCost(e.payroll), 0)
        const hourlyCount = filtered.filter(e => e.payroll?.pay_type === 'hourly').length
        const salariedCount = filtered.filter(e => e.payroll && e.payroll.pay_type !== 'hourly').length

        async function savePayroll(userId: string) {
          setPayrollSaving(true)
          await fetch('/api/accounting/payroll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shop_id: user.shop_id, user_id: userId, ...payrollForm }),
          })
          const res = await fetch(`/api/accounting/payroll?shop_id=${user.shop_id}`)
          if (res.ok) setPayrollData(await res.json())
          setEditingPayroll(null)
          setPayrollSaving(false)
        }

        return (
          <>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Total Employees', value: String(filtered.length), color: BLUE },
                { label: 'Est. Weekly Payroll', value: '$' + totalWeekly.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','), color: GREEN },
                { label: 'Hourly Staff', value: String(hourlyCount), color: BLUE },
                { label: 'Salaried Staff', value: String(salariedCount), color: AMBER },
              ].map(c => (
                <div key={c.label} style={{ background: '#151520', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, color: '#7C8BA0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{c.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: c.color }}>{c.value}</div>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
              <input value={payrollSearch} onChange={e => setPayrollSearch(e.target.value)} placeholder="Search employee..." style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: '#151520', color: '#EDEDF0', fontSize: 13, fontFamily: FONT, outline: 'none', width: 220 }} />
              {['all', 'hourly', 'salaried'].map(f => (
                <button key={f} onClick={() => setPayrollFilter(f)} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: payrollFilter === f ? `1px solid ${BLUE}` : '1px solid rgba(255,255,255,0.08)', background: payrollFilter === f ? 'rgba(29,111,232,.1)' : 'transparent', color: payrollFilter === f ? '#4D9EFF' : '#7C8BA0', fontFamily: FONT, textTransform: 'capitalize' }}>{f}</button>
              ))}
            </div>

            {/* Table */}
            <div style={{ background: '#151520', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['Employee', 'Role', 'Pay Type', 'Rate', 'Est. Weekly Cost', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#12121A' }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {filtered.map(e => {
                    const p = e.payroll
                    const isEditing = editingPayroll === e.id
                    const badge = p ? PAY_TYPE_BADGE[p.pay_type] || PAY_TYPE_BADGE.hourly : null
                    const weekly = calcWeeklyCost(p)

                    if (isEditing) {
                      return (
                        <tr key={e.id} style={{ background: 'rgba(29,111,232,0.04)' }}>
                          <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#EDEDF0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{e.full_name}</td>
                          <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: 'rgba(255,255,255,0.06)', color: '#7C8BA0', textTransform: 'capitalize' }}>{e.role?.replace(/_/g, ' ')}</span>
                          </td>
                          <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <select value={payrollForm.pay_type} onChange={ev => setPayrollForm(f => ({ ...f, pay_type: ev.target.value }))} style={{ padding: '4px 8px', borderRadius: 6, background: '#1C2130', border: '1px solid rgba(255,255,255,0.08)', color: '#EDEDF0', fontSize: 12, fontFamily: FONT }}>
                              <option value="hourly">Hourly</option>
                              <option value="weekly_salary">Weekly Salary</option>
                              <option value="biweekly_salary">Bi-Weekly Salary</option>
                              <option value="monthly_salary">Monthly Salary</option>
                            </select>
                          </td>
                          <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            {payrollForm.pay_type === 'hourly' ? (
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <span style={{ color: '#7C8BA0', fontSize: 12 }}>$</span>
                                <input value={payrollForm.hourly_rate} onChange={ev => setPayrollForm(f => ({ ...f, hourly_rate: ev.target.value }))} style={{ width: 70, padding: '4px 6px', borderRadius: 6, background: '#1C2130', border: '1px solid rgba(255,255,255,0.08)', color: '#EDEDF0', fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", textAlign: 'right' as const }} />
                                <span style={{ color: '#7C8BA0', fontSize: 11 }}>/hr</span>
                                <span style={{ color: '#48536A', fontSize: 11, marginLeft: 4 }}>x</span>
                                <input value={payrollForm.weekly_hours} onChange={ev => setPayrollForm(f => ({ ...f, weekly_hours: ev.target.value }))} style={{ width: 40, padding: '4px 6px', borderRadius: 6, background: '#1C2130', border: '1px solid rgba(255,255,255,0.08)', color: '#EDEDF0', fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", textAlign: 'right' as const }} />
                                <span style={{ color: '#7C8BA0', fontSize: 11 }}>hrs</span>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <span style={{ color: '#7C8BA0', fontSize: 12 }}>$</span>
                                <input value={payrollForm.salary_amount} onChange={ev => setPayrollForm(f => ({ ...f, salary_amount: ev.target.value }))} style={{ width: 90, padding: '4px 6px', borderRadius: 6, background: '#1C2130', border: '1px solid rgba(255,255,255,0.08)', color: '#EDEDF0', fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", textAlign: 'right' as const }} />
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }} />
                          <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => savePayroll(e.id)} disabled={payrollSaving} style={{ padding: '4px 12px', borderRadius: 6, background: BLUE, color: '#fff', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>{payrollSaving ? '...' : 'Save'}</button>
                              <button onClick={() => setEditingPayroll(null)} style={{ padding: '4px 12px', borderRadius: 6, background: 'transparent', color: '#7C8BA0', border: '1px solid rgba(255,255,255,0.08)', fontSize: 11, cursor: 'pointer', fontFamily: FONT }}>Cancel</button>
                            </div>
                          </td>
                        </tr>
                      )
                    }

                    return (
                      <tr key={e.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#EDEDF0' }}>{e.full_name || '—'}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: 'rgba(255,255,255,0.06)', color: '#7C8BA0', textTransform: 'capitalize' }}>{e.role?.replace(/_/g, ' ') || '—'}</span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          {badge ? <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: badge.bg, color: badge.color }}>{badge.label}</span> : <span style={{ color: '#48536A', fontSize: 12 }}>Not Set</span>}
                        </td>
                        <td style={{ padding: '10px 14px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: p ? '#EDEDF0' : '#48536A' }}>
                          {p ? (p.pay_type === 'hourly' ? `$${(p.hourly_rate || 0).toFixed(2)} / hr` : `$${(p.salary_amount || 0).toFixed(2)}`) : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 700, color: weekly > 0 ? BLUE : '#48536A' }}>
                          {weekly > 0 ? '$' + weekly.toFixed(2) : '—'}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <button onClick={() => { setEditingPayroll(e.id); setPayrollForm(p ? { pay_type: p.pay_type, hourly_rate: String(p.hourly_rate || 0), salary_amount: String(p.salary_amount || 0), weekly_hours: String(p.weekly_hours || 40), effective_date: p.effective_date || '', notes: p.notes || '' } : { pay_type: 'hourly', hourly_rate: '0', salary_amount: '0', weekly_hours: '40', effective_date: '', notes: '' }) }}
                            style={{ padding: '4px 12px', borderRadius: 6, border: `1px solid ${p ? 'rgba(255,255,255,0.08)' : BLUE}`, background: p ? 'transparent' : 'rgba(29,111,232,.1)', color: p ? '#7C8BA0' : BLUE, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
                            {p ? 'Edit' : '+ Set Pay'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#48536A', fontSize: 13 }}>No employees found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )
      })()}
    </div>
  )
}
