'use client'
import { useEffect } from 'react'

export default function ComplianceRedirect() {
  useEffect(() => { window.location.href = '/fleet/compliance' }, [])
  return <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8E8E93', fontSize: 13 }}>Redirecting to Fleet → Compliance...</div>
}
