'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { CheckCircle2 } from 'lucide-react'
import Logo from '@/components/Logo'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

// ---------------------------------------------------------------------------
// Translations
// ---------------------------------------------------------------------------

const T: Record<string, Record<string, string>> = {
  en: {
    welcome_title: 'Welcome to',
    welcome_sub: 'Tap below to check in your truck for service',
    start: 'Start Check-In',
    find_company: 'Find Your Company',
    find_company_sub: 'Type your company name to search',
    company_not_listed: 'My company is not listed — Add New',
    find_unit: 'Find Your Unit',
    find_unit_sub: 'Type unit number',
    unit_not_listed: 'This truck is not listed — Add New Unit',
    concern_title: 'What Work Needs to Be Done?',
    concern_sub: 'Tell us what your truck needs — type or speak',
    concern_placeholder: 'Example: Oil change, brakes making noise, check engine light...',
    speak: 'Tap to Speak',
    stop_speaking: 'Stop',
    details_title: 'Quick Details',
    parked_label: 'Where is the truck parked?',
    keys_label: 'Keys?',
    keys_in_truck: 'In Truck',
    keys_front_desk: 'Front Desk',
    keys_no: 'No',
    staying_label: 'Are you staying?',
    staying_yes: 'Waiting at shop',
    staying_no: 'Leaving',
    priority_label: 'Priority',
    priority_routine: 'Routine',
    priority_urgent: 'Urgent',
    priority_breakdown: 'Breakdown',
    when_title: 'When Do You Need Your Truck?',
    when_today: 'Today',
    when_tomorrow: 'Tomorrow',
    when_this_week: 'This Week',
    when_no_rush: 'No Rush',
    when_pick_date: 'Or pick a specific date',
    auth_title: 'How Should We Handle Repairs?',
    auth_estimate: 'Send Me an Estimate First',
    auth_go_ahead: 'Go Ahead With Repairs',
    auth_limit_label: 'Spending limit:',
    auth_no_limit: 'No Limit',
    email_label: 'Email',
    phone_label: 'Phone',
    review_title: 'Review Your Check-In',
    submit: 'Submit Check-In',
    submitting: 'Submitting...',
    confirmed_title: "You're Checked In!",
    confirmed_sub: 'A link to track your repair has been sent to',
    new_checkin: 'New Check-In',
    back: 'Back',
    next: 'Next',
    step: 'Step',
    of: 'of',
    company_name: 'Company Name',
    dot_number: 'DOT Number',
    mc_number: 'MC Number',
    contact_name: 'Contact Name',
    unit_number: 'Unit Number',
    vin: 'VIN',
    mileage: 'Mileage',
    unit_type: 'Unit Type',
  },
  es: {
    welcome_title: 'Bienvenido a',
    welcome_sub: 'Toque abajo para registrar su camion para servicio',
    start: 'Iniciar Registro',
    find_company: 'Buscar Su Empresa',
    find_company_sub: 'Escriba el nombre de su empresa',
    company_not_listed: 'Mi empresa no esta en la lista — Agregar Nueva',
    find_unit: 'Buscar Su Unidad',
    find_unit_sub: 'Escriba el numero de unidad',
    unit_not_listed: 'Este camion no esta en la lista — Agregar Unidad',
    concern_title: 'Que Trabajo Necesita?',
    concern_sub: 'Diganos que necesita su camion — escriba o hable',
    concern_placeholder: 'Ejemplo: Cambio de aceite, frenos hacen ruido, luz de motor...',
    speak: 'Tocar para Hablar',
    stop_speaking: 'Parar',
    details_title: 'Detalles Rapidos',
    parked_label: 'Donde esta estacionado el camion?',
    keys_label: 'Llaves?',
    keys_in_truck: 'En el Camion',
    keys_front_desk: 'Recepcion',
    keys_no: 'No',
    staying_label: 'Se va a quedar?',
    staying_yes: 'Esperando en el taller',
    staying_no: 'Me voy',
    priority_label: 'Prioridad',
    priority_routine: 'Rutina',
    priority_urgent: 'Urgente',
    priority_breakdown: 'Averia',
    when_title: 'Cuando Necesita Su Camion?',
    when_today: 'Hoy',
    when_tomorrow: 'Manana',
    when_this_week: 'Esta Semana',
    when_no_rush: 'Sin Prisa',
    when_pick_date: 'O elija una fecha',
    auth_title: 'Como Manejamos las Reparaciones?',
    auth_estimate: 'Envienme un Presupuesto Primero',
    auth_go_ahead: 'Procedan con las Reparaciones',
    auth_limit_label: 'Limite de gasto:',
    auth_no_limit: 'Sin Limite',
    email_label: 'Correo Electronico',
    phone_label: 'Telefono',
    review_title: 'Revise Su Registro',
    submit: 'Enviar Registro',
    submitting: 'Enviando...',
    confirmed_title: 'Esta Registrado!',
    confirmed_sub: 'Un enlace para seguir su reparacion se envio a',
    new_checkin: 'Nuevo Registro',
    back: 'Atras',
    next: 'Siguiente',
    step: 'Paso',
    of: 'de',
    company_name: 'Nombre de Empresa',
    dot_number: 'Numero DOT',
    mc_number: 'Numero MC',
    contact_name: 'Nombre de Contacto',
    unit_number: 'Numero de Unidad',
    vin: 'VIN',
    mileage: 'Kilometraje',
    unit_type: 'Tipo de Unidad',
  },
  ru: {
    welcome_title: 'Dobro pozhalovat v',
    welcome_sub: 'Nazhmite chtoby zaregistrirovat gruzovik na obsluzhivanie',
    start: 'Nachat Registratsiyu',
    find_company: 'Naidite Svoyu Kompaniyu',
    find_company_sub: 'Vvedite nazvanie kompanii',
    company_not_listed: 'Moei kompanii net v spiske — Dobavit Novuyu',
    find_unit: 'Naidite Svoyu Mashinu',
    find_unit_sub: 'Vvedite nomer mashiny',
    unit_not_listed: 'Etogo gruzovika net v spiske — Dobavit',
    concern_title: 'Kakaya Rabota Nuzhna?',
    concern_sub: 'Opishite chto nuzhno vashemu gruzoviku',
    concern_placeholder: 'Primer: Zamena masla, tormozy shumyat, lampochka dvigatelya...',
    speak: 'Nazhmite chtoby Govorit',
    stop_speaking: 'Stop',
    details_title: 'Bystrye Detali',
    parked_label: 'Gde stoit gruzovik?',
    keys_label: 'Klyuchi?',
    keys_in_truck: 'V Gruzovike',
    keys_front_desk: 'Na Stoike',
    keys_no: 'Net',
    staying_label: 'Vy ostayotes?',
    staying_yes: 'Zhdu v masterskoi',
    staying_no: 'Uyezzhayu',
    priority_label: 'Prioritet',
    priority_routine: 'Obychnyy',
    priority_urgent: 'Srochno',
    priority_breakdown: 'Avaria',
    when_title: 'Kogda Nuzhen Gruzovik?',
    when_today: 'Segodnya',
    when_tomorrow: 'Zavtra',
    when_this_week: 'Na Etoi Nedele',
    when_no_rush: 'Ne Srochno',
    when_pick_date: 'Ili vyberite datu',
    auth_title: 'Kak Postupit s Remontom?',
    auth_estimate: 'Snachala Prishlite Smetu',
    auth_go_ahead: 'Nachninite Remont',
    auth_limit_label: 'Limit rashodov:',
    auth_no_limit: 'Bez Limita',
    email_label: 'Email',
    phone_label: 'Telefon',
    review_title: 'Proverite Registratsiyu',
    submit: 'Otpravit',
    submitting: 'Otpravka...',
    confirmed_title: 'Vy Zaregistrirovany!',
    confirmed_sub: 'Ssylka dlya otslezhivaniya otpravlena na',
    new_checkin: 'Novaya Registratsiya',
    back: 'Nazad',
    next: 'Dalee',
    step: 'Shag',
    of: 'iz',
    company_name: 'Nazvanie Kompanii',
    dot_number: 'Nomer DOT',
    mc_number: 'Nomer MC',
    contact_name: 'Imya Kontakta',
    unit_number: 'Nomer Mashiny',
    vin: 'VIN',
    mileage: 'Probeg',
    unit_type: 'Tip Mashiny',
  },
  uz: {
    welcome_title: 'Xush kelibsiz',
    welcome_sub: 'Yuk mashinangizni xizmatga royxatdan otkazish uchun bosing',
    start: 'Royxatni Boshlash',
    find_company: 'Kompaniyangizni Toping',
    find_company_sub: 'Kompaniya nomini yozing',
    company_not_listed: 'Kompaniyam royxatda yoq — Yangi Qoshish',
    find_unit: 'Mashinangizni Toping',
    find_unit_sub: 'Mashina raqamini yozing',
    unit_not_listed: 'Bu mashina royxatda yoq — Yangi Qoshish',
    concern_title: 'Qanday Ish Kerak?',
    concern_sub: 'Mashinangizga nima kerakligini yozing yoki gapiring',
    concern_placeholder: 'Misol: Moy almashtirish, tormoz shovqin qilyapti...',
    speak: 'Gapirish uchun Bosing',
    stop_speaking: 'Toxtatish',
    details_title: 'Tezkor Malumotlar',
    parked_label: 'Mashina qayerda turadi?',
    keys_label: 'Kalitlar?',
    keys_in_truck: 'Mashinada',
    keys_front_desk: 'Qabulxonada',
    keys_no: 'Yoq',
    staying_label: 'Qolasizmi?',
    staying_yes: 'Ustaxonada kutaman',
    staying_no: 'Ketaman',
    priority_label: 'Muhimlik',
    priority_routine: 'Oddiy',
    priority_urgent: 'Shoshilinch',
    priority_breakdown: 'Buzilish',
    when_title: 'Mashina Qachon Kerak?',
    when_today: 'Bugun',
    when_tomorrow: 'Ertaga',
    when_this_week: 'Shu Hafta',
    when_no_rush: 'Shoshilmayman',
    when_pick_date: 'Yoki sanani tanlang',
    auth_title: 'Tamirlash Bilan Qanday Qilamiz?',
    auth_estimate: 'Oldin Smeta Yuboring',
    auth_go_ahead: 'Tamirni Boshlang',
    auth_limit_label: 'Xarajat chegarasi:',
    auth_no_limit: 'Chegarasiz',
    email_label: 'Email',
    phone_label: 'Telefon',
    review_title: 'Royxatni Tekshiring',
    submit: 'Yuborish',
    submitting: 'Yuborilmoqda...',
    confirmed_title: 'Royxatdan Otdingiz!',
    confirmed_sub: 'Tamir holatini kuzatish havolasi yuborildi',
    new_checkin: 'Yangi Royxat',
    back: 'Orqaga',
    next: 'Keyingi',
    step: 'Qadam',
    of: 'dan',
    company_name: 'Kompaniya Nomi',
    dot_number: 'DOT Raqam',
    mc_number: 'MC Raqam',
    contact_name: 'Kontakt Ismi',
    unit_number: 'Mashina Raqami',
    vin: 'VIN',
    mileage: 'Yurgan Masofa',
    unit_type: 'Mashina Turi',
  },
}

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

