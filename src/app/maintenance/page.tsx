'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { Truck, CalendarClock, ShieldAlert, Fuel, AlertTriangle, Users2, Plus } from 'lucide-react'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const BLUE = '#1B6EE6', GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F', MUTED = '#7C8BA0'

interface DashStats {
  activeRepairs: number
  overduePMs: number
  expiringCDLs: number
  fuelSpendMonth: number
  openDefects: number
  totalDrivers: number
}

export default function MaintenanceDashboard() {
  const supabase = createClient()
  const [stats, setStats] = useState<DashStats>({ activeRepairs: 0, overduePMs: 0, expiringCDLs: 0, fuelSpendMonth: 0, openDefects: 0, totalDrivers: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { window.location.href = '/login'; return }
      try {
        const res = await fetch(`/api/maintenance/dashboard?shop_id=${profile.shop_id}`)
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      } catch {}
      setLoading(false)
    }
    load()
  }, [])

  const cards = [
    { label: 'Active Road Repairs', value: stats.activeRepairs, color: BLUE, icon: Truck, href: '/maintenance/repairs' },
    { label: 'Overdue PMs', value: stats.overduePMs, color: RED, icon: CalendarClock, href: '/maintenance/pm' },
    { label: 'Expiring CDLs (30d)', value: stats.expiringCDLs, color: AMBER, icon: ShieldAlert, href: '/maintenance/drivers' },
    { label: 'Fuel Spend This Month', value: `$${stats.fuelSpendMonth.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, color: GREEN, icon: Fuel, href: '/maintenance/fuel' },
    { label: 'Open Defects', value: stats.openDefects, color: RED, icon: AlertTriangle, href: '/maintenance/inspections' },
    { label: 'Total Drivers', value: stats.totalDrivers, color: BLUE, icon: Users2, href: '/maintenance/drivers' },
  ]

  const quickActions = [
    { label: 'New Road Repair', href: '/maintenance/repairs/new' },
    { label: 'Schedule PM', href: '/maintenance/pm/new' },
    { label: 'Add Fuel Entry', href: '/maintenance/fuel/new' },
    { label: 'New Inspection', href: '/maintenance/inspections/new' },
  ]

  return (
    <div style={{ background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: FONT, padding: 24 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF', marginBottom: 20 }}>Maintenance</div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        {cards.map(c => {
          const Icon = c.icon
          return (
            <a key={c.label} href={c.href} style={{ textDecoration: 'none' }}>
              <div style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '16px 18px', cursor: 'pointer', transition: 'border-color .15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = c.color + '44')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,.08)')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Icon size={14} color={c.color} />
                  <span style={{ fontSize: 10, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: MONO }}>{c.label}</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: loading ? MUTED : c.color }}>{loading ? '...' : c.value}</div>
              </div>
            </a>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: MONO, marginBottom: 10 }}>Quick Actions</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {quickActions.map(a => (
            <a key={a.label} href={a.href} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 18px', background: 'linear-gradient(135deg,#1B6EE6,#1248B0)',
              border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700,
              textDecoration: 'none', fontFamily: FONT,
            }}>
              <Plus size={14} /> {a.label}
            </a>
          ))}
        </div>
      </div>

      {/* Empty state */}
      <div style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 40, textAlign: 'center', color: '#48536A', fontSize: 13 }}>
        Data will appear here once maintenance records are imported or created.
      </div>
    </div>
  )
}
