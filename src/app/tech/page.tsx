'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

type Tab = 'jobs' | 'floor' | 'parts' | 'dvir'
type View = 'list' | 'detail'

export default function TechMobilePageWrapper() {
  return <Suspense fallback={<div style={{ minHeight: '100vh', background: '#060708', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C8BA0' }}>Loading...</div>}><TechMobilePage /></Suspense>
}

function TechMobilePage() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const deepLinkWo = searchParams.get('wo')
  const [user, setUser] = useState<any>(null)
  const [tab, setTab] = useState<Tab>('jobs')
  const [view, setView] = useState<View>('list')
  const [jobs, setJobs] = useState<any[]>([])
  const [floorJobs, setFloorJobs] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [clockedIn, setClockedIn] = useState<string | null>(null)
  const [clockStart, setClockStart] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [partsNote, setPartsNote] = useState('')
  const [showParts, setShowParts] = useState(false)
  const [showDVIR, setShowDVIR] = useState(false)
  const [dvirUnit, setDvirUnit] = useState('')
  const [dvirType, setDvirType] = useState<'pre_trip' | 'post_trip'>('pre_trip')
  const [dvirDefects, setDvirDefects] = useState('')
  const [dvirOdo, setDvirOdo] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [showActionRequest, setShowActionRequest] = useState(false)
  const [partsStatusMap, setPartsStatusMap] = useState<Record<string, { status: string; line_items: any[] }>>({})
  const [actionType, setActionType] = useState('need_parts')
  const [actionDesc, setActionDesc] = useState('')
  const [actionHours, setActionHours] = useState('')
  const [myRequests, setMyRequests] = useState<any[]>([])
  const [showMyRequests, setShowMyRequests] = useState(false)

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const loadJobs = useCallback(async (profile: any) => {
    const { data } = await supabase
      .from('service_orders')
      .select('id, so_number, status, priority, complaint, cause, correction, internal_notes, bay, team, labor_total, parts_total, grand_total, created_at, completed_at, assets(id, unit_number, year, make, model), customers(company_name)')
      .eq('shop_id', profile.shop_id)
      .eq('assigned_tech', profile.id)
      .is('deleted_at', null)
      .not('status', 'in', '("good_to_go","void")')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
    setJobs(data || [])

    // Check active clock-in
    const { data: clock } = await supabase
      .from('so_time_entries')
      .select('id, so_id, clocked_in_at')
      .eq('user_id', profile.id)
      .is('clocked_out_at', null)
      .limit(1)
      .single()
    if (clock) {
      setClockedIn(clock.so_id)
      setClockStart(clock.clocked_in_at)
    }
  }, [supabase])

  const loadFloor = useCallback(async (profile: any) => {
    const { data } = await supabase
      .from('service_orders')
      .select('id, so_number, status, priority, bay, team, complaint, assets(unit_number), customers(company_name), users!assigned_tech(full_name)')
      .eq('shop_id', profile.shop_id)
      .is('deleted_at', null)
      .not('status', 'in', '("good_to_go","void")')
      .order('priority', { ascending: false })
      .limit(30)
    setFloorJobs(data || [])
  }, [supabase])

  useEffect(() => {
    getCurrentUser(supabase).then(async (p: any) => {
      if (!p) { window.location.href = '/login'; return }
      setUser(p)
      await loadJobs(p)
      await loadFloor(p)
      // Load parts statuses for my jobs
      const prsRes = await fetch(`/api/parts-requests?shop_id=${p.shop_id}`)
      if (prsRes.ok) {
        const prs = await prsRes.json()
        const map: Record<string, { status: string; line_items: any[] }> = {}
        for (const pr of (Array.isArray(prs) ? prs : [])) { if (pr.so_id) map[pr.so_id] = { status: pr.status, line_items: pr.line_items || [] } }
        setPartsStatusMap(map)
      }
      setLoading(false)
    })
  }, [])

  // Deep-link: auto-open a specific WO from notification link (/tech?wo=xxx)
  useEffect(() => {
    if (!deepLinkWo || !jobs.length) return
    const match = jobs.find((j: any) => j.id === deepLinkWo)
    if (match) { setSelected(match); setView('detail'); setTab('jobs') }
  }, [deepLinkWo, jobs])

  // Elapsed timer
  useEffect(() => {
    if (!clockStart) return
    const iv = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(clockStart).getTime()) / 1000))
    }, 1000)
    return () => clearInterval(iv)
  }, [clockStart])

  // ── ACTIONS ──────────────────────────────────────────────
  async function updateStatus(soId: string, status: string) {
    setSaving(true)
    const updates: any = { status }
    if (status === 'done') updates.completed_at = new Date().toISOString()
    await supabase.from('service_orders').update(updates).eq('id', soId)
    if (selected?.id === soId) setSelected({ ...selected, status })
    await loadJobs(user)
    flash(status === 'done' ? 'Job completed' : `Status → ${status.replace(/_/g, ' ')}`)
    setSaving(false)
  }

  async function clockIn(soId: string) {
    // Clock out of any existing
    if (clockedIn) await clockOut()
    await supabase.from('so_time_entries').insert({
      shop_id: user.shop_id, so_id: soId, user_id: user.id, clocked_in_at: new Date().toISOString(),
    })
    setClockedIn(soId)
    setClockStart(new Date().toISOString())
    flash('Clocked in')
  }

  async function clockOut() {
    if (!clockedIn) return
    const now = new Date().toISOString()
    await supabase.from('so_time_entries')
      .update({ clocked_out_at: now })
      .eq('user_id', user.id)
      .eq('so_id', clockedIn)
      .is('clocked_out_at', null)
    setClockedIn(null)
    setClockStart(null)
    setElapsed(0)
    flash('Clocked out')
  }

  async function requestParts(soId: string) {
    if (!partsNote.trim()) return
    setSaving(true)
    await supabase.from('parts_requests').insert({
      shop_id: user.shop_id, so_id: soId, requested_by: user.id,
      description: partsNote.trim(), priority: 'high', status: 'requested',
    })
    setPartsNote('')
    setShowParts(false)
    flash('Parts request sent')
    setSaving(false)
  }

  async function submitDVIR() {
    if (!dvirUnit.trim()) return
    setSaving(true)
    // Find asset
    const { data: asset } = await supabase.from('assets').select('id')
      .eq('shop_id', user.shop_id).ilike('unit_number', dvirUnit.trim()).limit(1).single()
    await supabase.from('dvir_submissions').insert({
      shop_id: user.shop_id,
      asset_id: asset?.id || null,
      dvir_type: dvirType,
      odometer: parseInt(dvirOdo) || null,
      has_defects: dvirDefects.trim().length > 0,
      defects: dvirDefects.trim() ? [{ item: 'General', description: dvirDefects.trim(), severity: 'minor' }] : [],
      notes: dvirDefects.trim() || 'No defects found',
    })
    setDvirUnit(''); setDvirOdo(''); setDvirDefects(''); setShowDVIR(false)
    flash('DVIR submitted')
    setSaving(false)
  }


  // ── MECHANIC JOB ACTIONS ─────────────────────────────────
  async function acceptJob(soId: string) {
    await fetch('/api/mechanic-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'job_action', so_id: soId, mechanic_action: 'accept', mechanic_id: user.id }) })
    flash('Job accepted')
    await loadJobs(user)
  }

  async function declineJob(soId: string) {
    await fetch('/api/mechanic-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'job_action', so_id: soId, mechanic_action: 'decline', mechanic_id: user.id }) })
    flash('Job declined — supervisor notified')
    await loadJobs(user)
  }

  async function startJob(soId: string) {
    await fetch('/api/mechanic-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'job_action', so_id: soId, mechanic_action: 'start' }) })
    flash('Job started')
    await clockIn(soId)
    await loadJobs(user)
  }

  async function completeJob(soId: string) {
    await fetch('/api/mechanic-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'job_action', so_id: soId, mechanic_action: 'complete' }) })
    if (clockedIn === soId) await clockOut()
    flash('Job completed — ready for inspection')
    await loadJobs(user)
  }

  async function submitActionRequest(soId: string) {
    if (!actionDesc.trim()) return
    setSaving(true)
    await fetch('/api/mechanic-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      action: 'create', shop_id: user.shop_id, so_id: soId, mechanic_id: user.id,
      request_type: actionType, description: actionDesc.trim(),
      hours_requested: actionType === 'labor_extension' ? parseFloat(actionHours) || null : null,
    }) })
    setShowActionRequest(false); setActionDesc(''); setActionHours('')
    flash('Request sent to supervisor')
    setSaving(false)
  }

  async function loadMyRequests() {
    const res = await fetch(`/api/mechanic-requests?shop_id=${user.shop_id}&mechanic_id=${user.id}`)
    if (res.ok) setMyRequests(await res.json())
    setShowMyRequests(true)
  }

  // ── HELPERS ──────────────────────────────────────────────
  function fmtTime(sec: number) {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
  }

  const statusColor: Record<string, string> = {
    draft: '#48536A', in_progress: '#1D6FE8', waiting_parts: '#F59E0B',
    waiting_approval: '#F59E0B', done: '#22C55E', good_to_go: '#22C55E',
    ready_final_inspection: '#8B5CF6', not_approved: '#EF4444',
  }

  const priorityIcon: Record<string, string> = { low: '', normal: '', high: '!', critical: '!!' }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#060708', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#7C8BA0', fontSize: 14 }}>Loading...</div>
    </div>
  )

  // ── RENDER ───────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#060708', color: '#DDE3EE', fontFamily: "'Instrument Sans',sans-serif", paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #1A1D23', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {view === 'detail' ? (
          <button onClick={() => { setView('list'); setSelected(null); setShowParts(false) }} style={{ background: 'none', border: 'none', color: '#4D9EFF', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
            ← Back
          </button>
        ) : (
          <div style={{ fontSize: 18, fontWeight: 700, color: '#F0F4FF' }}>TruckZen</div>
        )}
        <div style={{ fontSize: 12, color: '#7C8BA0' }}>{user?.full_name} · {user?.team ? `Team ${user.team}` : user?.role}</div>
      </div>

      {/* Clock banner */}
      {clockedIn && (
        <div style={{ background: 'rgba(29,111,232,.1)', borderBottom: '1px solid rgba(29,111,232,.2)', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 11, color: '#7C8BA0', textTransform: 'uppercase', letterSpacing: '.05em' }}>Clocked in </span>
            <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 16, fontWeight: 600, color: '#4D9EFF' }}>{fmtTime(elapsed)}</span>
          </div>
          <button onClick={clockOut} style={{ ...S.smallBtn, background: '#1A1D23', color: '#EF4444', borderColor: '#EF4444' }}>Clock Out</button>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 16, left: 20, right: 20, zIndex: 100, background: '#1D6FE8', color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600, textAlign: 'center' }}>
          {toast}
        </div>
      )}

      {/* Tab content */}
      <div style={{ padding: '16px 16px 0' }}>
        {tab === 'jobs' && view === 'list' && <JobsList />}
        {tab === 'jobs' && view === 'detail' && selected && <JobDetail />}
        {tab === 'floor' && <FloorView />}
        {tab === 'parts' && <PartsView />}
        {tab === 'dvir' && <DVIRView />}
      </div>

      {/* Bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#0D0F12', borderTop: '1px solid #1A1D23', display: 'flex', zIndex: 50 }}>
        {([['jobs', 'My Jobs', ''], ['floor', 'Floor', ''], ['parts', 'Parts', ''], ['dvir', 'DVIR', '']] as const).map(([k, label, icon]) => (
          <button key={k} onClick={() => { setTab(k); setView('list'); setSelected(null); setShowParts(false); setShowDVIR(false) }}
            style={{ flex: 1, padding: '10px 0 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center' }}>
            <div style={{ fontSize: 20 }}>{icon}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: tab === k ? '#4D9EFF' : '#48536A', marginTop: 2 }}>{label}</div>
          </button>
        ))}
      </div>

      {/* Parts request modal */}
      {showParts && selected && (
        <div style={S.modal}>
          <div style={S.modalCard}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#F0F4FF', marginBottom: 12 }}>Request Parts</div>
            <div style={{ fontSize: 12, color: '#7C8BA0', marginBottom: 12 }}>{(selected.assets as any)?.unit_number} — {selected.so_number}</div>
            <textarea value={partsNote} onChange={e => setPartsNote(e.target.value)} placeholder="What parts do you need?"
              style={{ ...S.input, height: 100, resize: 'none' }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button onClick={() => setShowParts(false)} style={{ ...S.actionBtn, background: '#1A1D23', color: '#7C8BA0', flex: 1 }}>Cancel</button>
              <button onClick={() => requestParts(selected.id)} disabled={saving || !partsNote.trim()}
                style={{ ...S.actionBtn, flex: 1, opacity: saving || !partsNote.trim() ? 0.5 : 1 }}>Send Request</button>
            </div>
          </div>
        </div>
      )}

      {/* Extra time request modal */}
      {showActionRequest && selected && (
        <div style={S.modal}>
          <div style={S.modalCard}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#F0F4FF', marginBottom: 12 }}>Request Extra Time</div>
            <div style={{ fontSize: 12, color: '#7C8BA0', marginBottom: 12 }}>{(selected.assets as any)?.unit_number} — {selected.so_number}</div>
            <div style={{ fontSize: 12, color: '#DDE3EE', marginBottom: 8 }}>How much extra time do you need?</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {['0.5', '1', '2', '4'].map(h => (
                <button key={h} onClick={() => setActionHours(h)}
                  style={{ ...S.actionBtn, flex: 1, padding: '10px 8px', background: actionHours === h ? '#1D6FE8' : '#1A1D23', color: actionHours === h ? '#fff' : '#7C8BA0', fontWeight: 700 }}>
                  {h}h
                </button>
              ))}
            </div>
            <textarea value={actionDesc} onChange={e => setActionDesc(e.target.value)}
              placeholder="Why do you need more time? (required)"
              style={{ ...S.input, height: 80, resize: 'none' }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button onClick={() => setShowActionRequest(false)} style={{ ...S.actionBtn, background: '#1A1D23', color: '#7C8BA0', flex: 1 }}>Cancel</button>
              <button disabled={saving || !actionDesc.trim() || !actionHours} onClick={async () => {
                setSaving(true)
                await fetch('/api/mechanic-requests', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'create', so_id: selected.id,
                    request_type: 'labor_extension',
                    description: actionDesc.trim(),
                    hours_requested: parseFloat(actionHours) || null,
                  }),
                })
                setSaving(false); setShowActionRequest(false); flash('Extra time request sent')
              }}
                style={{ ...S.actionBtn, flex: 1, opacity: saving || !actionDesc.trim() || !actionHours ? 0.5 : 1 }}>
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ── SUB-VIEWS ────────────────────────────────────────────
  function JobsList() {
    return <>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#7C8BA0', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>
        My Jobs ({jobs.length})
      </div>
      {jobs.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#48536A', fontSize: 14 }}>No assigned jobs right now</div>}
      {jobs.map(so => (
        <div key={so.id} onClick={() => { setSelected(so); setView('detail') }}
          style={{ background: '#0D0F12', border: '1px solid #1A1D23', borderRadius: 12, padding: 16, marginBottom: 10, cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 13, fontWeight: 600, color: '#4D9EFF' }}>{so.so_number}</span>
              {so.priority === 'high' || so.priority === 'critical' ? (
                <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: so.priority === 'critical' ? '#EF4444' : '#F59E0B', textTransform: 'uppercase' }}>
                  {priorityIcon[so.priority]} {so.priority}
                </span>
              ) : null}
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: statusColor[so.status] || '#48536A', textTransform: 'uppercase' }}>
              {so.status?.replace(/_/g, ' ')}
            </span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#F0F4FF', marginBottom: 4 }}>
            {(so.assets as any)?.unit_number ? `#${(so.assets as any).unit_number}` : '—'}
            <span style={{ fontSize: 12, color: '#7C8BA0', fontWeight: 400, marginLeft: 8 }}>
              {(so.assets as any)?.year} {(so.assets as any)?.make} {(so.assets as any)?.model}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#7C8BA0' }}>{(so.customers as any)?.company_name || '—'}</div>
          {so.complaint && <div style={{ fontSize: 12, color: '#A0AABF', marginTop: 6, lineHeight: 1.5 }}>{so.complaint.slice(0, 100)}{so.complaint.length > 100 ? '...' : ''}</div>}
          {/* Parts status banner */}
          {partsStatusMap[so.id] && (() => {
            const ps = partsStatusMap[so.id]
            const orderedCount = (ps.line_items || []).filter((l: any) => l.ordered && !l.in_stock).length
            const eta = (ps.line_items || []).find((l: any) => l.ordered && l.eta)?.eta
            if (ps.status === 'ready') return <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: 'rgba(29,184,112,.12)', fontSize: 11, fontWeight: 600, color: '#1DB870' }}>Parts ready — go pick up from parts dept</div>
            if (ps.status === 'partial') return <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: 'rgba(212,136,42,.12)', fontSize: 11, fontWeight: 600, color: '#D4882A' }}>Some parts ready, {orderedCount} on order{eta ? ` until ${eta}` : ''}</div>
            if (ps.status === 'submitted') return <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: 'rgba(212,136,42,.12)', fontSize: 11, fontWeight: 600, color: '#D4882A' }}>Parts being prepared</div>
            if (['pending', 'requested'].includes(ps.status)) return <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: 'rgba(124,139,160,.12)', fontSize: 11, fontWeight: 600, color: '#7C8BA0' }}>Parts request pending</div>
            return null
          })()}
          {clockedIn === so.id && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#4D9EFF', fontWeight: 600 }}>
              Clocked in — {fmtTime(elapsed)}
            </div>
          )}
        </div>
      ))}
    </>
  }

  function JobDetail() {
    const so = selected
    const a = so.assets as any
    const c = so.customers as any
    const isClockedHere = clockedIn === so.id

    return <>
      {/* Unit + customer */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#F0F4FF' }}>
          {a?.unit_number ? `#${a.unit_number}` : so.so_number}
        </div>
        <div style={{ fontSize: 13, color: '#7C8BA0', marginTop: 2 }}>
          {a?.year} {a?.make} {a?.model} · {c?.company_name || '—'}
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, color: '#48536A', marginTop: 4 }}>{so.so_number}</div>
      </div>

      {/* Status badge */}
      <div style={{ display: 'inline-block', padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: statusColor[so.status], border: `1px solid ${statusColor[so.status]}30`, background: `${statusColor[so.status]}10`, marginBottom: 16, textTransform: 'uppercase' }}>
        {so.status?.replace(/_/g, ' ')}
      </div>

      {/* Parts status banner */}
      {partsStatusMap[so.id] && (() => {
        const ps = partsStatusMap[so.id]
        const orderedItems = (ps.line_items || []).filter((l: any) => l.ordered && !l.in_stock)
        const eta = orderedItems.find((l: any) => l.eta)?.eta
        const bg = ps.status === 'ready' ? 'rgba(29,184,112,.12)' : ps.status === 'partial' || ps.status === 'submitted' ? 'rgba(212,136,42,.12)' : 'rgba(124,139,160,.12)'
        const clr = ps.status === 'ready' ? '#1DB870' : ps.status === 'partial' || ps.status === 'submitted' ? '#D4882A' : '#7C8BA0'
        const msg = ps.status === 'ready' ? 'Parts ready — go pick up from parts dept'
          : ps.status === 'partial' ? `Some parts ready, ${orderedItems.length} on order${eta ? ` until ${eta}` : ''}`
          : ps.status === 'submitted' ? 'Parts being prepared'
          : 'Parts request pending'
        return <div style={{ padding: '10px 14px', borderRadius: 10, background: bg, border: `1px solid ${clr}30`, fontSize: 13, fontWeight: 600, color: clr, marginBottom: 16 }}>{msg}</div>
      })()}

      {/* Complaint / Cause / Correction */}
      <div style={S.section}>
        <div style={S.sectionLabel}>Complaint</div>
        <div style={{ fontSize: 14, color: '#DDE3EE', lineHeight: 1.6 }}>{so.complaint || '—'}</div>
      </div>
      {so.cause && <div style={S.section}><div style={S.sectionLabel}>Cause</div><div style={{ fontSize: 14, color: '#DDE3EE' }}>{so.cause}</div></div>}
      {so.correction && <div style={S.section}><div style={S.sectionLabel}>Correction</div><div style={{ fontSize: 14, color: '#DDE3EE' }}>{so.correction}</div></div>}

      {/* Time tracking */}
      <div style={{ ...S.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, color: '#7C8BA0', textTransform: 'uppercase', letterSpacing: '.05em' }}>Time</div>
          {isClockedHere ? (
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 20, fontWeight: 700, color: '#4D9EFF' }}>{fmtTime(elapsed)}</div>
          ) : (
            <div style={{ fontSize: 14, color: '#48536A' }}>{clockedIn ? 'On another job' : 'Not clocked in'}</div>
          )}
        </div>
        {isClockedHere ? (
          <button onClick={clockOut} style={{ ...S.actionBtn, background: '#1A1D23', color: '#EF4444', borderColor: '#EF4444' }}>Clock Out</button>
        ) : (
          <button onClick={() => clockIn(so.id)} style={S.actionBtn} disabled={!!saving}>Clock In</button>
        )}
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <button onClick={() => setShowParts(true)} style={S.tileBtn}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Parts</span>
          <span>Request Parts</span>
        </button>
        <button onClick={() => { setActionType('labor_extension'); setActionDesc(''); setActionHours(''); setShowActionRequest(true) }} style={S.tileBtn}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Time</span>
          <span>Request Extra Time</span>
        </button>
      </div>

      {/* Status actions */}
      <div style={S.section}>
        <div style={S.sectionLabel}>Update Status</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {so.status !== 'in_progress' && (
            <button onClick={() => updateStatus(so.id, 'in_progress')} disabled={saving}
              style={{ ...S.bigBtn, background: 'linear-gradient(135deg,#1D6FE8,#1248B0)' }}>
              Start Work
            </button>
          )}
          {so.status === 'in_progress' && (
            <>
              <button onClick={() => updateStatus(so.id, 'waiting_parts')} disabled={saving}
                style={{ ...S.bigBtn, background: '#F59E0B', color: '#000' }}>
                Waiting for Parts
              </button>
              <button onClick={() => { updateStatus(so.id, 'done'); if (isClockedHere) clockOut() }} disabled={saving}
                style={{ ...S.bigBtn, background: '#22C55E', color: '#000' }}>
                Complete Job
              </button>
            </>
          )}
          {so.status === 'waiting_parts' && (
            <button onClick={() => updateStatus(so.id, 'in_progress')} disabled={saving}
              style={{ ...S.bigBtn, background: 'linear-gradient(135deg,#1D6FE8,#1248B0)' }}>
              Resume Work (Parts Received)
            </button>
          )}
        </div>
      </div>

      {/* Totals */}
      {(so.labor_total > 0 || so.parts_total > 0) && (
        <div style={{ ...S.card, display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
          <div><div style={{ fontSize: 10, color: '#7C8BA0' }}>LABOR</div><div style={{ fontSize: 16, fontWeight: 700 }}>${so.labor_total?.toFixed(0)}</div></div>
          <div><div style={{ fontSize: 10, color: '#7C8BA0' }}>PARTS</div><div style={{ fontSize: 16, fontWeight: 700 }}>${so.parts_total?.toFixed(0)}</div></div>
          <div><div style={{ fontSize: 10, color: '#7C8BA0' }}>TOTAL</div><div style={{ fontSize: 16, fontWeight: 700, color: '#4D9EFF' }}>${so.grand_total?.toFixed(0)}</div></div>
        </div>
      )}
    </>
  }

  function FloorView() {
    return <>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#7C8BA0', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>
        Shop Floor ({floorJobs.length})
      </div>
      {floorJobs.map(so => (
        <div key={so.id} style={{ background: '#0D0F12', border: '1px solid #1A1D23', borderRadius: 10, padding: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, color: '#4D9EFF' }}>{so.so_number}</span>
              {so.bay && <span style={{ fontSize: 10, color: '#48536A', background: '#1A1D23', padding: '2px 6px', borderRadius: 4 }}>Bay {so.bay}</span>}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#F0F4FF', marginTop: 4 }}>#{(so.assets as any)?.unit_number || '—'}</div>
            <div style={{ fontSize: 11, color: '#7C8BA0' }}>{(so.customers as any)?.company_name} · {(so.users as any)?.full_name || 'Unassigned'}</div>
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: statusColor[so.status], textTransform: 'uppercase', textAlign: 'right' }}>
            {so.status?.replace(/_/g, ' ')}
          </div>
        </div>
      ))}
    </>
  }

  function PartsView() {
    const [parts, setParts] = useState<any[]>([])
    const [search, setSearch] = useState('')
    useEffect(() => {
      if (!user) return
      fetch(`/api/parts?shop_id=${user.shop_id}&per_page=2000`)
        .then(r => r.ok ? r.json() : { data: [] })
        .then((res: any) => setParts(Array.isArray(res) ? res : (res.data || [])))
    }, [user])

    const filtered = parts.filter(p =>
      p.part_number?.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase())
    )

    return <>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#7C8BA0', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>Parts Lookup</div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search part # or name..."
        style={{ ...S.input, marginBottom: 12 }} />
      {filtered.slice(0, 30).map(p => (
        <div key={p.part_number} style={{ background: '#0D0F12', border: '1px solid #1A1D23', borderRadius: 10, padding: 12, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, color: '#4D9EFF' }}>{p.part_number}</div>
              <div style={{ fontSize: 14, color: '#F0F4FF', marginTop: 2 }}>{p.description}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: p.on_hand > 0 ? '#22C55E' : '#EF4444' }}>{p.on_hand}</div>
              <div style={{ fontSize: 10, color: '#48536A' }}>in stock</div>
            </div>
          </div>
          {p.bin_location && <div style={{ fontSize: 11, color: '#7C8BA0', marginTop: 4 }}>Bin: {p.bin_location}</div>}
        </div>
      ))}
    </>
  }

  function DVIRView() {
    const [myAssets, setMyAssets] = useState<any[]>([])
    useEffect(() => {
      if (!user) return
      fetch(`/api/assets?shop_id=${user.shop_id}&status=on_road`)
        .then(r => r.ok ? r.json() : [])
        .then((res: any) => setMyAssets(Array.isArray(res) ? res : (res.data || [])))
    }, [user])

    return <>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#7C8BA0', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>DVIR Submission</div>

      <div style={S.card}>
        <div style={S.fieldLabel}>Unit Number</div>
        <input value={dvirUnit} onChange={e => setDvirUnit(e.target.value)} placeholder="e.g. 2717"
          style={S.input} list="dvir-units" />
        <datalist id="dvir-units">
          {myAssets.map(a => <option key={a.id} value={a.unit_number}>{a.unit_number} — {a.year} {a.make}</option>)}
        </datalist>

        <div style={{ ...S.fieldLabel, marginTop: 16 }}>Inspection Type</div>
        <div style={{ display: 'flex', gap: 10 }}>
          {(['pre_trip', 'post_trip'] as const).map(t => (
            <button key={t} onClick={() => setDvirType(t)}
              style={{ flex: 1, padding: '12px 0', borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: 'pointer', border: dvirType === t ? '1px solid #1D6FE8' : '1px solid #1A1D23', background: dvirType === t ? 'rgba(29,111,232,.1)' : '#0D0F12', color: dvirType === t ? '#4D9EFF' : '#7C8BA0' }}>
              {t === 'pre_trip' ? 'Pre-Trip' : 'Post-Trip'}
            </button>
          ))}
        </div>

        <div style={{ ...S.fieldLabel, marginTop: 16 }}>Odometer</div>
        <input value={dvirOdo} onChange={e => setDvirOdo(e.target.value)} placeholder="Current reading" type="number"
          style={S.input} />

        <div style={{ ...S.fieldLabel, marginTop: 16 }}>Defects (leave blank if none)</div>
        <textarea value={dvirDefects} onChange={e => setDvirDefects(e.target.value)} placeholder="Describe any defects found..."
          style={{ ...S.input, height: 80, resize: 'none' }} />

        <button onClick={submitDVIR} disabled={saving || !dvirUnit.trim()}
          style={{ ...S.bigBtn, marginTop: 16, width: '100%', opacity: saving || !dvirUnit.trim() ? 0.5 : 1 }}>
          {saving ? 'Submitting...' : 'Submit DVIR'}
        </button>
      </div>
    </>
  }
}

