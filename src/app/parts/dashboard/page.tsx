'use client'
import { useEffect } from 'react'

export default function PartsDashboardRedirect() {
  useEffect(() => { window.location.replace('/parts') }, [])
  return null
}
