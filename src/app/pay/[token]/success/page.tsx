'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

export default function PaymentSuccessPage() {
  const params       = useParams()
  const searchParams = useSearchParams()
  const token      = params.token as string
  const sessionId  = searchParams.get('session_id')

  const [shopName, setShopName] = useState('the shop')
  const [invoiceNum, setInvoiceNum] = useState('')
  const [amount, setAmount] = useState('')
  const [shopPhone, setShopPhone] = useState('')

  useEffect(() => {
    // Fetch confirmation details
    if (!sessionId) return
    fetch(`/api/pay/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, session_id: sessionId }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.shop_name)    setShopName(data.shop_name)
        if (data.invoice_num)  setInvoiceNum(data.invoice_num)
        if (data.amount_paid)  setAmount(
          data.amount_paid.toLocaleString('en-US', { style:'currency', currency:'USD' })
        )
        if (data.shop_phone)   setShopPhone(data.shop_phone)
      })
  }, [token, sessionId])

  return (
    <div style={s.page}>
      <div style={s.grain}/>
      <div style={s.card}>
        {/* Logo */}
        <div style={s.logoRow}>
          <div style={s.logoMark}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
              stroke="white" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div style={s.logoText}>
            TRUCK<span style={s.logoAccent}>ZEN</span>
          </div>
        </div>

        {/* Success icon — animated */}
        <div style={s.iconWrap}>
          <svg viewBox="0 0 52 52" width="52" height="52">
            <circle cx="26" cy="26" r="25" fill="none"
              stroke="#1DB870" strokeWidth="2"
              strokeDasharray="157" strokeDashoffset="0"
              style={{ animation: 'draw-circle 0.6s ease-out forwards' }}/>
            <path d="M14.5 26.5l8 8 15-15" fill="none"
              stroke="#1DB870" strokeWidth="2.5" strokeLinecap="round"
              strokeDasharray="30" strokeDashoffset="30"
              style={{ animation: 'draw-check 0.4s 0.5s ease-out forwards' }}/>
          </svg>
        </div>

        <h1 style={s.title}>Payment Received</h1>

        <p style={s.sub}>
          {amount && invoiceNum
            ? `${amount} paid for Invoice ${invoiceNum}. `
            : 'Your payment was successful. '}
          Thank you for your business.
        </p>

        {/* Summary box */}
        <div style={s.summaryBox}>
          {invoiceNum && (
            <div style={s.summaryRow}>
              <span style={s.sumKey}>Invoice</span>
              <span style={s.sumVal}>{invoiceNum}</span>
            </div>
          )}
          {amount && (
            <div style={s.summaryRow}>
              <span style={s.sumKey}>Amount Paid</span>
              <span style={{ ...s.sumVal, color: '#1DB870' }}>{amount}</span>
            </div>
          )}
          <div style={s.summaryRow}>
            <span style={s.sumKey}>Status</span>
            <span style={{ ...s.sumVal, color: '#1DB870' }}>Paid</span>
          </div>
        </div>

        <p style={s.receipt}>
          A receipt has been sent to your email address.
        </p>

        {/* Call shop */}
        {shopPhone && (
          <a href={`tel:${shopPhone}`} style={s.callBtn}>
            Questions? Call {shopName}
          </a>
        )}
      </div>

      <div style={s.poweredBy}>Powered by TruckZen</div>

      <style>{`
        @keyframes draw-circle {
          from { stroke-dashoffset: 157; }
          to   { stroke-dashoffset: 0;   }
        }
        @keyframes draw-check {
          from { stroke-dashoffset: 30; }
          to   { stroke-dashoffset: 0;  }
        }
      `}</style>
    </div>
  )
}

const s: Record<string, any> = {
  page: {
    minHeight: '100vh', background: '#060708',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '20px',
    fontFamily: "'Instrument Sans',-apple-system,sans-serif",
    position: 'relative',
  },
  grain: {
    position: 'fixed', inset: 0, pointerEvents: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23g)' opacity='0.03'/%3E%3C/svg%3E")`,
    opacity: 0.4, zIndex: 0,
  },
  card: {
    width: '100%', maxWidth: '400px',
    background: '#161B24',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px', padding: '32px 28px',
    textAlign: 'center',
    position: 'relative', zIndex: 1,
    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
  },
  logoRow: {
    display: 'flex', alignItems: 'center', gap: '8px',
    justifyContent: 'center', marginBottom: '24px',
  },
  logoMark: {
    width: '28px', height: '28px', borderRadius: '6px',
    background: 'linear-gradient(135deg,#1D6FE8,#1248B0)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoText: {
    fontFamily: "'Bebas Neue',sans-serif",
    fontSize: '14px', letterSpacing: '0.1em', color: '#F0F4FF',
  },
  logoAccent: { color: '#4D9EFF' },
  iconWrap: { margin: '0 auto 20px' },
  title: {
    fontSize: '24px', fontWeight: 700, color: '#F0F4FF',
    margin: '0 0 10px',
  },
  sub: {
    fontSize: '14px', color: '#7C8BA0',
    lineHeight: 1.6, margin: '0 0 20px',
  },
  summaryBox: {
    background: '#1C2130', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px', padding: '14px', marginBottom: '16px',
    textAlign: 'left',
  },
  summaryRow: {
    display: 'flex', justifyContent: 'space-between',
    padding: '5px 0',
  },
  sumKey: { fontSize: '12px', color: '#7C8BA0' },
  sumVal: { fontSize: '13px', fontWeight: 600, color: '#DDE3EE', fontFamily: 'monospace' },
  receipt: { fontSize: '11px', color: '#48536A', margin: '0 0 20px' },
  callBtn: {
    display: 'block', padding: '12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '9px', color: '#7C8BA0',
    textDecoration: 'none', fontSize: '13px',
  },
  poweredBy: {
    marginTop: '20px', fontSize: '10px', color: '#48536A',
    fontFamily: 'monospace', letterSpacing: '0.06em', zIndex: 1,
  },
}