interface NewCustomer {
  company_name: string
  dot_number: string
  mc_number: string
  contact_name: string
  phone: string
  email: string
}

interface NewUnit {
  unit_number: string
  vin: string
  mileage: string
  license_plate: string
  state: string
  unit_type: string
}

const TOTAL_STEPS = 7 // steps 1-7 shown in dots

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  padding: '16px 20px',
  fontSize: 18,
  color: '#EDEDF0',
  minHeight: 56,
  outline: 'none',
  fontFamily: "'Instrument Sans', sans-serif",
  boxSizing: 'border-box' as const,
}

const primaryBtnStyle: React.CSSProperties = {
  borderRadius: 12,
  padding: '16px 32px',
  fontSize: 18,
  fontWeight: 700,
  background: '#1D6FE8',
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
  fontFamily: "'Instrument Sans', sans-serif",
}

const optionCardStyle = (selected: boolean): React.CSSProperties => ({
  background: selected ? 'rgba(29,111,232,0.1)' : 'rgba(255,255,255,0.06)',
  border: selected ? '2px solid #1D6FE8' : '2px solid transparent',
  borderRadius: 12,
  padding: '16px 20px',
  cursor: 'pointer',
  textAlign: 'center',
  fontFamily: "'Instrument Sans', sans-serif",
  fontSize: 18,
  fontWeight: 600,
  color: '#EDEDF0',
  transition: 'all .15s',
  flex: 1,
  minHeight: 56,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
})

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function KioskPage() {
  // ---- State ----
  const [lang, setLang] = useState('en')
  const [step, setStep] = useState(0)
  const [shopId, setShopId] = useState('')
  const [shopName, setShopName] = useState('')
  const [shopError, setShopError] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null)
  const [selectedUnit, setSelectedUnit] = useState<any | null>(null)

  const [concernText, setConcernText] = useState('')
  const [parkedLocation, setParkedLocation] = useState('')
  const [keysLeft, setKeysLeft] = useState<'in_truck' | 'front_desk' | 'no'>('in_truck')
  const [staying, setStaying] = useState<boolean | null>(null)
  const [needByDate, setNeedByDate] = useState('')
  const [priority, setPriority] = useState<'routine' | 'urgent' | 'breakdown'>('routine')
  const [authType, setAuthType] = useState<'estimate_first' | 'go_ahead'>('estimate_first')
  const [authLimit, setAuthLimit] = useState<number | null>(null)
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')

  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<any[]>([])
  const [unitSearch, setUnitSearch] = useState('')
  const [unitResults, setUnitResults] = useState<any[]>([])

  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [showNewUnit, setShowNewUnit] = useState(false)
  const [newCustomer, setNewCustomer] = useState<NewCustomer>({ company_name: '', dot_number: '', mc_number: '', contact_name: '', phone: '', email: '' })
  const [newUnit, setNewUnit] = useState<NewUnit>({ unit_number: '', vin: '', mileage: '', license_plate: '', state: '', unit_type: 'tractor' })

  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ wo_number: string; portal_token: string } | null>(null)
  const [recording, setRecording] = useState(false)

  const recognitionRef = useRef<any>(null)
  const idleRef = useRef<any>(null)

  const t = (key: string) => T[lang]?.[key] || T.en[key] || key

  // ---- Init ----
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const sid = p.get('shop') || ''
    setShopId(sid)

    if (!sid) {
      setShopError(true)
      return
    }

    const supabase = createClient()

    // Fetch shop name
    ;(async () => {
      const { data: shop } = await supabase.from('shops').select('name, dba').eq('id', sid).single()
      if (!shop) {
        setShopError(true)
        return
      }
      setShopName(shop.dba || shop.name || 'Service Center')
    })()

    // Check admin
    ;(async () => {
      try {
        const user = await getCurrentUser(supabase)
        if (user && ['owner', 'gm', 'it_person'].includes(user.role)) {
          setIsAdmin(true)
        }
      } catch {}
    })()
  }, [])

  // ---- Idle reset (5 min) ----
  const resetAll = useCallback(() => {
    setStep(0)
    setSelectedCustomer(null)
    setSelectedUnit(null)
    setConcernText('')
    setParkedLocation('')
    setKeysLeft('in_truck')
    setStaying(null)
    setNeedByDate('')
    setPriority('routine')
    setAuthType('estimate_first')
    setAuthLimit(null)
    setContactEmail('')
    setContactPhone('')
    setCustomerSearch('')
    setCustomerResults([])
    setUnitSearch('')
    setUnitResults([])
    setShowNewCustomer(false)
    setShowNewUnit(false)
    setNewCustomer({ company_name: '', dot_number: '', mc_number: '', contact_name: '', phone: '', email: '' })
    setNewUnit({ unit_number: '', vin: '', mileage: '', license_plate: '', state: '', unit_type: 'tractor' })
    setSubmitting(false)
    setResult(null)
    setRecording(false)
  }, [])

  useEffect(() => {
    function resetIdle() {
      clearTimeout(idleRef.current)
      idleRef.current = setTimeout(resetAll, 300000)
    }
    window.addEventListener('touchstart', resetIdle)
    window.addEventListener('click', resetIdle)
    resetIdle()
    return () => {
      window.removeEventListener('touchstart', resetIdle)
      window.removeEventListener('click', resetIdle)
      clearTimeout(idleRef.current)
    }
  }, [resetAll])

  // Auto-reset confirmed screen after 60s
  useEffect(() => {
    if (step !== 8) return
    const t = setTimeout(resetAll, 60000)
    return () => clearTimeout(t)
  }, [step, resetAll])

  // ---- Customer search ----
  async function handleCustomerSearch(q: string) {
    setCustomerSearch(q)
    if (q.length < 2 || !shopId) { setCustomerResults([]); return }
    try {
      const res = await fetch(`/api/customers?shop_id=${shopId}&q=${encodeURIComponent(q)}&per_page=8`)
      if (res.ok) {
        const data = await res.json()
        setCustomerResults(Array.isArray(data) ? data : data.data || [])
      }
    } catch {}
  }

  // ---- Unit search ----
  async function handleUnitSearch(q: string) {
    setUnitSearch(q)
    if (q.length < 1 || !shopId || !selectedCustomer) { setUnitResults([]); return }
    try {
      const res = await fetch(`/api/assets?shop_id=${shopId}&customer_id=${selectedCustomer.id}&q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setUnitResults(Array.isArray(data) ? data : data.data || [])
      }
    } catch {}
  }

  // ---- Voice recording ----
  function startRecording() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const r = new SR()
    r.continuous = true
    r.interimResults = true
    r.lang = 'en-US'
    r.onresult = (e: any) => {
      let text = ''
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript
      setConcernText(text)
    }
    r.onerror = () => { setRecording(false) }
    r.start()
    recognitionRef.current = r
    setRecording(true)
  }

  function stopRecording() {
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null }
    setRecording(false)
  }

  // ---- Navigation helpers ----
  function goNext() {
    if (step === 4 && staying !== false) {
      // Skip step 5 (when needed) if staying
      setStep(6)
    } else {
      setStep(step + 1)
    }
  }

  function goBack() {
    if (step === 6 && staying !== false) {
      // Skip step 5 going back too
      setStep(4)
    } else {
      setStep(step - 1)
    }
  }

  function canAdvance(): boolean {
    switch (step) {
      case 1: return !!(selectedCustomer || (showNewCustomer && newCustomer.company_name.trim()))
      case 2: return !!(selectedUnit || (showNewUnit && newUnit.unit_number.trim()))
      case 3: return !!concernText.trim()
      case 4: return staying !== null
      case 5: return !!needByDate
      case 6: return !!contactEmail.trim() && !!contactPhone.trim()
      case 7: return true
      default: return false
    }
  }

  // ---- Submit ----
  async function handleSubmit() {
    setSubmitting(true)
    try {
      const body: any = {
        shop_id: shopId,
        concern_text: concernText.trim(),
        parked_location: parkedLocation || null,
        keys_left: keysLeft,
        staying,
        need_by_date: needByDate || null,
        priority,
        auth_type: authType,
        auth_limit: authType === 'go_ahead' ? authLimit : null,
        contact_email: contactEmail,
        contact_phone: contactPhone,
      }

      if (selectedCustomer && !showNewCustomer) {
        body.customer_id = selectedCustomer.id
      } else if (showNewCustomer) {
        body.new_customer = newCustomer
      }

      if (selectedUnit && !showNewUnit) {
        body.unit_id = selectedUnit.id
      } else if (showNewUnit) {
        body.new_unit = newUnit
      }

      const res = await fetch('/api/kiosk-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.wo_number) {
        setResult({ wo_number: data.wo_number, portal_token: data.portal_token })
        setStep(8)
      } else {
        alert(data.error || 'Something went wrong. Please try again.')
      }
    } catch {
      alert('Network error. Please try again.')
    }
    setSubmitting(false)
  }

  // ---- Render helpers ----
  function renderStepDots() {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: i + 1 <= step ? '#1D6FE8' : 'rgba(255,255,255,0.2)',
              transition: 'background .2s',
            }}
          />
        ))}
      </div>
    )
  }

  function renderHeader() {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 640, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Logo size="md" />
          {shopName && <span style={{ fontSize: 16, color: '#9D9DA1', fontWeight: 500 }}>{shopName}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {step >= 1 && step <= 7 && renderStepDots()}
          {isAdmin && (
            <a
              href="/kiosk-admin"
              style={{
                padding: '8px 16px',
                borderRadius: 100,
                background: 'rgba(239,68,68,0.15)',
                color: '#EF4444',
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
                fontFamily: "'Instrument Sans', sans-serif",
                border: '1px solid rgba(239,68,68,0.3)',
              }}
            >
              Exit Kiosk
            </a>
          )}
        </div>
      </div>
    )
  }

  function renderBottomNav(nextLabel?: string, onNext?: () => void) {
    return (
      <div style={{ display: 'flex', gap: 12, marginTop: 32, width: '100%' }}>
        <button
          onClick={goBack}
          style={{
            borderRadius: 12,
            padding: '16px 32px',
            fontSize: 18,
            fontWeight: 700,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#9D9DA1',
            cursor: 'pointer',
            fontFamily: "'Instrument Sans', sans-serif",
          }}
        >
          {t('back')}
        </button>
        <button
          onClick={onNext || goNext}
          disabled={!canAdvance()}
          style={{
            ...primaryBtnStyle,
            flex: 1,
            opacity: canAdvance() ? 1 : 0.4,
          }}
        >
          {nextLabel || t('next')}
        </button>
      </div>
    )
  }

  // ---- Error state ----
  if (shopError) {
    return (
      <div style={{ minHeight: '100vh', background: '#151520', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Instrument Sans', sans-serif" }}>
        <div style={{ textAlign: 'center', color: '#EDEDF0' }}>
          <Logo size="lg" style={{ justifyContent: 'center', marginBottom: 24 }} />
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Kiosk Not Configured</div>
          <div style={{ fontSize: 16, color: '#9D9DA1' }}>Please add <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 6 }}>?shop=YOUR_SHOP_ID</code> to the URL.</div>
        </div>
      </div>
    )
  }

  // ---- Main render ----
  return (
    <div style={{ minHeight: '100vh', background: '#151520', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 24px', fontFamily: "'Instrument Sans', sans-serif", color: '#EDEDF0' }}>
      {renderHeader()}

      <div style={{ width: '100%', maxWidth: 640, flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* ================================================================ */}
        {/* STEP 0 — WELCOME                                                */}
        {/* ================================================================ */}
        {step === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 20 }}>
            <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.2, color: '#EDEDF0' }}>
              {t('welcome_title')} {shopName || 'Our Shop'}
            </div>
            <div style={{ fontSize: 20, color: '#9D9DA1', maxWidth: 400 }}>
              {t('welcome_sub')}
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24 }}>
              {[
                { code: 'en', label: 'English' },
                { code: 'es', label: 'Espanol' },
                { code: 'ru', label: 'Russkiy' },
                { code: 'uz', label: 'Ozbek' },
              ].map(l => (
                <button key={l.code} onClick={() => setLang(l.code)} style={{
                  padding: '12px 24px', borderRadius: 12, fontSize: 16, fontWeight: 700, fontFamily: "'Instrument Sans', sans-serif",
                  background: lang === l.code ? '#1D6FE8' : 'rgba(255,255,255,0.06)',
                  color: lang === l.code ? '#fff' : '#EDEDF0',
                  border: lang === l.code ? '2px solid #1D6FE8' : '2px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                }}>
                  {l.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(1)}
              style={{ ...primaryBtnStyle, marginTop: 16, padding: '20px 56px', fontSize: 22 }}
            >
              {t('start')}
            </button>
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 1 — FIND COMPANY                                           */}
        {/* ================================================================ */}
        {step === 1 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>{t('find_company')}</div>
            <div style={{ fontSize: 15, color: '#9D9DA1', marginBottom: 24 }}>{t('step')} 1 {t('of')} 7</div>

            {!showNewCustomer ? (
              <>
                <input
                  style={inputStyle}
                  placeholder={t('find_company_sub')}
                  value={customerSearch}
                  onChange={e => handleCustomerSearch(e.target.value)}
                  autoFocus
                />

                {/* Selected customer badge */}
                {selectedCustomer && (
                  <div style={{ marginTop: 16, padding: '16px 20px', background: 'rgba(29,111,232,0.1)', border: '2px solid #1D6FE8', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{selectedCustomer.company_name}</div>
                      {selectedCustomer.phone && <div style={{ fontSize: 14, color: '#9D9DA1', marginTop: 4 }}>{selectedCustomer.phone}</div>}
                    </div>
                    <button onClick={() => { setSelectedCustomer(null); setCustomerSearch('') }} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Instrument Sans', sans-serif" }}>Change</button>
                  </div>
                )}

                {/* Search results */}
                {customerResults.length > 0 && !selectedCustomer && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                    {customerResults.map((c: any) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomer(c)
                          setCustomerSearch(c.company_name)
                          setCustomerResults([])
                          if (c.email) setContactEmail(c.email)
                          if (c.phone) setContactPhone(c.phone)
                        }}
                        style={{
                          padding: '16px 20px',
                          background: 'rgba(255,255,255,0.06)',
                          border: '2px solid transparent',
                          borderRadius: 12,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{c.company_name}</div>
                        {(c.contact_name || c.phone) && (
                          <div style={{ fontSize: 14, color: '#9D9DA1', marginTop: 4 }}>
                            {c.contact_name}{c.contact_name && c.phone ? ' — ' : ''}{c.phone}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setShowNewCustomer(true)}
                  style={{ background: 'none', border: 'none', color: '#1D6FE8', fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 20, padding: '12px 0', fontFamily: "'Instrument Sans', sans-serif", textAlign: 'left' }}
                >
                  + {t('company_not_listed')}
                </button>
              </>
            ) : (
              <>
                {/* New customer form */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>{t('company_name')} *</label>
                    <input style={inputStyle} placeholder="ABC Trucking" value={newCustomer.company_name} onChange={e => setNewCustomer({ ...newCustomer, company_name: e.target.value })} autoFocus />
                  </div>
                  <div>
                    <label style={labelStyle}>{t('dot_number')}</label>
                    <input style={inputStyle} placeholder="1234567" value={newCustomer.dot_number} onChange={e => setNewCustomer({ ...newCustomer, dot_number: e.target.value })} />
                  </div>
                  <div>
                    <label style={labelStyle}>{t('mc_number')}</label>
                    <input style={inputStyle} placeholder="MC-123456" value={newCustomer.mc_number} onChange={e => setNewCustomer({ ...newCustomer, mc_number: e.target.value })} />
                  </div>
                  <div>
                    <label style={labelStyle}>{t('contact_name')}</label>
                    <input style={inputStyle} placeholder="John Smith" value={newCustomer.contact_name} onChange={e => setNewCustomer({ ...newCustomer, contact_name: e.target.value })} />
                  </div>
                  <div>
                    <label style={labelStyle}>{t('phone_label')}</label>
                    <input style={inputStyle} type="tel" placeholder="(555) 123-4567" value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} />
                  </div>
                  <div>
                    <label style={labelStyle}>{t('email_label')}</label>
                    <input style={inputStyle} type="email" placeholder="dispatch@company.com" value={newCustomer.email} onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })} />
                  </div>
                </div>
                <button
                  onClick={() => { setShowNewCustomer(false); setNewCustomer({ company_name: '', dot_number: '', mc_number: '', contact_name: '', phone: '', email: '' }) }}
                  style={{ background: 'none', border: 'none', color: '#1D6FE8', fontSize: 16, fontWeight: 600, cursor: 'pointer', marginTop: 16, padding: '8px 0', fontFamily: "'Instrument Sans', sans-serif", textAlign: 'left' }}
                >
                  Search for existing company instead
                </button>
              </>
            )}

            <div style={{ flex: 1 }} />
            {renderBottomNav()}
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 2 — FIND UNIT                                              */}
        {/* ================================================================ */}
        {step === 2 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>{t('find_unit')}</div>
            <div style={{ fontSize: 15, color: '#9D9DA1', marginBottom: 24 }}>
              {t('step')} 2 {t('of')} 7 — {selectedCustomer?.company_name || newCustomer.company_name || 'Company'}
            </div>

            {!showNewUnit ? (
              <>
                <input
                  style={inputStyle}
                  placeholder={t('find_unit_sub')}
                  value={unitSearch}
                  onChange={e => handleUnitSearch(e.target.value)}
                  autoFocus
                />

                {/* Selected unit badge */}
                {selectedUnit && (
                  <div style={{ marginTop: 16, padding: '16px 20px', background: 'rgba(29,111,232,0.1)', border: '2px solid #1D6FE8', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>#{selectedUnit.unit_number}</div>
                      <div style={{ fontSize: 14, color: '#9D9DA1', marginTop: 4 }}>
                        {[selectedUnit.year, selectedUnit.make, selectedUnit.model].filter(Boolean).join(' ')}
                        {selectedUnit.vin ? ` — ...${selectedUnit.vin.slice(-6)}` : ''}
                      </div>
                    </div>
                    <button onClick={() => { setSelectedUnit(null); setUnitSearch('') }} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Instrument Sans', sans-serif" }}>Change</button>
                  </div>
                )}

                {/* Search results */}
                {unitResults.length > 0 && !selectedUnit && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                    {unitResults.map((u: any) => (
                      <div
                        key={u.id}
                        onClick={() => {
                          setSelectedUnit(u)
                          setUnitSearch(u.unit_number || '')
                          setUnitResults([])
                        }}
                        style={{
                          padding: '16px 20px',
                          background: 'rgba(255,255,255,0.06)',
                          border: '2px solid transparent',
                          borderRadius: 12,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: 18, fontWeight: 700 }}>#{u.unit_number}</div>
                        <div style={{ fontSize: 14, color: '#9D9DA1', marginTop: 4 }}>
                          {[u.year, u.make, u.model].filter(Boolean).join(' ')}
                          {u.vin ? ` — ...${u.vin.slice(-6)}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setShowNewUnit(true)}
                  style={{ background: 'none', border: 'none', color: '#1D6FE8', fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 20, padding: '12px 0', fontFamily: "'Instrument Sans', sans-serif", textAlign: 'left' }}
                >
                  + {t('unit_not_listed')}
                </button>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>{t('unit_number')} *</label>
                    <input style={inputStyle} placeholder="e.g. 2717" value={newUnit.unit_number} onChange={e => setNewUnit({ ...newUnit, unit_number: e.target.value })} autoFocus />
                  </div>
                  <div>
                    <label style={labelStyle}>{t('unit_type')}</label>
                    <select style={{ ...inputStyle, cursor: 'pointer' }} value={newUnit.unit_type} onChange={e => setNewUnit({ ...newUnit, unit_type: e.target.value })}>
                      <option value="tractor">Tractor</option>
                      <option value="trailer_dry_van">Trailer - Dry Van</option>
                      <option value="trailer_reefer">Trailer - Reefer</option>
                      <option value="trailer_flatbed">Trailer - Flatbed</option>
                      <option value="trailer_tanker">Trailer - Tanker</option>
                      <option value="trailer_lowboy">Trailer - Lowboy</option>
                      <option value="trailer_other">Trailer - Other</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>{t('vin')} (17)</label>
                    <input style={{ ...inputStyle, letterSpacing: '0.05em' }} placeholder="1HGBH41JXMN109186" maxLength={17} value={newUnit.vin} onChange={e => setNewUnit({ ...newUnit, vin: e.target.value.toUpperCase() })} />
                  </div>
                  <div>
                    <label style={labelStyle}>{t('mileage')}</label>
                    <input style={inputStyle} type="number" placeholder="e.g. 485000" value={newUnit.mileage} onChange={e => setNewUnit({ ...newUnit, mileage: e.target.value })} />
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>License Plate</label>
                      <input style={inputStyle} placeholder="ABC 1234" value={newUnit.license_plate} onChange={e => setNewUnit({ ...newUnit, license_plate: e.target.value })} />
                    </div>
                    <div style={{ width: 120 }}>
                      <label style={labelStyle}>State</label>
                      <input style={inputStyle} placeholder="TX" maxLength={2} value={newUnit.state} onChange={e => setNewUnit({ ...newUnit, state: e.target.value.toUpperCase() })} />
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => { setShowNewUnit(false); setNewUnit({ unit_number: '', vin: '', mileage: '', license_plate: '', state: '', unit_type: 'tractor' }) }}
                  style={{ background: 'none', border: 'none', color: '#1D6FE8', fontSize: 16, fontWeight: 600, cursor: 'pointer', marginTop: 16, padding: '8px 0', fontFamily: "'Instrument Sans', sans-serif", textAlign: 'left' }}
                >
                  Search for existing unit instead
                </button>
              </>
            )}

            <div style={{ flex: 1 }} />
            {renderBottomNav()}
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 3 — CONCERN                                                */}
        {/* ================================================================ */}
        {step === 3 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>{t('concern_title')}</div>
            <div style={{ fontSize: 15, color: '#9D9DA1', marginBottom: 24 }}>{t('step')} 3 {t('of')} 7</div>

            <textarea
              style={{ ...inputStyle, minHeight: 150, resize: 'vertical' }}
              placeholder={t('concern_placeholder')}
              value={concernText}
              onChange={e => setConcernText(e.target.value)}
              autoFocus
            />

            {/* Voice button */}
            {('webkitSpeechRecognition' in (typeof window !== 'undefined' ? window : {}) || 'SpeechRecognition' in (typeof window !== 'undefined' ? window : {})) && (
              <button
                onClick={recording ? stopRecording : startRecording}
                style={{
                  marginTop: 16,
                  borderRadius: 12,
                  padding: '16px 32px',
                  fontSize: 18,
                  fontWeight: 700,
                  background: recording ? '#EF4444' : 'rgba(255,255,255,0.06)',
                  border: recording ? '2px solid #EF4444' : '2px solid rgba(255,255,255,0.1)',
                  color: recording ? '#fff' : '#EDEDF0',
                  cursor: 'pointer',
                  fontFamily: "'Instrument Sans', sans-serif",
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
                {recording ? t('stop_speaking') : t('speak')}
              </button>
            )}

            <div style={{ flex: 1 }} />
            {renderBottomNav()}
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 4 — DETAILS                                                */}
        {/* ================================================================ */}
        {step === 4 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>{t('details_title')}</div>
            <div style={{ fontSize: 15, color: '#9D9DA1', marginBottom: 24 }}>{t('step')} 4 {t('of')} 7</div>

            <label style={labelStyle}>{t('parked_label')}</label>
            <input
              style={inputStyle}
              placeholder="e.g. Bay 3, Front lot, Spot 12..."
              value={parkedLocation}
              onChange={e => setParkedLocation(e.target.value)}
            />

            <label style={{ ...labelStyle, marginTop: 24 }}>{t('keys_label')}</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {([['in_truck', 'keys_in_truck'], ['front_desk', 'keys_front_desk'], ['no', 'keys_no']] as const).map(([val, tKey]) => (
                <div key={val} onClick={() => setKeysLeft(val)} style={optionCardStyle(keysLeft === val)}>{t(tKey)}</div>
              ))}
            </div>

            <label style={{ ...labelStyle, marginTop: 24 }}>{t('staying_label')}</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <div onClick={() => setStaying(true)} style={optionCardStyle(staying === true)}>{t('staying_yes')}</div>
              <div onClick={() => setStaying(false)} style={optionCardStyle(staying === false)}>{t('staying_no')}</div>
            </div>

            <label style={{ ...labelStyle, marginTop: 24 }}>{t('priority_label')}</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {([['routine', 'priority_routine'], ['urgent', 'priority_urgent'], ['breakdown', 'priority_breakdown']] as const).map(([val, tKey]) => (
                <div key={val} onClick={() => setPriority(val)} style={optionCardStyle(priority === val)}>{t(tKey)}</div>
              ))}
            </div>

            <div style={{ flex: 1 }} />
            {renderBottomNav()}
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 5 — WHEN NEEDED                                            */}
        {/* ================================================================ */}
        {step === 5 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>{t('when_title')}</div>
            <div style={{ fontSize: 15, color: '#9D9DA1', marginBottom: 24 }}>{t('step')} 5 {t('of')} 7</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                ['today', 'when_today'],
                ['tomorrow', 'when_tomorrow'],
                ['this_week', 'when_this_week'],
                ['no_rush', 'when_no_rush'],
              ].map(([val, tKey]) => (
                <div key={val} onClick={() => setNeedByDate(val)} style={optionCardStyle(needByDate === val)}>
                  {t(tKey)}
                </div>
              ))}
            </div>

            <label style={{ ...labelStyle, marginTop: 24 }}>{t('when_pick_date')}</label>
            <input
              style={{ ...inputStyle, colorScheme: 'dark' }}
              type="date"
              value={needByDate.length > 10 || ['today', 'tomorrow', 'this_week', 'no_rush'].includes(needByDate) ? '' : needByDate}
              onChange={e => setNeedByDate(e.target.value)}
            />

            <div style={{ flex: 1 }} />
            {renderBottomNav()}
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 6 — AUTHORIZATION                                          */}
        {/* ================================================================ */}
        {step === 6 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>{t('auth_title')}</div>
            <div style={{ fontSize: 15, color: '#9D9DA1', marginBottom: 24 }}>{t('step')} 6 {t('of')} 7</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                onClick={() => { setAuthType('estimate_first'); setAuthLimit(null) }}
                style={{
                  ...optionCardStyle(authType === 'estimate_first'),
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  padding: '20px 24px',
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 700 }}>{t('auth_estimate')}</div>
                <div style={{ fontSize: 14, color: '#9D9DA1', marginTop: 4, fontWeight: 400 }}>We will diagnose and send you a quote before starting work.</div>
              </div>

              <div
                onClick={() => setAuthType('go_ahead')}
                style={{
                  ...optionCardStyle(authType === 'go_ahead'),
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  padding: '20px 24px',
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 700 }}>{t('auth_go_ahead')}</div>
                <div style={{ fontSize: 14, color: '#9D9DA1', marginTop: 4, fontWeight: 400 }}>Authorize us to start work right away.</div>
              </div>
            </div>

            {authType === 'go_ahead' && (
              <>
                <label style={{ ...labelStyle, marginTop: 20 }}>{t('auth_limit_label')}</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {[500, 1000, 2000, 5000, null].map((val) => (
                    <div
                      key={val ?? 'none'}
                      onClick={() => setAuthLimit(val)}
                      style={{
                        ...optionCardStyle(authLimit === val),
                        flex: 'none',
                        padding: '12px 20px',
                        fontSize: 16,
                        minHeight: 'auto',
                      }}
                    >
                      {val ? `$${val.toLocaleString()}` : t('auth_no_limit')}
                    </div>
                  ))}
                </div>
              </>
            )}

            <label style={{ ...labelStyle, marginTop: 24 }}>{t('email_label')} *</label>
            <input
              style={inputStyle}
              type="email"
              placeholder="dispatch@company.com"
              value={contactEmail}
              onChange={e => setContactEmail(e.target.value)}
            />

            <label style={{ ...labelStyle, marginTop: 16 }}>{t('phone_label')} *</label>
            <input
              style={inputStyle}
              type="tel"
              placeholder="(555) 123-4567"
              value={contactPhone}
              onChange={e => setContactPhone(e.target.value)}
            />

            <div style={{ flex: 1 }} />
            {renderBottomNav()}
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 7 — REVIEW                                                 */}
        {/* ================================================================ */}
        {step === 7 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>{t('review_title')}</div>
            <div style={{ fontSize: 15, color: '#9D9DA1', marginBottom: 24 }}>{t('step')} 7 {t('of')} 7</div>

            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: '24px', display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                [t('company_name'), selectedCustomer?.company_name || newCustomer.company_name || '—'],
                [t('unit_number'), selectedUnit ? `#${selectedUnit.unit_number}` : newUnit.unit_number ? `#${newUnit.unit_number}` : '—'],
                ['Concern', concernText || '—'],
                ['Parked', parkedLocation || '—'],
                [t('keys_label'), keysLeft === 'in_truck' ? t('keys_in_truck') : keysLeft === 'front_desk' ? t('keys_front_desk') : t('keys_no')],
                [t('staying_label'), staying === true ? t('staying_yes') : staying === false ? t('staying_no') : '—'],
                ...(staying === false ? [['Need By', needByDate === 'today' ? t('when_today') : needByDate === 'tomorrow' ? t('when_tomorrow') : needByDate === 'this_week' ? t('when_this_week') : needByDate === 'no_rush' ? t('when_no_rush') : needByDate || '—']] : []),
                [t('priority_label'), priority === 'routine' ? t('priority_routine') : priority === 'urgent' ? t('priority_urgent') : t('priority_breakdown')],
                ['Authorization', authType === 'estimate_first' ? t('auth_estimate') : `${t('auth_go_ahead')}${authLimit ? ` (up to $${authLimit.toLocaleString()})` : ` (${t('auth_no_limit')})`}`],
                [t('email_label'), contactEmail || '—'],
                [t('phone_label'), contactPhone || '—'],
              ].map(([label, value], idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 0', borderBottom: idx < 10 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                  <span style={{ fontSize: 14, color: '#9D9DA1', minWidth: 100 }}>{label}</span>
                  <span style={{ fontSize: 16, fontWeight: 600, color: '#EDEDF0', textAlign: 'right', flex: 1, marginLeft: 16, wordBreak: 'break-word' }}>{value}</span>
                </div>
              ))}
            </div>

            <div style={{ flex: 1 }} />

            <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
              <button
                onClick={goBack}
                style={{
                  borderRadius: 12,
                  padding: '16px 32px',
                  fontSize: 18,
                  fontWeight: 700,
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#9D9DA1',
                  cursor: 'pointer',
                  fontFamily: "'Instrument Sans', sans-serif",
                }}
              >
                {t('back')}
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  borderRadius: 12,
                  padding: '16px 32px',
                  fontSize: 18,
                  fontWeight: 700,
                  background: submitting ? '#166534' : '#16A34A',
                  color: '#fff',
                  border: 'none',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontFamily: "'Instrument Sans', sans-serif",
                  flex: 1,
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? t('submitting') : t('submit')}
              </button>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 8 — CONFIRMED                                              */}
        {/* ================================================================ */}
        {step === 8 && result && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 16 }}>
            <CheckCircle2 size={64} color="#16A34A" />
            <div style={{ fontSize: 36, fontWeight: 700, marginTop: 8 }}>{t('confirmed_title')}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1D6FE8', letterSpacing: '0.04em', marginTop: 8 }}>
              {result.wo_number}
            </div>
            <div style={{ fontSize: 18, color: '#9D9DA1', maxWidth: 400, lineHeight: 1.6, marginTop: 8 }}>
              {t('confirmed_sub')} <strong style={{ color: '#EDEDF0' }}>{contactEmail}</strong>
            </div>
            <button
              onClick={resetAll}
              style={{ ...primaryBtnStyle, marginTop: 32, padding: '20px 48px', fontSize: 20 }}
            >
              {t('new_checkin')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared label style
// ---------------------------------------------------------------------------

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#9D9DA1',
  marginBottom: 8,
  marginTop: 0,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  fontFamily: "'Instrument Sans', sans-serif",
}
