'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

const FONT = "'Inter', -apple-system, sans-serif"
const BG = '#0f0f1a', CARD = '#1a1a2e', BORDER = '#2a2a3a'
const TEXT = '#e0e0e0', MUTED = '#8a8a9a', WHITE = '#ffffff'
const BLUE = '#1D6FE8', GREEN = '#16A34A', RED = '#DC2626'

export default function EstimatePortalPage() {
  const params = useParams()
  const token = params.token as string

  const [estimate, setEstimate] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [responded, setResponded] = useState(false)
  const [responseStatus, setResponseStatus] = useState('')
  const [actionLoading, setActionLoading] = useState('')
  const [showDecline, setShowDecline] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/portal/${token}/estimate`)
        if (!res.ok) {
          setError(res.status === 404 ? 'Estimate not found or expired.' : 'Failed to load estimate.')
          setLoading(false)
          return
        }
        const data = await res.json()
        setEstimate(data)
        if (data.status === 'approved' || data.status === 'declined') {
          setResponded(true)
          setResponseStatus(data.status)
        }
      } catch {
        setError('Unable to connect.')
      }
      setLoading(false)
    }
    load()
  }, [token])

  async function handleApprove() {
    setActionLoading('approve')
    try {
      const res = await fetch(`/api/estimates/${estimate.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', token }),
      })
      if (res.ok) {
        setResponded(true)
        setResponseStatus('approved')
      }
    } catch { /* ignore */ }
    setActionLoading('')
  }

  async function handleDecline() {
    setActionLoading('decline')
    try {
      const res = await fetch(`/api/estimates/${estimate.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline', token, reason: declineReason }),
      })
      if (res.ok) {
        setResponded(true)
        setResponseStatus('declined')
        setShowDecline(false)
      }
    } catch { /* ignore */ }
    setActionLoading('')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: WHITE, marginBottom: 8 }}>TRUCK<span style={{ color: BLUE }}>ZEN</span></div>
        <div style={{ fontSize: 13 }}>Loading estimate...</div>
      </div>
    </div>
  )

  if (error || !estimate) return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: RED }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: WHITE, marginBottom: 8 }}>TRUCK<span style={{ color: BLUE }}>ZEN</span></div>
        <div style={{ fontSize: 14, marginTop: 16 }}>{error || 'Estimate not found'}</div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>The link may be invalid or expired.</div>
      </div>
    </div>
  )

  const so = estimate.service_order
  const asset = so?.assets as any
  const shop = estimate.shop
  const lines = estimate.lines || []

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: FONT, color: TEXT }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: isMobile ? '16px 12px' : '32px 16px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: WHITE, letterSpacing: '.05em' }}>
            TRUCK<span style={{ color: BLUE }}>ZEN</span>
          </div>
          {shop?.dba && <div style={{ fontSize: 14, color: MUTED, marginTop: 4 }}>{shop.dba || shop.name}</div>}
        </div>

        {/* Responded confirmation */}
        {responded && (
          <div style={{
            background: responseStatus === 'approved' ? `${GREEN}15` : `${RED}15`,
            border: `1px solid ${responseStatus === 'approved' ? GREEN : RED}40`,
            borderRadius: 12, padding: 24, textAlign: 'center', marginBottom: 24,
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{responseStatus === 'approved' ? '\u2713' : '\u2717'}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: responseStatus === 'approved' ? GREEN : RED }}>
              Estimate {responseStatus === 'approved' ? 'Approved' : 'Declined'}
            </div>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 8 }}>
              {responseStatus === 'approved'
                ? 'Thank you! The shop has been notified and will begin work on your vehicle.'
                : 'The shop has been notified of your decision. They may follow up with you.'}
            </div>
          </div>
        )}

        {/* Truck info */}
        {asset && (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Vehicle</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: WHITE }}>
              Unit #{asset.unit_number} — {asset.year} {asset.make} {asset.model}
            </div>
            {so?.so_number && <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>WO: {so.so_number}</div>}
          </div>
        )}

        {/* Estimate header */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: WHITE }}>{estimate.estimate_number}</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                {new Date(estimate.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {estimate.valid_until && (
                <div style={{ fontSize: 11, color: new Date(estimate.valid_until) < new Date() ? RED : MUTED }}>
                  Valid until {new Date(estimate.valid_until).toLocaleDateString()}
                </div>
              )}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px',
                borderRadius: 100, fontSize: 11, fontWeight: 700, marginTop: 4,
                background: estimate.status === 'approved' ? `${GREEN}20` : estimate.status === 'declined' ? `${RED}20` : `${BLUE}20`,
                color: estimate.status === 'approved' ? GREEN : estimate.status === 'declined' ? RED : BLUE,
              }}>
                {estimate.status.charAt(0).toUpperCase() + estimate.status.slice(1)}
              </div>
            </div>
          </div>
        </div>

        {/* Line items */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
              <thead>
                <tr style={{ background: '#15152a' }}>
                  {['Description', 'Hours', 'Labor', 'Parts', 'Total'].map(h => (
                    <th key={h} style={{
                      padding: '10px 12px', textAlign: h === 'Description' ? 'left' : 'right',
                      color: MUTED, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((l: any) => (
                  <tr key={l.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: '12px', color: WHITE, fontSize: 13, fontWeight: 600 }}>
                      {l.description}
                      {l.complaint && <div style={{ fontSize: 11, color: MUTED, marginTop: 2, fontWeight: 400 }}>{l.complaint}</div>}
                    </td>
                    <td style={{ padding: '12px', color: MUTED, fontSize: 13, textAlign: 'right', fontFamily: 'monospace' }}>{l.labor_hours || 0}</td>
                    <td style={{ padding: '12px', color: MUTED, fontSize: 13, textAlign: 'right', fontFamily: 'monospace' }}>${(l.labor_total || 0).toFixed(2)}</td>
                    <td style={{ padding: '12px', color: MUTED, fontSize: 13, textAlign: 'right', fontFamily: 'monospace' }}>${(l.parts_total || 0).toFixed(2)}</td>
                    <td style={{ padding: '12px', color: WHITE, fontSize: 13, fontWeight: 700, textAlign: 'right', fontFamily: 'monospace' }}>${(l.line_total || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div style={{ padding: '16px', borderTop: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: MUTED, marginBottom: 6 }}>
              <span>Subtotal</span>
              <span style={{ fontFamily: 'monospace' }}>${(estimate.subtotal || 0).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: MUTED, marginBottom: 6 }}>
              <span>Tax</span>
              <span style={{ fontFamily: 'monospace' }}>${(estimate.tax_amount || 0).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 800, color: WHITE, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
              <span>Total</span>
              <span>${(estimate.total || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {estimate.notes && !estimate.notes.startsWith('[DECLINED]') && (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Notes</div>
            <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{estimate.notes}</div>
          </div>
        )}

        {/* Action buttons */}
        {!responded && estimate.status !== 'approved' && estimate.status !== 'declined' && (
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 10, marginTop: 20, marginBottom: 20 }}>
            <button
              onClick={handleApprove}
              disabled={!!actionLoading}
              style={{
                flex: 1, padding: '14px 24px', background: GREEN, color: '#fff', border: 'none',
                borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
                opacity: actionLoading ? 0.6 : 1,
              }}
            >
              {actionLoading === 'approve' ? 'Approving...' : 'Approve Estimate'}
            </button>
            {shop?.phone && (
              <a
                href={`tel:${shop.phone}`}
                style={{
                  flex: isMobile ? undefined : 0.6, padding: '14px 24px', background: 'transparent', color: BLUE,
                  border: `1px solid ${BLUE}40`, borderRadius: 12, fontSize: 15, fontWeight: 700, textDecoration: 'none',
                  textAlign: 'center', fontFamily: FONT,
                }}
              >
                Call Shop
              </a>
            )}
            <button
              onClick={() => setShowDecline(true)}
              style={{
                flex: isMobile ? undefined : 0.6, padding: '14px 24px', background: 'transparent', color: RED,
                border: `1px solid ${RED}40`, borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer',
                fontFamily: FONT,
              }}
            >
              Decline
            </button>
          </div>
        )}

        {/* Decline modal */}
        {showDecline && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 16,
          }}>
            <div style={{ background: '#1c1c2e', border: `1px solid ${BORDER}`, borderRadius: 16, padding: isMobile ? 20 : 28, maxWidth: 440, width: '100%' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: WHITE, marginBottom: 4 }}>Decline Estimate</div>
              <div style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>Let the shop know why you are declining.</div>
              <textarea
                value={declineReason}
                onChange={e => setDeclineReason(e.target.value)}
                placeholder="Reason (optional)"
                rows={4}
                style={{
                  width: '100%', padding: 12, background: 'rgba(255,255,255,0.06)', border: `1px solid ${BORDER}`,
                  borderRadius: 10, color: TEXT, fontSize: 14, fontFamily: FONT, resize: 'vertical',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 16, flexDirection: isMobile ? 'column-reverse' : 'row', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setShowDecline(false); setDeclineReason('') }}
                  style={{
                    padding: '12px 24px', background: 'transparent', color: MUTED, border: `1px solid ${BORDER}`,
                    borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
                    width: isMobile ? '100%' : undefined,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDecline}
                  disabled={actionLoading === 'decline'}
                  style={{
                    padding: '12px 24px', background: RED, color: '#fff', border: 'none',
                    borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
                    opacity: actionLoading === 'decline' ? 0.6 : 1,
                    width: isMobile ? '100%' : undefined,
                  }}
                >
                  {actionLoading === 'decline' ? 'Submitting...' : 'Decline Estimate'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '32px 0 16px', fontSize: 11, color: MUTED }}>
          Powered by TruckZen
        </div>
      </div>
    </div>
  )
}
