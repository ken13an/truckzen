'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { Check, X, Clock, Building2 } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

export default function PlatformRegistrations() {
  const { tokens: t } = useTheme()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [regs, setRegs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(''), 4000) }

  useEffect(() => {
    async function load() {
      const u = await getCurrentUser(supabase)
      if (!u) return
      setUser(u)
      await fetchRegs(u.id)
      setLoading(false)
    }
    load()
  }, [])

  async function fetchRegs(userId: string) {
    const res = await fetch(`/api/platform-admin/registrations?user_id=${userId}`)
    if (res.ok) setRegs(await res.json())
  }

  async function handleApprove(reg: any) {
    if (!user || !confirm(`Approve ${reg.shop_name}? This will create a new shop and user account.`)) return
    setProcessing(reg.id)
    const res = await fetch('/api/platform-admin/registrations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, registration_id: reg.id, action: 'approve' }),
    })
    setProcessing(null)
    if (res.ok) { flash(`${reg.shop_name} approved! Welcome email sent.`); await fetchRegs(user.id) }
    else { const err = await res.json(); flash(`Error: ${err.error}`) }
  }

  async function handleReject() {
    if (!user || !rejectId || !rejectReason.trim()) return
    setProcessing(rejectId)
    const res = await fetch('/api/platform-admin/registrations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, registration_id: rejectId, action: 'reject', reject_reason: rejectReason.trim() }),
    })
    setProcessing(null)
    setRejectId(null)
    setRejectReason('')
    if (res.ok) { flash('Registration rejected.'); await fetchRegs(user.id) }
    else { const err = await res.json(); flash(`Error: ${err.error}`) }
  }

  function fmtDate(d: string) {
    return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  const fleetLabels: Record<string, string> = { '1': '1-10', '2': '11-50', '3': '51-200', '4': '200+' }

  if (loading) return <div style={{ color: 'var(--tz-textSecondary)', fontSize: 13, padding: 40 }}>Loading...</div>

  const pending = regs.filter(r => r.status === 'pending')
  const reviewed = regs.filter(r => r.status !== 'pending')

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: 'var(--tz-accent)', color: 'var(--tz-bgLight)', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 9999 }}>{toast}</div>
      )}

      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tz-text)', margin: '0 0 24px' }}>Shop Registrations</h1>

      {/* Pending */}
      <h2 style={{ fontSize: 13, fontWeight: 600, color: '#F59E0B', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Clock size={14} /> Pending ({pending.length})
      </h2>

      {pending.length === 0 ? (
        <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, padding: 32, textAlign: 'center', color: 'var(--tz-textTertiary)', fontSize: 12, marginBottom: 32 }}>
          No pending registrations
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          {pending.map(reg => (
            <div key={reg.id} style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--tz-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Building2 size={16} color={'var(--tz-accent)'} /> {reg.shop_name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--tz-textSecondary)', marginTop: 4 }}>{reg.owner_name} &middot; {reg.owner_email}{reg.owner_phone ? ` · ${reg.owner_phone}` : ''}</div>
                </div>
                <span style={{ fontSize: 10, color: 'var(--tz-textTertiary)' }}>{fmtDate(reg.created_at)}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
                {[
                  { label: 'Location', value: [reg.city, reg.state].filter(Boolean).join(', ') || '—' },
                  { label: 'Fleet Size', value: reg.fleet_size || '—' },
                  { label: 'Current Software', value: reg.current_software || '—' },
                ].map(f => (
                  <div key={f.label}>
                    <div style={{ fontSize: 9, color: 'var(--tz-textTertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'IBM Plex Mono', monospace", marginBottom: 2 }}>{f.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--tz-text)' }}>{f.value}</div>
                  </div>
                ))}
              </div>

              {reg.message && (
                <div style={{ background: 'var(--tz-border)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
                  <div style={{ fontSize: 9, color: 'var(--tz-textTertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'IBM Plex Mono', monospace", marginBottom: 4 }}>Message</div>
                  <div style={{ fontSize: 12, color: 'var(--tz-text)', lineHeight: 1.5 }}>{reg.message}</div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleApprove(reg)} disabled={processing === reg.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', background: 'var(--tz-accent)', color: 'var(--tz-bgLight)', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: processing === reg.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  <Check size={14} /> {processing === reg.id ? 'Processing...' : 'Approve'}
                </button>
                <button onClick={() => { setRejectId(reg.id); setRejectReason('') }} disabled={processing === reg.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', background: 'rgba(217,79,79,.12)', color: '#D94F4F', border: '1px solid rgba(217,79,79,.2)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <X size={14} /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reviewed */}
      <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--tz-textSecondary)', margin: '0 0 12px' }}>Reviewed ({reviewed.length})</h2>
      <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Shop', 'Owner', 'Email', 'Status', 'Date', 'Reason'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 10, color: 'var(--tz-textTertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'IBM Plex Mono', monospace", borderBottom: `1px solid ${'var(--tz-border)'}`, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reviewed.map(reg => (
              <tr key={reg.id}>
                <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--tz-text)', borderBottom: `1px solid ${'var(--tz-border)'}` }}>{reg.shop_name}</td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--tz-textSecondary)', borderBottom: `1px solid ${'var(--tz-border)'}` }}>{reg.owner_name}</td>
                <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--tz-textTertiary)', borderBottom: `1px solid ${'var(--tz-border)'}`, fontFamily: "'IBM Plex Mono', monospace" }}>{reg.owner_email}</td>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${'var(--tz-border)'}` }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: reg.status === 'approved' ? '#22C55E' : '#D94F4F', background: reg.status === 'approved' ? 'rgba(34,197,94,.12)' : 'rgba(217,79,79,.12)', padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase' }}>{reg.status}</span>
                </td>
                <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--tz-textTertiary)', borderBottom: `1px solid ${'var(--tz-border)'}` }}>{fmtDate(reg.reviewed_at || reg.created_at)}</td>
                <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--tz-textSecondary)', borderBottom: `1px solid ${'var(--tz-border)'}`, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{reg.reject_reason || '—'}</td>
              </tr>
            ))}
            {reviewed.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: 'var(--tz-textTertiary)', fontSize: 12 }}>No reviewed registrations</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Reject Reason Modal */}
      {rejectId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setRejectId(null)}>
          <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 16, padding: 32, width: 400 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--tz-text)', margin: '0 0 16px' }}>Rejection Reason</h3>
            <p style={{ fontSize: 12, color: 'var(--tz-textSecondary)', margin: '0 0 12px' }}>This will be sent to the applicant.</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Enter reason for rejection..."
              rows={4}
              style={{ width: '100%', padding: '10px 12px', background: 'var(--tz-border)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 8, fontSize: 13, color: 'var(--tz-text)', outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={handleReject} disabled={!rejectReason.trim()} style={{ flex: 1, padding: 10, background: rejectReason.trim() ? '#D94F4F' : 'var(--tz-border)', color: rejectReason.trim() ? 'var(--tz-bgLight)' : 'var(--tz-textTertiary)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: rejectReason.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                Reject
              </button>
              <button onClick={() => setRejectId(null)} style={{ padding: '10px 20px', background: 'var(--tz-border)', color: 'var(--tz-textSecondary)', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
