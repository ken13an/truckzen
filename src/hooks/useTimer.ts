'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { clockIn, clockOut, getActiveClock } from '@/lib/services/timeTracking'
import type { ActiveClock } from '@/types'

export function useTimer(userId: string | undefined) {
  const [activeClock, setActiveClock] = useState<ActiveClock | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [loading, setLoading] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Timer tick
  useEffect(() => {
    if (activeClock?.clocked_in_at) {
      const start = new Date(activeClock.clocked_in_at).getTime()
      const tick = () => setElapsedSec(Math.floor((Date.now() - start) / 1000))
      tick()
      timerRef.current = setInterval(tick, 1000)
      return () => { if (timerRef.current) clearInterval(timerRef.current) }
    } else {
      setElapsedSec(0)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [activeClock?.clocked_in_at])

  // Fetch active clock on mount
  const fetchActive = useCallback(async () => {
    if (!userId) return
    try {
      const data = await getActiveClock(userId)
      setActiveClock(data)
    } catch {}
  }, [userId])

  useEffect(() => { fetchActive() }, [fetchActive])

  const handleClockIn = useCallback(async (soLineId: string, serviceOrderId?: string, shopId?: string, jobDescription?: string, woNumber?: string) => {
    if (!userId) return
    setLoading('clock-in')
    try {
      const entry = await clockIn(soLineId, userId, serviceOrderId, shopId)
      if (entry) {
        setActiveClock({
          id: entry.id,
          clocked_in_at: entry.clocked_in_at,
          so_line_id: soLineId,
          service_order_id: serviceOrderId || '',
          job_description: jobDescription || '',
          wo_number: woNumber || '',
        })
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Clock in failed')
    }
    setLoading(null)
  }, [userId])

  const handleClockOut = useCallback(async () => {
    if (!activeClock?.id) return
    setLoading('clock-out')
    try {
      const result = await clockOut(activeClock.id, userId)
      setActiveClock(null)
      return result
    } catch {
      alert('Clock out failed')
    }
    setLoading(null)
    return null
  }, [activeClock, userId])

  return { activeClock, elapsedSec, loading, clockIn: handleClockIn, clockOut: handleClockOut, fetchActive }
}
