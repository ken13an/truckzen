import type { Metadata } from 'next'
import Logo from '@/components/Logo'

export const metadata: Metadata = {
  title: 'TruckZen — The Operating System for Truck Repair Shops',
  description: 'One platform for every department. Work orders, estimates, parts inventory, fleet maintenance, invoicing, and AI-powered service writing — built for heavy-duty repair shops.',
  openGraph: {
    title: 'TruckZen — The Operating System for Truck Repair Shops',
    description: 'One platform. Every department. Zero chaos.',
    url: 'https://truckzen.pro',
    type: 'website',
  },
}

const FONT = "'Instrument Sans', sans-serif"
const BLUE = '#1D6FE8'

const features = [
  {
    title: 'Service',
    desc: 'Work orders from check-in to invoice. Estimates with customer approval. Self-service kiosk. Customer portal with real-time tracking. AI that writes professional service notes in any language.',
  },
  {
    title: 'Parts & Inventory',
    desc: 'Mechanics request rough parts. Parts department sources, prices, and fulfills. Auto-pricing from your catalog. Core tracking for warranty returns. Real-time stock levels across locations.',
  },
  {
    title: 'Fleet & Maintenance',
    desc: 'Full truck profiles with 5-year service history. Warranty tracking with manufacturer, extended, and dealer scenarios. Tire lifecycle management. Mileage-based PM scheduling.',
  },
]

export default function HomePage() {
  return (
    <div style={{ background: '#060708', color: '#F0F4FF', fontFamily: FONT, minHeight: '100vh' }}>

      {/* ── NAV ── */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <Logo size="md" />
        <div style={{ display: 'flex', gap: 12 }}>
          <a href="/login" style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', color: '#F0F4FF', fontSize: 14, fontWeight: 600, textDecoration: 'none', fontFamily: FONT }}>Sign In</a>
          <a href="/register" style={{ padding: '10px 20px', borderRadius: 8, background: BLUE, color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none', fontFamily: FONT }}>Get Started</a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ textAlign: 'center', padding: '80px 24px 60px', maxWidth: 700, margin: '0 auto' }}>
        <h1 style={{ fontSize: 48, fontWeight: 800, lineHeight: 1.15, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
          The Operating System<br />for Truck Repair Shops
        </h1>
        <p style={{ fontSize: 20, color: '#7C8BA0', lineHeight: 1.5, margin: '0 0 40px' }}>
          One platform. Every department. Zero chaos.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/register" style={{ padding: '14px 36px', borderRadius: 10, background: BLUE, color: '#fff', fontSize: 16, fontWeight: 700, textDecoration: 'none', fontFamily: FONT, boxShadow: '0 0 30px rgba(29,111,232,.25)' }}>
            Get Started
          </a>
          <a href="/login" style={{ padding: '14px 36px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', color: '#F0F4FF', fontSize: 16, fontWeight: 600, textDecoration: 'none', fontFamily: FONT }}>
            Sign In
          </a>
        </div>
      </section>

      {/* ── WHAT WE DO ── */}
      <section style={{ padding: '40px 24px 60px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {features.map(f => (
            <div key={f.title} style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '28px 24px' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 10px', color: '#F0F4FF' }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: '#7C8BA0', lineHeight: 1.7, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── WHY TRUCKZEN ── */}
      <section style={{ padding: '40px 24px 60px', maxWidth: 700, margin: '0 auto' }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 16px', textAlign: 'center' }}>Built by people who understand truck shops</h2>
        <p style={{ fontSize: 15, color: '#7C8BA0', lineHeight: 1.8, margin: 0, textAlign: 'center' }}>
          Replace Fullbay, Fleetio, Monday, and QuickBooks with one platform. Multilingual for your entire team — English, Spanish, Russian, Ukrainian, Uzbek. AI-powered service writing that turns rough mechanic notes into professional repair descriptions. Your data is always yours — export anytime or build on our API.
        </p>
      </section>

      {/* ── BUILT FOR SCALE ── */}
      <section style={{ padding: '40px 24px 60px', maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 12px' }}>From 10 trucks to 10,000</h2>
        <p style={{ fontSize: 15, color: '#7C8BA0', lineHeight: 1.7, margin: 0 }}>
          TruckZen handles single-location shops and multi-location fleets with the same ease.
        </p>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '32px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#F0F4FF', marginBottom: 4 }}>truckzen.pro</div>
            <div style={{ fontSize: 12, color: '#48536A' }}>Made in Chicago</div>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[
              { label: 'Sign In', href: '/login' },
              { label: 'Get Started', href: '/register' },
              { label: 'API Docs', href: '/api-docs' },
              { label: 'Privacy', href: '/privacy' },
              { label: 'Terms', href: '/terms' },
            ].map(l => (
              <a key={l.href} href={l.href} style={{ fontSize: 13, color: '#7C8BA0', textDecoration: 'none' }}>{l.label}</a>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#48536A', marginTop: 16, textAlign: 'center' }}>
          Copyright 2026 TruckZen Inc. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
