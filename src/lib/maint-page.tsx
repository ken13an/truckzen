/**
 * TruckZen — Maintenance module shared page builder
 * Creates list pages for any maint_* table using DataTable
 */
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import DataTable from '@/components/DataTable'

const FONT = "'Instrument Sans',sans-serif"

interface MaintListConfig {
  title: string
  table: string
  select?: string
  columns: { key: string; label: string; render?: (row: any) => React.ReactNode; style?: React.CSSProperties }[]
  searchCols: string
  searchPlaceholder?: string
  label: string
  newHref?: string
  onRowClick?: (row: any) => void
  filterKey?: string
  filterOptions?: { value: string; label: string }[]
  orderBy?: string
  emptyMessage?: string
}

export function MaintListPage(config: MaintListConfig) {
  return function Page() {
    const supabase = createClient()
    const [shopId, setShopId] = useState('')
    const [filter, setFilter] = useState('all')

    useEffect(() => {
      getCurrentUser(supabase).then((p: any) => {
        if (!p) { window.location.href = '/login'; return }
        setShopId(p.shop_id)
      })
    }, [])

    if (!shopId) return <div style={{ background: '#060708', minHeight: '100vh', color: '#7C8BA0', fontFamily: FONT, padding: 40, textAlign: 'center' }}>Loading...</div>

    return (
      <div style={{ background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: FONT, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF' }}>{config.title}</div>
          {config.newHref && <a href={config.newHref} style={{ padding: '8px 16px', background: 'linear-gradient(135deg,#1B6EE6,#1248B0)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none', fontFamily: FONT }}>+ New</a>}
        </div>

        {config.filterOptions && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {config.filterOptions.map(f => (
              <button key={f.value} onClick={() => setFilter(f.value)} style={{ padding: '5px 12px', borderRadius: 100, border: filter === f.value ? '1px solid rgba(29,111,232,.3)' : '1px solid rgba(255,255,255,.08)', background: filter === f.value ? 'rgba(29,111,232,.1)' : 'transparent', color: filter === f.value ? '#4D9EFF' : '#7C8BA0', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>{f.label}</button>
            ))}
          </div>
        )}

        <DataTable
          columns={config.columns}
          fetchData={async (page, limit, search) => {
            let url = `/api/maintenance/crud?table=${config.table}&shop_id=${shopId}&page=${page}&limit=${limit}&order_by=${config.orderBy || 'created_at'}&search_cols=${config.searchCols}`
            if (search) url += `&q=${encodeURIComponent(search)}`
            if (config.select) url += `&select=${encodeURIComponent(config.select)}`
            if (config.filterKey && filter !== 'all') url += `&filter_key=${config.filterKey}&filter_val=${filter}`
            const res = await fetch(url)
            return res.ok ? res.json() : { data: [], total: 0 }
          }}
          label={config.label}
          searchPlaceholder={config.searchPlaceholder || `Search ${config.label}...`}
          onRowClick={config.onRowClick}
          emptyMessage={config.emptyMessage || `No ${config.label} yet`}
        />
      </div>
    )
  }
}
