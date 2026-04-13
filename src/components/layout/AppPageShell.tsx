'use client'
/**
 * TruckZen — Canonical App Page Shell
 *
 * Single source of truth for the authenticated page surface that sits inside
 * the AppShell + Sidebar chrome. Every page that needs a consistent background,
 * width, and padding MUST use this shell instead of its own inline `<div>`.
 *
 * Why it exists:
 *   Before this, each page painted its own `<div style={{ background: 'var(--tz-bg)', minHeight: '100vh' }}>`
 *   over the AppShell. Because `_t` was pinned to `THEME.dark`, the warm-mode toggle
 *   had no effect on page backgrounds. This component reads `useTheme()` so the
 *   surface responds to the mode toggle correctly.
 *
 * Width variants:
 *   - 'full'     → edge-to-edge (tables, dashboards, operational views)
 *   - 'wide'     → maxWidth 1400 (reports, lists)
 *   - 'readable' → maxWidth 900  (form/detail pages)
 *   - 'narrow'   → maxWidth 640  (single-form pages like add-part, add-customer)
 */
import type { ReactNode } from 'react'
import { useTheme } from '@/hooks/useTheme'

export type PageWidth = 'full' | 'wide' | 'readable' | 'narrow'

const WIDTH_MAX: Record<PageWidth, number | string> = {
  full: '100%',
  wide: 1400,
  readable: 900,
  narrow: 640,
}

interface AppPageShellProps {
  children: ReactNode
  width?: PageWidth
  padding?: number | string
  /**
   * Override the base surface color. Default `bg` follows the theme toggle.
   * Rare — only for full-bleed monitor views.
   */
  surface?: 'bg' | 'bgCard' | 'bgElevated'
  style?: React.CSSProperties
}

export default function AppPageShell({
  children,
  width = 'full',
  padding = 24,
  surface = 'bg',
  style,
}: AppPageShellProps) {
  const { tokens: t } = useTheme()
  const bg = surface === 'bgCard' ? 'var(--tz-bgCard)' : surface === 'bgElevated' ? 'var(--tz-bgElevated)' : 'var(--tz-bg)'
  return (
    <div
      style={{
        background: bg,
        color: 'var(--tz-text)',
        minHeight: '100vh',
        width: '100%',
        fontFamily: "'Instrument Sans', sans-serif",
        ...style,
      }}
    >
      <div
        style={{
          maxWidth: WIDTH_MAX[width],
          margin: '0 auto',
          padding,
        }}
      >
        {children}
      </div>
    </div>
  )
}
