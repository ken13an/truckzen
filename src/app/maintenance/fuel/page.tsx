'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import DataTable from '@/components/DataTable'
import { DollarSign, Gauge, Droplets, TrendingUp } from 'lucide-react'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const BLUE = '#1B6EE6', GREEN = '#1DB870', MUTED = '#7C8BA0'

export default function FuelPage() {
  const supabase = createClient()
  const [shopId, setShopId] = useState('')
  const [stats, setStats] = useState({ spend: 0, avgMpg: 0, gallons: 0, avgCpg: 0 })

  useEffect(() => {
    getCurrentUser(supabase).then(async (p: any) => {
      if (!p) { window.location.href = '/login'; return }
      setShopId(p.shop_id)
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
      const { data } = await supabase.from('maint_fuel_entries').select('total_cost, gallons, cost_per_gallon').eq('shop_id', p.shop_id).gte('fuel_date', monthStart)
      if (data && data.length > 0) {
        const spend = data.reduce((s: number, r: any) => s + (r.total_cost || 0), 0)
        const gal = data.reduce((s: number, r: any) => s + (r.gallons || 0), 0)
        const cpgs = data.filter((r: any) => r.cost_per_gallon).map((r: any) => r.cost_per_gallon)
        setStats({ spend, avgMpg: 0, gallons: gal, avgCpg: cpgs.length > 0 ? cpgs.reduce((a: number, b: number) => a + b, 0) / cpgs.length : 0 })
      }
    })
  }, [])

  if (!shopId) return <div style={{ background: '#060708', minHeight: '100vh', color: MUTED, fontFamily: FONT, padding: 40, textAlign: 'center' }}>Loading...</div>

  const cards = [
    { label: 'Spend This Month', value: `$${stats.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: DollarSign, color: BLUE },
    { label: 'Fleet Avg MPG', value: stats.avgMpg > 0 ? stats.avgMpg.toFixed(1) : '—', icon: TrendingUp, color: GREEN },
    { label: 'Gallons This Month', value: stats.gallons.toFixed(0), icon: Droplets, color: '#8B5CF6' },
    { label: 'Avg Cost/Gallon', value: stats.avgCpg > 0 ? `$${stats.avgCpg.toFixed(3)}` : '—', icon: Gauge, color: '#F59E0B' },
  ]

  return (
    <div style={{ background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: FONT, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF' }}>Fuel Entries</div>
        <a href="/maintenance/fuel/new" style={{ padding: '8px 16px', background: 'linear-gradient(135deg,#1B6EE6,#1248B0)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none', fontFamily: FONT }}>+ New</a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {cards.map(c => {
          const Icon = c.icon
          return (
            <div key={c.label} style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Icon size={13} color={c.color} />
                <span style={{ fontSize: 9, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: MONO }}>{c.label}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: c.color }}>{c.value}</div>
            </div>
          )
        })}
      </div>

      <DataTable
        columns={[
          { key: 'fuel_date', label: 'Date', render: (r: any) => r.fuel_date ? new Date(r.fuel_date).toLocaleDateString() : '—' },
          { key: 'location', label: 'Location' },
          { key: 'fuel_type', label: 'Type', render: (r: any) => <span style={{ textTransform: 'uppercase', fontSize: 10 }}>{r.fuel_type || 'diesel'}</span> },
          { key: 'gallons', label: 'Gallons', render: (r: any) => r.gallons?.toFixed(1) || '—' },
          { key: 'cost_per_gallon', label: 'PPG', render: (r: any) => r.cost_per_gallon ? `$${r.cost_per_gallon.toFixed(3)}` : '—' },
          { key: 'total_cost', label: 'Total', render: (r: any) => <span style={{ fontFamily: MONO, fontWeight: 700 }}>${(r.total_cost || 0).toFixed(2)}</span> },
          { key: 'odometer', label: 'Odometer', render: (r: any) => r.odometer?.toLocaleString() || '—' },
        ]}
        fetchData={async (page, limit, search) => {
          let url = `/api/maintenance/crud?table=maint_fuel_entries&shop_id=${shopId}&page=${page}&limit=${limit}&order_by=fuel_date&search_cols=location,notes`
          if (search) url += `&q=${encodeURIComponent(search)}`
          const res = await fetch(url)
          return res.ok ? res.json() : { data: [], total: 0 }
        }}
        label="fuel entries"
        searchPlaceholder="Search by location..."
        emptyMessage="No fuel entries yet. Data will appear here once imported or created."
      />
    </div>
  )
}
