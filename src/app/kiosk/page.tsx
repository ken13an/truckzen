'use client'
import { useState, useEffect, useRef } from 'react'

const LANGS = ['en', 'ru', 'uz', 'es'] as const
type Lang = typeof LANGS[number]
type Step = 0 | 1 | 2 | 3 | 4

const T: Record<Lang, Record<string, string>> = {
  en: { tap: 'TAP TO CHECK IN', who: 'Who are you checking in for?', company: 'Company Name', contact: 'Your Name (driver/contact)', phone: 'Phone Number', email: 'Email (optional)', next: 'Next', truck: 'What truck are you bringing in?', unit: 'Truck Unit Number', vin: 'VIN (optional)', odometer: 'Current Odometer', problem: "What's wrong with the truck?", record: 'Tap to Record', recording: 'Recording...', tapStop: 'Tap to Stop', typeInstead: 'Type Instead', looksGood: 'Looks Good', tryAgain: 'Try Again', review: 'Review your check-in', confirm: 'Confirm Check-In', done: "You're checked in!", sub: 'A service writer will be with you shortly.', newCheckin: 'New Check-In', back: 'Back', processing: 'Processing...' },
  ru: { tap: 'НАЖМИТЕ ДЛЯ РЕГИСТРАЦИИ', who: 'На какую компанию регистрация?', company: 'Название компании', contact: 'Ваше имя (водитель)', phone: 'Номер телефона', email: 'Email (необязательно)', next: 'Далее', truck: 'Какой грузовик привозите?', unit: 'Номер грузовика', vin: 'VIN (необязательно)', odometer: 'Текущий пробег', problem: 'Что случилось с грузовиком?', record: 'Нажмите для записи', recording: 'Запись...', tapStop: 'Нажмите чтобы остановить', typeInstead: 'Напечатать', looksGood: 'Все верно', tryAgain: 'Попробовать снова', review: 'Проверьте данные', confirm: 'Подтвердить регистрацию', done: 'Вы зарегистрированы!', sub: 'Мастер-приемщик скоро к вам подойдет.', newCheckin: 'Новая регистрация', back: 'Назад', processing: 'Обработка...' },
  uz: { tap: "RO'YXATDAN O'TISH", who: 'Qaysi kompaniya uchun?', company: 'Kompaniya nomi', contact: "Ismingiz (haydovchi)", phone: 'Telefon raqami', email: 'Email (ixtiyoriy)', next: 'Keyingi', truck: 'Qaysi yuk mashina?', unit: 'Mashina raqami', vin: 'VIN (ixtiyoriy)', odometer: 'Hozirgi masofa', problem: 'Muammo nima?', record: 'Yozish uchun bosing', recording: 'Yozilmoqda...', tapStop: "To'xtatish uchun bosing", typeInstead: 'Yozing', looksGood: "To'g'ri", tryAgain: 'Qayta urinish', review: "Ma'lumotlarni tekshiring", confirm: 'Tasdiqlash', done: "Ro'yxatdan o'tdingiz!", sub: "Xizmat yozuvchisi tez orada sizga murojaat qiladi.", newCheckin: "Yangi ro'yxat", back: 'Orqaga', processing: 'Ishlov berilmoqda...' },
  es: { tap: 'TOQUE PARA REGISTRARSE', who: '¿Para qué empresa?', company: 'Nombre de empresa', contact: 'Su nombre (conductor)', phone: 'Teléfono', email: 'Email (opcional)', next: 'Siguiente', truck: '¿Qué camión trae?', unit: 'Número de unidad', vin: 'VIN (opcional)', odometer: 'Odómetro actual', problem: '¿Qué problema tiene?', record: 'Toque para grabar', recording: 'Grabando...', tapStop: 'Toque para parar', typeInstead: 'Escribir', looksGood: 'Se ve bien', tryAgain: 'Intentar de nuevo', review: 'Revise su registro', confirm: 'Confirmar registro', done: '¡Está registrado!', sub: 'Un escritor de servicio estará con usted pronto.', newCheckin: 'Nuevo registro', back: 'Atrás', processing: 'Procesando...' },
}

