'use client'

import { createContext, ReactNode, useLayoutEffect, useMemo, useState } from 'react'
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
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'dark'
  } catch {
    return 'dark'
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [requestedMode, setRequestedModeState] = useState<ThemeMode>(getInitialMode)

  // Safety lock: force active rendered mode to dark until Phase 2D migrates all components
  const mode: ThemeMode = 'dark'
  const tokens = THEME[mode]

  useLayoutEffect(() => {
    document.body.style.background = tokens.bg
    document.body.style.backgroundColor = tokens.bg
    document.body.style.color = tokens.text
    try {
      window.localStorage.setItem(STORAGE_KEY, requestedMode)
    } catch {
      // ignore storage write failures
    }
  }, [requestedMode, tokens])

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
