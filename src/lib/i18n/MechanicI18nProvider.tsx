'use client'
/**
 * TruckZen — Mechanic-only i18n store + hooks.
 *
 * Scope: wraps the mechanic-facing surface only (currently the mechanic
 * dashboard). Uses a tiny module-level subscribe store consumed via
 * useSyncExternalStore so any component inside the mechanic surface can
 * pick up language changes reactively without requiring a parent/child
 * refactor of the dashboard. Persists to the existing users.language
 * column for the signed-in user, and mirrors to localStorage so first
 * paint after refresh/reopen matches before profile loads.
 */
import { useSyncExternalStore } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  MECHANIC_DEFAULT_LANG,
  MECHANIC_DICTIONARIES,
  isSupportedMechanicLang,
  type MechanicLang,
} from './mechanic'

const LS_KEY = 'tz-mechanic-lang'

function readInitial(): MechanicLang {
  if (typeof window === 'undefined') return MECHANIC_DEFAULT_LANG
  try {
    const v = window.localStorage.getItem(LS_KEY)
    if (isSupportedMechanicLang(v)) return v
  } catch {}
  return MECHANIC_DEFAULT_LANG
}

let currentLang: MechanicLang = readInitial()
const listeners = new Set<() => void>()

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

function getSnapshot(): MechanicLang {
  return currentLang
}

function getServerSnapshot(): MechanicLang {
  return MECHANIC_DEFAULT_LANG
}

function emit() {
  listeners.forEach(l => l())
}

/** Adopt an externally-loaded language (e.g. the freshly fetched user profile). */
export function hydrateMechanicLang(lang: unknown) {
  if (!isSupportedMechanicLang(lang)) return
  if (lang === currentLang) return
  currentLang = lang
  try { window.localStorage.setItem(LS_KEY, lang) } catch {}
  emit()
}

/** Change + persist the mechanic language. Resolves after DB write completes. */
export async function changeMechanicLang(lang: MechanicLang): Promise<void> {
  if (!isSupportedMechanicLang(lang)) return
  currentLang = lang
  try { window.localStorage.setItem(LS_KEY, lang) } catch {}
  emit()
  const supabase = createClient()
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('users').update({ language: lang }).eq('id', user.id)
    }
  } catch { /* soft-fail — local state already applied */ }
}

export function useMechanicLang(): MechanicLang {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function useMechanicT(): (key: string) => string {
  const lang = useMechanicLang()
  return (key: string) => {
    const dict = MECHANIC_DICTIONARIES[lang]
    const fallback = MECHANIC_DICTIONARIES[MECHANIC_DEFAULT_LANG]
    return dict[key] ?? fallback[key] ?? key
  }
}
