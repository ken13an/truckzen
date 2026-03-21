'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { Search, X } from 'lucide-react'

const PLAN_LABELS: Record<string, string> = { truckzen: 'TruckZen', truckzen_pro: 'Pro', enterprise: 'Enterprise' }

export default function PlatformShops() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [shops, setShops] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [planFilter, setPlanFilter] = useState('all')
  const [editShop, setEditShop] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    async function load() {
      const u = await getCurrentUser(supabase)
      if (!u) return
      setUser(u)
      await fetchShops(u.id)
      setLoading(false)
    }
    load()
  }, [])

  async function fetchShops(userId: string, s?: string, st?: string, p?: string) {
    const params = new URLSearchParams({ user_id: userId })
    if (s || search) params.set('search', s ?? search)
    if ((st ?? statusFilter) !== 'all') params.set('status', st ?? statusFilter)
    if ((p ?? planFilter) !== 'all') params.set('plan', p ?? planFilter)

    const res = await fetch(`/api/platform-admin/shops?${params}`)
    if (res.ok) setShops(await res.json())
  }

  async function handleSearch(val: string) {
    setSearch(val)
    if (user) await fetchShops(user.id, val)
  }

  async function handleFilterChange(type: 'status' | 'plan', val: string) {
    if (type === 'status') { setStatusFilter(val); if (user) await fetchShops(user.id, search, val, planFilter) }
    else { setPlanFilter(val); if (user) await fetchShops(user.id, search, statusFilter, val) }
  }

  async function handleSaveEdit() {
    if (!editShop || !user) return
    setSaving(true)
    const res = await fetch('/api/platform-admin/shops', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, shop_id: editShop.id, name: editShop.name, status: editShop.status, subscription_plan: editShop.subscription_plan, trial_ends_at: editShop.trial_ends_at, notes: editShop.notes, address: editShop.address, email: editShop.email, phone: editShop.phone }),
    })
    setSaving(false)
    if (res.ok) { flash('Shop updated'); setEditShop(null); await fetchShops(user.id) }
    else flash('Failed to save')
  }

  async function handleSuspend(shop: any) {
    if (!user || !confirm(`Suspend ${shop.name}? Shop users will see "Account suspended".`)) return
    await fetch('/api/platform-admin/shops', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, shop_id: shop.id, status: 'suspended' }),
    })
    flash(`${shop.name} suspended`)
    await fetchShops(user.id)
  }

  async function handleEnterShop(shop: any) {
    if (!user) return
    // Store original shop_id in localStorage before impersonation
    localStorage.setItem('tz_original_shop_id', user.shop_id)
    const res = await fetch('/api/platform-admin/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, shop_id: shop.id, action: 'start' }),
    })
    if (res.ok) {
      window.location.href = '/dashboard'
    }
  }

  function fmtDate(d: string) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (loading) return <div style={{ color: '#7C8BA0', fontSize: 13, padding: 40 }}>Loading...</div>

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: '#1D6FE8', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 9999 }}>{toast}</div>
      )}

      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F0F4FF', margin: '0 0 20px' }}>All Shops</h1>

      {/* Filters row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={14} color="#48536A" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search by shop name or owner email..."
            style={{ width: '100%', padding: '9px 12px 9px 34px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 12, color: '#DDE3EE', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
        </div>

        {/* Status */}
        <select value={statusFilter} onChange={e => handleFilterChange('status', e.target.value)} style={{ padding: '9px 12px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 12, color: '#DDE3EE', outline: 'none', fontFamily: 'inherit' }}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
        </select>

        {/* Plan */}
        <select value={planFilter} onChange={e => handleFilterChange('plan', e.target.value)} style={{ padding: '9px 12px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 12, color: '#DDE3EE', outline: 'none', fontFamily: 'inherit' }}>
          <option value="all">All Plans</option>
          <option value="truckzen">TruckZen</option>
          <option value="truckzen_pro">TruckZen Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Shop Name', 'Owner', 'Email', 'City/State', 'Plan', 'Status', 'Trial Ends', 'WOs', 'Joined', 'Actions'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 10px', fontSize: 10, color: '#48536A', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'IBM Plex Mono', monospace", borderBottom: '1px solid rgba(255,255,255,.06)', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shops.map((shop: any) => (
              <tr key={shop.id}>
                <td style={{ padding: '10px', fontSize: 13, color: '#F0F4FF', borderBottom: '1px solid rgba(255,255,255,.04)', fontWeight: 600 }}>{shop.name}</td>
                <td style={{ padding: '10px', fontSize: 12, color: '#7C8BA0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>{shop.owner_name}</td>
                <td style={{ padding: '10px', fontSize: 11, color: '#48536A', borderBottom: '1px solid rgba(255,255,255,.04)', fontFamily: "'IBM Plex Mono', monospace" }}>{shop.owner_email}</td>
                <td style={{ padding: '10px', fontSize: 12, color: '#7C8BA0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>{[shop.city, shop.state].filter(Boolean).join(', ') || '—'}</td>
                <td style={{ padding: '10px', fontSize: 11, color: '#7C8BA0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>{PLAN_LABELS[shop.subscription_plan] || shop.subscription_plan || '—'}</td>
                <td style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: shop.status === 'active' ? '#22C55E' : shop.status === 'suspended' ? '#D94F4F' : '#F59E0B', background: shop.status === 'active' ? 'rgba(34,197,94,.12)' : shop.status === 'suspended' ? 'rgba(217,79,79,.12)' : 'rgba(245,158,11,.12)', padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase' }}>{shop.status}</span>
                </td>
                <td style={{ padding: '10px', fontSize: 11, color: '#48536A', borderBottom: '1px solid rgba(255,255,255,.04)' }}>{fmtDate(shop.trial_ends_at)}</td>
                <td style={{ padding: '10px', fontSize: 12, color: '#7C8BA0', borderBottom: '1px solid rgba(255,255,255,.04)', textAlign: 'center' }}>{shop.wo_total}</td>
                <td style={{ padding: '10px', fontSize: 11, color: '#48536A', borderBottom: '1px solid rgba(255,255,255,.04)' }}>{fmtDate(shop.created_at)}</td>
                <td style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => handleEnterShop(shop)} style={{ background: 'rgba(29,111,232,.12)', color: '#4D9EFF', border: 'none', borderRadius: 4, padding: '4px 8px', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Enter</button>
                    <button onClick={() => setEditShop({ ...shop })} style={{ background: 'rgba(255,255,255,.06)', color: '#7C8BA0', border: 'none', borderRadius: 4, padding: '4px 8px', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
                    {shop.status === 'active' && (
                      <button onClick={() => handleSuspend(shop)} style={{ background: 'rgba(217,79,79,.08)', color: '#D94F4F', border: 'none', borderRadius: 4, padding: '4px 8px', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}>Suspend</button>
                    )}
                    <a href={`/platform-admin/activity?shop_id=${shop.id}`} style={{ background: 'rgba(255,255,255,.04)', color: '#48536A', borderRadius: 4, padding: '4px 8px', fontSize: 10, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>Log</a>
                  </div>
                </td>
              </tr>
            ))}
            {shops.length === 0 && (
              <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: '#48536A', fontSize: 12 }}>No shops found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Shop Modal */}
      {editShop && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setEditShop(null)}>
          <div style={{ background: '#12131a', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: 32, width: 440, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#F0F4FF', margin: 0 }}>Edit Shop</h3>
              <button onClick={() => setEditShop(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#48536A' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Shop Name', key: 'name', type: 'text' },
                { label: 'Address', key: 'address', type: 'text' },
                { label: 'Owner Email', key: 'email', type: 'email' },
                { label: 'Phone', key: 'phone', type: 'text' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 10, color: '#7C8BA0', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'IBM Plex Mono', monospace", display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input
                    type={f.type}
                    value={editShop[f.key] || ''}
                    onChange={e => setEditShop({ ...editShop, [f.key]: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 13, color: '#DDE3EE', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                </div>
              ))}

              <div>
                <label style={{ fontSize: 10, color: '#7C8BA0', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'IBM Plex Mono', monospace", display: 'block', marginBottom: 4 }}>Plan</label>
                <select value={editShop.subscription_plan || 'truckzen'} onChange={e => setEditShop({ ...editShop, subscription_plan: e.target.value })} style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 13, color: '#DDE3EE', outline: 'none', fontFamily: 'inherit' }}>
                  <option value="truckzen">TruckZen</option>
                  <option value="truckzen_pro">TruckZen Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 10, color: '#7C8BA0', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'IBM Plex Mono', monospace", display: 'block', marginBottom: 4 }}>Status</label>
                <select value={editShop.status || 'active'} onChange={e => setEditShop({ ...editShop, status: e.target.value })} style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 13, color: '#DDE3EE', outline: 'none', fontFamily: 'inherit' }}>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 10, color: '#7C8BA0', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'IBM Plex Mono', monospace", display: 'block', marginBottom: 4 }}>Trial Ends</label>
                <input
                  type="date"
                  value={editShop.trial_ends_at ? new Date(editShop.trial_ends_at).toISOString().split('T')[0] : ''}
                  onChange={e => setEditShop({ ...editShop, trial_ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 13, color: '#DDE3EE', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 10, color: '#7C8BA0', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'IBM Plex Mono', monospace", display: 'block', marginBottom: 4 }}>Notes (internal)</label>
                <textarea
                  value={editShop.notes || ''}
                  onChange={e => setEditShop({ ...editShop, notes: e.target.value })}
                  rows={3}
                  style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 13, color: '#DDE3EE', outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>

              <button onClick={handleSaveEdit} disabled={saving} style={{ width: '100%', padding: 12, background: '#1D6FE8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', marginTop: 4 }}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
