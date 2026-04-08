'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser, type UserProfile } from '@/lib/auth'
import Logo from '@/components/Logo'
import OwnershipTypeBadge from '@/components/OwnershipTypeBadge'
import { RefreshCw, Clock, Users, Package } from 'lucide-react'

const FONT = "'Inter', -apple-system, sans-serif"
const BG = '#0C0C12'
const TEXT = '#EDEDF0'
const CARD_BG = '#1A1A26'
const HEADER_BG = '#151520'
const CARD_BORDER = 'rgba(255,255,255,0.08)'
const BLUE = '#1D6FE8'
const AMBER = '#F59E0B'
const GREEN = '#22C55E'
const RED = '#EF4444'
const DIM = '#71717A'

const ALLOWED_ROLES = ['owner', 'gm', 'it_person', 'shop_manager', 'floor_manager']

const KANBAN_COLUMNS = [
  { key: 'pending', label: 'Open', apiStatus: 'pending' },
  { key: 'in_progress', label: 'In Progress', apiStatus: 'in_progress' },
  { key: 'completed', label: 'Completed', apiStatus: 'completed' },
] as const

type PartFilter = 'all' | 'pending' | 'approved' | 'rejected'

const PARTS_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending:   { bg: 'rgba(245,158,11,0.15)', text: AMBER },
  in_stock:  { bg: 'rgba(34,197,94,0.15)',  text: GREEN },
  ordered:   { bg: 'rgba(29,111,232,0.15)', text: BLUE },
  rejected:  { bg: 'rgba(239,68,68,0.15)',  text: RED },
  ready:     { bg: 'rgba(34,197,94,0.15)',  text: GREEN },
  approved:  { bg: 'rgba(34,197,94,0.15)',  text: GREEN },
}

function PartStatusPill({ status }: { status: string }) {
  const c = PARTS_STATUS_COLORS[status] || { bg: 'rgba(255,255,255,0.08)', text: DIM }
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 999,
      background: c.bg, color: c.text, fontSize: 11, fontWeight: 600,
      textTransform: 'capitalize', whiteSpace: 'nowrap',
    }}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

