'use client'
import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useTheme } from '@/hooks/useTheme'

type ToastType = 'success' | 'error' | 'warning' | 'info'
interface Toast { id: string; type: ToastType; message: string; duration?: number }

const ToastContext = createContext<{ toast: (msg: string, type?: ToastType, duration?: number) => void }>({
  toast: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { tokens: tk } = useTheme()
  const [toasts, setToasts] = useState<Toast[]>([])

  const TOAST_COLORS: Record<ToastType, { bg: string; border: string; icon: string; text: string }> = {
    success: { bg: tk.successBg, border: tk.success, icon: '\u2713', text: tk.success },
    error:   { bg: tk.dangerBg,  border: tk.danger,  icon: '\u2717', text: tk.danger },
    warning: { bg: tk.warningBg, border: tk.warning, icon: '\u26A0', text: tk.warning },
    info:    { bg: tk.accentBg,  border: tk.accent,  icon: 'i',      text: tk.accentLight },
  }

  const toast = useCallback((message: string, type: ToastType = 'info', duration = 3500) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(t => [...t, { id, type, message, duration }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
        {toasts.map(item => {
          const c = TOAST_COLORS[item.type]
          return (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 16px', borderRadius: 10,
              background: c.bg, border: `1px solid ${c.border}`,
              boxShadow: '0 8px 32px rgba(0,0,0,.4)',
              fontFamily: "'Instrument Sans',sans-serif",
              fontSize: 13, color: tk.text,
              pointerEvents: 'all',
              animation: 'slideIn .2s ease',
              maxWidth: 360, minWidth: 200,
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: c.text, flexShrink: 0 }}>{c.icon}</span>
              <span style={{ flex: 1 }}>{item.message}</span>
              <button onClick={() => setToasts(prev => prev.filter(x => x.id !== item.id))}
                style={{ background: 'none', border: 'none', color: tk.textTertiary, cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>&times;</button>
            </div>
          )
        })}
      </div>
      <style>{`@keyframes slideIn { from { transform:translateX(100%); opacity:0 } to { transform:none; opacity:1 } }`}</style>
    </ToastContext.Provider>
  )
}
