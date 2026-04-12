'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import KioskFlow from '@/components/KioskFlow'
import { useTheme } from '@/hooks/useTheme'

export default function KioskCodePage() {
  const { tokens: t } = useTheme()
  const params = useParams()
  const code = (params.code as string)?.toLowerCase()
  const [shopId, setShopId] = useState('')
  const [shopName, setShopName] = useState('')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!code) { setStatus('error'); setErrorMsg('No kiosk code'); return }

    fetch(`/api/kiosk/lookup?code=${encodeURIComponent(code)}`)
      .then(res => {
        if (!res.ok) throw new Error(res.status === 404 ? 'Kiosk not found' : 'Kiosk is not available')
        return res.json()
      })
      .then(data => {
        setShopId(data.shop_id)
        setShopName(data.shop_name)
        setStatus('ready')
      })
      .catch(err => {
        setStatus('error')
        setErrorMsg(err.message || 'Kiosk not available')
      })
  }, [code])

  if (status === 'loading') {
    return <div style={{ background: t.bg, color: '#EDEDF0', fontFamily: "'Instrument Sans', sans-serif", minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>TRUCKZEN</div>
        <p style={{ fontSize: 14, color: '#71717A' }}>Loading kiosk...</p>
      </div>
    </div>
  }

  if (status === 'error') {
    return <div style={{ background: t.bg, color: '#EDEDF0', fontFamily: "'Instrument Sans', sans-serif", minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 400, padding: 40 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>Kiosk Not Available</h1>
        <p style={{ fontSize: 14, color: '#71717A', margin: '0 0 24px' }}>{errorMsg}</p>
        <p style={{ fontSize: 12, color: t.textTertiary }}>Contact your shop administrator.</p>
      </div>
    </div>
  }

  return <KioskFlow shopId={shopId} shopName={shopName} kioskCode={code} />
}
