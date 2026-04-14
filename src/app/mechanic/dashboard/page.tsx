'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser, type UserProfile } from '@/lib/auth'
import { MECHANIC_ROLES } from '@/lib/roles'
import { PARTS_PICKUP_STATUS, PARTS_READY_STATUS } from '@/lib/parts-status'
import Logo from '@/components/Logo'
import { ChevronRight, Wrench, Clock, CheckCircle2, XCircle, Package, Play, Square } from 'lucide-react'
import { MECHANIC_LANGUAGES } from '@/lib/i18n/mechanic'
import { useMechanicT, useMechanicLang, hydrateMechanicLang, changeMechanicLang } from '@/lib/i18n/MechanicI18nProvider'
import type { MechanicLang } from '@/lib/i18n/mechanic'

import { THEME } from '@/lib/config/colors'

const FONT = "'Inter', -apple-system, sans-serif"
const BG = 'var(--tz-bg)'
const TEXT = 'var(--tz-text)'
const CARD_BG = 'var(--tz-bgCard)'
const CARD_BORDER = 'var(--tz-cardBorder)'
const BLUE = 'var(--tz-accent)'
const AMBER = 'var(--tz-warning)'
const GREEN = 'var(--tz-success)'
const RED = 'var(--tz-danger)'
const DIM = 'var(--tz-textTertiary)'

type Filter = 'all' | 'pending' | 'accepted' | 'in_progress' | 'completed'

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending:    { bg: 'rgba(245,158,11,0.15)', text: AMBER },
  accepted:   { bg: 'rgba(29,111,232,0.15)', text: BLUE },
  in_progress:{ bg: 'rgba(29,111,232,0.15)', text: BLUE },
  active:     { bg: 'rgba(34,197,94,0.15)',  text: GREEN },
  completed:  { bg: 'rgba(34,197,94,0.15)',  text: GREEN },
  declined:   { bg: 'rgba(239,68,68,0.15)',  text: RED },
  requested:  { bg: 'rgba(245,158,11,0.15)', text: AMBER },
  reviewing:  { bg: 'rgba(245,158,11,0.15)', text: AMBER },
  submitted:  { bg: 'rgba(29,111,232,0.15)', text: BLUE },
  approved:   { bg: 'rgba(34,197,94,0.15)',  text: GREEN },
  rejected:   { bg: 'rgba(239,68,68,0.15)',  text: RED },
  ready:      { bg: 'rgba(34,197,94,0.15)',  text: GREEN },
  ordered:    { bg: 'rgba(245,158,11,0.15)', text: AMBER },
  partial:    { bg: 'rgba(29,111,232,0.15)', text: BLUE },
  picked_up:  { bg: 'rgba(34,197,94,0.15)',  text: GREEN },
}

