import type { Metadata } from 'next'
import Logo from '@/components/Logo'

export const metadata: Metadata = {
  title: 'TruckZen — Truck Repair Shop Management Software',
  description: 'Complete truck shop management platform. Work orders, invoicing, parts inventory, fleet tracking, and AI-powered service writing — built for heavy-duty repair shops.',
}

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', background: '#060708', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'Instrument Sans', sans-serif", padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 560 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <Logo size="lg" />
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: '#F0F4FF', marginBottom: 12, lineHeight: 1.2 }}>
          Where Every Process<br />Finds Its Calm
        </h1>
        <p style={{ fontSize: 16, color: '#7C8BA0', lineHeight: 1.6, marginBottom: 32 }}>
          Complete truck repair shop management. Work orders, invoicing, parts inventory, fleet tracking, and AI-powered service writing — built for heavy-duty shops.
        </p>
        <a href="/login" style={{ display: 'inline-block', padding: '14px 32px', background: '#1D6FE8', borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 700, textDecoration: 'none', boxShadow: '0 0 20px rgba(29,111,232,.3)' }}>
          Sign In
        </a>
        <div style={{ marginTop: 48, fontSize: 11, color: '#48536A' }}>
          Powered by TruckZen
        </div>
      </div>
    </div>
  )
}
