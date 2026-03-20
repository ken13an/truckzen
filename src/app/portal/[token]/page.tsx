'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Logo from '@/components/Logo'

const FONT = "'Inter', -apple-system, sans-serif"
const BG = '#151520'
const TEXT = '#EDEDF0'
const MUTED = '#8A8A9A'
const BLUE = '#1D6FE8'
const GREEN = '#16A34A'
const AMBER = '#D97706'
const RED = '#DC2626'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: MUTED },
  open: { label: 'Open', color: BLUE },
  in_progress: { label: 'In Progress', color: BLUE },
  waiting_parts: { label: 'Waiting Parts', color: AMBER },
  authorized: { label: 'Approved', color: GREEN },
  completed: { label: 'Completed', color: GREEN },
  done: { label: 'Completed', color: GREEN },
  good_to_go: { label: 'Ready for Pickup', color: GREEN },
  invoiced: { label: 'Invoiced', color: BLUE },
  closed: { label: 'Closed', color: MUTED },
}

const LINE_STATUS: Record<string, { label: string; color: string }> = {
  completed: { label: 'Done', color: GREEN },
  in_progress: { label: 'In Progress', color: BLUE },
  unassigned: { label: 'Queued', color: MUTED },
  approved: { label: 'Approved', color: GREEN },
  pending_review: { label: 'Under Review', color: AMBER },
}

const card = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 } as const
const pill = (color: string) => ({ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: `${color}20`, color } as const)
const btn = (bg: string, color: string) => ({ padding: '12px 24px', background: bg, color, border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: FONT } as const)

