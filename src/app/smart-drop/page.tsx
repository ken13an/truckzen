'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

type Mode = 'import' | 'export' | 'history'
type ImportType = 'customers' | 'vehicles' | 'parts' | 'work_orders' | 'invoices' | 'drivers'
type ExportType = 'customers' | 'vehicles' | 'parts' | 'invoices' | 'service_orders'

const IMPORT_TYPES: { value: ImportType; label: string; icon: string; desc: string }[] = [
  { value: 'customers', label: 'Customers', icon: '', desc: 'Company contacts, phone, email, address' },
  { value: 'vehicles', label: 'Vehicles / Fleet', icon: '', desc: 'Unit #, VIN, year, make, model, customer' },
  { value: 'parts', label: 'Parts Inventory', icon: '', desc: 'Part #, description, qty, cost, vendor' },
  { value: 'work_orders', label: 'Work Orders → SOs', icon: '', desc: 'WO #, customer, truck, complaint, totals' },
  { value: 'invoices', label: 'Invoices', icon: '', desc: 'Invoice #, customer, total, tax, status' },
  { value: 'drivers', label: 'Drivers', icon: '', desc: 'Name, CDL, medical card, phone' },
]

const EXPORT_TYPES: { value: ExportType; label: string; icon: string }[] = [
  { value: 'customers', label: 'Customers', icon: '' },
  { value: 'vehicles', label: 'Vehicles', icon: '' },
  { value: 'parts', label: 'Parts Inventory', icon: '' },
  { value: 'invoices', label: 'Invoices', icon: '' },
  { value: 'service_orders', label: 'Service Orders', icon: '' },
]