export default function KioskPage() {
  const [lang, setLang] = useState<Lang>('en')
  const [step, setStep] = useState<Step>(0)
  const [autoIdx, setAutoIdx] = useState(0)
  const [shopId, setShopId] = useState('')

  // Form data
  const [company, setCompany] = useState('')
  const [contact, setContact] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [unit, setUnit] = useState('')
  const [vin, setVin] = useState('')
  const [odometer, setOdometer] = useState('')
  const [complaintRaw, setComplaintRaw] = useState('')
  const [complaintEn, setComplaintEn] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [showType, setShowType] = useState(false)
  const [aiProcessing, setAiProcessing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [refNum, setRefNum] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [truckInfo, setTruckInfo] = useState<any>(null)
  const recognitionRef = useRef<any>(null)
  const idleRef = useRef<any>(null)

  const t = T[lang]

  // Get shop_id from URL
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    setShopId(p.get('shop') || '1f927e3e-4fe5-431a-bb7c-dac77501e892')
  }, [])

  // Auto-rotate language on welcome screen
  useEffect(() => {
    if (step !== 0) return
    const iv = setInterval(() => setAutoIdx(i => (i + 1) % LANGS.length), 8000)
    return () => clearInterval(iv)
  }, [step])

  useEffect(() => { if (step === 0) setLang(LANGS[autoIdx]) }, [autoIdx, step])

  // Auto-reset after 5 min idle
  useEffect(() => {
    function resetIdle() {
      clearTimeout(idleRef.current)
      idleRef.current = setTimeout(resetAll, 300000)
    }
    window.addEventListener('touchstart', resetIdle)
    window.addEventListener('click', resetIdle)
    resetIdle()
    return () => { window.removeEventListener('touchstart', resetIdle); window.removeEventListener('click', resetIdle) }
  }, [])

  function resetAll() {
    setStep(0); setCompany(''); setContact(''); setPhone(''); setEmail('')
    setUnit(''); setVin(''); setOdometer(''); setComplaintRaw(''); setComplaintEn('')
    setRefNum(''); setTruckInfo(null); setSuggestions([]); setShowType(false)
  }

  // Company autocomplete
  async function searchCompanies(q: string) {
    setCompany(q)
    if (q.length < 2 || !shopId) { setSuggestions([]); return }
    const res = await fetch(`/api/customers?shop_id=${shopId}&q=${encodeURIComponent(q)}`)
    if (res.ok) { const data = await res.json(); setSuggestions(Array.isArray(data) ? data.slice(0, 5) : []) }
  }

  // Truck lookup
  async function lookupTruck() {
    if (!unit.trim() && !vin.trim()) return
    const res = await fetch(`/api/assets?shop_id=${shopId}&search=${encodeURIComponent(unit || vin)}`)
    if (res.ok) {
      const data = await res.json()
      const match = Array.isArray(data) ? data.find((a: any) => a.unit_number?.toLowerCase() === unit.toLowerCase() || a.vin?.toLowerCase() === vin.toLowerCase()) : null
      if (match) setTruckInfo(match)
    }
  }

  // Voice recording
  function startRecording() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setShowType(true); return
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const r = new SR()
    r.continuous = true
    r.interimResults = true
    r.lang = lang === 'ru' ? 'ru-RU' : lang === 'uz' ? 'uz-UZ' : lang === 'es' ? 'es-ES' : 'en-US'
    r.onresult = (e: any) => {
      let text = ''
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript
      setComplaintRaw(text)
    }
    r.onerror = () => { setShowType(true); setIsRecording(false) }
    r.start()
    recognitionRef.current = r
    setIsRecording(true)
  }

  function stopRecording() {
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null }
    setIsRecording(false)
    if (complaintRaw.trim()) processComplaint(complaintRaw)
  }

  async function processComplaint(text: string) {
    setAiProcessing(true)
    try {
      const res = await fetch('/api/ai/service-writer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text, language: lang, truck_info: truckInfo, shop_id: shopId }),
      })
      if (res.ok) {
        const data = await res.json()
        setComplaintEn(data.complaint || text)
      } else {
        setComplaintEn(text)
      }
    } catch { setComplaintEn(text) }
    setAiProcessing(false)
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/kiosk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: shopId, unit_number: unit, vin: vin || null,
          complaint_raw: complaintRaw, complaint_lang: lang, complaint_en: complaintEn || complaintRaw,
          company_name: company, contact_name: contact, phone: phone || null, email: email || null,
          odometer: parseInt(odometer) || null,
        }),
      })
      const data = await res.json()
      setRefNum(data.ref || data.checkin_ref || `CI-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`)
      setStep(4)
    } catch {
      setRefNum(`CI-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`)
      setStep(4)
    }
    setSubmitting(false)
  }

  // Auto-reset success screen after 60s
  useEffect(() => {
    if (step !== 4) return
    const timer = setTimeout(resetAll, 60000)
    return () => clearTimeout(timer)
  }, [step])

  return (
    <div style={S.page}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#0A84FF,#0A84FF)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        </div>
        <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: '.1em', color: '#F5F5F7' }}>TRUCK<span style={{ color: '#0A84FF' }}>ZEN</span></span>
      </div>

      {/* Language selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
        {LANGS.map(l => (
          <button key={l} onClick={() => { setLang(l); setAutoIdx(LANGS.indexOf(l)) }}
            style={{ padding: '6px 16px', borderRadius: 100, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: lang === l ? '1px solid rgba(0,224,176,.3)' : '1px solid rgba(255,255,255,.08)', background: lang === l ? 'rgba(0,224,176,.1)' : '#2A2A2A', color: lang === l ? '#0A84FF' : '#8E8E93', fontFamily: 'inherit' }}>
            {l === 'en' ? 'EN' : l === 'ru' ? 'RU' : l === 'uz' ? 'UZ' : 'ES'}
          </button>
        ))}
      </div>

      <div style={S.card}>
        {/* STEP 0 — Welcome */}
        {step === 0 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#0A84FF', marginBottom: 20 }}>TRUCK CHECK-IN</div>
            <button onClick={() => setStep(1)} style={{ ...S.bigBtn, fontSize: 22, padding: '28px 48px', minHeight: 80 }}>
              {t.tap}
            </button>
          </div>
        )}

        {/* STEP 1 — Company */}
        {step === 1 && (
          <>
            <div style={S.heading}>{t.who}</div>
            <div style={S.fieldLabel}>{t.company}</div>
            <div style={{ position: 'relative' }}>
              <input style={S.input} value={company} onChange={e => searchCompanies(e.target.value)} placeholder="e.g. ABC Trucking" autoFocus />
              {suggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#2A2A2A', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, overflow: 'hidden', zIndex: 50 }}>
                  {suggestions.map((s: any) => (
                    <div key={s.id} style={{ padding: '14px 16px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,.04)', fontSize: 14 }}
                      onClick={() => { setCompany(s.company_name); setPhone(s.phone || ''); setEmail(s.email || ''); setSuggestions([]) }}>
                      <div style={{ fontWeight: 700, color: '#F5F5F7' }}>{s.company_name}</div>
                      {s.phone && <div style={{ fontSize: 12, color: '#8E8E93' }}>{s.phone}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={S.fieldLabel}>{t.contact}</div>
            <input style={S.input} value={contact} onChange={e => setContact(e.target.value)} placeholder="John Smith" />
            <div style={S.fieldLabel}>{t.phone}</div>
            <input style={S.input} value={phone} onChange={e => setPhone(e.target.value)} type="tel" placeholder="(555) 123-4567" />
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setStep(0)} style={S.backBtn}>{t.back}</button>
              <button onClick={() => { if (company.trim()) setStep(2) }} disabled={!company.trim()} style={{ ...S.bigBtn, flex: 1, opacity: company.trim() ? 1 : 0.5 }}>{t.next}</button>
            </div>
          </>
        )}

        {/* STEP 2 — Vehicle */}
        {step === 2 && (
          <>
            <div style={S.heading}>{t.truck}</div>
            <div style={S.fieldLabel}>{t.unit}</div>
            <input style={{ ...S.input, fontSize: 24, textAlign: 'center', letterSpacing: '.05em' }} value={unit} onChange={e => setUnit(e.target.value)} onBlur={lookupTruck} placeholder="e.g. 2717" autoFocus />
            {truckInfo && (
              <div style={{ padding: '12px 16px', background: 'rgba(0,224,176,.06)', border: '1px solid rgba(0,224,176,.15)', borderRadius: 10, marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#F5F5F7' }}>#{truckInfo.unit_number} — {truckInfo.year} {truckInfo.make} {truckInfo.model}</div>
              </div>
            )}
            <div style={S.fieldLabel}>{t.odometer}</div>
            <input style={S.input} value={odometer} onChange={e => setOdometer(e.target.value)} type="number" placeholder="e.g. 485000" />
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setStep(1)} style={S.backBtn}>{t.back}</button>
              <button onClick={() => { if (unit.trim()) setStep(3) }} disabled={!unit.trim()} style={{ ...S.bigBtn, flex: 1, opacity: unit.trim() ? 1 : 0.5 }}>{t.next}</button>
            </div>
          </>
        )}

        {/* STEP 3 — Problem */}
        {step === 3 && (
          <>
            <div style={S.heading}>{t.problem}</div>
            {!showType && !complaintEn && (
              <button onClick={isRecording ? stopRecording : startRecording}
                style={{ ...S.bigBtn, width: '100%', padding: 24, fontSize: 18, background: isRecording ? '#FF453A' : 'linear-gradient(135deg,#0A84FF,#0A84FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>{isRecording ? 'STOP' : 'REC'}</span>
                {isRecording ? t.tapStop : t.record}
              </button>
            )}
            {isRecording && complaintRaw && (
              <div style={{ marginTop: 12, padding: 14, background: '#2A2A2A', borderRadius: 10, fontSize: 14, color: '#F5F5F7', lineHeight: 1.6, minHeight: 60 }}>
                {complaintRaw}
              </div>
            )}
            {aiProcessing && <div style={{ textAlign: 'center', padding: 20, color: '#0A84FF', fontSize: 14 }}>{t.processing}</div>}
            {complaintEn && !aiProcessing && (
              <>
                <div style={{ marginTop: 12, padding: 14, background: 'rgba(0,224,176,.06)', border: '1px solid rgba(0,224,176,.15)', borderRadius: 10, fontSize: 14, color: '#F5F5F7', lineHeight: 1.6 }}>
                  {complaintEn}
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button onClick={() => { setComplaintRaw(''); setComplaintEn('') }} style={S.backBtn}>{t.tryAgain}</button>
                  <button onClick={() => setStep(4.5 as any)} style={{ ...S.bigBtn, flex: 1 }}>{t.looksGood}</button>
                </div>
              </>
            )}
            {!isRecording && !complaintEn && !aiProcessing && (
              <button onClick={() => setShowType(true)} style={{ background: 'none', border: 'none', color: '#0A84FF', fontSize: 13, cursor: 'pointer', marginTop: 12, fontFamily: 'inherit' }}>{t.typeInstead}</button>
            )}
            {showType && !complaintEn && (
              <>
                <textarea style={{ ...S.input, minHeight: 120, resize: 'none', marginTop: 12 }} value={complaintRaw} onChange={e => setComplaintRaw(e.target.value)} placeholder="Describe the problem..." autoFocus />
                <button onClick={() => { if (complaintRaw.trim()) { processComplaint(complaintRaw); setShowType(false) } }} disabled={!complaintRaw.trim()} style={{ ...S.bigBtn, width: '100%', opacity: complaintRaw.trim() ? 1 : 0.5, marginTop: 8 }}>{t.next}</button>
              </>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setStep(2)} style={S.backBtn}>{t.back}</button>
            </div>
          </>
        )}

        {/* STEP 3.5 — Review (step stored as going to 4.5 then submit) */}
        {(step as number) === 4.5 && (
          <>
            <div style={S.heading}>{t.review}</div>
            <div style={{ background: '#2A2A2A', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              {[
                [t.company, company],
                [t.contact, contact],
                [t.phone, phone],
                [t.unit, unit ? `#${unit}` : '—'],
                [t.odometer, odometer || '—'],
              ].map(([l, v]) => (
                <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                  <span style={{ fontSize: 12, color: '#8E8E93' }}>{l}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#F5F5F7' }}>{v}</span>
                </div>
              ))}
              <div style={{ marginTop: 8, fontSize: 13, color: '#F5F5F7', lineHeight: 1.5 }}>{complaintEn || complaintRaw}</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(3)} style={S.backBtn}>{t.back}</button>
              <button onClick={handleSubmit} disabled={submitting} style={{ ...S.bigBtn, flex: 1, opacity: submitting ? 0.6 : 1 }}>{submitting ? t.processing : t.confirm}</button>
            </div>
          </>
        )}

        {/* STEP 4 — Success */}
        {step === 4 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#0A84FF', marginBottom: 16 }}>CHECKED IN</div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 36, color: '#F5F5F7', marginBottom: 8 }}>{t.done}</div>
            <div style={{ fontSize: 14, color: '#8E8E93', marginBottom: 20 }}>{t.sub}</div>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 28, fontWeight: 700, color: '#0A84FF', margin: '16px 0 24px', letterSpacing: '.08em' }}>{refNum}</div>
            <button style={S.bigBtn} onClick={resetAll}>{t.newCheckin}</button>
          </div>
        )}
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0A0A0A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Instrument Sans',sans-serif" },
  card: { width: '100%', maxWidth: 520, background: '#2A2A2A', border: '1px solid rgba(255,255,255,.08)', borderRadius: 20, padding: '36px 32px', boxShadow: '0 32px 80px rgba(0,0,0,.6)' },
  heading: { fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F5F5F7', marginBottom: 20 },
  fieldLabel: { fontSize: 11, fontWeight: 600, color: '#8E8E93', marginBottom: 6, marginTop: 12, textTransform: 'uppercase' as const, letterSpacing: '.05em' },
  input: { width: '100%', padding: '14px 16px', background: '#2A2A2A', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, fontSize: 16, color: '#F5F5F7', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const },
  bigBtn: { padding: '16px 28px', background: 'linear-gradient(135deg,#0A84FF,#0A84FF)', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' },
  backBtn: { padding: '14px 20px', background: 'transparent', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, fontSize: 14, color: '#8E8E93', cursor: 'pointer', fontFamily: 'inherit' },
}
