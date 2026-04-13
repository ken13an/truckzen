/**
 * TruckZen — Fleet page with 4 ownership tabs
 */
'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import SourceBadge from '@/components/ui/SourceBadge'
import OwnershipTypeBadge from '@/components/OwnershipTypeBadge'
import Pagination from '@/components/Pagination'
import { useTheme } from '@/hooks/useTheme'

type OwnerTab = 'fleet_asset' | 'owner_operator' | 'outside_customer' | 'all'
type StatusFilter = 'active' | 'removed' | 'all'

export default function FleetPage() {
  const { tokens: t } = useTheme()

  const TABS: { key: OwnerTab; label: string; badgeBg: string; badgeColor: string }[] = [
    { key: 'fleet_asset', label: 'Our Fleet', badgeBg: 'rgba(22,163,74,.1)', badgeColor: '#16A34A' },
    { key: 'owner_operator', label: 'Owner Operators', badgeBg: 'rgba(217,119,6,.1)', badgeColor: '#D97706' },
    { key: 'outside_customer', label: 'Outside Customers', badgeBg: 'rgba(29,111,232,.1)', badgeColor: 'var(--tz-accent)' },
    { key: 'all', label: 'All Trucks', badgeBg: 'rgba(124,139,160,.1)', badgeColor: 'var(--tz-textSecondary)' },
  ]

  const STATUS_COLORS: Record<string, string> = { active: '#1DB870', inactive: 'var(--tz-textSecondary)', in_shop: 'var(--tz-accentLight)', decommissioned: 'var(--tz-danger)', removed: 'var(--tz-danger)' }

  const supabase = createClient()
  const [assets, setAssets] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<OwnerTab>('fleet_asset')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [page, setPage] = useState(1)
  const [shopId, setShopId] = useState('')
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  const fetchAssets = useCallback(async (sid: string, p: number) => {
    if (!sid) return
    setLoading(true)
    let url = `/api/assets?shop_id=${sid}&page=${p}&limit=25&include_counts=true`
    if (tab !== 'all') url += `&ownership_type=${tab}`
    if (statusFilter !== 'all') url += `&asset_status=${statusFilter}`
    if (search) url += `&q=${encodeURIComponent(search)}`
    const res = await fetch(url)
    if (res.ok) {
      const json = await res.json()
      setAssets(json.data || [])
      setTotal(json.total || 0)
      setTotalPages(json.totalPages || 1)
      if (json.counts) setCounts(json.counts)
    }
    setLoading(false)
  }, [tab, statusFilter, search])

  useEffect(() => {
    getCurrentUser(supabase).then(async (p: any) => {
      if (!p) { window.location.href = '/login'; return }
      setShopId(p.shop_id)
      // Read tab from URL
      const params = new URLSearchParams(window.location.search)
      const urlTab = params.get('tab')
      if (urlTab && ['fleet_asset', 'owner_operator', 'outside_customer', 'all'].includes(urlTab)) setTab(urlTab as OwnerTab)
    })
  }, [])

  useEffect(() => { if (shopId) fetchAssets(shopId, page) }, [page, tab, statusFilter, shopId, fetchAssets])

  useEffect(() => {
    if (!shopId) return
    if (searchTimer) clearTimeout(searchTimer)
    const tm = setTimeout(() => { setPage(1); fetchAssets(shopId, 1) }, 400)
    setSearchTimer(tm)
    return () => clearTimeout(tm)
  }, [search])

  const switchTab = (newTab: OwnerTab) => {
    setTab(newTab)
    setPage(1)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', newTab)
    window.history.replaceState({}, '', url.toString())
  }

  return (
    <div style={{ background: 'var(--tz-bg)', minHeight: '100vh', color: 'var(--tz-text)', fontFamily: "'Instrument Sans',sans-serif", padding: '32px clamp(20px, 4vw, 40px)' }}>
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, letterSpacing: '.02em', color: 'var(--tz-text)', lineHeight: 1 }}>Trucks</div>
          <div style={{ fontSize: 12, color: 'var(--tz-textSecondary)', marginTop: 6 }}>{total.toLocaleString()} vehicles in the fleet</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search unit, make, VIN, owner, driver..." style={{ padding: '7px 12px', background: 'var(--tz-inputBg)', border: `1px solid ${'var(--tz-inputBorder)'}`, borderRadius: 8, color: 'var(--tz-text)', fontSize: 11, fontFamily: 'inherit', outline: 'none', width: 260 }} />
          <button onClick={() => window.location.href = '/fleet/new'} style={{ padding: '7px 14px', background: 'var(--tz-accent)', border: 'none', borderRadius: 8, color: 'var(--tz-bgLight)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add Vehicle</button>
        </div>
      </div>

      {/* 4 Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${'var(--tz-border)'}`, marginBottom: 12 }}>
        {TABS.map(tb => (
          <button key={tb.key} onClick={() => switchTab(tb.key)} style={{
            padding: '10px 16px', background: 'none', border: 'none',
            borderBottom: tab === tb.key ? `2px solid ${'var(--tz-accent)'}` : '2px solid transparent',
            color: tab === tb.key ? 'var(--tz-text)' : 'var(--tz-textSecondary)',
            fontWeight: tab === tb.key ? 700 : 500, fontSize: 13, cursor: 'pointer',
            fontFamily: 'inherit', marginBottom: -1, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {tb.label}
            {counts[tb.key] != null && (
              <span style={{ padding: '1px 7px', borderRadius: 100, fontSize: 10, fontWeight: 600, background: tab === tb.key ? tb.badgeBg : 'rgba(124,139,160,.08)', color: tab === tb.key ? tb.badgeColor : 'var(--tz-textSecondary)' }}>
                {(counts[tb.key] || 0).toLocaleString()}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Status toggle */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {([['active', 'Active'], ['removed', 'Removed'], ['all', 'All']] as [StatusFilter, string][]).map(([v, l]) => (
          <button key={v} onClick={() => { setStatusFilter(v); setPage(1) }} style={{
            padding: '4px 12px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            background: statusFilter === v ? 'rgba(29,111,232,.1)' : 'transparent',
            border: statusFilter === v ? '1px solid rgba(29,111,232,.3)' : `1px solid ${'var(--tz-border)'}`,
            color: statusFilter === v ? 'var(--tz-accentLight)' : 'var(--tz-textSecondary)',
          }}>{l}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead><tr>{['Unit #', 'Year', 'Make / Model', 'VIN', 'Plate', 'Owner', 'Driver', 'Company', 'Type', 'Status'].map(h =>
              <th key={h} style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: 'var(--tz-textTertiary)', textTransform: 'uppercase', letterSpacing: '.1em', padding: '7px 10px', textAlign: 'left', background: 'var(--tz-bgInput)', whiteSpace: 'nowrap' }}>{h}</th>
            )}</tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: 'var(--tz-textSecondary)' }}>Loading...</td></tr>
              : assets.length === 0 ? <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: 'var(--tz-textSecondary)' }}>No vehicles found</td></tr>
              : assets.map(a => {
                const st = a.asset_status || a.status || 'active'
                const sc = STATUS_COLORS[st] || 'var(--tz-textSecondary)'
                return (
                  <tr key={a.id} style={{ cursor: 'pointer', borderBottom: `1px solid ${'var(--tz-border)'}` }} onClick={() => window.location.href = '/fleet/' + a.id}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--tz-bgHover)')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={{ padding: '9px 10px', fontFamily: "'IBM Plex Mono',monospace", fontVariantNumeric: 'tabular-nums', fontSize: 13, color: 'var(--tz-accentLight)', fontWeight: 700 }}>
                      {a.unit_number} <SourceBadge source={a.source} />
                    </td>
                    <td style={{ padding: '9px 10px', fontSize: 11, color: 'var(--tz-textSecondary)' }}>{a.year || '—'}</td>
                    <td style={{ padding: '9px 10px', fontSize: 12, color: 'var(--tz-text)', fontWeight: 600 }}>{a.make || '—'} {a.model || ''}</td>
                    <td style={{ padding: '9px 10px', fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: 'var(--tz-textTertiary)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.vin || ''}>{a.vin ? '...' + a.vin.slice(-6) : '—'}</td>
                    <td style={{ padding: '9px 10px', fontSize: 10, color: 'var(--tz-textSecondary)' }}>{a.license_plate || '—'}</td>
                    <td style={{ padding: '9px 10px', fontSize: 11, color: 'var(--tz-text)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.owner_name || '—'}</td>
                    <td style={{ padding: '9px 10px', fontSize: 11, color: 'var(--tz-text)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.driver_name || '—'}</td>
                    <td style={{ padding: '9px 10px', fontSize: 11, color: 'var(--tz-textSecondary)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(a.customers as any)?.company_name || '—'}</td>
                    <td style={{ padding: '9px 10px' }}><OwnershipTypeBadge type={a.is_owner_operator ? 'owner_operator' : a.ownership_type} size="sm" dark /></td>
                    <td style={{ padding: '9px 10px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 100, fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, background: sc + '18', color: sc, border: '1px solid ' + sc + '33' }}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor' }} />{st.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={page} totalPages={totalPages} total={total} label="vehicles" onPageChange={setPage} />
      </div>
    </div>
  )
}
