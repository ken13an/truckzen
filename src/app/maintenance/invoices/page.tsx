'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { ChevronRight, ChevronDown, Send } from 'lucide-react'
import { calcWoOperationalTotals } from '@/lib/invoice-calc'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const BLUE = '#1B6EE6', GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F', MUTED = '#7C8BA0'

type Tab = 'unpaid' | 'paid' | 'closed'

const STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: MUTED },
  accounting_review: { label: 'Under Review', color: AMBER },
  sent: { label: 'Sent — Awaiting Payment', color: BLUE },
  paid: { label: 'Paid', color: GREEN },
  closed: { label: 'Closed', color: MUTED },
}

const MAINTAINED_TYPES = new Set(['fleet_asset', 'owner_operator'])

export default function MaintenanceInvoicesPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [wos, setWos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('unpaid')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [detail, setDetail] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionsTaken, setActionsTaken] = useState<Record<string, string>>({}) // wo_id → last action
  const [flagModal, setFlagModal] = useState<string | null>(null)
  const [flagNotes, setFlagNotes] = useState('')

  const loadData = useCallback(async (shopId: string) => {
    // Fetch WOs — use grand_total as the canonical preview total (repaired by 26I/26J)
    const { data: woData } = await supabase.from('service_orders').select(`
      id, so_number, status, invoice_status, complaint, grand_total, labor_total, parts_total,
      created_at, closed_at, is_historical,
      assets(id, unit_number, make, model, year, ownership_type),
      customers(id, company_name)
    `).eq('shop_id', shopId).eq('is_historical', false).is('deleted_at', null)
      .not('invoice_status', 'is', null).not('invoice_status', 'eq', 'draft')
      .order('created_at', { ascending: false }).limit(100)

    // Scope to maintained units — use grand_total as the single preview total source
    const scoped = (woData || []).filter((w: any) => {
      const asset = w.assets as any
      return asset && MAINTAINED_TYPES.has(asset.ownership_type)
    }).map((w: any) => ({
      ...w,
      invoice_total: w.grand_total ?? 0,
      invoice_balance: w.grand_total ?? 0,
      invoice_paid: null,
    }))

    setWos(scoped)
  }, [supabase])

  useEffect(() => {
    getCurrentUser(supabase).then(async (p: any) => {
      if (!p) { window.location.href = '/login'; return }
      setUser(p)
      await loadData(p.shop_id)
      setLoading(false)
    })
  }, [])

  async function loadDetail(woId: string) {
    if (expanded === woId) { setExpanded(null); setDetail(null); return }
    setExpanded(woId)
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/work-orders/${woId}`)
      if (res.ok) setDetail(await res.json())
      else setDetail(null)
    } catch { setDetail(null) }
    setDetailLoading(false)
  }

  async function doAction(woId: string, action: string, notes?: string) {
    setActionLoading(woId + action)
    try {
      const res = await fetch('/api/maintenance/invoice-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wo_id: woId, action, notes }),
      })
      if (res.ok) {
        setActionsTaken(prev => ({ ...prev, [woId]: action }))
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Action failed')
      }
    } catch { alert('Action failed — network error') }
    setActionLoading(null)
    if (action === 'flag_issue') { setFlagModal(null); setFlagNotes('') }
  }

  const fmt = (n: number | null | undefined) => n != null ? '$' + Number(n).toFixed(2) : '$0.00'

  const unpaid = wos.filter(w => ['accounting_review', 'sent'].includes(w.invoice_status))
  const paid = wos.filter(w => w.invoice_status === 'paid')
  const closed = wos.filter(w => w.invoice_status === 'closed')
  const display = tab === 'unpaid' ? unpaid : tab === 'paid' ? paid : closed

  if (loading) return <div style={{ background: '#060708', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontFamily: FONT }}>Loading...</div>

  return (
    <div style={{ background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: FONT, padding: 24 }}>
      {/* Flag Issue Modal */}
      {flagModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) { setFlagModal(null); setFlagNotes('') } }}>
          <div style={{ background: '#1A1A26', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 400 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Flag Invoice Issue</div>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>Describe the issue. Accounting will be notified.</div>
            <textarea value={flagNotes} onChange={e => setFlagNotes(e.target.value)} placeholder="What's wrong with this invoice?" rows={3}
              style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 13, color: '#DDE3EE', fontFamily: FONT, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => { setFlagModal(null); setFlagNotes('') }} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>Cancel</button>
              <button onClick={() => doAction(flagModal, 'flag_issue', flagNotes)} disabled={!flagNotes.trim() || !!actionLoading}
                style={{ padding: '8px 16px', background: RED, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
                Submit Issue
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF', marginBottom: 4 }}>Maintenance Invoices</div>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 20 }}>Invoices for fleet and owner-operator units only</div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Unpaid', value: String(unpaid.length), color: AMBER },
          { label: 'Paid', value: String(paid.length), color: GREEN },
          { label: 'Closed', value: String(closed.length), color: MUTED },
          { label: 'Outstanding', value: fmt(unpaid.reduce((s, w) => s + (w.invoice_total ?? w.grand_total ?? 0), 0)), color: RED },
        ].map(s => (
          <div key={s.label} style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 9, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: MONO, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        {([['unpaid', `Unpaid (${unpaid.length})`], ['paid', `Paid (${paid.length})`], ['closed', `Closed (${closed.length})`]] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 20px', background: 'none', border: 'none',
            color: tab === t ? BLUE : MUTED, fontFamily: FONT, fontSize: 13, fontWeight: 700,
            cursor: 'pointer', borderBottom: tab === t ? `2px solid ${BLUE}` : '2px solid transparent',
            textTransform: 'uppercase', letterSpacing: '.04em',
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* Invoice List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {display.length === 0 && (
          <div style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 40, textAlign: 'center', color: '#48536A', fontSize: 13 }}>
            {tab === 'unpaid' ? 'No unpaid invoices for maintained units' : tab === 'paid' ? 'No paid invoices yet' : 'No closed invoices'}
          </div>
        )}

        {display.map((w: any) => {
          const asset = w.assets as any
          const cust = w.customers as any
          const st = STATUS_DISPLAY[w.invoice_status] || STATUS_DISPLAY.draft
          const isExpanded = expanded === w.id
          const lastAction = actionsTaken[w.id]

          return (
            <div key={w.id} style={{ background: '#0D0F12', border: `1px solid ${isExpanded ? 'rgba(29,111,232,.3)' : 'rgba(255,255,255,.08)'}`, borderRadius: 12, overflow: 'hidden' }}>
              {/* Row header */}
              <div onClick={() => loadDetail(w.id)} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', gap: 12 }}
                onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'rgba(255,255,255,.02)' }}
                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                <span style={{ color: MUTED }}>{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
                <span style={{ fontFamily: MONO, color: BLUE, fontWeight: 700, fontSize: 13, minWidth: 70 }}>{w.so_number}</span>
                <span style={{ fontSize: 12 }}>
                  <span style={{ fontWeight: 600 }}>#{asset?.unit_number}</span>
                  <span style={{ color: MUTED, marginLeft: 6, fontSize: 11 }}>{[asset?.year, asset?.make].filter(Boolean).join(' ')}</span>
                  {asset?.ownership_type === 'owner_operator' && <span style={{ marginLeft: 6, fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(245,158,11,.1)', color: AMBER, fontWeight: 600 }}>O/O</span>}
                </span>
                <span style={{ color: MUTED, fontSize: 12 }}>{cust?.company_name || '—'}</span>
                <span style={{ marginLeft: 'auto' }} />
                {lastAction && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: lastAction === 'flag_issue' ? `${RED}18` : `${GREEN}18`, color: lastAction === 'flag_issue' ? RED : GREEN, fontWeight: 600 }}>
                  {lastAction === 'approve' ? 'Approved' : lastAction === 'payment_sent' ? 'Payment Sent' : 'Issue Flagged'}
                </span>}
                <span style={{ fontSize: 10, fontWeight: 700, color: st.color, background: `${st.color}18`, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' }}>{st.label}</span>
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 14, minWidth: 80, textAlign: 'right', color: tab === 'paid' ? GREEN : '#F0F4FF' }}>{fmt(w.invoice_total ?? w.grand_total)}</span>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', padding: '16px 20px', background: '#0A0C10' }}>
                  {detailLoading ? (
                    <div style={{ color: MUTED, fontSize: 12 }}>Loading...</div>
                  ) : detail ? (() => {
                    const lines = detail.so_lines || []
                    const laborLines = lines.filter((l: any) => l.line_type === 'labor')
                    const partLines = lines.filter((l: any) => l.line_type === 'part' && l.parts_status !== 'canceled')
                    const defaultRate = detail.shop?.labor_rate || detail.shop?.default_labor_rate || 125
                    const taxRate = detail.shop?.tax_rate || 0
                    const taxLabor = !!detail.shop?.tax_labor

                    // Use calcWoOperationalTotals — same function as WO Invoice tab
                    const inv = calcWoOperationalTotals(lines, defaultRate, taxRate, taxLabor)

                    return (
                      <>
                        {detail.complaint && <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>Complaint: <span style={{ color: '#DDE3EE' }}>{detail.complaint}</span></div>}

                        {laborLines.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: BLUE, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Labor</div>
                            {laborLines.map((l: any) => {
                              const hrs = l.billed_hours || l.actual_hours || l.estimated_hours || 0
                              const rate = (l.unit_price && l.unit_price > 0) ? l.unit_price : defaultRate
                              return (
                                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,.03)' }}>
                                  <span>{l.description?.slice(0, 50)}</span>
                                  <span style={{ fontFamily: MONO, color: MUTED }}>{hrs}h x {fmt(rate)} = <strong style={{ color: '#DDE3EE' }}>{fmt(hrs * rate)}</strong></span>
                                </div>
                              )
                            })}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 0', fontSize: 12, fontWeight: 600, color: '#DDE3EE' }}>Labor: {fmt(inv.laborTotal)}</div>
                          </div>
                        )}

                        {partLines.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: GREEN, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Parts</div>
                            {partLines.map((l: any) => {
                              const sell = l.parts_sell_price || l.unit_price || 0
                              const qty = l.quantity || 1
                              return (
                                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,.03)' }}>
                                  <span>{l.real_name || l.description || '—'} {l.part_number ? `(${l.part_number})` : ''}</span>
                                  <span style={{ fontFamily: MONO, color: MUTED }}>{qty} x {fmt(sell)} = <strong style={{ color: '#DDE3EE' }}>{fmt(sell * qty)}</strong></span>
                                </div>
                              )
                            })}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 0', fontSize: 12, fontWeight: 600, color: '#DDE3EE' }}>Parts: {fmt(inv.partsTotal)}</div>
                          </div>
                        )}

                        {inv.taxAmount > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, color: MUTED }}>
                            <span>Tax ({taxRate}%{taxLabor ? ' incl. labor' : ' parts only'})</span>
                            <span>{fmt(inv.taxAmount)}</span>
                          </div>
                        )}

                        {/* Total — computed from calcInvoiceTotals, same as WO Invoice tab */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14, fontWeight: 700, borderTop: '1px solid rgba(255,255,255,.08)' }}>
                          <span>Invoice Total</span><span style={{ color: GREEN }}>{fmt(inv.grandTotal)}</span>
                        </div>

                        {/* Maintenance actions — view/payment only, no accounting approval */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.06)' }}>
                          {tab === 'unpaid' && !lastAction && (
                            <button disabled={!!actionLoading} onClick={() => doAction(w.id, 'payment_sent')}
                              style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${BLUE}33`, background: 'transparent', color: BLUE, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 6, opacity: actionLoading ? 0.6 : 1 }}>
                              <Send size={14} /> Mark Payment Sent
                            </button>
                          )}
                          {lastAction && (
                            <div style={{ fontSize: 12, fontWeight: 600, color: GREEN, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Send size={14} /> Payment sent
                            </div>
                          )}
                          <a href={`/work-orders/${w.id}`} target="_blank" rel="noopener" style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: MUTED, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: FONT, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                            View WO Detail
                          </a>
                        </div>
                      </>
                    )
                  })() : <div style={{ color: MUTED, fontSize: 12 }}>Could not load detail</div>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
