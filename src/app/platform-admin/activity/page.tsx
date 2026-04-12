'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { useTheme } from '@/hooks/useTheme'

const ACTION_TYPES = [
  'all', 'shop_approved', 'shop_rejected', 'shop_suspended', 'shop_updated',
  'impersonation_started', 'impersonation_ended', 'plan_changed', 'registration_received',
]

export default function PlatformActivity() {
  const { tokens: th } = useTheme()
  const supabase = createClient()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState(searchParams?.get('action_type') || 'all')
  const [shopFilter, setShopFilter] = useState(searchParams?.get('shop_id') || '')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    async function load() {
      const u = await getCurrentUser(supabase)
      if (!u) return
      setUser(u)
      await fetchLogs(u.id)
      setLoading(false)
    }
    load()
  }, [])

  async function fetchLogs(userId: string, opts?: { action?: string; shop?: string; from?: string; to?: string }) {
    const params = new URLSearchParams({ user_id: userId, limit: '100' })
    const at = opts?.action ?? actionFilter
    const si = opts?.shop ?? shopFilter
    const df = opts?.from ?? dateFrom
    const dt = opts?.to ?? dateTo
    if (at && at !== 'all') params.set('action_type', at)
    if (si) params.set('shop_id', si)
    if (df) params.set('date_from', df)
    if (dt) params.set('date_to', dt)

    const res = await fetch(`/api/platform-admin/activity?${params}`)
    if (res.ok) setLogs(await res.json())
  }

  function fmtTime(d: string) {
    return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' })
  }

  if (loading) return <div style={{ color: th.textSecondary, fontSize: 13, padding: 40 }}>Loading...</div>

  const actionColor: Record<string, string> = {
    shop_approved: '#22C55E', shop_rejected: '#D94F4F', shop_suspended: '#F59E0B',
    impersonation_started: '#8B5CF6', impersonation_ended: '#8B5CF6',
    registration_received: '#1D6FE8', shop_updated: '#4D9EFF', plan_changed: '#F59E0B',
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: th.text, margin: '0 0 20px' }}>Activity Log</h1>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); if (user) fetchLogs(user.id, { action: e.target.value }) }} style={{ padding: '8px 12px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 12, color: th.text, outline: 'none', fontFamily: 'inherit' }}>
          {ACTION_TYPES.map(t => (
            <option key={t} value={t}>{t === 'all' ? 'All Actions' : t.replace(/_/g, ' ')}</option>
          ))}
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={e => { setDateFrom(e.target.value); if (user) fetchLogs(user.id, { from: e.target.value }) }}
          style={{ padding: '8px 12px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 12, color: th.text, outline: 'none', fontFamily: 'inherit' }}
          placeholder="From"
        />
        <input
          type="date"
          value={dateTo}
          onChange={e => { setDateTo(e.target.value); if (user) fetchLogs(user.id, { to: e.target.value }) }}
          style={{ padding: '8px 12px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 12, color: th.text, outline: 'none', fontFamily: 'inherit' }}
          placeholder="To"
        />

        {shopFilter && (
          <button onClick={() => { setShopFilter(''); if (user) fetchLogs(user.id, { shop: '' }) }} style={{ padding: '8px 12px', background: 'rgba(29,111,232,.12)', color: '#4D9EFF', border: 'none', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
            Clear shop filter
          </button>
        )}
      </div>

      {/* Log table */}
      <div style={{ background: th.bgCard, border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Date/Time', 'Action', 'Description', 'Shop', 'Performed By'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 10, color: th.textTertiary, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'IBM Plex Mono', monospace", borderBottom: '1px solid rgba(255,255,255,.06)', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map((log: any) => (
              <tr key={log.id}>
                <td style={{ padding: '10px 12px', fontSize: 11, color: th.textTertiary, borderBottom: '1px solid rgba(255,255,255,.04)', whiteSpace: 'nowrap', fontFamily: "'IBM Plex Mono', monospace" }}>{fmtTime(log.created_at)}</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: actionColor[log.action_type] || '#7C8BA0', background: `${actionColor[log.action_type] || '#7C8BA0'}1a`, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase', fontFamily: "'IBM Plex Mono', monospace", whiteSpace: 'nowrap' }}>
                    {log.action_type.replace(/_/g, ' ')}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: th.text, borderBottom: '1px solid rgba(255,255,255,.04)' }}>{log.description || '—'}</td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: th.textSecondary, borderBottom: '1px solid rgba(255,255,255,.04)' }}>{log.shop_name || '—'}</td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: th.textSecondary, borderBottom: '1px solid rgba(255,255,255,.04)' }}>{log.performed_by_name || '—'}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: th.textTertiary, fontSize: 12 }}>No activity logged yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