function StatusPill({ status }: { status: string }) {
  const label = status || 'pending'
  const c = STATUS_COLORS[label] || { bg: 'var(--tz-surfaceMuted)', text: DIM }
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
  const t = useMechanicT()
  const language = useMechanicLang()
  const supabase = createClient()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(0)
  const [jobs, setJobs] = useState<any[]>([])
  const [partsRequests, setPartsRequests] = useState<any[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [requestModal, setRequestModal] = useState<any | null>(null)
  const [requestForm, setRequestForm] = useState({ part_name: '', quantity: '1', notes: '' })
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [declineModal, setDeclineModal] = useState<string | null>(null) // assignment ID
  const [declineReason, setDeclineReason] = useState('')
  const [completeModal, setCompleteModal] = useState<any | null>(null) // job to confirm completion
  const [moreTimeModal, setMoreTimeModal] = useState<any | null>(null) // job for More Time request
  const [moreTimeAmount, setMoreTimeAmount] = useState<string>('60') // minutes
  const [activeClock, setActiveClock] = useState<any>(null) // { id, clocked_in_at, so_line_id, job_description, wo_number }
  const [elapsedSec, setElapsedSec] = useState(0)
  const [clockLoading, setClockLoading] = useState<string | null>(null)
  const [woPartsMap, setWoPartsMap] = useState<Record<string, any[]>>({}) // WO ID → part lines with status
  const [workedMinutesMap, setWorkedMinutesMap] = useState<Record<string, number>>({}) // so_line_id → total worked minutes
  const [clockedWos, setClockedWos] = useState<Set<string>>(new Set()) // WO IDs mechanic has previously clocked into
  const [clockedLines, setClockedLines] = useState<Set<string>>(new Set()) // so_line_ids mechanic has previously clocked into
  const [workPunch, setWorkPunch] = useState<any>(null) // active work punch { id, punch_in_at }
  const [punchLoading, setPunchLoading] = useState(false)
  const [overrideModal, setOverrideModal] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
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
      const [clockRes, punchRes] = await Promise.all([
        fetch('/api/mechanic/active-clock'),
        fetch('/api/mechanic/work-punch'),
      ])
      if (clockRes.ok) setActiveClock(await clockRes.json())
      if (punchRes.ok) {
        const p = await punchRes.json()
        setWorkPunch(p.activePunch || null)
      }
    } catch { /* silent */ }
  }, [])

  const handleWorkPunch = async (action: 'punch_in' | 'punch_out', override?: string) => {
    if (!user) return
    setPunchLoading(true)
    try {
      // Request geolocation directly via getCurrentPosition — errors surface native codes.
      let pos: GeolocationPosition | null = null
      if (!navigator.geolocation) {
        if (action === 'punch_in') { alert('Location services are not available on this device.'); setPunchLoading(false); return }
      } else {
        try {
          pos = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 }))
        } catch (geoErr: any) {
          if (action === 'punch_in') {
            const code = geoErr?.code
            if (code === 1) { // PERMISSION_DENIED
              alert('Location permission was denied. Please allow location access for this site and try again.')
              setPunchLoading(false); return
            } else if (code === 2) { // POSITION_UNAVAILABLE
              alert('Your device could not determine your location. Make sure GPS/location services are on and try again.')
              setPunchLoading(false); return
            } else if (code === 3) { // TIMEOUT
              alert('Location request timed out. Move to an area with better signal and try again.')
              setPunchLoading(false); return
            }
            alert('Could not determine your location. Please try again.')
            setPunchLoading(false); return
          }
          // For punch_out, proceed without coordinates
        }
      }
      const payload = { action, lat: pos?.coords.latitude, lng: pos?.coords.longitude, accuracy: pos?.coords.accuracy, override_reason: override }
      let res: Response | null = null
      try {
        res = await fetch('/api/mechanic/work-punch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      } catch {
        // Offline: queue punch event locally
        const queue = JSON.parse(localStorage.getItem('tz_punch_queue') || '[]')
        queue.push({ ...payload, queued_at: new Date().toISOString() })
        localStorage.setItem('tz_punch_queue', JSON.stringify(queue))
        if (action === 'punch_in') setWorkPunch({ id: 'queued', punch_in_at: new Date().toISOString(), queued: true })
        else setWorkPunch(null)
        alert('Network unavailable — punch queued. Will sync when online.')
        setPunchLoading(false)
        return
      }
      if (res.ok) {
        const data = await res.json()
        if (action === 'punch_in') setWorkPunch(data.punch || { id: 'active', punch_in_at: new Date().toISOString() })
        else { setWorkPunch(null); setActiveClock(null) }
        setOverrideModal(false); setOverrideReason('')
      } else {
        const err = await res.json().catch(() => ({} as any))
        const serverMsg = typeof err?.error === 'string' && err.error.trim() ? err.error : `Punch failed (HTTP ${res.status})`
        if (err?.outsideGeofence && !err?.blocked) { alert(serverMsg); setOverrideModal(true) }
        else alert(serverMsg)
      }
    } catch (e: any) { alert(`Punch request failed: ${e?.message || 'network error'}`) }
    setPunchLoading(false)
  }

  const handleClockIn = async (job: any) => {
    if (!user) return
    setClockLoading(job.line_id || job.id)
    try {
      const res = await fetch('/api/mechanic/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ so_line_id: job.line_id || job.line?.id }),
      })
      if (res.ok) {
        const entry = await res.json()
        setActiveClock({
          id: entry.id,
          clocked_in_at: entry.clocked_in_at,
          so_line_id: job.line_id || job.line?.id,
          service_order_id: job.wo?.id || job.line?.so_id,
          job_description: job.line?.description?.slice(0, 60) || '',
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
        body: JSON.stringify({ time_entry_id: activeClock.id }),
      })
      if (res.ok) {
        const data = await res.json()
        const lineId = activeClock.so_line_id
        const woId = activeClock.service_order_id
        setActiveClock(null)
        // Update worked time map immediately so job card shows correct Worked total
        if (lineId || woId) {
          const key = lineId || woId
          setWorkedMinutesMap(prev => ({ ...prev, [key]: (data.total_minutes_on_job || 0) }))
        }
        // Mark this line as clocked (for Resume vs Start)
        if (lineId) setClockedLines(prev => new Set([...prev, lineId]))
        const totalHrs = data.total_hours_on_job || 0
        alert(`Job paused. Total worked: ${totalHrs} hrs. You can resume anytime.`)
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
        const mapped = raw.map((j: any) => ({
          ...j,
          status: j.status || (
            j.line?.line_status === 'completed' ? 'completed' :
            j.line?.line_status === 'in_progress' ? 'in_progress' : 'pending'
          ),
        }))
        setJobs(mapped)
        // Check for ready parts + prior clock history on each WO
        const woIds = [...new Set(mapped.map((j: any) => j.wo?.id).filter(Boolean))] as string[]
        if (woIds.length > 0) {
          try {
            // Use so-lines API for parts (client supabase may be blocked by RLS)
            // Fetch part lines per WO + time entries for worked time
            const partsPromises = woIds.map(woId => fetch(`/api/so-lines?so_id=${woId}`).then(r => r.ok ? r.json() : []))
            const allLines = await Promise.all(partsPromises)
            const partsMap: Record<string, any[]> = {}
            woIds.forEach((woId, idx) => {
              const lines = Array.isArray(allLines[idx]) ? allLines[idx] : []
              partsMap[woId] = lines.filter((l: any) => l.line_type === 'part' && l.parts_status !== 'canceled')
            })
            setWoPartsMap(partsMap)

            // Get worked time per job line + clock history (via API — client supabase blocked by RLS)
            try {
              const wtRes = await fetch(`/api/mechanic/worked-time?user_id=${userId}&so_ids=${woIds.join(',')}`)
              if (wtRes.ok) {
                const wt = await wtRes.json()
                setClockedWos(new Set(wt.clockedSoIds || []))
                setClockedLines(new Set(wt.clockedLineIds || []))
                setWorkedMinutesMap(wt.worked || {})
              }
            } catch {}
          } catch {}
        }
      }
      if (partsRes.ok) {
        const d = await partsRes.json()
        setPartsRequests(Array.isArray(d) ? d : d.data || [])
      }
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    let cancelled = false
    let interval: ReturnType<typeof setInterval>
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { window.location.href = '/login'; return }
      const effectiveRole = profile.impersonate_role || profile.role
      if (!MECHANIC_ROLES.includes(effectiveRole)) { window.location.href = '/dashboard'; return }
      setUser(profile)
      hydrateMechanicLang(profile.language || 'en')
      await Promise.all([fetchData(profile.id), fetchActiveClock(profile.id)])
      // Replay queued offline punch events — keep failed items for retry
      try {
        const queue: any[] = JSON.parse(localStorage.getItem('tz_punch_queue') || '[]')
        if (queue.length > 0) {
          const failed: any[] = []
          for (const evt of queue) {
            try {
              const r = await fetch('/api/mechanic/work-punch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(evt) })
              if (!r.ok && r.status >= 500) failed.push(evt) // server error → retry later
              // 4xx = client error (duplicate, already punched) → don't retry
            } catch { failed.push(evt) } // network error → retry later
          }
          if (failed.length > 0) localStorage.setItem('tz_punch_queue', JSON.stringify(failed))
          else localStorage.removeItem('tz_punch_queue')
          await fetchActiveClock(profile.id)
        }
      } catch {}
      if (cancelled) return
      setLoading(false)
      interval = setInterval(() => { if (document.visibilityState === 'visible') { fetchData(profile.id); fetchActiveClock(profile.id) } }, 15000)
    }
    load()
    return () => { cancelled = true; clearInterval(interval) }
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
        if (action === 'complete') {
          // Completion auto-clocks-out on backend — immediately clear local timer and sync
          setActiveClock(null)
        }
        await Promise.all([fetchData(user.id), fetchActiveClock(user.id)])
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
          so_id: requestModal.wo?.id || requestModal.line?.so_id,
          so_line_id: requestModal.line_id || requestModal.line?.id,
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
          <p style={{ color: DIM, fontSize: 14 }}>{t('mechanic.loading_dashboard')}</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  const isImpersonating = !!user.impersonate_role

  const filteredJobs = filter === 'all' ? jobs : jobs.filter(j => j.status === filter)

  const leftBarColor = (status: string) => {
    if (status === 'pending') return AMBER
    if (status === 'accepted' || status === 'in_progress') return BLUE
    if (status === 'completed') return GREEN
    return DIM
  }

  const activeJobs = jobs.filter(j => ['accepted', 'in_progress'].includes(j.status))

  // ----- Tab labels -----
  const tabLabels = [t('mechanic.tab.my_jobs'), t('mechanic.tab.parts_requests'), t('mechanic.tab.profile')]
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
          {isImpersonating && (
            <button onClick={async () => {
              await fetch('/api/impersonate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'reset' }) })
              window.location.href = '/dashboard'
            }} style={{ background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 8, padding: '4px 12px', color: 'var(--tz-warning)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 4 }}>
              Exit Impersonation
            </button>
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
        {/* ========== WORK PUNCH BANNER ========== */}
        {!workPunch && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: `1px solid ${RED}44`, borderRadius: 14, padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: RED }}>{t('mechanic.not_punched_in')}</div>
              <div style={{ fontSize: 11, color: DIM, marginTop: 2 }}>{t('mechanic.punch_message')}</div>
            </div>
            <button onClick={() => handleWorkPunch('punch_in')} disabled={punchLoading}
              style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: GREEN, color: 'var(--tz-bgLight)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: FONT, opacity: punchLoading ? 0.5 : 1 }}>
              {punchLoading ? t('mechanic.locating') : t('mechanic.punch_in')}
            </button>
          </div>
        )}
        {workPunch && (
          <div style={{ background: 'rgba(29,111,232,0.08)', border: `1px solid ${BLUE}44`, borderRadius: 14, padding: '10px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: BLUE }}>
              On Shift since {new Date(workPunch.punch_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {workPunch.inside_geofence === false && <span style={{ color: AMBER, marginLeft: 8, fontSize: 10 }}>(off-site)</span>}
            </div>
            <button onClick={() => {
              if (!confirm('End your shift? This will punch you out and stop any active job timers.')) return
              handleWorkPunch('punch_out')
            }} disabled={punchLoading}
              style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${RED}22`, background: 'transparent', color: RED, fontWeight: 600, fontSize: 11, cursor: 'pointer', fontFamily: FONT, opacity: 0.7 }}>
              End Shift
            </button>
          </div>
        )}

        {/* Override geofence modal */}
        {overrideModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, paddingTop: 'max(60px, env(safe-area-inset-top, 60px))' }}
            onClick={e => { if (e.target === e.currentTarget) setOverrideModal(false) }}>
            <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 14, padding: 24, width: '100%', maxWidth: 380 }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: AMBER }}>{t('mechanic.outside_shop_area')}</div>
              <div style={{ fontSize: 13, color: DIM, marginBottom: 16 }}>You appear to be outside the shop geofence. Provide a reason to punch in for manager review.</div>
              <input value={overrideReason} onChange={e => setOverrideReason(e.target.value)} placeholder={t('mechanic.override_reason_placeholder')} style={{ width: '100%', padding: '10px 12px', background: 'var(--tz-border)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 8, fontSize: 13, color: 'var(--tz-text)', fontFamily: FONT, outline: 'none', boxSizing: 'border-box', marginBottom: 16 }} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setOverrideModal(false)} style={{ padding: '8px 16px', background: 'transparent', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 8, color: DIM, fontSize: 13, cursor: 'pointer', fontFamily: FONT }}>{t('mechanic.common.cancel')}</button>
                <button disabled={!overrideReason.trim() || punchLoading} onClick={() => handleWorkPunch('punch_in', overrideReason.trim())} style={{ padding: '8px 16px', background: AMBER, color: 'var(--tz-bgLight)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
                  {punchLoading ? t('mechanic.punching') : t('mechanic.override_punch_in')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========== ACTIVE CLOCK BANNER ========== */}
        {activeClock && (
          <div style={{
            background: 'rgba(34,197,94,0.1)', border: `1px solid ${GREEN}`, borderRadius: 14,
            padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: GREEN, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                Active — Pause to switch jobs
              </div>
              <div style={{ fontSize: 36, fontWeight: 700, fontFamily: "'Bebas Neue', monospace, sans-serif", color: GREEN, letterSpacing: 2 }}>
                {formatTimer(elapsedSec)}
              </div>
              <div style={{ fontSize: 12, color: DIM, marginTop: 2 }}>
                {activeClock.wo_number} — {activeClock.job_description}
              </div>
              {(() => {
                const lineId = activeClock.so_line_id
                const woId = activeClock.service_order_id || activeClock.so_id
                const priorMins = lineId ? (workedMinutesMap[lineId] || 0) : woId ? (workedMinutesMap[woId] || 0) : 0
                const totalMins = priorMins + Math.floor(elapsedSec / 60)
                return <div style={{ fontSize: 12, color: GREEN, marginTop: 4, fontWeight: 600 }}>
                  Total on job: {+(totalMins / 60).toFixed(1)}h{priorMins > 0 ? ` (${+(priorMins / 60).toFixed(1)}h prior + this session)` : ''}
                </div>
              })()}
            </div>
            <button
              onClick={handleClockOut}
              disabled={clockLoading === 'clock-out'}
              style={{
                padding: '10px 20px', borderRadius: 10, border: 'none',
                background: RED, color: 'var(--tz-bgLight)', fontWeight: 700, fontSize: 14,
                cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 6,
                opacity: clockLoading === 'clock-out' ? 0.6 : 1,
              }}
            >
              <Square size={14} fill={'var(--tz-bgLight)'} /> Pause
            </button>
          </div>
        )}

        {/* ========== TAB 0: MY JOBS ========== */}
        {tab === 0 && !selectedJobId && (
          <>
            {/* Filter pills */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {(['all', 'pending', 'in_progress', 'completed'] as Filter[]).map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: '6px 14px', borderRadius: 999, border: 'none',
                  background: filter === f ? BLUE : 'var(--tz-border)',
                  color: filter === f ? 'var(--tz-bgLight)' : DIM,
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
                <p style={{ fontSize: 15, fontWeight: 600 }}>{t('mechanic.no_jobs_assigned')}</p>
                <p style={{ fontSize: 13, marginTop: 4 }}>When a manager assigns work, it will appear here.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredJobs.map((job: any) => {
                  const lineId = job.line_id || job.line?.id
                  const isActiveJob = activeClock && activeClock.so_line_id === lineId
                  const isPaused = !isActiveJob && lineId && clockedLines.has(lineId) && job.status !== 'completed'
                  return (
                  <button key={job.id} onClick={() => setSelectedJobId(job.id)} style={{
                    background: isActiveJob ? 'rgba(34,197,94,0.08)' : CARD_BG,
                    border: isActiveJob ? `2px solid ${GREEN}` : `1px solid ${CARD_BORDER}`,
                    borderRadius: 12, display: 'flex', overflow: 'hidden', cursor: 'pointer',
                    textAlign: 'left', width: '100%', padding: 0, fontFamily: FONT, color: TEXT,
                  }}>
                    <div style={{ width: 4, flexShrink: 0, background: leftBarColor(job.status) }} />
                    <div style={{ flex: 1, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ color: BLUE, fontWeight: 700, fontSize: 14 }}>{job.wo?.so_number || 'WO'}</span>
                          {isActiveJob && <span style={{ padding: '2px 8px', borderRadius: 999, background: GREEN, color: 'var(--tz-bgLight)', fontSize: 10, fontWeight: 700 }}>{t('mechanic.status.working_now')}</span>}
                          {isPaused && <span style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(245,158,11,0.15)', color: AMBER, fontSize: 10, fontWeight: 700 }}>{t('mechanic.status.paused')}</span>}
                          {job.status === 'completed' && <span style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(34,197,94,0.15)', color: GREEN, fontSize: 10, fontWeight: 700 }}>{t('mechanic.status.done')}</span>}
                          {job.status === 'pending' && <span style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(245,158,11,0.15)', color: AMBER, fontSize: 10, fontWeight: 700 }}>{t('mechanic.status.pending')}</span>}
                        </div>
                        {job.line?.description && <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{job.line.description}</div>}
                        <div style={{ fontSize: 11, color: DIM }}>
                          {job.wo?.customers?.company_name || ''}{job.wo?.assets?.unit_number ? ` — #${job.wo.assets.unit_number}` : ''}
                        </div>
                      </div>
                      <ChevronRight size={18} color={DIM} style={{ flexShrink: 0 }} />
                    </div>
                  </button>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ========== TAB 0: FOCUSED SINGLE JOB VIEW ========== */}
        {tab === 0 && selectedJobId && (() => {
          const job = jobs.find((j: any) => j.id === selectedJobId)
          if (!job) { setSelectedJobId(null); return null }
          return (
          <>
            <button onClick={() => setSelectedJobId(null)} style={{ background: 'rgba(29,111,232,0.08)', border: `1px solid ${BLUE}44`, color: BLUE, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, padding: '14px 20px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, borderRadius: 12, width: '100%', justifyContent: 'center' }}>
              &larr; Back to Jobs
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 12,
                display: 'flex', overflow: 'hidden',
              }}>
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
                        {(() => {
                          const lineId = job.line_id || job.line?.id
                          const isActive = activeClock && (activeClock.so_line_id === lineId)
                          const isPaused = !isActive && lineId && clockedLines.has(lineId) && job.status !== 'completed'
                          const isAssigned = !isActive && !isPaused && job.status === 'in_progress'
                          if (job.status === 'completed') return <StatusPill status="completed" />
                          if (isActive) return <StatusPill status="active" />
                          if (isPaused) return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, background: 'rgba(245,158,11,0.15)', color: AMBER, fontSize: 12, fontWeight: 600 }}>{t('mechanic.status.paused')}</span>
                          if (isAssigned) return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, background: 'rgba(29,111,232,0.1)', color: BLUE, fontSize: 12, fontWeight: 600 }}>{t('mechanic.status.assigned')}</span>
                          return <StatusPill status={job.status} />
                        })()}
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
                            background: 'var(--tz-border)', color: DIM,
                          }}>
                            {job.wo.assets.unit_type ? `${job.wo.assets.unit_type} — ` : ''}{job.wo.assets.unit_number}
                          </span>
                        )}
                        {(() => {
                          const bookHrs = job.line?.estimated_hours || 0
                          const lineId = job.line_id || job.line?.id
                          const workedMins = lineId ? (workedMinutesMap[lineId] || 0) : job.wo?.id ? (workedMinutesMap[job.wo.id] || 0) : 0
                          const workedHrs = +(workedMins / 60).toFixed(1)
                          const leftHrs = bookHrs > 0 ? Math.max(0, +(bookHrs - workedHrs).toFixed(1)) : null
                          return (
                            <>
                              {bookHrs > 0 ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: BLUE, background: 'rgba(29,111,232,0.1)', padding: '2px 8px', borderRadius: 6 }}>
                                  Book: {bookHrs}h
                                </span>
                              ) : job.status !== 'completed' ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: AMBER, background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: 6 }}>
                                  <Clock size={12} /> No book hours
                                </span>
                              ) : null}
                              {workedHrs > 0 && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: workedHrs > bookHrs && bookHrs > 0 ? RED : GREEN, background: workedHrs > bookHrs && bookHrs > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: 6 }}>
                                  Worked: {workedHrs}h
                                </span>
                              )}
                              {leftHrs !== null && leftHrs >= 0 && workedHrs > 0 && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: leftHrs === 0 ? RED : DIM, background: 'var(--tz-border)', padding: '2px 8px', borderRadius: 6 }}>
                                  Left: {leftHrs}h
                                </span>
                              )}
                            </>
                          )
                        })()}
                      </div>

                      {/* Paused summary text */}
                      {(() => {
                        const lineId = job.line_id || job.line?.id
                        const isActive = activeClock && (activeClock.so_line_id === lineId)
                        const isPaused = !isActive && lineId && clockedLines.has(lineId) && job.status !== 'completed'
                        if (!isPaused) return null
                        const workedMins = lineId ? (workedMinutesMap[lineId] || 0) : 0
                        const bookHrs = job.line?.estimated_hours || 0
                        const bookMins = bookHrs * 60
                        const leftMins = bookMins > 0 ? Math.max(0, Math.round(bookMins - workedMins)) : null
                        const fmtMins = (m: number) => m >= 60 ? `${+(m / 60).toFixed(1)}h` : `${m} min`
                        return (
                          <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: `1px solid ${AMBER}22`, marginBottom: 8, fontSize: 12, color: AMBER }}>
                            <div style={{ fontWeight: 600 }}>Job paused at {fmtMins(workedMins)}</div>
                            {leftMins !== null && <div style={{ color: DIM, marginTop: 2 }}>{leftMins > 0 ? `${fmtMins(leftMins)} left to finish` : 'Book time reached'}</div>}
                          </div>
                        )
                      })()}

                      {/* Per-job parts — linked by related_labor_line_id, keyword fallback for legacy */}
                      {job.wo?.id && (woPartsMap[job.wo.id] || []).length > 0 && job.status !== 'completed' && (() => {
                        const allParts = woPartsMap[job.wo.id] || []
                        const lineId = job.line_id || job.line?.id
                        // True linkage first: parts with related_labor_line_id matching this job line
                        let matched = lineId ? allParts.filter((p: any) => p.related_labor_line_id === lineId) : []
                        // Keyword fallback for legacy parts without linkage
                        if (matched.length === 0) {
                          const jobDesc = (job.line?.description || '').toLowerCase()
                          const jobWords = jobDesc.split(/\s+/).filter((w: string) => w.length > 2 && !['the','and','for','with','from'].includes(w))
                          matched = allParts.filter((p: any) => {
                            if (p.related_labor_line_id) return false // already linked to another line
                            const partText = ((p.rough_name || '') + ' ' + (p.real_name || '') + ' ' + (p.description || '')).toLowerCase()
                            return jobWords.some((w: string) => partText.includes(w))
                          })
                        }
                        if (matched.length === 0) return null
                        const readyParts = matched.filter((p: any) => p.parts_status === PARTS_READY_STATUS)
                        return (
                          <div style={{ marginBottom: 8, padding: '6px 10px', borderRadius: 8, background: 'var(--tz-border)', border: `1px solid ${'var(--tz-border)'}` }}>
                            {matched.map((p: any) => {
                              const stColor = p.parts_status === 'ready_for_job' ? GREEN : p.parts_status === 'picked_up' ? GREEN : p.parts_status === 'received' ? BLUE : p.parts_status === 'ordered' ? AMBER : p.parts_status === 'installed' ? DIM : DIM
                              const stLabel = p.parts_status === 'ready_for_job' ? 'Ready for Pickup' : p.parts_status === 'picked_up' ? 'Picked Up' : p.parts_status === 'received' ? 'Preparing' : p.parts_status === 'ordered' ? 'Ordered' : p.parts_status === 'installed' ? 'Installed' : 'Pending'
                              return (
                                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', fontSize: 11, gap: 6 }}>
                                  <span style={{ color: DIM, flex: 1 }}>{p.real_name || p.rough_name || p.description || '—'}</span>
                                  <span style={{ color: stColor, fontWeight: 600, fontSize: 10, whiteSpace: 'nowrap' }}>{stLabel}</span>
                                </div>
                              )
                            })}
                            {/* One grouped confirm action for all ready parts */}
                            {readyParts.length > 0 && (
                              <button
                                disabled={actionLoading === 'pickup-grouped'}
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  setActionLoading('pickup-grouped')
                                  let failed = 0
                                  for (const p of readyParts) {
                                    try {
                                      const res = await fetch(`/api/so-lines/${p.id}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ parts_status: PARTS_PICKUP_STATUS }),
                                      })
                                      if (!res.ok) failed++
                                    } catch { failed++ }
                                  }
                                  if (failed > 0) alert(`${failed} part${failed > 1 ? 's' : ''} could not be confirmed. Please try again.`)
                                  if (user) await fetchData(user.id)
                                  setActionLoading(null)
                                }}
                                style={{ marginTop: 8, width: '100%', padding: '10px 16px', borderRadius: 8, border: `1px solid ${GREEN}`, background: `${GREEN}18`, color: GREEN, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}
                              >
                                {actionLoading === 'pickup-grouped' ? 'Confirming...' : `Confirm Parts Received (${readyParts.length})`}
                              </button>
                            )}
                          </div>
                        )
                      })()}

                      {/* Action buttons */}
                      {(() => {
                        const hasHours = job.line?.estimated_hours > 0
                        const noHoursMsg = () => alert('Cannot proceed — book/expected hours have not been set for this job. Ask your service writer or supervisor.')
                        return (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {job.status === 'in_progress' && !activeClock && hasHours && !workPunch && (
                          <button onClick={() => alert('Punch in to your shift first before starting a job.')}
                            style={{ flex: 1, minWidth: 120, padding: '9px 16px', borderRadius: 10, border: `1px solid ${DIM}`, background: 'transparent', color: DIM, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: 0.5 }}>
                            <Play size={14} /> Punch in first
                          </button>
                        )}
                        {job.status === 'in_progress' && !activeClock && hasHours && workPunch && (
                          <button
                            disabled={clockLoading === (job.line_id || job.id)}
                            onClick={() => handleClockIn(job)}
                            style={{
                              flex: 1, minWidth: 120, padding: '9px 16px', borderRadius: 10, border: 'none',
                              background: GREEN, color: 'var(--tz-bgLight)', fontWeight: 700, fontSize: 13,
                              cursor: 'pointer', fontFamily: FONT, opacity: clockLoading === (job.line_id || job.id) ? 0.6 : 1,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            }}
                          >
                            <Play size={14} fill={'var(--tz-bgLight)'} /> {clockedLines.has(job.line_id || job.line?.id) ? 'Resume' : 'Start'}
                          </button>
                        )}
                        {job.status === 'in_progress' && activeClock && hasHours && (
                          <button onClick={() => alert('Pause or complete your current job before starting another one.')} style={{ flex: 1, minWidth: 120, padding: '9px 16px', borderRadius: 10, border: `1px solid ${DIM}`, background: 'transparent', color: DIM, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: 0.5 }}>
                            <Play size={14} /> Pause current job first</button>
                        )}
                        {job.status === 'in_progress' && !hasHours && (
                          <button
                            disabled={actionLoading === job.id + 'request-hours'}
                            onClick={async () => {
                              setActionLoading(job.id + 'request-hours')
                              try {
                                const res = await fetch('/api/mechanic/request-hours', {
                                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ assignment_id: job.id, wo_number: job.wo?.so_number, job_description: job.line?.description }),
                                })
                                if (res.ok) alert('Hours requested — your supervisor has been notified.')
                                else alert('Could not send request. Try again.')
                              } catch { alert('Could not send request.') }
                              setActionLoading(null)
                            }}
                            style={{
                              flex: 1, minWidth: 120, padding: '9px 16px', borderRadius: 10, border: 'none',
                              background: AMBER, color: 'var(--tz-bgLight)', fontWeight: 700, fontSize: 13,
                              cursor: 'pointer', fontFamily: FONT,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            }}
                          >
                            <Clock size={14} /> Request Hours
                          </button>
                        )}
                        {job.status === 'in_progress' && workPunch && (
                          <>
                            {/* Mark Complete: requires real logged time or active clock — book hours not required */}
                            {(clockedLines.has(job.line_id || job.line?.id) || (activeClock && activeClock.so_line_id === (job.line_id || job.line?.id))) && (
                            <button
                              disabled={actionLoading === job.id + 'complete'}
                              onClick={() => setCompleteModal(job)}
                              style={{
                                flex: 1, minWidth: 120, padding: '9px 16px', borderRadius: 10, border: 'none',
                                background: GREEN, color: 'var(--tz-bgLight)', fontWeight: 700, fontSize: 13,
                                cursor: 'pointer', fontFamily: FONT, opacity: actionLoading === job.id + 'complete' ? 0.6 : 1,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                              }}
                            >
                              <CheckCircle2 size={15} /> Mark Complete
                            </button>
                            )}
                            <button
                              onClick={() => { setRequestModal(job); setRequestForm({ part_name: '', quantity: '1', notes: '' }) }}
                              style={{
                                flex: 1, minWidth: 100, padding: '9px 14px', borderRadius: 10,
                                border: `1px solid ${BLUE}`, background: 'transparent',
                                color: BLUE, fontWeight: 700, fontSize: 12,
                                cursor: 'pointer', fontFamily: FONT,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                              }}
                            >
                              <Package size={14} /> {t('mechanic.action.request_parts')}
                            </button>
                            {hasHours && (
                            <button
                              onClick={() => { setMoreTimeModal(job); setMoreTimeAmount('60') }}
                              style={{
                                flex: 1, minWidth: 100, padding: '9px 14px', borderRadius: 10,
                                border: `1px solid ${AMBER}`, background: 'transparent',
                                color: AMBER, fontWeight: 700, fontSize: 12,
                                cursor: 'pointer', fontFamily: FONT,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                              }}
                            >
                              <Clock size={14} /> More Time
                            </button>
                            )}
                          </>
                        )}
                        {job.status === 'completed' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: GREEN, fontSize: 13, fontWeight: 600 }}>
                            <CheckCircle2 size={16} /> Completed
                          </div>
                        )}
                      </div>
                        )
                      })()}
                    </div>
                  </div>
              </div>
          </>
          )
        })()}

        {/* ========== TAB 1: PARTS REQUESTS ========== */}
        {tab === 1 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t('mechanic.parts.heading')}</h2>
              {activeJobs.length > 0 && (
                <button
                  onClick={() => { setRequestModal(activeJobs[0]); setRequestForm({ part_name: '', quantity: '1', notes: '' }) }}
                  style={{
                    padding: '8px 16px', borderRadius: 10, border: 'none',
                    background: BLUE, color: 'var(--tz-bgLight)', fontWeight: 700, fontSize: 13,
                    cursor: 'pointer', fontFamily: FONT,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <Package size={14} /> {t('mechanic.action.request_parts')}
                </button>
              )}
            </div>

            {partsRequests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: DIM }}>
                <Package size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
                <p style={{ fontSize: 15, fontWeight: 600 }}>{t('mechanic.no_parts_requests')}</p>
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
            <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>{t('mechanic.profile.heading')}</h2>
            <div style={{
              background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 12,
              padding: '20px',
            }}>
              <div style={{ display: 'grid', gap: 16 }}>
                {/* Name */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('mechanic.profile.name')}</label>
                  <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 600 }}>{user.full_name}</p>
                </div>
                {/* Email */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('mechanic.profile.email')}</label>
                  <p style={{ margin: '4px 0 0', fontSize: 14 }}>{user.email}</p>
                </div>
                {/* Role */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('mechanic.profile.role')}</label>
                  <p style={{ margin: '4px 0 0', fontSize: 14, textTransform: 'capitalize' }}>{user.role.replace(/_/g, ' ')}</p>
                </div>
                {/* Team */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('mechanic.profile.team')}</label>
                  <p style={{ margin: '4px 0 0', fontSize: 14 }}>{user.team || 'Unassigned'}</p>
                </div>
                {/* Skills */}
                {(user as any).skills && (
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('mechanic.profile.skills')}</label>
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
                    {t('mechanic.profile.language')}
                  </label>
                  <select
                    value={language}
                    onChange={e => { void changeMechanicLang(e.target.value as MechanicLang) }}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 10,
                      border: `1px solid ${CARD_BORDER}`, background: BG, color: TEXT,
                      fontFamily: FONT, fontSize: 14, outline: 'none',
                      appearance: 'none', WebkitAppearance: 'none',
                    }}
                  >
                    {MECHANIC_LANGUAGES.map(l => (
                      <option key={l.code} value={l.code}>{l.label}</option>
                    ))}
                  </select>
                </div>

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
                  {t('mechanic.profile.sign_out')}
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
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t('mechanic.action.request_parts')}</h3>
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
                      {j.wo?.so_number || 'WO'} — {j.line?.description || 'Job'}
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
                  placeholder={t('mechanic.action.parts_details_placeholder')}
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
                  background: BLUE, color: 'var(--tz-bgLight)', fontWeight: 700, fontSize: 14,
                  cursor: requestForm.part_name.trim() ? 'pointer' : 'not-allowed',
                  fontFamily: FONT, opacity: !requestForm.part_name.trim() || actionLoading === 'parts-submit' ? 0.5 : 1,
                }}
              >
                {actionLoading === 'parts-submit' ? t('mechanic.action.submitting') : t('mechanic.action.submit_request')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Decline Modal */}
      {declineModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, paddingTop: 'max(60px, env(safe-area-inset-top, 60px))' }}
          onClick={e => { if (e.target === e.currentTarget) { setDeclineModal(null); setDeclineReason('') } }}>
          <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 14, padding: 24, width: '100%', maxWidth: 400 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{t('mechanic.action.decline_job')}</div>
            <div style={{ fontSize: 13, color: DIM, marginBottom: 16 }}>Why are you declining this job? (optional)</div>
            <textarea
              value={declineReason}
              onChange={e => setDeclineReason(e.target.value)}
              placeholder={t('mechanic.action.decline_reason_placeholder')}
              style={{ width: '100%', padding: '10px 12px', background: 'var(--tz-border)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 8, fontSize: 13, color: TEXT, fontFamily: FONT, minHeight: 80, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => { setDeclineModal(null); setDeclineReason('') }} style={{ padding: '8px 16px', background: 'transparent', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 8, color: DIM, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>{t('mechanic.common.cancel')}</button>
              <button onClick={() => handleJobAction(declineModal, 'decline', declineReason)} disabled={!!actionLoading}
                style={{ padding: '8px 16px', background: RED, color: 'var(--tz-bgLight)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}
      {/* More Time Request Modal */}
      {moreTimeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, paddingTop: 'max(60px, env(safe-area-inset-top, 60px))' }}
          onClick={e => { if (e.target === e.currentTarget) setMoreTimeModal(null) }}>
          <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 14, padding: 24, width: '100%', maxWidth: 380 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{t('mechanic.action.request_more_time')}</div>
            <div style={{ fontSize: 13, color: DIM, marginBottom: 16 }}>
              {moreTimeModal.wo?.so_number} — {moreTimeModal.line?.description?.slice(0, 40)}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[{ label: '30 min', val: '30' }, { label: '1 hr', val: '60' }, { label: '2 hr', val: '120' }].map(opt => (
                <button key={opt.val} onClick={() => setMoreTimeAmount(opt.val)} style={{
                  flex: 1, padding: '10px 8px', borderRadius: 8, border: moreTimeAmount === opt.val ? `2px solid ${AMBER}` : `1px solid ${'var(--tz-border)'}`,
                  background: moreTimeAmount === opt.val ? `${AMBER}15` : 'transparent', color: moreTimeAmount === opt.val ? AMBER : DIM,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
                }}>{opt.label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setMoreTimeModal(null)} style={{ padding: '8px 16px', background: 'transparent', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 8, color: DIM, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>{t('mechanic.common.cancel')}</button>
              <button disabled={actionLoading === 'more-time'} onClick={async () => {
                setActionLoading('more-time')
                const mins = parseInt(moreTimeAmount) || 60
                const label = mins >= 60 ? `${mins / 60} hr` : `${mins} min`
                try {
                  const res = await fetch('/api/mechanic/request-hours', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ assignment_id: moreTimeModal.id, wo_number: moreTimeModal.wo?.so_number, job_description: moreTimeModal.line?.description || 'job', request_type: 'more_time', requested_minutes: mins }),
                  })
                  if (res.ok) { alert(`Requested ${label} more — supervisor notified.`); setMoreTimeModal(null) }
                  else alert('Could not send request.')
                } catch { alert('Could not send request.') }
                setActionLoading(null)
              }} style={{ padding: '8px 16px', background: AMBER, color: 'var(--tz-bgLight)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
                {actionLoading === 'more-time' ? 'Sending...' : 'Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Confirmation Modal */}
      {completeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, paddingTop: 'max(60px, env(safe-area-inset-top, 60px))' }}
          onClick={e => { if (e.target === e.currentTarget) setCompleteModal(null) }}>
          <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 14, padding: 24, width: '100%', maxWidth: 400 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{t('mechanic.action.complete_job')}</div>
            <div style={{ fontSize: 13, color: DIM, marginBottom: 8 }}>
              Are you sure you want to mark this job as complete?
            </div>
            <div style={{ background: 'var(--tz-border)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: BLUE }}>{completeModal.wo?.so_number || 'WO'}</div>
              {completeModal.line?.description && (
                <div style={{ fontSize: 13, color: TEXT, marginTop: 4 }}>{completeModal.line.description}</div>
              )}
              {completeModal.wo?.customers?.company_name && (
                <div style={{ fontSize: 12, color: DIM, marginTop: 4 }}>{completeModal.wo.customers.company_name}</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setCompleteModal(null)} style={{ padding: '8px 16px', background: 'transparent', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 8, color: DIM, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>{t('mechanic.common.cancel')}</button>
              <button onClick={async () => { await handleJobAction(completeModal.id, 'complete'); setCompleteModal(null) }} disabled={!!actionLoading}
                style={{ padding: '8px 16px', background: GREEN, color: 'var(--tz-bgLight)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
                Confirm Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
