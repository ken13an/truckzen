/**
 * TruckZen — Original Design
 * Platform Admin — AI Usage Dashboard
 */
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const BLUE = '#4D9EFF', GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F', MUTED = '#7C8BA0'

const FEATURE_LABELS: Record<string, string> = {
  wo_creation: 'WO Creation', parts_suggest: 'Parts Suggest', service_writer: 'Service Writer', ai_review: 'AI Review', other: 'Other',
}

export default function AIUsagePage() {
  const { tokens: t } = useTheme()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [usage, setUsage] = useState<any[]>([])
  const [shops, setShops] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedShop, setSelectedShop] = useState<string | null>(null)
  const [shopDetail, setShopDetail] = useState<any[]>([])

  useEffect(() => {
    getCurrentUser(supabase).then(async (u: any) => {
      if (!u) return
      setUser(u)
      const { data: po } = await supabase.from('users').select('is_platform_owner').eq('id', u.id).single()
      if (!po?.is_platform_owner) { window.location.href = '/dashboard'; return }

      const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)

      const [{ data: usageData }, { data: shopList }] = await Promise.all([
        supabase.from('ai_usage_log').select('shop_id, feature, tokens_in, tokens_out, estimated_cost, created_at').gte('created_at', startOfMonth.toISOString()).order('created_at', { ascending: false }),
        supabase.from('shops').select('id, name, ai_monthly_limit, ai_usage_enabled'),
      ])
      setUsage(usageData || [])
      setShops(shopList || [])
      setLoading(false)
    })
  }, [])

  // Aggregate stats
  const totalCalls = usage.length
  const totalCost = usage.reduce((s, u) => s + (parseFloat(u.estimated_cost) || 0), 0)
  const totalTokens = usage.reduce((s, u) => s + (u.tokens_in || 0) + (u.tokens_out || 0), 0)

  // Per-shop aggregation
  const shopUsage: Record<string, { calls: number; tokens: number; cost: number }> = {}
  for (const u of usage) {
    if (!shopUsage[u.shop_id]) shopUsage[u.shop_id] = { calls: 0, tokens: 0, cost: 0 }
    shopUsage[u.shop_id].calls++
    shopUsage[u.shop_id].tokens += (u.tokens_in || 0) + (u.tokens_out || 0)
    shopUsage[u.shop_id].cost += parseFloat(u.estimated_cost) || 0
  }

  const mostActiveShop = Object.entries(shopUsage).sort((a, b) => b[1].calls - a[1].calls)[0]
  const mostActiveShopName = mostActiveShop ? shops.find(s => s.id === mostActiveShop[0])?.name || '—' : '—'

  // By feature
  const byFeature: Record<string, number> = {}
  for (const u of usage) { byFeature[u.feature] = (byFeature[u.feature] || 0) + 1 }

  // Shop detail
  async function loadShopDetail(shopId: string) {
    setSelectedShop(shopId)
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)
    const { data } = await supabase.from('ai_usage_log').select('*').eq('shop_id', shopId).gte('created_at', startOfMonth.toISOString()).order('created_at', { ascending: false }).limit(50)
    setShopDetail(data || [])
  }

  const fmt = (n: number) => '$' + n.toFixed(4)

  if (loading) return <div style={{ color: MUTED, fontSize: 13, padding: 40 }}>Loading...</div>

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tz-text)', margin: '0 0 20px' }}>AI Usage</h1>

      {/* Overview cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Calls', value: totalCalls.toLocaleString(), color: BLUE },
          { label: 'Total Cost', value: fmt(totalCost), color: GREEN },
          { label: 'Most Active Shop', value: mostActiveShopName, color: AMBER },
          { label: 'Total Tokens', value: totalTokens.toLocaleString(), color: MUTED },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 10, color: 'var(--tz-textTertiary)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: MONO, marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* By feature breakdown */}
      <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tz-text)', marginBottom: 12 }}>Usage by Feature</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {Object.entries(byFeature).sort((a, b) => b[1] - a[1]).map(([feature, count]) => (
            <div key={feature} style={{ background: 'var(--tz-border)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 8, padding: '8px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: BLUE }}>{count}</div>
              <div style={{ fontSize: 10, color: MUTED }}>{FEATURE_LABELS[feature] || feature}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-shop table */}
      <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: 'var(--tz-text)' }}>Per-Shop Usage</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            {['Shop', 'Calls', 'Tokens', 'Cost', 'Limit', 'Usage %', 'Status'].map(h =>
              <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 9, color: 'var(--tz-textTertiary)', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: MONO, borderBottom: `1px solid ${'var(--tz-border)'}`, fontWeight: 600 }}>{h}</th>
            )}
          </tr></thead>
          <tbody>
            {shops.map(shop => {
              const su = shopUsage[shop.id] || { calls: 0, tokens: 0, cost: 0 }
              const limit = shop.ai_monthly_limit || 500
              const pct = Math.round((su.calls / limit) * 100)
              const statusColor = pct >= 90 ? RED : pct >= 70 ? AMBER : GREEN
              return (
                <tr key={shop.id} style={{ cursor: 'pointer', borderBottom: `1px solid ${'var(--tz-border)'}` }} onClick={() => loadShopDetail(shop.id)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--tz-border)')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: 'var(--tz-text)' }}>{shop.name}</td>
                  <td style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 12, color: BLUE }}>{su.calls}</td>
                  <td style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 11, color: MUTED }}>{su.tokens.toLocaleString()}</td>
                  <td style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 11, color: GREEN }}>{fmt(su.cost)}</td>
                  <td style={{ padding: '10px 12px', fontSize: 11, color: MUTED }}>{limit}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 60, height: 6, background: 'var(--tz-border)', borderRadius: 3 }}>
                        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: statusColor, borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 10, color: statusColor, fontWeight: 700 }}>{pct}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontSize: 9, fontWeight: 600, color: shop.ai_usage_enabled ? statusColor : 'var(--tz-textTertiary)', background: `${shop.ai_usage_enabled ? statusColor : 'var(--tz-textTertiary)'}18`, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>
                      {!shop.ai_usage_enabled ? 'Disabled' : pct >= 100 ? 'Limit Hit' : pct >= 90 ? 'Critical' : pct >= 70 ? 'Warning' : 'Normal'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Shop detail drill-down */}
      {selectedShop && (
        <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tz-text)' }}>
              Recent Calls — {shops.find(s => s.id === selectedShop)?.name}
            </div>
            <button onClick={() => setSelectedShop(null)} style={{ background: 'none', border: 'none', color: 'var(--tz-textTertiary)', fontSize: 11, cursor: 'pointer' }}>Close</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead><tr>
              {['Time', 'Feature', 'In', 'Out', 'Cost', 'Duration', 'Status'].map(h =>
                <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 8, color: 'var(--tz-textTertiary)', textTransform: 'uppercase', fontFamily: MONO, borderBottom: `1px solid ${'var(--tz-border)'}` }}>{h}</th>
              )}
            </tr></thead>
            <tbody>
              {shopDetail.map(d => (
                <tr key={d.id} style={{ borderBottom: `1px solid ${'var(--tz-border)'}` }}>
                  <td style={{ padding: '6px 8px', color: 'var(--tz-textTertiary)', fontFamily: MONO, fontSize: 10 }}>{new Date(d.created_at).toLocaleString()}</td>
                  <td style={{ padding: '6px 8px', color: BLUE, fontSize: 10 }}>{FEATURE_LABELS[d.feature] || d.feature}</td>
                  <td style={{ padding: '6px 8px', fontFamily: MONO, color: MUTED }}>{d.tokens_in || d.input_tokens || 0}</td>
                  <td style={{ padding: '6px 8px', fontFamily: MONO, color: MUTED }}>{d.tokens_out || d.output_tokens || 0}</td>
                  <td style={{ padding: '6px 8px', fontFamily: MONO, color: GREEN }}>{fmt(parseFloat(d.estimated_cost) || 0)}</td>
                  <td style={{ padding: '6px 8px', fontFamily: MONO, color: MUTED }}>{d.request_duration_ms ? `${d.request_duration_ms}ms` : '—'}</td>
                  <td style={{ padding: '6px 8px' }}>
                    <span style={{ fontSize: 8, fontWeight: 600, color: d.success ? GREEN : RED }}>{d.success ? 'OK' : 'FAIL'}</span>
                  </td>
                </tr>
              ))}
              {shopDetail.length === 0 && <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: 'var(--tz-textTertiary)' }}>No AI calls this month</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
