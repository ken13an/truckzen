'use client'
import { useEffect, useRef, useState } from 'react'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const BLUE = '#4D9EFF'
const MUTED = '#7C8BA0'
const DIM = '#48536A'
const BORDER = 'rgba(255,255,255,.08)'

interface PageControlsProps {
  total: number
  page: number
  perPage: number
  onPageChange: (page: number) => void
  onPerPageChange: (perPage: number) => void
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
}

export default function PageControls({
  total, page, perPage, onPageChange, onPerPageChange,
  searchValue, onSearchChange, searchPlaceholder = 'Search...',
}: PageControlsProps) {
  const totalPages = perPage === 0 ? 1 : Math.ceil(total / (perPage || 25))
  const start = total === 0 ? 0 : (page - 1) * (perPage || total) + 1
  const end = perPage === 0 ? total : Math.min(page * perPage, total)

  // Debounced search
  const [localSearch, setLocalSearch] = useState(searchValue)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => { setLocalSearch(searchValue) }, [searchValue])

  function handleSearchInput(val: string) {
    setLocalSearch(val)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => { onSearchChange(val); onPageChange(1) }, 300)
  }

  // Page numbers to show
  function getPages(): (number | '...')[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages: (number | '...')[] = [1]
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('...')
    if (totalPages > 1) pages.push(totalPages)
    return pages
  }

  return (
    <>
      {/* Search bar */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={DIM} strokeWidth="2" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          value={localSearch}
          onChange={e => handleSearchInput(e.target.value)}
          placeholder={searchPlaceholder}
          style={{ width: '100%', maxWidth: 360, padding: '8px 12px 8px 34px', background: 'rgba(255,255,255,.06)', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12, color: '#DDE3EE', outline: 'none', fontFamily: FONT, boxSizing: 'border-box' }}
        />
      </div>
    </>
  )
}

export function PageFooter({
  total, page, perPage, onPageChange, onPerPageChange,
}: Omit<PageControlsProps, 'searchValue' | 'onSearchChange' | 'searchPlaceholder'>) {
  const totalPages = perPage === 0 ? 1 : Math.ceil(total / (perPage || 25))
  const start = total === 0 ? 0 : (page - 1) * (perPage || total) + 1
  const end = perPage === 0 ? total : Math.min(page * perPage, total)

  function getPages(): (number | '...')[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages: (number | '...')[] = [1]
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('...')
    if (totalPages > 1) pages.push(totalPages)
    return pages
  }

  if (total === 0) return null

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', marginTop: 8 }}>
      <div style={{ fontSize: 11, color: MUTED, fontFamily: MONO }}>
        Showing {start}–{end} of {total}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Per page selector */}
        <select
          value={perPage}
          onChange={e => { onPerPageChange(parseInt(e.target.value)); onPageChange(1) }}
          style={{ padding: '4px 8px', background: 'rgba(255,255,255,.06)', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 10, color: MUTED, fontFamily: MONO, outline: 'none' }}
        >
          {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}/page</option>)}
          <option value={0}>All</option>
        </select>

        {/* Page navigation */}
        {totalPages > 1 && (
          <>
            <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}
              style={navBtn(page <= 1)}>Prev</button>
            {getPages().map((p, i) =>
              p === '...' ? <span key={`e${i}`} style={{ color: DIM, fontSize: 10 }}>...</span> : (
                <button key={p} onClick={() => onPageChange(p as number)}
                  style={{ ...navBtn(false), background: page === p ? BLUE : 'transparent', color: page === p ? '#fff' : MUTED, fontWeight: page === p ? 700 : 400 }}>
                  {p}
                </button>
              )
            )}
            <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
              style={navBtn(page >= totalPages)}>Next</button>
          </>
        )}
      </div>
    </div>
  )
}

const navBtn = (disabled: boolean): React.CSSProperties => ({
  padding: '4px 8px', background: 'rgba(255,255,255,.06)', border: `1px solid ${BORDER}`,
  borderRadius: 4, fontSize: 10, color: disabled ? DIM : MUTED, cursor: disabled ? 'default' : 'pointer',
  fontFamily: FONT, opacity: disabled ? 0.5 : 1,
})
