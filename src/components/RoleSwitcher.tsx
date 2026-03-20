'use client'
import { useState, useEffect, useRef } from 'react'
import { ROLE_LABEL, ROLE_COLOR } from '@/lib/permissions'

const IMPERSONATE_ROLES = [
  { key: 'owner', label: 'Owner', team: null },
  { key: 'service_writer', label: 'Service Writer', team: null },
  { key: 'technician', label: 'Mechanic — Team A', team: 'A' },
  { key: 'technician', label: 'Mechanic — Team B', team: 'B' },
  { key: 'technician', label: 'Mechanic — Team C', team: 'C' },
  { key: 'technician', label: 'Mechanic — Team D', team: 'D' },
  { key: 'shop_manager', label: 'Floor Supervisor', team: null },
  { key: 'parts_manager', label: 'Parts Department', team: null },
  { key: 'accountant', label: 'Accounting', team: null },
  { key: 'fleet_manager', label: 'Fleet Manager', team: null },
]

export default function RoleSwitcher({ userId, actualRole, impersonateRole }: {
  userId: string
  actualRole: string
  impersonateRole: string | null
}) {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState(impersonateRole)
  const [switching, setSwitching] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function switchRole(role: string | null) {
    setSwitching(true)
    await fetch('/api/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, role: role || 'reset' }),
    })
    setCurrent(role === actualRole ? null : role)
    setOpen(false)
    setSwitching(false)
    window.location.reload()
  }

  const displayRole = current || actualRole
  const displayLabel = current
    ? IMPERSONATE_ROLES.find(r => r.key === current)?.label || ROLE_LABEL[current] || current
    : ROLE_LABEL[actualRole] || actualRole
  const color = ROLE_COLOR[displayRole] || '#8E8E93'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
        background: current ? 'rgba(245,158,11,.08)' : '#0A0A0A',
        border: current ? '1px solid rgba(245,158,11,.3)' : '1px solid #2A2A2A',
        borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 600,
        color: current ? '#FFD60A' : color,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
        {current ? `Impersonating: ${displayLabel}` : displayLabel}
        <span style={{ fontSize: 8, color: '#8E8E93', marginLeft: 2 }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 36, right: 0, width: 220,
          background: '#0A0A0A', border: '1px solid #2A2A2A', borderRadius: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,.5)', zIndex: 999, overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #2A2A2A', fontSize: 9, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Switch Role
          </div>

          {/* Reset to actual role */}
          {current && (
            <button onClick={() => switchRole(null)} disabled={switching}
              style={{ ...S.item, color: '#0A84FF', fontWeight: 700, borderBottom: '1px solid #2A2A2A' }}>
              ↩ Back to {ROLE_LABEL[actualRole]}
            </button>
          )}

          {IMPERSONATE_ROLES.map((r, i) => {
            const isActive = displayRole === r.key && (!r.team || r.label.includes(r.team || ''))
            return (
              <button key={i} onClick={() => switchRole(r.key)} disabled={switching}
                style={{ ...S.item, color: isActive ? '#0A84FF' : '#F5F5F7', background: isActive ? 'rgba(0,224,176,.06)' : 'transparent' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: ROLE_COLOR[r.key] || '#8E8E93', flexShrink: 0 }} />
                {r.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

const S = {
  item: {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px',
    border: 'none', cursor: 'pointer', fontSize: 12, textAlign: 'left' as const,
    fontFamily: 'inherit', background: 'transparent',
  },
}
