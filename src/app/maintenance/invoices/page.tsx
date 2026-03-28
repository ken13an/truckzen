'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { FileText, ChevronRight, Clock, CheckCircle2 } from 'lucide-react'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const BLUE = '#1B6EE6', GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F', MUTED = '#7C8BA0'

type Tab = 'unpaid' | 'paid'

const STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: MUTED },
  accounting_review: { label: 'Accounting Review', color: BLUE },
  sent: { label: 'Sent', color: BLUE },
  paid: { label: 'Paid', color: GREEN },
  closed: { label: 'Closed', color: GREEN },
}

export default function MaintenanceInvoicesPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [wos, setWos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('unpaid')

  const loadData = useCallback(async (shopId: string) => {
    // Fetch WOs that have invoice activity and are for maintained units (fleet/owner-op)
    const { data } = await supabase
      .from('service_orders')
      .select(`
        id, so_number, status, invoice_status, complaint, grand_total, labor_total, parts_total,
        created_at, closed_at,
        assets!inner(id, unit_number, make, model, year, ownership_type),
        customers(id, company_name)
      `)
      .eq('shop_id', shopId)
      .is('deleted_at', null)
      .in('assets.ownership_type', ['fleet_asset', 'owner_operator'])
      .not('invoice_status', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200)

    setWos(data || [])
  }, [supabase])

  useEffect(() => {
    getCurrentUser(supabase).then(async (p: any) => {
      if (!p) { window.location.href = '/login'; return }
      setUser(p)
      await loadData(p.shop_id)
      setLoading(false)
    })
  }, [])

  const fmt = (n: number | null | undefined) => n != null ? '$' + Number(n).toFixed(2) : '$0.00'

  const unpaid = wos.filter(w => !['paid', 'closed'].includes(w.invoice_status))
  const paid = wos.filter(w => ['paid', 'closed'].includes(w.invoice_status))
  const display = tab === 'unpaid' ? unpaid : paid

  if (loading) return <div style={{ background: '#060708', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontFamily: FONT }}>Loading...</div>

  return (
    <div style={{ background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: FONT, padding: 24 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF', marginBottom: 4 }}>Maintenance Invoices</div>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 20 }}>Invoices for fleet and owner-operator units maintained by your team</div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <div style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: 10, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: MONO, marginBottom: 6 }}>Unpaid</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: AMBER }}>{unpaid.length}</div>
        </div>
        <div style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: 10, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: MONO, marginBottom: 6 }}>Paid</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: GREEN }}>{paid.length}</div>
        </div>
        <div style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: 10, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: MONO, marginBottom: 6 }}>Total Outstanding</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: RED }}>{fmt(unpaid.reduce((s, w) => s + (w.grand_total || 0), 0))}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        {(['unpaid', 'paid'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 20px', background: 'none', border: 'none',
            color: tab === t ? BLUE : MUTED, fontFamily: FONT, fontSize: 13, fontWeight: 700,
            cursor: 'pointer', borderBottom: tab === t ? `2px solid ${BLUE}` : '2px solid transparent',
            textTransform: 'uppercase', letterSpacing: '.04em',
          }}>
            {t === 'unpaid' ? `Unpaid (${unpaid.length})` : `Paid (${paid.length})`}
          </button>
        ))}
      </div>

      {/* Invoice List */}
      <div style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12 }}>
        {display.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#48536A', fontSize: 13 }}>
            {tab === 'unpaid' ? 'No unpaid invoices for maintained units' : 'No paid invoices yet'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['WO #', 'Unit', 'Customer', 'Status', 'Labor', 'Parts', 'Total', ''].map(h => (
                  <th key={h} style={{ textAlign: h === 'Total' || h === 'Labor' || h === 'Parts' ? 'right' : 'left', padding: '10px 12px', fontSize: 9, color: '#48536A', textTransform: 'uppercase', fontFamily: MONO, borderBottom: '1px solid rgba(255,255,255,.06)', letterSpacing: '.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {display.map((w: any) => {
                const asset = w.assets as any
                const cust = w.customers as any
                const st = STATUS_DISPLAY[w.invoice_status] || STATUS_DISPLAY.draft
                return (
                  <tr key={w.id} style={{ borderBottom: '1px solid rgba(255,255,255,.03)', cursor: 'pointer' }} onClick={() => window.location.href = `/work-orders/${w.id}`}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={{ padding: '10px 12px', fontFamily: MONO, color: BLUE, fontWeight: 700 }}>{w.so_number}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontWeight: 600 }}>#{asset?.unit_number}</span>
                      <span style={{ color: MUTED, marginLeft: 6, fontSize: 11 }}>{[asset?.year, asset?.make].filter(Boolean).join(' ')}</span>
                      {asset?.ownership_type === 'owner_operator' && (
                        <span style={{ marginLeft: 6, fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(245,158,11,.1)', color: AMBER, fontWeight: 600 }}>O/O</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', color: MUTED }}>{cust?.company_name || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: st.color, background: `${st.color}18`, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' }}>{st.label}</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: MONO, color: MUTED }}>{fmt(w.labor_total)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: MONO, color: MUTED }}>{fmt(w.parts_total)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: MONO, fontWeight: 700, color: tab === 'paid' ? GREEN : '#F0F4FF' }}>{fmt(w.grand_total)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <ChevronRight size={14} color={MUTED} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
