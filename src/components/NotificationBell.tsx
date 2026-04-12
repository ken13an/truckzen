'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/hooks/useTheme'

export default function NotificationBell({ userId }: { userId: string }) {
  const { tokens: t } = useTheme()
  const supabase = createClient()
  const [notifications, setNotifications] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!userId) return
    loadNotifications()
    const iv = setInterval(loadNotifications, 30000)
    return () => clearInterval(iv)
  }, [userId])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Real-time subscription for new notifications
  useEffect(() => {
    if (!userId) return
    const channel = supabase.channel(`bell-notifs:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => {
        loadNotifications()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  async function loadNotifications() {
    const res = await fetch('/api/notifications?limit=20')
    if (res.ok) {
      const json = await res.json()
      setNotifications(json.notifications || [])
    }
  }

  async function markRead(id: string) {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'mark_read' }),
    })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  async function dismiss(id: string) {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'dismiss' }),
    })
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  async function markAllRead() {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'all', action: 'mark_read' }),
    })
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const unreadCount = notifications.filter(n => !n.read).length

  function timeAgo(date: string) {
    const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000)
    if (mins < 1) return 'now'
    if (mins < 60) return `${mins}m`
    if (mins < 1440) return `${Math.floor(mins / 60)}h`
    return `${Math.floor(mins / 1440)}d`
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 6, position: 'relative', color: t.textSecondary, fontSize: 18,
      }}>
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 0, background: t.danger, color: t.bgLight,
            fontSize: 9, fontWeight: 700, borderRadius: 10, padding: '1px 5px', minWidth: 14, textAlign: 'center',
          }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 36, right: 0, width: 340, maxHeight: 420, overflowY: 'auto',
          background: t.bgCard, border: `1px solid ${t.cardBorder}`, borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,.5)', zIndex: 999,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${t.border}` }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: t.accentLight, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Mark all read</button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: t.textTertiary, fontSize: 12 }}>No notifications</div>
          ) : (
            notifications.map(n => (
              <div key={n.id} style={{
                display: 'flex', alignItems: 'flex-start', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,.03)',
                background: n.read ? 'transparent' : 'rgba(29,111,232,.04)',
              }}>
                <a href={n.link || '#'} onClick={() => markRead(n.id)} style={{
                  flex: 1, textDecoration: 'none', minWidth: 0,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 12, fontWeight: n.read ? 400 : 600, color: n.read ? t.textSecondary : t.text, lineHeight: 1.4 }}>{n.title}</div>
                    <span style={{ fontSize: 10, color: t.textTertiary, whiteSpace: 'nowrap', marginLeft: 8 }}>{timeAgo(n.created_at)}</span>
                  </div>
                  {n.body && <div style={{ fontSize: 11, color: t.textTertiary, marginTop: 2, lineHeight: 1.4 }}>{n.body}</div>}
                  {!n.read && <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.accent, marginTop: 4 }} />}
                </a>
                <button onClick={e => { e.stopPropagation(); dismiss(n.id) }} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: t.textTertiary, fontSize: 14,
                  padding: '2px 4px', marginLeft: 4, flexShrink: 0, lineHeight: 1,
                }} title="Dismiss">&times;</button>
              </div>
            ))
          )}
          <a href="/dashboard" style={{ display: 'block', padding: '10px 16px', textAlign: 'center', fontSize: 11, color: t.accentLight, textDecoration: 'none', borderTop: `1px solid ${t.border}`, fontWeight: 600 }}>
            View all on dashboard
          </a>
        </div>
      )}
    </div>
  )
}
