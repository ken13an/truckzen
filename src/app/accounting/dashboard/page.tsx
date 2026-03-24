/**
 * TruckZen — Original Design
 * Accounting Dashboard — invoicing, revenue, outstanding
 */
'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"
const BLUE = '#1B6EE6', GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F', MUTED = '#7C8BA0'

export default function AccountingDashboard() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [readyToInvoice, setReadyToInvoice] = useState<any[]>([])
  const [outstanding, setOutstanding] = useState<any[]>([])
  const [stats, setStats] = useState({ readyCount: 0, revenue: 0, outstandingCount: 0, outstandingTotal: 0, avgWoValue: 0 })

  const loadData = useCallback(async (profile: any) => {
    const shopId = profile.shop_id
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)

    const [doneRes, gtagRes, outstRes, paidRes] = await Promise.all([
      fetch(`/api/service-orders?shop_id=${shopId}&status=done&limit=30`),
      fetch(`/api/service-orders?shop_id=${shopId}&status=good_to_go&limit=30`),
      fetch(`/api/invoices?status=sent`),
      fetch(`/api/invoices?status=paid`),
    ])

    const [doneData, gtagData, outstData, paidData] = await Promise.all([
      doneRes.ok ? doneRes.json() : [],
      gtagRes.ok ? gtagRes.json() : [],
      outstRes.ok ? outstRes.json() : [],
      paidRes.ok ? paidRes.json() : [],
    ])

    const ready = [...(doneData || []), ...(gtagData || [])]
    const outst = outstData || []
    const paidThisMonth = (paidData || []).filter((i: any) => i.paid_at && new Date(i.paid_at) >= monthStart)

    setReadyToInvoice(ready)
    setOutstanding(outst)
    const revenue = paidThisMonth.reduce((s: number, i: any) => s + (i.total || 0), 0)
    const outTotal = outst.reduce((s: number, i: any) => s + (i.balance_due || i.total || 0), 0)
    setStats({ readyCount: ready.length, revenue, outstandingCount: outst.length, outstandingTotal: outTotal, avgWoValue: ready.length > 0 ? ready.reduce((s: number, w: any) => s + (w.grand_total || 0), 0) / ready.length : 0 })
  }, [])

  useEffect(() => { getCurrentUser(supabase).then(async (p: any) => { if (!p) { window.location.href = '/login'; return }; setUser(p); await loadData(p); setLoading(false) }) }, [])
  useEffect(() => { if (!user) return; const iv = setInterval(() => loadData(user), 30000); return () => clearInterval(iv) }, [user])

  const fmt = (n: number) => '$' + (n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  const daysSince = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000)

  if (loading) return <div style={{ background: '#060708', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED }}>Loading...</div>

  return (
    <div style={{ background: '#060708', minHeight: '100vh', color: '#DDE3EE', fontFamily: FONT, padding: 24 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#F0F4FF', marginBottom: 20 }}>Accounting</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Ready to Invoice', value: String(stats.readyCount), color: AMBER },
          { label: 'Revenue This Month', value: fmt(stats.revenue), color: GREEN },
          { label: 'Outstanding', value: `${stats.outstandingCount} (${fmt(stats.outstandingTotal)})`, color: RED },
          { label: 'Avg WO Value', value: fmt(stats.avgWoValue), color: BLUE },
        ].map(s => (
          <div key={s.label} style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 10, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: MONO, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Ready to Invoice */}
      <div style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#F0F4FF', marginBottom: 12 }}>Ready to Invoice ({readyToInvoice.length})</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead><tr>{['WO #', 'Truck', 'Customer', 'Completed', 'Total'].map(h => <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 9, color: '#48536A', textTransform: 'uppercase', fontFamily: MONO, borderBottom: '1px solid rgba(255,255,255,.06)' }}>{h}</th>)}</tr></thead>
          <tbody>
            {readyToInvoice.map(wo => {
              const hrs = wo.completed_at ? daysSince(wo.completed_at) : 0
              return (
                <tr key={wo.id} style={{ borderBottom: '1px solid rgba(255,255,255,.03)', cursor: 'pointer', borderLeft: hrs > 1 ? `3px solid ${AMBER}` : 'none' }} onClick={() => window.location.href = `/work-orders/${wo.id}`}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.03)')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <td style={{ padding: '8px', fontFamily: MONO, color: BLUE, fontWeight: 700 }}>{wo.so_number}</td>
                  <td style={{ padding: '8px', color: '#F0F4FF' }}>#{(wo.assets as any)?.unit_number || '—'}</td>
                  <td style={{ padding: '8px', color: MUTED }}>{(wo.customers as any)?.company_name || '—'}</td>
                  <td style={{ padding: '8px', color: hrs > 1 ? AMBER : '#48536A', fontFamily: MONO, fontSize: 10 }}>{wo.completed_at ? `${hrs}d ago` : '—'}</td>
                  <td style={{ padding: '8px', fontWeight: 700, color: '#F0F4FF', fontFamily: MONO }}>{fmt(wo.grand_total)}</td>
                </tr>
              )
            })}
            {readyToInvoice.length === 0 && <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#48536A' }}>No WOs ready to invoice</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Outstanding */}
      <div style={{ background: '#0D0F12', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#F0F4FF', marginBottom: 12 }}>Outstanding Invoices ({outstanding.length})</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead><tr>{['Invoice #', 'Customer', 'Amount', 'Days'].map(h => <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 9, color: '#48536A', textTransform: 'uppercase', fontFamily: MONO, borderBottom: '1px solid rgba(255,255,255,.06)' }}>{h}</th>)}</tr></thead>
          <tbody>
            {outstanding.map(inv => {
              const days = daysSince(inv.created_at)
              const ageColor = days > 60 ? RED : days > 30 ? AMBER : MUTED
              return (
                <tr key={inv.id} style={{ borderBottom: '1px solid rgba(255,255,255,.03)', cursor: 'pointer' }} onClick={() => window.location.href = `/invoices/${inv.id}`}>
                  <td style={{ padding: '8px', fontFamily: MONO, color: BLUE }}>{inv.invoice_number}</td>
                  <td style={{ padding: '8px', color: MUTED }}>{(inv.customers as any)?.company_name || '—'}</td>
                  <td style={{ padding: '8px', fontWeight: 700, color: '#F0F4FF', fontFamily: MONO }}>{fmt(inv.balance_due || inv.total)}</td>
                  <td style={{ padding: '8px', color: ageColor, fontWeight: 700, fontFamily: MONO }}>{days}d</td>
                </tr>
              )
            })}
            {outstanding.length === 0 && <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: '#48536A' }}>No outstanding invoices</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
