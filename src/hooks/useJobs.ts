'use client'
import { useState, useEffect, useCallback } from 'react'
import { getMechanicJobs } from '@/lib/services/jobs'
import type { MechanicJob, JobStatus } from '@/types'

export function useJobs(userId: string | undefined) {
  const [jobs, setJobs] = useState<MechanicJob[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<JobStatus | 'all'>('all')

  const refresh = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const data = await getMechanicJobs(userId)
      setJobs(data)
    } catch {}
    setLoading(false)
  }, [userId])

  useEffect(() => { refresh() }, [refresh])

  const filteredJobs = filter === 'all' ? jobs : jobs.filter(j => j.status === filter)

  return { jobs: filteredJobs, allJobs: jobs, loading, filter, setFilter, refresh }
}
