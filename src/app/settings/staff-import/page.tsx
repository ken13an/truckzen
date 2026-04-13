'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { MANAGEMENT_ROLES } from '@/lib/roles'
import { parseStaffFile, generateTemplate, type StaffRow } from '@/lib/parseStaffFile'
import { useTheme } from '@/hooks/useTheme'

type Step = 'upload' | 'preview' | 'importing' | 'done'

export default function StaffImportPage() {
  const { tokens: t } = useTheme()
  const S = makeS(t)
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [step, setStep] = useState<Step>('upload')
  const [rows, setRows] = useState<StaffRow[]>([])
  const [fileName, setFileName] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [parseError, setParseError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Import state
  const [importProgress, setImportProgress] = useState(0)
  const [importLog, setImportLog] = useState<{ name: string; email: string; status: string; reason: string }[]>([])
  const [importSummary, setImportSummary] = useState<any>(null)

  useEffect(() => {
    getCurrentUser(supabase).then((p: any) => {
      if (!p) { window.location.href = '/login'; return }
      if (!MANAGEMENT_ROLES.includes(p.role)) { window.location.href = '/dashboard'; return }
      setUser(p)
    })
  }, [])

  const handleFile = useCallback(async (file: File) => {
    setParseError('')
    setFileName(file.name)
    try {
      const buffer = await file.arrayBuffer()
      const parsed = parseStaffFile(buffer)
      if (parsed.length === 0) { setParseError('No data rows found in file.'); return }
      setRows(parsed)
      setStep('preview')
    } catch (err: any) {
      setParseError(err.message || 'Failed to parse file')
    }
  }, [])

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }
  function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function downloadTemplate() {
    window.open('/api/staff/template', '_blank')
  }

  const validRows = rows.filter(r => r._status === 'valid')
  const warningRows = rows.filter(r => r._status === 'warning')
  const errorRows = rows.filter(r => r._status === 'error')
  const importable = rows.filter(r => r._status !== 'error')

  async function startImport() {
    if (importable.length === 0) return
    setStep('importing')
    setImportLog([])
    setImportProgress(0)

    // Send in batches of 10 to show progress
    const batchSize = 10
    const allResults: any[] = []

    for (let i = 0; i < importable.length; i += batchSize) {
      const batch = importable.slice(i, i + batchSize)
      try {
        const res = await fetch('/api/staff/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employees: batch, shopId: user.shop_id }),
        })
        const data = await res.json()
        if (data.results) {
          allResults.push(...data.results)
          setImportLog(prev => [...prev, ...data.results])
        }
      } catch (err: any) {
        batch.forEach(emp => {
          allResults.push({ name: emp.full_name, email: emp.email, status: 'error', reason: err.message })
        })
      }
      setImportProgress(Math.min(i + batchSize, importable.length))
    }

    setImportSummary({
      total: importable.length,
      created: allResults.filter(r => r.status === 'created').length,
      skipped: allResults.filter(r => r.status === 'skipped').length,
      failed: allResults.filter(r => r.status === 'error').length,
    })
    setStep('done')
  }

  function downloadResults() {
    const csvRows = [['Name', 'Email', 'Status', 'Details']]
    for (const r of importLog) {
      csvRows.push([r.name || '', r.email || '', r.status, r.reason || ''])
    }
    const csv = csvRows.map(row => row.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `staff-import-results-${new Date().toISOString().split('T')[0]}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  function reset() {
    setStep('upload'); setRows([]); setFileName(''); setParseError('')
    setImportProgress(0); setImportLog([]); setImportSummary(null)
  }

  if (!user) return <div style={S.page}><div style={{ color: 'var(--tz-textTertiary)', textAlign: 'center', paddingTop: 100 }}>Loading...</div></div>

  const ROLE_COLORS: Record<string, string> = {
    technician: 'var(--tz-accent)', maintenance_technician: 'var(--tz-accent)', maintenance_manager: '#7C3AED',
    service_writer: '#059669', accountant: '#D97706', office_admin: '#EC4899', shop_manager: '#7C3AED',
    gm: '#DC2626', parts_manager: '#0891B2', fleet_manager: '#6366F1', dispatcher: '#84CC16', driver: '#78716C', owner: '#DC2626',
  }

  return (
    <div style={S.page}>
      <a href="/settings/users" style={{ fontSize: 12, color: 'var(--tz-textSecondary)', textDecoration: 'none', display: 'block', marginBottom: 20 }}>← Staff</a>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: 'var(--tz-text)', marginBottom: 4 }}>Staff Bulk Import</div>
      <div style={{ fontSize: 12, color: 'var(--tz-textSecondary)', marginBottom: 24 }}>Upload the completed staff roster Excel file to create accounts for all employees at once.</div>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {(['upload', 'preview', 'importing'] as const).map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {i > 0 && <div style={{ width: 24, height: 1, background: '#2A3040' }} />}
            <div style={{
              width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
              background: step === s || (s === 'importing' && step === 'done') ? 'var(--tz-accent)' : i < ['upload', 'preview', 'importing'].indexOf(step) || step === 'done' ? 'rgba(29,111,232,.2)' : 'var(--tz-inputBg)',
              color: step === s || step === 'done' ? 'var(--tz-bgLight)' : 'var(--tz-textTertiary)',
              border: `1px solid ${step === s ? 'var(--tz-accent)' : 'var(--tz-border)'}`,
            }}>{i + 1}</div>
            <span style={{ fontSize: 11, color: step === s || (s === 'importing' && step === 'done') ? 'var(--tz-text)' : 'var(--tz-textTertiary)' }}>
              {s === 'upload' ? 'Upload' : s === 'preview' ? 'Preview' : 'Import'}
            </span>
          </div>
        ))}
      </div>

      {/* STEP 1: Upload */}
      {step === 'upload' && (
        <div>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              ...S.card, textAlign: 'center', cursor: 'pointer', padding: '48px 24px',
              border: dragOver ? `2px dashed ${'var(--tz-accent)'}` : `2px dashed ${'var(--tz-border)'}`,
              background: dragOver ? 'rgba(29,111,232,.04)' : 'var(--tz-bgCard)',
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }}>+</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tz-text)', marginBottom: 6 }}>Drop your Excel or CSV file here</div>
            <div style={{ fontSize: 12, color: 'var(--tz-textTertiary)' }}>or click to browse — accepts .xlsx and .csv</div>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.csv,.xls" style={{ display: 'none' }} onChange={onFileSelect} />

          {parseError && <div style={S.errorBox}>{parseError}</div>}

          <button onClick={downloadTemplate} style={{ ...S.btnOutline, marginTop: 12 }}>Download Blank Template (.xlsx)</button>

          <div style={{ ...S.card, marginTop: 16, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tz-textSecondary)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 10 }}>Required Columns</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {['Full Name', 'Email', 'Role'].map(c => <span key={c} style={{ padding: '4px 10px', background: 'rgba(29,111,232,.08)', border: '1px solid rgba(29,111,232,.15)', borderRadius: 6, fontSize: 11, color: 'var(--tz-accentLight)' }}>{c}</span>)}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tz-textSecondary)', letterSpacing: '.05em', textTransform: 'uppercase', marginTop: 14, marginBottom: 10 }}>Optional Columns</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {['Team', 'Language', 'Phone', 'Skills', 'Employee ID', 'Notes'].map(c => <span key={c} style={{ padding: '4px 10px', background: 'var(--tz-inputBg)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 6, fontSize: 11, color: 'var(--tz-textSecondary)' }}>{c}</span>)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--tz-textTertiary)', marginTop: 12, lineHeight: 1.6 }}>
              Valid roles: Technician, Service Writer, Shop Manager, Parts Manager, Accountant, Office Admin, GM, Dispatcher, Driver, Fleet Manager, Maintenance Technician, Maintenance Manager, Owner<br />
              Valid languages: English, Russian, Uzbek, Spanish, Ukrainian
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Preview */}
      {step === 'preview' && (
        <div>
          {/* Summary badges */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ ...S.badge, background: 'rgba(29,184,112,.08)', borderColor: 'rgba(29,184,112,.2)', color: '#1DB870' }}>{validRows.length} valid</div>
            <div style={{ ...S.badge, background: 'rgba(217,167,6,.08)', borderColor: 'rgba(217,167,6,.2)', color: '#D9A706' }}>{warningRows.length} warnings</div>
            <div style={{ ...S.badge, background: 'rgba(217,79,79,.08)', borderColor: 'rgba(217,79,79,.2)', color: '#D94F4F' }}>{errorRows.length} errors</div>
            <div style={{ ...S.badge, color: 'var(--tz-textSecondary)' }}>{rows.length} total from {fileName}</div>
          </div>

          {errorRows.length > 0 && (
            <div style={S.errorBox}>
              {errorRows.length} row(s) have errors and will be skipped. Fix them in your file and re-upload, or continue to import the {importable.length} valid rows.
            </div>
          )}

          {/* Preview table */}
          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['#', 'Full Name', 'Email', 'Role', 'Team', 'Language', 'Skills', 'Status'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{ background: row._status === 'error' ? 'rgba(217,79,79,.04)' : 'transparent' }}>
                    <td style={S.td}>{i + 1}</td>
                    <td style={{ ...S.td, fontWeight: 600, color: 'var(--tz-text)' }}>{row.full_name || '—'}</td>
                    <td style={S.td}>{row.email || '—'}</td>
                    <td style={S.td}>
                      {row.role && (
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: `${ROLE_COLORS[row.role] || 'var(--tz-textTertiary)'}20`, color: ROLE_COLORS[row.role] || 'var(--tz-textTertiary)' }}>
                          {row.role.replace(/_/g, ' ')}
                        </span>
                      )}
                    </td>
                    <td style={S.td}>{row.team || '—'}</td>
                    <td style={S.td}>{row.language || '—'}</td>
                    <td style={{ ...S.td, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.skills || '—'}</td>
                    <td style={S.td}>
                      {row._status === 'valid' && <span style={{ color: '#1DB870', fontWeight: 600 }}>Valid</span>}
                      {row._status === 'warning' && (
                        <span title={row._warnings?.join(', ')} style={{ color: '#D9A706', fontWeight: 600, cursor: 'help' }}>Warning</span>
                      )}
                      {row._status === 'error' && (
                        <span title={row._errors?.join(', ')} style={{ color: '#D94F4F', fontWeight: 600, cursor: 'help' }}>
                          Error: {row._errors?.[0]}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={reset} style={S.btnOutline}>Re-upload</button>
            <button
              onClick={startImport}
              disabled={importable.length === 0}
              style={{
                ...S.btn, flex: 1, opacity: importable.length === 0 ? 0.4 : 1,
                cursor: importable.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              Import {importable.length} Employee{importable.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Importing / Done */}
      {(step === 'importing' || step === 'done') && (
        <div>
          {/* Progress bar */}
          <div style={{ ...S.card, padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--tz-textSecondary)', marginBottom: 8 }}>
              <span>{step === 'done' ? 'Import complete' : 'Creating accounts...'}</span>
              <span>{importProgress} / {importable.length}</span>
            </div>
            <div style={{ height: 6, background: 'var(--tz-inputBg)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3, transition: 'width .3s',
                width: `${(importProgress / Math.max(importable.length, 1)) * 100}%`,
                background: step === 'done' ? '#1DB870' : 'linear-gradient(90deg,#1D6FE8,#4D9EFF)',
              }} />
            </div>
          </div>

          {/* Summary (when done) */}
          {step === 'done' && importSummary && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ ...S.statCard, borderColor: 'rgba(29,184,112,.2)' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#1DB870' }}>{importSummary.created}</div>
                <div style={{ fontSize: 10, color: 'var(--tz-textSecondary)', marginTop: 2 }}>Created</div>
              </div>
              <div style={{ ...S.statCard, borderColor: 'rgba(217,167,6,.2)' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#D9A706' }}>{importSummary.skipped}</div>
                <div style={{ fontSize: 10, color: 'var(--tz-textSecondary)', marginTop: 2 }}>Skipped</div>
              </div>
              <div style={{ ...S.statCard, borderColor: 'rgba(217,79,79,.2)' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#D94F4F' }}>{importSummary.failed}</div>
                <div style={{ fontSize: 10, color: 'var(--tz-textSecondary)', marginTop: 2 }}>Failed</div>
              </div>
            </div>
          )}

          {/* Live log */}
          <div style={{ ...S.card, padding: 0, maxHeight: 400, overflow: 'auto' }}>
            {importLog.map((entry, i) => (
              <div key={i} style={{ padding: '8px 14px', borderBottom: `1px solid ${'var(--tz-border)'}`, fontSize: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ width: 16, textAlign: 'center', flexShrink: 0 }}>
                  {entry.status === 'created' ? <span style={{ color: '#1DB870' }}>&#10003;</span> : entry.status === 'skipped' ? <span style={{ color: '#D9A706' }}>&#8212;</span> : <span style={{ color: '#D94F4F' }}>&#10007;</span>}
                </span>
                <span style={{ color: 'var(--tz-text)', fontWeight: 500, minWidth: 140 }}>{entry.name}</span>
                <span style={{ color: 'var(--tz-textTertiary)', flex: 1 }}>{entry.reason}</span>
              </div>
            ))}
            {step === 'importing' && importLog.length < importable.length && (
              <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--tz-textTertiary)' }}>Processing...</div>
            )}
          </div>

          {/* Actions */}
          {step === 'done' && (
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={downloadResults} style={S.btnOutline}>Download Results CSV</button>
              <button onClick={reset} style={{ ...S.btnOutline }}>Import Another File</button>
              <a href="/settings/users" style={{ ...S.btn, flex: 1, textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>View Staff List</a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

type TT = { bg: string; text: string; bgCard: string; border: string; textTertiary: string; textSecondary: string; inputBg: string; accent: string; bgLight: string; danger: string; dangerBg: string }

function makeS(t: TT): Record<string, React.CSSProperties> {
  return {
    page: { background: 'var(--tz-bg)', minHeight: '100vh', color: 'var(--tz-text)', fontFamily: "'Instrument Sans',sans-serif", padding: 24, maxWidth: 860, margin: '0 auto' },
    card: { background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, padding: 20, marginBottom: 12 },
    btn: { padding: '12px 24px', background: 'var(--tz-accent)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, color: 'var(--tz-bgLight)', cursor: 'pointer', fontFamily: 'inherit' },
    btnOutline: { padding: '10px 18px', background: 'transparent', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 9, fontSize: 12, fontWeight: 600, color: 'var(--tz-textSecondary)', cursor: 'pointer', fontFamily: 'inherit' },
    errorBox: { padding: '10px 14px', background: 'var(--tz-dangerBg)', border: `1px solid ${'var(--tz-danger)'}`, borderRadius: 8, fontSize: 12, color: 'var(--tz-danger)', marginBottom: 12, lineHeight: 1.6 },
    badge: { padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: `1px solid ${'var(--tz-border)'}`, background: 'var(--tz-inputBg)' },
    th: { padding: '8px 10px', textAlign: 'left' as const, fontSize: 10, fontWeight: 700, color: 'var(--tz-textTertiary)', textTransform: 'uppercase' as const, letterSpacing: '.05em', borderBottom: `1px solid ${'var(--tz-border)'}`, fontFamily: "'IBM Plex Mono',monospace" },
    td: { padding: '8px 10px', color: 'var(--tz-textSecondary)', borderBottom: `1px solid ${'var(--tz-border)'}` },
    statCard: { flex: 1, background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 10, padding: '16px 20px', textAlign: 'center' as const, minWidth: 80 },
  }
}
