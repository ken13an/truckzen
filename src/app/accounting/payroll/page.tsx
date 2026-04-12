'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { ACCOUNTING_ROLES } from '@/lib/roles'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Inter', -apple-system, sans-serif"
const BLUE = '#1D6FE8', GREEN = '#16A34A', AMBER = '#D97706'

const PAY_TYPE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  hourly:           { label: 'Hourly',     bg: '#EFF6FF', color: '#1D6FE8' },
  weekly_salary:    { label: 'Weekly',     bg: '#F0FDF4', color: '#16A34A' },
  biweekly_salary:  { label: 'Bi-Weekly',  bg: '#F5F3FF', color: '#7C3AED' },
  monthly_salary:   { label: 'Monthly',    bg: '#FFFBEB', color: '#D97706' },
}

function calcWeeklyCost(p: any): number {
  if (!p) return 0
  switch (p.pay_type) {
    case 'hourly': return (p.hourly_rate || 0) * (p.weekly_hours || 40)
    case 'weekly_salary': return p.salary_amount || 0
    case 'biweekly_salary': return (p.salary_amount || 0) / 2
    case 'monthly_salary': return (p.salary_amount || 0) * 12 / 52
    default: return 0
  }
}

export default function PayrollPage() {
  const { tokens: t } = useTheme()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState({ pay_type: 'hourly', hourly_rate: '0', salary_amount: '0', weekly_hours: '40', effective_date: '', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getCurrentUser(supabase).then(async (p: any) => {
      if (!p) { window.location.href = '/login'; return }
      if (!ACCOUNTING_ROLES.includes(p.role)) { window.location.href = '/dashboard'; return }
      setUser(p)
      const res = await fetch(`/api/accounting/payroll?shop_id=${p.shop_id}`)
      if (res.ok) setData(await res.json())
      setLoading(false)
    })
  }, [])

  const filtered = data.filter(e => {
    if (search) { const q = search.toLowerCase(); if (!(e.full_name || '').toLowerCase().includes(q)) return false }
    if (filter === 'hourly') return e.payroll?.pay_type === 'hourly'
    if (filter === 'salaried') return e.payroll && e.payroll.pay_type !== 'hourly'
    return true
  })

  const totalWeekly = filtered.reduce((s: number, e: any) => s + calcWeeklyCost(e.payroll), 0)
  const hourlyCount = filtered.filter(e => e.payroll?.pay_type === 'hourly').length
  const salariedCount = filtered.filter(e => e.payroll && e.payroll.pay_type !== 'hourly').length

  async function save(userId: string) {
    setSaving(true)
    await fetch('/api/accounting/payroll', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shop_id: user.shop_id, user_id: userId, ...form }) })
    const res = await fetch(`/api/accounting/payroll?shop_id=${user.shop_id}`)
    if (res.ok) setData(await res.json())
    setEditing(null); setSaving(false)
  }

  if (loading) return <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textSecondary, fontFamily: FONT }}>Loading...</div>

  return (
    <div style={{ minHeight: '100vh', background: t.bg, color: t.text, fontFamily: FONT, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>Payroll</h1>
          <p style={{ fontSize: 13, color: t.textSecondary, margin: 0 }}>Employee compensation and pay rates</p>
        </div>
        <a href="/accounting/payroll/punch-report" style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(29,111,232,.1)', border: `1px solid ${BLUE}33`, color: BLUE, fontSize: 12, fontWeight: 700, textDecoration: 'none', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 6 }}>
          Punch Report →
        </a>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Total Employees', value: String(filtered.length), color: BLUE },
          { label: 'Est. Weekly Payroll', value: '$' + totalWeekly.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','), color: GREEN },
          { label: 'Hourly Staff', value: String(hourlyCount), color: BLUE },
          { label: 'Salaried Staff', value: String(salariedCount), color: AMBER },
        ].map(c => (
          <div key={c.label} style={{ background: '#151520', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee..." style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: '#151520', color: t.text, fontSize: 13, fontFamily: FONT, outline: 'none', width: 220 }} />
        {['all', 'hourly', 'salaried'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: filter === f ? `1px solid ${BLUE}` : '1px solid rgba(255,255,255,0.08)', background: filter === f ? 'rgba(29,111,232,.1)' : 'transparent', color: filter === f ? '#4D9EFF' : t.textSecondary, fontFamily: FONT, textTransform: 'capitalize' }}>{f}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#151520', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Employee', 'Role', 'Pay Type', 'Rate', 'Est. Weekly Cost', 'Shift Hrs', 'Job Hrs', 'Actions'].map(h => (
              <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#12121A' }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {filtered.map(e => {
              const p = e.payroll
              const isEditing = editing === e.id
              const badge = p ? PAY_TYPE_BADGE[p.pay_type] || PAY_TYPE_BADGE.hourly : null
              const weekly = calcWeeklyCost(p)

              if (isEditing) {
                return (
                  <tr key={e.id} style={{ background: 'rgba(29,111,232,0.04)' }}>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: t.text, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{e.full_name}</td>
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: t.border, color: t.textSecondary, textTransform: 'capitalize' }}>{e.role?.replace(/_/g, ' ')}</span>
                    </td>
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <select value={form.pay_type} onChange={ev => setForm(f => ({ ...f, pay_type: ev.target.value }))} style={{ padding: '4px 8px', borderRadius: 6, background: t.inputBg, border: '1px solid rgba(255,255,255,0.08)', color: t.text, fontSize: 12, fontFamily: FONT }}>
                        <option value="hourly">Hourly</option>
                        <option value="weekly_salary">Weekly Salary</option>
                        <option value="biweekly_salary">Bi-Weekly Salary</option>
                        <option value="monthly_salary">Monthly Salary</option>
                      </select>
                    </td>
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      {form.pay_type === 'hourly' ? (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <span style={{ color: t.textSecondary, fontSize: 12 }}>$</span>
                          <input value={form.hourly_rate} onChange={ev => setForm(f => ({ ...f, hourly_rate: ev.target.value }))} style={{ width: 70, padding: '4px 6px', borderRadius: 6, background: t.inputBg, border: '1px solid rgba(255,255,255,0.08)', color: t.text, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", textAlign: 'right' as const }} />
                          <span style={{ color: t.textSecondary, fontSize: 11 }}>/hr x</span>
                          <input value={form.weekly_hours} onChange={ev => setForm(f => ({ ...f, weekly_hours: ev.target.value }))} style={{ width: 40, padding: '4px 6px', borderRadius: 6, background: t.inputBg, border: '1px solid rgba(255,255,255,0.08)', color: t.text, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", textAlign: 'right' as const }} />
                          <span style={{ color: t.textSecondary, fontSize: 11 }}>hrs</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <span style={{ color: t.textSecondary, fontSize: 12 }}>$</span>
                          <input value={form.salary_amount} onChange={ev => setForm(f => ({ ...f, salary_amount: ev.target.value }))} style={{ width: 90, padding: '4px 6px', borderRadius: 6, background: t.inputBg, border: '1px solid rgba(255,255,255,0.08)', color: t.text, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", textAlign: 'right' as const }} />
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }} />
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => save(e.id)} disabled={saving} style={{ padding: '4px 12px', borderRadius: 6, background: BLUE, color: '#fff', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>{saving ? '...' : 'Save'}</button>
                        <button onClick={() => setEditing(null)} style={{ padding: '4px 12px', borderRadius: 6, background: 'transparent', color: t.textSecondary, border: '1px solid rgba(255,255,255,0.08)', fontSize: 11, cursor: 'pointer', fontFamily: FONT }}>Cancel</button>
                      </div>
                    </td>
                  </tr>
                )
              }

              return (
                <tr key={e.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: t.text }}>{e.full_name || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: t.border, color: t.textSecondary, textTransform: 'capitalize' }}>{e.role?.replace(/_/g, ' ') || '—'}</span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {badge ? <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: badge.bg, color: badge.color }}>{badge.label}</span> : <span style={{ color: t.textTertiary, fontSize: 12 }}>Not Set</span>}
                  </td>
                  <td style={{ padding: '10px 14px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: p ? '#EDEDF0' : t.textTertiary }}>
                    {p ? (p.pay_type === 'hourly' ? `$${(p.hourly_rate || 0).toFixed(2)} / hr` : `$${(p.salary_amount || 0).toFixed(2)}`) : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 700, color: weekly > 0 ? BLUE : t.textTertiary }}>
                    {weekly > 0 ? '$' + weekly.toFixed(2) : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: t.text }}>
                    {e.punchStats?.minutes > 0 ? <><span style={{ fontWeight: 700 }}>{+(e.punchStats.minutes / 60).toFixed(1)}h</span> <span style={{ color: t.textSecondary, fontSize: 10 }}>({e.punchStats.count})</span></> : <span style={{ color: t.textTertiary }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 14px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: t.text }}>
                    {e.jobStats?.minutes > 0 ? <><span style={{ fontWeight: 700 }}>{+(e.jobStats.minutes / 60).toFixed(1)}h</span> <span style={{ color: t.textSecondary, fontSize: 10 }}>({e.jobStats.count})</span></> : <span style={{ color: t.textTertiary }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <button onClick={() => { setEditing(e.id); setForm(p ? { pay_type: p.pay_type, hourly_rate: String(p.hourly_rate || 0), salary_amount: String(p.salary_amount || 0), weekly_hours: String(p.weekly_hours || 40), effective_date: p.effective_date || '', notes: p.notes || '' } : { pay_type: 'hourly', hourly_rate: '0', salary_amount: '0', weekly_hours: '40', effective_date: '', notes: '' }) }}
                      style={{ padding: '4px 12px', borderRadius: 6, border: `1px solid ${p ? 'rgba(255,255,255,0.08)' : BLUE}`, background: p ? 'transparent' : 'rgba(29,111,232,.1)', color: p ? '#7C8BA0' : BLUE, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
                      {p ? 'Edit' : '+ Set Pay'}
                    </button>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: t.textTertiary, fontSize: 13 }}>No employees found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
