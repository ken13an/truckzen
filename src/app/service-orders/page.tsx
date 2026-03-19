'use client'
import { useEffect } from 'react'

export default function ServiceOrdersRedirect() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab')
    window.location.href = tab ? `/orders?tab=${tab}` : '/orders'
  }, [])
  return <div style={{ minHeight: '100vh', background: '#060708', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C8BA0', fontSize: 13 }}>Loading service orders...</div>
}
