import type { Metadata } from 'next'
import StarfieldBackground from '@/components/landing/StarfieldBackground'
import { LANDING } from '@/lib/config/colors'

export const metadata: Metadata = {
  title: 'TruckZen — Truck Repair Shop & Fleet Operations Platform',
  description: 'TruckZen is the platform for truck repair shops and fleet operations: work orders, parts, invoices, shop floor, and maintenance in one system.',
  alternates: { canonical: 'https://truckzen.pro' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'TruckZen — Truck Repair Shop & Fleet Operations Platform',
    description: 'One platform. Every department. Every language.',
    url: 'https://truckzen.pro',
    type: 'website',
    siteName: 'TruckZen',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TruckZen — Truck Repair Shop & Fleet Operations Platform',
    description: 'One platform. Every department. Every language.',
  },
}

// Landing is a branded dark marketing page (not theme-toggled in the product
// shell). All color values are sourced from the canonical LANDING palette
// in @/lib/config/colors — no hardcoded literals in this file.
const BLUE = LANDING.accent
const TEXT = LANDING.text
const DIM = LANDING.textMuted
const DIM2 = LANDING.textDim
const BORDER = LANDING.border
const GREEN = LANDING.success
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"

const secStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '120px 48px', textAlign: 'center', position: 'relative', zIndex: 1 }
const dividerStyle: React.CSSProperties = { height: 1, background: `linear-gradient(90deg, transparent, ${BORDER}, transparent)` }

function LogoMark({ size = 30 }: { size?: number }) {
  const ds = Math.round(size * 0.13)
  return (
    <div style={{ width: size, height: size, background: LANDING.logoTileBg, borderRadius: Math.round(size * 0.23), display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <span style={{ fontSize: Math.round(size * 0.4), fontWeight: 900, color: LANDING.logoTileFg }}>TZ</span>
      <span style={{ position: 'absolute', bottom: Math.round(size * 0.2), right: Math.round(size * 0.2), width: ds, height: ds, borderRadius: '50%', background: BLUE }} />
    </div>
  )
}

function Wordmark({ size = 17 }: { size?: number }) {
  return <span style={{ fontSize: size, fontWeight: 700, color: LANDING.white }}>truckzen<span style={{ color: BLUE }}>.</span></span>
}

function BrowserFrame({ children, url, accent }: { children: React.ReactNode; url: string; accent?: boolean }) {
  return (
    <div style={{ border: `1px solid ${accent ? LANDING.accentBorder : BORDER}`, borderRadius: 12, overflow: 'hidden', background: accent ? LANDING.accentBg1 : LANDING.surface1, boxShadow: accent ? `0 0 60px ${LANDING.accentBlur}` : 'none' }}>
      <div style={{ display: 'flex', gap: 6, padding: '8px 12px', borderBottom: `1px solid ${BORDER}`, background: LANDING.surface1, alignItems: 'center' }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: DIM2 }} />
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: DIM2 }} />
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: DIM2 }} />
        <span style={{ marginLeft: 10, fontSize: 9, color: DIM, padding: '2px 8px', background: LANDING.surface2, borderRadius: 4 }}>{url}</span>
      </div>
      <div style={{ padding: 24 }}>{children}</div>
    </div>
  )
}

function PlaceholderBar({ w, color }: { w: string; color: string }) {
  return <div style={{ height: 6, width: w, borderRadius: 3, background: color, marginBottom: 6 }} />
}

