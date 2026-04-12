'use client'
import { useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Inter', -apple-system, sans-serif"

const PHASE_ORDER = ['Foundation', 'Work Orders', 'Kiosk', 'Portal', 'Customers', 'Mechanics', 'Team', 'Settings', 'Future']
const PHASE_COLOR: Record<string, string> = {
  Foundation: '#16A34A', 'Work Orders': '#1D6FE8', Kiosk: '#7C3AED', Portal: '#0891B2',
  Customers: '#EA580C', Mechanics: '#DC2626', Team: '#D97706', Settings: '#6B7280', Future: '#9CA3AF',
}

export default function BuildProgressPage() {
  const { tokens: th } = useTheme()
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const res = await fetch('/api/build-progress')
    if (res.ok) setTasks(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggle(id: string, done: boolean) {
    await fetch('/api/build-progress', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, done: !done }) })
    load()
  }

  const total = tasks.length
  const done = tasks.filter(t => t.done).length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  const grouped: Record<string, any[]> = {}
  for (const t of tasks) {
    if (!grouped[t.phase]) grouped[t.phase] = []
    grouped[t.phase].push(t)
  }

  if (loading) return <div style={{ minHeight: '100vh', background: th.bg, fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>Loading...</div>

  return (
    <div style={{ minHeight: '100vh', background: th.bg, fontFamily: FONT, color: '#EDEDF0', padding: 24 }}>
      <a href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#EDEDF0', textDecoration: 'none', marginBottom: 20 }}>
        <ChevronLeft size={16} strokeWidth={2} /> Dashboard
      </a>

      <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>TruckZen Build Progress</div>
      <div style={{ fontSize: 14, color: '#9CA3AF', marginBottom: 24 }}>{done} of {total} tasks complete ({pct}%)</div>

      {/* Overall progress bar */}
      <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, marginBottom: 32, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, #1D6FE8, #16A34A)`, borderRadius: 4, transition: 'width 0.5s' }} />
      </div>

      {/* Phase sections */}
      {PHASE_ORDER.filter(p => grouped[p]).map(phase => {
        const items = grouped[phase]
        const phaseDone = items.filter((t: any) => t.done).length
        const phaseTotal = items.length
        const phaseColor = PHASE_COLOR[phase] || '#6B7280'

        return (
          <div key={phase} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 4, height: 20, borderRadius: 2, background: phaseColor }} />
              <span style={{ fontSize: 16, fontWeight: 700 }}>{phase}</span>
              <span style={{ fontSize: 12, color: '#9CA3AF' }}>{phaseDone}/{phaseTotal}</span>
              <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: phaseTotal > 0 ? `${(phaseDone / phaseTotal) * 100}%` : '0%', background: phaseColor, borderRadius: 2 }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
              {items.map((t: any) => (
                <div key={t.id} onClick={() => toggle(t.id, t.done)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                    background: t.done ? 'rgba(22,163,74,0.06)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${t.done ? 'rgba(22,163,74,0.15)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = t.done ? 'rgba(22,163,74,0.1)' : 'rgba(255,255,255,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = t.done ? 'rgba(22,163,74,0.06)' : 'rgba(255,255,255,0.03)')}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                    background: t.done ? '#16A34A' : 'transparent',
                    border: t.done ? 'none' : '2px solid rgba(255,255,255,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, color: '#fff', fontWeight: 700,
                  }}>
                    {t.done && '✓'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.done ? '#9CA3AF' : '#EDEDF0', textDecoration: t.done ? 'line-through' : 'none' }}>{t.label}</div>
                    {t.note && <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>{t.note}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      <div style={{ textAlign: 'center', fontSize: 11, color: '#6B7280', marginTop: 32 }}>Click any task to toggle its status. Changes save immediately.</div>
    </div>
  )
}
