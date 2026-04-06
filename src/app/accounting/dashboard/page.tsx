'use client'
import { useEffect } from 'react'

export default function AccountingDashboardRedirect() {
  useEffect(() => { window.location.replace('/accounting') }, [])
  return null
}
