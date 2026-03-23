'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { Send, MessageSquare } from 'lucide-react'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const BLUE = '#1B6EE6', GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F', MUTED = '#7C8BA0'
const typeColor: Record<string, string> = { comment: BLUE, status_change: AMBER, repair_created: GREEN, inspection_submitted: GREEN, fault_detected: RED, issue_reported: AMBER, reminder_triggered: RED }

export default function ActivityFeedPage() {
  const supabase = createClient()
  const [shopId, setShopId] = useState('')
  const [userId, setUserId] = useState('')
  const [userName, setUserName] = useState('')
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [posting, setPosting] = useState(false)

  const loadActivities = useCallback(async (sid: string) => {
    const { data } = await supabase.from('maint_activity_log').select('*').eq('shop_id', sid).order('created_at', { ascending: false }).limit(100)
    setActivities(data || [])
  }, [supabase])

  useEffect(() => {
    getCurrentUser(supabase).then(async (p: any) => {
      if (!p) { window.location.href = '/login'; return }
      setShopId(p.shop_id)
      setUserId(p.id)
      setUserName(p.full_name || 'Unknown')
      await loadActivities(p.shop_id)
      setLoading(false)
    })
  }, [])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!shopId) return
    const iv = setInterval(() => loadActivities(shopId), 30000)
    return () => clearInterval(iv)
  }, [shopId, loadActivities])

  async function postComment() {
    if (!comment.trim()) return
    setPosting(true)
    await fetch('/api/maintenance/crud', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'maint_activity_log', shop_id: shopId, user_id: userId, user_name: userName, activity_type: 'comment', message: comment.trim() }),
    })
    setComment('')
    setPosting(false)
    await loadActivities(shopId)
  }

  return (
    <div style={{ background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: FONT, padding: 24 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF', marginBottom: 16 }}>Activity Feed</div>

      {/* Post comment */}
      <div style={{ background: '#161B24', border: '1px solid rgba(255,255,255,.055)', borderRadius: 12, padding: 16, marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Post a comment or update..." style={{ width: '100%', padding: '10px 12px', background: '#1C2130', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 12, color: '#DDE3EE', outline: 'none', fontFamily: FONT, minHeight: 48, resize: 'vertical' as const, boxSizing: 'border-box' }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment() } }} />
        </div>
        <button onClick={postComment} disabled={posting || !comment.trim()} style={{ padding: '10px 16px', background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, fontFamily: FONT, minHeight: 40 }}>
          <Send size={14} /> Post
        </button>
      </div>

      {/* Feed */}
      {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#48536A' }}>Loading...</div> :
      activities.length === 0 ? (
        <div style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 40, textAlign: 'center' }}>
          <MessageSquare size={28} color="#48536A" style={{ marginBottom: 8 }} />
          <div style={{ color: '#48536A', fontSize: 13 }}>No activity yet. Post a comment or start working!</div>
        </div>
      ) : activities.map(a => (
        <div key={a.id} style={{ background: '#161B24', border: '1px solid rgba(255,255,255,.04)', borderRadius: 10, padding: '12px 16px', marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${typeColor[a.activity_type] || BLUE}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: typeColor[a.activity_type] || BLUE }}>
                {(a.user_name || 'S')[0].toUpperCase()}
              </div>
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#F0F4FF' }}>{a.user_name || 'System'}</span>
                <span style={{ fontSize: 10, color: MUTED, marginLeft: 6 }}>{a.activity_type?.replace(/_/g, ' ')}</span>
              </div>
            </div>
            <span style={{ fontSize: 10, color: MUTED }}>{new Date(a.created_at).toLocaleString()}</span>
          </div>
          <div style={{ fontSize: 12, color: '#DDE3EE', marginLeft: 36 }}>{a.message}</div>
          {a.entity_type && a.entity_label && (
            <div style={{ fontSize: 10, color: BLUE, marginLeft: 36, marginTop: 4 }}>{a.entity_type}: {a.entity_label}</div>
          )}
        </div>
      ))}
    </div>
  )
}
