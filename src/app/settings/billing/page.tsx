'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

export default function BillingPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [billing, setBilling] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    getCurrentUser(supabase).then(async (p: any) => {
      if (!p) { window.location.href = '/login'; return }
      if (!['owner', 'gm', 'it_person'].includes(p.role)) { window.location.href = '/403'; return }
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

  if (loading) return <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8E8E93' }}>Loading...</div>

  const plan = billing?.subscription_plan || 'free'
  const methods = billing?.payment_methods || []

  return (
    <div style={S.page}>
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: '#0A84FF', color: '#fff', padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>{toast}</div>}

      <div style={S.title}>Billing & Subscription</div>
      <div style={{ fontSize: 12, color: '#8E8E93', marginBottom: 24 }}>{billing?.shop_name}</div>

      {/* Current Plan */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Current Plan</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#F5F5F7' }}>
              {plan === 'free' ? 'Free Plan' : plan.charAt(0).toUpperCase() + plan.slice(1)}
            </div>
            <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 4 }}>
              {plan === 'free' ? 'All features included during beta. No charge.' : `Next billing date: —`}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#0A84FF' }}>$0</div>
            <div style={{ fontSize: 11, color: '#8E8E93' }}>/month</div>
          </div>
        </div>
        {plan === 'free' && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(0,224,176,.06)', borderRadius: 8, border: '1px solid rgba(0,224,176,.15)' }}>
            <div style={{ fontSize: 12, color: '#0A84FF', fontWeight: 600 }}>Beta Access</div>
            <div style={{ fontSize: 11, color: '#8E8E93', marginTop: 4 }}>You have full access to all TruckZen features during the beta period. Add a payment method to be ready when paid plans launch.</div>
          </div>
        )}
      </div>

      {/* Payment Methods */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '.06em' }}>Payment Methods</div>
          <button onClick={addPaymentMethod} style={S.btn}>+ Add Card</button>
        </div>

        {methods.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: '#8E8E93', fontSize: 13 }}>
            No payment method on file. Add a card to be ready for billing.
          </div>
        ) : (
          methods.map((m: any) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 28, background: '#2A2A2A', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase' }}>
                  {m.brand}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F5F7', fontFamily: 'monospace' }}>**** {m.last4}</div>
                  <div style={{ fontSize: 11, color: '#8E8E93' }}>Exp {m.exp_month}/{m.exp_year}</div>
                </div>
              </div>
              <button onClick={() => removePaymentMethod(m.id)}
                style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(239,68,68,.3)', background: 'none', color: '#FF453A', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                Remove
              </button>
            </div>
          ))
        )}
      </div>

      {/* Stripe Customer ID */}
      {billing?.stripe_customer_id && (
        <div style={{ fontSize: 10, color: '#8E8E93', marginTop: 8, fontFamily: 'monospace' }}>
          Stripe ID: {billing.stripe_customer_id}
        </div>
      )}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: { background: '#0A0A0A', minHeight: '100vh', color: '#F5F5F7', fontFamily: "'Instrument Sans',sans-serif", padding: 24 },
  title: { fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F5F5F7', marginBottom: 4 },
  card: { background: '#0A0A0A', border: '1px solid #2A2A2A', borderRadius: 12, padding: 20, marginBottom: 16 },
  btn: { padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'linear-gradient(135deg,#0A84FF,#0A84FF)', color: '#fff' },
}
