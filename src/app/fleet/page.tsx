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

type OwnerTab = 'fleet_asset' | 'owner_operator' | 'outside_customer' | 'all'
type StatusFilter = 'active' | 'removed' | 'all'

const TABS: { key: OwnerTab; label: string; badgeBg: string; badgeColor: string }[] = [
  { key: 'fleet_asset', label: 'Our Fleet', badgeBg: 'rgba(22,163,74,.1)', badgeColor: '#16A34A' },
  { key: 'owner_operator', label: 'Owner Operators', badgeBg: 'rgba(217,119,6,.1)', badgeColor: '#D97706' },
  { key: 'outside_customer', label: 'Outside Customers', badgeBg: 'rgba(29,111,232,.1)', badgeColor: '#1D6FE8' },
  { key: 'all', label: 'All Trucks', badgeBg: 'rgba(124,139,160,.1)', badgeColor: '#7C8BA0' },
]

const STATUS_COLORS: Record<string, string> = { active: '#1DB870', inactive: '#7C8BA0', in_shop: '#4D9EFF', decommissioned: '#D94F4F', removed: '#D94F4F' }

export default function FleetPage() {
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
    const t = setTimeout(() => { setPage(1); fetchAssets(shopId, 1) }, 400)
    setSearchTimer(t)
    return () => clearTimeout(t)
  }, [search])

  const switchTab = (t: OwnerTab) => {
    setTab(t)
    setPage(1)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', t)
    window.history.replaceState({}, '', url.toString())
  }

  return (
    <div style={{ background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: "'Instrument Sans',sans-serif", padding: 24 }}>
      {/* Header */}
      {/* Fleet workspace navigation */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { href: '/fleet', label: 'Trucks', active: true },
          { href: '/fleet/service-requests', label: 'Service Requests' },
          { href: '/fleet/compliance', label: 'Compliance' },
          { href: '/fleet/new', label: '+ Add Vehicle' },
        ].map(link => (
          <a key={link.href} href={link.href} style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
            textDecoration: 'none', fontFamily: 'inherit',
            background: link.active ? 'rgba(29,111,232,.1)' : 'rgba(255,255,255,.04)',
            color: link.active ? '#4D9EFF' : '#7C8BA0',
            border: link.active ? '1px solid rgba(29,111,232,.2)' : '1px solid rgba(255,255,255,.06)',
          }}>{link.label}</a>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF' }}>Trucks</div>
          <div style={{ fontSize: 12, color: '#7C8BA0' }}>{total.toLocaleString()} vehicles</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search unit, make, VIN, owner, driver..." style={{ padding: '7px 12px', background: '#1C2130', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, color: '#DDE3EE', fontSize: 11, fontFamily: 'inherit', outline: 'none', width: 260 }} />
          <button onClick={() => window.location.href = '/fleet/new'} style={{ padding: '7px 14px', background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add Vehicle</button>
        </div>
      </div>

      {/* 4 Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,.08)', marginBottom: 12 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => switchTab(t.key)} style={{
            padding: '10px 16px', background: 'none', border: 'none',
            borderBottom: tab === t.key ? '2px solid #1D6FE8' : '2px solid transparent',
            color: tab === t.key ? '#F0F4FF' : '#7C8BA0',
            fontWeight: tab === t.key ? 700 : 500, fontSize: 13, cursor: 'pointer',
            fontFamily: 'inherit', marginBottom: -1, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {t.label}
            {counts[t.key] != null && (
              <span style={{ padding: '1px 7px', borderRadius: 100, fontSize: 10, fontWeight: 600, background: tab === t.key ? t.badgeBg : 'rgba(124,139,160,.08)', color: tab === t.key ? t.badgeColor : '#7C8BA0' }}>
                {(counts[t.key] || 0).toLocaleString()}
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
            border: statusFilter === v ? '1px solid rgba(29,111,232,.3)' : '1px solid rgba(255,255,255,.08)',
            color: statusFilter === v ? '#4D9EFF' : '#7C8BA0',
          }}>{l}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#161B24', border: '1px solid rgba(255,255,255,.055)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead><tr>{['Unit #', 'Year', 'Make / Model', 'VIN', 'Plate', 'Owner', 'Driver', 'Company', 'Type', 'Status'].map(h =>
              <th key={h} style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.1em', padding: '7px 10px', textAlign: 'left', background: '#0B0D11', whiteSpace: 'nowrap' }}>{h}</th>
            )}</tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: '#7C8BA0' }}>Loading...</td></tr>
              : assets.length === 0 ? <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: '#7C8BA0' }}>No vehicles found</td></tr>
              : assets.map(a => {
                const st = a.asset_status || a.status || 'active'
                const sc = STATUS_COLORS[st] || '#7C8BA0'
                return (
                  <tr key={a.id} style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,.025)' }} onClick={() => window.location.href = '/fleet/' + a.id}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.03)')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={{ padding: '9px 10px', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: '#4D9EFF', fontWeight: 700 }}>
                      {a.unit_number} <SourceBadge source={a.source} />
                    </td>
                    <td style={{ padding: '9px 10px', fontSize: 11, color: '#7C8BA0' }}>{a.year || '—'}</td>
                    <td style={{ padding: '9px 10px', fontSize: 12, color: '#F0F4FF', fontWeight: 600 }}>{a.make || '—'} {a.model || ''}</td>
                    <td style={{ padding: '9px 10px', fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: '#48536A', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.vin || ''}>{a.vin ? '...' + a.vin.slice(-6) : '—'}</td>
                    <td style={{ padding: '9px 10px', fontSize: 10, color: '#7C8BA0' }}>{a.license_plate || '—'}</td>
                    <td style={{ padding: '9px 10px', fontSize: 11, color: '#DDE3EE', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.owner_name || '—'}</td>
                    <td style={{ padding: '9px 10px', fontSize: 11, color: '#DDE3EE', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.driver_name || '—'}</td>
                    <td style={{ padding: '9px 10px', fontSize: 11, color: '#7C8BA0', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(a.customers as any)?.company_name || '—'}</td>
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
  )
}
