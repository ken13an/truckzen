'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { COLORS, FONT } from '@/lib/config/colors'
import { useTheme } from '@/hooks/useTheme'

export default function PlatformAdminShopDetail() {
  const { tokens: t } = useTheme()
  const supabase = createClient()
  const params = useParams()
  const shopId = params.id as string

  const [user, setUser] = useState<any>(null)
  const [shop, setShop] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [clearResult, setClearResult] = useState<any>(null)
  const [suspending, setSuspending] = useState(false)

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(''), 4000) }

  useEffect(() => {
    async function load() {
      const u = await getCurrentUser(supabase)
      if (!u) { window.location.href = '/login'; return }

      const { data: profile } = await supabase.from('users')
        .select('is_platform_owner')
        .eq('id', u.id)
        .single()

      if (!profile?.is_platform_owner) {
        window.location.href = '/dashboard'
        return
      }

      setUser({ ...u, is_platform_owner: true })
      await fetchShop(u.id)
      setLoading(false)
    }
    load()
  }, [shopId])

  async function fetchShop(userId: string) {
    const res = await fetch(`/api/admin/shops/${shopId}?user_id=${userId}`)
    if (res.ok) {
      setShop(await res.json())
    }
  }

  async function handleSuspend() {
    setSuspending(true)
    try {
      if (shop.status === 'suspended') {
        const res = await fetch(`/api/admin/shops/${shopId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, status: 'active' }),
        })
        if (res.ok) {
          flash('Shop reactivated')
          await fetchShop(user.id)
        }
      } else {
        const res = await fetch(`/api/admin/shops/${shopId}?user_id=${user.id}`, { method: 'DELETE' })
        if (res.ok) {
          flash('Shop suspended')
          await fetchShop(user.id)
        }
      }
    } finally {
      setSuspending(false)
    }
  }

  async function handleClearTestData() {
    setClearing(true)
    setClearResult(null)
    try {
      const res = await fetch(`/api/admin/shops/${shopId}/clear-test-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, confirm: true }),
      })
      if (res.ok) {
        const result = await res.json()
        setClearResult(result)
        flash(`Cleared ${result.total} records`)
        await fetchShop(user.id)
      } else {
        const err = await res.json()
        flash(err.error || 'Failed to clear data')
      }
    } finally {
      setClearing(false)
    }
  }

  async function handleImpersonate() {
    // Set a cookie or session marker to impersonate as this shop's owner
    // For now, redirect to dashboard with shop context
    const { data: shopOwner } = await supabase.from('users')
      .select('id')
      .eq('shop_id', shopId)
      .eq('role', 'owner')
      .limit(1)
      .single()

    if (shopOwner) {
      // Store impersonation target in localStorage
      localStorage.setItem('impersonate_shop_id', shopId)
      localStorage.setItem('impersonate_user_id', shopOwner.id)
      flash('Impersonating shop owner — redirecting...')
      setTimeout(() => { window.location.href = '/dashboard' }, 500)
    } else {
      flash('No owner found for this shop')
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: t.textSecondary, fontFamily: FONT }}>Loading...</span>
      </div>
    )
  }

  if (!user || !shop) return null

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

  const statCards = [
    { label: 'Users', value: shop.user_count, color: t.accent },
    { label: 'Customers', value: shop.customer_count, color: t.success },
    { label: 'Vehicles', value: shop.asset_count, color: t.warning },
    { label: 'Work Orders', value: shop.wo_count, color: t.accentLight },
    { label: 'Invoices', value: shop.invoice_count, color: COLORS.roleParts },
  ]

  return (
    <div style={{ minHeight: '100vh', background: t.bg, color: t.text, fontFamily: FONT }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, background: t.accent, color: t.bgLight,
          padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 9999,
          boxShadow: '0 4px 20px rgba(0,0,0,.4)',
        }}>{toast}</div>
      )}

      {/* Header */}
      <div style={{ padding: '32px 40px 0' }}>
        <a href="/admin/shops" style={{ color: t.accentLight, fontSize: 12, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
          ← Back to All Shops
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{shop.dba || shop.name}</h1>
          <span style={{
            display: 'inline-block', padding: '3px 12px', borderRadius: 100, fontSize: 11, fontWeight: 600,
            color: statusColor(shop.status), background: statusBg(shop.status),
          }}>
            {shop.status}
          </span>
        </div>
        {shop.dba && shop.name !== shop.dba && (
          <p style={{ fontSize: 13, color: t.textTertiary, margin: '2px 0 0' }}>Legal: {shop.name}</p>
        )}
      </div>

      {/* Shop Info */}
      <div style={{ padding: '24px 40px' }}>
        <div style={{
          background: t.bgCard, borderRadius: 12, border: `1px solid ${t.border}`,
          padding: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 20,
        }}>
          {[
            { label: 'Phone', value: shop.phone },
            { label: 'Email', value: shop.email },
            { label: 'Address', value: [shop.address, shop.city, shop.state, shop.zip].filter(Boolean).join(', ') },
            { label: 'Tax Rate', value: shop.tax_rate ? `${shop.tax_rate}%` : '—' },
            { label: 'Labor Rate', value: shop.labor_rate ? `$${shop.labor_rate}/hr` : '—' },
            { label: 'Kiosk Code', value: shop.kiosk_code || '—' },
          ].map(item => (
            <div key={item.label}>
              <div style={{ fontSize: 10, color: t.textTertiary, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 13, color: item.value ? t.text : t.textTertiary }}>{item.value || '—'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{ padding: '0 40px 24px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
        {statCards.map(card => (
          <div key={card.label} style={{
            background: t.bgCard, borderRadius: 12, border: `1px solid ${t.border}`, padding: 20,
          }}>
            <div style={{ fontSize: 10, color: t.textTertiary, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginBottom: 8 }}>{card.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Admin Actions */}
      <div style={{ padding: '0 40px 40px' }}>
        <div style={{
          background: t.bgCard, borderRadius: 12, border: `1px solid ${t.border}`, padding: 24,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px', color: t.text }}>Admin Actions</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {/* Impersonate */}
            <button
              onClick={handleImpersonate}
              style={{
                background: t.accentBg, color: t.accentLight, border: `1px solid ${t.accent}`,
                borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
              }}
            >
              Impersonate Shop Owner
            </button>

            {/* Suspend / Reactivate */}
            <button
              onClick={handleSuspend}
              disabled={suspending}
              style={{
                background: shop.status === 'suspended' ? t.successBg : t.warningBg,
                color: shop.status === 'suspended' ? t.success : t.warning,
                border: `1px solid ${shop.status === 'suspended' ? t.success : t.warning}`,
                borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
                opacity: suspending ? 0.6 : 1,
              }}
            >
              {suspending ? 'Processing...' : shop.status === 'suspended' ? 'Reactivate Shop' : 'Suspend Shop'}
            </button>

            {/* Clear Test Data */}
            <button
              onClick={() => setShowClearConfirm(true)}
              style={{
                background: t.dangerBg, color: t.danger, border: `1px solid ${t.danger}`,
                borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
              }}
            >
              Clear Test Data
            </button>
          </div>

          {/* Clear Result */}
          {clearResult && (
            <div style={{
              marginTop: 16, padding: 16, background: t.bgAlt, borderRadius: 8, border: `1px solid ${t.border}`,
            }}>
              <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px', color: t.success }}>
                Cleared {clearResult.total} records from {clearResult.shop}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                {Object.entries(clearResult.cleared).map(([key, val]) => (
                  <div key={key} style={{ fontSize: 12, color: t.textSecondary }}>
                    <span style={{ color: t.textTertiary }}>{key}:</span> <span style={{ fontWeight: 600, color: t.text }}>{val as number}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Clear Test Data Confirmation Modal */}
      {showClearConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }} onClick={() => !clearing && setShowClearConfirm(false)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: t.bgCard, borderRadius: 16, border: `1px solid ${t.border}`,
              padding: 32, width: 440, boxShadow: '0 20px 60px rgba(0,0,0,.5)',
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 12px', color: t.danger }}>Clear All Test Data?</h2>
            <p style={{ fontSize: 13, color: t.textSecondary, margin: '0 0 8px', lineHeight: 1.6 }}>
              This will permanently delete <strong style={{ color: t.text }}>all</strong> data for <strong style={{ color: t.text }}>{shop.dba || shop.name}</strong>:
            </p>
            <ul style={{ fontSize: 12, color: t.textSecondary, margin: '8px 0 20px', paddingLeft: 20, lineHeight: 1.8 }}>
              <li>All service orders, lines, and job assignments</li>
              <li>All invoices and invoice lines</li>
              <li>All customers and contacts</li>
              <li>All vehicles/assets</li>
              <li>All time entries, notes, files, parts requests</li>
              <li>Test user accounts (technicians, mechanics)</li>
            </ul>
            <p style={{ fontSize: 12, color: t.danger, margin: '0 0 20px', fontWeight: 600 }}>
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowClearConfirm(false)}
                disabled={clearing}
                style={{
                  background: 'transparent', color: t.textSecondary, border: `1px solid ${t.border}`,
                  borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer', fontFamily: FONT,
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await handleClearTestData()
                  setShowClearConfirm(false)
                }}
                disabled={clearing}
                style={{
                  background: t.danger, color: t.bgLight, border: 'none', borderRadius: 8,
                  padding: '10px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
                  opacity: clearing ? 0.6 : 1,
                }}
              >
                {clearing ? 'Clearing...' : 'Yes, Clear All Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
