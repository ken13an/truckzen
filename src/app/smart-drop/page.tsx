'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
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

type MappedField = keyof typeof COLUMN_ALIASES | '__unmapped'

interface ColMapping { header: string; field: MappedField; confidence: number }

function fuzzyMatch(header: string, aliasMap?: Record<string, string[]>): { field: string; confidence: number } {
  const h = header.toLowerCase().trim()
  let bestField = '__unmapped'
  let bestScore = 0

  for (const [field, aliases] of Object.entries(aliasMap || COLUMN_ALIASES)) {
    for (const alias of aliases) {
      const a = alias.toLowerCase()
      let score = 0

      if (h === a) { score = 100 }
      else if (h.includes(a) || a.includes(h)) { score = 80 }
      else {
        // Simple similarity: shared words
        const hWords = h.split(/[\s_-]+/)
        const aWords = a.split(/[\s_-]+/)
        const shared = hWords.filter(w => aWords.some(aw => aw.includes(w) || w.includes(aw))).length
        if (shared > 0) score = Math.min(70, shared * 35)
      }

      if (score > bestScore) { bestScore = score; bestField = field as MappedField }
    }
  }

  return { field: bestScore >= 70 ? bestField : '__unmapped', confidence: bestScore }
}

type ImportType = 'trucks' | 'companies' | 'contacts' | 'parts'

// Parts-specific column aliases
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

  // Detect by column headers
  const lower = headers.map(h => h.toLowerCase())
  if (lower.some(h => h.includes('vin') || h.includes('unit'))) return 'trucks'
  if (lower.some(h => h.includes('company') || h.includes('dot'))) return 'companies'
  return 'trucks'
}

const FONT = "'Instrument Sans', sans-serif"
const BG = '#060708'
const CARD_BG = '#0D0F12'
const BORDER = '#1A1D23'
const TEXT = '#F0F4FF'
const DIM = '#7C8BA0'
const BLUE = '#1D6FE8'
const GREEN = '#22C55E'
const AMBER = '#F59E0B'
const RED = '#EF4444'

