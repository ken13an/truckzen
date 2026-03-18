'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const SHORTCUTS: Record<string, { path?: string; action?: string; label: string }> = {
  'n':      { path: '/orders/new',       label: 'New Service Order' },
  'f':      { path: '/fleet/new',        label: 'Add Vehicle' },
  'p':      { path: '/parts/new',        label: 'Add Part' },
  'i':      { path: '/invoices',         label: 'Invoices' },
  'g':      { path: '/floor',            label: 'Shop Floor' },
  'd':      { path: '/dashboard',        label: 'Dashboard' },
  '?':      { action: 'help',            label: 'Show shortcuts' },
}

export function useKeyboardShortcuts() {
  const router = useRouter()

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Don't trigger when typing in inputs
      const tag = (e.target as HTMLElement).tagName
      if (['INPUT','TEXTAREA','SELECT'].includes(tag)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const key = e.key.toLowerCase()

      if (key === 'escape') {
        // Close any open modals — dispatch custom event
        window.dispatchEvent(new CustomEvent('truckzen:close'))
        return
      }

      if (key === '/') {
        e.preventDefault()
        // Focus search input if present
        const search = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement
        if (search) { search.focus(); return }
      }

      const shortcut = SHORTCUTS[key]
      if (shortcut?.path) {
        e.preventDefault()
        router.push(shortcut.path)
      }

      if (shortcut?.action === 'help') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('truckzen:shortcuts'))
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [router])
}

// Shortcut hint component — shows in UI corners
export function ShortcutHint({ keys, label }: { keys: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#48536A' }}>
      {keys.split('+').map((k, i) => (
        <kbd key={i} style={{ padding: '1px 5px', background: '#1C2130', border: '1px solid rgba(255,255,255,.1)', borderRadius: 4, fontSize: 10, fontFamily: 'monospace', color: '#7C8BA0' }}>
          {k}
        </kbd>
      ))}
      <span>{label}</span>
    </span>
  )
}

// Shortcuts reference panel
export function ShortcutsPanel() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px' }}>
      {Object.entries(SHORTCUTS).map(([key, info]) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <kbd style={{ padding: '2px 7px', background: '#1C2130', border: '1px solid rgba(255,255,255,.1)', borderRadius: 5, fontSize: 11, fontFamily: 'monospace', color: '#4D9EFF', minWidth: 24, textAlign: 'center' }}>
            {key}
          </kbd>
          <span style={{ fontSize: 12, color: '#7C8BA0' }}>{info.label}</span>
        </div>
      ))}
      {[['/', 'Focus search'], ['ESC', 'Close / cancel']].map(([key, label]) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <kbd style={{ padding: '2px 7px', background: '#1C2130', border: '1px solid rgba(255,255,255,.1)', borderRadius: 5, fontSize: 11, fontFamily: 'monospace', color: '#4D9EFF', minWidth: 24, textAlign: 'center' }}>
            {key}
          </kbd>
          <span style={{ fontSize: 12, color: '#7C8BA0' }}>{label}</span>
        </div>
      ))}
    </div>
  )
}
