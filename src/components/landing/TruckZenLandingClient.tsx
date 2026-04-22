'use client'

import { useEffect, useRef, useState } from 'react'

const BG_IMAGES = [
  '/landing/generated/bg-01-industrial-lot.png',
  '/landing/generated/bg-02-truck-yard.png',
  '/landing/generated/bg-03-mountain-drive.png',
  '/landing/generated/bg-04-sunset-highway.png',
  '/landing/generated/bg-05-service-bay.png',
  '/landing/generated/bg-06-maintenance-bay.png',
  '/landing/generated/bg-07-control-room.png',
  '/landing/generated/bg-08-dispatch-workstation.png',
]

const HERO_SLIDES = [
  {
    title: (
      <>
        You run the company. <span>TruckZen</span> runs the paperwork.
      </>
    ),
    sub: 'From work order to invoice — service writers, mechanics, parts, fleet, and accounting connected in one operating system.',
  },
  {
    title: (
      <>
        Every truck. <span>Every repair.</span> One truth.
      </>
    ),
    sub: 'Truck repair history, parts tracking, and telematics-ready architecture — from the bay to the road to the office.',
  },
  {
    title: (
      <>
        Built for the <span>shop floor.</span> Ready for fleet scale.
      </>
    ),
    sub: 'Give mechanics, service writers, and fleet managers exactly what they need — on any device, in real time.',
  },
]

const ROLES = [
  {
    label: 'Owner / GM',
    glyph: 'O',
    h: 'See the full operation in one place.',
    p: 'Know what is making money, what is slowing you down, and what needs attention — all from a single dashboard.',
  },
  {
    label: 'Service Writer',
    glyph: 'S',
    h: 'Open, manage, and control work orders.',
    p: 'Everything you need is already in the system. No phone calls to find out status. No manual lookups.',
  },
  {
    label: 'Mechanic',
    glyph: 'M',
    h: 'See assigned jobs, parts status, and time clearly.',
    p: 'No confusion, no missing info. Just the job in front of you.',
  },
  {
    label: 'Parts',
    glyph: 'P',
    h: 'Track requests, availability, and orders.',
    p: 'No guessing what parts are for. Every request comes with context.',
  },
  {
    label: 'Accounting',
    glyph: 'A',
    h: 'From completed job to sent invoice to paid status.',
    p: 'No re-entry. When the job closes, accounting already has what it needs.',
  },
  {
    label: 'Fleet / Maintenance',
    glyph: 'F',
    h: 'Track every unit, repair, and dollar spent.',
    p: 'Know what is happening before it becomes a problem.',
  },
]

const STATS = [
  { v: '1', l: 'Operating system' },
  { v: '0', l: 'Duplicate entry goal' },
  { v: 'AI', l: 'Workflow assistance' },
  { v: '24/7', l: 'Visibility mindset' },
]

const PHOTOS = [
  { idx: 4, label: 'Service Bay' },
  { idx: 1, label: 'Fleet Yard' },
  { idx: 3, label: 'On the Road' },
  { idx: 0, label: 'Truck Portrait' },
]