export default function SmartDropPage() {
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
  const [previewRows, setPreviewRows] = useState<{ row: Record<string, string>; status: 'new' | 'existing' | 'error'; reason?: string }[]>([])
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ imported: number; updated: number; skipped: number; errors: string[]; batchId?: string } | null>(null)

  const [toast, setToast] = useState('')
  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    getCurrentUser(supabase).then((p: any) => {
      if (!p) { window.location.href = '/login'; return }
      setUser(p)
    })
  }, [])

  // ── File Handling ──────────────────────────────────────
  async function handleFile(f: File) {
    setFileName(f.name)
    try {
      const data = await f.arrayBuffer()
      const workbook = XLSX.read(data)

      // Use first sheet
      const sheetName = workbook.SheetNames[0]
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

      // Auto-detect type from sheet name — also check for parts
      let detected = detectSheetType(sheetName, hdrs)
      const lowerHdrs = hdrs.map(h => h.toLowerCase())
      if (lowerHdrs.some(h => h.includes('part') || h.includes('sku') || h.includes('bin') || h.includes('reorder'))) detected = 'parts' as ImportType
      setImportType(detected)

      // Auto-map columns — use parts aliases if detected as parts
      const aliases = detected === 'parts' ? PARTS_ALIASES : COLUMN_ALIASES
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

  // ── Column Mapping ─────────────────────────────────────
  function updateMapping(idx: number, newField: MappedField) {
    setColMappings(prev => prev.map((m, i) => i === idx ? { ...m, field: newField, confidence: newField === '__unmapped' ? 0 : 100 } : m))
  }

  const mappedFieldCount = colMappings.filter(m => m.field !== '__unmapped').length
  const avgConfidence = colMappings.length > 0
    ? Math.round(colMappings.reduce((s, m) => s + m.confidence, 0) / colMappings.length)
    : 0

  // ── Preview with Validation ────────────────────────────
  async function generatePreview() {
    const mapped = mapRows(allRows.slice(0, 10))

    // Check for existing records
    const previews: typeof previewRows = []
    for (const row of mapped) {
      let status: 'new' | 'existing' | 'error' = 'new'
      let reason = ''

      // Validation
      if (importType === 'trucks') {
        if (!row.unit_number) { status = 'error'; reason = 'Missing unit number' }
        else if (row.vin && row.vin.length !== 17 && row.vin.length > 0) { status = 'error'; reason = 'VIN must be 17 characters' }
        else if (row.year && (parseInt(row.year) < 1990 || parseInt(row.year) > 2030)) { status = 'error'; reason = 'Invalid year' }
        else {
          // Check if exists
          try {
            const { data } = await supabase.from('assets')
              .select('id')
              .eq('shop_id', user.shop_id)
              .eq('unit_number', row.unit_number)
              .limit(1)
            if (data && data.length > 0) status = 'existing'
          } catch {}
        }
      } else if (importType === 'parts') {
        if (!row.description) { status = 'error'; reason = 'Missing description' }
        else if (row.part_number) {
          try {
            const { data } = await supabase.from('parts')
              .select('id')
              .eq('shop_id', user.shop_id)
              .eq('part_number', row.part_number)
              .limit(1)
            if (data && data.length > 0) status = 'existing'
          } catch {}
        }
      } else if (importType === 'companies') {
        if (!row.company_name) { status = 'error'; reason = 'Missing company name' }
        else {
          try {
            const { data } = await supabase.from('customers')
              .select('id')
              .eq('shop_id', user.shop_id)
              .ilike('company_name', row.company_name)
              .limit(1)
            if (data && data.length > 0) status = 'existing'
          } catch {}
        }
      }

      previews.push({ row, status, reason })
    }

    setPreviewRows(previews)
    setStep(3)
  }

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

  // ── Import ─────────────────────────────────────────────
  async function runImport() {
    if (!user) return
    setImporting(true)
    setStep(4)
    setProgress(0)

    const mapped = mapRows(allRows)
    const BATCH = 50
    const batchId = crypto.randomUUID()
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

  function reset() {
    setStep(1); setAllRows([]); setHeaders([]); setColMappings([]); setPreviewRows([]); setResult(null); setFileName('')
  }

  if (!user) return null

  const allFields = importType === 'parts' ? Object.keys(PARTS_ALIASES) : Object.keys(COLUMN_ALIASES)

  return (
    <div style={{ background: BG, minHeight: '100vh', color: TEXT, fontFamily: FONT, padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: BLUE, color: '#fff', padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>{toast}</div>}

      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: TEXT, marginBottom: 4 }}>Smart Drop</div>
      <div style={{ fontSize: 12, color: DIM, marginBottom: 24 }}>Upload Excel or CSV files. Columns are auto-mapped using smart matching.</div>

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
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Import Type</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {([['trucks', 'Trucks / Fleet'], ['companies', 'Companies'], ['contacts', 'Contacts'], ['parts', 'Parts Inventory']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setImportType(k)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 8, border: importType === k ? `1px solid ${BLUE}` : `1px solid ${BORDER}`,
                    background: importType === k ? 'rgba(29,111,232,.08)' : CARD_BG, color: importType === k ? '#4D9EFF' : DIM,
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
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: '#080A0D', borderRadius: 8 }}>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: TEXT }}>{cm.header}</div>
                  <div style={{ fontSize: 11, color: DIM }}>→</div>
                  <select
                    value={cm.field}
                    onChange={e => updateMapping(i, e.target.value as MappedField)}
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
            <button onClick={generatePreview} disabled={mappedFieldCount === 0}
              style={{ ...btnPrimary, flex: 1, opacity: mappedFieldCount === 0 ? 0.5 : 1 }}>
              Preview Data
            </button>
          </div>
        </>
      )}

      {/* ═══ STEP 3: PREVIEW ═══ */}
      {step === 3 && (
        <>
          <div style={{ ...card, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Data Preview (first 10 rows)</div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12, fontSize: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: GREEN, display: 'inline-block' }} /> New
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: AMBER, display: 'inline-block' }} /> Existing (will update)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: RED, display: 'inline-block' }} /> Error
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
                  {previewRows.map((pr, i) => {
                    const rowColor = pr.status === 'new' ? GREEN : pr.status === 'existing' ? AMBER : RED
                    return (
                      <tr key={i} style={{ borderLeft: `3px solid ${rowColor}` }}>
                        <td style={td}>{i + 1}</td>
                        {colMappings.filter(m => m.field !== '__unmapped').map(m => (
                          <td key={m.field} style={td}>{pr.row[m.field] || '—'}</td>
                        ))}
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

          <div style={{ fontSize: 12, color: DIM, marginBottom: 12 }}>
            Total: {allRows.length} rows. {previewRows.filter(r => r.status === 'new').length} new,{' '}
            {previewRows.filter(r => r.status === 'existing').length} existing,{' '}
            {previewRows.filter(r => r.status === 'error').length} errors in preview.
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
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Importing...</div>
          <div style={{ width: '100%', height: 8, background: BORDER, borderRadius: 4, marginBottom: 8 }}>
            <div style={{ width: `${progress}%`, height: '100%', background: BLUE, borderRadius: 4, transition: 'width 0.3s' }} />
          </div>
          <div style={{ fontSize: 13, color: DIM }}>{progress}% — Processing in batches of 50</div>
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
            <div style={{ background: '#080A0D', borderRadius: 8, padding: 12, maxHeight: 150, overflowY: 'auto', textAlign: 'left', marginBottom: 16 }}>
              {result.errors.slice(0, 20).map((e, i) => (
                <div key={i} style={{ fontSize: 11, color: DIM, padding: '2px 0' }}>{e}</div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {result.batchId && importType === 'parts' && (
              <button onClick={async () => {
                if (!confirm('Undo this import? All imported parts will be removed.')) return
                const res = await fetch('/api/smart-drop/import', {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ batch_id: result.batchId, shop_id: user?.shop_id }),
                })
                if (res.ok) { flash('Import undone'); reset() }
                else flash('Undo failed')
              }} style={{ ...btnSecondary, color: RED, borderColor: RED }}>Undo Import</button>
            )}
            <button onClick={reset} style={btnSecondary}>Import More</button>
            <a href={importType === 'parts' ? '/parts' : importType === 'trucks' ? '/fleet' : '/customers'}
              style={{ ...btnPrimary, textDecoration: 'none', display: 'inline-block' }}>
              View Data
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

const card: React.CSSProperties = { background: '#0D0F12', border: '1px solid #1A1D23', borderRadius: 12, padding: 20, marginBottom: 14 }
const th: React.CSSProperties = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.08em', padding: '8px 10px', textAlign: 'left', background: '#0B0D11', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,.025)', fontSize: 11, color: '#A0AABF' }
const btnPrimary: React.CSSProperties = { padding: '12px 24px', background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: "'Instrument Sans', sans-serif" }
const btnSecondary: React.CSSProperties = { padding: '10px 20px', background: 'transparent', border: '1px solid #1A1D23', borderRadius: 9, color: '#7C8BA0', fontSize: 12, cursor: 'pointer', fontFamily: "'Instrument Sans', sans-serif" }
