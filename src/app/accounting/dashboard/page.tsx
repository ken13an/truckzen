/**
 * TruckZen — Original Design
 * Accounting Dashboard — invoicing, revenue, outstanding, paid
 * Uses /api/accounting (service_orders with invoice_status) as single truth source
 */
'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const BLUE = '#1B6EE6', GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F', MUTED = '#7C8BA0'

type Tab = 'ready' | 'sent' | 'paid'

export default function AccountingDashboard() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [wos, setWos] = useState<any[]>([])
  const [tab, setTab] = useState<Tab>('ready')

  const loadData = useCallback(async (profile: any) => {
    // Single truth source: /api/accounting queries service_orders with invoice_status
    const res = await fetch(`/api/accounting?shop_id=${profile.shop_id}`)
    const data = res.ok ? await res.json() : []
    setWos(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => {
    getCurrentUser(supabase).then(async (p: any) => {
      if (!p) { window.location.href = '/login'; return }
      setUser(p)
      await loadData(p)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!user) return
    const iv = setInterval(() => loadData(user), 30000)
    return () => clearInterval(iv)
  }, [user])

  const ready = wos.filter(w => ['accounting_review', 'quality_check_failed', 'draft'].includes(w.invoice_status))
  const sent = wos.filter(w => w.invoice_status === 'sent')
  const paid = wos.filter(w => ['paid', 'closed'].includes(w.invoice_status))

  const readyTotal = ready.reduce((s: number, w: any) => s + (w.grand_total || 0), 0)
  const sentTotal = sent.reduce((s: number, w: any) => s + (w.grand_total || 0), 0)
  const paidTotal = paid.reduce((s: number, w: any) => s + (w.grand_total || 0), 0)

  const fmt = (n: number) => '$' + (n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) } catch { return '—' } }
  const daysSince = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000)

  const TABS: { key: Tab; label: string; count: number; total: number; color: string }[] = [
    { key: 'ready', label: 'Ready to Invoice', count: ready.length, total: readyTotal, color: AMBER },
    { key: 'sent', label: 'Sent / Unpaid', count: sent.length, total: sentTotal, color: BLUE },
    { key: 'paid', label: 'Paid', count: paid.length, total: paidTotal, color: GREEN },
  ]

  const current = tab === 'ready' ? ready : tab === 'sent' ? sent : paid

  if (loading) return <div style={{ background: '#060708', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED }}>Loading...</div>

  return (
    <div style={{ background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: FONT, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF' }}>Accounting</div>
        <a href="/accounting" style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(29,111,232,.08)', border: '1px solid rgba(29,111,232,.2)', color: BLUE, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
          Review Queue →
        </a>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {TABS.map(t => (
          <div key={t.key} onClick={() => setTab(t.key)}
            style={{ background: tab === t.key ? '#151520' : '#0D0F12', border: `1px solid ${tab === t.key ? t.color + '40' : 'rgba(255,255,255,.08)'}`, borderRadius: 12, padding: '16px 18px', cursor: 'pointer', transition: 'border-color .15s' }}>
            <div style={{ fontSize: 10, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: MONO, marginBottom: 6 }}>{t.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: t.color }}>{t.count}</div>
            <div style={{ fontSize: 12, color: MUTED, fontFamily: MONO, marginTop: 2 }}>{fmt(t.total)}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#F0F4FF', marginBottom: 12 }}>
          {TABS.find(t => t.key === tab)?.label} ({current.length})
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {['WO #', 'Truck', 'Customer', 'Date', 'Total'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 9, color: '#48536A', textTransform: 'uppercase', fontFamily: MONO, borderBottom: '1px solid rgba(255,255,255,.06)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {current.map(wo => {
              const days = daysSince(wo.updated_at || wo.created_at)
              const ageColor = tab === 'sent' ? (days > 60 ? RED : days > 30 ? AMBER : MUTED) : MUTED
              return (
                <tr key={wo.id} style={{ borderBottom: '1px solid rgba(255,255,255,.03)', cursor: 'pointer' }}
                  onClick={() => window.location.href = `/work-orders/${wo.id}`}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <td style={{ padding: '8px', fontFamily: MONO, color: BLUE, fontWeight: 700 }}>{wo.so_number}</td>
                  <td style={{ padding: '8px', color: '#F0F4FF' }}>#{(wo.assets as any)?.unit_number || '—'}</td>
                  <td style={{ padding: '8px', color: MUTED }}>{(wo.customers as any)?.company_name || '—'}</td>
                  <td style={{ padding: '8px', color: ageColor, fontFamily: MONO, fontSize: 10 }}>{fmtDate(wo.updated_at || wo.created_at)}{tab === 'sent' && days > 0 ? ` (${days}d)` : ''}</td>
                  <td style={{ padding: '8px', fontWeight: 700, color: '#F0F4FF', fontFamily: MONO }}>{fmt(wo.grand_total)}</td>
                </tr>
              )
            })}
            {current.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#48536A' }}>
                {tab === 'ready' ? 'No WOs ready to invoice' : tab === 'sent' ? 'No outstanding invoices' : 'No paid invoices'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
