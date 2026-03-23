'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react'

const BG = '#060708', CARD = '#161B24', BORDER = 'rgba(255,255,255,.055)'
const TEXT = '#DDE3EE', MUTED = '#7C8BA0', WHITE = '#F0F4FF', BLUE = '#4D9EFF'
const RED = '#D94F4F', AMBER = '#D4882A'
const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const HEADING = "'Bebas Neue',sans-serif"

const ALLOWED_ROLES = ['owner', 'gm', 'it_person', 'shop_manager', 'floor_supervisor', 'service_writer', 'office_admin']

const TABS = [
  { label: 'All', filter: 'all' },
  { label: 'Work Orders', filter: 'Work Order' },
  { label: 'Customers', filter: 'Customer' },
  { label: 'Trucks', filter: 'Truck' },
  { label: 'Parts', filter: 'Part' },
  { label: 'Staff', filter: 'Staff' },
  { label: 'Other', filter: 'other' },
]

const OTHER_TYPES = ['Service Request', 'Estimate', 'Invoice', 'Purchase Order', 'Parts Request', 'Time Entry', 'Kiosk Check-in']

interface TrashItem {
  id: string
  table: string
  type: string
  name: string
  details: Record<string, any>
  deleted_at: string
  days_remaining: number
}

export default function TrashPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [items, setItems] = useState<TrashItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState<TrashItem | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser(supabase)
      if (!profile) { window.location.href = '/login'; return }
      if (!ALLOWED_ROLES.includes(profile.role)) { window.location.href = '/dashboard'; return }
      setUser(profile)
      await fetchTrash(profile.shop_id)
    }
    load()
  }, [])

  async function fetchTrash(shopId: string) {
    setLoading(true)
    const res = await fetch(`/api/trash?shop_id=${shopId}`)
    const json = await res.json()
    setItems(json.data || [])
    setLoading(false)
  }

  async function restoreItem(item: TrashItem) {
    if (!user) return
    setActionLoading(item.id)
    await fetch('/api/trash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: item.table, id: item.id, shop_id: user.shop_id, user_id: user.id }),
    })
    setItems(prev => prev.filter(i => i.id !== item.id))
    setActionLoading(null)
  }

  async function permanentDelete(item: TrashItem) {
    if (!user) return
    setActionLoading(item.id)
    await fetch(`/api/trash?table=${item.table}&id=${item.id}&shop_id=${user.shop_id}&user_id=${user.id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== item.id))
    setConfirmDelete(null)
    setActionLoading(null)
  }

  const filtered = items.filter(item => {
    const tab = TABS[activeTab]
    if (tab.filter === 'all') return true
    if (tab.filter === 'other') return OTHER_TYPES.includes(item.type)
    return item.type === tab.filter
  })

  const tabCounts = TABS.map(tab => {
    if (tab.filter === 'all') return items.length
    if (tab.filter === 'other') return items.filter(i => OTHER_TYPES.includes(i.type)).length
    return items.filter(i => i.type === tab.filter).length
  })

  if (!user) return null

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: FONT, padding: '32px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Trash2 size={28} color={MUTED} />
        <h1 style={{ fontFamily: HEADING, fontSize: 32, color: WHITE, letterSpacing: 1, margin: 0 }}>Trash</h1>
        <span style={{ fontSize: 12, color: MUTED, fontFamily: MONO, marginLeft: 8 }}>Items are permanently deleted after 45 days</span>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: `1px solid ${BORDER}`, paddingBottom: 0 }}>
        {TABS.map((tab, i) => (
          <button
            key={tab.filter}
            onClick={() => setActiveTab(i)}
            style={{
              background: activeTab === i ? CARD : 'transparent',
              color: activeTab === i ? WHITE : MUTED,
              border: 'none',
              borderBottom: activeTab === i ? `2px solid ${BLUE}` : '2px solid transparent',
              padding: '10px 18px',
              fontSize: 12,
              fontWeight: activeTab === i ? 700 : 400,
              cursor: 'pointer',
              fontFamily: FONT,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all .15s',
            }}
          >
            {tab.label}
            {tabCounts[i] > 0 && (
              <span style={{ background: 'rgba(255,255,255,.08)', color: MUTED, fontSize: 10, fontFamily: MONO, padding: '1px 6px', borderRadius: 100 }}>{tabCounts[i]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: MUTED }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Trash2 size={48} color='rgba(255,255,255,.1)' style={{ marginBottom: 16 }} />
          <div style={{ color: MUTED, fontSize: 14 }}>Trash is empty</div>
        </div>
      ) : (
        <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 120px 180px 100px 160px', gap: 12, padding: '12px 20px', borderBottom: `1px solid ${BORDER}`, fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: MONO }}>
            <div>Item</div>
            <div>Type</div>
            <div>Deleted At</div>
            <div>Days Left</div>
            <div style={{ textAlign: 'right' }}>Actions</div>
          </div>

          {/* Rows */}
          {filtered.map(item => (
            <div
              key={`${item.table}-${item.id}`}
              style={{
                display: 'grid', gridTemplateColumns: '1.5fr 120px 180px 100px 160px', gap: 12,
                padding: '12px 20px', borderBottom: `1px solid ${BORDER}`,
                alignItems: 'center', fontSize: 13,
              }}
            >
              <div>
                <div style={{ color: WHITE, fontWeight: 600 }}>{item.name}</div>
                {item.details?.description && <div style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>{item.details.description}</div>}
                {item.details?.company_name && item.type !== 'Customer' && <div style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>{item.details.company_name}</div>}
              </div>
              <div>
                <span style={{ background: 'rgba(255,255,255,.06)', color: MUTED, fontSize: 10, padding: '3px 8px', borderRadius: 6, fontFamily: MONO }}>{item.type}</span>
              </div>
              <div style={{ color: MUTED, fontSize: 12, fontFamily: MONO }}>
                {new Date(item.deleted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                {' '}
                {new Date(item.deleted_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div>
                <span style={{
                  color: item.days_remaining < 7 ? RED : item.days_remaining < 14 ? AMBER : MUTED,
                  fontWeight: item.days_remaining < 7 ? 700 : 400,
                  fontFamily: MONO,
                  fontSize: 12,
                }}>
                  {item.days_remaining}d
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => restoreItem(item)}
                  disabled={actionLoading === item.id}
                  style={{
                    background: 'rgba(29,184,112,.12)', color: '#1DB870', border: 'none',
                    padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    opacity: actionLoading === item.id ? 0.5 : 1,
                  }}
                >
                  <RotateCcw size={12} /> Restore
                </button>
                <button
                  onClick={() => setConfirmDelete(item)}
                  disabled={actionLoading === item.id}
                  style={{
                    background: 'rgba(217,79,79,.12)', color: RED, border: 'none',
                    padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    opacity: actionLoading === item.id ? 0.5 : 1,
                  }}
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#1A1F2B', borderRadius: 16, padding: 32, maxWidth: 420, width: '90%', border: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <AlertTriangle size={22} color={RED} />
              <h3 style={{ margin: 0, color: WHITE, fontSize: 16 }}>Permanently Delete?</h3>
            </div>
            <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.6, margin: '0 0 24px' }}>
              This will permanently delete <strong style={{ color: WHITE }}>{confirmDelete.name}</strong> ({confirmDelete.type}).
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{ background: 'rgba(255,255,255,.06)', color: MUTED, border: 'none', padding: '8px 20px', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => permanentDelete(confirmDelete)}
                disabled={actionLoading === confirmDelete.id}
                style={{ background: RED, color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: actionLoading === confirmDelete.id ? 0.5 : 1 }}
              >
                {actionLoading === confirmDelete.id ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