const EXPORT_COLUMNS: Record<ExportType, { key: string; label: string }[]> = {
  customers: [
    { key: 'company_name', label: 'Company Name' }, { key: 'contact_name', label: 'Contact' },
    { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' }, { key: 'address', label: 'Address' },
    { key: 'unit_count', label: 'Unit Count' }, { key: 'total_invoices', label: 'Total Invoices' },
    { key: 'balance_due', label: 'Balance Due' }, { key: 'visit_count', label: 'Visit Count' },
    { key: 'total_spent', label: 'Total Spent' }, { key: 'source', label: 'Source' }, { key: 'created_at', label: 'Created' },
  ],
  vehicles: [
    { key: 'unit_number', label: 'Unit #' }, { key: 'asset_type', label: 'Type' }, { key: 'status', label: 'Status' },
    { key: 'year', label: 'Year' }, { key: 'make', label: 'Make' }, { key: 'model', label: 'Model' },
    { key: 'vin', label: 'VIN' }, { key: 'license_plate', label: 'Plate' }, { key: 'odometer', label: 'Odometer' },
    { key: 'customer', label: 'Customer' }, { key: 'created_at', label: 'Created' },
  ],
  parts: [
    { key: 'part_number', label: 'Part #' }, { key: 'description', label: 'Description' }, { key: 'category', label: 'Category' },
    { key: 'on_hand', label: 'On Hand' }, { key: 'reorder_point', label: 'Reorder At' },
    { key: 'cost_price', label: 'Cost' }, { key: 'sell_price', label: 'Sell Price' },
    { key: 'vendor', label: 'Vendor' }, { key: 'bin_location', label: 'Bin' },
  ],
  invoices: [
    { key: 'invoice_number', label: 'Invoice #' }, { key: 'customer', label: 'Customer' }, { key: 'status', label: 'Status' },
    { key: 'subtotal', label: 'Subtotal' }, { key: 'tax_amount', label: 'Tax' }, { key: 'total', label: 'Total' },
    { key: 'amount_paid', label: 'Paid' }, { key: 'balance_due', label: 'Balance Due' },
    { key: 'due_date', label: 'Due Date' }, { key: 'paid_at', label: 'Paid At' }, { key: 'created_at', label: 'Created' },
  ],
  service_orders: [
    { key: 'so_number', label: 'SO #' }, { key: 'unit_number', label: 'Unit #' }, { key: 'customer', label: 'Customer' },
    { key: 'technician', label: 'Technician' }, { key: 'status', label: 'Status' }, { key: 'priority', label: 'Priority' },
    { key: 'complaint', label: 'Complaint' }, { key: 'grand_total', label: 'Total' },
    { key: 'created_at', label: 'Created' }, { key: 'completed_at', label: 'Completed' },
  ],
}

// FullBay auto-detect patterns
const FULLBAY_SIGNATURES: Record<string, string[]> = {
  customers: ['Company Name', 'Contact Name', 'Phone', 'Email'],
  vehicles: ['Unit', 'VIN', 'Year', 'Make', 'Model'],
  work_orders: ['Work Order', 'Complaint', 'Status', 'Customer', 'Unit'],
  invoices: ['Invoice', 'Total', 'Amount Paid', 'Status', 'Customer'],
  parts: ['Part Number', 'Description', 'Quantity', 'Cost', 'Sell Price'],
}

export default function SmartDropPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [mode, setMode] = useState<Mode>('import')

  // Import state
  const [importType, setImportType] = useState<ImportType>('customers')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [dragging, setDragging] = useState(false)
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null)

  // Export state
  const [exportType, setExportType] = useState<ExportType>('customers')
  const [selectedCols, setSelectedCols] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)

  // History state
  const [history, setHistory] = useState<any[]>([])
  const [undoing, setUndoing] = useState<string | null>(null)

  const [toast, setToast] = useState('')
  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  useEffect(() => {
    getCurrentUser(supabase).then((p: any) => {
      if (!p) { window.location.href = '/login'; return }
      setUser(p)
    })
  }, [])

  // Init export columns
  useEffect(() => {
    setSelectedCols(new Set(EXPORT_COLUMNS[exportType]?.map(c => c.key) || []))
  }, [exportType])

  // Load history
  useEffect(() => {
    if (mode !== 'history' || !user) return
    supabase.from('import_export_log').select('*')
      .eq('shop_id', user.shop_id).order('created_at', { ascending: false }).limit(50)
      .then(({ data }: any) => setHistory(data || []))
  }, [mode, user])

  // ── FULLBAY AUTO-DETECT ────────────────────────────────
  function detectFullBay(hdrs: string[]): ImportType | null {
    const lower = hdrs.map(h => h.toLowerCase())
    let bestMatch: ImportType | null = null
    let bestScore = 0

    for (const [type, sigs] of Object.entries(FULLBAY_SIGNATURES)) {
      const score = sigs.filter(s => lower.some(h => h.includes(s.toLowerCase()))).length
      if (score > bestScore) { bestScore = score; bestMatch = type as ImportType }
    }

    return bestScore >= 2 ? bestMatch : null
  }

  // ── FILE HANDLING ──────────────────────────────────────
  function parseCSV(text: string) {
    const lines = text.trim().split('\n')
    const hdrs = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
    const rows = lines.slice(1, 6).map(l => {
      const vals = l.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
      const obj: Record<string, string> = {}
      hdrs.forEach((h, i) => { obj[h] = vals[i] || '' })
      return obj
    })
    return { headers: hdrs, preview: rows }
  }

  async function handleFile(f: File) {
    setFile(f)
    const text = await f.text()
    const { headers: hdrs, preview: rows } = parseCSV(text)
    setHeaders(hdrs)
    setPreview(rows)

    // Auto-detect FullBay format
    const detected = detectFullBay(hdrs)
    if (detected) {
      setImportType(detected)
      setDetectedFormat('FullBay')
    } else {
      setDetectedFormat(null)
    }

    setStep(2)
  }

  // ── IMPORT ─────────────────────────────────────────────
  async function runImport() {
    if (!file || !user) return
    setImporting(true)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('shop_id', user.shop_id)
    formData.append('type', importType)

    const res = await fetch('/api/import/fullbay', { method: 'POST', body: formData })
    const data = await res.json()

    if (res.ok) {
      // Log the import
      await supabase.from('import_export_log').insert({
        shop_id: user.shop_id, user_id: user.id, user_name: user.full_name,
        action: 'import', data_type: importType, file_name: file.name,
        record_count: data.total, created_count: data.created, skipped_count: data.skipped, error_count: data.errors,
      })
      setResult(data)
      setStep(3)
    } else {
      flash(data.error || 'Import failed')
    }

    setImporting(false)
  }

  // ── EXPORT ─────────────────────────────────────────────
  async function runExport() {
    if (!user) return
    setExporting(true)
    const cols = Array.from(selectedCols).join(',')
    const url = `/api/export?shop_id=${user.shop_id}&type=${exportType}&columns=${cols}&user_id=${user.id}&user_name=${encodeURIComponent(user.full_name)}`

    const res = await fetch(url)
    if (res.ok) {
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${exportType}-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      flash('Export downloaded')
    } else {
      flash('Export failed')
    }
    setExporting(false)
  }

  // ── UNDO IMPORT ────────────────────────────────────────
  async function undoImport(logId: string) {
    if (!user) return
    setUndoing(logId)
    const res = await fetch('/api/import/undo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ log_id: logId, shop_id: user.shop_id }),
    })
    const data = await res.json()
    if (res.ok) {
      flash(`Undo complete — ${data.deleted} records removed`)
      setHistory(prev => prev.map(h => h.id === logId ? { ...h, undone: true, undone_at: new Date().toISOString() } : h))
    } else {
      flash(data.error || 'Undo failed')
    }
    setUndoing(null)
  }

  function resetImport() {
    setStep(1); setFile(null); setPreview([]); setHeaders([]); setResult(null); setDetectedFormat(null)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && (f.name.endsWith('.csv') || f.name.endsWith('.xlsx'))) handleFile(f)
  }, [importType])

  if (!user) return null

  return (
    <div style={S.page}>
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: '#1D6FE8', color: '#fff', padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>{toast}</div>}

      <div style={S.title}>Smart Drop</div>
      <div style={{ fontSize: 12, color: '#7C8BA0', marginBottom: 20 }}>Import data from any spreadsheet, export to CSV, or review history. FullBay CSVs are auto-detected.</div>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#0D0F12', borderRadius: 10, padding: 4 }}>
        {([['import', 'Import'], ['export', 'Export'], ['history', 'History']] as const).map(([k, l]) => (
          <button key={k} onClick={() => { setMode(k); if (k === 'import') resetImport() }}
            style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: mode === k ? '#1A1D23' : 'transparent', color: mode === k ? '#F0F4FF' : '#48536A' }}>{l}</button>
        ))}
      </div>

      {/* ═══ IMPORT TAB ═══ */}
      {mode === 'import' && <>
        {step === 1 && <>
          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F4FF', marginBottom: 12 }}>1. What are you importing?</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 8 }}>
              {IMPORT_TYPES.map(t => (
                <div key={t.value} onClick={() => setImportType(t.value)}
                  style={{ padding: '12px', borderRadius: 10, cursor: 'pointer', border: importType === t.value ? '1px solid rgba(29,111,232,.4)' : '1px solid #1A1D23', background: importType === t.value ? 'rgba(29,111,232,.08)' : '#0D0F12' }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{t.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: importType === t.value ? '#4D9EFF' : '#F0F4FF' }}>{t.label}</div>
                  <div style={{ fontSize: 10, color: '#48536A', marginTop: 2 }}>{t.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...S.card, border: `2px dashed ${dragging ? 'rgba(29,111,232,.6)' : '#1A1D23'}`, textAlign: 'center', padding: 40, cursor: 'pointer' }}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById('fileInput')?.click()}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#7C8BA0', marginBottom: 8 }}>Upload</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#F0F4FF', marginBottom: 4 }}>Drop your CSV file here</div>
            <div style={{ fontSize: 12, color: '#7C8BA0' }}>or click to browse — FullBay exports auto-detected</div>
            <input id="fileInput" type="file" accept=".csv" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>
        </>}

        {step === 2 && <>
          {detectedFormat && (
            <div style={{ ...S.card, borderColor: 'rgba(29,111,232,.3)', background: 'rgba(29,111,232,.05)', display: 'flex', alignItems: 'center', gap: 10, padding: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Auto-detected</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#4D9EFF' }}>FullBay format detected</div>
                <div style={{ fontSize: 11, color: '#7C8BA0' }}>Auto-selected "{IMPORT_TYPES.find(t => t.value === importType)?.label}" — columns will be mapped automatically</div>
              </div>
            </div>
          )}

          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F4FF', marginBottom: 8 }}>Preview — {headers.length} columns, {file?.name}</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead><tr>{headers.map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i}>{headers.map(h => <td key={h} style={S.td}>{row[h]}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={resetImport} style={S.btnSecondary}>Back</button>
            <button onClick={runImport} disabled={importing} style={{ ...S.btnPrimary, flex: 1, opacity: importing ? 0.6 : 1 }}>
              {importing ? 'Importing...' : `Import ${IMPORT_TYPES.find(t => t.value === importType)?.label}`}
            </button>
          </div>
        </>}

        {step === 3 && result && (
          <div style={{ ...S.card, textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: result.errors === 0 ? '#1DB870' : '#F59E0B', marginBottom: 12 }}>{result.errors === 0 ? 'Success' : 'Completed with warnings'}</div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, color: '#F0F4FF', marginBottom: 16 }}>Import Complete</div>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 20 }}>
              <div><div style={{ fontSize: 28, fontWeight: 700, color: '#22C55E' }}>{result.created}</div><div style={{ fontSize: 10, color: '#7C8BA0' }}>Created</div></div>
              <div><div style={{ fontSize: 28, fontWeight: 700, color: '#F59E0B' }}>{result.skipped}</div><div style={{ fontSize: 10, color: '#7C8BA0' }}>Skipped</div></div>
              <div><div style={{ fontSize: 28, fontWeight: 700, color: '#EF4444' }}>{result.errors}</div><div style={{ fontSize: 10, color: '#7C8BA0' }}>Errors</div></div>
            </div>
            {result.details?.length > 0 && (
              <div style={{ background: '#060708', borderRadius: 8, padding: 12, maxHeight: 150, overflowY: 'auto', textAlign: 'left', marginBottom: 16 }}>
                {result.details.slice(0, 20).map((d: string, i: number) => (
                  <div key={i} style={{ fontSize: 11, color: '#7C8BA0', padding: '2px 0' }}>{d}</div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button onClick={resetImport} style={S.btnSecondary}>Import More</button>
              <a href={`/${importType === 'vehicles' ? 'fleet' : importType === 'work_orders' ? 'orders' : importType}`} style={{ ...S.btnPrimary, textDecoration: 'none', display: 'inline-block' }}>View Data</a>
            </div>
          </div>
        )}
      </>}

      {/* ═══ EXPORT TAB ═══ */}
      {mode === 'export' && <>
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F4FF', marginBottom: 12 }}>1. Select data to export</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {EXPORT_TYPES.map(t => (
              <button key={t.value} onClick={() => setExportType(t.value)}
                style={{ padding: '10px 16px', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 600, border: exportType === t.value ? '1px solid #1D6FE8' : '1px solid #1A1D23', background: exportType === t.value ? 'rgba(29,111,232,.08)' : '#0D0F12', color: exportType === t.value ? '#4D9EFF' : '#7C8BA0' }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F4FF', marginBottom: 4 }}>2. Select columns</div>
          <div style={{ fontSize: 11, color: '#7C8BA0', marginBottom: 12 }}>Click to toggle. All selected by default.</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(EXPORT_COLUMNS[exportType] || []).map(c => {
              const on = selectedCols.has(c.key)
              return (
                <button key={c.key}
                  onClick={() => setSelectedCols(prev => { const n = new Set(prev); on ? n.delete(c.key) : n.add(c.key); return n })}
                  style={{ padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: on ? '1px solid #22C55E' : '1px solid #1A1D23', background: on ? 'rgba(34,197,94,.08)' : '#0D0F12', color: on ? '#22C55E' : '#48536A' }}>
                  {c.label}
                </button>
              )
            })}
          </div>
        </div>

        <button onClick={runExport} disabled={exporting || selectedCols.size === 0} style={{ ...S.btnPrimary, width: '100%', opacity: exporting || selectedCols.size === 0 ? 0.5 : 1 }}>
          {exporting ? 'Exporting...' : `Download ${EXPORT_TYPES.find(t => t.value === exportType)?.label} CSV (${selectedCols.size} columns)`}
        </button>
      </>}

      {/* ═══ HISTORY TAB ═══ */}
      {mode === 'history' && <>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#7C8BA0', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Import / Export History</div>
        {history.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#48536A' }}>No history yet</div>}
        <table style={S.table}>
          <thead><tr>
            <th style={S.th}>When</th><th style={S.th}>User</th><th style={S.th}>Action</th><th style={S.th}>Type</th><th style={S.th}>File</th><th style={S.th}>Records</th><th style={S.th}>Result</th><th style={S.th}>Undo</th>
          </tr></thead>
          <tbody>
            {history.map(h => {
              const age = (Date.now() - new Date(h.created_at).getTime()) / 3600000
              const canUndo = h.action === 'import' && !h.undone && age <= 24 && (h.record_ids?.length || 0) > 0

              return (
                <tr key={h.id} style={{ opacity: h.undone ? 0.4 : 1 }}>
                  <td style={S.td}>{new Date(h.created_at).toLocaleString()}</td>
                  <td style={S.td}>{h.user_name}</td>
                  <td style={S.td}>
                    <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: h.action === 'import' ? '#1D6FE8' : '#22C55E' }}>{h.action}</span>
                  </td>
                  <td style={S.td}>{h.data_type}</td>
                  <td style={S.td}>{h.file_name || '—'}</td>
                  <td style={S.td}>{h.record_count}</td>
                  <td style={S.td}>
                    {h.action === 'import' ? (
                      <span>{h.created_count} created, {h.skipped_count} skipped{h.error_count > 0 ? `, ${h.error_count} errors` : ''}</span>
                    ) : '—'}
                  </td>
                  <td style={S.td}>
                    {h.undone ? <span style={{ color: '#7C8BA0', fontSize: 10 }}>Undone</span> : canUndo ? (
                      <button onClick={() => undoImport(h.id)} disabled={undoing === h.id}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #EF4444', background: 'none', color: '#EF4444', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                        {undoing === h.id ? '...' : 'Undo'}
                      </button>
                    ) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </>}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: { background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: "'Instrument Sans',sans-serif", padding: 24 },
  title: { fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF', marginBottom: 4 },
  card: { background: '#0D0F12', border: '1px solid #1A1D23', borderRadius: 12, padding: 20, marginBottom: 14 },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 11 },
  th: { fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: '#48536A', textTransform: 'uppercase' as const, letterSpacing: '.08em', padding: '8px 10px', textAlign: 'left' as const, background: '#0B0D11', whiteSpace: 'nowrap' as const },
  td: { padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,.025)', fontSize: 11, color: '#A0AABF' },
  btnPrimary: { padding: '12px 24px', background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' },
  btnSecondary: { padding: '10px 20px', background: 'transparent', border: '1px solid #1A1D23', borderRadius: 9, color: '#7C8BA0', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
}