export default function FloorManagerDashboardPage() {
  const supabase = createClient()

  // -- All state at top --
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(0) // 0=Kanban, 1=Parts Requests

  const [jobs, setJobs] = useState<any[]>([])
  const [partsRequests, setPartsRequests] = useState<any[]>([])
  const [mechanics, setMechanics] = useState<any[]>([])

  const dragging = useRef(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [assignModal, setAssignModal] = useState<any | null>(null)
  const [approveModal, setApproveModal] = useState<any | null>(null)
  const [denyModal, setDenyModal] = useState<any | null>(null)
  const [denyReason, setDenyReason] = useState('')

  const [partsFilter, setPartsFilter] = useState<PartFilter>('all')
  const [approveType, setApproveType] = useState<'in_stock' | 'ordered'>('in_stock')
  const [selectedMechanic, setSelectedMechanic] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [exceptionFilter, setExceptionFilter] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const [secondsAgo, setSecondsAgo] = useState(0)
  const [activeTechs, setActiveTechs] = useState<any[]>([])
  const [idleMechanics, setIdleMechanics] = useState<any[]>([])
  const [idleExpanded, setIdleExpanded] = useState(false)
  const [hoursRequests, setHoursRequests] = useState<any[]>([])

  // -- Data fetching --
  const fetchData = useCallback(async (shopId: string) => {
    try {
      const [jobsRes, partsRes, usersRes, activeRes, hoursRes] = await Promise.all([
        fetch(`/api/floor-manager/jobs?shop_id=${shopId}`),
        fetch(`/api/floor-manager/parts-requests?shop_id=${shopId}`),
        fetch(`/api/users?shop_id=${shopId}`),
        fetch(`/api/time-tracking/active?shop_id=${shopId}`),
        fetch('/api/notifications?type=hours_request_more,hours_request_needed&unread=true&limit=100'),
      ])
      if (jobsRes.ok) {
        const d = await jobsRes.json()
        setJobs(Array.isArray(d) ? d : d.data || [])
      }
      if (partsRes.ok) {
        const d = await partsRes.json()
        setPartsRequests(Array.isArray(d) ? d : d.data || [])
      }
      if (usersRes.ok) {
        const d = await usersRes.json()
        const all = Array.isArray(d) ? d : d.data || []
        setMechanics(all.filter((u: any) =>
          ['mechanic', 'technician', 'lead_tech', 'maintenance_technician', 'floor_manager'].includes(u.role)
        ))
      }
      if (activeRes.ok) {
        const d = await activeRes.json()
        setActiveTechs(Array.isArray(d) ? d : [])
        // Derive idle mechanics: clocked in but not assigned to an active job entry
        const active = Array.isArray(d) ? d : []
        const idle = active.filter((t: any) => {
          const minutesIdle = t.idle_minutes || (t.last_activity_at ? Math.floor((Date.now() - new Date(t.last_activity_at).getTime()) / 60000) : 0)
          return minutesIdle > 15
        }).map((t: any) => ({
          ...t,
          idle_minutes: t.idle_minutes || (t.last_activity_at ? Math.floor((Date.now() - new Date(t.last_activity_at).getTime()) / 60000) : 0),
        }))
        setIdleMechanics(idle)
      }
      if (hoursRes.ok) {
        const d = await hoursRes.json()
        setHoursRequests(d.notifications || [])
      }
      setLastRefresh(new Date())
    } catch { /* silent */ }
  }, [])

  // -- Mount + auth --
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    let tickInterval: ReturnType<typeof setInterval>
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { window.location.href = '/login'; return }
      if (!ALLOWED_ROLES.includes(profile.role)) { window.location.href = '/dashboard'; return }
      setUser(profile)
      await fetchData(profile.shop_id)
      setLoading(false)
      // Auto-refresh every 10s, paused during drag
      interval = setInterval(() => {
        if (!dragging.current) {
          fetchData(profile.shop_id)
        }
      }, 10000)
      // Tick seconds-ago counter
      tickInterval = setInterval(() => {
        setLastRefresh(prev => {
          setSecondsAgo(Math.floor((Date.now() - prev.getTime()) / 1000))
          return prev
        })
      }, 1000)
    }
    load()
    return () => { clearInterval(interval); clearInterval(tickInterval) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // -- Manual refresh --
  const handleRefresh = () => {
    if (user) fetchData(user.shop_id)
  }

  // -- Drag & drop handlers --
  const handleDragStart = (e: React.DragEvent, job: any) => {
    dragging.current = true
    e.dataTransfer.setData('application/json', JSON.stringify({ id: job.id, currentStatus: job.status }))
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    dragging.current = false
    setDragOverCol(null)
  }

  const handleDragOver = (e: React.DragEvent, colKey: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCol(colKey)
  }

  const handleDragLeave = () => {
    setDragOverCol(null)
  }

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault()
    setDragOverCol(null)
    dragging.current = false
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'))
      if (data.currentStatus === targetStatus) return
      // Optimistic update
      setJobs(prev => prev.map(j => j.id === data.id ? { ...j, status: targetStatus } : j))
      // Persist
      const res = await fetch('/api/floor-manager/jobs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: data.id, status: targetStatus }),
      })
      if (!res.ok) {
        // Revert on failure
        setJobs(prev => prev.map(j => j.id === data.id ? { ...j, status: data.currentStatus } : j))
      }
    } catch { /* silent */ }
  }

  // -- Assign mechanic (via canonical wo_job_assignments) --
  const handleAssign = async () => {
    if (!assignModal || !selectedMechanic) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/wo-job-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          line_id: assignModal.id,
          wo_id: assignModal.wo_id,
          assignments: [{ user_id: selectedMechanic, name: mechanics.find((m: any) => m.id === selectedMechanic)?.full_name || '', percentage: 100 }],
        }),
      })
      if (res.ok && user) {
        await fetchData(user.shop_id)
        setAssignModal(null)
        setSelectedMechanic('')
      }
    } catch { /* silent */ }
    setActionLoading(false)
  }

  // -- Approve parts request --
  const handleApprove = async () => {
    if (!approveModal) return
    setActionLoading(true)
    try {
      const newStatus = approveType === 'in_stock' ? 'in_stock' : 'ordered'
      const res = await fetch('/api/floor-manager/parts-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: approveModal.id, status: newStatus }),
      })
      if (res.ok && user) {
        await fetchData(user.shop_id)
        setApproveModal(null)
      }
    } catch { /* silent */ }
    setActionLoading(false)
  }

  // -- Deny parts request --
  const handleDeny = async () => {
    if (!denyModal) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/floor-manager/parts-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: denyModal.id, status: 'rejected', deny_reason: denyReason }),
      })
      if (res.ok && user) {
        await fetchData(user.shop_id)
        setDenyModal(null)
        setDenyReason('')
      }
    } catch { /* silent */ }
    setActionLoading(false)
  }

  // -- Group mechanics by team --
  const mechanicsByTeam = mechanics.reduce<Record<string, any[]>>((acc, m) => {
    const team = m.team || 'Unassigned'
    if (!acc[team]) acc[team] = []
    acc[team].push(m)
    return acc
  }, {})

  // -- Jobs per column --
  const jobsByStatus = (status: string) => {
    let filtered = jobs.filter(j => j.status === status)
    if (exceptionFilter === 'unassigned') filtered = filtered.filter(j => !j.mechanic_name && !j.assigned_to)
    else if (exceptionFilter === 'waiting_parts') filtered = filtered.filter(j => j.wo_status === 'waiting_parts')
    else if (exceptionFilter === 'waiting_estimate') filtered = filtered.filter(j => j.wo_estimate_required && !j.wo_estimate_approved)
    else if (exceptionFilter === 'ready_for_invoice') filtered = filtered.filter(j => j.status === 'completed' && !j.wo_invoice_status)
    return filtered
  }

  // -- Filtered parts requests --
  const filteredParts = partsFilter === 'all'
    ? partsRequests
    : partsRequests.filter(pr => {
        if (partsFilter === 'approved') return ['in_stock', 'ordered', 'ready', 'approved'].includes(pr.status)
        if (partsFilter === 'rejected') return pr.status === 'rejected'
        return pr.status === partsFilter
      })

  // ----- Loading screen -----
  if (loading) {
    return (
      <div style={{ background: BG, color: TEXT, fontFamily: FONT, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw size={32} style={{ color: BLUE, marginBottom: 12, animation: 'spin 1.5s linear infinite' }} />
          <p style={{ color: DIM, fontSize: 14 }}>Loading dashboard...</p>
          <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  if (!user) return null

  const tabLabels = ['Kanban', 'Active Techs', 'Parts Requests', 'Hours Requests']
  const tabIcons = [<Users key="u" size={16} />, <Package key="p" size={16} />]

  return (
    <div style={{ background: BG, color: TEXT, fontFamily: FONT, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @media (max-width: 768px) {
          .fm-kanban-row { flex-direction: column !important; }
          .fm-kanban-col { min-width: 0 !important; max-height: 500px !important; }
          .fm-parts-table { display: block; overflow-x: auto; }
        }
        .fm-kanban-col::-webkit-scrollbar { width: 4px; }
        .fm-kanban-col::-webkit-scrollbar-track { background: transparent; }
        .fm-kanban-col::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
      `}</style>

      {/* ===== HEADER ===== */}
      <header style={{
        padding: '12px 20px', borderBottom: `1px solid ${CARD_BORDER}`, background: HEADER_BG,
        flexShrink: 0,
      }}>
        {/* Row 1: Title + Mode Switcher + Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Logo size="sm" />
            <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Floor Manager</span>
            <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: 2, marginLeft: 2 }}>
              <a href="/shop-floor" style={{ padding: '5px 12px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: 'transparent', color: DIM, textDecoration: 'none', cursor: 'pointer' }}>Shop Floor</a>
              <a href="/floor-manager/quick-view" style={{ padding: '5px 12px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: 'transparent', color: DIM, textDecoration: 'none', cursor: 'pointer' }}>Quick View</a>
            </div>
          </div>
          <button onClick={handleRefresh} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
            borderRadius: 6, border: `1px solid ${CARD_BORDER}`, background: 'transparent',
            color: DIM, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
          }}>
            <RefreshCw size={13} />
            <span>{secondsAgo}s ago</span>
          </button>
        </div>
        {/* Row 2: Dashboard Tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 3, width: 'fit-content' }}>
          {tabLabels.map((label, i) => (
            <button key={i} onClick={() => setTab(i)} style={{
              padding: '6px 14px', borderRadius: 6, border: 'none',
              background: tab === i ? BLUE : 'transparent',
              color: tab === i ? '#fff' : DIM,
              fontFamily: FONT, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s',
            }}>
              {tabIcons[i]} {label}
            </button>
          ))}
        </div>
      </header>

      {/* ===== TAB 0: KANBAN BOARD ===== */}
      {tab === 0 && (
        <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Stats row */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            {KANBAN_COLUMNS.map(col => {
              const count = jobsByStatus(col.key).length
              const colColor = col.key === 'pending' ? AMBER : col.key === 'in_progress' ? BLUE : GREEN
              return (
                <div key={col.key} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
                  background: 'rgba(255,255,255,0.03)', borderRadius: 8,
                  border: `1px solid ${CARD_BORDER}`,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: colColor }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: DIM }}>{col.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{count}</span>
                </div>
              )
            })}
          </div>

          {/* Idle Mechanics Alert */}
          {idleMechanics.length > 0 && (
            <div style={{
              background: 'rgba(245,158,11,0.08)', border: `1px solid rgba(245,158,11,0.25)`,
              borderRadius: 10, padding: '10px 16px', marginBottom: 12,
            }}>
              <div
                onClick={() => setIdleExpanded(!idleExpanded)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={14} style={{ color: AMBER }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: AMBER }}>
                    {idleMechanics.length} Idle Mechanic{idleMechanics.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: DIM }}>{idleExpanded ? 'Hide' : 'Show'}</span>
              </div>
              {idleExpanded && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {idleMechanics.map((m: any, i: number) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '6px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 6,
                    }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: TEXT }}>{m.full_name || m.user_name || 'Unknown'}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 11, color: DIM }}>
                          In: {m.clocked_in_at ? new Date(m.clocked_in_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: AMBER }}>{m.idle_minutes}m idle</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Exception summary */}
          {(() => {
            const exceptions: Record<string, number> = {}
            for (const j of jobs) {
              if (j.automation?.blocked_by) {
                const key = j.automation.owner || 'unknown'
                exceptions[key] = (exceptions[key] || 0) + 1
              }
            }
            const unassigned = jobs.filter(j => j.status === 'pending' && !j.mechanic_name).length
            const waitingParts = jobs.filter(j => j.wo_status === 'waiting_parts').length
            const waitingEstimate = jobs.filter(j => j.wo_estimate_required && !j.wo_estimate_approved).length
            const overdueCount = jobs.filter(j => j.status === 'in_progress' && j.estimated_hours && j.estimated_hours > 0).length // rough proxy
            const needsInvoice = jobs.filter(j => j.status === 'completed' && !j.wo_invoice_status).length
            const badges = [
              unassigned > 0 && { label: `${unassigned} Unassigned`, color: RED, key: 'unassigned' },
              waitingParts > 0 && { label: `${waitingParts} Waiting Parts`, color: AMBER, key: 'waiting_parts' },
              waitingEstimate > 0 && { label: `${waitingEstimate} Waiting Estimate`, color: AMBER, key: 'waiting_estimate' },
              needsInvoice > 0 && { label: `${needsInvoice} Ready for Invoice`, color: GREEN, key: 'ready_for_invoice' },
            ].filter(Boolean) as { label: string; color: string; key: string }[]
            if (badges.length === 0 && !exceptionFilter) return null
            return (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                {badges.map(b => (
                  <span key={b.key} onClick={() => setExceptionFilter(exceptionFilter === b.key ? null : b.key)}
                    style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      background: exceptionFilter === b.key ? b.color : `${b.color}18`,
                      color: exceptionFilter === b.key ? '#fff' : b.color,
                      border: `1px solid ${exceptionFilter === b.key ? b.color : b.color + '30'}`,
                    }}>
                    {b.label}
                  </span>
                ))}
                {exceptionFilter && (
                  <span onClick={() => setExceptionFilter(null)} style={{ fontSize: 11, color: DIM, cursor: 'pointer', padding: '4px 8px' }}>
                    Clear filter
                  </span>
                )}
              </div>
            )
          })()}

          {/* Kanban columns */}
          <div className="fm-kanban-row" style={{ display: 'flex', gap: 12, flex: 1, overflow: 'hidden' }}>
            {KANBAN_COLUMNS.map(col => {
              const colJobs = jobsByStatus(col.key)
              const colColor = col.key === 'pending' ? AMBER : col.key === 'in_progress' ? BLUE : GREEN
              const isOver = dragOverCol === col.key
              return (
                <div
                  key={col.key}
                  className="fm-kanban-col"
                  onDragOver={e => handleDragOver(e, col.key)}
                  onDragLeave={handleDragLeave}
                  onDrop={e => handleDrop(e, col.key)}
                  style={{
                    flex: 1, minWidth: 260,
                    background: isOver ? 'rgba(29,111,232,0.06)' : 'rgba(255,255,255,0.03)',
                    border: isOver ? `1px solid ${BLUE}` : `1px solid ${CARD_BORDER}`,
                    borderRadius: 12, display: 'flex', flexDirection: 'column',
                    transition: 'background 0.15s, border-color 0.15s',
                    overflow: 'hidden',
                  }}
                >
                  {/* Column header */}
                  <div style={{
                    padding: '12px 14px', borderBottom: `1px solid ${CARD_BORDER}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{col.label}</span>
                    <span style={{
                      padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                      background: `${colColor}22`, color: colColor,
                    }}>
                      {colJobs.length}
                    </span>
                  </div>

                  {/* Card list */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {colJobs.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '40px 12px', color: DIM, fontSize: 12 }}>
                        No jobs
                      </div>
                    )}
                    {colJobs.map((job: any) => {
                      const mechanic = mechanics.find(m => m.id === job.assigned_to)
                      const mechanicName = mechanic?.full_name || job.mechanic_name
                      const isUnassigned = !mechanicName
                      return (
                        <div
                          key={job.id}
                          draggable
                          onDragStart={e => handleDragStart(e, job)}
                          onDragEnd={handleDragEnd}
                          onClick={() => {
                            setAssignModal(job)
                            setSelectedMechanic(job.assigned_to || '')
                            setSuggestions([])
                            const desc = job.description || ''
                            if (desc) {
                              setSuggestionsLoading(true)
                              fetch(`/api/mechanic-skills?type=suggest&job_description=${encodeURIComponent(desc)}`)
                                .then(r => r.ok ? r.json() : [])
                                .then(data => setSuggestions(Array.isArray(data) ? data.slice(0, 4) : []))
                                .catch(() => setSuggestions([]))
                                .finally(() => setSuggestionsLoading(false))
                            }
                          }}
                          style={{
                            background: CARD_BG, border: `1px solid ${CARD_BORDER}`,
                            borderRadius: 10, padding: 12, cursor: 'grab',
                            transition: 'border-color 0.15s, box-shadow 0.15s',
                          }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.16)'
                            ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLDivElement).style.borderColor = CARD_BORDER
                            ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
                          }}
                        >
                          {/* WO# + Customer */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ color: BLUE, fontSize: 11, fontFamily: 'monospace', fontWeight: 600 }}>
                              {job.wo_number || job.so_number || `WO-${job.id?.slice(0, 6)}`}
                            </span>
                            {job.customer_name && (
                              <span style={{ color: DIM, fontSize: 11, maxWidth: '50%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {job.customer_name}
                              </span>
                            )}
                          </div>

                          {/* Ownership Type Badge */}
                          {job.ownership_type && job.ownership_type !== 'fleet_asset' && (
                            <div style={{ marginBottom: 6 }}><OwnershipTypeBadge type={job.ownership_type} size="sm" dark /></div>
                          )}

                          {/* Description */}
                          {job.description && (
                            <p style={{
                              margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: TEXT,
                              lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {job.description}
                            </p>
                          )}

                          {/* Automation badges */}
                          {job.automation && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                              {job.automation.blocked_by && (
                                <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: `${AMBER}18`, color: AMBER }}>{job.automation.blocked_by}</span>
                              )}
                              {job.wo_estimate_required && !job.wo_estimate_approved && (
                                <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: `${AMBER}18`, color: AMBER }}>Estimate needed</span>
                              )}
                              {job.wo_status === 'waiting_parts' && (
                                <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: `${AMBER}18`, color: AMBER }}>Waiting parts</span>
                              )}
                            </div>
                          )}

                          {/* Bottom row */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                            <span style={{
                              fontSize: 11, fontWeight: 600,
                              color: isUnassigned ? RED : DIM,
                            }}>
                              {isUnassigned ? 'Unassigned' : mechanicName}
                            </span>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              {job.expected_hours && (
                                <span style={{
                                  display: 'flex', alignItems: 'center', gap: 3,
                                  padding: '2px 7px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                                  background: 'rgba(255,255,255,0.06)', color: DIM,
                                }}>
                                  <Clock size={10} /> {job.expected_hours}h
                                </span>
                              )}
                              {job.unit_type && (
                                <span style={{
                                  padding: '2px 7px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                                  background: 'rgba(255,255,255,0.06)', color: DIM,
                                }}>
                                  {job.unit_type}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* ETC + Next action */}
                          <div style={{ marginTop: 4, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            {job.estimated_hours > 0 && (
                              <span style={{ fontSize: 10, fontWeight: 600, color: (job.actual_hours || 0) > job.estimated_hours ? RED : DIM }}>
                                {job.actual_hours ? `${job.actual_hours}h / ${job.estimated_hours}h` : `Est: ${job.estimated_hours}h`}
                              </span>
                            )}
                            {job.automation?.next_action && job.automation.next_action !== 'Complete' && (
                              <span style={{ fontSize: 10, color: DIM, fontStyle: 'italic' }}>
                                {job.automation.next_action}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ===== TAB 1: ACTIVE TECHS ===== */}
      {tab === 1 && (
        <div style={{ flex: 1, padding: 20, overflow: 'auto' }}>
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>
              Active Technicians ({activeTechs.length})
            </h3>
            {activeTechs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: DIM }}>
                <Clock size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
                <p style={{ fontSize: 15, fontWeight: 600 }}>No technicians currently clocked in</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {activeTechs.map((tech: any) => {
                  const elapsed = Math.floor((Date.now() - new Date(tech.clocked_in_at).getTime()) / 1000)
                  const h = Math.floor(elapsed / 3600)
                  const m = Math.floor((elapsed % 3600) / 60)
                  const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`
                  return (
                    <div key={tech.id} style={{
                      background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 12,
                      padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%', background: GREEN,
                          boxShadow: `0 0 6px ${GREEN}`,
                        }} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{tech.mechanic_name}</div>
                          <div style={{ fontSize: 12, color: DIM, marginTop: 2 }}>
                            {tech.wo_number} — {tech.job_description}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: GREEN, fontFamily: 'monospace' }}>{timeStr}</div>
                        <div style={{ fontSize: 11, color: DIM }}>elapsed</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== TAB 2: PARTS REQUESTS ===== */}
      {tab === 2 && (
        <div style={{ flex: 1, padding: 20, overflow: 'auto' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Parts Requests</h2>
              {/* Filter pills */}
              <div style={{ display: 'flex', gap: 6 }}>
                {(['all', 'pending', 'approved', 'rejected'] as PartFilter[]).map(f => (
                  <button key={f} onClick={() => setPartsFilter(f)} style={{
                    padding: '5px 12px', borderRadius: 999, border: 'none',
                    background: partsFilter === f ? BLUE : 'rgba(255,255,255,0.06)',
                    color: partsFilter === f ? '#fff' : DIM,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
                    textTransform: 'capitalize', transition: 'all 0.15s',
                  }}>
                    {f === 'all' ? 'All' : f}
                  </button>
                ))}
              </div>
            </div>

            {filteredParts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: DIM }}>
                <Package size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
                <p style={{ fontSize: 15, fontWeight: 600 }}>No parts requests</p>
                <p style={{ fontSize: 13, marginTop: 4 }}>Parts requests from mechanics will appear here.</p>
              </div>
            ) : (
              <div className="fm-parts-table" style={{ borderRadius: 12, border: `1px solid ${CARD_BORDER}`, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                      {['Mechanic', 'Part', 'Qty', 'Notes', 'WO #', 'Status', 'Requested', 'Actions'].map(h => (
                        <th key={h} style={{
                          padding: '10px 14px', textAlign: 'left', fontWeight: 600,
                          color: DIM, fontSize: 11, textTransform: 'uppercase',
                          letterSpacing: '0.05em', borderBottom: `1px solid ${CARD_BORDER}`,
                          whiteSpace: 'nowrap',
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParts.map((pr: any, idx: number) => (
                      <tr key={pr.id || idx} style={{
                        borderBottom: `1px solid ${CARD_BORDER}`,
                        background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                      }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: TEXT, whiteSpace: 'nowrap' }}>
                          {pr.mechanic_name || pr.requested_by_name || 'Unknown'}
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: TEXT }}>
                          {pr.part_name}
                        </td>
                        <td style={{ padding: '10px 14px', color: DIM, textAlign: 'center' }}>
                          {pr.quantity}
                        </td>
                        <td style={{ padding: '10px 14px', color: DIM, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {pr.notes || '-'}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ color: BLUE, fontFamily: 'monospace', fontSize: 11, fontWeight: 600 }}>
                            {pr.wo_number || '-'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <PartStatusPill status={pr.status || 'pending'} />
                        </td>
                        <td style={{ padding: '10px 14px', color: DIM, fontSize: 12, whiteSpace: 'nowrap' }}>
                          {pr.created_at ? new Date(pr.created_at).toLocaleDateString() : '-'}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          {pr.status === 'pending' ? (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                onClick={() => { setApproveModal(pr); setApproveType('in_stock') }}
                                style={{
                                  padding: '5px 12px', borderRadius: 6, border: 'none',
                                  background: GREEN, color: '#fff', fontSize: 11, fontWeight: 700,
                                  cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap',
                                }}
                              >
                                APPROVE
                              </button>
                              <button
                                onClick={() => { setDenyModal(pr); setDenyReason('') }}
                                style={{
                                  padding: '5px 12px', borderRadius: 6, border: 'none',
                                  background: RED, color: '#fff', fontSize: 11, fontWeight: 700,
                                  cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap',
                                }}
                              >
                                DENY
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: DIM, fontSize: 11 }}>--</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== TAB 3: HOURS REQUESTS ===== */}
      {tab === 3 && (
        <div style={{ padding: '12px 16px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>Mechanic Hours Requests</h3>
          {hoursRequests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: DIM, fontSize: 13 }}>
              <Clock size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
              <div>No pending hours requests</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {hoursRequests.map((r: any) => (
                <div key={r.id} style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 10, padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: AMBER }}>{r.title}</span>
                    <span style={{ fontSize: 10, color: DIM }}>{r.created_at ? new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}</span>
                  </div>
                  <div style={{ fontSize: 12, color: TEXT, marginBottom: 6 }}>{r.body}</div>
                  {r.link && (
                    <a href={r.link} onClick={() => { fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, action: 'mark_read' }) }).catch(() => {}) }} style={{ fontSize: 12, color: BLUE, fontWeight: 600, textDecoration: 'none' }}>Open WO →</a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== ASSIGN MODAL ===== */}
      {assignModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: 20,
          }}
          onClick={e => { if (e.target === e.currentTarget) { setAssignModal(null); setSelectedMechanic('') } }}
        >
          <div style={{
            background: HEADER_BG, borderRadius: 16, width: '100%', maxWidth: 460,
            border: `1px solid ${CARD_BORDER}`, overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 20px', borderBottom: `1px solid ${CARD_BORDER}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Assign Mechanic</h3>
              <button onClick={() => { setAssignModal(null); setSelectedMechanic('') }} style={{
                background: 'none', border: 'none', color: DIM, cursor: 'pointer', fontSize: 20, padding: 4, lineHeight: 1,
              }}>
                &times;
              </button>
            </div>

            <div style={{ padding: 20 }}>
              {/* Job info */}
              <div style={{ marginBottom: 16, padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: `1px solid ${CARD_BORDER}` }}>
                <div style={{ fontSize: 11, color: BLUE, fontFamily: 'monospace', fontWeight: 600, marginBottom: 4 }}>
                  {assignModal.wo_number || assignModal.so_number || `WO-${assignModal.id?.slice(0, 6)}`}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>
                  {assignModal.description || 'No description'}
                </div>
                {assignModal.customer_name && (
                  <div style={{ fontSize: 12, color: DIM, marginTop: 4 }}>{assignModal.customer_name}</div>
                )}
                <div style={{ fontSize: 12, color: DIM, marginTop: 6 }}>
                  Currently: <span style={{ fontWeight: 600, color: assignModal.assigned_to ? TEXT : RED }}>
                    {(mechanics.find(m => m.id === assignModal.assigned_to)?.full_name) || assignModal.mechanic_name || 'Unassigned'}
                  </span>
                </div>
              </div>

              {/* Mechanic suggestions */}
              {(suggestions.length > 0 || suggestionsLoading) && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Suggested</label>
                  {suggestionsLoading ? (
                    <div style={{ fontSize: 11, color: DIM, padding: '6px 0' }}>Loading...</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {suggestions.filter(s => s.user_id !== assignModal?.assigned_to).map(s => (
                        <div key={s.user_id} onClick={() => setSelectedMechanic(s.user_id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8,
                            border: `1px solid ${selectedMechanic === s.user_id ? BLUE : CARD_BORDER}`,
                            background: selectedMechanic === s.user_id ? 'rgba(29,111,232,0.08)' : 'rgba(255,255,255,0.03)', cursor: 'pointer' }}
                          onMouseEnter={e => { if (selectedMechanic !== s.user_id) (e.currentTarget.style.background = 'rgba(255,255,255,0.06)') }}
                          onMouseLeave={e => { if (selectedMechanic !== s.user_id) (e.currentTarget.style.background = 'rgba(255,255,255,0.03)') }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: TEXT }}>{s.name}</div>
                            <div style={{ fontSize: 10, color: DIM }}>
                              {s.matchingSkills?.length > 0 ? s.matchingSkills.map((sk: any) => sk.skill).join(', ') : s.status === 'on_job' ? 'Clocked in' : 'Available'}
                              {s.jobsInQueue > 0 ? ` · ${s.jobsInQueue} jobs` : ' · Free'}
                            </div>
                          </div>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                            background: s.score >= 50 ? `${GREEN}22` : s.score >= 20 ? `${AMBER}22` : 'rgba(255,255,255,0.06)',
                            color: s.score >= 50 ? GREEN : s.score >= 20 ? AMBER : DIM }}>
                            {s.score >= 50 ? 'Strong' : s.score >= 20 ? 'Fair' : 'Low'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Mechanic dropdown */}
              <label style={{ fontSize: 11, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                {suggestions.length > 0 ? 'Or select manually' : 'Select Mechanic'}
              </label>
              <select
                value={selectedMechanic}
                onChange={e => setSelectedMechanic(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 10,
                  border: `1px solid ${CARD_BORDER}`, background: BG, color: TEXT,
                  fontFamily: FONT, fontSize: 13, outline: 'none', marginBottom: 12,
                  boxSizing: 'border-box',
                }}
              >
                <option value="">-- Select --</option>
                {Object.entries(mechanicsByTeam).map(([team, members]) => (
                  <optgroup key={team} label={team}>
                    {members.map((m: any) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name}{m.skills?.length ? ` (${m.skills.join(', ')})` : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>

              {/* Mechanic skills preview */}
              {selectedMechanic && (() => {
                const mech = mechanics.find(m => m.id === selectedMechanic)
                if (!mech?.skills?.length) return null
                return (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {mech.skills.map((s: string, i: number) => (
                      <span key={i} style={{
                        padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: 'rgba(29,111,232,0.12)', color: BLUE,
                      }}>
                        {s}
                      </span>
                    ))}
                  </div>
                )
              })()}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setAssignModal(null); setSelectedMechanic('') }}
                  style={{
                    padding: '9px 18px', borderRadius: 10,
                    border: `1px solid ${CARD_BORDER}`, background: 'transparent',
                    color: DIM, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: FONT,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssign}
                  disabled={!selectedMechanic || actionLoading}
                  style={{
                    padding: '9px 18px', borderRadius: 10, border: 'none',
                    background: BLUE, color: '#fff', fontWeight: 700, fontSize: 13,
                    cursor: selectedMechanic && !actionLoading ? 'pointer' : 'not-allowed',
                    fontFamily: FONT, opacity: !selectedMechanic || actionLoading ? 0.5 : 1,
                  }}
                >
                  {actionLoading ? 'Assigning...' : 'Assign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== APPROVE MODAL ===== */}
      {approveModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: 20,
          }}
          onClick={e => { if (e.target === e.currentTarget) setApproveModal(null) }}
        >
          <div style={{
            background: HEADER_BG, borderRadius: 16, width: '100%', maxWidth: 420,
            border: `1px solid ${CARD_BORDER}`, overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 20px', borderBottom: `1px solid ${CARD_BORDER}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Approve Parts Request</h3>
              <button onClick={() => setApproveModal(null)} style={{
                background: 'none', border: 'none', color: DIM, cursor: 'pointer', fontSize: 20, padding: 4, lineHeight: 1,
              }}>
                &times;
              </button>
            </div>

            <div style={{ padding: 20 }}>
              {/* Part info */}
              <div style={{ marginBottom: 16, padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: `1px solid ${CARD_BORDER}` }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{approveModal.part_name}</div>
                <div style={{ fontSize: 12, color: DIM, marginTop: 4 }}>
                  Qty: {approveModal.quantity} | Requested by: {approveModal.mechanic_name || approveModal.requested_by_name || 'Unknown'}
                </div>
              </div>

              {/* Radio options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                  background: approveType === 'in_stock' ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)',
                  border: approveType === 'in_stock' ? `1px solid ${GREEN}` : `1px solid ${CARD_BORDER}`,
                  borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <input
                    type="radio"
                    name="approve_type"
                    value="in_stock"
                    checked={approveType === 'in_stock'}
                    onChange={() => setApproveType('in_stock')}
                    style={{ accentColor: GREEN }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>In Stock</div>
                    <div style={{ fontSize: 11, color: DIM }}>Part is available in inventory</div>
                  </div>
                </label>

                <label style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                  background: approveType === 'ordered' ? 'rgba(29,111,232,0.08)' : 'rgba(255,255,255,0.03)',
                  border: approveType === 'ordered' ? `1px solid ${BLUE}` : `1px solid ${CARD_BORDER}`,
                  borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <input
                    type="radio"
                    name="approve_type"
                    value="ordered"
                    checked={approveType === 'ordered'}
                    onChange={() => setApproveType('ordered')}
                    style={{ accentColor: BLUE }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Will be Ordered</div>
                    <div style={{ fontSize: 11, color: DIM }}>Part needs to be ordered from supplier</div>
                  </div>
                </label>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setApproveModal(null)}
                  style={{
                    padding: '9px 18px', borderRadius: 10,
                    border: `1px solid ${CARD_BORDER}`, background: 'transparent',
                    color: DIM, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: FONT,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  style={{
                    padding: '9px 18px', borderRadius: 10, border: 'none',
                    background: GREEN, color: '#fff', fontWeight: 700, fontSize: 13,
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                    fontFamily: FONT, opacity: actionLoading ? 0.5 : 1,
                  }}
                >
                  {actionLoading ? 'Approving...' : 'Confirm Approval'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== DENY MODAL ===== */}
      {denyModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: 20,
          }}
          onClick={e => { if (e.target === e.currentTarget) { setDenyModal(null); setDenyReason('') } }}
        >
          <div style={{
            background: HEADER_BG, borderRadius: 16, width: '100%', maxWidth: 420,
            border: `1px solid ${CARD_BORDER}`, overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 20px', borderBottom: `1px solid ${CARD_BORDER}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Deny Parts Request</h3>
              <button onClick={() => { setDenyModal(null); setDenyReason('') }} style={{
                background: 'none', border: 'none', color: DIM, cursor: 'pointer', fontSize: 20, padding: 4, lineHeight: 1,
              }}>
                &times;
              </button>
            </div>

            <div style={{ padding: 20 }}>
              {/* Part info */}
              <div style={{ marginBottom: 16, padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: `1px solid ${CARD_BORDER}` }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{denyModal.part_name}</div>
                <div style={{ fontSize: 12, color: DIM, marginTop: 4 }}>
                  Qty: {denyModal.quantity} | Requested by: {denyModal.mechanic_name || denyModal.requested_by_name || 'Unknown'}
                </div>
              </div>

              {/* Reason */}
              <label style={{ fontSize: 11, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                Reason for Denial
              </label>
              <textarea
                value={denyReason}
                onChange={e => setDenyReason(e.target.value)}
                placeholder="Explain why this request is being denied..."
                rows={4}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 10,
                  border: `1px solid ${CARD_BORDER}`, background: BG, color: TEXT,
                  fontFamily: FONT, fontSize: 13, outline: 'none', resize: 'vertical',
                  boxSizing: 'border-box', marginBottom: 16,
                }}
              />

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setDenyModal(null); setDenyReason('') }}
                  style={{
                    padding: '9px 18px', borderRadius: 10,
                    border: `1px solid ${CARD_BORDER}`, background: 'transparent',
                    color: DIM, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: FONT,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeny}
                  disabled={actionLoading}
                  style={{
                    padding: '9px 18px', borderRadius: 10, border: 'none',
                    background: RED, color: '#fff', fontWeight: 700, fontSize: 13,
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                    fontFamily: FONT, opacity: actionLoading ? 0.5 : 1,
                  }}
                >
                  {actionLoading ? 'Denying...' : 'Confirm Denial'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
