'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser, type UserProfile } from '@/lib/auth'
import { getPermissions } from '@/lib/getPermissions'
import { getMechanics } from '@/lib/services/users'

const FONT = "'Inter', -apple-system, sans-serif"
const BG = '#0C0C12'
const TEXT = '#EDEDF0'
const CARD_BG = '#151520'
const CARD_BORDER = 'rgba(255,255,255,0.08)'
const BLUE = '#1D6FE8'
const AMBER = '#F59E0B'
const GREEN = '#22C55E'
const RED = '#EF4444'
const DIM = '#71717A'

type Filter = 'unassigned' | 'assigned' | 'waiting_parts' | 'in_progress'

export default function QuickViewPage() {
  const supabase = createClient()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<any[]>([])
  const [mechanics, setMechanics] = useState<any[]>([])
  const [filter, setFilter] = useState<Filter>('unassigned')
  const [search, setSearch] = useState('')
  const [assigning, setAssigning] = useState<string | null>(null)
  const [assignDropdown, setAssignDropdown] = useState<string | null>(null)
  const [timeModal, setTimeModal] = useState<any | null>(null)
  const [timeValue, setTimeValue] = useState('')
  const [timeSaving, setTimeSaving] = useState(false)

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
    await fetch('/api/wo-job-assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        line_id: lineId, wo_id: woId,
        assignments: userId ? [{ user_id: userId, name: userName, percentage: 100 }] : [],
      }),
    })
    setAssignDropdown(null)
    await loadData()
    setAssigning(null)
  }

  // Add Time — uses existing PATCH /api/so-lines/[id] with estimated_hours
  const saveTime = async () => {
    if (!timeModal || !timeValue) return
    setTimeSaving(true)
    const hrs = parseFloat(timeValue)
    if (isNaN(hrs) || hrs < 0) { setTimeSaving(false); return }
    await fetch(`/api/so-lines/${timeModal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estimated_hours: hrs }),
    })
    setTimeModal(null)
    setTimeValue('')
    await loadData()
    setTimeSaving(false)
  }

  const filtered = jobs.filter(j => {
    if (j.status === 'completed') return false
    if (search) {
      const q = search.toLowerCase()
      if (!(j.wo_number || '').toLowerCase().includes(q) &&
          !(j.unit_number || '').toLowerCase().includes(q) &&
          !(j.customer || '').toLowerCase().includes(q) &&
          !(j.description || '').toLowerCase().includes(q)) return false
    }
    const isAssigned = !!(j.mechanic_name || j.assigned_to)
    switch (filter) {
      case 'unassigned': return !isAssigned
      case 'assigned': return isAssigned
      case 'waiting_parts': return ['rough', 'ordered'].includes(j.parts_status || '')
      case 'in_progress': return j.status === 'in_progress'
    }
  })

  const counts = {
    unassigned: jobs.filter(j => !(j.mechanic_name || j.assigned_to) && j.status !== 'completed').length,
    assigned: jobs.filter(j => !!(j.mechanic_name || j.assigned_to) && j.status !== 'completed').length,
    waiting_parts: jobs.filter(j => j.status !== 'completed' && ['rough', 'ordered'].includes(j.parts_status || '')).length,
    in_progress: jobs.filter(j => j.status === 'in_progress').length,
  }

  if (loading) return <div style={{ fontFamily: FONT, background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: DIM }}>Loading...</div>

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'unassigned', label: 'Unassigned' },
    { key: 'assigned', label: 'Assigned' },
    { key: 'waiting_parts', label: 'Waiting Parts' },
    { key: 'in_progress', label: 'In Progress' },
  ]

  const psColor = (s: string | null) => {
    if (!s) return DIM
    if (s === 'rough' || s === 'ordered') return AMBER
    if (s === 'received' || s === 'ready_for_job') return GREEN
    return DIM
  }

  const btnBase: React.CSSProperties = { padding: '6px 12px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer' }

  return (
    <div style={{ fontFamily: FONT, background: BG, minHeight: '100vh', color: TEXT, padding: 'clamp(10px, 3vw, 20px)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>Floor Manager</div>
              <div style={{ fontSize: 11, color: DIM }}>Assign jobs fast</div>
            </div>
            <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: 2, marginLeft: 4 }}>
              <a href="/shop-floor" style={{ padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: 'transparent', color: DIM, textDecoration: 'none', cursor: 'pointer' }}>Full View</a>
              <span style={{ padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: BLUE, color: '#fff', cursor: 'default' }}>Quick View</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              padding: '5px 10px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              background: filter === f.key ? BLUE : 'rgba(255,255,255,0.06)',
              color: filter === f.key ? '#fff' : DIM,
            }}>
              {f.label} ({counts[f.key]})
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search WO, unit, customer, job..."
          style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${CARD_BORDER}`, background: CARD_BG, color: TEXT, fontSize: 12, marginBottom: 12, outline: 'none', boxSizing: 'border-box' }}
        />

        {/* Cards */}
        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: DIM, fontSize: 13 }}>No jobs match this filter.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(j => {
              const ps = j.parts_status
              const isOpen = assignDropdown === j.id
              const hasAssignment = !!(j.mechanic_name || j.assigned_to)
              return (
                <div key={j.id} style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 10, padding: '12px 14px' }}>

                  {/* 1. Header: WO # + badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{j.wo_number}</span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                      background: hasAssignment ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                      color: hasAssignment ? GREEN : RED,
                    }}>
                      {hasAssignment ? 'Assigned' : 'Unassigned'}
                    </span>
                  </div>

                  {/* 2. Job title */}
                  <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 4, lineHeight: 1.3 }}>
                    {j.description?.slice(0, 60) || '—'}
                  </div>

                  {/* 3. Current mechanic */}
                  <div style={{ fontSize: 11, fontWeight: 600, color: hasAssignment ? BLUE : RED, marginBottom: 6 }}>
                    {j.mechanic_name ? `${j.mechanic_name}${j.mechanic_team ? ` (${j.mechanic_team})` : ''}` : 'Unassigned'}
                  </div>

                  {/* 4. Core info: Unit · Parts · Hours */}
                  <div style={{ display: 'flex', gap: 10, fontSize: 11, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ color: DIM }}>#{j.unit_number || '—'}</span>
                    {ps && <span style={{ color: psColor(ps), fontWeight: 600, textTransform: 'capitalize' }}>{ps.replace(/_/g, ' ')}</span>}
                    <span style={{ color: DIM }}>{j.estimated_hours ? `${j.estimated_hours} hrs` : 'No hours'}</span>
                  </div>

                  {/* 5. Customer */}
                  {j.customer && <div style={{ fontSize: 10, color: DIM, marginBottom: 6 }}>{j.customer}</div>}

                  {/* 6. Quick assign chips */}
                  {(() => {
                    const quickPicks = mechanics.filter(m => m.id !== (j.assigned_to || '')).slice(0, 3)
                    return (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                          {quickPicks.map(m => (
                            <button key={m.id}
                              onClick={() => assignMechanic(j.id, j.wo_id, m.id, m.full_name)}
                              disabled={assigning === j.id}
                              style={{ padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 10, fontWeight: 600, cursor: 'pointer', background: 'rgba(34,197,94,0.15)', color: GREEN }}>
                              {m.full_name?.split(' ')[0]}{m.team ? ` (${m.team})` : ''}
                            </button>
                          ))}
                          <button
                            onClick={() => setAssignDropdown(isOpen ? null : j.id)}
                            disabled={assigning === j.id}
                            style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${CARD_BORDER}`, fontSize: 10, fontWeight: 600, cursor: 'pointer', background: 'transparent', color: DIM }}>
                            {isOpen ? 'Close' : 'More'}
                          </button>
                          {hasAssignment && (
                            <button
                              onClick={() => assignMechanic(j.id, j.wo_id, '', '')}
                              disabled={assigning === j.id}
                              style={{ padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 10, fontWeight: 600, cursor: 'pointer', background: 'rgba(239,68,68,0.1)', color: RED }}>
                              Unassign
                            </button>
                          )}
                        </div>

                        {/* Full mechanic list */}
                        {isOpen && (
                          <div style={{ background: '#1E1E2E', border: `1px solid ${CARD_BORDER}`, borderRadius: 8, padding: 6, maxHeight: 160, overflowY: 'auto', marginBottom: 6 }}>
                            {mechanics.map(m => (
                              <button key={m.id} onClick={() => assignMechanic(j.id, j.wo_id, m.id, m.full_name)}
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, marginBottom: 1,
                                  background: j.assigned_to === m.id ? 'rgba(29,111,232,0.2)' : 'transparent',
                                  color: j.assigned_to === m.id ? BLUE : TEXT, fontWeight: j.assigned_to === m.id ? 700 : 400 }}>
                                {m.full_name}{m.team ? ` (${m.team})` : ''}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Secondary actions */}
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => { setTimeModal(j); setTimeValue(String(j.estimated_hours || '')) }}
                            style={{ ...btnBase, background: 'rgba(245,158,11,0.12)', color: AMBER }}>
                            Add Time
                          </button>
                          <a href={`/work-orders/${j.wo_id}`} style={{ ...btnBase, border: `1px solid ${CARD_BORDER}`, color: DIM, background: 'transparent', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                            Open WO
                          </a>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        )}

        {/* Add Time Modal */}
        {timeModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
            onClick={() => { setTimeModal(null); setTimeValue('') }}>
            <div style={{ background: '#1E1E2E', border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 20, width: 320, maxWidth: '90vw' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Book Hours</div>
              <div style={{ fontSize: 11, color: DIM, marginBottom: 12 }}>{timeModal.wo_number} — {timeModal.description?.slice(0, 40)}</div>
              <input
                type="number" step="0.25" min="0" value={timeValue}
                onChange={e => setTimeValue(e.target.value)}
                autoFocus
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${CARD_BORDER}`, background: CARD_BG, color: TEXT, fontSize: 16, fontWeight: 700, textAlign: 'center', outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
                placeholder="0.00"
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={saveTime} disabled={timeSaving}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: GREEN, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {timeSaving ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => { setTimeModal(null); setTimeValue('') }}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, border: `1px solid ${CARD_BORDER}`, background: 'transparent', color: DIM, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
