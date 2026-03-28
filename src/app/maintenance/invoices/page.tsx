'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { ChevronRight, ChevronDown, CheckCircle2, AlertTriangle, Send, X } from 'lucide-react'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const BLUE = '#1B6EE6', GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F', MUTED = '#7C8BA0'

type Tab = 'unpaid' | 'paid'

const STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: MUTED },
  accounting_review: { label: 'Accounting Review', color: BLUE },
  sent: { label: 'Sent', color: BLUE },
  paid: { label: 'Paid', color: GREEN },
  closed: { label: 'Closed', color: GREEN },
}

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
  const [flagModal, setFlagModal] = useState<string | null>(null) // wo_id
  const [flagNotes, setFlagNotes] = useState('')

  const loadData = useCallback(async (shopId: string) => {
    const { data } = await supabase
      .from('service_orders')
      .select(`
        id, so_number, status, invoice_status, complaint, grand_total, labor_total, parts_total,
        created_at, closed_at,
        assets!inner(id, unit_number, make, model, year, ownership_type),
        customers(id, company_name)
      `)
      .eq('shop_id', shopId)
      .is('deleted_at', null)
      .in('assets.ownership_type', ['fleet_asset', 'owner_operator'])
      .not('invoice_status', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200)
    setWos(data || [])
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
    const res = await fetch(`/api/work-orders/${woId}`)
    if (res.ok) {
      const d = await res.json()
      setDetail(d)
    }
    setDetailLoading(false)
  }

  async function doAction(woId: string, action: string, notes?: string) {
    setActionLoading(woId + action)
    const res = await fetch('/api/maintenance/invoice-action', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wo_id: woId, action, notes }),
    })
    if (res.ok) {
      const labels: Record<string, string> = { approve: 'Invoice approved', flag_issue: 'Issue flagged', payment_sent: 'Payment sent notification recorded' }
      alert(labels[action] + ' — accounting has been notified.')
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Action failed')
    }
    setActionLoading(null)
    if (action === 'flag_issue') { setFlagModal(null); setFlagNotes('') }
  }

  const fmt = (n: number | null | undefined) => n != null ? '$' + Number(n).toFixed(2) : '$0.00'

  const unpaid = wos.filter(w => !['paid', 'closed'].includes(w.invoice_status))
  const paid = wos.filter(w => ['paid', 'closed'].includes(w.invoice_status))
  const display = tab === 'unpaid' ? unpaid : paid

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
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 20 }}>Invoices for fleet and owner-operator units maintained by your team</div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Unpaid', value: unpaid.length, color: AMBER },
          { label: 'Paid', value: paid.length, color: GREEN },
          { label: 'Total Outstanding', value: fmt(unpaid.reduce((s, w) => s + (w.grand_total || 0), 0)), color: RED },
        ].map(s => (
          <div key={s.label} style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 10, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: MONO, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        {(['unpaid', 'paid'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 20px', background: 'none', border: 'none',
            color: tab === t ? BLUE : MUTED, fontFamily: FONT, fontSize: 13, fontWeight: 700,
            cursor: 'pointer', borderBottom: tab === t ? `2px solid ${BLUE}` : '2px solid transparent',
            textTransform: 'uppercase', letterSpacing: '.04em',
          }}>
            {t === 'unpaid' ? `Unpaid (${unpaid.length})` : `Paid (${paid.length})`}
          </button>
        ))}
      </div>

      {/* Invoice List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {display.length === 0 && (
          <div style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 40, textAlign: 'center', color: '#48536A', fontSize: 13 }}>
            {tab === 'unpaid' ? 'No unpaid invoices for maintained units' : 'No paid invoices yet'}
          </div>
        )}

        {display.map((w: any) => {
          const asset = w.assets as any
          const cust = w.customers as any
          const st = STATUS_DISPLAY[w.invoice_status] || STATUS_DISPLAY.draft
          const isExpanded = expanded === w.id

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
                <span style={{ fontSize: 10, fontWeight: 700, color: st.color, background: `${st.color}18`, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' }}>{st.label}</span>
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 14, minWidth: 80, textAlign: 'right', color: tab === 'paid' ? GREEN : '#F0F4FF' }}>{fmt(w.grand_total)}</span>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', padding: '16px 20px', background: '#0A0C10' }}>
                  {detailLoading ? (
                    <div style={{ color: MUTED, fontSize: 12 }}>Loading detail...</div>
                  ) : detail ? (() => {
                    const lines = detail.so_lines || []
                    const laborLines = lines.filter((l: any) => l.line_type === 'labor')
                    const partLines = lines.filter((l: any) => l.line_type === 'part')
                    const laborRate = detail.shop?.labor_rate || detail.shop?.default_labor_rate || 125
                    return (
                      <>
                        {/* Complaint */}
                        {detail.complaint && <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>Complaint: <span style={{ color: '#DDE3EE' }}>{detail.complaint}</span></div>}

                        {/* Labor */}
                        {laborLines.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: BLUE, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Labor</div>
                            {laborLines.map((l: any) => {
                              const hrs = l.billed_hours || l.actual_hours || l.estimated_hours || 0
                              return (
                                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,.03)' }}>
                                  <span>{l.description?.slice(0, 50)}</span>
                                  <span style={{ fontFamily: MONO, color: MUTED }}>{hrs}h x {fmt(laborRate)} = <strong style={{ color: '#DDE3EE' }}>{fmt(hrs * laborRate)}</strong></span>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Parts */}
                        {partLines.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: GREEN, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Parts</div>
                            {partLines.map((l: any) => {
                              const sell = l.parts_sell_price || l.unit_price || 0
                              const qty = l.quantity || 1
                              return (
                                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,.03)' }}>
                                  <span>{l.real_name || l.description || '—'} {l.part_number ? `(${l.part_number})` : ''}</span>
                                  <span style={{ fontFamily: MONO, color: MUTED }}>{qty} x {fmt(sell)} = <strong style={{ color: '#DDE3EE' }}>{fmt(l.total_price || sell * qty)}</strong></span>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Total */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14, fontWeight: 700, borderTop: '1px solid rgba(255,255,255,.08)' }}>
                          <span>Total</span>
                          <span style={{ color: GREEN }}>{fmt(w.grand_total)}</span>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.06)' }}>
                          {tab === 'unpaid' && (
                            <>
                              <button disabled={!!actionLoading} onClick={() => doAction(w.id, 'approve')}
                                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: GREEN, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 6, opacity: actionLoading ? 0.6 : 1 }}>
                                <CheckCircle2 size={14} /> Approve Invoice
                              </button>
                              <button disabled={!!actionLoading} onClick={() => setFlagModal(w.id)}
                                style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${RED}33`, background: 'transparent', color: RED, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <AlertTriangle size={14} /> Flag Issue
                              </button>
                              <button disabled={!!actionLoading} onClick={() => doAction(w.id, 'payment_sent')}
                                style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${BLUE}33`, background: 'transparent', color: BLUE, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 6, opacity: actionLoading ? 0.6 : 1 }}>
                                <Send size={14} /> Payment Sent
                              </button>
                            </>
                          )}
                          <a href={`/work-orders/${w.id}`} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: MUTED, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: FONT, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                            Open Full WO
                          </a>
                        </div>
                      </>
                    )
                  })() : null}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
