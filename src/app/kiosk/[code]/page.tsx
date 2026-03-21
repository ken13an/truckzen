'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

const FONT = "'Instrument Sans', sans-serif"

export default function KioskCodePage() {
  const params = useParams()
  const code = (params.code as string)?.toLowerCase()
  const [shopData, setShopData] = useState<{ shop_id: string; shop_name: string } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!code) { setError('No kiosk code provided'); return }

    fetch(`/api/kiosk/lookup?code=${encodeURIComponent(code)}`)
      .then(res => {
        if (!res.ok) throw new Error(res.status === 404 ? 'Kiosk not found' : 'Kiosk is not available')
        return res.json()
      })
      .then(data => {
        setShopData(data)
        // Use a hard redirect with the full URL to avoid Next.js client-side routing issues
        window.location.href = window.location.origin + '/kiosk?shop=' + data.shop_id
      })
      .catch(err => {
        setError(err.message || 'Kiosk not available')
      })
  }, [code])

  if (error) {
    return (
      <div style={{ background: '#0C0C12', color: '#EDEDF0', fontFamily: FONT, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: 400, padding: 40 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>Kiosk Not Available</h1>
          <p style={{ fontSize: 14, color: '#71717A', margin: '0 0 24px' }}>{error}</p>
          <p style={{ fontSize: 12, color: '#48536A' }}>Contact your shop administrator for the correct kiosk URL.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#0C0C12', color: '#EDEDF0', fontFamily: FONT, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>TRUCKZEN</div>
        <p style={{ fontSize: 14, color: '#71717A' }}>Loading kiosk...</p>
      </div>
    </div>
  )
}
