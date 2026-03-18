'use client'
import { useState, useCallback } from 'react'

type ImportType = 'parts' | 'fleet' | 'customers' | 'drivers'

const IMPORT_TYPES = [
  { value:'parts',     label:'Parts Inventory',  icon:'🔧', desc:'Import your parts catalog from Excel or CSV' },
  { value:'fleet',     label:'Fleet / Trucks',   icon:'🚛', desc:'Import vehicle list with VINs and odometers' },
  { value:'customers', label:'Customers',        icon:'🏢', desc:'Import customer and fleet company contacts' },
  { value:'drivers',   label:'Drivers',          icon:'👤', desc:'Import driver list with CDL and medical dates' },
] as const

export default function SmartDropPage() {
  const [importType, setImportType] = useState<ImportType>('parts')
  const [file,       setFile]       = useState<File | null>(null)
  const [preview,    setPreview]    = useState<any[]>([])
  const [headers,    setHeaders]    = useState<string[]>([])
  const [mapping,    setMapping]    = useState<Record<string, string>>({})
  const [importing,  setImporting]  = useState(false)
  const [result,     setResult]     = useState<{ imported: number; skipped: number; errors: string[] } | null>(null)
  const [step,       setStep]       = useState<1|2|3>(1)
  const [dragging,   setDragging]   = useState(false)

  const FIELD_MAPS: Record<ImportType, { field: string; label: string; required: boolean }[]> = {
    parts: [
      { field:'part_number',    label:'Part Number',    required:false },
      { field:'description',    label:'Description',    required:true  },
      { field:'category',       label:'Category',       required:false },
      { field:'on_hand',        label:'Qty On Hand',    required:false },
      { field:'reorder_point',  label:'Reorder At',     required:false },
      { field:'cost_price',     label:'Cost Price',     required:false },
      { field:'sell_price',     label:'Sell Price',     required:false },
      { field:'vendor',         label:'Vendor',         required:false },
      { field:'bin_location',   label:'Bin Location',   required:false },
    ],
    fleet: [
      { field:'unit_number',    label:'Unit Number',    required:true  },
      { field:'year',           label:'Year',           required:false },
      { field:'make',           label:'Make',           required:false },
      { field:'model',          label:'Model',          required:false },
      { field:'vin',            label:'VIN',            required:false },
      { field:'odometer',       label:'Odometer',       required:false },
      { field:'customer_name',  label:'Owner/Company',  required:false },
    ],
    customers: [
      { field:'company_name',   label:'Company Name',   required:true  },
      { field:'contact_name',   label:'Contact Name',   required:false },
      { field:'phone',          label:'Phone',          required:false },
      { field:'email',          label:'Email',          required:false },
      { field:'payment_terms',  label:'Payment Terms',  required:false },
    ],
    drivers: [
      { field:'full_name',          label:'Full Name',       required:true  },
      { field:'phone',              label:'Phone',           required:false },
      { field:'cdl_number',         label:'CDL Number',      required:false },
      { field:'cdl_class',          label:'CDL Class',       required:false },
      { field:'cdl_expiry',         label:'CDL Expiry',      required:false },
      { field:'medical_card_expiry',label:'Medical Expiry',  required:false },
    ],
  }

  function parseCSV(text: string) {
    const lines = text.trim().split('\n')
    const hdrs  = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,''))
    const rows  = lines.slice(1, 6).map(l => {
      const vals = l.split(',').map(v => v.trim().replace(/^"|"$/g,''))
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

    // Auto-map columns by fuzzy match
    const autoMap: Record<string, string> = {}
    const fields = FIELD_MAPS[importType]
    for (const field of fields) {
      const match = hdrs.find(h =>
        h.toLowerCase().includes(field.field.toLowerCase().replace(/_/g,' ')) ||
        h.toLowerCase().includes(field.label.toLowerCase()) ||
        field.field.toLowerCase().includes(h.toLowerCase())
      )
      if (match) autoMap[field.field] = match
    }
    setMapping(autoMap)
    setStep(2)
  }

  async function runImport() {
    if (!file) return
    setImporting(true)
    const text = await file.text()
    const lines = text.trim().split('\n')
    const hdrs  = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,''))
    const rows  = lines.slice(1).map(l => {
      const vals = l.split(',').map(v => v.trim().replace(/^"|"$/g,''))
      const obj: Record<string, string> = {}
      hdrs.forEach((h, i) => { obj[h] = vals[i] || '' })
      return obj
    })

    // Map rows using column mapping
    const mapped = rows.map(row => {
      const out: Record<string, any> = {}
      for (const [field, col] of Object.entries(mapping)) {
        out[field] = row[col] || ''
      }
      return out
    }).filter(row => {
      const required = FIELD_MAPS[importType].filter(f => f.required).map(f => f.field)
      return required.every(f => row[f])
    })

    let imported = 0; let skipped = 0; const errors: string[] = []

    // Send in batches of 50
    for (let i = 0; i < mapped.length; i += 50) {
      const batch = mapped.slice(i, i + 50)
      const res = await fetch(`/api/${importType === 'fleet' ? 'assets' : importType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch }),
      })
      if (res.ok) { const d = await res.json(); imported += d.imported || batch.length }
      else { skipped += batch.length; errors.push(`Batch ${Math.floor(i/50)+1} failed`) }
    }

    setResult({ imported, skipped, errors })
    setStep(3)
    setImporting(false)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && (f.name.endsWith('.csv') || f.name.endsWith('.xlsx'))) handleFile(f)
  }, [importType])

  const S: Record<string, React.CSSProperties> = {
    page:   { background:'#060708', minHeight:'100vh', color:'#DDE3EE', fontFamily:"'Instrument Sans',sans-serif", padding:24 },
    title:  { fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:'#F0F4FF', marginBottom:4 },
    card:   { background:'#161B24', border:'1px solid rgba(255,255,255,.055)', borderRadius:12, padding:20, marginBottom:14 },
    label:  { fontFamily:"'IBM Plex Mono',monospace", fontSize:8, letterSpacing:'.1em', textTransform:'uppercase' as const, color:'#48536A', marginBottom:6, display:'block' },
    select: { padding:'8px 12px', background:'#1C2130', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, fontSize:12, color:'#DDE3EE', outline:'none', fontFamily:'inherit', appearance:'none' as any, cursor:'pointer', minHeight:36 },
  }

  return (
    <div style={S.page}>
      <a href="/dashboard" style={{ fontSize:12, color:'#7C8BA0', textDecoration:'none', display:'block', marginBottom:20 }}>← Dashboard</a>
      <div style={S.title}>Smart Drop</div>
      <div style={{ fontSize:12, color:'#7C8BA0', marginBottom:20 }}>Import your existing data from any spreadsheet. AI maps the columns automatically.</div>

      {/* Step indicators */}
      <div style={{ display:'flex', gap:6, marginBottom:20 }}>
        {[['1','Upload File'],['2','Map Columns'],['3','Done']].map(([n, l], i) => (
          <div key={n} style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:24, height:24, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, fontFamily:'monospace', background: step > i+1 ? '#1DB870' : step === i+1 ? '#1D6FE8' : '#1C2130', color:'#fff' }}>{step > i+1 ? '✓' : n}</div>
            <span style={{ fontSize:11, color: step === i+1 ? '#F0F4FF' : '#48536A' }}>{l}</span>
            {i < 2 && <div style={{ width:20, height:1, background:'rgba(255,255,255,.1)' }}/>}
          </div>
        ))}
      </div>

      {step === 1 && (
        <>
          {/* Import type selection */}
          <div style={S.card}>
            <div style={{ fontSize:12, fontWeight:700, color:'#F0F4FF', marginBottom:12 }}>What are you importing?</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {IMPORT_TYPES.map(t => (
                <div key={t.value} onClick={() => setImportType(t.value)}
                  style={{ padding:'12px 14px', borderRadius:10, cursor:'pointer', border:`1px solid ${importType===t.value?'rgba(29,111,232,.4)':'rgba(255,255,255,.06)'}`, background: importType===t.value?'rgba(29,111,232,.08)':'#1C2130' }}>
                  <div style={{ fontSize:18, marginBottom:5 }}>{t.icon}</div>
                  <div style={{ fontSize:12, fontWeight:700, color: importType===t.value?'#4D9EFF':'#F0F4FF' }}>{t.label}</div>
                  <div style={{ fontSize:10, color:'#7C8BA0', marginTop:2 }}>{t.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Drop zone */}
          <div style={{ ...S.card, border:`2px dashed ${dragging?'rgba(29,111,232,.6)':'rgba(255,255,255,.1)'}`, background: dragging?'rgba(29,111,232,.05)':'#161B24', textAlign:'center', padding:40, cursor:'pointer' }}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById('fileInput')?.click()}>
            <div style={{ fontSize:40, marginBottom:12 }}>📂</div>
            <div style={{ fontSize:14, fontWeight:700, color:'#F0F4FF', marginBottom:6 }}>Drop your CSV or Excel file here</div>
            <div style={{ fontSize:12, color:'#7C8BA0' }}>or click to browse — supports .csv and .xlsx</div>
            <input id="fileInput" type="file" accept=".csv,.xlsx" style={{ display:'none' }} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}/>
          </div>

          {/* Template download hints */}
          <div style={{ fontSize:11, color:'#48536A', textAlign:'center' }}>
            Export from Monday.com, Fleetio, Fullbay, or any spreadsheet. First row must be column headers.
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div style={S.card}>
            <div style={{ fontSize:12, fontWeight:700, color:'#F0F4FF', marginBottom:4 }}>Map Columns</div>
            <div style={{ fontSize:11, color:'#7C8BA0', marginBottom:14 }}>Match your spreadsheet columns to TruckZen fields. Auto-mapped where possible.</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {FIELD_MAPS[importType].map(field => (
                <div key={field.field}>
                  <label style={S.label}>{field.label}{field.required ? ' *' : ''}</label>
                  <select style={{ ...S.select, width:'100%' }} value={mapping[field.field] || ''} onChange={e => setMapping(m => ({ ...m, [field.field]: e.target.value }))}>
                    <option value="">— Skip this field —</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div style={S.card}>
            <div style={{ fontSize:12, fontWeight:700, color:'#F0F4FF', marginBottom:12 }}>Preview (first 5 rows)</div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:10 }}>
                <thead>
                  <tr>{Object.entries(mapping).filter(([,v])=>v).map(([k]) => (
                    <th key={k} style={{ fontFamily:'monospace', fontSize:8, color:'#48536A', textTransform:'uppercase', letterSpacing:'.08em', padding:'5px 8px', textAlign:'left', background:'#0B0D11' }}>{k}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,.025)' }}>
                      {Object.entries(mapping).filter(([,v])=>v).map(([field, col]) => (
                        <td key={field} style={{ padding:'6px 8px', color:'#DDE3EE' }}>{row[col] || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => { setStep(1); setFile(null); setPreview([]) }} style={{ padding:'10px 20px', background:'transparent', border:'1px solid rgba(255,255,255,.1)', borderRadius:9, color:'#7C8BA0', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Back</button>
            <button onClick={runImport} disabled={importing} style={{ flex:1, padding:'12px 24px', background:'linear-gradient(135deg,#1D6FE8,#1248B0)', border:'none', borderRadius:9, fontSize:13, fontWeight:700, color:'#fff', cursor:'pointer', fontFamily:'inherit', opacity: importing?0.7:1 }}>
              {importing ? 'Importing...' : `Import ${IMPORT_TYPES.find(t=>t.value===importType)?.label}`}
            </button>
          </div>
        </>
      )}

      {step === 3 && result && (
        <div style={{ ...S.card, textAlign:'center', padding:40 }}>
          <div style={{ fontSize:48, marginBottom:16 }}>{result.errors.length === 0 ? '✅' : '⚠️'}</div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:'#F0F4FF', marginBottom:8 }}>Import Complete</div>
          <div style={{ display:'flex', gap:20, justifyContent:'center', margin:'20px 0' }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:36, color:'#1DB870' }}>{result.imported}</div>
              <div style={{ fontSize:11, color:'#7C8BA0' }}>Imported</div>
            </div>
            {result.skipped > 0 && <div style={{ textAlign:'center' }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:36, color:'#D4882A' }}>{result.skipped}</div>
              <div style={{ fontSize:11, color:'#7C8BA0' }}>Skipped</div>
            </div>}
          </div>
          {result.errors.length > 0 && result.errors.map((e,i) => (
            <div key={i} style={{ fontSize:11, color:'#D94F4F', marginBottom:4 }}>{e}</div>
          ))}
          <div style={{ display:'flex', gap:8, justifyContent:'center', marginTop:20 }}>
            <button onClick={() => { setStep(1); setFile(null); setPreview([]); setResult(null) }} style={{ padding:'10px 20px', background:'transparent', border:'1px solid rgba(255,255,255,.1)', borderRadius:9, color:'#7C8BA0', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Import More</button>
            <a href={`/${importType === 'fleet' ? 'fleet' : importType}`} style={{ padding:'10px 20px', background:'linear-gradient(135deg,#1D6FE8,#1248B0)', borderRadius:9, color:'#fff', fontSize:12, fontWeight:700, textDecoration:'none' }}>View {IMPORT_TYPES.find(t=>t.value===importType)?.label}</a>
          </div>
        </div>
      )}
    </div>
  )
}
