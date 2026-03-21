'use client'
import { useState, useRef, useCallback } from 'react'

export function useSearch(onSearch: (query: string) => void, debounceMs: number = 300) {
  const [query, setQuery] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = useCallback((value: string) => {
    setQuery(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onSearch(value), debounceMs)
  }, [onSearch, debounceMs])

  const clear = useCallback(() => {
    setQuery('')
    if (timerRef.current) clearTimeout(timerRef.current)
    onSearch('')
  }, [onSearch])

  return { query, setQuery: handleChange, clear }
}
