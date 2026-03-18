'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

// ── TYPES ────────────────────────────────────────────────────
interface PaymentPageData {
  valid:    boolean
  error?:   string
  invoice?: {
    id:             string
    invoice_number: string
    total:          number
    subtotal:       number
    tax_amount:     number
    balance_due:    number
    amount_paid:    number
    status:         string
    due_date:       string
    service_orders: {
      so_number: string
      complaint: string
      assets: { unit_number: string; year: number; make: string; model: string }
      users:   { full_name: string } | null
    }
    customers: { company_name: string; contact_name?: string }
  }
  shop?: {
    name:    string
    dba?:    string
    phone:   string
    email:   string
    address: string
  }
}

export default function PaymentPage() {
  const params      = useParams()
  const router      = useRouter()
  const token       = params.token as string

  const [data,        setData]        = useState<PaymentPageData | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [paying,      setPaying]      = useState(false)
  const [payError,    setPayError]    = useState('')

  // ── VERIFY TOKEN ON LOAD ─────────────────────────────────
  useEffect(() => {
    if (!token) return
    fetch(`/api/pay/verify`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ valid: false, error: 'Could not load payment page.' }))
      .finally(() => setLoading(false))
  }, [token])

  // ── PAY NOW ──────────────────────────────────────────────
  async function handlePay() {
    setPaying(true)
    setPayError('')
    try {
      const res  = await fetch('/api/pay/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token }),
      })
      const json = await res.json()
      if (json.checkoutUrl) {
        window.location.href = json.checkoutUrl
      } else {
        setPayError(json.error || 'Payment failed. Try again.')
        setPaying(false)
      }
    } catch {
      setPayError('Network error. Check your connection and try again.')
      setPaying(false)
    }
  }

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

  // ── LOADING ──────────────────────────────────────────────
  if (loading) return (
    <Page>
      <div style={s.loadWrap}>
        <Spinner color="#1D6FE8" size={32}/>
        <p style={s.loadText}>Loading invoice...</p>
      </div>
    </Page>
  )

  // ── INVALID / EXPIRED / ALREADY PAID ────────────────────
  if (!data?.valid || !data?.invoice) return (
    <Page>
      <div style={s.card}>
        <Logo shopName={data?.shop?.dba || data?.shop?.name}/>
        <div style={s.statusIcon('error')}>✗</div>
        <h2 style={s.statusTitle}>{data?.error || 'Payment Link Invalid'}</h2>
        <p style={s.statusSub}>
          {data?.error?.includes('paid')
            ? 'Your payment was received. Thank you for your business.'
            : 'This link may have expired. Contact the shop for a new payment link.'}
        </p>
        {data?.shop && (
          <a href={`tel:${data.shop.phone}`} style={s.callBtn}>
            Call {data.shop.dba || data.shop.name}
          </a>
        )}
      </div>
    </Page>
  )

  const { invoice, shop } = data
  const so    = invoice.service_orders
  const asset = so?.assets
  const shopName = shop?.dba || shop?.name || 'Truck Shop'

  // ── PAYMENT PAGE ─────────────────────────────────────────
  return (
    <Page>
      <div style={s.card}>
        {/* Logo + Shop name */}
        <Logo shopName={shopName}/>

        {/* Truck */}
        <div style={s.truckPill}>
          <span style={s.truckIcon}>🚛</span>
          <div>
            <div style={s.truckUnit}>Unit #{asset?.unit_number}</div>
            <div style={s.truckModel}>
              {asset?.year} {asset?.make} {asset?.model}
            </div>
          </div>
        </div>

        {/* Invoice ref */}
        <div style={s.invoiceRef}>
          <span style={s.invoiceRefLabel}>Invoice</span>
          <span style={s.invoiceRefNum}>{invoice.invoice_number}</span>
        </div>

        {/* Work done */}
        {so?.complaint && (
          <div style={s.workBlock}>
            <div style={s.workLabel}>Service Performed</div>
            <div style={s.workText}>{so.complaint}</div>
          </div>
        )}

        {/* Totals */}
        <div style={s.totalsBlock}>
          <div style={s.totalRow}>
            <span style={s.totalKey}>Subtotal</span>
            <span style={s.totalVal}>{fmt(invoice.subtotal)}</span>
          </div>
          <div style={s.totalRow}>
            <span style={s.totalKey}>Tax</span>
            <span style={s.totalVal}>{fmt(invoice.tax_amount)}</span>
          </div>
          {invoice.amount_paid > 0 && (
            <div style={s.totalRow}>
              <span style={{ ...s.totalKey, color: '#1DB870' }}>Paid</span>
              <span style={{ ...s.totalVal, color: '#1DB870' }}>
                −{fmt(invoice.amount_paid)}
              </span>
            </div>
          )}
          <div style={s.divider}/>
          <div style={s.totalRow}>
            <span style={s.balanceKey}>Balance Due</span>
            <span style={s.balanceVal}>{fmt(invoice.balance_due)}</span>
          </div>
        </div>

        {/* Error */}
        {payError && (
          <div style={s.errorBox}>{payError}</div>
        )}

        {/* PAY BUTTON */}
        <button
          style={paying ? s.btnPaying : s.btn}
          onClick={handlePay}
          disabled={paying}
        >
          {paying ? (
            <span style={s.btnInner}>
              <Spinner color="#fff" size={16}/>
              Redirecting to secure checkout...
            </span>
          ) : (
            `Pay ${fmt(invoice.balance_due)} Now`
          )}
        </button>

        {/* Security badge */}
        <div style={s.securityBadge}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none"
            stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          Secured by Stripe · 256-bit TLS encryption
        </div>

        {/* Shop contact */}
        <div style={s.shopContact}>
          <div style={s.shopContactName}>{shopName}</div>
          <div style={s.shopContactDetail}>
            {shop?.address && <span>{shop.address} · </span>}
            {shop?.phone && (
              <a href={`tel:${shop.phone}`} style={s.shopPhone}>{shop.phone}</a>
            )}
          </div>
          {so?.users?.full_name && (
            <div style={s.techName}>Technician: {so.users.full_name}</div>
          )}
        </div>
      </div>

      <div style={s.poweredBy}>Powered by TruckZen</div>
    </Page>
  )
}

