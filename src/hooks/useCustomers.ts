'use client'
import { useState, useEffect, useCallback } from 'react'
import { getCustomers } from '@/lib/services/customers'
import type { Customer } from '@/types'

export function useCustomers(shopId: string | undefined) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const refresh = useCallback(async () => {
    if (!shopId) return
    setLoading(true)
    try {
      const data = await getCustomers(shopId, search || undefined)
      setCustomers(data)
    } catch {}
    setLoading(false)
  }, [shopId, search])

  useEffect(() => { refresh() }, [refresh])

  return { customers, loading, search, setSearch, refresh }
}
