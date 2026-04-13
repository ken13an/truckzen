'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { ADMIN_ROLES } from '@/lib/roles'
import ExcelJS from 'exceljs'
import * as XLSX from 'xlsx'

// ── Column aliases for fuzzy matching ────────────────────
const COLUMN_ALIASES: Record<string, string[]> = {
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

// Trucks-specific aliases (used for AI-enhanced mapping)
const TRUCK_ALIASES: Record<string, string[]> = {
  unit_number:      ['unit', 'unit #', 'unit number', 'truck #', 'truck number', 'equipment #', 'asset #', 'fleet #'],
  vin:              ['vin', 'vin number', 'vin #', 'serial', 'serial number'],
  year:             ['year', 'truck year', 'model year', 'yr'],
  make:             ['make', 'maker', 'manufacturer', 'brand', 'mfg'],
  model:            ['model', 'mdl', 'truck model'],
  type:             ['type', 'unit type', 'vehicle type', 'equip type'],
  license_plate:    ['plate', 'license plate', 'tag', 'license'],
  license_state:    ['state', 'license state', 'plate state'],
  mileage:          ['mileage', 'miles', 'odometer', 'odo', 'current miles'],
  customer_name:    ['company', 'company name', 'carrier', 'fleet', 'customer', 'business name'],
  is_owner_operator:['owner operator', 'o/o', 'owner op', 'is owner operator'],
  contact_email:    ['email', 'e-mail', 'email address', 'contact email'],
  contact_phone:    ['phone', 'telephone', 'tel', 'mobile', 'cell', 'contact phone'],
  notes:            ['notes', 'comments', 'remarks', 'note'],
}

type MappedField = string

interface ColMapping { header: string; field: MappedField; confidence: number }

function fuzzyMatch(header: string, aliasMap: Record<string, string[]>): { field: string; confidence: number } {
  const h = header.toLowerCase().trim()
  let bestField = '__unmapped'
  let bestScore = 0

  for (const [field, aliases] of Object.entries(aliasMap)) {
    for (const alias of aliases) {
      const a = alias.toLowerCase()
      let score = 0

      if (h === a) { score = 100 }
      else if (h.includes(a) || a.includes(h)) { score = 80 }
      else {
        const hWords = h.split(/[\s_-]+/)
        const aWords = a.split(/[\s_-]+/)
        const shared = hWords.filter(w => aWords.some(aw => aw.includes(w) || w.includes(aw))).length
        if (shared > 0) score = Math.min(70, shared * 35)
      }

      if (score > bestScore) { bestScore = score; bestField = field }
    }
  }

  return { field: bestScore >= 70 ? bestField : '__unmapped', confidence: bestScore }
}

type ImportType = 'trucks' | 'companies' | 'contacts' | 'parts'

const PARTS_ALIASES: Record<string, string[]> = {
  part_number:      ['part #', 'part number', 'sku', 'item code', 'item #', 'pn', 'number'],
  description:      ['description', 'name', 'item name', 'part name', 'desc', 'item description'],
  category:         ['category', 'type', 'group', 'class'],
  cost_price:       ['cost', 'buy price', 'unit cost', 'cost price', 'purchase price'],
  sell_price:       ['price', 'sell price', 'retail', 'retail price', 'list price', 'sell'],
  on_hand:          ['qty', 'stock', 'on hand', 'quantity', 'qty on hand', 'in stock', 'count'],
  reorder_point:    ['reorder', 'reorder point', 'min stock', 'min qty', 'minimum'],
  vendor:           ['vendor', 'supplier', 'mfg', 'manufacturer', 'brand'],
  bin_location:     ['location', 'bin', 'shelf', 'bin location', 'rack', 'aisle'],
}

function detectSheetType(name: string, headers: string[]): ImportType {
  const n = name.toLowerCase()
  if (n.includes('company') || n.includes('customer') || n.includes('carrier')) return 'companies'
  if (n.includes('contact') || n.includes('owner')) return 'contacts'
  if (n.includes('truck') || n.includes('vehicle') || n.includes('fleet') || n.includes('unit') || n.includes('trailer')) return 'trucks'
  const lower = headers.map(h => h.toLowerCase())
  if (lower.some(h => h.includes('part') || h.includes('sku') || h.includes('bin') || h.includes('reorder'))) return 'parts'
  if (lower.some(h => h.includes('vin') || h.includes('unit'))) return 'trucks'
  if (lower.some(h => h.includes('company') || h.includes('dot'))) return 'companies'
  return 'trucks'
}

import AppPageShell from '@/components/layout/AppPageShell'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans', sans-serif"

export default function SmartDropPage() {
  const { tokens: _t } = useTheme()
  const CARD_BG = 'var(--tz-bgCard)'
  const BORDER = 'var(--tz-border)'
  const TEXT = 'var(--tz-text)'
  const DIM = 'var(--tz-textSecondary)'
  const BLUE = 'var(--tz-accent)'
  const GREEN = 'var(--tz-success)'
  const AMBER = 'var(--tz-warning)'
  const RED = 'var(--tz-danger)'
  const card = makeCard(_t)
  const th = makeTh(_t)
  const td = makeTd(_t)
  const btnPrimary = makeBtnPrimary(_t)
  const btnSecondary = makeBtnSecondary(_t)
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')

  // Parsed data
  const [allRows, setAllRows] = useState<Record<string, string>[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [colMappings, setColMappings] = useState<ColMapping[]>([])
  const [importType, setImportType] = useState<ImportType>('trucks')

  // Preview + import
  const [previewRows, setPreviewRows] = useState<any[]>([])
  const [validating, setValidating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ imported: number; updated: number; skipped: number; errors: string[]; batchId?: string; skippedRows?: any[] } | null>(null)

  // Import history
  const [history, setHistory] = useState<any[]>([])

  // Fullbay WO sync
  const [fbStats, setFbStats] = useState<{ fullbay_wos: number; total_wos: number; last_synced: string | null } | null>(null)
  const [fbSyncing, setFbSyncing] = useState<string | null>(null)
  const [fbResult, setFbResult] = useState<any>(null)

  // Customer match overrides
  const [customerOverrides, setCustomerOverrides] = useState<Record<number, string>>({})

  // Fullbay integration
  const [mode, setMode] = useState<'upload' | 'fullbay'>('upload')
  const [fbConnected, setFbConnected] = useState<boolean | null>(null)
  const [fbName, setFbName] = useState('')
  const [fbPreview, setFbPreview] = useState<any[]>([])
  const [fbPreviewType, setFbPreviewType] = useState('')

  const [toast, setToast] = useState('')
  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    getCurrentUser(supabase).then((p: any) => {
      if (!p) { window.location.href = '/login'; return }
      setUser(p)
      fetchHistory(p.shop_id)
      // Fullbay stats and connection check are admin-only
      const adminCheck = !p.impersonate_role && (ADMIN_ROLES.includes(p.role) || p.is_platform_owner)
      if (adminCheck) {
        fetchFbStats(p.shop_id)
        fetch('/api/fullbay/test-connection').then(r => r.json()).then(d => {
          setFbConnected(d.ok)
          if (d.name) setFbName(d.name)
        }).catch(() => setFbConnected(false))
      }
    })
  }, [])

  async function fetchHistory(shopId: string) {
    const res = await fetch(`/api/smart-import/trucks/history?shop_id=${shopId}`)
    if (res.ok) setHistory(await res.json())
  }

  async function fetchFbStats(shopId: string) {
    const res = await fetch(`/api/fullbay/sync/work-orders?shop_id=${shopId}`)
    if (res.ok) setFbStats(await res.json())
  }

  async function syncFullbayWOs() {
    if (!user || fbSyncing) return
    setFbSyncing('work_orders')
    setFbResult(null)
    const res = await fetch('/api/fullbay/sync/work-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop_id: user.shop_id, user_id: user.id, user_role: user.role }),
    })
    setFbSyncing(null)
    if (res.ok) {
      const data = await res.json()
      setFbResult(data)
      fetchFbStats(user.shop_id)
      flash(`Synced ${data.imported} new, ${data.updated} updated WOs`)
    } else {
      const err = await res.json()
      flash(err.error || 'Sync failed')
    }
  }

  // ── Download Template ────────────────────────────────────
  async function downloadTemplate() {
    window.location.href = '/api/smart-import/trucks/template'
  }

  // ── File Handling ────────────────────────────────────────
  async function handleFile(f: File) {
    setFileName(f.name)
    try {
      const data = await f.arrayBuffer()
      const workbook = XLSX.read(data)

      // Use first data sheet (skip "Instructions" sheet)
      let sheetName = workbook.SheetNames[0]
      if (workbook.SheetNames.length > 1 && sheetName.toLowerCase().includes('instruct')) {
        sheetName = workbook.SheetNames[1]
      }
      const sheet = workbook.Sheets[sheetName]
      const json: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })

      if (json.length < 2) { flash('File has no data rows'); return }

      const hdrs = (json[0] as string[]).map(h => String(h || '').trim()).filter(Boolean)
      const rows = json.slice(1).filter(r => r.some(c => c != null && String(c).trim())).map(r => {
        const obj: Record<string, string> = {}
        hdrs.forEach((h, i) => { obj[h] = String(r[i] ?? '').trim() })
        return obj
      })

      setHeaders(hdrs)
      setAllRows(rows)

      const detected = detectSheetType(sheetName, hdrs)
      setImportType(detected)

      // Try AI mapping for trucks, fallback to local fuzzy
      if (detected === 'trucks') {
        try {
          const aiRes = await fetch('/api/ai/trucks-map', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ headers: hdrs }),
          })
          if (aiRes.ok) {
            const { mappings } = await aiRes.json()
            if (mappings && Array.isArray(mappings)) {
              setColMappings(mappings.map((m: any) => ({
                header: m.header,
                field: m.field || '__unmapped',
                confidence: m.confidence || 0,
              })))
              setStep(2)
              return
            }
          }
        } catch {}
      }

      // Fallback: local fuzzy matching
      const aliases = detected === 'parts' ? PARTS_ALIASES : detected === 'trucks' ? TRUCK_ALIASES : COLUMN_ALIASES
      const mappings = hdrs.map(h => {
        const { field, confidence } = fuzzyMatch(h, aliases)
        return { header: h, field, confidence }
      })
      setColMappings(mappings)
      setStep(2)
    } catch (err) {
      flash('Failed to parse file')
      console.error(err)
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && (f.name.endsWith('.csv') || f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) handleFile(f)
    else flash('Please upload .xlsx or .csv file')
  }, [])

  // ── Column Mapping ───────────────────────────────────────
  function updateMapping(idx: number, newField: MappedField) {
    setColMappings(prev => prev.map((m, i) => i === idx ? { ...m, field: newField, confidence: newField === '__unmapped' ? 0 : 100 } : m))
  }

  const mappedFieldCount = colMappings.filter(m => m.field !== '__unmapped').length
  const avgConfidence = colMappings.length > 0
    ? Math.round(colMappings.reduce((s, m) => s + m.confidence, 0) / colMappings.length)
    : 0

  function mapRows(rows: Record<string, string>[]): Record<string, string>[] {
    return rows.map(row => {
      const mapped: Record<string, string> = {}
      for (const cm of colMappings) {
        if (cm.field !== '__unmapped') {
          mapped[cm.field] = row[cm.header] || ''
        }
      }
      return mapped
    })
  }

  // ── Preview with Server Validation ───────────────────────
  async function generatePreview() {
    setValidating(true)
    const mapped = mapRows(allRows.slice(0, 20))

    if (importType === 'trucks') {
      // Use server-side validation with customer fuzzy matching
      try {
        const res = await fetch('/api/smart-import/trucks/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: mapped, shop_id: user.shop_id }),
        })
        if (res.ok) {
          const data = await res.json()
          setPreviewRows(data.results || [])
          setValidating(false)
          setStep(3)
          return
        }
      } catch {}
    }

    // Fallback: local validation for non-trucks
    const previews: any[] = []
    for (const row of mapped) {
      let status: 'valid' | 'warning' | 'error' = 'valid'
      const issues: string[] = []

      if (importType === 'parts') {
        if (!row.description) { status = 'error'; issues.push('Missing description') }
        else if (row.part_number) {
          try {
            const { data } = await supabase.from('parts').select('id').eq('shop_id', user.shop_id).eq('part_number', row.part_number).limit(1)
            if (data && data.length > 0) { status = 'warning'; issues.push('Existing (will update)') }
          } catch {}
        }
      } else if (importType === 'companies') {
        if (!row.company_name) { status = 'error'; issues.push('Missing company name') }
        else {
          try {
            const { data } = await supabase.from('customers').select('id').eq('shop_id', user.shop_id).ilike('company_name', row.company_name).limit(1)
            if (data && data.length > 0) { status = 'warning'; issues.push('Existing (will update)') }
          } catch {}
        }
      }

      previews.push({ row_index: previews.length, row, status, issues })
    }

    setPreviewRows(previews)
    setValidating(false)
    setStep(3)
  }

  // ── Import ───────────────────────────────────────────────
  async function runImport() {
    if (!user) return
    setImporting(true)
    setStep(4)
    setProgress(0)

    const mapped = mapRows(allRows)
    const batchId = crypto.randomUUID()

    if (importType === 'trucks') {
      // Use new truck-specific import API with batching
      const BATCH = 50
      let totalResult = { imported: 0, updated: 0, skipped: 0, errors: [] as string[], batchId, skippedRows: [] as any[] }

      for (let i = 0; i < mapped.length; i += BATCH) {
        const batch = mapped.slice(i, i + BATCH)
        try {
          const res = await fetch('/api/smart-import/trucks/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows: batch, shop_id: user.shop_id, batch_id: batchId, user_id: user.id }),
          })
          const data = await res.json()
          if (res.ok) {
            totalResult.imported += data.imported || 0
            totalResult.updated += data.updated || 0
            totalResult.skipped += data.skipped || 0
            totalResult.errors.push(...(data.errors || []))
            totalResult.skippedRows.push(...(data.skipped_rows || []))
          }
        } catch {}
        setProgress(Math.min(100, Math.round(((i + BATCH) / mapped.length) * 100)))
      }

      setResult(totalResult)
      setImporting(false)
      setStep(5)
      fetchHistory(user.shop_id)
      return
    }

    // Legacy import for parts/companies/contacts
    const BATCH = 50
    let totalResult = { imported: 0, updated: 0, skipped: 0, errors: [] as string[], batchId }

    for (let i = 0; i < mapped.length; i += BATCH) {
      const batch = mapped.slice(i, i + BATCH)
      try {
        const res = await fetch('/api/smart-drop/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: importType, rows: batch, shop_id: user.shop_id, batch_id: batchId }),
        })
        const data = await res.json()
        if (res.ok) {
          totalResult.imported += data.imported || 0
          totalResult.updated += data.updated || 0
          totalResult.skipped += data.skipped || 0
          totalResult.errors.push(...(data.errors || []))
        }
      } catch {}
      setProgress(Math.min(100, Math.round(((i + BATCH) / mapped.length) * 100)))
    }

    setResult(totalResult)
    setImporting(false)
    setStep(5)
  }

  // ── Error Report Download ────────────────────────────────
  async function downloadErrorReport() {
    if (!result?.skippedRows || result.skippedRows.length === 0) return

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Skipped Rows')

    // Get headers from first skipped row
    const skipHeaders = Object.keys(result.skippedRows[0]).filter(k => k !== '_reason')
    ws.addRow([...skipHeaders, 'Reason Skipped'])

    // Style header
    const headerRow = ws.getRow(1)
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EF4444' } }
      cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 }
    })

    for (const row of result.skippedRows) {
      ws.addRow([...skipHeaders.map(h => row[h] || ''), row._reason || 'Unknown'])
    }

    // Auto-size columns
    ws.columns = [...skipHeaders.map(() => ({ width: 20 })), { width: 40 }]

    const buf = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'TruckZen_Import_Errors.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Undo Import ──────────────────────────────────────────
  async function undoImport(batchId: string) {
    if (!user || !confirm('Undo this import? All imported trucks from this batch will be removed.')) return
    const res = await fetch(`/api/smart-import/trucks/undo/${batchId}?shop_id=${user.shop_id}`, { method: 'DELETE' })
    if (res.ok) {
      const data = await res.json()
      flash(`Undone — ${data.deleted} trucks removed`)
      fetchHistory(user.shop_id)
    } else {
      const err = await res.json()
      flash(err.error || 'Undo failed')
    }
  }

  async function fbLoadPreview(type: string) {
    setFbPreviewType(type)
    setFbPreview([])
    try {
      const res = await fetch(`/api/fullbay/preview/${type}`)
      if (!res.ok) { const d = await res.json(); flash(d.error || 'Preview failed'); return }
      const data = await res.json()
      setFbPreview(data.mapped || [])
    } catch (err: any) {
      flash(err.message || 'Preview failed')
    }
  }

  async function fbSync(type: string) {
    if (!user) return
    setFbSyncing(type)
    setFbResult(null)
    try {
      const res = await fetch(`/api/fullbay/sync/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_id: user.shop_id, user_id: user.id, user_role: user.role }),
      })
      const data = await res.json()
      if (!res.ok) { flash(data.error || 'Sync failed'); setFbSyncing(null); return }
      setFbResult({ type, ...data })
    } catch (err: any) {
      flash(err.message || 'Sync failed')
    }
    setFbSyncing(null)
  }

  function reset() {
    setStep(1); setAllRows([]); setHeaders([]); setColMappings([]); setPreviewRows([]); setResult(null); setFileName(''); setCustomerOverrides({})
  }

  function fmtDate(d: string) {
    return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  if (!user) return null

  const isAdmin = !user.impersonate_role && (ADMIN_ROLES.includes(user.role) || user.is_platform_owner)
  const allFields = importType === 'parts' ? Object.keys(PARTS_ALIASES) : importType === 'trucks' ? Object.keys(TRUCK_ALIASES) : Object.keys(COLUMN_ALIASES)

  return (
    <AppPageShell width="wide" style={{ fontFamily: FONT }}>
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: BLUE, color: 'var(--tz-bgLight)', padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>{toast}</div>}

      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: TEXT, marginBottom: 4 }}>Smart Drop</div>
      <div style={{ fontSize: 12, color: DIM, marginBottom: 16 }}>Upload Excel or CSV files. Columns are auto-mapped using AI + smart matching.</div>

      {/* Mode toggle — Fullbay integration is admin-only */}
      {isAdmin && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button onClick={() => setMode('upload')} style={{
            flex: 1, padding: '14px 20px', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
            border: mode === 'upload' ? `2px solid ${BLUE}` : `1px solid ${BORDER}`,
            background: mode === 'upload' ? 'rgba(29,111,232,.1)' : CARD_BG,
            color: mode === 'upload' ? 'var(--tz-accentLight)' : DIM,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: 8 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Upload
          </button>
          <button onClick={() => setMode('fullbay')} style={{
            flex: 1, padding: '14px 20px', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
            border: mode === 'fullbay' ? `2px solid ${BLUE}` : `1px solid ${BORDER}`,
            background: mode === 'fullbay' ? 'rgba(29,111,232,.1)' : CARD_BG,
            color: mode === 'fullbay' ? 'var(--tz-accentLight)' : DIM,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: 8 }}><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>
            Legacy System
          </button>
        </div>
      )}

      {/* ═══ FULLBAY MODE — admin only ═══ */}
      {mode === 'fullbay' && isAdmin && (
        <>
          {/* Connection status */}
          <div style={{
            ...card, padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
            borderColor: fbConnected === true ? GREEN : fbConnected === false ? RED : BORDER,
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: fbConnected === true ? GREEN : fbConnected === false ? RED : DIM,
            }} />
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {fbConnected === null && <span style={{ color: DIM }}>Checking legacy system connection...</span>}
              {fbConnected === true && <span style={{ color: GREEN }}>Connected to Legacy System{fbName ? ` \u2014 ${fbName}` : ''}</span>}
              {fbConnected === false && <span style={{ color: RED }}>Legacy system not connected. Contact your administrator to configure the integration.</span>}
            </div>
          </div>

          {/* Sync result banner */}
          {fbResult && (
            <div style={{ ...card, padding: 14, marginBottom: 16, borderColor: GREEN }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: GREEN, marginBottom: 8 }}>
                Sync Complete — {fbResult.type}
              </div>
              <div style={{ display: 'flex', gap: 20, fontSize: 12 }}>
                <span><span style={{ fontWeight: 700, color: GREEN }}>{fbResult.imported}</span> <span style={{ color: DIM }}>imported</span></span>
                <span><span style={{ fontWeight: 700, color: AMBER }}>{fbResult.updated}</span> <span style={{ color: DIM }}>updated</span></span>
                <span><span style={{ fontWeight: 700, color: RED }}>{fbResult.skipped}</span> <span style={{ color: DIM }}>skipped</span></span>
                <span><span style={{ fontWeight: 700, color: TEXT }}>{fbResult.total_pulled}</span> <span style={{ color: DIM }}>total pulled</span></span>
              </div>
            </div>
          )}

          {/* Sync sections */}
          {(['customers', 'trucks', 'parts'] as const).map(type => (
            <div key={type} style={{ ...card, padding: 16, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, textTransform: 'capitalize' }}>{type}</div>
                  <div style={{ fontSize: 11, color: DIM, marginTop: 2 }}>
                    Pull {type} from legacy system into TruckZen
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => fbLoadPreview(type)}
                    disabled={!fbConnected || fbSyncing !== null}
                    style={{
                      ...btnSecondary, fontSize: 11, padding: '7px 14px',
                      opacity: !fbConnected || fbSyncing !== null ? 0.4 : 1,
                    }}
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => fbSync(type)}
                    disabled={!fbConnected || fbSyncing !== null}
                    style={{
                      ...btnPrimary, fontSize: 11, padding: '7px 14px',
                      opacity: !fbConnected || fbSyncing !== null ? 0.4 : 1,
                    }}
                  >
                    {fbSyncing === type ? 'Syncing...' : 'Sync All'}
                  </button>
                </div>
              </div>

              {/* Preview table */}
              {fbPreviewType === type && fbPreview.length > 0 && (
                <div style={{ marginTop: 12, overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr>
                        {Object.keys(fbPreview[0]).filter(k => k !== 'source' && k !== 'external_id' && k !== 'status').map(k => (
                          <th key={k} style={th}>{k.replace(/_/g, ' ')}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {fbPreview.map((row, i) => (
                        <tr key={i}>
                          {Object.entries(row).filter(([k]) => k !== 'source' && k !== 'external_id' && k !== 'status').map(([k, v]) => (
                            <td key={k} style={td}>{v != null ? String(v) : '\u2014'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {/* ═══ UPLOAD MODE ═══ */}
      {mode === 'upload' && <>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {['Upload', 'Map Columns', 'Preview', 'Import', 'Done'].map((label, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{
              height: 4, borderRadius: 2, marginBottom: 4,
              background: step > i + 1 ? GREEN : step === i + 1 ? BLUE : BORDER,
              transition: 'background 0.3s',
            }} />
            <span style={{ fontSize: 10, color: step >= i + 1 ? TEXT : DIM, fontWeight: 600 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* ═══ STEP 1: UPLOAD ═══ */}
      {step === 1 && (
        <>
          <div style={{ ...card, padding: 12, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Import Type</div>
              {importType === 'trucks' && (
                <button onClick={downloadTemplate} style={{ ...btnSecondary, fontSize: 11, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Download Template
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {([['trucks', 'Trucks / Fleet'], ['companies', 'Companies'], ['contacts', 'Contacts'], ['parts', 'Parts Inventory']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setImportType(k)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 8, border: importType === k ? `1px solid ${BLUE}` : `1px solid ${BORDER}`,
                    background: importType === k ? 'rgba(29,111,232,.08)' : CARD_BG, color: importType === k ? 'var(--tz-accentLight)' : DIM,
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
                  }}>{l}</button>
              ))}
            </div>
          </div>

          <div
            style={{
              ...card, border: `2px dashed ${dragging ? BLUE : BORDER}`, textAlign: 'center',
              padding: 60, cursor: 'pointer', transition: 'border-color 0.2s',
            }}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById('fileInput')?.click()}
          >
            <div style={{ fontSize: 40, marginBottom: 8, opacity: 0.3 }}>+</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Drop your file here</div>
            <div style={{ fontSize: 13, color: DIM }}>Supports .xlsx and .csv</div>
            <input id="fileInput" type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }}
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>

          {/* Fullbay WO Sync — admin only */}
          {isAdmin && importType === 'trucks' && fbStats && (
            <div style={{ ...card, marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Legacy Work Orders</div>
                <button onClick={syncFullbayWOs} disabled={!!fbSyncing} style={{ ...btnSecondary, fontSize: 11, padding: '6px 14px', color: fbSyncing ? DIM : 'var(--tz-accentLight)', borderColor: fbSyncing ? BORDER : BLUE }}>
                  {fbSyncing ? 'Syncing...' : 'Sync Active WOs'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                <div><span style={{ color: DIM }}>Synced to TruckZen:</span> <span style={{ color: TEXT, fontWeight: 700 }}>{fbStats.fullbay_wos}</span></div>
                <div><span style={{ color: DIM }}>Total WOs:</span> <span style={{ color: TEXT, fontWeight: 700 }}>{fbStats.total_wos}</span></div>
                <div><span style={{ color: DIM }}>Last synced:</span> <span style={{ color: TEXT }}>{fbStats.last_synced ? new Date(fbStats.last_synced).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never'}</span></div>
              </div>
              {fbResult && (
                <div style={{ marginTop: 10, fontSize: 11, color: GREEN }}>
                  {fbResult.imported} imported, {fbResult.updated} updated, {fbResult.skipped} skipped from {fbResult.total_pulled} legacy records
                </div>
              )}
            </div>
          )}

          {/* Import History */}
          {importType === 'trucks' && history.length > 0 && (
            <div style={{ ...card, marginTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Import History</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr>
                    {['Date', 'Imported By', 'Imported', 'Skipped', 'Status', 'Undo'].map(h => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((h: any) => (
                    <tr key={h.id}>
                      <td style={td}>{fmtDate(h.created_at)}</td>
                      <td style={td}>{h.imported_by_name}</td>
                      <td style={td}><span style={{ color: GREEN, fontWeight: 700 }}>{h.imported_rows}</span></td>
                      <td style={td}>{h.skipped_rows > 0 ? <span style={{ color: RED }}>{h.skipped_rows}</span> : '0'}</td>
                      <td style={td}>
                        <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase',
                          color: h.status === 'completed' ? GREEN : h.status === 'undone' ? DIM : AMBER,
                          background: h.status === 'completed' ? `${GREEN}20` : h.status === 'undone' ? `${DIM}20` : `${AMBER}20`,
                        }}>{h.status}</span>
                      </td>
                      <td style={td}>
                        {h.undo_available && (
                          <button onClick={() => undoImport(h.batch_id)} style={{ background: 'none', border: `1px solid ${RED}`, borderRadius: 4, color: RED, fontSize: 10, cursor: 'pointer', padding: '2px 8px', fontFamily: FONT }}>
                            Undo
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ═══ STEP 2: COLUMN MAPPING ═══ */}
      {step === 2 && (
        <>
          <div style={{ ...card, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Column Mapping</div>
                <div style={{ fontSize: 12, color: DIM }}>{fileName} — {allRows.length} rows, {headers.length} columns</div>
              </div>
              <div style={{ fontSize: 12, color: avgConfidence >= 70 ? GREEN : AMBER, fontWeight: 700 }}>
                {mappedFieldCount}/{headers.length} mapped ({avgConfidence}% avg confidence)
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {colMappings.map((cm, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'var(--tz-bgInput)', borderRadius: 8 }}>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: TEXT }}>{cm.header}</div>
                  <div style={{ fontSize: 11, color: DIM }}>→</div>
                  <select
                    value={cm.field}
                    onChange={e => updateMapping(i, e.target.value)}
                    style={{
                      flex: 1, padding: '6px 10px', borderRadius: 6, fontSize: 12,
                      background: CARD_BG, color: cm.field === '__unmapped' ? RED : TEXT,
                      border: `1px solid ${cm.field === '__unmapped' ? RED : BORDER}`,
                      fontFamily: FONT, outline: 'none',
                    }}
                  >
                    <option value="__unmapped">-- Unmapped --</option>
                    {allFields.map(f => (
                      <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                  <div style={{
                    width: 40, textAlign: 'center', fontSize: 11, fontWeight: 700,
                    color: cm.confidence >= 90 ? GREEN : cm.confidence >= 70 ? AMBER : RED,
                  }}>
                    {cm.confidence}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={reset} style={btnSecondary}>Back</button>
            <button onClick={generatePreview} disabled={mappedFieldCount === 0 || validating}
              style={{ ...btnPrimary, flex: 1, opacity: mappedFieldCount === 0 ? 0.5 : 1 }}>
              {validating ? 'Validating...' : 'Preview & Validate'}
            </button>
          </div>
        </>
      )}

      {/* ═══ STEP 3: PREVIEW ═══ */}
      {step === 3 && (
        <>
          <div style={{ ...card, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Data Preview (first 20 rows)</div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12, fontSize: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: GREEN, display: 'inline-block' }} /> Valid
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: AMBER, display: 'inline-block' }} /> Warning (will import)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: RED, display: 'inline-block' }} /> Error (will skip)
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr>
                    <th style={th}>#</th>
                    {colMappings.filter(m => m.field !== '__unmapped').map(m => (
                      <th key={m.field} style={th}>{m.field.replace(/_/g, ' ')}</th>
                    ))}
                    <th style={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((pr: any, i: number) => {
                    const rowColor = pr.status === 'valid' ? GREEN : pr.status === 'warning' ? AMBER : RED
                    return (
                      <tr key={i} style={{ borderLeft: `3px solid ${rowColor}` }}>
                        <td style={td}>{i + 1}</td>
                        {colMappings.filter(m => m.field !== '__unmapped').map(m => {
                          const val = pr.row?.[m.field] || '—'
                          // Highlight customer match info
                          const isCustField = m.field === 'customer_name'
                          const custMatch = pr.customer_match
                          return (
                            <td key={m.field} style={{ ...td, position: 'relative' }}>
                              {val}
                              {isCustField && custMatch?.type === 'fuzzy' && (
                                <div style={{ fontSize: 9, color: AMBER, marginTop: 2 }}>
                                  → matched to &quot;{custMatch.name}&quot; ({custMatch.score}%)
                                </div>
                              )}
                              {isCustField && custMatch?.type === 'suggested' && (
                                <div style={{ fontSize: 9, color: RED, marginTop: 2 }}>
                                  Did you mean &quot;{custMatch.name}&quot;?
                                </div>
                              )}
                            </td>
                          )
                        })}
                        <td style={td}>
                          {pr.issues?.length > 0 ? (
                            <div>
                              {pr.issues.map((issue: string, j: number) => (
                                <div key={j} style={{ padding: '1px 0', fontSize: 10, color: pr.status === 'error' ? RED : AMBER }}>
                                  {issue}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: `${GREEN}20`, color: GREEN }}>
                              valid
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ fontSize: 12, color: DIM, marginBottom: 12 }}>
            Total: {allRows.length} rows.{' '}
            {previewRows.filter((r: any) => r.status === 'valid').length} valid,{' '}
            {previewRows.filter((r: any) => r.status === 'warning').length} warnings,{' '}
            {previewRows.filter((r: any) => r.status === 'error').length} errors in preview.
            {importType === 'trucks' && <span> Valid and warning rows will be imported. Error rows will be skipped.</span>}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep(2)} style={btnSecondary}>Back</button>
            <button onClick={runImport} style={{ ...btnPrimary, flex: 1 }}>
              Import All {allRows.length} Rows
            </button>
          </div>
        </>
      )}

      {/* ═══ STEP 4: IMPORTING ═══ */}
      {step === 4 && (
        <div style={{ ...card, textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Importing {allRows.length} rows...</div>
          <div style={{ width: '100%', height: 8, background: BORDER, borderRadius: 4, marginBottom: 8 }}>
            <div style={{ width: `${progress}%`, height: '100%', background: BLUE, borderRadius: 4, transition: 'width 0.3s' }} />
          </div>
          <div style={{ fontSize: 13, color: DIM }}>{progress}% — Processing in batches of 50</div>
          {importType === 'trucks' && (
            <div style={{ fontSize: 11, color: DIM, marginTop: 8 }}>VIN auto-decode is running for valid VINs via NHTSA</div>
          )}
        </div>
      )}

      {/* ═══ STEP 5: SUMMARY ═══ */}
      {step === 5 && result && (
        <div style={{ ...card, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: result.errors.length === 0 ? GREEN : AMBER }}>
            Import Complete
          </div>

          <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 32, fontWeight: 700, color: GREEN }}>{result.imported}</div>
              <div style={{ fontSize: 11, color: DIM }}>Created</div>
            </div>
            <div>
              <div style={{ fontSize: 32, fontWeight: 700, color: AMBER }}>{result.updated}</div>
              <div style={{ fontSize: 11, color: DIM }}>Updated</div>
            </div>
            <div>
              <div style={{ fontSize: 32, fontWeight: 700, color: RED }}>{result.skipped}</div>
              <div style={{ fontSize: 11, color: DIM }}>Skipped</div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div style={{ background: 'var(--tz-bgInput)', borderRadius: 8, padding: 12, maxHeight: 150, overflowY: 'auto', textAlign: 'left', marginBottom: 16 }}>
              {result.errors.slice(0, 20).map((e, i) => (
                <div key={i} style={{ fontSize: 11, color: DIM, padding: '2px 0' }}>{e}</div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {result.batchId && (importType === 'trucks' || importType === 'parts') && (
              <button onClick={async () => {
                if (importType === 'trucks') {
                  await undoImport(result.batchId!)
                  reset()
                } else {
                  if (!confirm('Undo this import? All imported parts will be removed.')) return
                  const res = await fetch('/api/smart-drop/import', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ batch_id: result.batchId, shop_id: user?.shop_id }),
                  })
                  if (res.ok) { flash('Import undone'); reset() }
                  else flash('Undo failed')
                }
              }} style={{ ...btnSecondary, color: RED, borderColor: RED }}>Undo Import</button>
            )}
            {result.skippedRows && result.skippedRows.length > 0 && (
              <button onClick={downloadErrorReport} style={{ ...btnSecondary, color: AMBER, borderColor: AMBER }}>
                Download Error Report
              </button>
            )}
            <button onClick={reset} style={btnSecondary}>Import More</button>
            <a href={importType === 'parts' ? '/parts' : importType === 'trucks' ? '/fleet' : '/customers'}
              style={{ ...btnPrimary, textDecoration: 'none', display: 'inline-block' }}>
              View Data
            </a>
          </div>
        </div>
      )}

      </>}
    </AppPageShell>
  )
}

type SDT = { bgCard: string; bgInput: string; border: string; textSecondary: string; textTertiary: string; accent: string; bgLight: string }
const makeCard = (t: SDT): React.CSSProperties => ({ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, padding: 20, marginBottom: 14 })
const makeTh = (t: SDT): React.CSSProperties => ({ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--tz-textTertiary)', textTransform: 'uppercase', letterSpacing: '.08em', padding: '8px 10px', textAlign: 'left', background: 'var(--tz-bgInput)', whiteSpace: 'nowrap' })
const makeTd = (t: SDT): React.CSSProperties => ({ padding: '8px 10px', borderBottom: `1px solid ${'var(--tz-border)'}`, fontSize: 11, color: 'var(--tz-textSecondary)' })
const makeBtnPrimary = (t: SDT): React.CSSProperties => ({ padding: '12px 24px', background: 'var(--tz-accent)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, color: 'var(--tz-bgLight)', cursor: 'pointer', fontFamily: "'Instrument Sans', sans-serif" })
const makeBtnSecondary = (t: SDT): React.CSSProperties => ({ padding: '10px 20px', background: 'transparent', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 9, color: 'var(--tz-textSecondary)', fontSize: 12, cursor: 'pointer', fontFamily: "'Instrument Sans', sans-serif" })
