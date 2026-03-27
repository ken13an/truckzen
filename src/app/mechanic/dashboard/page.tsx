'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser, type UserProfile } from '@/lib/auth'
import Logo from '@/components/Logo'
import { ChevronRight, Wrench, Clock, CheckCircle2, XCircle, Package, Play, Square } from 'lucide-react'

const MECHANIC_ROLES = ['mechanic', 'technician', 'lead_tech', 'maintenance_technician']

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

type Filter = 'all' | 'pending' | 'accepted' | 'in_progress' | 'completed'

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending:    { bg: 'rgba(245,158,11,0.15)', text: AMBER },
  accepted:   { bg: 'rgba(29,111,232,0.15)', text: BLUE },
  in_progress:{ bg: 'rgba(29,111,232,0.15)', text: BLUE },
  completed:  { bg: 'rgba(34,197,94,0.15)',  text: GREEN },
  declined:   { bg: 'rgba(239,68,68,0.15)',  text: RED },
  requested:  { bg: 'rgba(245,158,11,0.15)', text: AMBER },
  approved:   { bg: 'rgba(34,197,94,0.15)',  text: GREEN },
  rejected:   { bg: 'rgba(239,68,68,0.15)',  text: RED },
  ready:      { bg: 'rgba(29,111,232,0.15)', text: BLUE },
}

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Espa\u00f1ol' },
  { code: 'ru', label: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439' },
  { code: 'uz', label: "O'zbek" },
]

function StatusPill({ status }: { status: string }) {
  const label = status || 'pending'
  const c = STATUS_COLORS[label] || { bg: 'rgba(255,255,255,0.08)', text: DIM }
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 999,
      background: c.bg, color: c.text, fontSize: 12, fontWeight: 600,
      textTransform: 'capitalize', whiteSpace: 'nowrap',
    }}>
      {label.replace(/_/g, ' ')}
    </span>
  )
}

