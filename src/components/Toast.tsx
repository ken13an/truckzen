'use client'
import { createContext, useContext, useState, useCallback, useEffect } from 'react'

type ToastType = 'success' | 'error' | 'warning' | 'info'
interface Toast { id: string; type: ToastType; message: string; duration?: number }

const ToastContext = createContext<{ toast: (msg: string, type?: ToastType, duration?: number) => void }>({
  toast: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}

const COLORS: Record<ToastType, { bg: string; border: string; icon: string; text: string }> = {
  success: { bg:'rgba(29,184,112,.1)',  border:'rgba(29,184,112,.3)',  icon:'✓', text:'#00E0B0' },
  error:   { bg:'rgba(217,79,79,.1)',   border:'rgba(217,79,79,.3)',   icon:'✗', text:'#FF5C5C' },
  warning: { bg:'rgba(212,136,42,.1)',  border:'rgba(212,136,42,.3)',  icon:'⚠', text:'#FFB84D' },
  info:    { bg:'rgba(0,224,176,.1)',  border:'rgba(0,224,176,.3)',  icon:'i', text:'#00E0B0' },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: ToastType = 'info', duration = 3500) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(t => [...t, { id, type, message, duration }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
        {toasts.map(t => {
          const c = COLORS[t.type]
          return (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 16px', borderRadius: 10,
              background: c.bg, border: `1px solid ${c.border}`,
              boxShadow: '0 8px 32px rgba(0,0,0,.4)',
              fontFamily: "'Instrument Sans',sans-serif",
              fontSize: 13, color: '#EDEDF0',
              pointerEvents: 'all',
              animation: 'slideIn .2s ease',
              maxWidth: 360, minWidth: 200,
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: c.text, flexShrink: 0 }}>{c.icon}</span>
              <span style={{ flex: 1 }}>{t.message}</span>
              <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                style={{ background: 'none', border: 'none', color: '#9D9DA1', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
            </div>
          )
        })}
      </div>
      <style>{`@keyframes slideIn { from { transform:translateX(100%); opacity:0 } to { transform:none; opacity:1 } }`}</style>
    </ToastContext.Provider>
  )
}
