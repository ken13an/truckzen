'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

const FONT = "'Instrument Sans', sans-serif"

export default function KioskCodePage() {
  const params = useParams()
  const code = (params.code as string)?.toLowerCase()
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!code) { setStatus('error'); setErrorMsg('No kiosk code provided'); return }

    fetch(`/api/kiosk/lookup?code=${encodeURIComponent(code)}`)
      .then(res => {
        if (!res.ok) throw new Error(res.status === 404 ? 'Kiosk not found' : 'Kiosk is not available')
        return res.json()
      })
      .then(data => {
        // Redirect to the existing kiosk page with shop param
        window.location.href = `/kiosk?shop=${data.shop_id}&code=${code}`
      })
      .catch(err => {
        setStatus('error')
        setErrorMsg(err.message || 'Kiosk not available')
      })
  }, [code])

  if (status === 'error') {
    return (
      <div style={{
        background: '#0C0C12', color: '#EDEDF0', fontFamily: FONT, minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center', maxWidth: 400, padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>X</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>Kiosk Not Available</h1>
          <p style={{ fontSize: 14, color: '#71717A', margin: '0 0 24px' }}>{errorMsg}</p>
          <p style={{ fontSize: 12, color: '#48536A' }}>
            If you believe this is an error, contact your shop administrator.
          </p>
        </div>
      </div>
    )
  }

  // Loading state
  return (
    <div style={{
      background: '#0C0C12', color: '#EDEDF0', fontFamily: FONT, minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>TRUCKZEN</div>
        <p style={{ fontSize: 14, color: '#71717A' }}>Loading kiosk...</p>
      </div>
    </div>
  )
}
