'use client'
import { useState, useEffect, useCallback } from 'react'
import { getWorkOrders } from '@/lib/services/workOrders'
import type { WorkOrder, WOStatus } from '@/types'

export function useWorkOrders(shopId: string | undefined, filterStatus?: WOStatus) {
  const [orders, setOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const refresh = useCallback(async () => {
    if (!shopId) return
    setLoading(true)
    try {
      const data = await getWorkOrders(shopId, { status: filterStatus, search: search || undefined })
      setOrders(data)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [shopId, filterStatus, search])

  useEffect(() => { refresh() }, [refresh])

  return { orders, loading, error, search, setSearch, refresh }
}
