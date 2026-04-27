/**
 * Pending Request review surface.
 * Service writer opens a kiosk/manual service request, reviews the original
 * customer text in a read-only "Note from Customer" panel, and presses
 * Convert to Work Order. The original wording is preserved on the WO when
 * conversion (extended in the next patch) is performed.
 */
'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

type Status = 'loading' | 'ready' | 'not_found' | 'error' | 'converted' | 'rejected'

const SOURCE_LABEL: Record<string, string> = {
  kiosk: 'Kiosk Intake',
  kiosk_checkin: 'Kiosk Intake',
  service_writer: 'Service Request',
  fleet: 'Fleet Request',
  fleet_request: 'Fleet Request',
  maintenance: 'Maintenance Request',
  manual: 'Manual Request',
}

function describeSource(r: any): string {
  if (!r) return 'Request'
  return SOURCE_LABEL[r.check_in_type] || SOURCE_LABEL[r.source] || 'Request'
}

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.floor(m / 60)}h ago`
  return `${Math.floor(m / 1440)}d ago`
}

export default function PendingRequestReviewPage() {
  const params = useParams()
  const id = String(params?.id ?? '')
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [request, setRequest] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [converting, setConverting] = useState(false)
  const [convertError, setConvertError] = useState('')

  useEffect(() => {
    let cancelled = false
    getCurrentUser(supabase)
      .then(async (p) => {
        if (cancelled) return
        if (!p) { window.location.href = '/login'; return }
        setUser(p)
        try {
          const res = await fetch(`/api/service-requests?shop_id=${p.shop_id}`)
          if (!res.ok) {
            if (cancelled) return
            setStatus('error')
            setErrorMsg(`Failed to load service requests (HTTP ${res.status}).`)
            return
          }
          const data = await res.json()
          if (cancelled) return
          const list = Array.isArray(data) ? data : []
          const found = list.find((r: any) => String(r.id) === id)
          if (!found) {
            setStatus('not_found')
            return
          }
          setRequest(found)
          if (found.status === 'converted') setStatus('converted')
          else if (found.status === 'rejected') setStatus('rejected')
          else setStatus('ready')
        } catch (err: any) {
          if (cancelled) return
          setStatus('error')
          setErrorMsg(err?.message || 'Network error loading the request.')
        }
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
        setErrorMsg('Authentication failed.')
      })
    return () => { cancelled = true }
  }, [id])

  async function convertToWorkOrder() {
    if (!user || !request || converting) return
    setConverting(true)
    setConvertError('')
    try {
      const res = await fetch('/api/service-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'convert',
          request_id: request.id,
          shop_id: user.shop_id,
          user_id: user.id,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setConvertError(data?.error || `Conversion failed (HTTP ${res.status}).`)
        setConverting(false)
        return
      }
      const createdId = data?.so_id || data?.id || data?.converted_so_id
      if (createdId) {
        window.location.href = `/work-orders/${createdId}`
        return
      }
      // Fall back to /work-orders if response doesn't identify the new SO id.
      window.location.href = '/work-orders'
    } catch (err: any) {
      setConvertError(err?.message || 'Network error during conversion.')
      setConverting(false)
    }
  }

  const refLabel = id ? `REQ-${id.slice(0, 6).toUpperCase()}` : 'REQ-—'

  if (status === 'loading') {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Instrument Sans', sans-serif", color: 'var(--tz-textSecondary)' }}>
        Loading pending request...
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--tz-bg)', fontFamily: "'Instrument Sans', sans-serif", padding: 'clamp(12px, 3vw, 24px)' }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: 'var(--tz-textTertiary)', marginBottom: 12 }}>
        <a href="/work-orders" style={{ color: 'var(--tz-textSecondary)', textDecoration: 'none' }}>Work Orders</a>
        <span style={{ margin: '0 6px' }}>›</span>
        <span>Pending Request</span>
        <span style={{ margin: '0 6px' }}>›</span>
        <span style={{ color: 'var(--tz-text)', fontFamily: 'monospace', fontWeight: 700 }}>{refLabel}</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--tz-text)', fontFamily: 'monospace' }}>{refLabel}</span>
        <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: 'var(--tz-warningBg)', color: 'var(--tz-warning)' }}>Pending Request</span>
        {request && <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: 'var(--tz-bgHover)', color: 'var(--tz-textSecondary)' }}>{describeSource(request)}</span>}
        {status === 'converted' && <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: 'var(--tz-successBg)', color: 'var(--tz-success)' }}>Converted</span>}
        {status === 'rejected' && <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: 'var(--tz-dangerBg)', color: 'var(--tz-danger)' }}>Rejected</span>}
      </div>

      {status === 'not_found' && (
        <div style={{ padding: 24, background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-cardBorder)'}`, borderRadius: 12, fontSize: 13, color: 'var(--tz-textSecondary)' }}>
          Pending request not found. It may have been converted, rejected, or deleted.
          <div style={{ marginTop: 12 }}>
            <a href="/work-orders" style={{ color: 'var(--tz-accent)', fontSize: 13, fontWeight: 600 }}>Back to Work Orders</a>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div style={{ padding: 24, background: 'var(--tz-dangerBg)', border: `1px solid ${'var(--tz-danger)'}`, borderRadius: 12, fontSize: 13, color: 'var(--tz-danger)' }}>
          {errorMsg || 'Something went wrong loading this request.'}
          <div style={{ marginTop: 12 }}>
            <a href="/work-orders" style={{ color: 'var(--tz-danger)', fontSize: 13, fontWeight: 700 }}>Back to Work Orders</a>
          </div>
        </div>
      )}

      {request && (status === 'ready' || status === 'converted' || status === 'rejected') && (
        <>
          {/* Customer / Unit metadata */}
          <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-cardBorder)'}`, borderRadius: 12, padding: 16, marginBottom: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <Field label="Customer" value={request.company_name || request.contact_name || '—'} />
            <Field label="Contact" value={request.contact_name || '—'} />
            <Field label="Phone" value={request.phone || '—'} />
            <Field label="Unit" value={request.unit_number ? `#${request.unit_number}` : '—'} />
            <Field label="Source" value={describeSource(request)} />
            <Field label="Priority" value={(request.priority || request.urgency || 'normal').toUpperCase()} />
            <Field label="Submitted" value={request.created_at ? `${new Date(request.created_at).toLocaleString()} (${timeAgo(request.created_at)})` : '—'} />
            {request.parking_location && <Field label="Parking" value={request.parking_location} />}
            {request.key_location && <Field label="Keys" value={request.key_location} />}
          </div>

          {/* Note from Customer — read-only, preserved on WO at conversion */}
          <div style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.25)', borderRadius: 10, padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--tz-warning)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Note from Customer</span>
              <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 700, background: 'var(--tz-warningBg)', color: 'var(--tz-warning)' }}>Original Request</span>
            </div>
            <div style={{ fontSize: 14, color: 'var(--tz-text)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {request.description || <span style={{ color: 'var(--tz-textTertiary)', fontStyle: 'italic' }}>No request text on file</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--tz-textTertiary)', marginTop: 10, fontStyle: 'italic' }}>
              This original request will be preserved on the work order when converted.
            </div>
          </div>

          {/* Convert action */}
          {status === 'ready' && (
            <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-cardBorder)'}`, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tz-text)', marginBottom: 6 }}>Convert to Work Order</div>
              <div style={{ fontSize: 12, color: 'var(--tz-textSecondary)', marginBottom: 12, lineHeight: 1.5 }}>
                Creates a real work order from this request. The customer's original text is kept as a Note from Customer on the new work order. You can normalize and add reviewed job lines after conversion.
              </div>
              <button
                onClick={convertToWorkOrder}
                disabled={converting}
                style={{
                  padding: '10px 20px', background: 'var(--tz-accent)', border: 'none', borderRadius: 8,
                  color: 'var(--tz-bgLight)', fontSize: 13, fontWeight: 700, cursor: converting ? 'not-allowed' : 'pointer',
                  opacity: converting ? 0.6 : 1, fontFamily: 'inherit',
                }}>
                {converting ? 'Converting...' : 'Convert to Work Order'}
              </button>
              {convertError && (
                <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--tz-dangerBg)', border: `1px solid ${'var(--tz-danger)'}`, borderRadius: 8, color: 'var(--tz-danger)', fontSize: 12 }}>
                  {convertError}
                </div>
              )}
            </div>
          )}

          {status === 'converted' && (
            <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-cardBorder)'}`, borderRadius: 12, padding: 16, fontSize: 13, color: 'var(--tz-textSecondary)' }}>
              This request was already converted to a work order.
              {request.converted_so_id && (
                <a href={`/work-orders/${request.converted_so_id}`} style={{ marginLeft: 8, color: 'var(--tz-accent)', fontWeight: 700 }}>Open work order</a>
              )}
            </div>
          )}

          {status === 'rejected' && (
            <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-cardBorder)'}`, borderRadius: 12, padding: 16, fontSize: 13, color: 'var(--tz-textSecondary)' }}>
              This request was rejected{request.reject_reason ? ` — reason: ${request.reject_reason}` : '.'}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--tz-textTertiary)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--tz-text)', fontWeight: 600 }}>{value}</div>
    </div>
  )
}
