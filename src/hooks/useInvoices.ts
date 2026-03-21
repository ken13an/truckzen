'use client'
import { useState, useEffect, useCallback } from 'react'
import { getInvoices } from '@/lib/services/invoices'
import type { Invoice, InvoiceStatus } from '@/types'

export function useInvoices(shopId: string | undefined, filterStatus?: InvoiceStatus) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!shopId) return
    setLoading(true)
    try {
      const data = await getInvoices(shopId, filterStatus)
      setInvoices(data)
    } catch {}
    setLoading(false)
  }, [shopId, filterStatus])

  useEffect(() => { refresh() }, [refresh])

  return { invoices, loading, refresh }
}
