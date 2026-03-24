'use client'
import { useRef, useState, useEffect, useMemo } from 'react'

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
  const [localSearch, setLocalSearch] = useState(search)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => { setLocalSearch(search) }, [search])

  function handleSearch(val: string) {
    setLocalSearch(val)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onSearchChange(val), 300)
  }

  const isLight = theme === 'light'

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

  const S = {
    bar: {
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      flexWrap: 'wrap' as const,
      padding: '10px 14px',
      background: isLight ? '#fff' : 'rgba(255,255,255,0.03)',
      border: isLight ? '1px solid #E5E7EB' : '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10,
      marginBottom: 12,
    },
    search: {
      flex: '1 1 200px',
      minWidth: 180,
      padding: '7px 12px 7px 32px',
      background: isLight ? '#F9FAFB' : 'rgba(255,255,255,0.06)',
      border: isLight ? '1px solid #E5E7EB' : '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8,
      fontSize: 12,
      color: isLight ? '#1A1A1A' : '#DDE3EE',
      outline: 'none',
      fontFamily: "'Instrument Sans', sans-serif",
      boxSizing: 'border-box' as const,
    },
    select: {
      padding: '7px 12px',
      background: isLight ? '#F9FAFB' : 'rgba(255,255,255,0.06)',
      border: isLight ? '1px solid #E5E7EB' : '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8,
      fontSize: 12,
      color: isLight ? '#374151' : '#DDE3EE',
      outline: 'none',
      fontFamily: "'Instrument Sans', sans-serif",
      cursor: 'pointer',
      minWidth: 120,
    },
    dateInput: {
      padding: '6px 10px',
      background: isLight ? '#F9FAFB' : 'rgba(255,255,255,0.06)',
      border: isLight ? '1px solid #E5E7EB' : '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8,
      fontSize: 11,
      color: isLight ? '#374151' : '#DDE3EE',
      outline: 'none',
      fontFamily: "'Instrument Sans', sans-serif",
      cursor: 'pointer',
      colorScheme: isLight ? 'light' : 'dark',
    } as React.CSSProperties,
    clearBtn: {
      padding: '6px 12px',
      background: 'rgba(239,68,68,0.08)',
      border: '1px solid rgba(239,68,68,0.2)',
      borderRadius: 8,
      fontSize: 11,
      fontWeight: 600,
      color: '#EF4444',
      cursor: 'pointer',
      fontFamily: "'Instrument Sans', sans-serif",
      whiteSpace: 'nowrap' as const,
    },
    badge: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 16,
      height: 16,
      padding: '0 4px',
      borderRadius: 100,
      background: '#1B6EE6',
      color: '#fff',
      fontSize: 9,
      fontWeight: 700,
      marginLeft: 4,
    },
    label: {
      fontSize: 11,
      fontWeight: 600,
      color: isLight ? '#6B7280' : '#7C8BA0',
      whiteSpace: 'nowrap' as const,
      display: 'flex',
      alignItems: 'center',
    },
  }

  return (
    <div style={S.bar}>
      {/* Filters label with active count */}
      <div style={S.label}>
        Filters
        {activeCount > 0 && <span style={S.badge}>{activeCount}</span>}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isLight ? '#9CA3AF' : '#48536A'} strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          value={localSearch}
          onChange={e => handleSearch(e.target.value)}
          placeholder={searchPlaceholder}
          style={S.search}
        />
      </div>

      {/* Status dropdown */}
      {statusOptions && statusOptions.length > 0 && onStatusChange && (
        <select
          value={statusValue || 'all'}
          onChange={e => onStatusChange(e.target.value)}
          style={S.select}
        >
          {statusOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}

      {/* Date From */}
      {onDateFromChange && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10, color: isLight ? '#9CA3AF' : '#48536A' }}>From</span>
          <input
            type="date"
            value={dateFrom || ''}
            onChange={e => onDateFromChange(e.target.value)}
            style={S.dateInput}
          />
        </div>
      )}

      {/* Date To */}
      {onDateToChange && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10, color: isLight ? '#9CA3AF' : '#48536A' }}>To</span>
          <input
            type="date"
            value={dateTo || ''}
            onChange={e => onDateToChange(e.target.value)}
            style={S.dateInput}
          />
        </div>
      )}

      {/* Clear Filters */}
      {activeCount > 0 && (
        <button onClick={clearAll} style={S.clearBtn}>
          Clear Filters
        </button>
      )}
    </div>
  )
}
