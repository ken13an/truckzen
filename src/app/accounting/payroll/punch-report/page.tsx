'use client'
import { useState, useEffect } from 'react'
import { ChevronLeft, Clock, Wrench } from 'lucide-react'

const FONT = "'Inter', -apple-system, sans-serif"
const MONO = "'IBM Plex Mono', monospace"
const BLUE = '#1D6FE8', GREEN = '#16A34A', AMBER = '#D97706', RED = '#DC2626', DIM = '#7C8BA0'

type View = 'daily' | 'weekly' | 'monthly'

function fmtHrs(mins: number) { return mins > 0 ? `${+(mins / 60).toFixed(1)}h` : '—' }
function fmtDate(d: string) { try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) } catch { return d } }
function fmtTime(d: string) { try { return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) } catch { return d } }

function getPeriod(view: View): { from: string; to: string; label: string } {
  const now = new Date()
  if (view === 'daily') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return { from: start.toISOString(), to: new Date(start.getTime() + 86400000).toISOString(), label: 'Today' }
  }
  if (view === 'weekly') {
    const day = now.getDay()
    const mondayOff = day === 0 ? -6 : 1 - day
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOff)
    return { from: start.toISOString(), to: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString(), label: 'This Week' }
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return { from: start.toISOString(), to: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString(), label: 'This Month' }
}

