'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { MapPin, Search } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const BLUE = '#1B6EE6', GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F', MUTED = '#7C8BA0'

export default function FleetMapPage() {
  const { tokens: t } = useTheme()
  const supabase = createClient()
  const [vehicles, setVehicles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    getCurrentUser(supabase).then(async (p: any) => {
      if (!p) { window.location.href = '/login'; return }
      // Get latest location per vehicle
      const { data } = await supabase.from('maint_vehicle_locations')
        .select('asset_id, latitude, longitude, speed, address, recorded_at, assets(unit_number, make, model, vehicle_status)')
        .eq('shop_id', p.shop_id)
        .order('recorded_at', { ascending: false })
        .limit(200)
      // Deduplicate by asset_id (keep latest)
      const seen = new Set<string>()
      const unique = (data || []).filter((v: any) => { if (!v.asset_id || seen.has(v.asset_id)) return false; seen.add(v.asset_id); return true })
      setVehicles(unique)
      setLoading(false)
    })
  }, [])

  const filtered = vehicles.filter(v => {
    if (!search) return true
    const asset = v.assets || {}
    return `${asset.unit_number} ${asset.make} ${asset.model}`.toLowerCase().includes(search.toLowerCase())
  })

  function statusColor(v: any) {
    if (v.speed > 0) return GREEN
    const asset = v.assets || {}
    if (asset.vehicle_status === 'out_of_service') return RED
    const age = (Date.now() - new Date(v.recorded_at).getTime()) / 3600000
    if (age > 24) return MUTED
    return BLUE
  }

  return (
    <div style={{ background: t.bg, minHeight: '100vh', color: t.text, fontFamily: FONT, padding: 24 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: t.text, marginBottom: 16 }}>Fleet Map</div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, minHeight: 'calc(100vh - 120px)' }}>
        {/* Vehicle List */}
        <div style={{ background: t.bgCard, border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1C2130', borderRadius: 8, padding: '6px 10px' }}>
              <Search size={13} color={t.textTertiary} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search trucks..." style={{ background: 'none', border: 'none', color: t.text, fontSize: 12, outline: 'none', fontFamily: FONT, width: '100%' }} />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {loading ? <div style={{ padding: 20, textAlign: 'center', color: t.textTertiary, fontSize: 12 }}>Loading...</div> :
            filtered.length === 0 ? <div style={{ padding: 20, textAlign: 'center', color: t.textTertiary, fontSize: 12 }}>No vehicle locations yet. Connect Samsara to see live fleet tracking.</div> :
            filtered.map(v => {
              const asset = v.assets || {}
              const c = statusColor(v)
              return (
                <div key={v.asset_id} style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,.03)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>#{asset.unit_number || '—'} <span style={{ fontWeight: 400, color: MUTED }}>{asset.make} {asset.model}</span></div>
                    <div style={{ fontSize: 10, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.address || `${v.latitude?.toFixed(4)}, ${v.longitude?.toFixed(4)}`}</div>
                  </div>
                  <div style={{ fontSize: 9, color: MUTED, whiteSpace: 'nowrap' }}>{v.speed > 0 ? `${v.speed} mph` : new Date(v.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Map placeholder */}
        <div style={{ background: t.bgCard, border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <MapPin size={40} color={t.textTertiary} style={{ marginBottom: 12 }} />
          <div style={{ color: t.textTertiary, fontSize: 14, fontWeight: 600 }}>Fleet Map</div>
          <div style={{ color: t.textTertiary, fontSize: 12, marginTop: 4, maxWidth: 300, textAlign: 'center' }}>
            {vehicles.length === 0 ? 'No vehicle locations yet. Connect Samsara to see live fleet tracking.' : `${vehicles.length} vehicles with location data. Map visualization coming with Samsara integration.`}
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, marginTop: 20 }}>
            {[{ color: GREEN, label: 'Moving' }, { color: BLUE, label: 'Idle' }, { color: RED, label: 'Fault' }, { color: MUTED, label: 'No Signal' }].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: MUTED }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />{l.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
