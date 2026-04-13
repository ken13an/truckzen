'use client'
/**
 * TruckZen — Workplace punch reminder banner for non-mechanic office users.
 *
 * Renders a persistent, obvious "Clock In" reminder on the signed-in
 * dashboard when the current user has no active workplace punch. Hides
 * itself once punched in. Reuses the canonical Sidebar togglePunch() flow
 * (geofence + override handling) via the `tz-request-clock-in` event —
 * no duplicate punch logic here.
 */
import { useEffect, useState } from 'react'
import { AlarmClock } from 'lucide-react'

export default function WorkplacePunchReminder() {
  const [loaded, setLoaded] = useState(false)
  const [punchedIn, setPunchedIn] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/mechanic/work-punch')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!alive) return; setPunchedIn(!!d?.punchedIn); setLoaded(true) })
      .catch(() => { if (alive) setLoaded(true) })

    const onStatus = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail && typeof detail.punchedIn === 'boolean') setPunchedIn(detail.punchedIn)
    }
    window.addEventListener('tz-punch-status', onStatus)
    return () => { alive = false; window.removeEventListener('tz-punch-status', onStatus) }
  }, [])

  if (!loaded || punchedIn) return null

  return (
    <div
      role="alert"
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid var(--tz-danger)',
        borderRadius: 12, padding: '14px 18px', marginBottom: 20,
      }}
    >
      <AlarmClock size={22} color="var(--tz-danger)" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tz-danger)' }}>You are not clocked in</div>
        <div style={{ fontSize: 12, color: 'var(--tz-textSecondary)', marginTop: 2 }}>
          Clock in to start your shift so your hours are recorded.
        </div>
      </div>
      <button
        onClick={() => { try { window.dispatchEvent(new CustomEvent('tz-request-clock-in')) } catch {} }}
        style={{
          padding: '10px 18px', borderRadius: 8, border: 'none',
          background: 'var(--tz-success)', color: 'var(--tz-bgLight)',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
          fontFamily: "'Instrument Sans',sans-serif", whiteSpace: 'nowrap',
        }}
      >
        Clock In
      </button>
    </div>
  )
}