export default function PunchReportPage() {
  const [mechanics, setMechanics] = useState<any[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<any>(null)
  const [view, setView] = useState<View>('weekly')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadList() }, [view])

  async function loadList() {
    setLoading(true)
    const { from, to } = getPeriod(view)
    const res = await fetch(`/api/accounting/punch-report?from=${from}&to=${to}`)
    if (res.ok) { const d = await res.json(); setMechanics(d.mechanics || []) }
    setLoading(false)
  }

  async function loadDetail(userId: string) {
    setSelected(userId)
    const { from, to } = getPeriod(view)
    const res = await fetch(`/api/accounting/punch-report?user_id=${userId}&from=${from}&to=${to}`)
    if (res.ok) setDetail(await res.json())
  }

  const period = getPeriod(view)

  if (selected && detail) {
    const u = detail.user
    const shiftTotal = (detail.punches || []).reduce((s: number, p: any) => s + (p.duration_minutes || 0), 0)
    const jobTotal = (detail.entries || []).reduce((s: number, e: any) => s + (e.duration_minutes || 0), 0)

    return (
      <div style={{ minHeight: '100vh', background: '#0C0C12', color: '#EDEDF0', fontFamily: FONT, padding: 24 }}>
        <button onClick={() => { setSelected(null); setDetail(null) }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: BLUE, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, marginBottom: 16 }}>
          <ChevronLeft size={16} /> Back to Mechanics
        </button>

        <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>{u?.full_name || 'Mechanic'}</h1>
        <p style={{ fontSize: 12, color: DIM, margin: '0 0 16px' }}>{u?.role?.replace(/_/g, ' ')} — {period.label}</p>

        {/* View toggle */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {(['daily', 'weekly', 'monthly'] as View[]).map(v => (
            <button key={v} onClick={() => { setView(v); setTimeout(() => loadDetail(selected!), 0) }} style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, textTransform: 'capitalize',
              border: view === v ? `1px solid ${BLUE}` : '1px solid rgba(255,255,255,0.08)',
              background: view === v ? 'rgba(29,111,232,.1)' : 'transparent',
              color: view === v ? '#4D9EFF' : DIM,
            }}>{v}</button>
          ))}
        </div>

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div style={{ background: '#151520', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, color: DIM, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={12} /> Shift Hours</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: BLUE }}>{fmtHrs(shiftTotal)}</div>
            <div style={{ fontSize: 11, color: DIM, marginTop: 2 }}>{detail.punches?.length || 0} session{detail.punches?.length !== 1 ? 's' : ''}</div>
          </div>
          <div style={{ background: '#151520', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, color: DIM, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}><Wrench size={12} /> Job Hours</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: GREEN }}>{fmtHrs(jobTotal)}</div>
            <div style={{ fontSize: 11, color: DIM, marginTop: 2 }}>{detail.entries?.length || 0} session{detail.entries?.length !== 1 ? 's' : ''}</div>
          </div>
        </div>

        {/* Shift sessions */}
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={14} color={BLUE} /> Shift Sessions</h3>
        <div style={{ background: '#151520', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
          {(detail.punches || []).length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: DIM, fontSize: 12 }}>No shift sessions in this period</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr>{['Date', 'In', 'Out', 'Duration', 'Geofence'].map(h => <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: DIM, textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#12121A' }}>{h}</th>)}</tr></thead>
              <tbody>
                {(detail.punches || []).map((p: any) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '8px 12px' }}>{fmtDate(p.punch_in_at)}</td>
                    <td style={{ padding: '8px 12px', fontFamily: MONO }}>{fmtTime(p.punch_in_at)}</td>
                    <td style={{ padding: '8px 12px', fontFamily: MONO }}>{fmtTime(p.punch_out_at)}</td>
                    <td style={{ padding: '8px 12px', fontFamily: MONO, fontWeight: 700 }}>{fmtHrs(p.duration_minutes || 0)}</td>
                    <td style={{ padding: '8px 12px' }}>
                      {p.inside_geofence ? <span style={{ color: GREEN, fontSize: 10, fontWeight: 600 }}>In-range</span> : <span style={{ color: p.override_flag ? AMBER : RED, fontSize: 10, fontWeight: 600 }}>{p.override_flag ? 'Override' : 'Out-of-range'}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Job sessions */}
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}><Wrench size={14} color={GREEN} /> Job Sessions</h3>
        <div style={{ background: '#151520', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' }}>
          {(detail.entries || []).length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: DIM, fontSize: 12 }}>No job sessions in this period</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr>{['Date', 'In', 'Out', 'Duration', 'Job'].map(h => <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: DIM, textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#12121A' }}>{h}</th>)}</tr></thead>
              <tbody>
                {(detail.entries || []).map((e: any) => (
                  <tr key={e.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '8px 12px' }}>{fmtDate(e.clocked_in_at)}</td>
                    <td style={{ padding: '8px 12px', fontFamily: MONO }}>{fmtTime(e.clocked_in_at)}</td>
                    <td style={{ padding: '8px 12px', fontFamily: MONO }}>{fmtTime(e.clocked_out_at)}</td>
                    <td style={{ padding: '8px 12px', fontFamily: MONO, fontWeight: 700 }}>{fmtHrs(e.duration_minutes || 0)}</td>
                    <td style={{ padding: '8px 12px', color: DIM }}>{(e.so_lines as any)?.description?.slice(0, 40) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  // Mechanic list view
  return (
    <div style={{ minHeight: '100vh', background: '#0C0C12', color: '#EDEDF0', fontFamily: FONT, padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <a href="/accounting/payroll" style={{ color: BLUE, fontSize: 13, textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><ChevronLeft size={16} /> Payroll</a>
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>Mechanic Punch Report</h1>
      <p style={{ fontSize: 13, color: DIM, margin: '0 0 16px' }}>Shift attendance vs job activity — {period.label}</p>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {(['daily', 'weekly', 'monthly'] as View[]).map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, textTransform: 'capitalize',
            border: view === v ? `1px solid ${BLUE}` : '1px solid rgba(255,255,255,0.08)',
            background: view === v ? 'rgba(29,111,232,.1)' : 'transparent',
            color: view === v ? '#4D9EFF' : DIM,
          }}>{v}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: DIM }}>Loading...</div>
      ) : mechanics.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: DIM }}>No active mechanics found</div>
      ) : (
        <div style={{ background: '#151520', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Mechanic', 'Team', 'Shift Hrs', 'Shift Sessions', 'Job Hrs', 'Job Sessions', ''].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#12121A' }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {mechanics.map((m: any) => (
                <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}
                  onClick={() => loadDetail(m.id)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600 }}>{m.full_name}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: DIM }}>{m.team || '—'}</td>
                  <td style={{ padding: '10px 14px', fontFamily: MONO, fontSize: 13, fontWeight: 700, color: BLUE }}>{fmtHrs(m.shift?.mins || 0)}</td>
                  <td style={{ padding: '10px 14px', fontFamily: MONO, fontSize: 12, color: DIM }}>{m.shift?.count || 0}</td>
                  <td style={{ padding: '10px 14px', fontFamily: MONO, fontSize: 13, fontWeight: 700, color: GREEN }}>{fmtHrs(m.jobs?.mins || 0)}</td>
                  <td style={{ padding: '10px 14px', fontFamily: MONO, fontSize: 12, color: DIM }}>{m.jobs?.count || 0}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ color: BLUE, fontSize: 11, fontWeight: 600 }}>Detail →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