export default function HomePage() {
  return (
    <div style={{ background: LANDING.bg, color: TEXT, fontFamily: FONT, overflowX: 'hidden', position: 'relative', width: '100%', maxWidth: '100vw' }}>
      <StarfieldBackground />

      {/* NAV */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, padding: '16px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: LANDING.scrim, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><LogoMark /><Wordmark /></div>
        <div style={{ display: 'flex', gap: 32 }}>
          {['Platform', 'Features', 'FAQ', 'Contact'].map(l => (
            <a key={l} href={`#${l.toLowerCase()}`} style={{ fontSize: 13, color: DIM, fontWeight: 500, textDecoration: 'none' }}>{l}</a>
          ))}
        </div>
        <a href="/login" style={{ fontSize: 13, color: LANDING.white, fontWeight: 500, padding: '7px 20px', border: `1px solid ${LANDING.buttonBorder}`, borderRadius: 20, textDecoration: 'none' }}>Log In</a>
      </nav>

      {/* ── S1: HERO ── */}
      <section style={{ ...secStyle, padding: '160px 24px 120px', minHeight: '100vh', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 85% 60% at 50% 0%, ${LANDING.accentBg5} 0%, transparent 65%)`, pointerEvents: 'none', zIndex: 0 }} />
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 55% 50% at 18% 45%, ${LANDING.accentBg3} 0%, transparent 65%)`, pointerEvents: 'none', zIndex: 0 }} />
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 55% 50% at 82% 45%, ${LANDING.accentBg3} 0%, transparent 65%)`, pointerEvents: 'none', zIndex: 0 }} />
        <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 180, background: `linear-gradient(180deg, transparent 0%, ${LANDING.bg} 100%)`, pointerEvents: 'none', zIndex: 0 }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 980, width: '100%', margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', border: `1px solid ${BORDER}`, borderRadius: 20, fontSize: 11, color: DIM, fontWeight: 500, marginBottom: 36, background: LANDING.surface1, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
            <div className="tz-hero-pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: BLUE, animation: 'tz-lp-pulse 2s infinite' }} />
            Now in production
          </div>
          <h1 style={{ fontSize: 'clamp(32px, 7.5vw, 76px)', fontWeight: 800, lineHeight: 1.02, letterSpacing: '-.045em', color: LANDING.white, marginBottom: 28, maxWidth: 880, marginLeft: 'auto', marginRight: 'auto' }}>
            You run the company.<br /><span style={{ color: BLUE }}>TruckZen runs everything&nbsp;else.</span>
          </h1>
          <p style={{ fontSize: 'clamp(15px, 3vw, 20px)', color: DIM, lineHeight: 1.6, maxWidth: 600, margin: '0 auto 36px' }}>One platform for your entire heavy-duty operation.</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 40 }}>
            {['Shop', 'Fleet', 'Parts', 'People'].map(t => (
              <span key={t} style={{ padding: '6px 16px', border: `1px solid ${BORDER}`, borderRadius: 20, fontSize: 12, color: DIM, fontWeight: 500, background: LANDING.surface1, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>{t}</span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="mailto:demo@truckzen.pro" className="tz-hero-cta-primary" style={{ padding: '16px 40px', background: BLUE, color: LANDING.white, fontSize: 16, fontWeight: 700, borderRadius: 12, textDecoration: 'none', boxShadow: `0 4px 24px ${LANDING.accentShadow}`, minHeight: 44, textAlign: 'center', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}>Book a demo</a>
            <a href="#platform" className="tz-hero-cta-secondary" style={{ padding: '16px 40px', color: LANDING.white, fontSize: 16, fontWeight: 600, borderRadius: 12, border: `1px solid ${LANDING.borderStrong}`, textDecoration: 'none', minHeight: 44, textAlign: 'center', background: LANDING.surface1, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', transition: 'border-color 0.2s ease, background 0.2s ease' }}>Learn more</a>
          </div>
        </div>
        <div className="tz-hero-scroll-bob" style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', color: DIM, fontSize: 11, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, animation: 'tz-lp-bob 2s infinite', zIndex: 1 }}>
          Scroll
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4l4 4 4-4" /></svg>
        </div>
      </section>

      <div style={dividerStyle} />

      {/* ── S2: TWO PILLARS ── */}
      <section id="platform" style={{ ...secStyle, minHeight: 'auto' }}>
        <div style={{ fontSize: 12, color: DIM, textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 20, fontWeight: 600 }}>The Platform</div>
        <h2 style={{ fontSize: 'clamp(34px, 5vw, 56px)', fontWeight: 800, letterSpacing: '-.035em', color: LANDING.white, marginBottom: 12, lineHeight: 1.05 }}>Two engines. One platform.</h2>
        <p style={{ fontSize: 18, color: DIM, marginBottom: 56, maxWidth: 520, lineHeight: 1.6 }}>AI is built into every step. Not bolted on top.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: '100%', margin: '0 auto', textAlign: 'left' }}>
          <div className="tz-s2-card tz-s2-card-left" style={{ position: 'relative', overflow: 'hidden', background: LANDING.surface2, border: `1px solid ${LANDING.border}`, borderRadius: 16, padding: '48px 40px', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
            <div aria-hidden style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 60% 55% at 85% 0%, ${LANDING.accentBg4} 0%, transparent 65%)`, pointerEvents: 'none' }} />
            <div style={{ position: 'relative', width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, background: LANDING.accentBg4, border: `1px solid ${LANDING.accentBorder}` }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={BLUE} strokeWidth="1.5"><path d="M3 15V8l7-5 7 5v7" /><path d="M8 15v-4h4v4" /></svg>
            </div>
            <h3 style={{ position: 'relative', fontSize: 22, fontWeight: 700, color: LANDING.white, marginBottom: 10, letterSpacing: '-.01em' }}>Shop operations</h3>
            <p style={{ position: 'relative', fontSize: 13, color: DIM, lineHeight: 1.6, marginBottom: 24 }}>Everything from truck arrival to payment collected. AI writes service notes, classifies jobs, suggests parts.</p>
            <ul style={{ position: 'relative', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, padding: 0, margin: 0 }}>
              {['AI service writer (4 languages)', 'Work orders + estimates + invoicing', 'Parts tracking + auto reorder', 'Mechanic time clock + payroll', 'Kiosk check-in for walk-ins', 'Customer portal for approvals', 'Dynamic pricing by customer type', 'Telegram bot for remote updates'].map(i => (
                <li key={i} style={{ fontSize: 13, color: TEXT, display: 'flex', alignItems: 'center', gap: 10, lineHeight: 1.5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: BLUE, flexShrink: 0 }} />{i}
                </li>
              ))}
            </ul>
          </div>
          <div className="tz-s2-card tz-s2-card-right" style={{ position: 'relative', overflow: 'hidden', background: LANDING.surface2, border: `1px solid ${LANDING.border}`, borderRadius: 16, padding: '48px 40px', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
            <div aria-hidden style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 60% 55% at 85% 0%, ${LANDING.successBg} 0%, transparent 65%)`, pointerEvents: 'none' }} />
            <div style={{ position: 'relative', width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, background: LANDING.successBg, border: `1px solid ${LANDING.borderStrong}` }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={GREEN} strokeWidth="1.5"><rect x="2" y="8" width="16" height="7" rx="1.5" /><circle cx="5.5" cy="13.5" r="1.5" /><circle cx="14.5" cy="13.5" r="1.5" /><path d="M2 10l2.5-4h7l2.5 4" /></svg>
            </div>
            <h3 style={{ position: 'relative', fontSize: 22, fontWeight: 700, color: LANDING.white, marginBottom: 10, letterSpacing: '-.01em' }}>Fleet intelligence</h3>
            <p style={{ position: 'relative', fontSize: 13, color: DIM, lineHeight: 1.6, marginBottom: 24 }}>Know the health of every truck before it breaks down. Connected to your shop.</p>
            <ul style={{ position: 'relative', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, padding: 0, margin: 0 }}>
              {['Preventive maintenance scheduling', 'Inspections + DVIR tracking', 'Warranty + recall management', 'Fuel + expense tracking', 'Driver management', 'Telematics integration ready', 'GPS + vehicle location tracking', 'Compliance alerts + renewals'].map(i => (
                <li key={i} style={{ fontSize: 13, color: TEXT, display: 'flex', alignItems: 'center', gap: 10, lineHeight: 1.5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN, flexShrink: 0 }} />{i}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div style={dividerStyle} />

      {/* ── S3: COMPARISON — browser-frame mockups ── */}
      <section style={{ ...secStyle, minHeight: 'auto' }}>
        <div style={{ fontSize: 12, color: DIM, textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 20, fontWeight: 600 }}>Why shops are switching</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: '100%', margin: '0 auto', textAlign: 'left' }}>
          {/* Left: generic competitor */}
          <div className="tz-s3-card tz-s3-card-muted" style={{ background: LANDING.surface1, border: `1px solid ${LANDING.border}`, borderRadius: 16, padding: 28, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12, color: DIM }}>The platform you overpay for</div>
            <BrowserFrame url="legacy-platform.com">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 9, color: DIM2, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 8 }}>Dashboard</div>
                  <PlaceholderBar w="70%" color={LANDING.surface3} />
                  <PlaceholderBar w="50%" color={LANDING.surface3} />
                  <PlaceholderBar w="85%" color={LANDING.surface3} />
                </div>
                <div>
                  <div style={{ fontSize: 9, color: DIM2, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 8 }}>Work Orders</div>
                  <PlaceholderBar w="60%" color={LANDING.surface3} />
                  <PlaceholderBar w="45%" color={LANDING.surface3} />
                  <PlaceholderBar w="75%" color={LANDING.surface3} />
                </div>
                <div>
                  <div style={{ fontSize: 9, color: DIM2, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 8 }}>Invoicing</div>
                  <PlaceholderBar w="55%" color={LANDING.surface3} />
                  <PlaceholderBar w="40%" color={LANDING.surface3} />
                </div>
              </div>
            </BrowserFrame>
          </div>
          {/* Right: TruckZen */}
          <div className="tz-s3-card tz-s3-card-luminous" style={{ position: 'relative', overflow: 'hidden', background: LANDING.surface2, border: `1px solid ${LANDING.accentBorder}`, borderRadius: 16, padding: 28, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
            <div aria-hidden style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 65% 55% at 90% 0%, ${LANDING.accentBg4} 0%, transparent 65%)`, pointerEvents: 'none' }} />
            <div aria-hidden style={{ position: 'absolute', left: 28, right: 28, bottom: 0, height: 1, background: `linear-gradient(90deg, transparent 0%, ${LANDING.accentBorder} 50%, transparent 100%)`, pointerEvents: 'none' }} />
            <div style={{ position: 'relative', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12, color: BLUE }}>TruckZen. The whole operation.</div>
            <div style={{ position: 'relative' }}>
              <BrowserFrame url="truckzen.pro" accent>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {['Shop', 'Invoices', 'Fleet', 'Warranty'].map(label => (
                    <div key={label} style={{ background: LANDING.surface1, border: `1px solid ${BORDER}`, borderRadius: 6, padding: 12 }}>
                      <div style={{ fontSize: 9, color: BLUE, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 8 }}>{label}</div>
                      <PlaceholderBar w="80%" color={LANDING.accentBorder} />
                      <PlaceholderBar w="55%" color={LANDING.accentBg5} />
                      <PlaceholderBar w="65%" color={LANDING.accentBg4} />
                    </div>
                  ))}
                </div>
              </BrowserFrame>
            </div>
          </div>
        </div>
      </section>

      <div style={dividerStyle} />

      {/* ── S4: FEATURES 2x2 ── */}
      <section id="features" style={{ ...secStyle, minHeight: 'auto' }}>
        <div style={{ fontSize: 12, color: DIM, textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 20, fontWeight: 600 }}>Built Different</div>
        <h2 style={{ fontSize: 'clamp(34px, 5vw, 56px)', fontWeight: 800, letterSpacing: '-.035em', color: LANDING.white, marginBottom: 12, lineHeight: 1.05 }}>What you get that nobody else offers.</h2>
        <p style={{ fontSize: 18, color: DIM, marginBottom: 56, maxWidth: 560, lineHeight: 1.6 }}>Every feature built from real shop problems, not a product roadmap.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 900, margin: '0 auto', textAlign: 'left' }}>
          {[
            { t: 'Multilingual AI, native', d: 'AI that understands Russian, Spanish, Uzbek, and English natively. Built into every input across the platform.' },
            { t: 'Runs on any device', d: 'Web, iOS, Android, and kiosk. Mechanic on the floor, manager at home, owner on a plane.' },
            { t: 'Free data migration', d: 'Complete history from your current platform. Zero cost. Days, not months.' },
            { t: 'Shop + fleet, connected', d: 'Repair history flows into fleet health. Fleet alerts create work orders. One system.' },
          ].map(f => (
            <div key={f.t} className="tz-s4-card" style={{ position: 'relative', overflow: 'hidden', background: LANDING.surface1, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '36px 32px', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
              <div aria-hidden style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 60% 55% at 12% 0%, ${LANDING.accentBg3} 0%, transparent 65%)`, pointerEvents: 'none' }} />
              <div aria-hidden className="tz-s4-sweep" style={{ position: 'absolute', left: 24, right: 24, bottom: 0, height: 1, background: `linear-gradient(90deg, transparent 0%, ${LANDING.accentBorder} 50%, transparent 100%)`, pointerEvents: 'none' }} />
              <h3 style={{ position: 'relative', fontSize: 18, fontWeight: 700, color: LANDING.white, marginBottom: 10, letterSpacing: '-.01em' }}>{f.t}</h3>
              <p style={{ position: 'relative', fontSize: 14, color: DIM, lineHeight: 1.6, margin: 0 }}>{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <div style={dividerStyle} />

      {/* ── S5: GET STARTED ── */}
      <section style={{ ...secStyle, minHeight: 'auto' }}>
        <h2 style={{ fontSize: 'clamp(34px, 5vw, 56px)', fontWeight: 800, letterSpacing: '-.035em', color: LANDING.white, marginBottom: 56, lineHeight: 1.05 }}>Running in days, not months.</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, maxWidth: 900, margin: '0 auto', textAlign: 'left' }}>
          {[
            { n: '1', t: 'We migrate your data', d: 'Complete history imported at no cost. Your team never has to re-enter anything.' },
            { n: '2', t: 'Set up your team', d: 'Bulk import staff. Assign roles. Configure bays. Your team is ready same day.' },
            { n: '3', t: 'Run your operation', d: 'Shop, fleet, parts, people. AI handles the paperwork. You run the business.' },
          ].map(s => (
            <div key={s.n} className="tz-s5-card" style={{ position: 'relative', overflow: 'hidden', background: LANDING.surface1, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '36px 28px', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
              <div aria-hidden style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 60% 55% at 88% 0%, ${LANDING.accentBg3} 0%, transparent 65%)`, pointerEvents: 'none' }} />
              <div aria-hidden style={{ position: 'absolute', left: -20, top: -20, width: 120, height: 120, borderRadius: '50%', background: `radial-gradient(circle, ${LANDING.accentBg4} 0%, transparent 70%)`, pointerEvents: 'none' }} />
              <div aria-hidden className="tz-s5-sweep" style={{ position: 'absolute', left: 24, right: 24, bottom: 0, height: 1, background: `linear-gradient(90deg, transparent 0%, ${LANDING.accentBorder} 50%, transparent 100%)`, pointerEvents: 'none' }} />
              <div style={{ position: 'relative', fontSize: 48, fontWeight: 800, color: BLUE, lineHeight: 1, marginBottom: 14, letterSpacing: '-.04em' }}>{s.n}</div>
              <h3 style={{ position: 'relative', fontSize: 16, fontWeight: 700, color: LANDING.white, marginBottom: 10, letterSpacing: '-.01em' }}>{s.t}</h3>
              <p style={{ position: 'relative', fontSize: 13, color: DIM, lineHeight: 1.6, margin: 0 }}>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <div style={dividerStyle} />

      {/* ── S6: APP STORE + TRUST ── */}
      <section style={{ ...secStyle, minHeight: 'auto', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 70% 50% at 50% 0%, ${LANDING.accentBg3} 0%, transparent 65%)`, pointerEvents: 'none' }} />
        <h2 style={{ position: 'relative', fontSize: 'clamp(34px, 5vw, 56px)', fontWeight: 800, letterSpacing: '-.035em', color: LANDING.white, marginBottom: 12, lineHeight: 1.05 }}>Available everywhere.</h2>
        <p style={{ position: 'relative', fontSize: 18, color: DIM, marginBottom: 48, maxWidth: 520, lineHeight: 1.6 }}>Your team accesses TruckZen from whatever device they have in hand.</p>
        <div style={{ position: 'relative', display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 56, flexWrap: 'wrap' }}>
          {['App Store', 'Google Play', 'Web Browser'].map(b => (
            <div key={b} className="tz-s6-badge" style={{ padding: '12px 28px', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 14, fontWeight: 600, color: LANDING.white, background: LANDING.surface1, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>{b}</div>
          ))}
        </div>
        <div style={{ position: 'relative', display: 'flex', gap: 32, justifyContent: 'center', flexWrap: 'wrap' }}>
          {['256-bit encryption', '99.9% uptime', 'Role-based access', 'Daily backups'].map(tr => (
            <div key={tr} style={{ fontSize: 12, color: DIM, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: BLUE, boxShadow: `0 0 8px ${LANDING.accentShadow}`, flexShrink: 0 }} />{tr}
            </div>
          ))}
        </div>
      </section>

      <div style={dividerStyle} />

      {/* ── S7: VISION ── */}
      <section style={{ ...secStyle, minHeight: 'auto' }}>
        <div style={{ position: 'relative', overflow: 'hidden', maxWidth: 800, margin: '0 auto', border: `1px solid ${LANDING.accentBorder}`, borderRadius: 16, padding: 48, background: LANDING.accentBg2, textAlign: 'left', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
          <div aria-hidden style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 60% 55% at 88% 0%, ${LANDING.accentBg4} 0%, transparent 65%)`, pointerEvents: 'none' }} />
          <div aria-hidden style={{ position: 'absolute', left: 40, right: 40, bottom: 0, height: 1, background: `linear-gradient(90deg, transparent 0%, ${LANDING.accentBorder} 50%, transparent 100%)`, pointerEvents: 'none' }} />
          <h3 style={{ position: 'relative', fontSize: 28, fontWeight: 700, color: LANDING.white, marginBottom: 16, letterSpacing: '-.01em' }}>Where we&apos;re headed</h3>
          <p style={{ position: 'relative', fontSize: 16, color: DIM, lineHeight: 1.7, margin: 0 }}>TruckZen is building toward a future where trucks communicate directly with shops. Predictive maintenance before breakdowns happen. Automated repair authorization for autonomous fleets. The infrastructure for the next era of heavy-duty starts here.</p>
        </div>
      </section>

      <div style={dividerStyle} />

      {/* ── S8: FAQ ── */}
      <section id="faq" style={{ ...secStyle, minHeight: 'auto' }}>
        <h2 style={{ fontSize: 56, fontWeight: 800, letterSpacing: '-.03em', color: LANDING.white, marginBottom: 48 }}>FAQ</h2>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'left' }}>
          {[
            { q: 'Is TruckZen only for repair shops?', a: 'No. TruckZen serves shops, fleets, and operations that run both. The platform connects repair operations to fleet management in one system.' },
            { q: 'How long does setup take?', a: '1\u20132 weeks total. Data migration takes 3\u20135 days. Your team can start using the platform the same day it\u2019s configured.' },
            { q: 'What devices does it run on?', a: 'iOS, Android, web browser, and kiosk mode. Your team uses whatever device they already have.' },
            { q: 'What languages does the AI support?', a: 'English, Russian, Spanish, and Uzbek. The AI understands all four natively and converts to professional English repair descriptions.' },
            { q: 'Can I migrate from my current platform?', a: 'Yes. Complete history \u2014 work orders, customers, units, parts, invoices. Zero cost migration. We handle everything.' },
            { q: 'Is there a long-term contract?', a: 'No. Month-to-month. Cancel anytime.' },
          ].map(f => (
            <div key={f.q} style={{ borderBottom: `1px solid ${BORDER}`, padding: '20px 0' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: LANDING.white, marginBottom: 8 }}>{f.q}</div>
              <div style={{ fontSize: 14, color: DIM, lineHeight: 1.6 }}>{f.a}</div>
            </div>
          ))}
        </div>
      </section>

      <div style={dividerStyle} />

      {/* ── S9: BOTTOM CTA ── */}
      <section id="contact" style={secStyle}>
        <h2 style={{ fontSize: 56, fontWeight: 800, letterSpacing: '-.03em', color: LANDING.white, marginBottom: 8, lineHeight: 1.1 }}>
          The future of heavy-duty<br /><span style={{ color: BLUE }}>starts here.</span>
        </h2>
        <p style={{ fontSize: 18, color: DIM, maxWidth: 520, margin: '0 auto 32px' }}>See how TruckZen connects your shop, your fleet, and your people.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24 }}>
          <a href="mailto:demo@truckzen.pro" style={{ padding: '14px 36px', background: BLUE, color: LANDING.white, fontSize: 16, fontWeight: 700, borderRadius: 12, textDecoration: 'none', boxShadow: `0 4px 24px ${LANDING.accentShadow}` }}>Book a demo</a>
          <a href="mailto:info@truckzen.pro" style={{ padding: '14px 36px', color: LANDING.white, fontSize: 16, fontWeight: 600, borderRadius: 12, border: `1px solid ${LANDING.borderStrong}`, textDecoration: 'none' }}>Contact us</a>
        </div>
        <div style={{ fontSize: 13, color: DIM }}>
          <a href="mailto:demo@truckzen.pro" style={{ color: BLUE, textDecoration: 'none' }}>demo@truckzen.pro</a>
          {' \u00B7 '}
          <a href="mailto:info@truckzen.pro" style={{ color: BLUE, textDecoration: 'none' }}>info@truckzen.pro</a>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: '64px 48px 32px', borderTop: `1px solid ${BORDER}`, maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 32, marginBottom: 48, textAlign: 'left' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><LogoMark size={28} /><Wordmark size={16} /></div>
            <div style={{ fontSize: 13, color: DIM, lineHeight: 1.6, maxWidth: 280 }}>The heavy-duty platform that connects your shop, your fleet, and your people. Built in Chicago.</div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              {[
                { t: 'LinkedIn', d: 'M19 0h-14c-2.76 0-5 2.24-5 5v14c0 2.76 2.24 5 5 5h14c2.76 0 5-2.24 5-5v-14c0-2.76-2.24-5-5-5zm-11 19h-3v-10h3v10zm-1.5-11.27c-.97 0-1.75-.79-1.75-1.76s.78-1.76 1.75-1.76 1.75.79 1.75 1.76-.78 1.76-1.75 1.76zm13.5 11.27h-3v-5.6c0-3.37-4-3.12-4 0v5.6h-3v-10h3v1.77c1.4-2.59 7-2.78 7 2.48v5.75z' },
                { t: 'YouTube', d: 'M23.5 6.2c-.2-.7-.7-1.2-1.4-1.4C20.2 4.2 12 4.2 12 4.2s-8.2 0-10.1.6c-.7.2-1.2.7-1.4 1.4C0 8.1 0 12 0 12s0 3.9.5 5.8c.2.7.7 1.2 1.4 1.4 1.9.6 10.1.6 10.1.6s8.2 0 10.1-.6c.7-.2 1.2-.7 1.4-1.4.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.5 15.6V8.4l6.8 3.6-6.8 3.6z' },
              ].map(s => (
                <a key={s.t} href="#" style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: DIM, textDecoration: 'none' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d={s.d} /></svg>
                </a>
              ))}
            </div>
          </div>
          {[
            { h: 'Platform', links: ['Shop operations', 'Fleet intelligence', 'Parts management', 'AI service writer', 'Kiosk check-in', 'Customer portal'] },
            { h: 'Company', links: ['About', 'Blog', 'Careers', 'Contact', 'Book a demo'] },
            { h: 'Support', links: ['Help center', 'API docs'], email: 'support@truckzen.pro' },
          ].map(col => (
            <div key={col.h} style={{ textAlign: 'left' }}>
              <h4 style={{ fontSize: 11, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 16 }}>{col.h}</h4>
              {col.links.map(l => (
                <a key={l} href="#" style={{ display: 'block', fontSize: 13, color: LANDING.textQuiet, padding: '4px 0', textDecoration: 'none' }}>{l}</a>
              ))}
              {col.email && <a href={`mailto:${col.email}`} style={{ display: 'block', fontSize: 13, color: LANDING.textQuiet, padding: '4px 0', textDecoration: 'none' }}>{col.email}</a>}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 24, borderTop: `1px solid ${BORDER}`, fontSize: 11, color: LANDING.textFaint }}>
          <span>&copy; 2026 TruckZen. All rights reserved.</span>
          <div>
            <a href="/privacy" style={{ color: LANDING.textFaint, marginLeft: 16, textDecoration: 'none' }}>Privacy</a>
            <a href="/terms" style={{ color: LANDING.textFaint, marginLeft: 16, textDecoration: 'none' }}>Terms</a>
            <a href="#" style={{ color: LANDING.textFaint, marginLeft: 16, textDecoration: 'none' }}>Security</a>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes tz-lp-pulse { 0%,100% { opacity:1 } 50% { opacity:.4 } }
        @keyframes tz-lp-bob { 0%,100% { transform:translateX(-50%) translateY(0) } 50% { transform:translateX(-50%) translateY(6px) } }
        .tz-hero-cta-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 32px ${LANDING.accentShadow}; }
        .tz-hero-cta-secondary:hover { border-color: ${LANDING.buttonBorder}; background: ${LANDING.surface2}; }
        .tz-hero-cta-primary:focus-visible,
        .tz-hero-cta-secondary:focus-visible { outline: 2px solid ${LANDING.white}; outline-offset: 3px; }
        .tz-s2-card { transition: border-color 0.3s ease, background 0.3s ease; }
        .tz-s2-card:hover { background: ${LANDING.surface3}; }
        .tz-s2-card-left:hover { border-color: ${LANDING.accentBorder}; }
        .tz-s2-card-right:hover { border-color: ${LANDING.borderStrong}; }
        .tz-s3-card { transition: border-color 0.3s ease, background 0.3s ease; }
        .tz-s3-card-muted:hover { border-color: ${LANDING.borderStrong}; background: ${LANDING.surface2}; }
        .tz-s3-card-luminous:hover { border-color: ${LANDING.buttonBorder}; }
        .tz-s4-card { transition: border-color 0.3s ease, background 0.3s ease; }
        .tz-s4-card:hover { border-color: ${LANDING.accentBorder}; background: ${LANDING.surface2}; }
        .tz-s4-card .tz-s4-sweep { opacity: 0; transition: opacity 0.4s ease; }
        .tz-s4-card:hover .tz-s4-sweep { opacity: 1; }
        .tz-s5-card { transition: border-color 0.3s ease, background 0.3s ease; }
        .tz-s5-card:hover { border-color: ${LANDING.accentBorder}; background: ${LANDING.surface2}; }
        .tz-s5-card .tz-s5-sweep { opacity: 0; transition: opacity 0.4s ease; }
        .tz-s5-card:hover .tz-s5-sweep { opacity: 1; }
        .tz-s6-badge { transition: border-color 0.3s ease, background 0.3s ease; }
        .tz-s6-badge:hover { border-color: ${LANDING.accentBorder}; background: ${LANDING.surface2}; }
        @media (prefers-reduced-motion: reduce) {
          .tz-hero-pulse-dot,
          .tz-hero-scroll-bob { animation: none !important; }
          .tz-hero-cta-primary,
          .tz-hero-cta-secondary,
          .tz-s2-card,
          .tz-s3-card,
          .tz-s4-card,
          .tz-s4-card .tz-s4-sweep,
          .tz-s5-card,
          .tz-s5-card .tz-s5-sweep,
          .tz-s6-badge { transition: none; }
          .tz-hero-cta-primary:hover { transform: none; }
        }
      `}</style>
    </div>
  )
}
