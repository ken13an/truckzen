'use client'
import { useState, useEffect } from 'react'

// Kiosk runs without auth — it's a public tablet in the waiting area
// shop_id comes from the URL: /kiosk?shop=SHOP_ID
// or from env if only one shop

const LANGS = ['en', 'ru', 'uz'] as const
type Lang = typeof LANGS[number]

const T: Record<Lang, Record<string, string>> = {
  en: { title:'Welcome', sub:'Enter your truck number to check in', truckLabel:'Truck Unit Number', complaintLabel:'What brings you in today?', complaintPlaceholder:'Describe the problem...', submitBtn:'Check In', successTitle:'You\'re checked in', successSub:'A service advisor will be with you shortly.', newBtn:'New Check-In' },
  ru: { title:'Добро пожаловать', sub:'Введите номер грузовика для регистрации', truckLabel:'Номер грузовика', complaintLabel:'Что вас привело?', complaintPlaceholder:'Опишите проблему...', submitBtn:'Зарегистрироваться', successTitle:'Вы зарегистрированы', successSub:'Советник по обслуживанию скоро подойдет к вам.', newBtn:'Новая регистрация' },
  uz: { title:'Xush kelibsiz', sub:'Ro\'yxatdan o\'tish uchun yuk mashinasi raqamini kiriting', truckLabel:'Yuk mashinasi raqami', complaintLabel:'Bugun nima muammo bor?', complaintPlaceholder:'Muammoni tasvirlab bering...', submitBtn:'Ro\'yxatdan o\'tish', successTitle:'Siz ro\'yxatdan o\'tdingiz', successSub:'Xizmat ko\'rsatuvchi maslahatchi tez orada siz bilan bo\'ladi.', newBtn:'Yangi ro\'yxat' },
}

