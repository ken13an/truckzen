'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

type View = 'table' | 'kanban' | 'monitor'

const STATUS_GROUPS = [
  { key: 'todo', label: 'To-Do', statuses: ['draft', 'not_approved', 'waiting_approval'], color: '#7C8BA0' },
  { key: 'in_progress', label: 'In Progress', statuses: ['in_progress'], color: '#F59E0B' },
  { key: 'waiting_parts', label: 'Waiting Parts', statuses: ['waiting_parts'], color: '#F59E0B' },
  { key: 'ready_inspection', label: 'Ready for Inspection', statuses: ['ready_final_inspection', 'done'], color: '#06B6D4' },
  { key: 'good_to_go', label: 'Good to Go', statuses: ['good_to_go'], color: '#22C55E' },
  { key: 'failed', label: 'Failed Inspection', statuses: ['failed_inspection'], color: '#EF4444' },
]

const STATUS_COLOR: Record<string, string> = {
  draft: '#7C8BA0', not_approved: '#8B5CF6', waiting_approval: '#F59E0B',
  in_progress: '#F59E0B', waiting_parts: '#F59E0B', done: '#06B6D4',
  ready_final_inspection: '#06B6D4', good_to_go: '#22C55E', failed_inspection: '#EF4444',
}

const PRIORITY_COLOR: Record<string, string> = { low: '#48536A', normal: '#7C8BA0', high: '#F59E0B', critical: '#EF4444' }

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.floor(m / 60)}h ago`
  return `${Math.floor(m / 1440)}d ago`
}

export default function ShopFloorPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [view, setView] = useState<View>('table')
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterTeam, setFilterTeam] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [kanbanGroup, setKanbanGroup] = useState<'status' | 'team'>('status')
  const [mechanics, setMechanics] = useState<any[]>([])
  const [activeClocks, setActiveClocks] = useState<any[]>([])
  const [showMechPanel, setShowMechPanel] = useState(true)
  const [partsStatusMap, setPartsStatusMap] = useState<Record<string, string>>({})

  const loadJobs = useCallback(async (profile: any) => {
    const res = await fetch(`/api/service-orders?shop_id=${profile.shop_id}&limit=100&historical=false`)
    const data = res.ok ? await res.json() : []
    const filtered = (data || []).filter((j: any) => j.status !== 'good_to_go')
    setJobs(filtered)
  }, [])

  useEffect(() => {
    getCurrentUser(supabase).then(async (p: any) => {
      if (!p) { window.location.href = '/login'; return }
      setUser(p)
      await loadJobs(p)
      // Load mechanics + clocks + parts request statuses
      const [usersRes, clocksRes, prsRes] = await Promise.all([
        fetch(`/api/users?shop_id=${p.shop_id}`),
        fetch(`/api/time-tracking/active?shop_id=${p.shop_id}`),
        fetch(`/api/parts-requests?shop_id=${p.shop_id}`),
      ])
      const allUsers = usersRes.ok ? await usersRes.json() : []
      const mechRoles = ['technician', 'lead_tech', 'maintenance_technician']
      const mechs = (allUsers || []).filter((u: any) => mechRoles.includes(u.role) && u.active && !u.deleted_at)
      mechs.sort((a: any, b: any) => (a.full_name || '').localeCompare(b.full_name || ''))
      // active clocks from /api/time-tracking/active returns { id, mechanic_name, team, wo_number, job_description, clocked_in_at }
      // normalise to shape the Mechanic Status panel expects: { user_id, clock_in, service_orders: { so_number, assets: { unit_number } } }
      const rawClocks = clocksRes.ok ? await clocksRes.json() : []
      const clocks = (rawClocks || []).map((c: any) => {
        // match back to mechanic by name since active endpoint doesn't return user_id directly
        const mechMatch = mechs.find((m: any) => m.full_name === c.mechanic_name)
        return {
          user_id: mechMatch?.id ?? null,
          clock_in: c.clocked_in_at,
          so_id: null,
          service_orders: { so_number: c.wo_number, assets: { unit_number: null } },
        }
      })
      setMechanics(mechs)
      setActiveClocks(clocks)
      const prsData = prsRes.ok ? await prsRes.json() : []
      const activePrs = (prsData || []).filter((pr: any) => pr.status !== 'delivered' && pr.status !== 'picked_up')
      if (activePrs.length) {
        const map: Record<string, string> = {}
        for (const pr of activePrs) { if (pr.so_id) map[pr.so_id] = pr.status }
        setPartsStatusMap(map)
      }
      setLoading(false)
    })
  }, [])

  // Auto-refresh for monitor view
  useEffect(() => {
    if (view !== 'monitor' || !user) return
    const iv = setInterval(() => loadJobs(user), 30000)
    return () => clearInterval(iv)
  }, [view, user])

  const filtered = jobs.filter(j => {
    if (search) {
      const q = search.toLowerCase()
      if (!(j.assets as any)?.unit_number?.toLowerCase().includes(q) && !(j.customers as any)?.company_name?.toLowerCase().includes(q) && !j.so_number?.toLowerCase().includes(q)) return false
    }
    if (filterTeam && j.team !== filterTeam) return false
    if (filterPriority && j.priority !== filterPriority) return false
    return true
  })

  // Stats
  const stats = {
    active: jobs.filter(j => j.status === 'in_progress').length,
    waiting: jobs.filter(j => j.status === 'waiting_parts').length,
    inspection: jobs.filter(j => ['ready_final_inspection', 'done'].includes(j.status)).length,
    failed: jobs.filter(j => j.status === 'failed_inspection').length,
    total: jobs.length,
  }

  if (loading) return <div style={{ minHeight: '100vh', background: '#060708', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C8BA0' }}>Loading...</div>

  return (
    <div style={{ background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: "'Instrument Sans',sans-serif", padding: view === 'monitor' ? 16 : 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: view === 'monitor' ? 22 : 28, color: '#F0F4FF', display: 'flex', alignItems: 'center', gap: 10 }}>
            Shop Floor
            {view === 'monitor' && <span style={{ fontSize: 10, background: '#22C55E', color: '#000', padding: '3px 8px', borderRadius: 10, fontFamily: "'Instrument Sans'", fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#000', animation: 'pulse 2s infinite' }} />LIVE</span>}
          </div>
        </div>
        {/* View tabs */}
        <div style={{ display: 'flex', gap: 4, background: '#0D0F12', borderRadius: 8, padding: 3 }}>
          {(['table', 'kanban', 'monitor'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding: '7px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: view === v ? '#1A1D23' : 'transparent', color: view === v ? '#F0F4FF' : '#48536A', textTransform: 'capitalize' }}>{v}</button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Active', value: stats.active, color: '#F59E0B' },
          { label: 'Waiting Parts', value: stats.waiting, color: '#F59E0B' },
          { label: 'Inspection', value: stats.inspection, color: '#06B6D4' },
          { label: 'Failed', value: stats.failed, color: '#EF4444' },
          { label: 'Total', value: stats.total, color: '#7C8BA0' },
        ].map(s => (
          <div key={s.label} style={{ background: '#0D0F12', border: '1px solid #1A1D23', borderRadius: 8, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</span>
            <span style={{ fontSize: 10, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Mechanic Status Panel */}
      {showMechPanel && mechanics.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: "'IBM Plex Mono',monospace" }}>Mechanic Status</span>
            <button onClick={() => setShowMechPanel(false)} style={{ background: 'none', border: 'none', color: '#48536A', fontSize: 10, cursor: 'pointer' }}>Hide</button>
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {mechanics.map(m => {
              const clock = activeClocks.find(c => c.user_id === m.id)
              const isWorking = !!clock
              const so = clock?.service_orders as any
              const elapsed = clock ? Math.floor((Date.now() - new Date(clock.clock_in).getTime()) / 60000) : 0
              const statusColor = isWorking ? (elapsed > 360 ? '#F59E0B' : '#22C55E') : '#48536A'
              const statusLabel = isWorking ? (elapsed > 360 ? 'Finishing Soon' : 'Working') : 'Off'
              const assignedCount = jobs.filter(j => j.assigned_tech === m.id).length

              return (
                <div key={m.id} style={{ background: '#0D0F12', border: `1px solid ${isWorking ? statusColor + '40' : '#1A1D23'}`, borderRadius: 10, padding: '10px 14px', minWidth: 140, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: statusColor + '20', color: statusColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                      {m.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#F0F4FF', whiteSpace: 'nowrap' }}>{m.full_name?.split(' ')[0]}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }} />
                    <span style={{ fontSize: 9, fontWeight: 600, color: statusColor, textTransform: 'uppercase' }}>{statusLabel}</span>
                  </div>
                  {isWorking && so?.so_number && (
                    <div style={{ fontSize: 9, color: '#7C8BA0', marginTop: 2 }}>
                      {so.so_number} · #{so.assets?.unit_number || '—'} · {elapsed}m
                    </div>
                  )}
                  {assignedCount > 0 && (
                    <div style={{ fontSize: 9, color: '#48536A', marginTop: 2 }}>{assignedCount} job{assignedCount !== 1 ? 's' : ''} in queue</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {!showMechPanel && mechanics.length > 0 && (
        <button onClick={() => setShowMechPanel(true)} style={{ fontSize: 10, color: '#48536A', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 8 }}>Show Mechanic Status</button>
      )}

      {/* Filters (not in monitor view) */}
      {view !== 'monitor' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search truck #, company, SO #..." style={S.input} />
          <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)} style={{ ...S.input, width: 120 }}>
            <option value="">All Teams</option>
            {['A', 'B', 'C', 'D'].map(t => <option key={t} value={t}>Team {t}</option>)}
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={{ ...S.input, width: 120 }}>
            <option value="">All Priority</option>
            {['low', 'normal', 'high', 'critical'].map(p => <option key={p} value={p} style={{ textTransform: 'capitalize' }}>{p}</option>)}
          </select>
          {view === 'kanban' && (
            <select value={kanbanGroup} onChange={e => setKanbanGroup(e.target.value as any)} style={{ ...S.input, width: 140 }}>
              <option value="status">Group by Status</option>
              <option value="team">Group by Team</option>
            </select>
          )}
        </div>
      )}

      {/* Monitor search */}
      {view === 'monitor' && (
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find truck #..." style={{ ...S.input, marginBottom: 16, fontSize: 16, padding: '12px 16px' }} />
      )}

      {/* ═══ TABLE VIEW ═══ */}
      {view === 'table' && (
        <div style={{ overflowX: 'auto' }}>
          {STATUS_GROUPS.map(group => {
            const groupJobs = filtered.filter(j => group.statuses.includes(j.status))
            if (!groupJobs.length) return null
            return (
              <div key={group.key} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: group.color }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#F0F4FF' }}>{group.label}</span>
                  <span style={{ fontSize: 10, color: '#48536A' }}>({groupJobs.length})</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead><tr>
                    {['Truck', 'Team/Bay', 'Customer', 'Complaint', 'Status', 'Parts', 'Priority', 'Mechanic', 'Updated'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {groupJobs.map(j => (
                      <tr key={j.id} style={{ cursor: 'pointer' }} onClick={() => window.location.href = `/work-orders/${j.id}`}>
                        <td style={{ ...S.td, fontWeight: 700, color: '#4D9EFF' }}>#{(j.assets as any)?.unit_number || '—'}</td>
                        <td style={S.td}>{j.team ? `Team ${j.team}` : '—'}{j.bay ? ` · ${j.bay}` : ''}</td>
                        <td style={S.td}>{(j.customers as any)?.company_name || '—'}</td>
                        <td style={{ ...S.td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.complaint || '—'}</td>
                        <td style={S.td}><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: STATUS_COLOR[j.status] || '#7C8BA0', background: `${STATUS_COLOR[j.status] || '#7C8BA0'}15` }}>{j.status?.replace(/_/g, ' ')}</span></td>
                        <td style={S.td}>{partsStatusMap[j.id] ? <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: partsStatusMap[j.id] === 'ready' ? '#22C55E' : partsStatusMap[j.id] === 'submitted' || partsStatusMap[j.id] === 'partial' ? '#F59E0B' : '#7C8BA0', background: `${partsStatusMap[j.id] === 'ready' ? '#22C55E' : partsStatusMap[j.id] === 'submitted' || partsStatusMap[j.id] === 'partial' ? '#F59E0B' : '#7C8BA0'}15` }}>{partsStatusMap[j.id] === 'ready' ? 'Parts Ready' : partsStatusMap[j.id] === 'partial' ? 'Partial' : partsStatusMap[j.id] === 'submitted' ? 'Preparing' : partsStatusMap[j.id]}</span> : <span style={{ color: '#48536A', fontSize: 9 }}>—</span>}</td>
                        <td style={S.td}><span style={{ color: PRIORITY_COLOR[j.priority] || '#7C8BA0', fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>{j.priority}</span></td>
                        <td style={S.td}>{(j.users as any)?.full_name || <span style={{ color: '#48536A' }}>Unassigned</span>}</td>
                        <td style={{ ...S.td, color: '#48536A', fontSize: 10 }}>{timeAgo(j.updated_at || j.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}

      {/* ═══ KANBAN VIEW ═══ */}
      {view === 'kanban' && (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16 }}>
          {kanbanGroup === 'status' ? (
            STATUS_GROUPS.map(group => {
              const groupJobs = filtered.filter(j => group.statuses.includes(j.status))
              return (
                <div key={group.key} style={{ minWidth: 260, maxWidth: 300, flex: '0 0 280px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '8px 12px', background: '#0D0F12', borderRadius: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: group.color }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#F0F4FF' }}>{group.label}</span>
                    <span style={{ fontSize: 10, color: '#48536A', marginLeft: 'auto' }}>{groupJobs.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {groupJobs.map(j => <KanbanCard key={j.id} job={j} />)}
                  </div>
                </div>
              )
            })
          ) : (
            ['A', 'B', 'C', 'D', ''].map(team => {
              const teamJobs = filtered.filter(j => (j.team || '') === team)
              if (!teamJobs.length && team) return null
              return (
                <div key={team || 'unassigned'} style={{ minWidth: 260, maxWidth: 300, flex: '0 0 280px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '8px 12px', background: '#0D0F12', borderRadius: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#F0F4FF' }}>{team ? `Team ${team}` : 'Unassigned'}</span>
                    <span style={{ fontSize: 10, color: '#48536A', marginLeft: 'auto' }}>{teamJobs.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {teamJobs.map(j => <KanbanCard key={j.id} job={j} />)}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ═══ MONITOR VIEW ═══ */}
      {view === 'monitor' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
          {filtered.map(j => (
            <div key={j.id} style={{ background: '#0D0F12', border: `2px solid ${STATUS_COLOR[j.status] || '#1A1D23'}30`, borderLeft: `4px solid ${PRIORITY_COLOR[j.priority] || '#7C8BA0'}`, borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#F0F4FF', fontFamily: "'IBM Plex Mono'" }}>#{(j.assets as any)?.unit_number || '—'}</div>
                <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: STATUS_COLOR[j.status], background: `${STATUS_COLOR[j.status]}15` }}>{j.status?.replace(/_/g, ' ')}</span>
              </div>
              <div style={{ fontSize: 14, color: '#DDE3EE', marginBottom: 4 }}>{(j.customers as any)?.company_name || '—'}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#7C8BA0' }}>
                <span>{j.team ? `Team ${j.team}` : '—'}{j.bay ? ` · ${j.bay}` : ''}</span>
                <span>{(j.users as any)?.full_name || 'Unassigned'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }`}</style>
    </div>
  )
}

