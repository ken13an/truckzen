'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { ADMIN_ROLES } from '@/lib/roles'
import { useTheme } from '@/hooks/useTheme'

const IMPORT_TYPES = [
  { key: 'customers', label: 'Customers', icon: '', desc: 'Company Name, Contact, Phone, Email, Address' },
  { key: 'vehicles', label: 'Vehicles / Assets', icon: '', desc: 'Unit #, VIN, Year, Make, Model, Customer' },
  { key: 'work_orders', label: 'Work Orders → Service Orders', icon: '', desc: 'WO #, Customer, Unit, Status, Complaint, Labor/Parts totals' },
  { key: 'invoices', label: 'Invoices', icon: '', desc: 'Invoice #, Customer, Total, Tax, Status, Due Date' },
  { key: 'parts', label: 'Parts Inventory', icon: '', desc: 'Part Number, Description, Category, Qty, Cost, Sell Price' },
] as const

type ImportResult = { created: number; skipped: number; errors: number; total: number; details: string[] }

export default function ImportPage() {
  const { tokens: th } = useTheme()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [selectedType, setSelectedType] = useState<string>('customers')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any[]>([])
  const [previewCols, setPreviewCols] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getCurrentUser(supabase).then((p: any) => {
      if (!p) { window.location.href = '/login'; return }
      if (!ADMIN_ROLES.includes(p.role)) { window.location.href = '/dashboard'; return }
      setUser(p)
    })
  }, [])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setResult(null)
    setError('')

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.split('\n').filter((l: string) => l.trim())
      if (lines.length < 2) { setError('CSV has no data rows'); return }

      const headers = lines[0].split(',').map((h: string) => h.trim().replace(/^"|"$/g, ''))
      setPreviewCols(headers)

      const rows: any[] = []
      for (let i = 1; i < Math.min(lines.length, 6); i++) {
        const vals = lines[i].split(',').map((v: string) => v.trim().replace(/^"|"$/g, ''))
        const row: any = {}
        headers.forEach((h: string, idx: number) => { row[h] = vals[idx] || '' })
        rows.push(row)
      }
      setPreview(rows)
    }
    reader.readAsText(f)
  }

  async function handleImport() {
    if (!file || !user) return
    setImporting(true)
    setResult(null)
    setError('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('shop_id', user.shop_id)
    formData.append('type', selectedType)

    try {
      const res = await fetch('/api/import/fullbay', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Import failed'); return }
      setResult(data)
    } catch (err: any) {
      setError(err.message || 'Network error')
    } finally {
      setImporting(false)
    }
  }

  function reset() {
    setFile(null)
    setPreview([])
    setPreviewCols([])
    setResult(null)
    setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  if (!user) return null

  const sty = {
    page: { padding: '32px 40px', maxWidth: 960, margin: '0 auto', color: th.text, fontFamily: "'Instrument Sans',sans-serif" } as const,
    h1: { fontSize: 24, fontWeight: 700, color: th.text, marginBottom: 6 } as const,
    sub: { fontSize: 13, color: th.textSecondary, marginBottom: 32 } as const,
    card: { background: th.bgCard, border: '1px solid #1A1D23', borderRadius: 12, padding: 24, marginBottom: 20 } as const,
    label: { fontSize: 12, fontWeight: 600, color: th.textSecondary, textTransform: 'uppercase' as const, letterSpacing: '.06em', marginBottom: 10, display: 'block' },
    typeBtn: (active: boolean) => ({
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 9,
      border: active ? '1px solid #1D6FE8' : '1px solid #1A1D23', background: active ? 'rgba(29,111,232,.08)' : th.bgCard,
      cursor: 'pointer', transition: 'all .15s', width: '100%', textAlign: 'left' as const,
    }),
    btn: (disabled: boolean) => ({
      padding: '12px 28px', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
      background: disabled ? '#1A1D23' : 'linear-gradient(135deg,#1D6FE8,#1248B0)', color: disabled ? '#48536A' : '#fff',
      opacity: disabled ? 0.6 : 1,
    }),
    dropzone: {
      border: '2px dashed #1A1D23', borderRadius: 12, padding: '40px 20px', textAlign: 'center' as const,
      cursor: 'pointer', transition: 'border-color .15s',
    },
    table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 },
    th: { padding: '8px 10px', borderBottom: '1px solid #1A1D23', color: th.textSecondary, textAlign: 'left' as const, fontWeight: 600 },
    td: { padding: '8px 10px', borderBottom: '1px solid #0D0F12', color: '#A0AABF', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
    stat: (color: string) => ({ textAlign: 'center' as const, padding: '16px 20px', borderRadius: 9, background: th.bgCard, border: '1px solid #1A1D23', flex: 1, minWidth: 100 }),
    statNum: (color: string) => ({ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }),
    statLabel: { fontSize: 11, color: th.textSecondary, marginTop: 4, textTransform: 'uppercase' as const, letterSpacing: '.05em' },
  }

  return (
    <div style={sty.page}>
      <div style={sty.h1}>Import from FullBay</div>
      <div style={sty.sub}>Upload CSV exports from FullBay to migrate your shop data into TruckZen. Import in order: Customers → Vehicles → Work Orders → Invoices.</div>

      {/* Step 1: Select type */}
      <div style={sty.card}>
        <div style={sty.label}>Step 1 — Select data type</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {IMPORT_TYPES.map(t => (
            <div key={t.key} style={sty.typeBtn(selectedType === t.key)} onClick={() => { setSelectedType(t.key); reset() }}>
              <span style={{ fontSize: 22 }}>{t.icon}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: selectedType === t.key ? '#F0F4FF' : '#A0AABF' }}>{t.label}</div>
                <div style={{ fontSize: 11, color: th.textTertiary, marginTop: 2 }}>{t.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Step 2: Upload */}
      <div style={sty.card}>
        <div style={sty.label}>Step 2 — Upload CSV file</div>
        <div style={sty.dropzone} onClick={() => fileRef.current?.click()}>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
          {file ? (
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: th.text }}>{file.name}</div>
              <div style={{ fontSize: 12, color: th.textSecondary, marginTop: 4 }}>{(file.size / 1024).toFixed(1)} KB — Click to replace</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: th.textSecondary, marginBottom: 8 }}>Upload File</div>
              <div style={{ fontSize: 14, color: th.textSecondary }}>Click to select a .csv file</div>
              <div style={{ fontSize: 11, color: th.textTertiary, marginTop: 4 }}>Exported from FullBay → Reports → Export</div>
            </div>
          )}
        </div>
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div style={sty.card}>
          <div style={sty.label}>Preview — first {preview.length} rows ({previewCols.length} columns detected)</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={sty.table}>
              <thead>
                <tr>{previewCols.map(c => <th key={c} style={sty.th}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i}>{previewCols.map(c => <td key={c} style={sty.td}>{row[c]}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Step 3: Import */}
      {file && preview.length > 0 && !result && (
        <div style={sty.card}>
          <div style={sty.label}>Step 3 — Run import</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button style={sty.btn(importing)} onClick={handleImport} disabled={importing}>
              {importing ? 'Importing...' : `Import ${IMPORT_TYPES.find(t => t.key === selectedType)?.label}`}
            </button>
            {importing && <div style={{ fontSize: 13, color: th.textSecondary }}>Processing {preview.length > 4 ? 'all' : ''} rows... This may take a moment.</div>}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ ...sty.card, borderColor: '#E8441D' }}>
          <div style={{ color: '#E8441D', fontWeight: 600, marginBottom: 4 }}>Import Error</div>
          <div style={{ fontSize: 13, color: '#A0AABF' }}>{error}</div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={sty.card}>
          <div style={sty.label}>Import Complete</div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={sty.stat('#1D6FE8')}>
              <div style={sty.statNum('#1D6FE8')}>{result.total}</div>
              <div style={sty.statLabel}>Total Rows</div>
            </div>
            <div style={sty.stat('#22C55E')}>
              <div style={sty.statNum('#22C55E')}>{result.created}</div>
              <div style={sty.statLabel}>Created</div>
            </div>
            <div style={sty.stat('#F59E0B')}>
              <div style={sty.statNum('#F59E0B')}>{result.skipped}</div>
              <div style={sty.statLabel}>Skipped</div>
            </div>
            <div style={sty.stat('#EF4444')}>
              <div style={sty.statNum('#EF4444')}>{result.errors}</div>
              <div style={sty.statLabel}>Errors</div>
            </div>
          </div>

          {result.details.length > 0 && (
            <div style={{ background: th.bg, borderRadius: 9, padding: 16, maxHeight: 200, overflowY: 'auto' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: th.textSecondary, marginBottom: 8 }}>DETAILS</div>
              {result.details.slice(0, 50).map((d, i) => (
                <div key={i} style={{ fontSize: 12, color: '#A0AABF', padding: '3px 0', borderBottom: '1px solid #0D0F12' }}>{d}</div>
              ))}
              {result.details.length > 50 && <div style={{ fontSize: 11, color: th.textTertiary, marginTop: 8 }}>...and {result.details.length - 50} more</div>}
            </div>
          )}

          <button style={{ ...sty.btn(false), marginTop: 16 }} onClick={reset}>Import Another File</button>
        </div>
      )}
    </div>
  )
}
