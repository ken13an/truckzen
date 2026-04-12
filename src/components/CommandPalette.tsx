'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Wrench, Users2, Truck, Package, User, Building2, Loader2 } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import type { SearchResponse, SearchResult, SearchEntityType } from '@/types/search'
import { motion, AnimatePresence } from 'framer-motion'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

const SECTION_ORDER: { key: SearchEntityType; label: string; icon: any }[] = [
  { key: 'work_order', label: 'Work Orders', icon: Wrench },
  { key: 'customer', label: 'Customers', icon: Users2 },
  { key: 'asset', label: 'Trucks', icon: Truck },
  { key: 'part', label: 'Parts', icon: Package },
  { key: 'employee', label: 'Staff', icon: User },
  { key: 'vendor', label: 'Vendors', icon: Building2 },
]

const STATUS_COLORS: Record<string, (t: any) => string> = {
  draft: t => t.textSecondary,
  open: t => t.accent,
  in_progress: t => t.accent,
  estimate: t => t.warning,
  waiting_parts: t => t.warning,
  done: t => t.success,
  good_to_go: t => t.success,
  void: t => t.danger,
  cancelled: t => t.danger,
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const { tokens: t } = useTheme()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Flat list of all results for keyboard nav
  const flatResults: SearchResult[] = results
    ? SECTION_ORDER.flatMap(s => (results.results || []).filter(r => r.entity_type === s.key))
    : []

  // Reset on open/close
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults(null)
      setError(false)
      setActiveIndex(-1)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Debounced search
  const search = useCallback((q: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (q.length < 2) { setResults(null); setLoading(false); return }
    setLoading(true)
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=5`)
        if (!res.ok) throw new Error()
        const data: SearchResponse = await res.json()
        setResults(data)
        setError(false)
        setActiveIndex(-1)
      } catch {
        setError(true)
        setResults(null)
      } finally {
        setLoading(false)
      }
    }, 200)
  }, [])

  function handleInput(value: string) {
    setQuery(value)
    search(value)
  }

  function navigate(url: string) {
    onClose()
    router.push(url)
  }

  // Keyboard nav
  useEffect(() => {
    if (!isOpen) return
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex(prev => Math.min(prev + 1, flatResults.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex(prev => Math.max(prev - 1, -1))
      }
      if (e.key === 'Enter' && activeIndex >= 0 && flatResults[activeIndex]) {
        e.preventDefault()
        navigate(flatResults[activeIndex].url)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, activeIndex, flatResults])

  // Scroll active into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return
    const el = listRef.current.querySelector(`[data-idx="${activeIndex}"]`)
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (!isOpen) return null

  let globalIdx = -1

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh' }}
          onClick={onClose}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            onClick={e => e.stopPropagation()}
            style={{
              position: 'relative', width: '100%', maxWidth: 640, maxHeight: '70vh',
              background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 14,
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
              boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            }}
          >
            {/* Search input */}
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Wrench size={16} color={t.textTertiary} style={{ flexShrink: 0 }} />
              <input
                ref={inputRef}
                value={query}
                onChange={e => handleInput(e.target.value)}
                placeholder="Search work orders, parts, customers, trucks..."
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  fontSize: 15, color: t.text, fontFamily: 'inherit',
                }}
              />
              {loading && <Loader2 size={16} color={t.textTertiary} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />}
              <span style={{ fontSize: 10, color: t.textTertiary, background: t.bgHover, borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>ESC</span>
            </div>

            {/* Results */}
            <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {/* Before typing */}
              {!query && !results && (
                <div style={{ padding: '32px 20px', textAlign: 'center', color: t.textTertiary, fontSize: 13 }}>
                  Start typing to search across all data
                </div>
              )}

              {/* No results */}
              {query.length >= 2 && !loading && results && results.total === 0 && (
                <div style={{ padding: '32px 20px', textAlign: 'center', color: t.textTertiary, fontSize: 13 }}>
                  No results for &ldquo;{query}&rdquo;
                </div>
              )}

              {/* Error */}
              {error && (
                <div style={{ padding: '32px 20px', textAlign: 'center', color: t.danger, fontSize: 13 }}>
                  Search failed. Try again.
                </div>
              )}

              {/* Grouped results */}
              {results && results.total > 0 && SECTION_ORDER.map(section => {
                const sectionResults = results.results.filter(r => r.entity_type === section.key)
                if (sectionResults.length === 0) return null
                const SectionIcon = section.icon

                return (
                  <div key={section.key}>
                    <div style={{ padding: '10px 20px 4px', fontSize: 10, fontWeight: 600, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <SectionIcon size={11} />
                      {section.label} ({sectionResults.length})
                    </div>
                    {sectionResults.map(result => {
                      globalIdx++
                      const idx = globalIdx
                      const isActive = idx === activeIndex
                      const Icon = section.icon
                      return (
                        <div
                          key={result.id}
                          data-idx={idx}
                          onClick={() => navigate(result.url)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '8px 20px', cursor: 'pointer',
                            background: isActive ? t.bgHover : 'transparent',
                            transition: 'background .1s',
                          }}
                          onMouseEnter={() => setActiveIndex(idx)}
                        >
                          <Icon size={14} color={t.textTertiary} style={{ flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{result.title}</div>
                            <div style={{ fontSize: 11, color: t.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{result.subtitle}</div>
                          </div>
                          {result.status && (
                            <span style={{
                              fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 4, flexShrink: 0,
                              color: (STATUS_COLORS[result.status] || (() => t.textSecondary))(t),
                              background: t.surfaceMuted,
                            }}>
                              {result.status.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {/* Footer hint */}
            <div style={{ padding: '8px 20px', borderTop: `1px solid ${t.border}`, display: 'flex', gap: 16, fontSize: 10, color: t.textTertiary }}>
              <span><b style={{ color: t.textSecondary }}>&uarr;&darr;</b> navigate</span>
              <span><b style={{ color: t.textSecondary }}>&crarr;</b> open</span>
              <span><b style={{ color: t.textSecondary }}>esc</b> close</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
