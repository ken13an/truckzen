'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import * as XLSX from 'xlsx'
import { COLORS, FONT, FONT_DISPLAY, FONT_MONO } from '@/lib/config/colors'
import { useTheme } from '@/hooks/useTheme'

// ── Column aliases ─────────────────────────────────────────
const BASE_ALIASES: Record<string, string[]> = {
  unit_number:   ['unit', 'unit #', 'unit number', 'truck #', 'truck number', 'equipment #', 'asset #', 'fleet #'],
  vin:           ['vin', 'vin number', 'vin #', 'serial', 'serial number'],
  year:          ['year', 'truck year', 'model year', 'yr'],
  make:          ['make', 'maker', 'manufacturer', 'brand', 'mfg'],
  model:         ['model', 'mdl', 'truck model'],
  mileage:       ['mileage', 'miles', 'odometer', 'odo', 'current miles'],
  company_name:  ['company', 'company name', 'carrier', 'fleet', 'customer', 'business name'],
  dot:           ['dot', 'dot #', 'dot number', 'usdot'],
  mc:            ['mc', 'mc #', 'mc number'],
  phone:         ['phone', 'telephone', 'tel', 'mobile', 'cell'],
  contact:       ['contact', 'contact name', 'rep', 'representative', 'person', 'manager'],
  email:         ['email', 'e-mail', 'email address'],
  license_plate: ['plate', 'license plate', 'tag', 'license'],
  unit_type:     ['type', 'unit type', 'vehicle type', 'equip type'],
}

const SO_ALIASES: Record<string, string[]> = {
  so_number: ['so number', 'service order', 'work order', 'wo', 'ro', 'repair order', 'order #', 'so #', 'wo #'],
  concern: ['complaint', 'concern', 'customer complaint', 'description', 'issue', 'problem'],
  cause: ['cause', 'diagnosis', 'finding', 'root cause'],
  correction: ['correction', 'repair', 'resolution', 'fix', 'work performed'],
  status: ['status', 'so status', 'order status'],
  date_created: ['date', 'created', 'date created', 'open date', 'so date', 'order date'],
  total_amount: ['total', 'amount', 'grand total', 'total amount'],
  tech_name: ['tech', 'technician', 'mechanic', 'assigned to', 'tech name'],
  total_labor_hours: ['hours', 'labor hours', 'total hours', 'time', 'labor time'],
}

const INVOICE_ALIASES: Record<string, string[]> = {
  invoice_number: ['invoice', 'inv', 'invoice #', 'inv #', 'invoice number'],
  total: ['amount', 'total', 'invoice total', 'grand total'],
  amount_paid: ['paid', 'amount paid', 'payment', 'received'],
  balance_due: ['balance', 'balance due', 'remaining', 'outstanding'],
  due_date: ['due', 'due date', 'payment due'],
  payment_method: ['payment method', 'method', 'pay type'],
}

type DataType = 'customers' | 'vehicles' | 'service_orders' | 'invoices' | 'parts'

function getAliasesForType(dt: DataType): Record<string, string[]> {
  switch (dt) {
    case 'customers': return { company_name: BASE_ALIASES.company_name, dot: BASE_ALIASES.dot, mc: BASE_ALIASES.mc, phone: BASE_ALIASES.phone, contact: BASE_ALIASES.contact, email: BASE_ALIASES.email }
    case 'vehicles': return { unit_number: BASE_ALIASES.unit_number, vin: BASE_ALIASES.vin, year: BASE_ALIASES.year, make: BASE_ALIASES.make, model: BASE_ALIASES.model, mileage: BASE_ALIASES.mileage, company_name: BASE_ALIASES.company_name, license_plate: BASE_ALIASES.license_plate, unit_type: BASE_ALIASES.unit_type }
    case 'service_orders': return SO_ALIASES
    case 'invoices': return INVOICE_ALIASES
    case 'parts': return { part_number: [['part', 'part #', 'part number', 'sku']], part_name: [['name', 'description', 'part name']], quantity: [['qty', 'quantity', 'count']], cost: [['cost', 'unit cost', 'price']] } as any
    default: return BASE_ALIASES
  }
}

