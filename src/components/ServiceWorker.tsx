'use client'

import { useEffect, useState } from 'react'

// Service Worker registration
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])
  return null
}

// Android / Chrome install prompt
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Check if running inside native shell or already installed
    // Detection methods (strongest first):
    const uaShell = navigator.userAgent.includes('TruckZenNativeShell')
    const windowFlag = !!(window as any).__TRUCKZEN_NATIVE_SHELL__
    const shellParam = new URLSearchParams(window.location.search).get('shell') === 'native'
    const lsFlag = localStorage.getItem('tz_native_shell') === '1'
    if (shellParam || uaShell || windowFlag) localStorage.setItem('tz_native_shell', '1')
    const isNativeShell = uaShell || windowFlag || shellParam || lsFlag
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true
      || isNativeShell
    setIsStandalone(standalone)
    if (standalone) return

    // iOS detection
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    setIsIOS(ios)

    // Dismiss if already dismissed recently
    const dismissed = localStorage.getItem('pwa-install-dismissed')
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 86400000) return

    // Android / Chrome: capture beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // iOS: show after 30s if not installed
    if (ios) {
      const timer = setTimeout(() => setShow(true), 30000)
      return () => { clearTimeout(timer); window.removeEventListener('beforeinstallprompt', handler) }
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') setShow(false)
      setDeferredPrompt(null)
    }
  }

  function dismiss() {
    setShow(false)
    localStorage.setItem('pwa-install-dismissed', String(Date.now()))
  }

  if (isStandalone || !show) return null

  return (
    <div style={{
      position: 'fixed', bottom: 20, left: 20, right: 20, zIndex: 9999,
      background: '#0D0F12', border: '1px solid #1A1D23', borderRadius: 14,
      padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: '0 8px 32px rgba(0,0,0,.6)', maxWidth: 440, margin: '0 auto',
    }}>
      <img src="/icon-48.png" alt="TruckZen" width={40} height={40} style={{ borderRadius: 8 }}/>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#F0F4FF' }}>Install TruckZen</div>
        <div style={{ fontSize: 12, color: '#7C8BA0', marginTop: 2 }}>
          {isIOS ? 'Tap Share, then "Add to Home Screen"' : 'Add to your home screen for quick access'}
        </div>
      </div>
      {!isIOS && (
        <button onClick={handleInstall} style={{
          padding: '8px 16px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
          background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap',
        }}>Install</button>
      )}
      <button onClick={dismiss} style={{
        background: 'none', border: 'none', color: '#48536A', cursor: 'pointer', fontSize: 18, padding: 4, lineHeight: 1,
      }}>x</button>
    </div>
  )
}
