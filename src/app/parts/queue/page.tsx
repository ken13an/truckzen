'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { Check, Package } from 'lucide-react'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const BLUE = '#4D9EFF', GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F', MUTED = '#7C8BA0'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: MUTED },
  requested: { label: 'Requested', color: MUTED },
  reviewing: { label: 'Reviewing', color: BLUE },
  submitted: { label: 'Submitted', color: AMBER },
  partial: { label: 'Partial', color: AMBER },
  ready: { label: 'Ready', color: GREEN },
  delivered: { label: 'Delivered', color: GREEN },
  ordered: { label: 'Ordered', color: AMBER },
  in_stock: { label: 'In Stock', color: GREEN },
}

export default function PartsQueuePage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [requests, setRequests] = useState<any[]>([])
  const [wos, setWos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(0)
  const [confirmReady, setConfirmReady] = useState<string | null>(null)

  useEffect(() => {
    getCurrentUser(supabase).then(async (p) => {
      if (!p) { window.location.href = '/login'; return }
      setUser(p)
      await loadAll(p)
      setLoading(false)
    })
  }, [])

  async function loadAll(profile: any) {
    // Fetch parts requests with WO info
    const prRes = await fetch(`/api/parts-requests?shop_id=${profile.shop_id}&status=all`)
    if (prRes.ok) {
      const data = await prRes.json()
      setRequests(data)
    }
    // Also fetch WOs with part lines (existing workflow)
    const { data } = await supabase
      .from('service_orders')
      .select('id, so_number, status, priority, created_at, assets(unit_number, year, make, model), customers(company_name), so_lines(id, line_type, description, parts_status, real_name, rough_name)')
      .eq('shop_id', profile.shop_id)
      .is('deleted_at', null)
      .or('is_historical.is.null,is_historical.eq.false')
      .not('status', 'in', '("good_to_go","void","done")')
      .order('created_at', { ascending: false })
      .limit(100)
    setWos(data || [])
  }

  // Quick action: Mark Ready
  async function quickMarkReady(prId: string) {
    const res = await fetch(`/api/parts-requests/${prId}/ready`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partial: false }),
    })
    if (res.ok) {
      setRequests(prev => prev.map(r => r.id === prId ? { ...r, status: 'ready', parts_ready_at: new Date().toISOString() } : r))
    }
    setConfirmReady(null)
  }

  // Categorize WOs by so_lines
  const needsParts = wos.filter(wo => {
    const parts = (wo.so_lines || []).filter((l: any) => l.line_type === 'part')
    return parts.some((l: any) => l.parts_status === 'rough' || (!l.real_name && l.rough_name))
  })
  const onOrder = wos.filter(wo => {
    const parts = (wo.so_lines || []).filter((l: any) => l.line_type === 'part')
    return parts.some((l: any) => l.parts_status === 'ordered') && !parts.some((l: any) => l.parts_status === 'rough')
  })

  // Enhanced requests by status
  const activeRequests = requests.filter(r => ['pending', 'requested', 'reviewing', 'submitted', 'partial'].includes(r.status))
  const readyRequests = requests.filter(r => r.status === 'ready')
  const orderedRequests = requests.filter(r => {
    const items = r.line_items || []
    return items.some((l: any) => l.ordered && !l.in_stock)
  })

  const tabs = [
    { label: 'Active', count: activeRequests.length + needsParts.length, color: RED },
    { label: 'On Order', count: orderedRequests.length + onOrder.length, color: AMBER },
    { label: 'Ready', count: readyRequests.length, color: GREEN },
  ]

  function getStatusBadge(status: string) {
    const s = STATUS_MAP[status] || { label: status, color: MUTED }
    return <span style={{ fontSize: 9, fontWeight: 700, color: s.color, background: `${s.color}18`, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' }}>{s.label}</span>
  }

  function renderRequestRow(pr: any) {
    const wo = pr.service_orders || {}
    const asset = wo.assets || {}
    const cust = wo.customers || {}
    const canMarkReady = pr.status === 'submitted' || pr.status === 'partial'

    return (
      <div key={pr.id} style={{ background: '#161B24', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: 14, cursor: 'pointer', transition: 'all .12s' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#1C2130')}
        onMouseLeave={e => (e.currentTarget.style.background = '#161B24')}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <a href={`/parts/wo/${wo.id || pr.so_id}`} style={{ textDecoration: 'none', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: BLUE }}>{wo.so_number || '—'}</span>
              {getStatusBadge(pr.status)}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F4FF' }}>
              #{asset.unit_number || '—'} {[asset.year, asset.make, asset.model].filter(Boolean).join(' ')}
            </div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{cust.company_name || '—'}</div>
          </a>
          {/* Quick actions */}
          {canMarkReady && (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmReady(pr.id) }}
              style={{ padding: '6px 14px', background: `${GREEN}15`, border: `1px solid ${GREEN}40`, borderRadius: 8, color: GREEN, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
            >
              <Check size={12} /> Mark Ready
            </button>
          )}
        </div>
      </div>
    )
  }

  function renderWORow(wo: any) {
    const asset = wo.assets || {}
    const cust = wo.customers || {}
    const parts = (wo.so_lines || []).filter((l: any) => l.line_type === 'part')
    const sourced = parts.filter((l: any) => l.real_name).length
    return (
      <a key={wo.id} href={`/parts/wo/${wo.id}`} style={{ textDecoration: 'none' }}>
        <div style={{ background: '#161B24', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: 14, cursor: 'pointer', transition: 'all .12s' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#1C2130')}
          onMouseLeave={e => (e.currentTarget.style.background = '#161B24')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: BLUE }}>{wo.so_number || '—'}</span>
                {wo.priority === 'high' || wo.priority === 'critical' ? (
                  <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: 'rgba(217,79,79,.12)', color: RED, textTransform: 'uppercase' }}>{wo.priority}</span>
                ) : null}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F4FF' }}>#{asset.unit_number || '—'} {[asset.year, asset.make, asset.model].filter(Boolean).join(' ')}</div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{cust.company_name || '—'}</div>
            </div>
            {parts.length > 0 && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: sourced === parts.length ? GREEN : AMBER, fontWeight: 600 }}>{sourced}/{parts.length} sourced</div>
                <div style={{ width: 80, height: 4, background: 'rgba(255,255,255,.08)', borderRadius: 2, marginTop: 4 }}>
                  <div style={{ width: `${(sourced / parts.length) * 100}%`, height: '100%', background: sourced === parts.length ? GREEN : AMBER, borderRadius: 2 }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </a>
    )
  }

  if (loading) return <div style={{ background: '#060708', minHeight: '100vh', color: MUTED, fontFamily: FONT, padding: 40, textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: FONT, padding: 24 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF', marginBottom: 4 }}>Parts Queue</div>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 20 }}>Work orders needing parts department attention</div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,.08)', marginBottom: 20 }}>
        {tabs.map((t, i) => (
          <button key={t.label} onClick={() => setTab(i)} style={{
            padding: '10px 18px', fontSize: 12, fontWeight: tab === i ? 700 : 400,
            color: tab === i ? t.color : MUTED, background: 'none', border: 'none',
            borderBottom: tab === i ? `2px solid ${t.color}` : '2px solid transparent',
            cursor: 'pointer', fontFamily: FONT,
          }}>
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tab === 0 && (
          <>
            {activeRequests.map(renderRequestRow)}
            {needsParts.map(renderWORow)}
            {activeRequests.length === 0 && needsParts.length === 0 && (
              <div style={{ background: '#161B24', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: 40, textAlign: 'center', color: MUTED, fontSize: 13 }}>
                <Package size={24} style={{ marginBottom: 8, opacity: 0.3 }} /><br />No active parts requests
              </div>
            )}
          </>
        )}
        {tab === 1 && (
          <>
            {orderedRequests.map(renderRequestRow)}
            {onOrder.map(renderWORow)}
            {orderedRequests.length === 0 && onOrder.length === 0 && (
              <div style={{ background: '#161B24', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: 40, textAlign: 'center', color: MUTED, fontSize: 13 }}>No parts on order</div>
            )}
          </>
        )}
        {tab === 2 && (
          <>
            {readyRequests.map(renderRequestRow)}
            {readyRequests.length === 0 && (
              <div style={{ background: '#161B24', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: 40, textAlign: 'center', color: MUTED, fontSize: 13 }}>No parts marked as ready</div>
            )}
          </>
        )}
      </div>

      {/* Confirm dialog */}
      {confirmReady && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setConfirmReady(null)}>
          <div style={{ background: '#1A1F2B', borderRadius: 16, padding: 24, maxWidth: 380, width: '90%', border: '1px solid rgba(255,255,255,.08)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F4FF', marginBottom: 12 }}>Mark Parts Ready?</div>
            <p style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>Mechanic will be notified that parts are ready for pickup.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmReady(null)} style={{ padding: '8px 16px', background: 'rgba(255,255,255,.06)', border: 'none', borderRadius: 8, color: MUTED, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => quickMarkReady(confirmReady)} style={{ padding: '8px 16px', background: GREEN, border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Mark Ready</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
