'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Logo from '@/components/Logo'
import { ChevronLeft } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface SOLine {
  id: string
  description: string
  line_type: string
  quantity: number
  unit_price: number
  total_price: number
  line_status: string
  is_additional: boolean
  customer_approved: boolean | null
  finding: string | null
  resolution: string | null
  estimated_hours: number
  billed_hours: number
}

interface ShopCharge {
  id: string
  description: string
  amount: number
}

interface PortalData {
  so_number: string
  status: string
  complaint: string
  grand_total: number
  auth_type: string
  auth_limit: number
  approved_at: string | null
  assets: { unit_number: string; year: string; make: string; model: string; vin: string }
  customers: { company_name: string }
  so_lines: SOLine[]
  wo_shop_charges: ShopCharge[]
  shop: { name: string; dba: string; tax_rate: number; tax_labor: boolean }
  checkin: { need_by_date: string | null; contact_email: string | null; created_at?: string }
}

interface HistoryItem {
  id: string
  so_number: string
  status: string
  complaint: string
  grand_total: number
  created_at: string
  unit_number: string
  year: string
  make: string
  model: string
}

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft:              { label: 'Draft',           color: '#6B7280' },
  not_started:        { label: 'Not Started',     color: '#6B7280' },
  in_progress:        { label: 'In Progress',     color: '#1D6FE8' },
  waiting_parts:      { label: 'Waiting Parts',   color: '#EA580C' },
  waiting_approval:   { label: 'Pending Review',  color: '#D97706' },
  authorized:         { label: 'Approved',        color: '#16A34A' },
  done:               { label: 'Completed',       color: '#16A34A' },
  good_to_go:         { label: 'Ready for Pickup',color: '#16A34A' },
  completed:          { label: 'Completed',       color: '#16A34A' },
  invoiced:           { label: 'Invoiced',        color: '#1D6FE8' },
  closed:             { label: 'Closed',          color: '#6B7280' },
}

const LINE_STATUS_MAP: Record<string, { label: string; color: string }> = {
  completed:   { label: 'Completed',   color: '#16A34A' },
  in_progress: { label: 'In Progress', color: '#1D6FE8' },
  unassigned:  { label: 'Queued',      color: '#6B7280' },
}

