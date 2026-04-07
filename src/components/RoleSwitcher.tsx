'use client'
import { useState, useEffect, useRef } from 'react'
import { ROLE_LABEL, ROLE_COLOR } from '@/lib/permissions'

const IMPERSONATE_ROLES = [
  { key: 'owner', label: 'Owner', team: null },
  { key: 'service_writer', label: 'Service Writer', team: null },
  { key: 'shop_manager', label: 'Shop Manager', team: null },
  { key: 'parts_manager', label: 'Parts Department', team: null },
  { key: 'accountant', label: 'Accounting', team: null },
  { key: 'fleet_manager', label: 'Fleet Manager', team: null },
  { key: 'maintenance_manager', label: 'Maintenance Manager', team: null },
  { key: 'office_admin', label: 'Office Admin', team: null },
  { key: 'dispatcher', label: 'Dispatcher', team: null },
  { key: 'technician', label: 'Mechanic', team: null },
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

  // Role → landing page map (must match dashboard DEPT_REDIRECTS)
  const ROLE_LANDINGS: Record<string, string> = {
    technician: '/mechanic/dashboard', lead_tech: '/mechanic/dashboard', maintenance_technician: '/mechanic/dashboard',
    fleet_manager: '/fleet', dispatcher: '/fleet',
    maintenance_manager: '/maintenance',
    parts_manager: '/parts',
    accountant: '/accounting',
    shop_manager: '/shop-floor', service_writer: '/work-orders',
  }

  async function switchRole(role: string | null) {
    setSwitching(true)
    const res = await fetch('/api/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: role || 'reset' }),
    })
    if (!res.ok) { setSwitching(false); return }
    // Small delay to ensure DB write is committed before the new page reads it
    await new Promise(r => setTimeout(r, 300))
    const effectiveRole = role === actualRole ? null : role
    const landing = effectiveRole ? (ROLE_LANDINGS[effectiveRole] || '/dashboard') : '/dashboard'
    window.location.href = landing
  }

  const displayRole = current || actualRole
  const displayLabel = current
    ? IMPERSONATE_ROLES.find(r => r.key === current)?.label || ROLE_LABEL[current] || current
    : ROLE_LABEL[actualRole] || actualRole
  const color = ROLE_COLOR[displayRole] || '#7C8BA0'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
        background: current ? 'rgba(245,158,11,.08)' : '#0D0F12',
        border: current ? '1px solid rgba(245,158,11,.3)' : '1px solid #1A1D23',
        borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 600,
        color: current ? '#F59E0B' : color,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
        {current ? `Impersonating: ${displayLabel}` : displayLabel}
        <span style={{ fontSize: 8, color: '#48536A', marginLeft: 2 }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 36, right: 0, width: 220,
          background: '#0D0F12', border: '1px solid #1A1D23', borderRadius: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,.5)', zIndex: 999, overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #1A1D23', fontSize: 9, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Switch Role
          </div>

          {/* Reset to actual role */}
          {current && (
            <button onClick={() => switchRole(null)} disabled={switching}
              style={{ ...S.item, color: '#22C55E', fontWeight: 700, borderBottom: '1px solid #1A1D23' }}>
              ↩ Back to {ROLE_LABEL[actualRole]}
            </button>
          )}

          {IMPERSONATE_ROLES.map((r, i) => {
            const isActive = displayRole === r.key && (!r.team || r.label.includes(r.team || ''))
            return (
              <button key={i} onClick={() => switchRole(r.key)} disabled={switching}
                style={{ ...S.item, color: isActive ? '#4D9EFF' : '#DDE3EE', background: isActive ? 'rgba(29,111,232,.06)' : 'transparent' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: ROLE_COLOR[r.key] || '#7C8BA0', flexShrink: 0 }} />
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
