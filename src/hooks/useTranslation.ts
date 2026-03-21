'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// In-memory cache shared across all hook instances
let translationCache: Record<string, Record<string, string>> = {}
let cacheLoaded = false

export function useTranslation() {
  const [lang, setLang] = useState('en')
  const [ready, setReady] = useState(cacheLoaded)
  const supabase = createClient()

  // Load user language + translations on mount
  useEffect(() => {
    async function init() {
      // Get user language
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase.from('users').select('language').eq('id', user.id).single()
          if (profile?.language) setLang(profile.language)
        }
      } catch {}

      // Load translations if not cached
      if (!cacheLoaded) {
        try {
          const { data } = await supabase.from('translations').select('language, key, value')
          if (data) {
            const cache: Record<string, Record<string, string>> = {}
            for (const row of data) {
              if (!cache[row.language]) cache[row.language] = {}
              cache[row.language][row.key] = row.value
            }
            translationCache = cache
            cacheLoaded = true
          }
        } catch {}
      }
      setReady(true)
    }
    init()
  }, [])

  // Translation function — returns translated string or English fallback or key
  const t = useCallback((key: string): string => {
    return translationCache[lang]?.[key] || translationCache['en']?.[key] || key
  }, [lang])

  // Change language
  const changeLanguage = useCallback(async (newLang: string) => {
    setLang(newLang)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('users').update({ language: newLang }).eq('id', user.id)
      }
    } catch {}
  }, [supabase])

  return { t, lang, changeLanguage, ready }
}