function StatusPill({ status }: { status: string }) {
  const st = STATUS_MAP[status] || { label: status, color: '#6B7280' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600,
      background: st.color + '18', color: st.color, border: `1px solid ${st.color}33`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
      {st.label}
    </span>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────────

const FONT = "'Instrument Sans', sans-serif"
const BG = '#151520'
const TEXT = '#EDEDF0'
const MUTED = '#8A8A9A'
const BLUE = '#1D6FE8'
const GREEN = '#16A34A'
const AMBER = '#D97706'
const RED = '#DC2626'

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: 16,
}

const btnBase: React.CSSProperties = {
  borderRadius: 12, fontWeight: 700, fontFamily: FONT, cursor: 'pointer', fontSize: 14,
  border: 'none', padding: '12px 24px', display: 'inline-flex', alignItems: 'center',
  justifyContent: 'center',
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function CustomerPortalPage() {
  const params = useParams()
  const token = params.token as string

  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(0)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/${token}`)
      if (!res.ok) {
        if (res.status === 404) setError('Work order not found or link expired.')
        else setError('Something went wrong. Please try again.')
        return
      }
      const json = await res.json()
      setData(json)
      setError(null)
    } catch {
      setError('Unable to connect. Check your internet connection.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  // ── History fetch ──────────────────────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    if (history.length > 0) return
    setHistoryLoading(true)
    try {
      const res = await fetch(`/api/portal/${token}/history`)
      if (res.ok) setHistory(await res.json())
    } finally {
      setHistoryLoading(false)
    }
  }, [token, history.length])

  useEffect(() => {
    if (activeTab === 3) fetchHistory()
  }, [activeTab, fetchHistory])

  // ── Actions ────────────────────────────────────────────────────────────────

  async function approveEstimate() {
    setActionLoading('estimate')
    try {
      await fetch(`/api/portal/${token}/approve`, { method: 'POST' })
      await fetchData()
    } finally {
      setActionLoading(null)
    }
  }

  async function approveJob(lineId: string) {
    setActionLoading(lineId)
    try {
      await fetch(`/api/portal/${token}/approve-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line_id: lineId }),
      })
      await fetchData()
    } finally {
      setActionLoading(null)
    }
  }

  async function declineJob(lineId: string) {
    setActionLoading(lineId)
    try {
      await fetch(`/api/portal/${token}/decline-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line_id: lineId }),
      })
      await fetchData()
    } finally {
      setActionLoading(null)
    }
  }

  // ── Loading / Error states ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
        <div style={{ color: MUTED, fontSize: 14 }}>Loading your work order...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, padding: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
          <div style={{ color: TEXT, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Link Invalid</div>
          <div style={{ color: MUTED, fontSize: 14, maxWidth: 320 }}>{error || 'This portal link is not valid.'}</div>
        </div>
      </div>
    )
  }

  // ── Computed values ────────────────────────────────────────────────────────

  const lines = data.so_lines || []
  const shopCharges = data.wo_shop_charges || []
  const completedCount = lines.filter(l => l.line_status === 'completed').length
  const totalCount = lines.length
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  const additionalPending = lines.filter(l => l.is_additional === true && l.customer_approved === null)

  const asset = data.assets
  const vin = asset?.vin || ''
  const vinLast6 = vin.length >= 6 ? vin.slice(-6) : vin
  const vinPrefix = vin.length > 6 ? vin.slice(0, -6) : ''

  const partsLines = lines.filter(l => l.line_type === 'part')
  const laborLines = lines.filter(l => l.line_type !== 'part')
  const partsSubtotal = partsLines.reduce((s, l) => s + (l.total_price || (l.quantity || 0) * (l.unit_price || 0)), 0)
  const laborSubtotal = laborLines.reduce((s, l) => s + ((l.billed_hours || l.quantity || 0) * (l.unit_price || 0)), 0)
  const chargesSubtotal = shopCharges.reduce((s, c) => s + (c.amount || 0), 0)
  const subtotal = partsSubtotal + laborSubtotal + chargesSubtotal
  const taxBase = partsSubtotal + (data.shop?.tax_labor ? laborSubtotal : 0)
  const taxAmount = taxBase * ((data.shop?.tax_rate || 0) / 100)
  const grandTotal = data.grand_total || subtotal + taxAmount

  const TABS = ['Status', 'Estimate', 'Pay', 'History']

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: BG, minHeight: '100vh', fontFamily: FONT, color: TEXT }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px', boxSizing: 'border-box' }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Logo size="sm" />
            {data.shop?.dba && (
              <span style={{ fontSize: 13, fontWeight: 600, color: MUTED }}>{data.shop.dba}</span>
            )}
          </div>
          <span style={{
            padding: '4px 12px', borderRadius: 100, fontSize: 11, fontWeight: 600,
            background: BLUE + '20', color: BLUE,
          }}>
            Customer Portal
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: TEXT }}>{data.so_number}</span>
          <StatusPill status={data.status} />
        </div>

        {/* ── Tab Bar ─────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 20,
        }}>
          {TABS.map((tab, i) => (
            <button key={tab} onClick={() => setActiveTab(i)} style={{
              flex: 1, padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: FONT, fontSize: 13, color: activeTab === i ? TEXT : MUTED,
              fontWeight: activeTab === i ? 700 : 400,
              borderBottom: activeTab === i ? `2px solid ${BLUE}` : '2px solid transparent',
              transition: 'all 0.15s',
            }}>
              {tab}
            </button>
          ))}
        </div>

        {/* ── TAB 0: STATUS ───────────────────────────────────────────────── */}
        {activeTab === 0 && (
          <div>
            {/* Vehicle + Customer Info */}
            <div style={{ ...card, marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>{data.customers?.company_name}</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                Unit #{asset?.unit_number} — {asset?.year} {asset?.make} {asset?.model}
              </div>
              <div style={{ fontSize: 13, color: MUTED, marginBottom: 8 }}>
                VIN: {vinPrefix}<span style={{ fontWeight: 700, color: TEXT }}>{vinLast6}</span>
              </div>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                {data.checkin?.created_at && (
                  <div>
                    <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>Checked In</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {new Date(data.checkin.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                )}
                {data.checkin?.need_by_date && (
                  <div>
                    <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>Need By</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {new Date(data.checkin.need_by_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <div style={{ ...card, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Progress</span>
                <span style={{ fontSize: 12, color: MUTED }}>{completedCount} of {totalCount} jobs completed</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.08)' }}>
                <div style={{
                  height: '100%', borderRadius: 4, width: `${progressPct}%`,
                  background: progressPct === 100 ? GREEN : BLUE,
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>

            {/* Job List */}
            <div style={{ ...card, marginBottom: 16, padding: 0 }}>
              {lines.map((line, i) => {
                const ls = LINE_STATUS_MAP[line.line_status] || LINE_STATUS_MAP.unassigned
                return (
                  <div key={line.id} style={{
                    padding: 16,
                    borderBottom: i < lines.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: ls.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {line.description}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: ls.color, fontWeight: 600, flexShrink: 0 }}>{ls.label}</span>
                  </div>
                )
              })}
              {lines.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: MUTED, fontSize: 13 }}>No jobs on this work order yet.</div>
              )}
            </div>

            {/* Additional Repairs Alert */}
            {additionalPending.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: AMBER, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 16 }}>⚠</span> Additional Repairs Recommended
                </div>
                {additionalPending.map(line => (
                  <div key={line.id} style={{
                    ...card,
                    borderColor: AMBER + '55',
                    marginBottom: 10,
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{line.description}</div>
                    {line.finding && (
                      <div style={{ fontSize: 12, color: MUTED, marginBottom: 12, lineHeight: 1.5 }}>{line.finding}</div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button
                        onClick={() => approveJob(line.id)}
                        disabled={actionLoading === line.id}
                        style={{
                          ...btnBase,
                          background: GREEN, color: '#fff', fontSize: 13,
                          padding: '10px 20px',
                          opacity: actionLoading === line.id ? 0.6 : 1,
                        }}
                      >
                        {actionLoading === line.id ? 'Saving...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => declineJob(line.id)}
                        disabled={actionLoading === line.id}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontFamily: FONT, fontSize: 13, fontWeight: 700, color: RED,
                          opacity: actionLoading === line.id ? 0.6 : 1,
                        }}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 1: ESTIMATE ─────────────────────────────────────────────── */}
        {activeTab === 1 && (
          <div>
            {/* Job Lines */}
            <div style={{ ...card, marginBottom: 16, padding: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {['Description', 'Hrs', 'Rate', 'Parts', 'Total'].map(h => (
                      <th key={h} style={{
                        padding: '10px 12px', textAlign: h === 'Description' ? 'left' : 'right',
                        fontSize: 10, fontWeight: 600, color: MUTED, textTransform: 'uppercase',
                        letterSpacing: '.05em',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={line.id} style={{ borderBottom: i < lines.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{line.description}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: MUTED }}>{line.billed_hours || line.quantity || '—'}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: MUTED }}>{line.unit_price ? `$${Number(line.unit_price).toFixed(0)}` : '—'}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: MUTED }}>{line.line_type === 'part' ? `$${(line.total_price || 0).toFixed(2)}` : '—'}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>${(line.total_price || (line.quantity || 0) * (line.unit_price || 0)).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Shop Charges */}
            {shopCharges.length > 0 && (
              <div style={{ ...card, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
                  Shop Charges
                </div>
                {shopCharges.map(ch => (
                  <div key={ch.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
                    <span style={{ color: MUTED }}>{ch.description}</span>
                    <span style={{ fontWeight: 600 }}>${(ch.amount || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Totals */}
            <div style={{ ...card, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
                <span style={{ color: MUTED }}>Subtotal</span>
                <span style={{ fontWeight: 600 }}>${subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
                <span style={{ color: MUTED }}>Tax ({data.shop?.tax_rate || 0}%)</span>
                <span style={{ fontWeight: 600 }}>${taxAmount.toFixed(2)}</span>
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', padding: '12px 0 0',
                marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: 16,
              }}>
                <span style={{ fontWeight: 700 }}>Grand Total</span>
                <span style={{ fontWeight: 800 }}>${grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Approval Actions */}
            {data.auth_type === 'estimate_first' && !data.approved_at && (
              <div style={{ ...card, marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Estimate Approval Required</div>
                <div style={{ fontSize: 12, color: MUTED, marginBottom: 16 }}>
                  Please review the estimate above and approve to begin repairs.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    onClick={approveEstimate}
                    disabled={actionLoading === 'estimate'}
                    style={{
                      ...btnBase, width: '100%',
                      background: GREEN, color: '#fff',
                      opacity: actionLoading === 'estimate' ? 0.6 : 1,
                    }}
                  >
                    {actionLoading === 'estimate' ? 'Approving...' : 'Approve Estimate'}
                  </button>
                  <a
                    href={data.checkin?.contact_email ? `mailto:${data.checkin.contact_email}` : '#'}
                    style={{
                      ...btnBase, width: '100%', textDecoration: 'none', textAlign: 'center',
                      background: 'transparent', color: TEXT,
                      border: '1px solid rgba(255,255,255,0.15)',
                      boxSizing: 'border-box',
                    }}
                  >
                    Call Shop
                  </a>
                  <button style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: FONT, fontSize: 13, fontWeight: 700, color: RED,
                    padding: '8px 0',
                  }}>
                    Decline
                  </button>
                </div>
              </div>
            )}

            {data.approved_at && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 100, fontSize: 13, fontWeight: 700,
                background: GREEN + '20', color: GREEN,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN }} />
                Approved on {new Date(data.approved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: PAY ──────────────────────────────────────────────────── */}
        {activeTab === 2 && (
          <div>
            <div style={{ ...card, textAlign: 'center', padding: 32 }}>
              <div style={{ fontSize: 12, color: MUTED, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Amount Due</div>
              <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 24 }}>${grandTotal.toFixed(2)}</div>
              <button
                disabled
                style={{
                  ...btnBase, width: '100%',
                  background: BLUE, color: '#fff',
                  opacity: 0.5, cursor: 'not-allowed',
                }}
              >
                Pay Now
              </button>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 10 }}>
                Online payments coming soon
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: HISTORY ──────────────────────────────────────────────── */}
        {activeTab === 3 && (
          <div>
            {historyLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: MUTED, fontSize: 13 }}>Loading history...</div>
            ) : history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: MUTED, fontSize: 13 }}>No past work orders found.</div>
            ) : (
              history.map(item => {
                const isExpanded = expandedHistory === item.id
                return (
                  <div
                    key={item.id}
                    onClick={() => setExpandedHistory(isExpanded ? null : item.id)}
                    style={{ ...card, marginBottom: 10, cursor: 'pointer', transition: 'background 0.15s' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: 11, color: BLUE, fontWeight: 600, marginBottom: 2 }}>{item.so_number}</div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>
                          Unit #{item.unit_number} — {item.year} {item.make} {item.model}
                        </div>
                      </div>
                      <StatusPill status={item.status} />
                    </div>
                    <div style={{ fontSize: 12, color: MUTED, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isExpanded ? 'normal' : 'nowrap' }}>
                      {item.complaint || 'No description'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: MUTED }}>
                        {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      {item.grand_total != null && (
                        <span style={{ fontSize: 13, fontWeight: 700 }}>${Number(item.grand_total).toFixed(2)}</span>
                      )}
                    </div>
                    {isExpanded && item.complaint && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 13, color: MUTED, lineHeight: 1.6 }}>
                        {item.complaint}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

      </div>
    </div>
  )
}