export default function CustomerPortalPage() {
  const params = useParams()
  const token = params.token as string

  const [wo, setWo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState(0)
  const [history, setHistory] = useState<any[]>([])
  const [actionLoading, setActionLoading] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/${token}`)
      if (!res.ok) { setError(res.status === 404 ? 'Invalid or expired link.' : 'Failed to load.'); setLoading(false); return }
      setWo(await res.json())
      setError('')
    } catch { setError('Unable to connect.') }
    setLoading(false)
  }, [token])

  useEffect(() => {
    fetchData()
    const iv = setInterval(fetchData, 30000)
    return () => clearInterval(iv)
  }, [fetchData])

  async function fetchHistory() {
    const res = await fetch(`/api/portal/${token}/history`)
    if (res.ok) setHistory(await res.json())
  }

  async function approveEstimate() {
    setActionLoading('approve')
    await fetch(`/api/portal/${token}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    await fetchData()
    setActionLoading('')
  }

  async function approveJob(lineId: string) {
    setActionLoading(lineId)
    await fetch(`/api/portal/${token}/approve-job`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ line_id: lineId }) })
    await fetchData()
    setActionLoading('')
  }

  async function declineJob(lineId: string) {
    setActionLoading(lineId)
    await fetch(`/api/portal/${token}/decline-job`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ line_id: lineId }) })
    await fetchData()
    setActionLoading('')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED }}>
      <div style={{ textAlign: 'center' }}>
        <Logo size="md" />
        <div style={{ marginTop: 16 }}>Loading your work order...</div>
      </div>
    </div>
  )

  if (error || !wo) return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: RED }}>
      <div style={{ textAlign: 'center' }}>
        <Logo size="md" />
        <div style={{ marginTop: 16, fontSize: 16 }}>{error || 'Work order not found'}</div>
        <div style={{ marginTop: 8, fontSize: 13, color: MUTED }}>The link may be invalid or expired.</div>
      </div>
    </div>
  )

  const asset = wo.assets || {}
  const customer = wo.customers || {}
  const shop = wo.shop || {}
  const checkin = wo.checkin || {}
  const lines = (wo.so_lines || []) as any[]
  const charges = (wo.wo_shop_charges || []) as any[]
  const jobLines = lines.filter((l: any) => l.line_type !== 'part')
  const partLines = lines.filter((l: any) => l.line_type === 'part')
  const additional = lines.filter((l: any) => l.is_additional && l.customer_approved === null)
  const completed = jobLines.filter((l: any) => l.line_status === 'completed').length
  const total = jobLines.length

  const partsTotal = partLines.reduce((s: number, l: any) => s + ((l.quantity || 0) * (l.unit_price || 0)), 0)
  const laborTotal = jobLines.reduce((s: number, l: any) => s + ((l.billed_hours || l.quantity || 0) * (l.unit_price || 0)), 0)
  const chargesTotal = charges.reduce((s: number, c: any) => s + (c.amount || 0), 0)
  const tax = partsTotal * (shop.tax_rate || 0) / 100
  const grandTotal = wo.grand_total || (laborTotal + partsTotal + chargesTotal + tax)

  const vin = asset.vin || ''
  const st = STATUS_MAP[wo.status] || STATUS_MAP.draft

  const TABS = ['Status', 'Estimate', 'Pay', 'History']

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: FONT, color: TEXT }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Logo size="sm" />
          {shop.dba && <span style={{ fontSize: 13, fontWeight: 600, color: MUTED }}>{shop.dba}</span>}
          <span style={{ ...pill(BLUE), marginLeft: 'auto' }}>Customer Portal</span>
        </div>

        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 20, fontWeight: 800 }}>{wo.so_number}</span>
            <span style={pill(st.color)}>{st.label}</span>
          </div>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>{customer.company_name || 'Customer'}</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Unit #{asset.unit_number} — {asset.year} {asset.make} {asset.model}</div>
          {vin && <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>VIN: {vin.slice(0, -6)}<strong>{vin.slice(-6)}</strong></div>}
          {checkin.need_by_date && <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>Need by: {new Date(checkin.need_by_date + 'T12:00:00').toLocaleDateString()}</div>}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 16 }}>
          {TABS.map((t, i) => (
            <button key={t} onClick={() => { setTab(i); if (i === 3 && history.length === 0) fetchHistory() }} style={{
              padding: '10px 16px', fontSize: 13, fontWeight: tab === i ? 700 : 400, color: tab === i ? BLUE : MUTED,
              background: 'none', border: 'none', borderBottom: tab === i ? `2px solid ${BLUE}` : '2px solid transparent',
              cursor: 'pointer', fontFamily: FONT,
            }}>{t}</button>
          ))}
        </div>

        {/* Tab 0: Status */}
        {tab === 0 && (
          <div>
            {/* Progress */}
            <div style={{ ...card }}>
              <div style={{ fontSize: 13, color: MUTED, marginBottom: 8 }}>{completed} of {total} jobs completed</div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: total > 0 ? `${(completed / total) * 100}%` : '0%', background: GREEN, borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
            </div>

            {/* Additional repairs alert */}
            {additional.length > 0 && (
              <div style={{ ...card, border: `1px solid ${AMBER}40`, background: `${AMBER}10` }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: AMBER, marginBottom: 8 }}>Additional Repairs Recommended</div>
                {additional.map((l: any) => (
                  <div key={l.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{l.description}</div>
                    {l.finding && <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>{l.finding}</div>}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => approveJob(l.id)} disabled={actionLoading === l.id} style={btn(GREEN, '#fff')}>
                        {actionLoading === l.id ? '...' : 'Approve'}
                      </button>
                      <button onClick={() => declineJob(l.id)} disabled={actionLoading === l.id} style={btn('transparent', RED)}>Decline</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Job list */}
            {jobLines.map((l: any, i: number) => {
              const ls = LINE_STATUS[l.line_status] || LINE_STATUS.unassigned
              return (
                <div key={l.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: ls.color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{l.description}</div>
                    <div style={{ fontSize: 11, color: MUTED }}>{ls.label}</div>
                  </div>
                  {l.is_additional && l.customer_approved === true && <span style={pill(GREEN)}>Approved</span>}
                  {l.is_additional && l.customer_approved === false && <span style={pill(RED)}>Declined</span>}
                </div>
              )
            })}
          </div>
        )}

        {/* Tab 1: Estimate */}
        {tab === 1 && (
          <div>
            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Estimate Breakdown</div>
              {jobLines.map((l: any, i: number) => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13 }}>
                  <span>{l.description}</span>
                  <span style={{ fontFamily: 'monospace', color: MUTED }}>${((l.billed_hours || l.quantity || 0) * (l.unit_price || 0)).toFixed(2)}</span>
                </div>
              ))}
              {charges.length > 0 && charges.map((c: any) => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13 }}>
                  <span>{c.description}</span>
                  <span style={{ fontFamily: 'monospace', color: MUTED }}>${(c.amount || 0).toFixed(2)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 12, color: MUTED }}>
                <span>Tax ({shop.tax_rate || 0}%)</span>
                <span style={{ fontFamily: 'monospace' }}>${tax.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: 18, fontWeight: 800, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <span>Total</span>
                <span>${grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Approval buttons */}
            {wo.auth_type === 'estimate_first' && !wo.approved_at && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={approveEstimate} disabled={!!actionLoading} style={btn(GREEN, '#fff')}>
                  {actionLoading === 'approve' ? 'Approving...' : 'Approve Estimate'}
                </button>
                {shop.phone && <a href={`tel:${shop.phone}`} style={{ ...btn('transparent', TEXT), border: '1px solid rgba(255,255,255,0.1)', textDecoration: 'none' }}>Call Shop: {shop.phone}</a>}
              </div>
            )}
            {wo.approved_at && (
              <div style={{ ...card, background: `${GREEN}15`, border: `1px solid ${GREEN}30` }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: GREEN }}>Estimate Approved</div>
                <div style={{ fontSize: 12, color: MUTED }}>Approved on {new Date(wo.approved_at).toLocaleDateString()}</div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Pay */}
        {tab === 2 && (
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Payment</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span color={MUTED}>Labor</span><span style={{ fontFamily: 'monospace' }}>${laborTotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span color={MUTED}>Parts</span><span style={{ fontFamily: 'monospace' }}>${partsTotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span color={MUTED}>Shop Charges</span><span style={{ fontFamily: 'monospace' }}>${chargesTotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span color={MUTED}>Tax</span><span style={{ fontFamily: 'monospace' }}>${tax.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12, marginTop: 8 }}>
              <span>Amount Due</span><span>${grandTotal.toFixed(2)}</span>
            </div>
            <button disabled style={{ ...btn(BLUE, '#fff'), opacity: 0.5, marginTop: 16, width: '100%', cursor: 'not-allowed' }}>Pay Now</button>
            <div style={{ fontSize: 12, color: MUTED, textAlign: 'center', marginTop: 8 }}>Online payments coming soon. Contact the shop at {shop.phone || 'the number on your invoice'}.</div>
          </div>
        )}

        {/* Tab 3: History */}
        {tab === 3 && (
          <div>
            {history.length === 0 && <div style={{ ...card, textAlign: 'center', color: MUTED }}>No previous work orders</div>}
            {history.map((h: any) => (
              <div key={h.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{h.so_number}</div>
                    <div style={{ fontSize: 12, color: MUTED }}>{h.complaint?.slice(0, 60) || '—'}</div>
                    <div style={{ fontSize: 11, color: MUTED }}>{h.created_at ? new Date(h.created_at).toLocaleDateString() : '—'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={pill((STATUS_MAP[h.status] || STATUS_MAP.draft).color)}>{(STATUS_MAP[h.status] || STATUS_MAP.draft).label}</span>
                    {h.grand_total > 0 && <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>${Number(h.grand_total).toFixed(0)}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '32px 0 16px', fontSize: 11, color: MUTED }}>Powered by TruckZen</div>
      </div>
    </div>
  )
}
