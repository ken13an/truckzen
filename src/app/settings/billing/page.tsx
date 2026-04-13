'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { ADMIN_ROLES } from '@/lib/roles'
import { useTheme } from '@/hooks/useTheme'

export default function BillingPage() {
  const { tokens: t } = useTheme()

  const S: Record<string, React.CSSProperties> = {
  page: { background: t.bg, minHeight: '100vh', color: t.text, fontFamily: "'Instrument Sans',sans-serif", padding: 24 },
  title: { fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: t.text, marginBottom: 4 },
  card: { background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, padding: 20, marginBottom: 16 },
  btn: { padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', color: t.bgLight },
}
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [billing, setBilling] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    getCurrentUser(supabase).then(async (p: any) => {
      if (!p) { window.location.href = '/login'; return }
      if (!ADMIN_ROLES.includes(p.role)) { window.location.href = '/403'; return }
      setUser(p)

      const res = await fetch(`/api/billing?shop_id=${p.shop_id}`)
      if (res.ok) setBilling(await res.json())
      setLoading(false)

      // Check for setup result
      const params = new URLSearchParams(window.location.search)
      if (params.get('setup') === 'success') { flash('Payment method added'); window.history.replaceState({}, '', '/settings/billing') }
      if (params.get('setup') === 'cancel') { flash('Setup cancelled'); window.history.replaceState({}, '', '/settings/billing') }
    })
  }, [])

  async function addPaymentMethod() {
    const res = await fetch('/api/billing', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_setup_session', shop_id: user.shop_id }),
    })
    const { url } = await res.json()
    if (url) window.location.href = url
  }

  async function removePaymentMethod(pmId: string) {
    await fetch('/api/billing', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove_payment_method', shop_id: user.shop_id, payment_method_id: pmId }),
    })
    setBilling((b: any) => ({ ...b, payment_methods: b.payment_methods.filter((m: any) => m.id !== pmId) }))
    flash('Payment method removed')
  }

  if (loading) return <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textSecondary }}>Loading...</div>

  const plan = billing?.subscription_plan || 'free'
  const methods = billing?.payment_methods || []

  return (
    <div style={S.page}>
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: t.accent, color: t.bgLight, padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>{toast}</div>}

      <div style={S.title}>Billing & Subscription</div>
      <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 24 }}>{billing?.shop_name}</div>

      {/* Current Plan */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Current Plan</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: t.text }}>
              {plan === 'free' ? 'Free Plan' : plan.charAt(0).toUpperCase() + plan.slice(1)}
            </div>
            <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 4 }}>
              {plan === 'free' ? 'All features included during beta. No charge.' : `Next billing date: —`}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#22C55E' }}>$0</div>
            <div style={{ fontSize: 11, color: t.textTertiary }}>/month</div>
          </div>
        </div>
        {plan === 'free' && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(29,111,232,.06)', borderRadius: 8, border: '1px solid rgba(29,111,232,.15)' }}>
            <div style={{ fontSize: 12, color: t.accentLight, fontWeight: 600 }}>Beta Access</div>
            <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 4 }}>You have full access to all TruckZen features during the beta period. Add a payment method to be ready when paid plans launch.</div>
          </div>
        )}
      </div>

      {/* Payment Methods */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '.06em' }}>Payment Methods</div>
          <button onClick={addPaymentMethod} style={S.btn}>+ Add Card</button>
        </div>

        {methods.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: t.textTertiary, fontSize: 13 }}>
            No payment method on file. Add a card to be ready for billing.
          </div>
        ) : (
          methods.map((m: any) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${t.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 28, background: t.border, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase' }}>
                  {m.brand}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: t.text, fontFamily: 'monospace' }}>**** {m.last4}</div>
                  <div style={{ fontSize: 11, color: t.textTertiary }}>Exp {m.exp_month}/{m.exp_year}</div>
                </div>
              </div>
              <button onClick={() => removePaymentMethod(m.id)}
                style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(239,68,68,.3)', background: 'none', color: '#EF4444', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                Remove
              </button>
            </div>
          ))
        )}
      </div>

      {/* Stripe Customer ID */}
      {billing?.stripe_customer_id && (
        <div style={{ fontSize: 10, color: t.textTertiary, marginTop: 8, fontFamily: 'monospace' }}>
          Stripe ID: {billing.stripe_customer_id}
        </div>
      )}
    </div>
  )
}