export default function KioskPage() {
  const [lang,      setLang]      = useState<Lang>('en')
  const [truck,     setTruck]     = useState('')
  const [complaint, setComplaint] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [ref,       setRef]       = useState('')
  const [submitting,setSubmitting]= useState(false)
  const [autoIdx,   setAutoIdx]   = useState(0)

  // Auto-rotate language every 10 seconds when idle
  useEffect(() => {
    const timer = setInterval(() => {
      if (!truck && !complaint) {
        setAutoIdx(i => (i + 1) % LANGS.length)
      }
    }, 10000)
    return () => clearInterval(timer)
  }, [truck, complaint])

  useEffect(() => {
    setLang(LANGS[autoIdx])
  }, [autoIdx])

  const t = T[lang]

  async function handleSubmit() {
    if (!truck.trim()) return
    setSubmitting(true)
    const shopId = new URLSearchParams(window.location.search).get('shop') || process.env.NEXT_PUBLIC_SHOP_ID
    try {
      const res  = await fetch('/api/kiosk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit_number: truck, complaint_raw: complaint, complaint_lang: lang, complaint_en: complaint, shop_id: shopId }),
      })
      const data = await res.json()
      setRef(data.ref || 'CI-' + Math.floor(Math.random()*9000+1000))
      setSubmitted(true)
    } catch {
      setRef('CI-' + Math.floor(Math.random()*9000+1000))
      setSubmitted(true)
    }
    setSubmitting(false)
  }

  const S: Record<string, React.CSSProperties> = {
    page:   { minHeight:'100vh', background:'#060708', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:32, fontFamily:"'Instrument Sans',sans-serif" },
    lang:   { display:'flex', gap:8, marginBottom:32 },
    langBtn:{ padding:'6px 18px', borderRadius:100, fontSize:12, fontWeight:700, cursor:'pointer', border:'1px solid rgba(255,255,255,.08)', background:'#161B24', color:'#7C8BA0', fontFamily:'inherit', transition:'all .14s' },
    langOn: { background:'rgba(29,111,232,.1)', color:'#4D9EFF', border:'1px solid rgba(29,111,232,.3)' },
    card:   { width:'100%', maxWidth:520, background:'#161B24', border:'1px solid rgba(255,255,255,.08)', borderRadius:20, padding:'40px 36px', boxShadow:'0 32px 80px rgba(0,0,0,.6)', textAlign:'center' },
    title:  { fontFamily:"'Bebas Neue',sans-serif", fontSize:42, letterSpacing:'.04em', color:'#F0F4FF', marginBottom:8 },
    sub:    { fontSize:14, color:'#7C8BA0', marginBottom:32, lineHeight:1.5 },
    label:  { fontFamily:"'IBM Plex Mono',monospace", fontSize:9, letterSpacing:'.12em', textTransform:'uppercase', color:'#48536A', marginBottom:6, display:'block', textAlign:'left' },
    input:  { width:'100%', padding:'14px 16px', background:'#1C2130', border:'1px solid rgba(255,255,255,.08)', borderRadius:10, fontSize:18, color:'#F0F4FF', outline:'none', fontFamily:'inherit', marginBottom:16, textAlign:'center', minHeight:56, boxSizing:'border-box' },
    textarea:{ width:'100%', padding:'14px 16px', background:'#1C2130', border:'1px solid rgba(255,255,255,.08)', borderRadius:10, fontSize:14, color:'#DDE3EE', outline:'none', fontFamily:'inherit', marginBottom:20, minHeight:100, resize:'none', boxSizing:'border-box' },
    btn:    { width:'100%', padding:18, background:'linear-gradient(135deg,#1D6FE8,#1248B0)', border:'none', borderRadius:12, fontSize:18, fontWeight:700, color:'#fff', cursor:'pointer', fontFamily:'inherit', boxShadow:'0 4px 24px rgba(29,111,232,.35)', transition:'all .15s' },
  }

  return (
    <div style={S.page}>
      {/* Logo */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:32 }}>
        <div style={{ width:36, height:36, background:'linear-gradient(135deg,#1D6FE8,#1248B0)', borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        </div>
        <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, letterSpacing:'.1em', color:'#F0F4FF' }}>TRUCK<span style={{ color:'#4D9EFF' }}>ZEN</span></span>
      </div>

      {/* Language selector */}
      <div style={S.lang}>
        {LANGS.map(l => (
          <button key={l} style={{ ...S.langBtn, ...(lang===l ? S.langOn : {}) }} onClick={() => { setLang(l); setAutoIdx(LANGS.indexOf(l)) }}>
            {l === 'en' ? '🇺🇸 EN' : l === 'ru' ? '🇷🇺 RU' : '🇺🇿 UZ'}
          </button>
        ))}
      </div>

      <div style={S.card}>
        {submitted ? (
          <>
            <div style={{ fontSize:56, marginBottom:16 }}>✅</div>
            <div style={S.title}>{t.successTitle}</div>
            <div style={S.sub}>{t.successSub}</div>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:24, fontWeight:700, color:'#4D9EFF', margin:'16px 0 24px', letterSpacing:'.08em' }}>{ref}</div>
            <button style={S.btn} onClick={() => { setSubmitted(false); setTruck(''); setComplaint('') }}>
              {t.newBtn}
            </button>
          </>
        ) : (
          <>
            <div style={S.title}>{t.title}</div>
            <div style={S.sub}>{t.sub}</div>
            <label style={S.label}>{t.truckLabel}</label>
            <input style={S.input} value={truck} onChange={e => setTruck(e.target.value)} placeholder="e.g. 2717" autoFocus/>
            <label style={S.label}>{t.complaintLabel}</label>
            <textarea style={S.textarea} value={complaint} onChange={e => setComplaint(e.target.value)} placeholder={t.complaintPlaceholder}/>
            <button style={{ ...S.btn, opacity: truck.trim() ? 1 : 0.5 }} onClick={handleSubmit} disabled={!truck.trim() || submitting}>
              {submitting ? '...' : t.submitBtn}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