interface ColMapping { header: string; field: string; confidence: number }

function fuzzyMatch(header: string, aliases: Record<string, string[]>): { field: string; confidence: number } {
  const h = header.toLowerCase().trim()
  let bestField = '__unmapped'
  let bestScore = 0

  for (const [field, aliasList] of Object.entries(aliases)) {
    const flatAliases = Array.isArray(aliasList[0]) ? (aliasList as any).flat() : aliasList
    for (const alias of flatAliases) {
      const a = String(alias).toLowerCase()
      let score = 0
      if (h === a) score = 100
      else if (h.includes(a) || a.includes(h)) score = 80
      else {
        const hWords = h.split(/[\s_-]+/)
        const aWords = a.split(/[\s_-]+/)
        const shared = hWords.filter(w => aWords.some((aw: string) => aw.includes(w) || w.includes(aw))).length
        if (shared > 0) score = Math.min(70, shared * 35)
      }
      if (score > bestScore) { bestScore = score; bestField = field }
    }
  }
  return { field: bestScore >= 70 ? bestField : '__unmapped', confidence: bestScore }
}

// ── Styles ─────────────────────────────────────────────────
const card: React.CSSProperties = { background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 20, marginBottom: 14 }
const btnSecondary: React.CSSProperties = { padding: '10px 20px', background: 'transparent', border: `1px solid ${COLORS.border}`, borderRadius: 9, color: COLORS.textSecondary, fontSize: 12, cursor: 'pointer', fontFamily: FONT }

const COMING_SOON = ['Shop-Ware', 'TMT', 'Shopmonkey', 'Fleetio']
const DATA_TYPE_LABELS: Record<DataType, string> = { customers: 'Customers', vehicles: 'Vehicles', service_orders: 'Service Orders', invoices: 'Invoices', parts: 'Parts' }
const STEP_LABELS = ['Source', 'Connect', 'Map', 'Preview', 'Duplicates', 'Import', 'Complete']

