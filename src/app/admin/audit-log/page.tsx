'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { COLORS, FONT, FONT_MONO } from '@/lib/config/colors'

export default function AuditLogPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [actions, setActions] = useState<string[]>([])

  useEffect(() => {
    getCurrentUser(supabase).then((p: any) => {
      if (!p) { window.location.href = '/login'; return }
      if (!['owner', 'gm'].includes(p.role)) { window.location.href = '/403'; return }
      setUser(p)
      fetchEntries(p.shop_id)
    })
  }, [])

  async function fetchEntries(shopId?: string) {
    const sid = shopId || user?.shop_id
    if (!sid) return
    setLoading(true)

    const params = new URLSearchParams({ shop_id: sid, limit: '500' })
    if (actionFilter) params.set('action', actionFilter)
    if (fromDate) params.set('from', fromDate + 'T00:00:00Z')
    if (toDate) params.set('to', toDate + 'T23:59:59Z')
    if (userFilter) params.set('user_id', userFilter)

    const res = await fetch(`/api/audit-log?${params}`)
    if (res.ok) {
      const data = await res.json()
      setEntries(data)
      // Collect unique actions for filter dropdown
      const uniqueActions = [...new Set(data.map((e: any) => e.action))] as string[]
      if (uniqueActions.length > actions.length) setActions(uniqueActions)
    }
    setLoading(false)
  }

  function exportCsv() {
    const header = 'Date,User,Action,Entity Type,Entity ID,Details'
    const rows = entries.map(e => {
      const date = new Date(e.created_at).toLocaleString()
      const userName = e.users?.full_name || e.users?.email || e.user_id
      const details = e.details ? JSON.stringify(e.details).replace(/"/g, '""') : ''
      return `"${date}","${userName}","${e.action}","${e.entity_type}","${e.entity_id}","${details}"`
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    background: COLORS.bgCard,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    color: COLORS.text,
    fontSize: 13,
    fontFamily: FONT,
    outline: 'none',
  }

  const btnStyle: React.CSSProperties = {
    padding: '8px 16px',
    background: COLORS.blue,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: FONT,
  }

  if (!user) return null

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, fontFamily: FONT, color: COLORS.text, padding: 24 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Audit Log</h1>
          <button onClick={exportCsv} style={btnStyle}>Export CSV</button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: 11, color: COLORS.textSecondary, display: 'block', marginBottom: 4 }}>Action</label>
            <select
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              style={{ ...inputStyle, minWidth: 140 }}
            >
              <option value="">All actions</option>
              {actions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: COLORS.textSecondary, display: 'block', marginBottom: 4 }}>From</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: COLORS.textSecondary, display: 'block', marginBottom: 4 }}>To</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: COLORS.textSecondary, display: 'block', marginBottom: 4 }}>User ID</label>
            <input
              type="text"
              value={userFilter}
              onChange={e => setUserFilter(e.target.value)}
              placeholder="Filter by user ID"
              style={{ ...inputStyle, minWidth: 200 }}
            />
          </div>
          <button onClick={() => fetchEntries()} style={btnStyle}>Apply</button>
          <button
            onClick={() => { setActionFilter(''); setFromDate(''); setToDate(''); setUserFilter(''); setTimeout(() => fetchEntries(), 0) }}
            style={{ ...btnStyle, background: 'transparent', border: `1px solid ${COLORS.border}`, color: COLORS.textSecondary }}
          >
            Clear
          </button>
        </div>

        {/* Table */}
        <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                {['Date', 'User', 'Action', 'Entity Type', 'Entity ID', 'Details'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 14px', color: COLORS.textSecondary, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: COLORS.textSecondary }}>Loading...</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: COLORS.textSecondary }}>No audit log entries found</td></tr>
              ) : entries.map((e, i) => (
                <tr key={e.id || i} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: COLORS.textSecondary, fontFamily: FONT_MONO, fontSize: 12 }}>
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                    {e.users?.full_name || e.users?.email || e.user_id?.slice(0, 8)}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      background: COLORS.blueBg,
                      color: COLORS.blueLight,
                    }}>{e.action}</span>
                  </td>
                  <td style={{ padding: '10px 14px', color: COLORS.textSecondary }}>{e.entity_type}</td>
                  <td style={{ padding: '10px 14px', fontFamily: FONT_MONO, fontSize: 12, color: COLORS.textSecondary }}>{e.entity_id?.slice(0, 8)}</td>
                  <td style={{ padding: '10px 14px', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: COLORS.textDim, fontSize: 12 }}>
                    {e.details ? JSON.stringify(e.details) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 12, fontSize: 12, color: COLORS.textDim }}>
          Showing {entries.length} entries
        </div>
      </div>
    </div>
  )
}
