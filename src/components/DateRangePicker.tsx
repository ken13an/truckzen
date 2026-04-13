'use client'
import { useState, useEffect } from 'react'
import { THEME } from '@/lib/config/colors'
import { useTheme } from '@/hooks/useTheme'
const _t = THEME.dark

const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This Week' },
  { key: 'last_week', label: 'Last Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'this_quarter', label: 'This Quarter' },
  { key: 'last_quarter', label: 'Last Quarter' },
  { key: 'this_year', label: 'This Year' },
  { key: 'last_year', label: 'Last Year' },
  { key: 'all', label: 'Since Day One' },
]

function calcRange(key: string): { from: string; to: string } {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate()
  const fmt = (dt: Date) => dt.toISOString().split('T')[0]

  switch (key) {
    case 'today':
      return { from: today, to: today }
    case 'yesterday': {
      const yd = new Date(y, m, d - 1)
      return { from: fmt(yd), to: fmt(yd) }
    }
    case 'this_week': {
      const day = now.getDay()
      const mon = new Date(y, m, d - (day === 0 ? 6 : day - 1))
      return { from: fmt(mon), to: today }
    }
    case 'last_week': {
      const day = now.getDay()
      const thisMon = new Date(y, m, d - (day === 0 ? 6 : day - 1))
      const lastMon = new Date(thisMon); lastMon.setDate(lastMon.getDate() - 7)
      const lastSun = new Date(thisMon); lastSun.setDate(lastSun.getDate() - 1)
      return { from: fmt(lastMon), to: fmt(lastSun) }
    }
    case 'this_month':
      return { from: fmt(new Date(y, m, 1)), to: today }
    case 'last_month':
      return { from: fmt(new Date(y, m - 1, 1)), to: fmt(new Date(y, m, 0)) }
    case 'this_quarter': {
      const qStart = new Date(y, Math.floor(m / 3) * 3, 1)
      return { from: fmt(qStart), to: today }
    }
    case 'last_quarter': {
      const qStart = new Date(y, Math.floor(m / 3) * 3 - 3, 1)
      const qEnd = new Date(y, Math.floor(m / 3) * 3, 0)
      return { from: fmt(qStart), to: fmt(qEnd) }
    }
    case 'this_year':
      return { from: `${y}-01-01`, to: today }
    case 'last_year':
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` }
    case 'all':
      return { from: '2015-01-01', to: today } // Far enough back to capture all data
    default:
      return { from: fmt(new Date(y, m, 1)), to: today }
  }
}

function formatLabel(from: string, to: string): string {
  if (!from || !to) return '—'
  const f = new Date(from + 'T00:00:00')
  const t = new Date(to + 'T00:00:00')
  if (isNaN(f.getTime()) || isNaN(t.getTime())) return '—'
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const fStr = f.toLocaleDateString('en-US', opts)
  const tStr = t.toLocaleDateString('en-US', { ...opts, year: 'numeric' })
  return from === to ? tStr : `${fStr} — ${tStr}`
}

interface Props {
  onChange: (from: string, to: string, label: string) => void
  defaultPreset?: string
}

export default function DateRangePicker({ onChange, defaultPreset = 'this_month' }: Props) {
  const { tokens: t } = useTheme()
  const [active, setActive] = useState(defaultPreset)
  const [showCustom, setShowCustom] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  useEffect(() => {
    const { from, to } = calcRange(defaultPreset)
    onChange(from, to, PRESETS.find(p => p.key === defaultPreset)?.label || 'This Month')
  }, [])

  function selectPreset(key: string) {
    setActive(key)
    setShowCustom(false)
    const { from, to } = calcRange(key)
    onChange(from, to, PRESETS.find(p => p.key === key)?.label || key)
  }

  function applyCustom() {
    if (!customFrom || !customTo) return
    setActive('custom')
    onChange(customFrom, customTo, formatLabel(customFrom, customTo))
  }

  const { from, to } = active === 'custom' ? { from: customFrom, to: customTo } : calcRange(active)

  return (
    <div>
      {/* Preset buttons */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {PRESETS.map(p => {
          const isActive = active === p.key
          return (
            <button key={p.key} onClick={() => selectPreset(p.key)} style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: isActive ? '1px solid rgba(29,111,232,.3)' : `1px solid ${t.border}`,
              background: isActive ? 'rgba(29,111,232,.1)' : 'transparent',
              color: isActive ? t.accentLight : t.textSecondary,
              fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}>
              {p.label}
            </button>
          )
        })}
        <button onClick={() => { setShowCustom(!showCustom); setActive('custom') }} style={{
          padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          border: active === 'custom' ? '1px solid rgba(29,111,232,.3)' : `1px solid ${t.border}`,
          background: active === 'custom' ? 'rgba(29,111,232,.1)' : 'transparent',
          color: active === 'custom' ? t.accentLight : t.textSecondary,
          fontFamily: 'inherit',
        }}>
          Custom
        </button>
      </div>

      {/* Custom range inputs */}
      {showCustom && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: t.textSecondary }}>From:</span>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
          <span style={{ fontSize: 12, color: t.textSecondary }}>To:</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
          <button onClick={applyCustom} disabled={!customFrom || !customTo}
            style={{ padding: '6px 16px', borderRadius: 6, background: t.accent, color: t.bgLight, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: !customFrom || !customTo ? 0.4 : 1 }}>
            Apply
          </button>
        </div>
      )}

      {/* Selected range label */}
      <div style={{ fontSize: 11, color: t.textTertiary }}>
        Showing: {formatLabel(from || '', to || '')}
      </div>
    </div>
  )
}
