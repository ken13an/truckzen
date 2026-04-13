'use client'

import { createContext, ReactNode, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { THEME, ThemeMode, ThemeTokens } from '@/lib/config/colors'

interface ThemeContextValue {
  mode: ThemeMode
  tokens: ThemeTokens
  toggleMode: () => void
  setMode: (mode: ThemeMode) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'tz-theme-mode'

function getInitialMode(): ThemeMode {
  if (typeof window === 'undefined') return 'dark'
  // Prefer the data attribute set by the blocking script in layout.tsx — that
  // matches the attribute the server output, so the first client render is
  // consistent with the DOM produced by the pre-hydration script.
  try {
    const attr = document.documentElement.getAttribute('data-tz-mode')
    if (attr === 'light' || attr === 'dark') return attr
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'dark'
  } catch {
    return 'dark'
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [requestedMode, setRequestedModeState] = useState<ThemeMode>(getInitialMode)
  const [mounted, setMounted] = useState(false)

  // After mount, re-read the attribute and commit the client-side truth.
  // This guarantees we are not stuck on server's default-'dark' state after
  // a hydration mismatch silently resolved in favor of server output.
  useEffect(() => {
    try {
      const attr = document.documentElement.getAttribute('data-tz-mode')
      const saved = (attr === 'light' || attr === 'dark') ? attr : window.localStorage.getItem(STORAGE_KEY)
      if (saved === 'light' || saved === 'dark') {
        setRequestedModeState(prev => (prev === saved ? prev : saved))
      }
    } catch {
      // ignore
    }
    setMounted(true)
  }, [])

  const mode: ThemeMode = requestedMode
  const tokens = THEME[mode]

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-tz-mode', mode)
    document.body.setAttribute('data-tz-mode', mode)
    // Keep CSS variables in sync so shell surfaces using var(--tz-*) flip
    // immediately on toggle, regardless of React subtree re-render timing.
    const root = document.documentElement
    for (const k of Object.keys(tokens)) {
      root.style.setProperty(`--tz-${k}`, (tokens as Record<string, string>)[k])
    }
    document.body.style.background = tokens.bg
    document.body.style.backgroundColor = tokens.bg
    document.body.style.color = tokens.text
    try {
      window.localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      // ignore storage write failures
    }
  }, [mode, tokens])

  const toggleMode = () => {
    setRequestedModeState(prev => (prev === 'dark' ? 'light' : 'dark'))
  }

  const setMode = (newMode: ThemeMode) => {
    setRequestedModeState(newMode)
  }

  const value = useMemo(
    () => ({ mode, tokens, toggleMode, setMode }),
    [mode, tokens]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
