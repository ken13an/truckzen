'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { COLORS, FONT } from '@/lib/config/colors'

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending: { bg: COLORS.amberBg, color: COLORS.amber },
  processing: { bg: COLORS.blueBg, color: COLORS.blueLight },
  completed: { bg: COLORS.greenBg, color: COLORS.green },
  denied: { bg: COLORS.redBg, color: COLORS.red },
}

export default function DataRequestsPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState('')
  const [denyModal, setDenyModal] = useState<string | null>(null)
  const [denyReason, setDenyReason] = useState('')
  const [toast, setToast] = useState('')

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    getCurrentUser(supabase).then((p: any) => {
      if (!p) { window.location.href = '/login'; return }
      if (!['owner', 'gm'].includes(p.role)) { window.location.href = '/403'; return }
      setUser(p)
      fetchRequests(p.shop_id)
    })
  }, [])

  async function fetchRequests(shopId?: string) {
    const sid = shopId || user?.shop_id
    if (!sid) return
    setLoading(true)
    const res = await fetch(`/api/data-requests?shop_id=${sid}`)
    if (res.ok) setRequests(await res.json())
    setLoading(false)
  }

  async function processRequest(id: string) {
    if (!user) return
    setProcessing(id)
    const res = await fetch(`/api/data-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'process', processed_by: user.id }),
    })
    if (res.ok) {
      flash('Request processed successfully')
      await fetchRequests()
    } else {
      flash('Failed to process request')
    }
    setProcessing('')
  }

  async function denyRequest() {
    if (!denyModal || !user) return
    setProcessing(denyModal)
    const res = await fetch(`/api/data-requests/${denyModal}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deny', processed_by: user.id, notes: denyReason }),
    })
    if (res.ok) {
      flash('Request denied')
      await fetchRequests()
    } else {
      flash('Failed to deny request')
    }
    setDenyModal(null)
    setDenyReason('')
    setProcessing('')
  }

  const btnStyle = (bg: string, color: string): React.CSSProperties => ({
    padding: '6px 14px',
    background: bg,
    color,
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: FONT,
  })

  if (!user) return null

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, fontFamily: FONT, color: COLORS.text, padding: 24 }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>Data Requests</h1>

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed', top: 20, right: 20, zIndex: 1000,
            background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 10,
            padding: '12px 20px', fontSize: 13, fontWeight: 600, color: COLORS.text,
          }}>{toast}</div>
        )}

        {/* Table */}
        <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                {['Customer', 'Request Type', 'Reason', 'Date', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 14px', color: COLORS.textSecondary, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: COLORS.textSecondary }}>Loading...</td></tr>
              ) : requests.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: COLORS.textSecondary }}>No data requests</td></tr>
              ) : requests.map(r => {
                const sc = STATUS_COLORS[r.status] || STATUS_COLORS.pending
                return (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <td style={{ padding: '10px 14px' }}>
                      {r.customers?.company_name || r.customers?.contact_name || r.customer_id?.slice(0, 8)}
                    </td>
                    <td style={{ padding: '10px 14px', textTransform: 'capitalize' }}>{r.request_type}</td>
                    <td style={{ padding: '10px 14px', color: COLORS.textSecondary, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.reason || '—'}
                    </td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: COLORS.textSecondary }}>
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700,
                        background: sc.bg, color: sc.color,
                      }}>{r.status}</span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {r.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => processRequest(r.id)}
                            disabled={processing === r.id}
                            style={btnStyle(COLORS.green, '#fff')}
                          >
                            {processing === r.id ? '...' : 'Process'}
                          </button>
                          <button
                            onClick={() => setDenyModal(r.id)}
                            style={btnStyle('transparent', COLORS.red)}
                          >
                            Deny
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deny Modal */}
      {denyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 16 }}>
          <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 28, maxWidth: 440, width: '100%' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Deny Request</div>
            <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 16 }}>Provide a reason for denial.</div>
            <textarea
              value={denyReason}
              onChange={e => setDenyReason(e.target.value)}
              placeholder="Reason for denial (optional)"
              rows={4}
              style={{
                width: '100%', padding: 12, background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                borderRadius: 10, color: COLORS.text, fontSize: 14, fontFamily: FONT, resize: 'vertical', outline: 'none', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => { setDenyModal(null); setDenyReason('') }} style={{ ...btnStyle('transparent', COLORS.textSecondary), border: `1px solid ${COLORS.border}` }}>
                Cancel
              </button>
              <button onClick={denyRequest} disabled={!!processing} style={btnStyle(COLORS.red, '#fff')}>
                {processing ? 'Denying...' : 'Deny Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