export default function TruckZenLandingClient() {
  const [heroSlide, setHeroSlide] = useState(0)
  const [bgA, setBgA] = useState(BG_IMAGES[0])
  const [bgB, setBgB] = useState(BG_IMAGES[1])
  const [activeLayer, setActiveLayer] = useState<'a' | 'b'>('a')
  const [roleIndex, setRoleIndex] = useState(0)
  const userOverrideRef = useRef(false)
  const bgIndexRef = useRef(0)
  const activeLayerRef = useRef<'a' | 'b'>('a')

  function commitBackground(index: number) {
    const normalized = ((index % BG_IMAGES.length) + BG_IMAGES.length) % BG_IMAGES.length
    if (normalized === bgIndexRef.current) return
    bgIndexRef.current = normalized
    const nextImg = BG_IMAGES[normalized]
    if (activeLayerRef.current === 'a') {
      setBgB(nextImg)
      requestAnimationFrame(() => {
        setActiveLayer('b')
        activeLayerRef.current = 'b'
      })
    } else {
      setBgA(nextImg)
      requestAnimationFrame(() => {
        setActiveLayer('a')
        activeLayerRef.current = 'a'
      })
    }
  }

  // Hero auto-rotation (title + subtitle + dots) — 6s
  useEffect(() => {
    const id = window.setInterval(() => {
      if (userOverrideRef.current) return
      setHeroSlide(prev => {
        const next = (prev + 1) % HERO_SLIDES.length
        commitBackground(next)
        return next
      })
    }, 6000)
    return () => window.clearInterval(id)
  }, [])

  function goToHeroSlide(n: number) {
    userOverrideRef.current = false
    setHeroSlide(n)
    commitBackground(n)
  }

  // Section-aware background + reveal-on-scroll
  useEffect(() => {
    const sectionObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return
          const slide = (entry.target as HTMLElement).dataset.slide
          if (entry.target.id === 'hero-section') {
            userOverrideRef.current = false
          } else if (slide !== undefined) {
            userOverrideRef.current = true
            commitBackground(Number(slide))
          }
        })
      },
      { threshold: 0.35 },
    )
    document.querySelectorAll<HTMLElement>('[data-slide], #hero-section').forEach(el => sectionObserver.observe(el))

    const revealObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) entry.target.classList.add('in')
        })
      },
      { threshold: 0.12 },
    )
    document.querySelectorAll('.tz-reveal').forEach(el => revealObserver.observe(el))

    return () => {
      sectionObserver.disconnect()
      revealObserver.disconnect()
    }
  }, [])

  function scrollTo(selector: string) {
    const el = document.querySelector(selector)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="tz-lp">
      {/* Fixed background image layer with 2-image crossfade */}
      <div className="tz-bg" aria-hidden>
        <img src={bgA} className={activeLayer === 'a' ? 'tz-bg-img active' : 'tz-bg-img'} alt="" />
        <img src={bgB} className={activeLayer === 'b' ? 'tz-bg-img active' : 'tz-bg-img'} alt="" />
        <div className="tz-bg-dark" />
        <div className="tz-bg-grid" />
      </div>

      {/* Floating rounded navbar */}
      <nav className="tz-nav">
        <div className="tz-nav-inner">
          <div className="tz-brand">
            <div className="tz-logo">TZ</div>
            <div className="tz-brand-name">truckzen<span>.</span></div>
          </div>
          <div className="tz-links">
            <button type="button" onClick={() => scrollTo('#shop-fleet')}>Shop &amp; Fleet</button>
            <button type="button" onClick={() => scrollTo('#workflow')}>Workflow</button>
            <button type="button" onClick={() => scrollTo('#roles')}>Roles</button>
            <button type="button" onClick={() => scrollTo('#why')}>Why TruckZen</button>
          </div>
          <a href="/login" className="tz-login">Log In</a>
        </div>
      </nav>

      <main className="tz-page">
        <div id="hero-section">
          <section className="tz-hero">
            <div className="tz-hero-orb" aria-hidden />
            <div className="tz-hero-inner">
              <div className="tz-eyebrow">One Operating System. Every Department.</div>
              <div className="tz-hero-title">
                {HERO_SLIDES.map((s, i) => (
                  <div key={i} className={`tz-title-slide${i === heroSlide ? ' active' : ''}`}>
                    <h1>{s.title}</h1>
                  </div>
                ))}
              </div>
              <div className="tz-hero-sub">
                {HERO_SLIDES.map((s, i) => (
                  <div key={i} className={`tz-sub-slide${i === heroSlide ? ' active' : ''}`}>{s.sub}</div>
                ))}
              </div>
              <div className="tz-dots">
                {HERO_SLIDES.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Go to slide ${i + 1}`}
                    className={`tz-dot${i === heroSlide ? ' active' : ''}`}
                    onClick={() => goToHeroSlide(i)}
                  />
                ))}
              </div>
              <div className="tz-cta">
                <a href="mailto:demo@truckzen.pro" className="tz-primary-btn">Book a Demo →</a>
              </div>
            </div>
            <button type="button" className="tz-chev" aria-label="Scroll" onClick={() => scrollTo('#trust')}>⌄</button>
          </section>
        </div>

        {/* Two Engines */}
        <section className="tz-section tz-section-lg">
          <div className="tz-container tz-center tz-reveal">
            <h2>Two engines. One platform.</h2>
            <p className="tz-lead">AI is built into every step. Not bolted on top.</p>
          </div>
          <div className="tz-container tz-grid-2">
            <div className="tz-card tz-card-blue tz-reveal">
              <div className="tz-icon">⌂</div>
              <h3>Shop operations</h3>
              <p>Everything from truck arrival to payment collected. AI-assisted workflow writes service notes, classifies jobs, suggests parts.</p>
              <ul className="tz-clean">
                <li>AI-assisted service writer</li>
                <li>Work orders + estimates + invoicing</li>
                <li>Parts tracking + readiness states</li>
                <li>Mechanic workflow + time tracking</li>
                <li>Kiosk check-in for walk-ins</li>
                <li>Customer portal for approvals</li>
              </ul>
            </div>
            <div className="tz-card tz-card-green tz-reveal">
              <div className="tz-icon tz-icon-green">▰</div>
              <h3>Fleet intelligence</h3>
              <p>Know the health of every truck before it breaks down. Connected to your shop.</p>
              <ul className="tz-clean">
                <li>Preventive maintenance scheduling</li>
                <li>Inspections + DVIR tracking</li>
                <li>Warranty + recall management</li>
                <li>Fuel + expense tracking</li>
                <li>Driver management</li>
                <li>Telematics-ready architecture</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Stats — safe alternatives per patch PART D */}
        <div data-slide="3">
          <section className="tz-stats">
            <div className="tz-container tz-stats-grid tz-reveal">
              {STATS.map(s => (
                <div key={s.l}>
                  <div className="tz-stat-val">{s.v}</div>
                  <div className="tz-stat-label">{s.l}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Trust / Positioning */}
        <div data-slide="2">
          <section id="trust" className="tz-section tz-section-lg">
            <div className="tz-container tz-center tz-reveal">
              <div className="tz-kicker">Positioning</div>
              <h2>Built for real heavy-duty operations.<br /><span className="tz-muted">Not generic software.</span></h2>
              <p className="tz-lead">TruckZen is designed for companies running trucks every day — not for office-only workflows.</p>
            </div>
            <div className="tz-container tz-grid-3">
              <div className="tz-card tz-reveal"><div className="tz-icon tz-icon-gold">T</div><p>Built around daily truck operations — not generic business logic.</p></div>
              <div className="tz-card tz-reveal"><div className="tz-icon tz-icon-gold">W</div><p>Every feature maps directly to how your shop and fleet actually function.</p></div>
              <div className="tz-card tz-reveal"><div className="tz-icon tz-icon-gold">U</div><p>Designed for the people in the bay, on the road, and in the office.</p></div>
            </div>
          </section>
        </div>

        {/* Shop + Fleet */}
        <div data-slide="4">
          <section id="shop-fleet" className="tz-section tz-section-lg">
            <div className="tz-container tz-split">
              <div className="tz-reveal">
                <div className="tz-kicker">Shop + Fleet</div>
                <h2>The shop and the fleet.<br /><span className="tz-muted">Finally connected.</span></h2>
                <p className="tz-lead" style={{ marginLeft: 0 }}>Work orders don&apos;t live in isolation anymore. Truck health, fault data, and service history flow directly into your shop workflow.</p>
                <ul className="tz-clean">
                  <li>Open work orders from real issues</li>
                  <li>See truck status before it enters the bay</li>
                  <li>Keep service, parts, and fleet in sync</li>
                </ul>
              </div>
              <div className="tz-mock-card tz-reveal">
                <div className="tz-status-row"><div><strong>Unit #1847 — Fault Code P0191</strong><small>Open</small></div><span>15%</span></div>
                <div className="tz-status-row"><div><strong>Unit #2203 — Oil Change Due</strong><small>Scheduled</small></div><span>30%</span></div>
                <div className="tz-status-row"><div><strong>Unit #0984 — Brake Inspection</strong><small>In Bay</small></div><span>60%</span></div>
                <div className="tz-status-row"><div><strong>Unit #1120 — Tire Rotation</strong><small>Completed</small></div><span>100%</span></div>
              </div>
            </div>
          </section>
        </div>

        {/* Workflow */}
        <div data-slide="5">
          <section id="workflow" className="tz-section tz-section-lg">
            <div className="tz-container tz-center tz-reveal">
              <div className="tz-kicker">Parts + Accounting + Workflow</div>
              <h2>From parts to invoice.<br /><span className="tz-muted">One continuous flow.</span></h2>
              <p className="tz-lead">No more broken handoffs between departments. Everything stays connected. Nothing gets lost.</p>
            </div>
            <div className="tz-container tz-workflow tz-reveal">
              <div className="tz-step"><strong>Parts Request</strong><small>Technician flags what&apos;s needed</small></div>
              <div className="tz-step"><strong>Real Parts</strong><small>Ordered, received, tracked</small></div>
              <div className="tz-step"><strong>Job Lines</strong><small>Auto-attached to the work order</small></div>
              <div className="tz-step"><strong>Invoice</strong><small>Generated without re-entry</small></div>
              <div className="tz-step"><strong>Revenue</strong><small>Settled and recorded</small></div>
            </div>
          </section>
        </div>

        {/* Roles interactive */}
        <div data-slide="7">
          <section id="roles" className="tz-section tz-section-lg">
            <div className="tz-container tz-center tz-reveal">
              <div className="tz-kicker">Role-Based</div>
              <h2>Built for how your team<br /><span className="tz-muted">actually works.</span></h2>
            </div>
            <div className="tz-container tz-roles">
              <div className="tz-role-list tz-reveal">
                {ROLES.map((r, i) => (
                  <button
                    key={r.label}
                    type="button"
                    className={`tz-role-button${i === roleIndex ? ' active' : ''}`}
                    onClick={() => setRoleIndex(i)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="tz-card tz-reveal">
                {ROLES.map((r, i) => (
                  <div key={r.label} className={`tz-role-copy${i === roleIndex ? ' active' : ''}`}>
                    <div className="tz-icon tz-icon-gold">{r.glyph}</div>
                    <h3>{r.h}</h3>
                    <p>{r.p}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Why TruckZen comparison */}
        <div data-slide="6">
          <section id="why" className="tz-section tz-section-lg">
            <div className="tz-container tz-center tz-reveal">
              <div className="tz-kicker">Why TruckZen</div>
              <h2>This is not another tool.<br /><span className="tz-muted">This is your operating system.</span></h2>
            </div>
            <div className="tz-container tz-compare">
              <div className="tz-card tz-reveal">
                <h3>Most companies are running</h3>
                <ul className="tz-clean">
                  <li>One system for shop</li>
                  <li>One for fleet</li>
                  <li>One for accounting</li>
                  <li>Spreadsheets for everything else</li>
                </ul>
              </div>
              <div className="tz-card tz-reveal">
                <h3>TruckZen replaces all of it</h3>
                <ul className="tz-clean">
                  <li>One connected operating system</li>
                  <li>Shop, fleet, and accounting in sync</li>
                  <li>Real-time data across every department</li>
                  <li>No more spreadsheets. No more gaps.</li>
                </ul>
              </div>
            </div>
          </section>
        </div>

        {/* Live Fleet visual */}
        <div data-slide="1">
          <section className="tz-section tz-section-lg">
            <div className="tz-container tz-center tz-reveal">
              <div className="tz-kicker">Live Fleet</div>
              <h2>Every truck. Right now.</h2>
              <p className="tz-lead">Real-time visibility across your entire fleet — location, status, and alerts in one view.</p>
            </div>
            <div className="tz-container tz-fleet-grid">
              <div
                className="tz-fleet-image tz-reveal"
                style={{ backgroundImage: `url(${BG_IMAGES[7]})` }}
              />
              <div className="tz-truck-list tz-reveal">
                <button type="button" className="tz-truck-item"><strong>T-1847 <span style={{ color: '#4ade80' }}>Active</span></strong><p>Mike Torres · 62 mph</p></button>
                <button type="button" className="tz-truck-item"><strong>T-2203 <span style={{ color: '#fbbf24' }}>Needs Attn</span></strong><p>Sarah Chen · Service Check</p></button>
                <button type="button" className="tz-truck-item"><strong>T-0984 <span style={{ color: '#4ade80' }}>Active</span></strong><p>James Ruiz · 71 mph</p></button>
                <button type="button" className="tz-truck-item"><strong>T-1120 <span>Idle</span></strong><p>Dana Kowalski · Awaiting Load</p></button>
              </div>
            </div>
          </section>
        </div>

        {/* Product walkthrough / video placeholder + photo grid */}
        <div data-slide="1">
          <section id="video" className="tz-section tz-section-lg">
            <div className="tz-container tz-center tz-reveal">
              <div className="tz-kicker">Product Walkthrough</div>
              <h2>See TruckZen in action</h2>
              <p className="tz-lead">Watch how fleet operators run their entire company from a single screen.</p>
            </div>
            <div className="tz-container">
              <div
                className="tz-video tz-reveal"
                style={{ backgroundImage: `url(${BG_IMAGES[6]})` }}
              >
                <div className="tz-play">▶</div>
              </div>
              <div className="tz-photos tz-reveal">
                {PHOTOS.map(p => (
                  <div key={p.label} className="tz-photo">
                    <img src={BG_IMAGES[p.idx]} alt={p.label} />
                    <span>{p.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="tz-footer">
        <div className="tz-container tz-footer-grid">
          <div>
            <div className="tz-brand"><div className="tz-logo">TZ</div><div className="tz-brand-name">truckzen<span>.</span></div></div>
            <p>The heavy-duty platform that connects your shop, your fleet, and your people.</p>
          </div>
          <div>
            <h3>Platform</h3>
            <div className="tz-footer-list">
              <button type="button">Shop operations</button>
              <button type="button">Fleet intelligence</button>
              <button type="button">Parts management</button>
              <button type="button">AI-assisted workflow</button>
            </div>
          </div>
          <div>
            <h3>Company</h3>
            <div className="tz-footer-list">
              <button type="button">About</button>
              <button type="button">Blog</button>
              <button type="button">Careers</button>
              <button type="button">Contact</button>
            </div>
          </div>
          <div>
            <h3>Support</h3>
            <div className="tz-footer-list">
              <button type="button">Help center</button>
              <button type="button">API docs</button>
              <a href="mailto:support@truckzen.pro">support@truckzen.pro</a>
            </div>
          </div>
        </div>
        <div className="tz-container tz-bottom">
          <span>© 2026 TruckZen. All rights reserved.</span>
          <span>
            <a href="/privacy">Privacy</a>{' · '}<a href="/terms">Terms</a>{' · Security'}
          </span>
        </div>
      </footer>

      <style>{`
        .tz-lp { min-height: 100vh; color: #f1f2f5; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif; overflow-x: hidden; position: relative; background: hsl(220 14% 5%); }
        .tz-lp * { box-sizing: border-box; }
        .tz-lp button { font-family: inherit; }

        .tz-bg { position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 0; }
        .tz-bg-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 2s ease-in-out; }
        .tz-bg-img.active { opacity: .48; }
        .tz-bg-dark { position: absolute; inset: 0; background:
          radial-gradient(ellipse 80% 50% at 50% 0%, rgba(59,130,246,.09) 0%, transparent 70%),
          radial-gradient(ellipse 100% 40% at 50% 100%, rgba(0,0,0,.7) 0%, transparent 70%),
          radial-gradient(ellipse 30% 100% at 0% 50%, rgba(0,0,0,.5) 0%, transparent 70%),
          radial-gradient(ellipse 30% 100% at 100% 50%, rgba(0,0,0,.5) 0%, transparent 70%),
          hsl(220 14% 5% / .55);
        }
        .tz-bg-grid { position: absolute; inset: 0; opacity: .045; background-image:
          linear-gradient(hsl(220 10% 18%) 1px, transparent 1px),
          linear-gradient(90deg, hsl(220 10% 18%) 1px, transparent 1px);
          background-size: 60px 60px;
        }

        .tz-page { position: relative; z-index: 1; min-height: 100vh; }

        .tz-nav { position: fixed; top: 16px; left: 0; right: 0; z-index: 50; padding: 0 24px; }
        .tz-nav-inner { max-width: 1280px; margin: 0 auto; display: flex; align-items: center; padding: 12px 24px; border-radius: 999px; border: 1px solid rgba(255,255,255,.10); background: rgba(0,0,0,.28); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); box-shadow: 0 20px 60px rgba(0,0,0,.28); }
        .tz-logo { width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; background: rgba(255,255,255,.10); border: 1px solid rgba(255,255,255,.15); font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 13px; color: #fff; }
        .tz-brand { display: flex; align-items: center; gap: 10px; margin-right: 32px; }
        .tz-brand-name { font-family: 'Space Grotesk', sans-serif; font-size: 19px; font-weight: 700; letter-spacing: -.03em; color: #fff; }
        .tz-brand-name span { color: hsl(39 68% 63%); }
        .tz-links { display: flex; align-items: center; gap: 28px; flex: 1; }
        .tz-links button { border: 0; background: none; color: hsl(220 5% 58%); font-size: 14px; font-weight: 500; cursor: pointer; transition: color .25s; padding: 0; }
        .tz-links button:hover { color: white; }
        .tz-login { border: 1px solid rgba(255,255,255,.16); background: transparent; color: white; border-radius: 999px; padding: 9px 20px; font-size: 14px; font-weight: 500; text-decoration: none; }

        .tz-hero { min-height: 100svh; display: flex; align-items: center; justify-content: center; padding: 90px 24px 48px; position: relative; }
        .tz-hero-orb { position: absolute; left: 50%; top: 50%; width: 600px; height: 600px; transform: translate(-50%,-50%); border-radius: 50%; background: radial-gradient(ellipse, rgba(59,130,246,.06) 0%, transparent 70%); pointer-events: none; }
        .tz-hero-inner { position: relative; z-index: 2; max-width: 900px; text-align: center; }
        .tz-eyebrow { display: inline-block; margin-bottom: 20px; padding: 7px 16px; border-radius: 999px; border: 1px solid hsl(39 68% 63% / .30); background: hsl(39 68% 63% / .10); color: hsl(39 68% 63%); font-size: 12px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; }
        .tz-hero-title { min-height: 8.8rem; display: grid; place-items: center; }
        .tz-title-slide { display: none; animation: tzTitleIn .5s ease both; }
        .tz-title-slide.active { display: block; }
        .tz-lp h1 { margin: 0; font-family: 'Space Grotesk', sans-serif; font-size: clamp(2.1rem, 6vw, 4rem); line-height: 1.05; letter-spacing: -.055em; color: #fff; }
        .tz-lp h1 span { color: hsl(39 68% 63%); }
        .tz-hero-sub { min-height: 3.8rem; margin-top: 20px; display: grid; place-items: center; }
        .tz-sub-slide { display: none; max-width: 630px; color: hsl(220 5% 58%); font-size: clamp(1rem, 1.6vw, 1.13rem); line-height: 1.65; font-weight: 300; animation: tzCopyIn .5s ease both; }
        .tz-sub-slide.active { display: block; }
        .tz-dots { display: flex; justify-content: center; gap: 8px; margin-top: 24px; }
        .tz-dot { width: 7px; height: 7px; border: 0; border-radius: 999px; background: rgba(255,255,255,.22); cursor: pointer; transition: .25s; padding: 0; }
        .tz-dot.active { width: 24px; background: hsl(39 68% 63%); }
        .tz-cta { margin-top: 32px; }
        .tz-primary-btn { display: inline-block; border: 0; border-radius: 999px; padding: 14px 28px; background: hsl(39 68% 63%); color: hsl(220 14% 5%); font-weight: 700; cursor: pointer; transition: .25s; text-decoration: none; font-size: 15px; }
        .tz-primary-btn:hover { transform: scale(1.045); box-shadow: 0 16px 38px hsl(39 68% 63% / .22); }
        .tz-chev { position: absolute; bottom: 28px; left: 50%; transform: translateX(-50%); border: 0; background: transparent; color: hsl(220 5% 58%); font-size: 34px; cursor: pointer; animation: tzHeroCue 2.5s ease-in-out infinite; padding: 0; }

        .tz-section { position: relative; z-index: 2; padding: 96px 24px; }
        .tz-section-lg { padding: 132px 24px; }
        .tz-container { max-width: 1120px; margin: 0 auto; }
        .tz-center { text-align: center; }
        .tz-kicker { color: hsl(39 68% 63%); font-size: 14px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; margin-bottom: 16px; }
        .tz-lp h2 { margin: 0; font-family: 'Space Grotesk', sans-serif; font-size: clamp(2rem, 5vw, 4.35rem); line-height: 1.02; letter-spacing: -.055em; color: #fff; }
        .tz-muted { color: hsl(220 5% 58%); font-weight: 300; }
        .tz-lead { color: hsl(220 5% 58%); max-width: 680px; margin: 22px auto 0; font-size: 1.08rem; line-height: 1.7; font-weight: 300; }
        .tz-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 56px; }
        .tz-grid-3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 20px; margin-top: 52px; }
        .tz-card { border-radius: 24px; border: 1px solid rgba(255,255,255,.08); background: rgba(10,20,50,.62); backdrop-filter: blur(36px); -webkit-backdrop-filter: blur(36px); box-shadow: inset 0 0 60px rgba(59,130,246,.06); padding: 32px; overflow: hidden; }
        .tz-card-blue { background: rgba(15,25,55,.70); }
        .tz-card-green { background: rgba(10,30,25,.70); }
        .tz-icon { width: 48px; height: 48px; border-radius: 14px; display: grid; place-items: center; margin-bottom: 24px; background: rgba(59,130,246,.18); border: 1px solid rgba(59,130,246,.30); color: #6cb5ff; font-weight: 700; }
        .tz-icon-green { background: rgba(34,197,94,.17); border-color: rgba(34,197,94,.32); color: #4ade80; }
        .tz-icon-gold { background: hsl(39 68% 63% / .13); border-color: hsl(39 68% 63% / .28); color: hsl(39 68% 63%); }
        .tz-lp h3 { margin: 0 0 12px; font-family: 'Space Grotesk', sans-serif; font-size: 1.55rem; letter-spacing: -.035em; color: #fff; }
        .tz-card p { color: hsl(220 5% 58%); font-size: .94rem; line-height: 1.65; font-weight: 300; }
        .tz-clean { margin: 26px 0 0; padding: 0; list-style: none; display: grid; gap: 12px; }
        .tz-clean li { display: flex; gap: 12px; color: rgba(255,255,255,.82); font-size: .93rem; font-weight: 300; }
        .tz-clean li:before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: hsl(39 68% 63%); margin-top: 9px; flex: 0 0 6px; }

        .tz-stats { position: relative; z-index: 2; border-top: 1px solid rgba(255,255,255,.06); border-bottom: 1px solid rgba(255,255,255,.06); padding: 64px 24px; }
        .tz-stats-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 30px; text-align: center; }
        .tz-stat-val { color: hsl(39 68% 63%); font-family: 'Space Grotesk', sans-serif; font-size: 3rem; font-weight: 700; letter-spacing: -.04em; }
        .tz-stat-label { color: hsl(220 5% 58%); font-size: .9rem; margin-top: 8px; }

        .tz-split { display: grid; grid-template-columns: 1fr 1fr; gap: 72px; align-items: center; }
        .tz-mock-card { border-radius: 24px; border: 1px solid hsl(39 68% 63% / .20); background: rgba(10,20,55,.70); backdrop-filter: blur(36px); -webkit-backdrop-filter: blur(36px); padding: 32px; box-shadow: inset 0 0 60px rgba(59,130,246,.08); }
        .tz-status-row { display: flex; justify-content: space-between; align-items: center; padding: 16px; border-radius: 18px; border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.04); margin-bottom: 12px; color: #fff; }
        .tz-status-row strong { font-size: .9rem; }
        .tz-status-row small { color: hsl(220 5% 58%); display: block; margin-top: 5px; }

        .tz-workflow { display: flex; align-items: stretch; gap: 8px; margin-top: 60px; }
        .tz-step { flex: 1; padding: 20px 14px; border-radius: 20px; text-align: center; border: 1px solid hsl(39 68% 63% / .22); background: rgba(10,20,50,.65); backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px); color: #fff; }
        .tz-step strong { display: block; font-size: .93rem; }
        .tz-step small { display: block; margin-top: 6px; color: hsl(220 5% 58%); font-size: .78rem; line-height: 1.35; }

        .tz-roles { display: grid; grid-template-columns: .85fr 1.15fr; gap: 26px; margin-top: 52px; }
        .tz-role-list { display: grid; gap: 10px; }
        .tz-role-button { text-align: left; padding: 17px 20px; border-radius: 18px; border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.035); color: hsl(220 5% 58%); cursor: pointer; transition: .25s; font-weight: 600; font-size: 14px; }
        .tz-role-button.active { color: white; border-color: hsl(39 68% 63% / .35); background: hsl(39 68% 63% / .09); }
        .tz-role-copy { display: none; animation: tzCopyIn .35s ease; }
        .tz-role-copy.active { display: block; }

        .tz-compare { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 52px; }

        .tz-fleet-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 18px; margin-top: 44px; }
        .tz-fleet-image { min-height: 440px; border-radius: 24px; border: 1px solid hsl(39 68% 63% / .18); background-size: cover; background-position: center; overflow: hidden; }
        .tz-truck-list { display: grid; gap: 10px; }
        .tz-truck-item { width: 100%; text-align: left; padding: 16px; border-radius: 18px; border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.035); color: white; cursor: pointer; }
        .tz-truck-item p { margin: 0; color: hsl(220 5% 58%); font-size: .82rem; }
        .tz-truck-item strong { display: flex; justify-content: space-between; margin-bottom: 4px; }

        .tz-video { margin-top: 50px; aspect-ratio: 16 / 9; border-radius: 24px; border: 1px solid hsl(39 68% 63% / .20); background-size: cover; background-position: center; position: relative; overflow: hidden; display: grid; place-items: center; }
        .tz-video:after { content: ""; position: absolute; inset: 0; background: rgba(0,0,0,.42); }
        .tz-play { position: relative; z-index: 1; width: 86px; height: 86px; border-radius: 50%; display: grid; place-items: center; border: 1px solid hsl(39 68% 63% / .40); background: hsl(39 68% 63% / .18); color: hsl(39 68% 63%); font-size: 34px; }

        .tz-photos { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-top: 20px; }
        .tz-photo { aspect-ratio: 1; border-radius: 22px; overflow: hidden; position: relative; border: 1px solid hsl(39 68% 63% / .14); }
        .tz-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .tz-photo:after { content: ""; position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,.65), transparent 60%); }
        .tz-photo span { position: absolute; left: 12px; bottom: 12px; z-index: 1; font-size: .78rem; font-weight: 600; color: #fff; }

        .tz-footer { position: relative; z-index: 2; border-top: 1px solid rgba(255,255,255,.06); padding: 62px 24px 24px; }
        .tz-footer-grid { display: grid; grid-template-columns: 1.4fr repeat(3,1fr); gap: 40px; }
        .tz-footer-grid p, .tz-footer button, .tz-footer a { color: hsl(220 5% 58%); font-size: .9rem; text-decoration: none; }
        .tz-footer-list { display: grid; gap: 12px; }
        .tz-footer-list button, .tz-footer-list a { background: none; border: 0; text-align: left; padding: 0; cursor: pointer; }
        .tz-bottom { border-top: 1px solid rgba(255,255,255,.05); margin-top: 40px; padding-top: 20px; display: flex; justify-content: space-between; color: hsl(220 5% 58%); font-size: .88rem; }
        .tz-bottom a { color: inherit; text-decoration: none; }

        .tz-reveal { opacity: 0; transform: translateY(26px); transition: opacity .7s ease, transform .7s ease; }
        .tz-reveal.in { opacity: 1; transform: translateY(0); }

        @keyframes tzTitleIn { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes tzCopyIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes tzHeroCue { 0%,100% { transform: translateX(-50%) translateY(0); opacity: .5; } 50% { transform: translateX(-50%) translateY(8px); opacity: 1; } }

        @media (max-width: 860px) {
          .tz-links { display: none; }
          .tz-grid-2, .tz-grid-3, .tz-split, .tz-roles, .tz-compare, .tz-fleet-grid, .tz-footer-grid { grid-template-columns: 1fr; }
          .tz-stats-grid { grid-template-columns: repeat(2,1fr); }
          .tz-workflow { flex-direction: column; }
          .tz-photos { grid-template-columns: repeat(2,1fr); }
          .tz-bottom { flex-direction: column; gap: 12px; }
          .tz-hero-title { min-height: 10rem; }
          .tz-nav-inner { padding: 10px 16px; }
          .tz-section, .tz-section-lg { padding: 72px 20px; }
        }
      `}</style>
    </div>
  )
}
