'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser, type UserProfile } from '@/lib/auth'
import { getPermissions } from '@/lib/getPermissions'
import { getMechanics } from '@/lib/services/users'
import { getWorkorderRoute } from '@/lib/navigation/workorder-route'

const FONT = "'Inter', -apple-system, sans-serif"

type Filter = 'unassigned' | 'assigned' | 'ready' | 'waiting_parts' | 'in_progress'

// "Ready for assignment" = unassigned, not completed, and parts are not blocking
// (no parts needed, or parts are received/ready_for_job/installed)
const PARTS_NOT_BLOCKING = [null, undefined, '', 'received', 'ready_for_job', 'installed']
function isReadyForAssignment(j: any) {
  return !j.mechanic_name && j.status !== 'completed' && PARTS_NOT_BLOCKING.includes(j.parts_status)
}

export default function QuickAssignPage() {
  const supabase = createClient()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<any[]>([])
  const [mechanics, setMechanics] = useState<any[]>([])
  const [filter, setFilter] = useState<Filter>('unassigned')
  const [search, setSearch] = useState('')
  const [assigning, setAssigning] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const profile = await getCurrentUser(supabase)
    if (!profile) { window.location.href = '/login'; return }

    const perms = getPermissions(profile)
    if (!perms.canAssignJobs && !perms.canViewAllJobs && !perms.isPlatformOwner) {
      window.location.href = '/dashboard'
      return
    }
    setUser(profile)

    const [jobsRes, mechs] = await Promise.all([
      fetch('/api/floor-manager/jobs'),
      getMechanics(profile.shop_id),
    ])
    if (jobsRes.ok) setJobs(await jobsRes.json())
    setMechanics(mechs.filter((u: any) => u.active !== false))
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const assignMechanic = async (lineId: string, woId: string, userId: string, userName: string) => {
    setAssigning(lineId)
    const res = await fetch('/api/wo-job-assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        line_id: lineId,
        wo_id: woId,
        assignments: userId ? [{ user_id: userId, name: userName, percentage: 100 }] : [],
      }),
    })
    if (res.ok) await loadData()
    setAssigning(null)
  }

  const filtered = jobs.filter(j => {
    if (search) {
      const q = search.toLowerCase()
      if (!(j.wo_number || '').toLowerCase().includes(q) &&
          !(j.unit_number || '').toLowerCase().includes(q) &&
          !(j.customer || '').toLowerCase().includes(q) &&
          !(j.description || '').toLowerCase().includes(q)) return false
    }
    switch (filter) {
      case 'unassigned': return !j.mechanic_name && j.status !== 'completed'
      case 'assigned': return !!j.mechanic_name && j.status !== 'completed'
      case 'ready': return isReadyForAssignment(j)
      case 'waiting_parts': return j.status !== 'completed' && ['rough', 'ordered'].includes(j.parts_status || '')
      case 'in_progress': return j.status === 'in_progress'
    }
  })

  const counts = {
    unassigned: jobs.filter(j => !j.mechanic_name && j.status !== 'completed').length,
    assigned: jobs.filter(j => !!j.mechanic_name && j.status !== 'completed').length,
    ready: jobs.filter(isReadyForAssignment).length,
    waiting_parts: jobs.filter(j => j.status !== 'completed' && ['rough', 'ordered'].includes(j.parts_status || '')).length,
    in_progress: jobs.filter(j => j.status === 'in_progress').length,
  }

  if (loading) return <div style={{ fontFamily: FONT, padding: 40, textAlign: 'center', color: '#6B7280' }}>Loading...</div>

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'unassigned', label: 'Unassigned' },
    { key: 'assigned', label: 'Assigned' },
    { key: 'ready', label: 'Ready for Assignment' },
    { key: 'waiting_parts', label: 'Waiting on Parts' },
    { key: 'in_progress', label: 'In Progress' },
  ]

  return (
    <div style={{ fontFamily: FONT, maxWidth: 1100, margin: '0 auto', padding: 'clamp(12px, 3vw, 24px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1E293B' }}>Quick Assign</div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>{filtered.length} job{filtered.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/floor-manager/dashboard" style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>Kanban</a>
          <button onClick={() => loadData()} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Refresh</button>
        </div>
      </div>

      {/* Filters + Search */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: '5px 12px', borderRadius: 6, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: filter === f.key ? '#1E293B' : '#fff',
            color: filter === f.key ? '#fff' : '#374151',
            borderColor: filter === f.key ? '#1E293B' : '#D1D5DB',
          }}>
            {f.label} ({counts[f.key]})
          </button>
        ))}
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search WO, unit, customer, job..."
          style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, width: 220, outline: 'none' }}
        />
      </div>

      {/* Job List */}
      {filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No jobs match this filter.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
          <thead>
            <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em' }}>WO</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em' }}>Unit</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em' }}>Customer</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em' }}>Job</th>
              <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em', width: 50 }}>Hrs</th>
              <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em', width: 90 }}>Parts</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em', width: 160 }}>Mechanic</th>
              <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em', width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((j: any) => {
              // Show raw truthful parts_status — no invented labels
              const ps = j.parts_status
              const psDisplay = ps ? ps.replace(/_/g, ' ') : null
              const psColor = ps === 'rough' || ps === 'ordered' ? '#D97706' : ps === 'received' || ps === 'ready_for_job' ? '#16A34A' : ps === 'installed' ? '#6B7280' : '#9CA3AF'
              return (
                <tr key={j.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: '#1E293B', whiteSpace: 'nowrap' }}>{j.wo_number}</td>
                  <td style={{ padding: '8px 10px', color: '#374151', whiteSpace: 'nowrap' }}>#{j.unit_number || '—'}</td>
                  <td style={{ padding: '8px 10px', color: '#374151', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.customer || '—'}</td>
                  <td style={{ padding: '8px 10px', color: '#1E293B', fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.description?.slice(0, 50) || '—'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', color: '#6B7280' }}>{j.estimated_hours || '—'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                    {psDisplay ? <span style={{ fontSize: 10, fontWeight: 600, color: psColor, textTransform: 'capitalize' }}>{psDisplay}</span> : <span style={{ color: '#D1D5DB' }}>—</span>}
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <select
                      value={j.assigned_to || ''}
                      disabled={assigning === j.id}
                      onChange={e => {
                        const mech = mechanics.find((m: any) => m.id === e.target.value)
                        assignMechanic(j.id, j.wo_id, e.target.value, mech?.full_name || '')
                      }}
                      style={{ width: '100%', padding: '4px 6px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, background: j.mechanic_name ? '#F0FDF4' : '#FEF2F2', cursor: 'pointer' }}
                    >
                      <option value="">— Unassigned —</option>
                      {mechanics.map((m: any) => (
                        <option key={m.id} value={m.id}>{m.full_name}{m.team ? ` (${m.team})` : ''}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                    <a href={getWorkorderRoute(j.wo_id, undefined, 'floor-manager')} style={{ color: '#1D6FE8', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>Open</a>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
