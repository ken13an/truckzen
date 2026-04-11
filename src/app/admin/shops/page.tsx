'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { FONT } from '@/lib/config/colors'
import { useTheme } from '@/hooks/useTheme'

export default function PlatformAdminShops() {
  const { tokens: t } = useTheme()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [shops, setShops] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [toast, setToast] = useState('')
  const [form, setForm] = useState({
    name: '', dba: '', phone: '', email: '', address: '', city: '', state: '', zip: '',
    tax_rate: '', labor_rate: '', admin_name: '', admin_email: '', admin_password: '',
  })

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    async function load() {
      const u = await getCurrentUser(supabase)
      if (!u) { window.location.href = '/login'; return }

      // Check is_platform_owner from DB directly (not in UserProfile type yet)
      const { data: profile } = await supabase.from('users')
        .select('is_platform_owner')
        .eq('id', u.id)
        .single()

      if (!profile?.is_platform_owner) {
        window.location.href = '/dashboard'
        return
      }

      setUser({ ...u, is_platform_owner: true })
      await fetchShops(u.id)
      setLoading(false)
    }
    load()
  }, [])

  async function fetchShops(userId: string) {
    const res = await fetch(`/api/admin/shops?user_id=${userId}`)
    if (res.ok) {
      const data = await res.json()
      setShops(data)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await fetch('/api/admin/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, user_id: user.id, tax_rate: parseFloat(form.tax_rate) || 0, labor_rate: parseFloat(form.labor_rate) || 0 }),
      })
      if (res.ok) {
        flash('Shop created successfully')
        setShowCreate(false)
        setForm({ name: '', dba: '', phone: '', email: '', address: '', city: '', state: '', zip: '', tax_rate: '', labor_rate: '', admin_name: '', admin_email: '', admin_password: '' })
        await fetchShops(user.id)
      } else {
        const err = await res.json()
        flash(err.error || 'Failed to create shop')
      }
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: t.textSecondary, fontFamily: FONT }}>Loading...</span>
      </div>
    )
  }

  if (!user) return null

  const statusColor = (status: string) => {
    if (status === 'active') return t.success
    if (status === 'pending') return t.warning
    if (status === 'suspended') return t.danger
    return t.textSecondary
  }

  const statusBg = (status: string) => {
    if (status === 'active') return t.successBg
    if (status === 'pending') return t.warningBg
    if (status === 'suspended') return t.dangerBg
    return 'transparent'
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', background: t.bgAlt, border: `1px solid ${t.border}`,
    borderRadius: 6, color: t.text, fontFamily: FONT, fontSize: 13, outline: 'none', boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11, color: t.textSecondary, fontFamily: FONT, marginBottom: 4, display: 'block', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.5px',
  }

  return (
    <div style={{ minHeight: '100vh', background: t.bg, color: t.text, fontFamily: FONT }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, background: t.accent, color: '#fff',
          padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 9999,
          boxShadow: '0 4px 20px rgba(0,0,0,.4)',
        }}>{toast}</div>
      )}

      {/* Header */}
      <div style={{ padding: '32px 40px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: t.text }}>Platform Admin — All Shops</h1>
          <p style={{ fontSize: 13, color: t.textSecondary, margin: '4px 0 0' }}>{shops.length} shops on the platform</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            background: t.accent, color: '#fff', border: 'none', borderRadius: 8,
            padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
          }}
        >
          + Create New Shop
        </button>
      </div>

      {/* Table */}
      <div style={{ padding: '24px 40px' }}>
        <div style={{ background: t.bgCard, borderRadius: 12, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                {['Name', 'Status', 'Users', 'Work Orders', 'Customers', 'Created'].map(h => (
                  <th key={h} style={{
                    padding: '12px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700,
                    color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.5px',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shops.map(shop => (
                <tr
                  key={shop.id}
                  onClick={() => window.location.href = `/admin/shops/${shop.id}`}
                  style={{ borderBottom: `1px solid ${t.border}`, cursor: 'pointer', transition: 'background .12s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{shop.dba || shop.name}</div>
                    {shop.dba && shop.name !== shop.dba && (
                      <div style={{ fontSize: 11, color: t.textTertiary, marginTop: 2 }}>{shop.name}</div>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600,
                      color: statusColor(shop.status), background: statusBg(shop.status),
                    }}>
                      {shop.status}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: t.textSecondary }}>{shop.user_count}</td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: t.textSecondary }}>{shop.wo_count}</td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: t.textSecondary }}>{shop.customer_count}</td>
                  <td style={{ padding: '14px 16px', fontSize: 11, color: t.textTertiary }}>
                    {new Date(shop.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {shops.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: t.textTertiary, fontSize: 13 }}>
                    No shops yet. Create your first shop to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Shop Modal */}
      {showCreate && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }} onClick={() => setShowCreate(false)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: t.bgCard, borderRadius: 16, border: `1px solid ${t.border}`,
              padding: 32, width: 560, maxHeight: '85vh', overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,.5)',
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 24px', color: t.text }}>Create New Shop</h2>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Shop Name *</label>
                  <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div>
                  <label style={labelStyle}>DBA</label>
                  <input style={inputStyle} value={form.dba} onChange={e => setForm(f => ({ ...f, dba: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input style={inputStyle} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Email</label>
                  <input style={inputStyle} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Address</label>
                  <input style={inputStyle} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>City</label>
                  <input style={inputStyle} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>State</label>
                  <input style={inputStyle} value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Zip</label>
                  <input style={inputStyle} value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Tax Rate (%)</label>
                  <input style={inputStyle} type="number" step="0.01" value={form.tax_rate} onChange={e => setForm(f => ({ ...f, tax_rate: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Labor Rate ($/hr)</label>
                  <input style={inputStyle} type="number" step="0.01" value={form.labor_rate} onChange={e => setForm(f => ({ ...f, labor_rate: e.target.value }))} />
                </div>
              </div>

              <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 16, marginTop: 8, marginBottom: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: t.accentLight, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Shop Admin Account</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Admin Name *</label>
                    <input style={inputStyle} value={form.admin_name} onChange={e => setForm(f => ({ ...f, admin_name: e.target.value }))} required />
                  </div>
                  <div>
                    <label style={labelStyle}>Admin Email *</label>
                    <input style={inputStyle} type="email" value={form.admin_email} onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))} required />
                  </div>
                  <div>
                    <label style={labelStyle}>Password *</label>
                    <input style={inputStyle} type="password" value={form.admin_password} onChange={e => setForm(f => ({ ...f, admin_password: e.target.value }))} required minLength={8} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  style={{
                    background: 'transparent', color: t.textSecondary, border: `1px solid ${t.border}`,
                    borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer', fontFamily: FONT,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    background: t.accent, color: '#fff', border: 'none', borderRadius: 8,
                    padding: '10px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
                    opacity: creating ? 0.6 : 1,
                  }}
                >
                  {creating ? 'Creating...' : 'Create Shop'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
