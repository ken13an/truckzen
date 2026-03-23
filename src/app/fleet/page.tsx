/**
 * TruckZen — Original Design
 * Fleet page with server-side pagination
 */
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import SourceBadge from '@/components/ui/SourceBadge'
import OwnershipTypeBadge from '@/components/OwnershipTypeBadge'
import Pagination from '@/components/Pagination'

export default function FleetPage() {
  const supabase = createClient()
  const [assets, setAssets] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [unitTypeFilter, setUnitTypeFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [shopId, setShopId] = useState('')
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  async function fetchAssets(sid: string, p: number) {
    if (!sid) return
    setLoading(true)
    let url = `/api/assets?shop_id=${sid}&page=${p}&limit=25`
    if (ownerFilter !== 'all') url += `&ownership_type=${ownerFilter}`
    if (unitTypeFilter !== 'all') url += `&unit_type=${unitTypeFilter}`
    if (search) url += `&q=${encodeURIComponent(search)}`
    const res = await fetch(url)
    if (res.ok) {
      const json = await res.json()
      if (Array.isArray(json)) { setAssets(json); setTotal(json.length); setTotalPages(1) }
      else { setAssets(json.data || []); setTotal(json.total || 0); setTotalPages(json.totalPages || 1) }
    }
    setLoading(false)
  }

  useEffect(() => {
    getCurrentUser(supabase).then(async (p: any) => {
      if (!p) { window.location.href = '/login'; return }
      setShopId(p.shop_id)
      await fetchAssets(p.shop_id, 1)
    })
  }, [])

  useEffect(() => { if (shopId) fetchAssets(shopId, page) }, [page, ownerFilter, unitTypeFilter, shopId])

  useEffect(() => {
    if (!shopId) return
    if (searchTimer) clearTimeout(searchTimer)
    const t = setTimeout(() => { setPage(1); fetchAssets(shopId, 1) }, 400)
    setSearchTimer(t)
    return () => clearTimeout(t)
  }, [search])

  const OWNER_LABELS: Record<string, string> = { fleet_asset: 'Fleet Asset', owner_operator: 'Owner Operator', outside_customer: 'Outside Customer' }
  const statusColor: Record<string, string> = { active: '#1DB870', inactive: '#7C8BA0', in_shop: '#4D9EFF', decommissioned: '#D94F4F' }

  return (
    <div style={{ background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: "'Instrument Sans',sans-serif", padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF' }}>Fleet</div>
          <div style={{ fontSize: 12, color: '#7C8BA0' }}>{total.toLocaleString()} vehicles</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search unit, make, customer..." style={{ padding: '7px 12px', background: '#1C2130', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, color: '#DDE3EE', fontSize: 11, fontFamily: 'inherit', outline: 'none', width: 220 }} />
          <button onClick={() => window.location.href = '/fleet/new'} style={{ padding: '7px 14px', background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add Vehicle</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[['all', 'All'], ['fleet_asset', 'Fleet Asset'], ['owner_operator', 'Owner Operator'], ['outside_customer', 'Outside Customer']].map(([v, l]) => (
          <button key={v} onClick={() => { setOwnerFilter(v); setPage(1) }} style={{ padding: '5px 12px', borderRadius: 100, border: ownerFilter === v ? '1px solid rgba(29,111,232,.3)' : '1px solid rgba(255,255,255,.08)', background: ownerFilter === v ? 'rgba(29,111,232,.1)' : 'transparent', color: ownerFilter === v ? '#4D9EFF' : '#7C8BA0', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>
        ))}
      </div>

      <div style={{ background: '#161B24', border: '1px solid rgba(255,255,255,.055)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead><tr>{['Unit #', 'Year', 'Make / Model', 'VIN', 'Odometer', 'Ownership', 'Owner', 'Status'].map(h =>
              <th key={h} style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.1em', padding: '7px 10px', textAlign: 'left', background: '#0B0D11', whiteSpace: 'nowrap' }}>{h}</th>
            )}</tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#7C8BA0' }}>Loading...</td></tr>
              : assets.length === 0 ? <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#7C8BA0' }}>No vehicles found</td></tr>
              : assets.map(a => (
                <tr key={a.id} style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,.025)' }} onClick={() => window.location.href = '/fleet/' + a.id}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.03)')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <td style={{ padding: '9px 10px', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: '#4D9EFF', fontWeight: 700 }}>{a.unit_number} <SourceBadge source={a.source} /></td>
                  <td style={{ padding: '9px 10px', fontSize: 11, color: '#7C8BA0' }}>{a.year || '—'}</td>
                  <td style={{ padding: '9px 10px', fontSize: 12, color: '#F0F4FF', fontWeight: 600 }}>{a.make || '—'} {a.model || ''}</td>
                  <td style={{ padding: '9px 10px', fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: '#48536A' }}>{a.vin || '—'}</td>
                  <td style={{ padding: '9px 10px', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: '#DDE3EE' }}>{a.odometer?.toLocaleString() || '—'}</td>
                  <td style={{ padding: '9px 10px' }}><OwnershipTypeBadge type={a.ownership_type} size="sm" dark /></td>
                  <td style={{ padding: '9px 10px', fontSize: 11, color: '#DDE3EE' }}>{(a.customers as any)?.company_name || '—'}</td>
                  <td style={{ padding: '9px 10px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 100, fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, background: (statusColor[a.status] || '#7C8BA0') + '18', color: statusColor[a.status] || '#7C8BA0', border: '1px solid ' + (statusColor[a.status] || '#7C8BA0') + '33' }}>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor' }} />{(a.status || 'active').replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={page} totalPages={totalPages} total={total} label="vehicles" onPageChange={setPage} />
    </div>
  )
}