// ── SUB-COMPONENTS ───────────────────────────────────────────

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div style={s.page}>
      <div style={s.grain}/>
      {children}
    </div>
  )
}

function Logo({ shopName }: { shopName?: string }) {
  return (
    <div style={s.logoRow}>
      <div style={s.logoMark}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
          stroke="white" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
      </div>
      <div>
        <div style={s.logoText}>TRUCK<span style={s.logoAccent}>ZEN</span></div>
        {shopName && <div style={s.logoShop}>{shopName}</div>}
      </div>
    </div>
  )
}

function Spinner({ color, size }: { color: string; size: number }) {
  return (
    <div style={{
      width:  size, height: size, borderRadius: '50%',
      border: `2px solid ${color}30`,
      borderTopColor: color,
      animation: 'spin 0.7s linear infinite',
      flexShrink: 0,
    }}/>
  )
}

// ── STYLES ───────────────────────────────────────────────────
const s: Record<string, any> = {
  page: {
    minHeight: '100vh',
    background: '#060708',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'flex-start',
    padding: '16px 16px 40px',
    fontFamily: "'Instrument Sans',-apple-system,sans-serif",
    position: 'relative',
  },
  grain: {
    position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23g)' opacity='0.03'/%3E%3C/svg%3E")`,
    opacity: 0.4,
  },
  card: {
    width: '100%', maxWidth: '420px',
    background: '#161B24',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px', padding: '24px',
    position: 'relative', zIndex: 1,
    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
    marginTop: '16px',
  },
  logoRow: {
    display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px',
  },
  logoMark: {
    width: '30px', height: '30px', borderRadius: '7px', flexShrink: 0,
    background: 'linear-gradient(135deg,#1D6FE8,#1248B0)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 0 12px rgba(29,111,232,0.3)',
  },
  logoText: {
    fontFamily: "'Bebas Neue',sans-serif",
    fontSize: '15px', letterSpacing: '0.1em', color: '#F0F4FF',
  },
  logoAccent: { color: '#4D9EFF' },
  logoShop:  { fontSize: '11px', color: '#7C8BA0', marginTop: '1px' },

  truckPill: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '12px 14px',
    background: 'rgba(29,111,232,0.06)',
    border: '1px solid rgba(29,111,232,0.15)',
    borderRadius: '10px', marginBottom: '14px',
  },
  truckIcon: { fontSize: '20px' },
  truckUnit: { fontSize: '15px', fontWeight: 700, color: '#F0F4FF' },
  truckModel:{ fontSize: '11px', color: '#7C8BA0', marginTop: '2px' },

  invoiceRef: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 0', marginBottom: '12px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  invoiceRefLabel: {
    fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase',
    color: '#48536A', fontFamily: 'monospace',
  },
  invoiceRefNum: {
    fontSize: '13px', fontWeight: 700, color: '#4D9EFF', fontFamily: 'monospace',
  },

  workBlock: {
    padding: '12px', background: '#1C2130',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '9px', marginBottom: '16px',
  },
  workLabel: {
    fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase',
    color: '#48536A', fontFamily: 'monospace', marginBottom: '6px',
  },
  workText: { fontSize: '12px', color: '#DDE3EE', lineHeight: 1.6 },

  totalsBlock: {
    background: '#1C2130', border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '10px', padding: '14px', marginBottom: '16px',
  },
  totalRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '4px 0',
  },
  totalKey: { fontSize: '13px', color: '#7C8BA0' },
  totalVal: { fontSize: '13px', color: '#DDE3EE', fontFamily: 'monospace' },
  divider:  { height: '1px', background: 'rgba(255,255,255,0.07)', margin: '10px 0' },
  balanceKey: { fontSize: '16px', fontWeight: 700, color: '#F0F4FF' },
  balanceVal: {
    fontSize: '22px', fontWeight: 700, color: '#4D9EFF',
    fontFamily: 'monospace',
  },

  errorBox: {
    padding: '10px 12px', marginBottom: '12px',
    background: 'rgba(217,79,79,0.08)',
    border: '1px solid rgba(217,79,79,0.2)',
    borderRadius: '8px', fontSize: '12px', color: '#D94F4F',
  },

  btn: {
    width: '100%', padding: '16px',
    background: 'linear-gradient(135deg,#1D6FE8,#1248B0)',
    border: 'none', borderRadius: '11px',
    fontSize: '16px', fontWeight: 700, color: '#fff',
    cursor: 'pointer', marginBottom: '12px',
    boxShadow: '0 4px 24px rgba(29,111,232,0.4)',
    fontFamily: 'inherit', minHeight: '56px',
    WebkitTapHighlightColor: 'transparent',
  },
  btnPaying: {
    width: '100%', padding: '16px',
    background: '#1C2130',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '11px', fontSize: '14px', fontWeight: 600,
    color: '#7C8BA0', cursor: 'not-allowed', marginBottom: '12px',
    fontFamily: 'inherit', minHeight: '56px',
  },
  btnInner: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
  },

  securityBadge: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
    fontSize: '11px', color: '#48536A', marginBottom: '20px',
  },

  shopContact: {
    paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)',
    textAlign: 'center',
  },
  shopContactName:   { fontSize: '12px', fontWeight: 600, color: '#DDE3EE' },
  shopContactDetail: { fontSize: '11px', color: '#48536A', marginTop: '3px' },
  shopPhone:         { color: '#4D9EFF', textDecoration: 'none' },
  techName:          { fontSize: '10px', color: '#48536A', marginTop: '3px' },

  poweredBy: {
    marginTop: '20px', fontSize: '10px', color: '#48536A',
    fontFamily: 'monospace', letterSpacing: '0.06em',
    position: 'relative', zIndex: 1,
  },

  loadWrap: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '16px', paddingTop: '40vh',
  },
  loadText: { fontSize: '13px', color: '#7C8BA0' },

  statusIcon: (type: 'error' | 'success') => ({
    width: '60px', height: '60px', borderRadius: '50%',
    background: type === 'error' ? 'rgba(217,79,79,0.1)' : 'rgba(29,184,112,0.1)',
    border: `2px solid ${type === 'error' ? 'rgba(217,79,79,0.3)' : 'rgba(29,184,112,0.3)'}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '24px',
    color: type === 'error' ? '#D94F4F' : '#1DB870',
    margin: '16px auto',
  }),
  statusTitle: {
    fontSize: '18px', fontWeight: 700, color: '#F0F4FF',
    textAlign: 'center', margin: '0 0 10px',
  },
  statusSub: {
    fontSize: '13px', color: '#7C8BA0', textAlign: 'center',
    lineHeight: 1.6, margin: '0 0 20px',
  },
  callBtn: {
    display: 'block', padding: '13px',
    background: 'rgba(29,111,232,0.08)',
    border: '1px solid rgba(29,111,232,0.2)',
    borderRadius: '9px', textAlign: 'center',
    color: '#4D9EFF', textDecoration: 'none',
    fontSize: '14px', fontWeight: 600,
  },
}
