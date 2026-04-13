'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans', sans-serif"
const MONO = "'IBM Plex Mono', monospace"
const BLUE = '#1B6EE6'

const PERIODS = [
  { key: 'this_week', label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'custom', label: 'Custom' },
]

function getDateRange(period: string): { from: string; to: string } {
  const now = new Date()
  if (period === 'this_week') {
    const start = new Date(now); start.setDate(now.getDate() - now.getDay())
    return { from: start.toISOString().split('T')[0], to: now.toISOString().split('T')[0] }
  }
  if (period === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0)
    return { from: start.toISOString().split('T')[0], to: end.toISOString().split('T')[0] }
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return { from: start.toISOString().split('T')[0], to: now.toISOString().split('T')[0] }
}

export default function MechanicReportsPage() {
  const { tokens: t } = useTheme()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [period, setPeriod] = useState('this_month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [selectedMech, setSelectedMech] = useState<any>(null)

  const loadData = useCallback(async () => {
    const profile = await getCurrentUser(supabase)
    if (!profile) { window.location.href = '/login'; return }
    const allowed = ['owner', 'gm', 'it_person', 'accountant', 'office_admin', 'accounting_manager', 'floor_manager', 'shop_manager']
    if (!allowed.includes(profile.role)) { window.location.href = '/dashboard'; return }

    setLoading(true)
    const range = period === 'custom' ? { from: customFrom, to: customTo } : getDateRange(period)
    const mechParam = selectedMech ? `&mechanic_id=${selectedMech.id}` : ''
    const res = await fetch(`/api/reports/mechanics?from=${range.from}&to=${range.to}${mechParam}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [period, customFrom, customTo, selectedMech])

  useEffect(() => { loadData() }, [loadData])

  const fmt = (n: number) => '$' + (n || 0).toLocaleString(undefined, { minimumFractionDigits: 0 })

  function exportCSV() {
    if (!mechanics.length) return
    const header = 'Name,Role,Jobs Completed,Hours Logged,Avg Time/Job (min),Productivity Score'
    const rows = mechanics.map((m: any) => `"${m.full_name}",${m.role},${m.jobs_completed},${m.hours_logged},${m.avg_time_per_job_min},${m.productivity_score}`)
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `mechanic-report-${data?.period?.from || 'report'}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  if (loading && !data) return <div style={{ minHeight: '100vh', background: '#F4F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textSecondary }}>Loading...</div>

  const summary = data?.summary || {}
  const mechanics = data?.mechanics || []

  return (
    <div style={{ minHeight: '100vh', background: '#F4F5F7', fontFamily: FONT, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#1A1A1A' }}>Mechanic Reports</div>
          <div style={{ fontSize: 13, color: t.textSecondary }}>{data?.period?.from} to {data?.period?.to}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => { setPeriod(p.key); setSelectedMech(null) }} style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
              border: period === p.key ? `1px solid ${BLUE}` : '1px solid #D1D5DB',
              background: period === p.key ? `${BLUE}10` : t.bgLight,
              color: period === p.key ? BLUE : t.textSecondary,
            }}>{p.label}</button>
          ))}
          <button onClick={exportCSV} style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
            border: '1px solid #D1D5DB', background: t.bgLight, color: '#374151',
          }}>Export CSV</button>
        </div>
      </div>

      {period === 'custom' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 12 }} />
          <span style={{ color: t.textSecondary }}>to</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 12 }} />
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Jobs', value: String(summary.total_jobs || 0), color: BLUE },
          { label: 'Total Hours', value: String(summary.total_hours || 0), color: '#16A34A' },
          { label: 'Mechanics', value: String(summary.mechanic_count || 0), color: '#D97706' },
          { label: 'Avg Productivity', value: `${summary.avg_productivity || 0}%`, color: '#8B5CF6' },
        ].map(c => (
          <div key={c.label} style={{ background: t.bgLight, border: '1px solid #E5E7EB', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: 10, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: MONO, marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: c.color, fontFamily: MONO }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Mechanic table */}
      <div style={{ background: t.bgLight, border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
              {['Name', 'Role', 'Jobs', 'Hours', 'Avg Time/Job', 'Productivity'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mechanics.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: t.textSecondary, fontSize: 13 }}>No mechanic data for this period</td></tr>
            ) : mechanics.map((m: any) => (
              <tr key={m.id} style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }}
                onClick={() => setSelectedMech(selectedMech?.id === m.id ? null : m)}
                onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>{m.full_name}</td>
                <td style={{ padding: '12px 14px', fontSize: 11, color: t.textSecondary }}>{m.role?.replace(/_/g, ' ')}</td>
                <td style={{ padding: '12px 14px', fontFamily: MONO, fontSize: 13, fontWeight: 700, color: BLUE }}>{m.jobs_completed}</td>
                <td style={{ padding: '12px 14px', fontFamily: MONO, fontSize: 12, color: '#1A1A1A' }}>{m.hours_logged}h</td>
                <td style={{ padding: '12px 14px', fontFamily: MONO, fontSize: 12, color: t.textSecondary }}>{m.avg_time_per_job_min}m</td>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 60, height: 6, borderRadius: 3, background: '#E5E7EB', overflow: 'hidden' }}>
                      <div style={{ width: `${m.productivity_score}%`, height: '100%', background: m.productivity_score >= 70 ? '#16A34A' : m.productivity_score >= 40 ? '#D97706' : '#DC2626', borderRadius: 3 }} />
                    </div>
                    <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: m.productivity_score >= 70 ? '#16A34A' : m.productivity_score >= 40 ? '#D97706' : '#DC2626' }}>{m.productivity_score}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail panel for selected mechanic */}
      {selectedMech?.jobs && (
        <div style={{ background: t.bgLight, border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginTop: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A', marginBottom: 12 }}>{selectedMech.full_name} — Job Detail</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                {['WO #', 'Description', 'Completed', 'Total'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selectedMech.jobs.map((j: any) => (
                <tr key={j.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 12, fontWeight: 700, color: BLUE }}>{j.so_number}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: '#1A1A1A', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.complaint || '--'}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: t.textSecondary }}>{j.completed_at ? new Date(j.completed_at).toLocaleDateString() : '--'}</td>
                  <td style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 12, color: '#1A1A1A' }}>{j.grand_total ? fmt(j.grand_total) : '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
