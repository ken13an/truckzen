'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { ADMIN_ROLES } from '@/lib/roles'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Inter', -apple-system, sans-serif"

const EXPORT_TABLES = [
  { key: 'service_orders', label: 'Work Orders', table: 'service_orders' },
  { key: 'so_lines', label: 'Job Lines', table: 'so_lines' },
  { key: 'customers', label: 'Customers', table: 'customers' },
  { key: 'assets', label: 'Trucks / Units', table: 'assets' },
  { key: 'parts', label: 'Parts Inventory', table: 'parts' },
  { key: 'invoices', label: 'Invoices', table: 'invoices' },
  { key: 'users', label: 'Team Members', table: 'users' },
  { key: 'so_time_entries', label: 'Time Clock Records', table: 'so_time_entries' },
  { key: 'parts_requests', label: 'Parts Requests', table: 'parts_requests' },
  { key: 'kiosk_checkins', label: 'Service Requests', table: 'kiosk_checkins' },
  { key: 'ai_usage_log', label: 'AI Usage Log', table: 'ai_usage_log' },
]

export default function ExportPage() {
  const { tokens: th } = useTheme()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set(EXPORT_TABLES.filter(t => t.key !== 'ai_usage_log').map(t => t.key)))
  const [format, setFormat] = useState<'csv' | 'json'>('csv')
  const [exporting, setExporting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    getCurrentUser(supabase).then(async (p: any) => {
      if (!p) { window.location.href = '/login'; return }
      if (!ADMIN_ROLES.includes(p.role)) { window.location.href = '/settings'; return }
      setUser(p)
      // Get row counts
      const c: Record<string, number> = {}
      for (const t of EXPORT_TABLES) {
        const { count } = await supabase.from(t.table).select('*', { count: 'exact', head: true }).eq('shop_id', p.shop_id)
        c[t.key] = count || 0
      }
      setCounts(c)
    })
  }, [])

  function toggleAll(on: boolean) {
    setSelected(on ? new Set(EXPORT_TABLES.map(t => t.key)) : new Set())
  }

  function toggle(key: string) {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(key) ? n.delete(key) : n.add(key)
      return n
    })
  }

  async function runExport() {
    if (!user || selected.size === 0) return
    setExporting(true)
    setDone(false)
    try {
      const res = await fetch('/api/export/full', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_id: user.shop_id, user_id: user.id, user_role: user.role, tables: Array.from(selected), format }),
      })
      if (!res.ok) { alert('Export failed'); setExporting(false); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'truckzen_export.zip'
      a.click()
      URL.revokeObjectURL(url)
      setDone(true)
    } catch { alert('Export failed') }
    setExporting(false)
  }

  if (!user) return null

  return (
    <div style={{ fontFamily: FONT, color: 'var(--tz-text)', background: 'var(--tz-bgLight)', minHeight: '100vh', maxWidth: 700, margin: '0 auto', padding: '24px' }}>
      <a href="/settings" style={{ fontSize: 13, color: 'var(--tz-textSecondary)', textDecoration: 'none' }}>&larr; Back to Settings</a>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '12px 0 4px' }}>Data Export</h1>
      <p style={{ fontSize: 14, color: 'var(--tz-textSecondary)', margin: '0 0 24px' }}>Download all your shop's data in {format.toUpperCase()} format. Your data belongs to you — export anytime.</p>

      {/* Format selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <span style={{ fontSize: 13, color: 'var(--tz-textSecondary)', alignSelf: 'center' }}>Format:</span>
        {(['csv', 'json'] as const).map(f => (
          <button key={f} onClick={() => setFormat(f)} style={{
            padding: '6px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
            background: format === f ? 'var(--tz-accent)' : 'var(--tz-bgHover)', color: format === f ? 'var(--tz-bgLight)' : 'var(--tz-textSecondary)', border: 'none',
          }}>{f.toUpperCase()}</button>
        ))}
      </div>

      {/* Table selection */}
      <div style={{ background: 'var(--tz-bgHover)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Select what to export:</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => toggleAll(true)} style={{ fontSize: 12, color: 'var(--tz-accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 600 }}>Select All</button>
            <button onClick={() => toggleAll(false)} style={{ fontSize: 12, color: 'var(--tz-textSecondary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT }}>Deselect All</button>
          </div>
        </div>

        {EXPORT_TABLES.map(t => (
          <label key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${'var(--tz-bgHover)'}`, cursor: 'pointer' }}>
            <input type="checkbox" checked={selected.has(t.key)} onChange={() => toggle(t.key)} />
            <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{t.label}</span>
            <span style={{ fontSize: 12, color: 'var(--tz-textSecondary)', fontFamily: 'monospace' }}>
              {counts[t.key] !== undefined ? counts[t.key].toLocaleString() + ' records' : '...'}
            </span>
          </label>
        ))}
      </div>

      {/* Export button */}
      <button onClick={runExport} disabled={exporting || selected.size === 0} style={{
        width: '100%', padding: '14px 0', borderRadius: 10, border: 'none', fontSize: 15, fontWeight: 700,
        background: exporting || selected.size === 0 ? 'var(--tz-border)' : 'var(--tz-accent)', color: 'var(--tz-bgLight)',
        cursor: exporting || selected.size === 0 ? 'not-allowed' : 'pointer', fontFamily: FONT,
      }}>
        {exporting ? 'Exporting... This may take a minute.' : `Export ${selected.size} Table${selected.size !== 1 ? 's' : ''} as ${format.toUpperCase()} ZIP`}
      </button>

      {done && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, fontSize: 13, color: '#16A34A', fontWeight: 600 }}>
          Export complete. Your download should have started automatically.
        </div>
      )}

      <p style={{ fontSize: 11, color: 'var(--tz-textSecondary)', marginTop: 16 }}>
        Note: Large exports may take a few minutes. Team member data excludes passwords and auth tokens. Export activity is logged.
      </p>
    </div>
  )
}