export default function MechanicDashboardPage() {
  const supabase = createClient()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(0)
  const [jobs, setJobs] = useState<any[]>([])
  const [partsRequests, setPartsRequests] = useState<any[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [requestModal, setRequestModal] = useState<any | null>(null)
  const [requestForm, setRequestForm] = useState({ part_name: '', quantity: '1', notes: '' })
  const [language, setLanguage] = useState('en')
  const [savingLang, setSavingLang] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [declineModal, setDeclineModal] = useState<string | null>(null) // assignment ID
  const [declineReason, setDeclineReason] = useState('')
  const [activeClock, setActiveClock] = useState<any>(null) // { id, clocked_in_at, so_line_id, job_description, wo_number }
  const [elapsedSec, setElapsedSec] = useState(0)
  const [clockLoading, setClockLoading] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Timer logic
  useEffect(() => {
    if (activeClock?.clocked_in_at) {
      const start = new Date(activeClock.clocked_in_at).getTime()
      const tick = () => setElapsedSec(Math.floor((Date.now() - start) / 1000))
      tick()
      timerRef.current = setInterval(tick, 1000)
      return () => { if (timerRef.current) clearInterval(timerRef.current) }
    } else {
      setElapsedSec(0)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [activeClock?.clocked_in_at])

  const formatTimer = (sec: number) => {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const fetchActiveClock = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/mechanic/active-clock?user_id=${userId}`)
      if (res.ok) {
        const data = await res.json()
        setActiveClock(data)
      }
    } catch { /* silent */ }
  }, [])

  const handleClockIn = async (job: any) => {
    if (!user) return
    setClockLoading(job.line_id || job.id)
    try {
      const res = await fetch('/api/mechanic/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          so_line_id: job.line_id || job.line?.id,
          user_id: user.id,
          service_order_id: job.wo?.id || job.line?.so_id,
          shop_id: user.shop_id,
        }),
      })
      if (res.ok) {
        const entry = await res.json()
        setActiveClock({
          id: entry.id,
          clocked_in_at: entry.clocked_in_at,
          so_line_id: job.line_id || job.line?.id,
          job_description: job.line?.description || '',
          wo_number: job.wo?.so_number || '',
        })
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Clock in failed')
      }
    } catch { alert('Clock in failed') }
    setClockLoading(null)
  }

  const handleClockOut = async () => {
    if (!activeClock?.id) return
    setClockLoading('clock-out')
    try {
      const res = await fetch('/api/mechanic/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time_entry_id: activeClock.id, user_id: user?.id }),
      })
      if (res.ok) {
        const data = await res.json()
        setActiveClock(null)
        alert(`Clocked out. Session: ${data.duration_minutes} min. Total on job: ${data.total_hours_on_job} hrs`)
      }
    } catch { alert('Clock out failed') }
    setClockLoading(null)
  }

  const fetchData = useCallback(async (userId: string) => {
    try {
      const [jobsRes, partsRes] = await Promise.all([
        fetch(`/api/mechanic/jobs?user_id=${userId}`),
        fetch(`/api/mechanic/parts-request?user_id=${userId}`),
      ])
      if (jobsRes.ok) {
        const d = await jobsRes.json()
        const raw = Array.isArray(d) ? d : d.data || []
        // Derive display status from so_lines.line_status (canonical truth)
        // wo_job_assignments has no status column — line_status is the source
        setJobs(raw.map((j: any) => ({
          ...j,
          status: j.status || (
            j.line?.line_status === 'completed' ? 'completed' :
            j.line?.line_status === 'in_progress' ? 'in_progress' : 'pending'
          ),
        })))
      }
      if (partsRes.ok) {
        const d = await partsRes.json()
        setPartsRequests(Array.isArray(d) ? d : d.data || [])
      }
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { window.location.href = '/login'; return }
      if (!MECHANIC_ROLES.includes(profile.role)) { window.location.href = '/dashboard'; return }
      setUser(profile)
      setLanguage(profile.language || 'en')
      await Promise.all([fetchData(profile.id), fetchActiveClock(profile.id)])
      setLoading(false)
      interval = setInterval(() => fetchData(profile.id), 15000)
    }
    load()
    return () => clearInterval(interval)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleJobAction = async (assignmentId: string, action: 'accept' | 'decline' | 'complete' | 'start', reason?: string) => {
    if (!user) return
    setActionLoading(assignmentId + action)
    try {
      const res = await fetch('/api/mechanic/accept-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: assignmentId, action, user_id: user.id, reason }),
      })
      if (res.ok) {
        await fetchData(user.id)
        if (action === 'decline') { setDeclineModal(null); setDeclineReason('') }
      }
    } catch { /* silent */ }
    setActionLoading(null)
  }

  const handlePartsRequest = async () => {
    if (!user || !requestModal) return
    setActionLoading('parts-submit')
    try {
      const res = await fetch('/api/mechanic/parts-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          assignment_id: requestModal.id,
          work_order_id: requestModal.wo?.id || requestModal.line?.so_id,
          part_name: requestForm.part_name,
          quantity: parseInt(requestForm.quantity) || 1,
          notes: requestForm.notes,
        }),
      })
      if (res.ok) {
        setRequestModal(null)
        setRequestForm({ part_name: '', quantity: '1', notes: '' })
        await fetchData(user.id)
      }
    } catch { /* silent */ }
    setActionLoading(null)
  }

  const handleSaveLanguage = async () => {
    if (!user) return
    setSavingLang(true)
    try {
      await supabase.from('users').update({ language }).eq('id', user.id)
    } catch { /* silent */ }
    setSavingLang(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // ----- Loading / guard -----
  if (loading) {
    return (
      <div style={{ background: BG, color: TEXT, fontFamily: FONT, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Wrench size={32} style={{ color: BLUE, marginBottom: 12, animation: 'spin 1.5s linear infinite' }} />
          <p style={{ color: DIM, fontSize: 14 }}>Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  const isAlsoAdmin = ['owner', 'gm', 'it_person', 'shop_manager', 'office_admin'].includes(user.role)

  const filteredJobs = filter === 'all' ? jobs : jobs.filter(j => j.status === filter)

  const leftBarColor = (status: string) => {
    if (status === 'pending') return AMBER
    if (status === 'accepted' || status === 'in_progress') return BLUE
    if (status === 'completed') return GREEN
    return DIM
  }

  const activeJobs = jobs.filter(j => ['accepted', 'in_progress'].includes(j.status))

  // ----- Tab labels -----
  const tabLabels = ['My Jobs', 'Parts Requests', 'Profile']
  const tabIcons = [<Wrench key="w" size={16} />, <Package key="p" size={16} />, null]

  return (
    <div style={{ background: BG, color: TEXT, fontFamily: FONT, minHeight: '100vh' }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', borderBottom: `1px solid ${CARD_BORDER}`, background: CARD_BG,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo size="sm" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
          {isAlsoAdmin && (
            <a href="/dashboard" style={{ color: BLUE, textDecoration: 'none', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              Back to main app <ChevronRight size={14} />
            </a>
          )}
          <span style={{ color: DIM }}>{user.full_name}</span>
        </div>
      </header>

      {/* Tab Bar */}
      <nav style={{
        display: 'flex', borderBottom: `1px solid ${CARD_BORDER}`, background: CARD_BG,
        overflowX: 'auto',
      }}>
        {tabLabels.map((label, i) => (
          <button key={i} onClick={() => setTab(i)} style={{
            flex: 1, padding: '12px 16px', background: 'none', border: 'none',
            color: tab === i ? BLUE : DIM, fontFamily: FONT, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', borderBottom: tab === i ? `2px solid ${BLUE}` : '2px solid transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'color 0.15s',
          }}>
            {tabIcons[i]} {label}
          </button>
        ))}
      </nav>

      <div style={{ padding: '16px 20px', maxWidth: 720, margin: '0 auto' }}>
        {/* ========== ACTIVE CLOCK BANNER ========== */}
        {activeClock && (
          <div style={{
            background: 'rgba(34,197,94,0.1)', border: `1px solid ${GREEN}`, borderRadius: 14,
            padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: GREEN, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                Clocked In — Active
              </div>
              <div style={{ fontSize: 36, fontWeight: 700, fontFamily: "'Bebas Neue', monospace, sans-serif", color: GREEN, letterSpacing: 2 }}>
                {formatTimer(elapsedSec)}
              </div>
              <div style={{ fontSize: 12, color: DIM, marginTop: 2 }}>
                {activeClock.wo_number} — {activeClock.job_description}
              </div>
            </div>
            <button
              onClick={handleClockOut}
              disabled={clockLoading === 'clock-out'}
              style={{
                padding: '10px 20px', borderRadius: 10, border: 'none',
                background: RED, color: '#fff', fontWeight: 700, fontSize: 14,
                cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 6,
                opacity: clockLoading === 'clock-out' ? 0.6 : 1,
              }}
            >
              <Square size={14} fill="#fff" /> Clock Out
            </button>
          </div>
        )}

        {/* ========== TAB 0: MY JOBS ========== */}
        {tab === 0 && (
          <>
            {/* Filter pills */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {(['all', 'pending', 'in_progress', 'completed'] as Filter[]).map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: '6px 14px', borderRadius: 999, border: 'none',
                  background: filter === f ? BLUE : 'rgba(255,255,255,0.06)',
                  color: filter === f ? '#fff' : DIM,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
                  textTransform: 'capitalize', transition: 'all 0.15s',
                }}>
                  {f === 'all' ? 'All' : f.replace(/_/g, ' ')}
                </button>
              ))}
            </div>

            {filteredJobs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: DIM }}>
                <Wrench size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
                <p style={{ fontSize: 15, fontWeight: 600 }}>No jobs assigned to you yet</p>
                <p style={{ fontSize: 13, marginTop: 4 }}>When a manager assigns work, it will appear here.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filteredJobs.map((job: any) => (
                  <div key={job.id} style={{
                    background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 12,
                    display: 'flex', overflow: 'hidden',
                  }}>
                    {/* Left color bar */}
                    <div style={{ width: 4, flexShrink: 0, background: leftBarColor(job.status) }} />

                    <div style={{ flex: 1, padding: '14px 16px' }}>
                      {/* Top row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: BLUE, fontWeight: 700, fontSize: 14 }}>
                            {job.wo?.so_number || 'WO'}
                          </span>
                          {job.wo?.customers?.company_name && (
                            <span style={{ color: DIM, fontSize: 12 }}>{job.wo.customers.company_name}</span>
                          )}
                        </div>
                        <StatusPill status={job.status} />
                      </div>

                      {/* Description */}
                      {job.line?.description && (
                        <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: TEXT, lineHeight: 1.4 }}>
                          {job.line.description}
                        </p>
                      )}

                      {/* Badges row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                        {job.wo?.assets?.unit_number && (
                          <span style={{
                            padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                            background: 'rgba(255,255,255,0.06)', color: DIM,
                          }}>
                            {job.wo.assets.unit_type ? `${job.wo.assets.unit_type} — ` : ''}{job.wo.assets.unit_number}
                          </span>
                        )}
                        {job.line?.estimated_hours && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: DIM }}>
                            <Clock size={12} /> {job.line.estimated_hours}h
                          </span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {job.status === 'pending' && (
                          <>
                            <button
                              disabled={actionLoading === job.id + 'accept'}
                              onClick={() => handleJobAction(job.id, 'accept')}
                              style={{
                                flex: 1, minWidth: 100, padding: '9px 16px', borderRadius: 10, border: 'none',
                                background: GREEN, color: '#fff', fontWeight: 700, fontSize: 13,
                                cursor: 'pointer', fontFamily: FONT, opacity: actionLoading === job.id + 'accept' ? 0.6 : 1,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                              }}
                            >
                              <CheckCircle2 size={15} /> Accept
                            </button>
                            <button
                              disabled={actionLoading === job.id + 'decline'}
                              onClick={() => { setDeclineModal(job.id); setDeclineReason('') }}
                              style={{
                                flex: 1, minWidth: 100, padding: '9px 16px', borderRadius: 10, border: 'none',
                                background: RED, color: '#fff', fontWeight: 700, fontSize: 13,
                                cursor: 'pointer', fontFamily: FONT, opacity: actionLoading === job.id + 'decline' ? 0.6 : 1,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                              }}
                            >
                              <XCircle size={15} /> Decline
                            </button>
                          </>
                        )}
                        {job.status === 'accepted' && (
                          <button
                            disabled={actionLoading === job.id + 'start'}
                            onClick={() => handleJobAction(job.id, 'start')}
                            style={{
                              flex: 1, minWidth: 120, padding: '9px 16px', borderRadius: 10, border: 'none',
                              background: BLUE, color: '#fff', fontWeight: 700, fontSize: 13,
                              cursor: 'pointer', fontFamily: FONT, opacity: actionLoading === job.id + 'start' ? 0.6 : 1,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            }}
                          >
                            <Wrench size={15} /> Start Work
                          </button>
                        )}
                        {/* Clock In button for active jobs */}
                        {(job.status === 'accepted' || job.status === 'in_progress') && !activeClock && (
                          <button
                            disabled={clockLoading === (job.line_id || job.id)}
                            onClick={() => handleClockIn(job)}
                            style={{
                              flex: 1, minWidth: 120, padding: '9px 16px', borderRadius: 10, border: 'none',
                              background: GREEN, color: '#fff', fontWeight: 700, fontSize: 13,
                              cursor: 'pointer', fontFamily: FONT, opacity: clockLoading === (job.line_id || job.id) ? 0.6 : 1,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            }}
                          >
                            <Play size={14} fill="#fff" /> Clock In
                          </button>
                        )}
                        {(job.status === 'accepted' || job.status === 'in_progress') && (
                          <>
                            <button
                              disabled={actionLoading === job.id + 'complete'}
                              onClick={() => handleJobAction(job.id, 'complete')}
                              style={{
                                flex: 1, minWidth: 120, padding: '9px 16px', borderRadius: 10, border: 'none',
                                background: GREEN, color: '#fff', fontWeight: 700, fontSize: 13,
                                cursor: 'pointer', fontFamily: FONT, opacity: actionLoading === job.id + 'complete' ? 0.6 : 1,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                              }}
                            >
                              <CheckCircle2 size={15} /> Mark Complete
                            </button>
                            <button
                              onClick={() => { setRequestModal(job); setRequestForm({ part_name: '', quantity: '1', notes: '' }) }}
                              style={{
                                flex: 1, minWidth: 120, padding: '9px 16px', borderRadius: 10,
                                border: `1px solid ${BLUE}`, background: 'transparent',
                                color: BLUE, fontWeight: 700, fontSize: 13,
                                cursor: 'pointer', fontFamily: FONT,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                              }}
                            >
                              <Package size={15} /> Request Parts
                            </button>
                          </>
                        )}
                        {job.status === 'completed' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: GREEN, fontSize: 13, fontWeight: 600 }}>
                            <CheckCircle2 size={16} /> Completed
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ========== TAB 1: PARTS REQUESTS ========== */}
        {tab === 1 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Parts Requests</h2>
              {activeJobs.length > 0 && (
                <button
                  onClick={() => { setRequestModal(activeJobs[0]); setRequestForm({ part_name: '', quantity: '1', notes: '' }) }}
                  style={{
                    padding: '8px 16px', borderRadius: 10, border: 'none',
                    background: BLUE, color: '#fff', fontWeight: 700, fontSize: 13,
                    cursor: 'pointer', fontFamily: FONT,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <Package size={14} /> Request Parts
                </button>
              )}
            </div>

            {partsRequests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: DIM }}>
                <Package size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
                <p style={{ fontSize: 15, fontWeight: 600 }}>No parts requests yet</p>
                <p style={{ fontSize: 13, marginTop: 4 }}>Request parts from your active jobs.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {partsRequests.map((pr: any, idx: number) => (
                  <div key={pr.id || idx} style={{
                    background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 12,
                    padding: '14px 16px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{pr.part_name}</span>
                      <StatusPill status={pr.status || 'requested'} />
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: DIM, flexWrap: 'wrap' }}>
                      <span>Qty: {pr.quantity}</span>
                      {pr.wo_number && <span>WO: {pr.wo_number}</span>}
                      {pr.created_at && (
                        <span>{new Date(pr.created_at).toLocaleDateString()}</span>
                      )}
                    </div>
                    {pr.notes && (
                      <p style={{ margin: '6px 0 0', fontSize: 12, color: DIM, fontStyle: 'italic' }}>{pr.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ========== TAB 2: PROFILE ========== */}
        {tab === 2 && (
          <>
            <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>Profile</h2>
            <div style={{
              background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 12,
              padding: '20px',
            }}>
              <div style={{ display: 'grid', gap: 16 }}>
                {/* Name */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</label>
                  <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 600 }}>{user.full_name}</p>
                </div>
                {/* Email */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</label>
                  <p style={{ margin: '4px 0 0', fontSize: 14 }}>{user.email}</p>
                </div>
                {/* Role */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</label>
                  <p style={{ margin: '4px 0 0', fontSize: 14, textTransform: 'capitalize' }}>{user.role.replace(/_/g, ' ')}</p>
                </div>
                {/* Team */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Team</label>
                  <p style={{ margin: '4px 0 0', fontSize: 14 }}>{user.team || 'Unassigned'}</p>
                </div>
                {/* Skills */}
                {(user as any).skills && (
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Skills</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                      {((user as any).skills || []).map((skill: string, i: number) => (
                        <span key={i} style={{
                          padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                          background: 'rgba(29,111,232,0.12)', color: BLUE,
                        }}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Language */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                    Language
                  </label>
                  <select
                    value={language}
                    onChange={e => setLanguage(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 10,
                      border: `1px solid ${CARD_BORDER}`, background: BG, color: TEXT,
                      fontFamily: FONT, fontSize: 14, outline: 'none',
                      appearance: 'none', WebkitAppearance: 'none',
                    }}
                  >
                    {LANGUAGES.map(l => (
                      <option key={l.code} value={l.code}>{l.label}</option>
                    ))}
                  </select>
                </div>

                {/* Save Language */}
                <button
                  onClick={handleSaveLanguage}
                  disabled={savingLang}
                  style={{
                    width: '100%', padding: '11px 20px', borderRadius: 10, border: 'none',
                    background: BLUE, color: '#fff', fontWeight: 700, fontSize: 14,
                    cursor: 'pointer', fontFamily: FONT, opacity: savingLang ? 0.6 : 1,
                  }}
                >
                  {savingLang ? 'Saving...' : 'Save Language'}
                </button>

                {/* Divider */}
                <div style={{ borderTop: `1px solid ${CARD_BORDER}`, margin: '4px 0' }} />

                {/* Sign Out */}
                <button
                  onClick={handleSignOut}
                  style={{
                    width: '100%', padding: '11px 20px', borderRadius: 10,
                    border: `1px solid ${RED}`, background: 'transparent',
                    color: RED, fontWeight: 700, fontSize: 14,
                    cursor: 'pointer', fontFamily: FONT,
                  }}
                >
                  Sign Out
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ========== PARTS REQUEST MODAL ========== */}
      {requestModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: 20,
          }}
          onClick={e => { if (e.target === e.currentTarget) setRequestModal(null) }}
        >
          <div style={{
            background: CARD_BG, borderRadius: 16, width: '100%', maxWidth: 440,
            border: `1px solid ${CARD_BORDER}`, overflow: 'hidden',
          }}>
            {/* Modal header */}
            <div style={{
              padding: '16px 20px', borderBottom: `1px solid ${CARD_BORDER}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Request Parts</h3>
              <button onClick={() => setRequestModal(null)} style={{
                background: 'none', border: 'none', color: DIM, cursor: 'pointer', fontSize: 18, padding: 4,
              }}>
                &times;
              </button>
            </div>

            <div style={{ padding: 20, display: 'grid', gap: 14 }}>
              {/* Job selector */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                  Job
                </label>
                <select
                  value={requestModal.id}
                  onChange={e => {
                    const j = activeJobs.find(j => j.id === e.target.value)
                    if (j) setRequestModal(j)
                  }}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    border: `1px solid ${CARD_BORDER}`, background: BG, color: TEXT,
                    fontFamily: FONT, fontSize: 13, outline: 'none',
                  }}
                >
                  {activeJobs.map((j: any) => (
                    <option key={j.id} value={j.id}>
                      {j.wo_number || j.so_number || 'WO'} — {j.description || 'No description'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Part name */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                  Part Name
                </label>
                <input
                  value={requestForm.part_name}
                  onChange={e => setRequestForm(f => ({ ...f, part_name: e.target.value }))}
                  placeholder="e.g. Brake pads, Oil filter..."
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    border: `1px solid ${CARD_BORDER}`, background: BG, color: TEXT,
                    fontFamily: FONT, fontSize: 13, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Quantity */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                  Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  value={requestForm.quantity}
                  onChange={e => setRequestForm(f => ({ ...f, quantity: e.target.value }))}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    border: `1px solid ${CARD_BORDER}`, background: BG, color: TEXT,
                    fontFamily: FONT, fontSize: 13, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Notes */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                  Notes
                </label>
                <textarea
                  value={requestForm.notes}
                  onChange={e => setRequestForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  placeholder="Any additional details..."
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    border: `1px solid ${CARD_BORDER}`, background: BG, color: TEXT,
                    fontFamily: FONT, fontSize: 13, outline: 'none', resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Submit */}
              <button
                onClick={handlePartsRequest}
                disabled={!requestForm.part_name.trim() || actionLoading === 'parts-submit'}
                style={{
                  width: '100%', padding: '11px 20px', borderRadius: 10, border: 'none',
                  background: BLUE, color: '#fff', fontWeight: 700, fontSize: 14,
                  cursor: requestForm.part_name.trim() ? 'pointer' : 'not-allowed',
                  fontFamily: FONT, opacity: !requestForm.part_name.trim() || actionLoading === 'parts-submit' ? 0.5 : 1,
                }}
              >
                {actionLoading === 'parts-submit' ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Decline Modal */}
      {declineModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) { setDeclineModal(null); setDeclineReason('') } }}>
          <div style={{ background: '#1A1A26', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 400 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Decline Job</div>
            <div style={{ fontSize: 13, color: DIM, marginBottom: 16 }}>Why are you declining this job? (optional)</div>
            <textarea
              value={declineReason}
              onChange={e => setDeclineReason(e.target.value)}
              placeholder="Reason for declining..."
              style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 13, color: TEXT, fontFamily: FONT, minHeight: 80, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => { setDeclineModal(null); setDeclineReason('') }} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: DIM, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>Cancel</button>
              <button onClick={() => handleJobAction(declineModal, 'decline', declineReason)} disabled={!!actionLoading}
                style={{ padding: '8px 16px', background: RED, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
