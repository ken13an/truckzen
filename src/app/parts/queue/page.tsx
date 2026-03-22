/**
 * TruckZen — Original Design
 * Parts Queue — WOs needing parts department attention
 */
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const BLUE = '#4D9EFF', GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F', MUTED = '#7C8BA0'

export default function PartsQueuePage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [wos, setWos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(0)

  useEffect(() => {
    getCurrentUser(supabase).then(async (p) => {
      if (!p) { window.location.href = '/login'; return }
      setUser(p)
      // Fetch active WOs with their so_lines
      const { data } = await supabase
        .from('service_orders')
        .select('id, so_number, status, priority, created_at, assets(unit_number, year, make, model), customers(company_name), so_lines(id, line_type, description, parts_status, real_name, rough_name)')
        .eq('shop_id', p.shop_id)
        .or('is_historical.is.null,is_historical.eq.false')
        .not('status', 'in', '("good_to_go","void","done")')
        .order('created_at', { ascending: false })
        .limit(100)
      setWos(data || [])
      setLoading(false)
    })
  }, [])

  // Categorize WOs
  const needsParts = wos.filter(wo => {
    const parts = (wo.so_lines || []).filter((l: any) => l.line_type === 'part')
    return parts.some((l: any) => l.parts_status === 'rough' || (!l.real_name && l.rough_name))
  })
  const onOrder = wos.filter(wo => {
    const parts = (wo.so_lines || []).filter((l: any) => l.line_type === 'part')
    return parts.some((l: any) => l.parts_status === 'ordered') && !parts.some((l: any) => l.parts_status === 'rough')
  })
  const ready = wos.filter(wo => {
    const lines = (wo.so_lines || []).filter((l: any) => l.line_type === 'part')
    return lines.length > 0 && lines.every((l: any) => ['received', 'installed'].includes(l.parts_status) || !l.rough_name)
  })

  const tabs = [
    { label: 'Needs Parts', count: needsParts.length, data: needsParts, color: RED },
    { label: 'On Order', count: onOrder.length, data: onOrder, color: AMBER },
    { label: 'Ready', count: ready.length, data: ready, color: GREEN },
  ]

  function getPartsProgress(wo: any) {
    const parts = (wo.so_lines || []).filter((l: any) => l.line_type === 'part')
    if (parts.length === 0) return null
    const sourced = parts.filter((l: any) => l.real_name).length
    return { total: parts.length, sourced }
  }

  if (loading) return <div style={{ background: '#060708', minHeight: '100vh', color: MUTED, fontFamily: FONT, padding: 40, textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: FONT, padding: 24 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF', marginBottom: 4 }}>Parts Queue</div>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 20 }}>Work orders needing parts department attention</div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,.08)', marginBottom: 20 }}>
        {tabs.map((t, i) => (
          <button key={t.label} onClick={() => setTab(i)} style={{
            padding: '10px 18px', fontSize: 12, fontWeight: tab === i ? 700 : 400,
            color: tab === i ? t.color : MUTED, background: 'none', border: 'none',
            borderBottom: tab === i ? `2px solid ${t.color}` : '2px solid transparent',
            cursor: 'pointer', fontFamily: FONT,
          }}>
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* WO Cards */}
      {tabs[tab].data.length === 0 ? (
        <div style={{ background: '#161B24', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: 40, textAlign: 'center', color: MUTED, fontSize: 13 }}>
          No work orders in this category
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tabs[tab].data.map((wo: any) => {
            const asset = wo.assets || {}
            const cust = wo.customers || {}
            const progress = getPartsProgress(wo)
            return (
              <a key={wo.id} href={`/work-orders/${wo.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ background: '#161B24', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: 14, cursor: 'pointer', transition: 'all .12s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#1C2130')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#161B24')}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: BLUE }}>{wo.so_number || '—'}</span>
                        {wo.priority === 'high' || wo.priority === 'critical' ? (
                          <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: 'rgba(217,79,79,.12)', color: RED, textTransform: 'uppercase' }}>{wo.priority}</span>
                        ) : null}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F4FF' }}>
                        #{asset.unit_number || '—'} {[asset.year, asset.make, asset.model].filter(Boolean).join(' ')}
                      </div>
                      <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{cust.company_name || '—'}</div>
                    </div>
                    {progress && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: progress.sourced === progress.total ? GREEN : AMBER, fontWeight: 600 }}>
                          {progress.sourced} of {progress.total} sourced
                        </div>
                        <div style={{ width: 80, height: 4, background: 'rgba(255,255,255,.08)', borderRadius: 2, marginTop: 4 }}>
                          <div style={{ width: `${(progress.sourced / progress.total) * 100}%`, height: '100%', background: progress.sourced === progress.total ? GREEN : AMBER, borderRadius: 2 }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