// ── STYLES ─────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  card: { background: '#0D0F12', border: '1px solid #1A1D23', borderRadius: 12, padding: 16, marginBottom: 16 },
  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontWeight: 600, color: '#7C8BA0', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 },
  fieldLabel: { fontSize: 12, fontWeight: 600, color: '#7C8BA0', marginBottom: 6 },
  input: { width: '100%', padding: '12px 14px', background: '#0D0F12', border: '1px solid #1A1D23', borderRadius: 9, color: '#DDE3EE', fontSize: 14, fontFamily: "'Instrument Sans',sans-serif", outline: 'none', boxSizing: 'border-box' },
  actionBtn: { padding: '10px 18px', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', color: '#fff', whiteSpace: 'nowrap' },
  bigBtn: { padding: '16px 24px', borderRadius: 12, border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer', background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', color: '#fff', textAlign: 'center', width: '100%' },
  tileBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '16px 12px', background: '#0D0F12', border: '1px solid #1A1D23', borderRadius: 12, cursor: 'pointer', color: '#DDE3EE', fontSize: 13, fontWeight: 600, fontFamily: "'Instrument Sans',sans-serif" },
  smallBtn: { padding: '6px 14px', borderRadius: 7, border: '1px solid #1A1D23', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'none' },
  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 90, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 },
  modalCard: { background: '#0D0F12', border: '1px solid #1A1D23', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420 },
}
