'use client'
import { useEffect } from 'react'

export default function ComplianceRedirect() {
  useEffect(() => { window.location.href = '/fleet/compliance' }, [])
  return <div style={{ minHeight: '100vh', background: '#060708', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C8BA0', fontSize: 13 }}>Redirecting to Fleet → Compliance...</div>
}
