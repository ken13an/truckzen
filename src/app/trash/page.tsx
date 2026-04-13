'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

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
  const { tokens: t } = useTheme()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [items, setItems] = useState<TrashItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState<TrashItem | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const perPage = 25

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
    <div style={{ minHeight: '100vh', background: 'var(--tz-bg)', color: 'var(--tz-text)', fontFamily: FONT, padding: '32px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Trash2 size={28} color={'var(--tz-textSecondary)'} />
        <h1 style={{ fontFamily: HEADING, fontSize: 32, color: 'var(--tz-text)', letterSpacing: 1, margin: 0 }}>Trash</h1>
        <span style={{ fontSize: 12, color: 'var(--tz-textSecondary)', fontFamily: MONO, marginLeft: 8 }}>Items are permanently deleted after 45 days</span>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: `1px solid ${'var(--tz-border)'}`, paddingBottom: 0 }}>
        {TABS.map((tab, i) => (
          <button
            key={tab.filter}
            onClick={() => setActiveTab(i)}
            style={{
              background: activeTab === i ? 'var(--tz-bgCard)' : 'transparent',
              color: activeTab === i ? 'var(--tz-text)' : 'var(--tz-textSecondary)',
              border: 'none',
              borderBottom: activeTab === i ? `2px solid ${'var(--tz-accent)'}` : '2px solid transparent',
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
              <span style={{ background: 'var(--tz-border)', color: 'var(--tz-textSecondary)', fontSize: 10, fontFamily: MONO, padding: '1px 6px', borderRadius: 100 }}>{tabCounts[i]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '10px 16px', background: 'var(--tz-bgCard)', borderRadius: 10, border: `1px solid ${'var(--tz-border)'}` }}>
          <span style={{ fontSize: 12, color: 'var(--tz-text)', fontWeight: 600 }}>{selected.size} selected</span>
          <button onClick={async () => {
            if (!confirm(`Permanently delete ${selected.size} items? This cannot be undone.`)) return
            setActionLoading('bulk')
            for (const key of selected) {
              const [table, id] = key.split('::')
              await fetch(`/api/trash?table=${table}&id=${id}&shop_id=${user.shop_id}&user_id=${user.id}`, { method: 'DELETE' })
            }
            setItems(prev => prev.filter(i => !selected.has(`${i.table}::${i.id}`)))
            setSelected(new Set())
            setActionLoading(null)
          }} disabled={actionLoading === 'bulk'} style={{ background: 'var(--tz-danger)', color: 'var(--tz-bgLight)', border: 'none', padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            {actionLoading === 'bulk' ? 'Deleting...' : `Delete ${selected.size} Forever`}
          </button>
          <button onClick={() => setSelected(new Set())} style={{ background: 'transparent', color: 'var(--tz-textSecondary)', border: `1px solid ${'var(--tz-border)'}`, padding: '6px 14px', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>Clear</button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--tz-textSecondary)' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Trash2 size={48} color={'var(--tz-border)'} style={{ marginBottom: 16 }} />
          <div style={{ color: 'var(--tz-textSecondary)', fontSize: 14 }}>Trash is empty</div>
        </div>
      ) : (
        <div style={{ background: 'var(--tz-bgCard)', borderRadius: 12, border: `1px solid ${'var(--tz-border)'}`, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '32px 1.5fr 120px 180px 100px 160px', gap: 12, padding: '12px 20px', borderBottom: `1px solid ${'var(--tz-border)'}`, fontSize: 10, fontWeight: 700, color: 'var(--tz-textSecondary)', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: MONO }}>
            <div><input type="checkbox" checked={filtered.slice((page - 1) * perPage, page * perPage).every(i => selected.has(`${i.table}::${i.id}`))} onChange={e => { const pageItems = filtered.slice((page - 1) * perPage, page * perPage); const newSel = new Set(selected); if (e.target.checked) pageItems.forEach(i => newSel.add(`${i.table}::${i.id}`)); else pageItems.forEach(i => newSel.delete(`${i.table}::${i.id}`)); setSelected(newSel) }} /></div>
            <div>Item</div>
            <div>Type</div>
            <div>Deleted At</div>
            <div>Days Left</div>
            <div style={{ textAlign: 'right' }}>Actions</div>
          </div>

          {/* Rows */}
          {filtered.slice((page - 1) * perPage, page * perPage).map(item => (
            <div
              key={`${item.table}-${item.id}`}
              style={{
                display: 'grid', gridTemplateColumns: '32px 1.5fr 120px 180px 100px 160px', gap: 12,
                padding: '12px 20px', borderBottom: `1px solid ${'var(--tz-border)'}`,
                alignItems: 'center', fontSize: 13,
              }}
            >
              <div><input type="checkbox" checked={selected.has(`${item.table}::${item.id}`)} onChange={e => { const key = `${item.table}::${item.id}`; const newSel = new Set(selected); if (e.target.checked) newSel.add(key); else newSel.delete(key); setSelected(newSel) }} /></div>
              <div>
                <div style={{ color: 'var(--tz-text)', fontWeight: 600 }}>{item.name}</div>
                {item.details?.description && <div style={{ color: 'var(--tz-textSecondary)', fontSize: 11, marginTop: 2 }}>{item.details.description}</div>}
                {item.details?.company_name && item.type !== 'Customer' && <div style={{ color: 'var(--tz-textSecondary)', fontSize: 11, marginTop: 2 }}>{item.details.company_name}</div>}
              </div>
              <div>
                <span style={{ background: 'var(--tz-border)', color: 'var(--tz-textSecondary)', fontSize: 10, padding: '3px 8px', borderRadius: 6, fontFamily: MONO }}>{item.type}</span>
              </div>
              <div style={{ color: 'var(--tz-textSecondary)', fontSize: 12, fontFamily: MONO }}>
                {new Date(item.deleted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                {' '}
                {new Date(item.deleted_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div>
                <span style={{
                  color: item.days_remaining < 7 ? 'var(--tz-danger)' : item.days_remaining < 14 ? 'var(--tz-warning)' : 'var(--tz-textSecondary)',
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
                    background: 'rgba(217,79,79,.12)', color: 'var(--tz-danger)', border: 'none',
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

      {/* Pagination */}
      {filtered.length > perPage && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', marginTop: 12, fontSize: 12, color: 'var(--tz-textSecondary)' }}>
          <span>{filtered.length} items · page {page} of {Math.ceil(filtered.length / perPage)}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${'var(--tz-border)'}`, background: 'transparent', color: page <= 1 ? 'var(--tz-textSecondary)' : 'var(--tz-text)', cursor: page <= 1 ? 'default' : 'pointer', fontSize: 11, fontWeight: 600 }}>Prev</button>
            <button disabled={page >= Math.ceil(filtered.length / perPage)} onClick={() => setPage(p => p + 1)} style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${'var(--tz-border)'}`, background: 'transparent', color: page >= Math.ceil(filtered.length / perPage) ? 'var(--tz-textSecondary)' : 'var(--tz-text)', cursor: page >= Math.ceil(filtered.length / perPage) ? 'default' : 'pointer', fontSize: 11, fontWeight: 600 }}>Next</button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#1A1F2B', borderRadius: 16, padding: 32, maxWidth: 420, width: '90%', border: `1px solid ${'var(--tz-border)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <AlertTriangle size={22} color={'var(--tz-danger)'} />
              <h3 style={{ margin: 0, color: 'var(--tz-text)', fontSize: 16 }}>Permanently Delete?</h3>
            </div>
            <p style={{ color: 'var(--tz-textSecondary)', fontSize: 13, lineHeight: 1.6, margin: '0 0 24px' }}>
              This will permanently delete <strong style={{ color: 'var(--tz-text)' }}>{confirmDelete.name}</strong> ({confirmDelete.type}).
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{ background: 'var(--tz-border)', color: 'var(--tz-textSecondary)', border: 'none', padding: '8px 20px', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => permanentDelete(confirmDelete)}
                disabled={actionLoading === confirmDelete.id}
                style={{ background: 'var(--tz-danger)', color: 'var(--tz-bgLight)', border: 'none', padding: '8px 20px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: actionLoading === confirmDelete.id ? 0.5 : 1 }}
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
