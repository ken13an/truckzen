'use client'
import { useEffect, useRef } from 'react'

export function useRefresh(callback: () => void, intervalMs: number = 15000, enabled: boolean = true) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled) return
    const interval = setInterval(() => callbackRef.current(), intervalMs)
    return () => clearInterval(interval)
  }, [intervalMs, enabled])
}
