'use client'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

// These routes show full-screen with NO sidebar
const FULL_SCREEN = ['/login', '/setup', '/kiosk', '/pay', '/portal', '/waiting', '/forgot-password', '/reset-password', '/tech']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  useKeyboardShortcuts()

  const isFullScreen = FULL_SCREEN.some(r => pathname?.startsWith(r))

  if (isFullScreen) {
    return <>{children}</>
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#060708' }}>
      <Sidebar/>
      <main style={{ flex: 1, minWidth: 0, overflowX: 'hidden' }}>
        {children}
      </main>
    </div>
  )
}
