'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Logo from '@/components/Logo'
import { Loader2 } from 'lucide-react'

const FONT = "'Inter', -apple-system, sans-serif"
const BG = '#151520', TEXT = '#EDEDF0', MUTED = '#8A8A9A'
const BLUE = '#1D6FE8', GREEN = '#16A34A', AMBER = '#D97706', RED = '#DC2626'

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

const card = (mobile?: boolean) => ({
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: mobile ? 12 : 16,
  marginBottom: 12,
} as const)

const pill = (color: string) => ({
  display: 'inline-flex' as const, alignItems: 'center' as const, gap: 4,
  padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700,
  background: `${color}20`, color,
})

const btn = (bg: string, color: string, fullWidth?: boolean) => ({
  padding: '12px 24px', background: bg, color, border: 'none', borderRadius: 12,
  fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
  width: fullWidth ? '100%' : undefined,
} as const)

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000)
  if (s < 10) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

export default function CustomerPortalPage() {
  const params = useParams()
  const token = params.token as string

  const [wo, setWo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState(0)
  const [history, setHistory] = useState<any[]>([])
  const [actionLoading, setActionLoading] = useState('')
  const [declineModal, setDeclineModal] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Force re-render every 10s to keep "last updated" text fresh
  useEffect(() => {
    const iv = setInterval(() => forceUpdate(n => n + 1), 10000)
    return () => clearInterval(iv)
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/${token}`)
      if (!res.ok) { setError(res.status === 404 ? 'Invalid or expired link.' : 'Failed to load.'); return }
      setWo(await res.json())
      setLastUpdated(new Date())
      setError('')
    } catch { setError('Unable to connect.') }
    setLoading(false)
  }, [token])

  useEffect(() => {
    fetchData()
    const iv = setInterval(() => { if (!document.hidden) fetchData() }, 30000)
    timerRef.current = iv
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

  async function declineEstimate() {
    setActionLoading('decline')
    await fetch(`/api/portal/${token}/decline`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: declineReason }) })
    setDeclineModal(false)
    setDeclineReason('')
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

  async function approveNewItems() {
    setActionLoading('new-items')
    await fetch(`/api/portal/${token}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    await fetchData()
    setActionLoading('')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED }}>
      <div style={{ textAlign: 'center' }}>
        <Logo size="md" />
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          <span>Loading your work order...</span>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
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
  const c = card(isMobile)

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: FONT, color: TEXT }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: isMobile ? '16px 12px' : '24px 16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <Logo size="sm" />
          {shop.dba && <span style={{ fontSize: 13, fontWeight: 600, color: MUTED }}>{shop.dba}</span>}
          <span style={{ ...pill(BLUE), marginLeft: 'auto' }}>Customer Portal</span>
        </div>

        {/* WO Info Card */}
        <div style={{ ...c, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 20, fontWeight: 800 }}>{wo.so_number}</span>
            <span style={pill(st.color)}>{st.label}</span>
          </div>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>{customer.company_name || 'Customer'}</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Unit #{asset.unit_number} — {asset.year} {asset.make} {asset.model}</div>
          {vin && <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>VIN: {vin.slice(0, -6)}<strong>{vin.slice(-6)}</strong></div>}
          {checkin.need_by_date && <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>Need by: {new Date(checkin.need_by_date + 'T12:00:00').toLocaleDateString()}</div>}
          {lastUpdated && <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>Last updated {timeAgo(lastUpdated)}</div>}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 16, flexWrap: 'wrap' }}>
          {TABS.map((t, i) => (
            <button key={t} onClick={() => { setTab(i); if (i === 3 && history.length === 0) fetchHistory() }} style={{
              padding: isMobile ? '8px 12px' : '10px 16px',
              fontSize: isMobile ? 12 : 13,
              fontWeight: tab === i ? 700 : 400,
              color: tab === i ? BLUE : MUTED,
              background: 'none', border: 'none',
              borderBottom: tab === i ? `2px solid ${BLUE}` : '2px solid transparent',
              cursor: 'pointer', fontFamily: FONT,
            }}>{t}</button>
          ))}
        </div>

        {/* Tab 0: Status */}
        {tab === 0 && (
          <div>
            {/* Progress */}
            <div style={{ ...c }}>
              <div style={{ fontSize: 13, color: MUTED, marginBottom: 8 }}>{completed} of {total} jobs completed</div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: total > 0 ? `${(completed / total) * 100}%` : '0%', background: GREEN, borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
            </div>

            {/* Additional repairs alert */}
            {additional.length > 0 && (
              <div style={{ ...c, border: `1px solid ${AMBER}40`, background: `${AMBER}10` }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: AMBER, marginBottom: 8 }}>Additional Repairs Recommended</div>
                <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>Your technician found additional items that need attention.</div>
                {additional.map((l: any) => (
                  <div key={l.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{l.description}</div>
                    {l.finding && <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>{l.finding}</div>}
                    <div style={{ display: 'flex', gap: 8, flexDirection: isMobile ? 'column' : 'row' }}>
                      <button onClick={() => approveJob(l.id)} disabled={actionLoading === l.id} style={btn(GREEN, '#fff', isMobile)}>
                        {actionLoading === l.id ? 'Processing...' : 'Approve'}
                      </button>
                      <button onClick={() => declineJob(l.id)} disabled={actionLoading === l.id} style={{ ...btn('transparent', RED, isMobile), border: `1px solid ${RED}40` }}>Decline</button>
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 12 }}>
                  <button onClick={approveNewItems} disabled={actionLoading === 'new-items'} style={btn(AMBER, '#fff', isMobile)}>
                    {actionLoading === 'new-items' ? 'Approving...' : 'Approve All New Items'}
                  </button>
                </div>
              </div>
            )}

            {/* Job list */}
            {jobLines.map((l: any) => {
              const ls = LINE_STATUS[l.line_status] || LINE_STATUS.unassigned
              return (
                <div key={l.id} style={{ ...c, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: ls.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.description}</div>
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
            {/* Estimate status section */}
            {wo.estimate_status === 'pending' && (
              <div style={{ ...c, border: `1px solid ${AMBER}40`, background: `${AMBER}10`, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={pill(AMBER)}>Estimate Pending Approval</span>
                </div>
                <div style={{ fontSize: 13, color: MUTED, marginBottom: 12 }}>Please review the estimate below and approve or request changes.</div>
                <div style={{ display: 'flex', gap: 10, flexDirection: isMobile ? 'column' : 'row' }}>
                  <button onClick={approveEstimate} disabled={!!actionLoading} style={btn(GREEN, '#fff', isMobile)}>
                    {actionLoading === 'approve' ? 'Approving...' : 'Approve Estimate'}
                  </button>
                  <button onClick={() => setDeclineModal(true)} style={{ ...btn('transparent', TEXT, isMobile), border: '1px solid rgba(255,255,255,0.15)' }}>
                    Request Changes
                  </button>
                </div>
              </div>
            )}
            {wo.estimate_status === 'approved' && (
              <div style={{ ...c, background: `${GREEN}15`, border: `1px solid ${GREEN}30`, marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: GREEN }}>Estimate Approved</div>
                {wo.approved_at && <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>Approved on {new Date(wo.approved_at).toLocaleDateString()}</div>}
              </div>
            )}
            {wo.estimate_status === 'declined' && (
              <div style={{ ...c, background: `${MUTED}15`, border: `1px solid ${MUTED}30`, marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: MUTED }}>Estimate Declined</div>
                {wo.decline_reason && <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>Reason: {wo.decline_reason}</div>}
                <button onClick={() => setDeclineModal(true)} style={{ ...btn(BLUE, '#fff'), marginTop: 10 }}>Request New Estimate</button>
              </div>
            )}
            {/* Fallback for legacy auth_type approach */}
            {!wo.estimate_status && wo.auth_type === 'estimate_first' && !wo.approved_at && (
              <div style={{ ...c, border: `1px solid ${AMBER}40`, background: `${AMBER}10`, marginBottom: 16 }}>
                <span style={pill(AMBER)}>Estimate Pending Approval</span>
                <div style={{ display: 'flex', gap: 10, marginTop: 12, flexDirection: isMobile ? 'column' : 'row' }}>
                  <button onClick={approveEstimate} disabled={!!actionLoading} style={btn(GREEN, '#fff', isMobile)}>
                    {actionLoading === 'approve' ? 'Approving...' : 'Approve Estimate'}
                  </button>
                  <button onClick={() => setDeclineModal(true)} style={{ ...btn('transparent', TEXT, isMobile), border: '1px solid rgba(255,255,255,0.15)' }}>
                    Request Changes
                  </button>
                </div>
              </div>
            )}
            {!wo.estimate_status && wo.approved_at && (
              <div style={{ ...c, background: `${GREEN}15`, border: `1px solid ${GREEN}30`, marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: GREEN }}>Estimate Approved</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>Approved on {new Date(wo.approved_at).toLocaleDateString()}</div>
              </div>
            )}

            {/* Estimate breakdown */}
            <div style={c}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Estimate Breakdown</div>
              {jobLines.map((l: any) => {
                const hrs = l.billed_hours || l.quantity || 0
                const rate = l.unit_price || 0
                const lineParts = partLines.filter((p: any) => p.parent_line_id === l.id)
                const linePartsTotal = lineParts.reduce((s: number, p: any) => s + ((p.quantity || 0) * (p.unit_price || 0)), 0)
                const lineTotal = (hrs * rate) + linePartsTotal
                return (
                  <div key={l.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
                      <span style={{ flex: 1, marginRight: 8 }}>{l.description}</span>
                      <span style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>${lineTotal.toFixed(2)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                      {hrs > 0 && <span>{hrs}h × ${rate.toFixed(2)}/hr</span>}
                      {linePartsTotal > 0 && <span>{hrs > 0 ? ' + ' : ''}${linePartsTotal.toFixed(2)} parts</span>}
                    </div>
                  </div>
                )
              })}
              {charges.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginTop: 12, marginBottom: 4 }}>Shop Charges</div>
                  {charges.map((ch: any) => (
                    <div key={ch.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span>{ch.description}</span>
                      <span style={{ fontFamily: 'monospace', color: MUTED }}>${(ch.amount || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 12, color: MUTED, marginTop: 4 }}>
                <span>Tax ({shop.tax_rate || 0}%)</span>
                <span style={{ fontFamily: 'monospace' }}>${tax.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: 18, fontWeight: 800, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <span>Total</span>
                <span>${grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Bottom approve button for pending estimates */}
            {(wo.estimate_status === 'pending' || (!wo.estimate_status && wo.auth_type === 'estimate_first' && !wo.approved_at)) && (
              <div style={{ display: 'flex', gap: 10, marginTop: 8, flexDirection: isMobile ? 'column' : 'row' }}>
                <button onClick={approveEstimate} disabled={!!actionLoading} style={btn(GREEN, '#fff', isMobile)}>
                  {actionLoading === 'approve' ? 'Approving...' : 'Approve Estimate'}
                </button>
                <button onClick={() => setDeclineModal(true)} style={{ ...btn('transparent', TEXT, isMobile), border: '1px solid rgba(255,255,255,0.15)' }}>
                  Request Changes
                </button>
                {shop.phone && <a href={`tel:${shop.phone}`} style={{ ...btn('transparent', MUTED), border: '1px solid rgba(255,255,255,0.08)', textDecoration: 'none', textAlign: 'center', width: isMobile ? '100%' : undefined }}>Call Shop</a>}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Pay */}
        {tab === 2 && (
          <div style={c}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Payment</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: MUTED }}>Labor</span><span style={{ fontFamily: 'monospace' }}>${laborTotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: MUTED }}>Parts</span><span style={{ fontFamily: 'monospace' }}>${partsTotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: MUTED }}>Shop Charges</span><span style={{ fontFamily: 'monospace' }}>${chargesTotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: MUTED }}>Tax</span><span style={{ fontFamily: 'monospace' }}>${tax.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12, marginTop: 8 }}>
              <span>Amount Due</span><span>${grandTotal.toFixed(2)}</span>
            </div>
            <button disabled style={{ ...btn(BLUE, '#fff', true), opacity: 0.5, marginTop: 16, cursor: 'not-allowed' }}>Pay Now</button>
            <div style={{ fontSize: 12, color: MUTED, textAlign: 'center', marginTop: 8 }}>Online payments coming soon. Contact the shop at {shop.phone || 'the number on your invoice'}.</div>
          </div>
        )}

        {/* Tab 3: History */}
        {tab === 3 && (
          <div>
            {history.length === 0 && <div style={{ ...c, textAlign: 'center', color: MUTED }}>No previous work orders</div>}
            {history.map((h: any) => {
              const hs = STATUS_MAP[h.status] || STATUS_MAP.draft
              return (
                <div key={h.id} style={c}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{h.so_number}</div>
                      <div style={{ fontSize: 12, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.complaint?.slice(0, 60) || '—'}</div>
                      <div style={{ fontSize: 11, color: MUTED }}>{h.created_at ? new Date(h.created_at).toLocaleDateString() : '—'}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={pill(hs.color)}>{hs.label}</span>
                      {h.grand_total > 0 && <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>${Number(h.grand_total).toFixed(0)}</div>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '32px 0 16px', fontSize: 11, color: MUTED }}>Powered by TruckZen</div>
      </div>

      {/* Decline Modal */}
      {declineModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 16 }}>
          <div style={{ background: '#1C1C2A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: isMobile ? 20 : 28, maxWidth: 440, width: '100%' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Request Changes</div>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>Let the shop know what changes you need.</div>
            <textarea
              value={declineReason}
              onChange={e => setDeclineReason(e.target.value)}
              placeholder="Why are you declining? (optional)"
              rows={4}
              style={{
                width: '100%', padding: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, color: TEXT, fontSize: 14, fontFamily: FONT, resize: 'vertical', outline: 'none', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexDirection: isMobile ? 'column-reverse' : 'row', justifyContent: 'flex-end' }}>
              <button onClick={() => { setDeclineModal(false); setDeclineReason('') }} style={{ ...btn('transparent', MUTED), border: '1px solid rgba(255,255,255,0.1)', width: isMobile ? '100%' : undefined }}>
                Cancel
              </button>
              <button onClick={declineEstimate} disabled={actionLoading === 'decline'} style={btn(RED, '#fff', isMobile)}>
                {actionLoading === 'decline' ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