export default function MigrationHubPage() {
  const { tokens: _tz } = useTheme()
  const btnPrimary: React.CSSProperties = { padding: '12px 24px', background: `linear-gradient(135deg, ${COLORS.blue}, #1248B0)`, border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, color: _tz.bgLight, cursor: 'pointer', fontFamily: FONT }
  const th: React.CSSProperties = { fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: '.08em', padding: '8px 10px', textAlign: 'left', background: _tz.bgInput, whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '8px 10px', borderBottom: `1px solid ${_tz.border}`, fontSize: 11, color: _tz.textSecondary }

  const supabase = createClient()

  // All state hooks at top
  const [step, setStep] = useState(1)
  const [source, setSource] = useState<'fullbay' | 'csv' | 'fresh' | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [connectionResult, setConnectionResult] = useState<any>(null)
  const [testingConnection, setTestingConnection] = useState(false)
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set())

  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; type: DataType; rows: any[]; headers: string[] }[]>([])
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const [colMappings, setColMappings] = useState<ColMapping[]>([])

  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState<Record<string, { total: number; done: number; status: string }>>({})
  const [result, setResult] = useState<any>(null)
  const [duplicates, setDuplicates] = useState<any[]>([])

  const [previewRows, setPreviewRows] = useState<{ row: Record<string, string>; status: 'new' | 'match' | 'duplicate' | 'error'; reason?: string }[]>([])
  const [dragging, setDragging] = useState(false)
  const [toast, setToast] = useState('')
  const [startTime, setStartTime] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    getCurrentUser(supabase).then((p: any) => {
      if (!p) { window.location.href = '/login'; return }
      if (p.role !== 'owner' && p.role !== 'gm' && p.role !== 'it_person') {
        window.location.href = '/'; return
      }
      setUser(p)
      setLoading(false)
    })
  }, [])

  // Timer for import progress
  useEffect(() => {
    if (!importing) return
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000)
    return () => clearInterval(iv)
  }, [importing, startTime])

  // ── File handling ──────────────────────────────────────
  const handleFile = useCallback(async (f: File) => {
    try {
      const data = await f.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const json: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })
      if (json.length < 2) { flash('File has no data rows'); return }

      const hdrs = (json[0] as string[]).map(h => String(h || '').trim()).filter(Boolean)
      const rows = json.slice(1).filter(r => r.some((c: any) => c != null && String(c).trim())).map(r => {
        const obj: Record<string, string> = {}
        hdrs.forEach((h, i) => { obj[h] = String(r[i] ?? '').trim() })
        return obj
      })

      // Auto-detect data type
      const lower = hdrs.map(h => h.toLowerCase())
      let detectedType: DataType = 'customers'
      if (lower.some(h => h.includes('vin') || h.includes('unit'))) detectedType = 'vehicles'
      else if (lower.some(h => h.includes('invoice') || h.includes('inv'))) detectedType = 'invoices'
      else if (lower.some(h => h.includes('work order') || h.includes('service order') || h.includes('wo') || h.includes('ro'))) detectedType = 'service_orders'
      else if (lower.some(h => h.includes('part number') || h.includes('sku'))) detectedType = 'parts'

      setUploadedFiles(prev => [...prev, { name: f.name, type: detectedType, rows, headers: hdrs }])
    } catch {
      flash('Failed to parse file')
    }
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && (f.name.endsWith('.csv') || f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) handleFile(f)
    else flash('Please upload .xlsx or .csv')
  }, [handleFile])

  // ── Column mapping helpers ─────────────────────────────
  function buildMappings(fileIdx: number) {
    const file = uploadedFiles[fileIdx]
    if (!file) return
    const aliases = getAliasesForType(file.type)
    const mappings = file.headers.map(h => {
      const { field, confidence } = fuzzyMatch(h, aliases)
      return { header: h, field, confidence }
    })
    setColMappings(mappings)
    setCurrentFileIndex(fileIdx)
  }

  function updateMapping(idx: number, newField: string) {
    setColMappings(prev => prev.map((m, i) => i === idx ? { ...m, field: newField, confidence: newField === '__unmapped' ? 0 : 100 } : m))
  }

  function mapRows(rows: Record<string, string>[]): Record<string, string>[] {
    return rows.map(row => {
      const mapped: Record<string, string> = {}
      for (const cm of colMappings) {
        if (cm.field !== '__unmapped') mapped[cm.field] = row[cm.header] || ''
      }
      return mapped
    })
  }

  // ── Preview generation ─────────────────────────────────
  async function generatePreview() {
    const file = uploadedFiles[currentFileIndex]
    if (!file) return
    const mapped = mapRows(file.rows.slice(0, 20))
    const previews: typeof previewRows = []
    const seenNames = new Map<string, number>()

    for (let i = 0; i < mapped.length; i++) {
      const row = mapped[i]
      let status: typeof previewRows[0]['status'] = 'new'
      let reason = ''

      // Validation
      if (file.type === 'customers' && !row.company_name) { status = 'error'; reason = 'Missing company name' }
      else if (file.type === 'vehicles' && !row.unit_number) { status = 'error'; reason = 'Missing unit number' }
      else if (file.type === 'service_orders' && !row.so_number) { status = 'error'; reason = 'Missing SO number' }
      else if (file.type === 'invoices' && !row.invoice_number) { status = 'error'; reason = 'Missing invoice number' }

      if (status === 'new') {
        // Check for duplicates within file
        const key = file.type === 'customers' ? row.company_name?.toLowerCase() :
          file.type === 'vehicles' ? row.vin?.toLowerCase() || row.unit_number?.toLowerCase() :
          file.type === 'service_orders' ? row.so_number : row.invoice_number
        if (key && seenNames.has(key)) { status = 'duplicate'; reason = 'Duplicate in file' }
        else if (key) seenNames.set(key, i)

        // Check existing in DB
        if (status === 'new' && user?.shop_id) {
          try {
            if (file.type === 'customers' && row.company_name) {
              const { data } = await supabase.from('customers').select('id').eq('shop_id', user.shop_id).ilike('company_name', row.company_name).limit(1)
              if (data?.length) { status = 'match'; reason = 'Existing customer found' }
            } else if (file.type === 'vehicles' && row.unit_number) {
              const { data } = await supabase.from('assets').select('id').eq('shop_id', user.shop_id).eq('unit_number', row.unit_number).limit(1)
              if (data?.length) { status = 'match'; reason = 'Existing vehicle found' }
            }
          } catch {}
        }
      }
      previews.push({ row, status, reason })
    }

    // Detect duplicates for step 5
    const dupes: any[] = []
    if (file.type === 'customers') {
      const names = mapped.map(r => r.company_name).filter(Boolean)
      for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
          if (names[i] && names[j] && names[i].toLowerCase().includes(names[j].toLowerCase().slice(0, 5))) {
            dupes.push({ a: names[i], b: names[j], action: 'keep_separate' })
          }
        }
      }
    }
    setDuplicates(dupes)
    setPreviewRows(previews)
    setStep(4)
  }

  // ── API Connection ─────────────────────────────────────
  async function testConnection() {
    setTestingConnection(true)
    try {
      const res = await fetch('/api/migrate/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'fullbay', api_key: apiKey, shop_id: user?.shop_id }),
      })
      const data = await res.json()
      if (res.ok) setConnectionResult(data)
      else flash(data.error || 'Connection failed')
    } catch { flash('Connection failed') }
    setTestingConnection(false)
  }

  // ── Import ─────────────────────────────────────────────
  async function runImport() {
    setImporting(true)
    setStep(6)
    setStartTime(Date.now())

    const types = source === 'fullbay'
      ? Array.from(selectedTypes) as DataType[]
      : uploadedFiles.map(f => f.type)

    const totalResult: Record<string, { imported: number; updated: number; skipped: number }> = {}
    const prog: Record<string, { total: number; done: number; status: string }> = {}

    for (const dt of types) {
      const file = uploadedFiles.find(f => f.type === dt)
      const total = source === 'fullbay' ? (connectionResult?.counts?.[dt] || 0) : (file?.rows.length || 0)
      prog[dt] = { total, done: 0, status: 'waiting' }
    }
    setProgress({ ...prog })

    for (const dt of types) {
      prog[dt].status = 'importing'
      setProgress({ ...prog })

      try {
        const body: any = { type: dt, shop_id: user?.shop_id, source }
        if (source === 'fullbay') {
          body.api_key = apiKey
        } else {
          const file = uploadedFiles.find(f => f.type === dt)
          if (!file) continue
          const aliases = getAliasesForType(dt)
          const mappings = file.headers.map(h => fuzzyMatch(h, aliases))
          const mapped = file.rows.map(row => {
            const out: Record<string, string> = {}
            file.headers.forEach((h, i) => {
              if (mappings[i].field !== '__unmapped') out[mappings[i].field] = row[h] || ''
            })
            return out
          })
          body.rows = mapped
        }

        const BATCH = 50
        const rows = body.rows || []
        const totalRows = rows.length || prog[dt].total
        let imported = 0, updated = 0, skipped = 0

        if (source === 'fullbay') {
          const res = await fetch('/api/migrate/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
          const data = await res.json()
          imported = data.imported || 0; updated = data.updated || 0; skipped = data.skipped || 0
          prog[dt].done = totalRows
        } else {
          for (let i = 0; i < rows.length; i += BATCH) {
            const batch = rows.slice(i, i + BATCH)
            try {
              const res = await fetch('/api/migrate/import', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...body, rows: batch }),
              })
              const data = await res.json()
              imported += data.imported || 0; updated += data.updated || 0; skipped += data.skipped || 0
            } catch {}
            prog[dt].done = Math.min(totalRows, i + BATCH)
            setProgress({ ...prog })
          }
        }

        prog[dt].status = 'done'
        totalResult[dt] = { imported, updated, skipped }
      } catch {
        prog[dt].status = 'error'
      }
      setProgress({ ...prog })
    }

    setResult(totalResult)
    setImporting(false)
    setStep(7)
  }

  function reset() {
    setStep(1); setSource(null); setApiKey(''); setConnectionResult(null)
    setSelectedTypes(new Set()); setUploadedFiles([]); setColMappings([])
    setPreviewRows([]); setResult(null); setDuplicates([])
    setProgress({}); setCurrentFileIndex(0)
  }

  function toggleType(t: string) {
    setSelectedTypes(prev => { const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n })
  }

  const mappedCount = colMappings.filter(m => m.field !== '__unmapped').length
  const avgConf = colMappings.length ? Math.round(colMappings.reduce((s, m) => s + m.confidence, 0) / colMappings.length) : 0
  const currentFile = uploadedFiles[currentFileIndex]
  const currentAliases = currentFile ? getAliasesForType(currentFile.type) : {}
  const allFieldsForType = Object.keys(currentAliases)
  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  if (loading) return null

  return (
    <div style={{ background: COLORS.bg, minHeight: '100vh', color: COLORS.text, fontFamily: FONT, padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: COLORS.blue, color: _tz.bgLight, padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>{toast}</div>}

      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, marginBottom: 4 }}>Migration Hub</div>
      <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 24 }}>Import data from other shop management systems or spreadsheets.</div>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {STEP_LABELS.map((label, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ height: 4, borderRadius: 2, marginBottom: 4, background: step > i + 1 ? COLORS.green : step === i + 1 ? COLORS.blue : COLORS.border, transition: 'background 0.3s' }} />
            <span style={{ fontSize: 10, color: step >= i + 1 ? COLORS.text : COLORS.textDim, fontWeight: 600 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* ═══ STEP 1: CHOOSE SOURCE ═══ */}
      {step === 1 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
            {([
              { key: 'fullbay', label: 'Legacy System API', desc: 'Connect directly to your legacy system account', icon: '🔗' },
              { key: 'csv', label: 'Upload Files', desc: 'CSV or Excel spreadsheets', icon: '📄' },
              { key: 'fresh', label: 'Start Fresh', desc: 'Skip import, start entering data', icon: '✨' },
            ] as const).map(s => (
              <div key={s.key} onClick={() => { setSource(s.key); if (s.key === 'fresh') {} else setStep(2) }}
                style={{ ...card, cursor: 'pointer', textAlign: 'center', padding: 28, border: source === s.key ? `2px solid ${COLORS.blue}` : `1px solid ${COLORS.border}`, transition: 'border-color 0.2s' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>{s.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{s.desc}</div>
              </div>
            ))}
          </div>

          {/* Coming soon */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {COMING_SOON.map(name => (
              <div key={name} style={{ padding: '8px 16px', borderRadius: 8, background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, fontSize: 12, color: COLORS.textDim, display: 'flex', alignItems: 'center', gap: 8 }}>
                {name}
                <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: COLORS.amberBg, color: COLORS.amber, fontWeight: 700 }}>COMING SOON</span>
              </div>
            ))}
          </div>

          {source === 'fresh' && (
            <div style={{ ...card, textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Ready to go!</div>
              <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 20 }}>Your shop is set up. Start adding customers and vehicles manually.</div>
              <a href="/customers" style={{ ...btnPrimary, textDecoration: 'none', display: 'inline-block' }}>Go to Customers</a>
            </div>
          )}
        </>
      )}

      {/* ═══ STEP 2a: FULLBAY API CONNECT ═══ */}
      {step === 2 && source === 'fullbay' && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Connect to Legacy System</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Enter your legacy system API key"
              style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: _tz.bgInput, color: COLORS.text, fontSize: 13, fontFamily: FONT_MONO, outline: 'none' }} />
            <button onClick={testConnection} disabled={!apiKey || testingConnection}
              style={{ ...btnPrimary, opacity: !apiKey || testingConnection ? 0.5 : 1 }}>
              {testingConnection ? 'Testing...' : 'Test Connection'}
            </button>
          </div>

          {connectionResult && (
            <>
              <div style={{ padding: 14, background: COLORS.greenBg, borderRadius: 8, marginBottom: 16, border: `1px solid ${COLORS.green}30` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.green, marginBottom: 4 }}>Connected: {connectionResult.shop_name || 'Legacy Shop'}</div>
                <div style={{ fontSize: 11, color: COLORS.textSecondary }}>
                  {Object.entries(connectionResult.counts || {}).map(([k, v]) => `${DATA_TYPE_LABELS[k as DataType] || k}: ${v}`).join(' · ')}
                </div>
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Select data to import:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                {(['customers', 'vehicles', 'service_orders', 'invoices', 'parts'] as DataType[]).map(dt => (
                  <label key={dt} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: _tz.bgInput, cursor: 'pointer' }}>
                    <input type="checkbox" checked={selectedTypes.has(dt)} onChange={() => toggleType(dt)}
                      style={{ accentColor: COLORS.blue }} />
                    <span style={{ fontSize: 13, color: COLORS.text }}>{DATA_TYPE_LABELS[dt]}</span>
                    <span style={{ fontSize: 11, color: COLORS.textDim, marginLeft: 'auto' }}>{connectionResult.counts?.[dt] || 0} records</span>
                  </label>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setStep(1); setConnectionResult(null) }} style={btnSecondary}>Back</button>
                <button onClick={() => { setStep(6); runImport() }} disabled={selectedTypes.size === 0}
                  style={{ ...btnPrimary, flex: 1, opacity: selectedTypes.size === 0 ? 0.5 : 1 }}>
                  Start Migration ({selectedTypes.size} types)
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ STEP 2b: FILE UPLOAD ═══ */}
      {step === 2 && source === 'csv' && (
        <>
          <div style={{ ...card, border: `2px dashed ${dragging ? COLORS.blue : COLORS.border}`, textAlign: 'center', padding: 48, cursor: 'pointer', transition: 'border-color 0.2s' }}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById('migrateFileInput')?.click()}>
            <div style={{ fontSize: 40, marginBottom: 8, opacity: 0.3 }}>+</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Drop files here</div>
            <div style={{ fontSize: 13, color: COLORS.textSecondary }}>Supports .xlsx and .csv</div>
            <input id="migrateFileInput" type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }}
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>

          {uploadedFiles.length > 0 && (
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Uploaded Files</div>
              {uploadedFiles.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8, background: _tz.bgInput, marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{f.name}</div>
                    <div style={{ fontSize: 11, color: COLORS.textDim }}>{f.rows.length} rows, {f.headers.length} columns</div>
                  </div>
                  <select value={f.type} onChange={e => {
                    setUploadedFiles(prev => prev.map((ff, ii) => ii === i ? { ...ff, type: e.target.value as DataType } : ff))
                  }} style={{ padding: '6px 10px', borderRadius: 6, fontSize: 12, background: COLORS.bgCard, color: COLORS.text, border: `1px solid ${COLORS.border}`, fontFamily: FONT, outline: 'none' }}>
                    {Object.entries(DATA_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              ))}

              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button onClick={() => document.getElementById('migrateFileInput')?.click()} style={btnSecondary}>Upload Another File</button>
                <button onClick={() => { buildMappings(0); setStep(3) }} style={{ ...btnPrimary, flex: 1 }}>Continue to Mapping</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ STEP 3: COLUMN MAPPING ═══ */}
      {step === 3 && currentFile && (
        <>
          {uploadedFiles.length > 1 && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {uploadedFiles.map((f, i) => (
                <button key={i} onClick={() => buildMappings(i)}
                  style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
                    background: i === currentFileIndex ? COLORS.blueBg : 'transparent',
                    border: `1px solid ${i === currentFileIndex ? COLORS.blue : COLORS.border}`,
                    color: i === currentFileIndex ? COLORS.blueLight : COLORS.textSecondary }}>
                  {f.name}
                </button>
              ))}
            </div>
          )}

          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Column Mapping — {DATA_TYPE_LABELS[currentFile.type]}</div>
                <div style={{ fontSize: 12, color: COLORS.textSecondary }}>{currentFile.name} — {currentFile.rows.length} rows</div>
              </div>
              <div style={{ fontSize: 12, color: avgConf >= 70 ? COLORS.green : COLORS.amber, fontWeight: 700 }}>
                {mappedCount}/{currentFile.headers.length} mapped ({avgConf}%)
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {colMappings.map((cm, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: _tz.bgInput, borderRadius: 8 }}>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{cm.header}</div>
                  <div style={{ fontSize: 11, color: COLORS.textDim }}>→</div>
                  <select value={cm.field} onChange={e => updateMapping(i, e.target.value)}
                    style={{ flex: 1, padding: '6px 10px', borderRadius: 6, fontSize: 12, background: COLORS.bgCard, color: cm.field === '__unmapped' ? COLORS.red : COLORS.text, border: `1px solid ${cm.field === '__unmapped' ? COLORS.red : COLORS.border}`, fontFamily: FONT, outline: 'none' }}>
                    <option value="__unmapped">-- Unmapped --</option>
                    {allFieldsForType.map(f => <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>)}
                  </select>
                  <div style={{ width: 40, textAlign: 'center', fontSize: 11, fontWeight: 700, color: cm.confidence >= 90 ? COLORS.green : cm.confidence >= 70 ? COLORS.amber : COLORS.red }}>
                    {cm.confidence}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep(2)} style={btnSecondary}>Back</button>
            <button onClick={generatePreview} disabled={mappedCount === 0}
              style={{ ...btnPrimary, flex: 1, opacity: mappedCount === 0 ? 0.5 : 1 }}>Preview Data</button>
          </div>
        </>
      )}

      {/* ═══ STEP 4: DATA PREVIEW ═══ */}
      {step === 4 && (
        <>
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Data Preview (first 20 rows)</div>
            <div style={{ display: 'flex', gap: 14, marginBottom: 14, fontSize: 12 }}>
              {[
                { color: '#22C55E', label: 'New Record' },
                { color: '#F59E0B', label: 'Existing Match' },
                { color: '#F97316', label: 'Potential Duplicate' },
                { color: '#EF4444', label: 'Validation Error' },
              ].map(s => (
                <span key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, display: 'inline-block' }} /> {s.label}
                </span>
              ))}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr>
                    <th style={th}>#</th>
                    {colMappings.filter(m => m.field !== '__unmapped').map(m => <th key={m.field} style={th}>{m.field.replace(/_/g, ' ')}</th>)}
                    <th style={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((pr, i) => {
                    const rowColor = pr.status === 'new' ? '#22C55E' : pr.status === 'match' ? '#F59E0B' : pr.status === 'duplicate' ? '#F97316' : '#EF4444'
                    return (
                      <tr key={i} style={{ borderLeft: `3px solid ${rowColor}` }}>
                        <td style={td}>{i + 1}</td>
                        {colMappings.filter(m => m.field !== '__unmapped').map(m => <td key={m.field} style={td}>{pr.row[m.field] || '—'}</td>)}
                        <td style={td}>
                          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: `${rowColor}20`, color: rowColor }}>
                            {pr.status === 'error' ? pr.reason : pr.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep(3)} style={btnSecondary}>Back</button>
            <button onClick={() => duplicates.length > 0 ? setStep(5) : runImport()} style={{ ...btnPrimary, flex: 1 }}>
              {duplicates.length > 0 ? 'Review Duplicates' : 'Start Import'}
            </button>
          </div>
        </>
      )}

      {/* ═══ STEP 5: DUPLICATE REVIEW ═══ */}
      {step === 5 && (
        <>
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Potential Duplicates</div>
            <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 16 }}>These records have similar names. Choose to merge or keep separate.</div>

            {duplicates.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: COLORS.textDim, fontSize: 13 }}>No duplicates detected.</div>
            ) : (
              duplicates.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 8, background: _tz.bgInput, marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#F97316' }}>{d.a}</span>
                    <span style={{ fontSize: 11, color: COLORS.textDim, margin: '0 8px' }}>↔</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#F97316' }}>{d.b}</span>
                  </div>
                  <select value={d.action} onChange={e => {
                    setDuplicates(prev => prev.map((dd, ii) => ii === i ? { ...dd, action: e.target.value } : dd))
                  }} style={{ padding: '6px 10px', borderRadius: 6, fontSize: 12, background: COLORS.bgCard, color: COLORS.text, border: `1px solid ${COLORS.border}`, fontFamily: FONT, outline: 'none' }}>
                    <option value="keep_separate">Keep Separate</option>
                    <option value="merge">Merge</option>
                  </select>
                </div>
              ))
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep(4)} style={btnSecondary}>Back</button>
            <button onClick={runImport} style={{ ...btnPrimary, flex: 1 }}>Continue Import</button>
          </div>
        </>
      )}

      {/* ═══ STEP 6: IMPORT PROGRESS ═══ */}
      {step === 6 && (
        <div style={card}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>Importing Data...</div>

          {Object.entries(progress).map(([dt, p]) => {
            const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0
            return (
              <div key={dt} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{DATA_TYPE_LABELS[dt as DataType] || dt}</span>
                  <span style={{ fontSize: 11, color: p.status === 'done' ? COLORS.green : p.status === 'error' ? COLORS.red : COLORS.textSecondary }}>
                    {p.status === 'done' ? 'Complete' : p.status === 'error' ? 'Error' : p.status === 'importing' ? `${p.done}/${p.total}` : 'Waiting'}
                  </span>
                </div>
                <div style={{ width: '100%', height: 8, background: COLORS.border, borderRadius: 4 }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: p.status === 'done' ? COLORS.green : p.status === 'error' ? COLORS.red : COLORS.blue, borderRadius: 4, transition: 'width 0.3s' }} />
                </div>
              </div>
            )
          })}

          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: COLORS.textSecondary }}>
            Elapsed: {fmtTime(elapsed)}
            {importing && Object.values(progress).some(p => p.status === 'importing') && (() => {
              const total = Object.values(progress).reduce((s, p) => s + p.total, 0)
              const done = Object.values(progress).reduce((s, p) => s + p.done, 0)
              if (done > 0 && total > done) {
                const rate = done / elapsed
                const remaining = Math.round((total - done) / rate)
                return ` · Est. remaining: ${fmtTime(remaining)}`
              }
              return ''
            })()}
          </div>
        </div>
      )}

      {/* ═══ STEP 7: COMPLETE ═══ */}
      {step === 7 && result && (
        <div style={card}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.green, marginBottom: 4 }}>Migration Complete</div>
            <div style={{ fontSize: 12, color: COLORS.textSecondary }}>Completed in {fmtTime(elapsed)}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
            {Object.entries(result).map(([dt, r]: [string, any]) => (
              <div key={dt} style={{ background: _tz.bgInput, borderRadius: 10, padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>{DATA_TYPE_LABELS[dt as DataType] || dt}</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.green }}>{r.imported}</div>
                    <div style={{ fontSize: 9, color: COLORS.textDim }}>Imported</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.amber }}>{r.updated}</div>
                    <div style={{ fontSize: 9, color: COLORS.textDim }}>Updated</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.red }}>{r.skipped}</div>
                    <div style={{ fontSize: 9, color: COLORS.textDim }}>Skipped</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary stats */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, background: _tz.bgInput, borderRadius: 8, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.blueLight }}>
                {Object.values(result).reduce((s: number, r: any) => s + r.imported + r.updated, 0)}
              </div>
              <div style={{ fontSize: 10, color: COLORS.textDim }}>Total Records Processed</div>
            </div>
            <div style={{ flex: 1, background: _tz.bgInput, borderRadius: 8, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.amber }}>
                {Object.values(result).reduce((s: number, r: any) => s + r.skipped, 0)}
              </div>
              <div style={{ fontSize: 10, color: COLORS.textDim }}>Records Needing Review</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <a href="/customers" style={{ ...btnPrimary, textDecoration: 'none', display: 'inline-block' }}>View Customers</a>
            <button onClick={() => flash('Review report downloaded')} style={btnSecondary}>Download Report</button>
            <button onClick={reset} style={btnSecondary}>Run Another</button>
          </div>
        </div>
      )}
    </div>
  )
}
