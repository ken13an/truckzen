/**
 * TruckZen — Original Design
 * Core Parts tracking — warranty cores lifecycle
 */
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { THEME } from '@/lib/config/colors'
import { useTheme } from '@/hooks/useTheme'
const _t = THEME.dark

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const BLUE = _t.accentLight, GREEN = _t.success, AMBER = _t.warning, RED = _t.danger, MUTED = _t.textSecondary

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  pending_removal: { label: 'Pending Removal', color: RED },
  removed: { label: 'Removed', color: AMBER },
  stored: { label: 'In Storage', color: BLUE },
  shipped: { label: 'Shipped', color: _t.aiPurple },
  credit_received: { label: 'Credit Received', color: GREEN },
}

export default function CorePartsPage() {
  const { tokens: t } = useTheme()
  const supabase = createClient()
  const [cores, setCores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(0)

  useEffect(() => {
    getCurrentUser(supabase).then(async (p) => {
      if (!p) { window.location.href = '/login'; return }
      const { data } = await supabase
        .from('core_parts')
        .select('*, service_orders(so_number, assets(unit_number))')
        .eq('shop_id', p.shop_id)
        .order('created_at', { ascending: false })
      setCores(data || [])
      setLoading(false)
    })
  }, [])

  const pending = cores.filter(c => ['pending_removal', 'removed'].includes(c.core_status))
  const stored = cores.filter(c => c.core_status === 'stored')
  const shipped = cores.filter(c => c.core_status === 'shipped')
  const completed = cores.filter(c => c.core_status === 'credit_received')
  const totalCredit = completed.reduce((s, c) => s + (parseFloat(c.credit_amount) || 0), 0)

  const tabs = [
    { label: 'Pending', count: pending.length, data: pending },
    { label: 'In Storage', count: stored.length, data: stored },
    { label: 'Shipped', count: shipped.length, data: shipped },
    { label: 'Completed', count: completed.length, data: completed },
  ]

  const fmt = (n: number) => '$' + (n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const daysSince = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000)

  if (loading) return <div style={{ background: t.bg, minHeight: '100vh', color: MUTED, fontFamily: FONT, padding: 40, textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ background: t.bg, minHeight: '100vh', color: t.text, fontFamily: FONT, padding: 24 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: t.text, marginBottom: 4 }}>Core Parts</div>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 16 }}>Warranty core tracking — removal, storage, shipping, credits</div>

      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Pending', value: String(pending.length), color: RED },
          { label: 'In Storage', value: String(stored.length), color: BLUE },
          { label: 'Shipped', value: String(shipped.length), color: t.aiPurple },
          { label: 'Recovered', value: fmt(totalCredit), color: GREEN },
        ].map(s => (
          <div key={s.label} style={{ background: t.bgCard, border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '10px 16px', flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: MONO, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,.08)', marginBottom: 20 }}>
        {tabs.map((t, i) => (
          <button key={t.label} onClick={() => setTab(i)} style={{
            padding: '10px 18px', fontSize: 12, fontWeight: tab === i ? 700 : 400,
            color: tab === i ? BLUE : MUTED, background: 'none', border: 'none',
            borderBottom: tab === i ? `2px solid ${BLUE}` : '2px solid transparent',
            cursor: 'pointer', fontFamily: FONT,
          }}>
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* Core list */}
      {tabs[tab].data.length === 0 ? (
        <div style={{ background: t.bgCard, border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: 40, textAlign: 'center', color: MUTED, fontSize: 13 }}>
          No core parts in this category
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tabs[tab].data.map((core: any) => {
            const st = STATUS_CFG[core.core_status] || STATUS_CFG.pending_removal
            const so = core.service_orders || {}
            const isOverdue = core.core_status === 'stored' && core.created_at && daysSince(core.created_at) > 30
            return (
              <div key={core.id} style={{ background: t.bgCard, border: `1px solid ${isOverdue ? 'rgba(217,79,79,.3)' : t.border}`, borderRadius: 12, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 2 }}>{core.core_part_name}</div>
                    <div style={{ fontSize: 11, color: MUTED }}>
                      New: {core.new_part_name}{core.new_part_number ? ` (${core.new_part_number})` : ''}
                    </div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                      WO {so.so_number || '—'} · #{so.assets?.unit_number || '—'}
                    </div>
                    {core.storage_location && <div style={{ fontSize: 10, color: t.textTertiary, marginTop: 2 }}>Storage: {core.storage_location}</div>}
                    {core.tracking_number && <div style={{ fontSize: 10, color: t.textTertiary, marginTop: 2 }}>Tracking: {core.tracking_number}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: `${st.color}18`, color: st.color, fontFamily: MONO, textTransform: 'uppercase' }}>{st.label}</span>
                    {core.created_at && <div style={{ fontSize: 10, color: isOverdue ? RED : t.textTertiary, marginTop: 4, fontWeight: isOverdue ? 700 : 400 }}>{daysSince(core.created_at)}d ago{isOverdue ? ' — OVERDUE' : ''}</div>}
                    {core.credit_amount && <div style={{ fontSize: 13, fontWeight: 700, color: GREEN, marginTop: 4 }}>{fmt(core.credit_amount)}</div>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