function KanbanCard({ job: j }: { job: any }) {
  return (
    <div onClick={() => window.location.href = `/work-orders/${j.id}`}
      style={{ background: '#0D0F12', border: '1px solid #1A1D23', borderLeft: `3px solid ${PRIORITY_COLOR[j.priority] || '#7C8BA0'}`, borderRadius: 10, padding: 12, cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, fontWeight: 700, color: '#4D9EFF' }}>#{(j.assets as any)?.unit_number || '—'}</span>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: PRIORITY_COLOR[j.priority], padding: '2px 6px', borderRadius: 4, background: `${PRIORITY_COLOR[j.priority]}15` }}>{j.priority}</span>
      </div>
      <div style={{ fontSize: 12, color: '#DDE3EE', marginBottom: 4 }}>{(j.customers as any)?.company_name || '—'}</div>
      {j.complaint && <div style={{ fontSize: 11, color: '#7C8BA0', lineHeight: 1.4, marginBottom: 6 }}>{j.complaint.slice(0, 80)}{j.complaint.length > 80 ? '...' : ''}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: '#48536A' }}>
        <span>{(j.users as any)?.full_name || 'Unassigned'}</span>
        <span>{j.team ? `Team ${j.team}` : ''}{j.bay ? ` · ${j.bay}` : ''}</span>
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  input: { padding: '8px 12px', background: '#0D0F12', border: '1px solid #1A1D23', borderRadius: 8, color: '#DDE3EE', fontSize: 12, fontFamily: "'Instrument Sans',sans-serif", outline: 'none', flex: 1, minWidth: 160 },
  th: { fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: '#48536A', textTransform: 'uppercase' as const, letterSpacing: '.1em', padding: '7px 10px', textAlign: 'left' as const, background: '#0B0D11', whiteSpace: 'nowrap' as const },
  td: { padding: '9px 10px', borderBottom: '1px solid rgba(255,255,255,.025)', fontSize: 11, color: '#A0AABF' },
}
