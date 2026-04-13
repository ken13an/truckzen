'use client'
import { useRef, useState, useEffect, useMemo } from 'react'
import { useTheme } from '@/hooks/useTheme'

interface StatusOption {
  value: string
  label: string
}

interface FilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  statusOptions?: StatusOption[]
  statusValue?: string
  onStatusChange?: (value: string) => void
  dateFrom?: string
  dateTo?: string
  onDateFromChange?: (value: string) => void
  onDateToChange?: (value: string) => void
  theme?: 'light' | 'dark'
  onClearAll?: () => void
}

export default function FilterBar({
  search, onSearchChange, searchPlaceholder = 'Search...',
  statusOptions, statusValue, onStatusChange,
  dateFrom, dateTo, onDateFromChange, onDateToChange,
  theme = 'dark', onClearAll,
}: FilterBarProps) {
  const { tokens: t } = useTheme()
  const [localSearch, setLocalSearch] = useState(search)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => { setLocalSearch(search) }, [search])

  function handleSearch(val: string) {
    setLocalSearch(val)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onSearchChange(val), 300)
  }

  const activeCount = useMemo(() => {
    let count = 0
    if (search.trim()) count++
    if (statusValue && statusValue !== 'all') count++
    if (dateFrom) count++
    if (dateTo) count++
    return count
  }, [search, statusValue, dateFrom, dateTo])

  function clearAll() {
    setLocalSearch('')
    onSearchChange('')
    onStatusChange?.('all')
    onDateFromChange?.('')
    onDateToChange?.('')
    onClearAll?.()
  }

  const inputStyle: React.CSSProperties = {
    padding: '7px 12px',
    background: 'var(--tz-inputBg)',
    border: `1px solid ${'var(--tz-inputBorder)'}`,
    borderRadius: 8,
    fontSize: 12,
    color: 'var(--tz-text)',
    outline: 'none',
    fontFamily: "'Instrument Sans', sans-serif",
    boxSizing: 'border-box',
  }

  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
      padding: '10px 14px', background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-cardBorder)'}`,
      borderRadius: 10, marginBottom: 12,
    }}>
      {/* Filters label */}
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tz-textSecondary)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
        Filters
        {activeCount > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, height: 16, padding: '0 4px', borderRadius: 100, background: 'var(--tz-accent)', color: 'var(--tz-bgLight)', fontSize: 9, fontWeight: 700, marginLeft: 4 }}>{activeCount}</span>}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={'var(--tz-textTertiary)'} strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          value={localSearch}
          onChange={e => handleSearch(e.target.value)}
          placeholder={searchPlaceholder}
          style={{ ...inputStyle, flex: '1 1 200px', minWidth: 180, paddingLeft: 32 }}
        />
      </div>

      {/* Status dropdown */}
      {statusOptions && statusOptions.length > 0 && onStatusChange && (
        <select
          value={statusValue || 'all'}
          onChange={e => onStatusChange(e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer', minWidth: 120 }}
        >
          {statusOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}

      {/* Date From */}
      {onDateFromChange && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--tz-textTertiary)' }}>From</span>
          <input type="date" value={dateFrom || ''} onChange={e => onDateFromChange(e.target.value)}
            style={{ ...inputStyle, padding: '6px 10px', fontSize: 11, cursor: 'pointer', colorScheme: 'light dark' } as React.CSSProperties} />
        </div>
      )}

      {/* Date To */}
      {onDateToChange && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--tz-textTertiary)' }}>To</span>
          <input type="date" value={dateTo || ''} onChange={e => onDateToChange(e.target.value)}
            style={{ ...inputStyle, padding: '6px 10px', fontSize: 11, cursor: 'pointer', colorScheme: 'light dark' } as React.CSSProperties} />
        </div>
      )}

      {/* Clear Filters */}
      {activeCount > 0 && (
        <button onClick={clearAll} style={{
          padding: '6px 12px', background: 'var(--tz-dangerBg)', border: `1px solid ${'var(--tz-danger)'}`,
          borderRadius: 8, fontSize: 11, fontWeight: 600, color: 'var(--tz-danger)',
          cursor: 'pointer', fontFamily: "'Instrument Sans', sans-serif", whiteSpace: 'nowrap',
        }}>
          Clear Filters
        </button>
      )}
    </div>
  )
}
