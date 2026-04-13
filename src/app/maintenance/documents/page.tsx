'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import DataTable from '@/components/DataTable'
import { Upload } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const BLUE = '#1B6EE6', MUTED = '#7C8BA0'
const typeColor: Record<string, string> = { invoice: '#F97316', photo: BLUE, repair_order: '#8B5CF6', other: MUTED }

export default function DocumentsPage() {
  const { tokens: t } = useTheme()
  const supabase = createClient()
  const [shopId, setShopId] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    getCurrentUser(supabase).then((p: any) => { if (!p) { window.location.href = '/login'; return }; setShopId(p.shop_id) })
  }, [])

  if (!shopId) return <div style={{ background: t.bg, minHeight: '100vh', color: MUTED, fontFamily: FONT, padding: 40, textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ background: t.bg, minHeight: '100vh', color: t.text, fontFamily: FONT, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: t.text }}>Documents</div>
      </div>

      <div style={{ background: t.bgCard, border: `2px dashed ${t.border}`, borderRadius: 12, padding: 30, textAlign: 'center', marginBottom: 16 }}>
        <Upload size={28} color={t.textTertiary} style={{ marginBottom: 8 }} />
        <div style={{ color: t.textTertiary, fontSize: 13 }}>Upload files to the maintenance document library</div>
        <div style={{ color: t.textTertiary, fontSize: 11, marginTop: 4 }}>Drag & drop or click to upload. Uses maintenance-files storage.</div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[{ value: 'all', label: 'All' }, { value: 'invoice', label: 'Invoices' }, { value: 'photo', label: 'Photos' }, { value: 'repair_order', label: 'Repair Orders' }].map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)} style={{ padding: '5px 12px', borderRadius: 100, border: filter === f.value ? '1px solid rgba(29,111,232,.3)' : `1px solid ${t.border}`, background: filter === f.value ? 'rgba(29,111,232,.1)' : 'transparent', color: filter === f.value ? t.accentLight : MUTED, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>{f.label}</button>
        ))}
      </div>

      <DataTable
        columns={[
          { key: 'file_name', label: 'File Name', render: (r: any) => <span style={{ fontWeight: 600, color: t.text }}>{r.file_name}</span> },
          { key: 'file_type', label: 'Type', render: (r: any) => <span style={{ fontSize: 9, fontWeight: 600, color: typeColor[r.file_type] || MUTED, background: `${typeColor[r.file_type] || MUTED}18`, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>{r.file_type || 'other'}</span> },
          { key: 'file_size', label: 'Size', render: (r: any) => r.file_size ? `${(r.file_size / 1024).toFixed(0)} KB` : '—' },
          { key: 'linked_type', label: 'Linked To', render: (r: any) => <span style={{ textTransform: 'capitalize' }}>{r.linked_type?.replace(/_/g, ' ') || '—'}</span> },
          { key: 'category', label: 'Category', render: (r: any) => <span style={{ textTransform: 'capitalize' }}>{r.category || '—'}</span> },
          { key: 'created_at', label: 'Uploaded', render: (r: any) => new Date(r.created_at).toLocaleDateString() },
        ]}
        fetchData={async (page, limit, search) => {
          let url = `/api/maintenance/crud?table=maint_documents&shop_id=${shopId}&page=${page}&limit=${limit}&order_by=created_at&search_cols=file_name,category`
          if (search) url += `&q=${encodeURIComponent(search)}`
          if (filter !== 'all') url += `&filter_key=file_type&filter_val=${filter}`
          const res = await fetch(url)
          return res.ok ? res.json() : { data: [], total: 0 }
        }}
        label="documents"
        searchPlaceholder="Search documents..."
        emptyMessage="No documents yet."
      />
    </div>
  )
}
