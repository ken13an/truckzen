'use client'
import { useEffect } from 'react'

export default function ComplianceRedirect() {
  useEffect(() => { window.location.href = '/fleet/compliance' }, [])
  return <div style={{ minHeight: '100vh', background: '#08080C', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9D9DA1', fontSize: 13 }}>Redirecting to Fleet → Compliance...</div>
}
