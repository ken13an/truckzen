'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { ACCOUNTING_ROLES } from '@/lib/roles'
import { PageFooter } from '@/components/ui/PageControls'
import FilterBar from '@/components/FilterBar'
import { useTheme } from '@/hooks/useTheme'
import { getWorkorderRoute } from '@/lib/navigation/workorder-route'

const FONT = "'Inter', -apple-system, sans-serif"

const TABS = ['Pending Review', 'Sent / Unpaid', 'Paid', 'All']

export default function AccountingPage() {
  const { tokens: t } = useTheme()
  const BLUE = t.accent, GREEN = '#16A34A', RED = '#DC2626', AMBER = '#D97706', GRAY = t.textLightSecondary

  const INVOICE_STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
    draft:                { label: 'Draft',            bg: '#F3F4F6', color: GRAY },
    quality_check_failed: { label: 'QC Failed',        bg: '#FEF2F2', color: RED },
    accounting_review:    { label: 'Pending Review',   bg: '#FFFBEB', color: AMBER },
    sent:                 { label: 'Sent',             bg: '#EFF6FF', color: BLUE },
    paid:                 { label: 'Paid',             bg: '#F0FDF4', color: GREEN },
    closed:               { label: 'Closed',           bg: '#F3F4F6', color: GRAY },
  }

  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [tab, setTab] = useState(0)
  const [wos, setWos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [acctPage, setAcctPage] = useState(1)
  const [acctPerPage, setAcctPerPage] = useState(25)
  const [acctSearch, setAcctSearch] = useState('')
  const [acctDateFrom, setAcctDateFrom] = useState('')
  const [acctDateTo, setAcctDateTo] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const profile = await getCurrentUser(supabase)
    if (!profile) { window.location.href = '/login'; return }
    const effectiveRole = profile.impersonate_role || profile.role
    if (!ACCOUNTING_ROLES.includes(effectiveRole) && !profile.is_platform_owner) { window.location.href = '/dashboard'; return }
    setUser(profile)

    // Direct client-side query — same auth session, no server-side API dependency
    const { data, error } = await supabase
      .from('service_orders')
      .select('id, so_number, status, invoice_status, complaint, grand_total, created_at, updated_at, accounting_notes, accounting_approved_at, accounting_approved_by, invoices(id, invoice_number), customers(id, company_name, contact_name), assets(id, unit_number, year, make, model)')
      .eq('shop_id', profile.shop_id)
      .is('deleted_at', null)
      .neq('status', 'void')
      .not('so_number', 'like', 'DRAFT-%')
      .neq('is_historical', true)
      .neq('source', 'fullbay')
      .in('invoice_status', ['accounting_review', 'pending_accounting', 'sent', 'paid', 'closed', 'quality_check_failed'])
      .order('updated_at', { ascending: false })
      .limit(200)

    setWos(error ? [] : (data || []))
    setLoading(false)
  }


  const filteredWos = useMemo(() => {
    let list = wos.filter(wo => {
      if (tab === 0) return ['accounting_review', 'pending_accounting', 'quality_check_failed'].includes(wo.invoice_status)
      if (tab === 1) return wo.invoice_status === 'sent'
      if (tab === 2) return ['paid', 'closed'].includes(wo.invoice_status)
      return true
    })
    if (acctSearch.trim()) {
      const q = acctSearch.toLowerCase()
      list = list.filter(wo => {
        const cust = wo.customers as any
        return wo.so_number?.toLowerCase().includes(q) ||
          cust?.company_name?.toLowerCase().includes(q) ||
          (wo.assets as any)?.unit_number?.toLowerCase().includes(q)
      })
    }
    if (acctDateFrom) {
      const from = new Date(acctDateFrom)
      list = list.filter(wo => (wo.created_at || wo.updated_at) && new Date(wo.created_at || wo.updated_at) >= from)
    }
    if (acctDateTo) {
      const to = new Date(acctDateTo + 'T23:59:59')
      list = list.filter(wo => (wo.created_at || wo.updated_at) && new Date(wo.created_at || wo.updated_at) <= to)
    }
    return list
  }, [wos, tab, acctSearch, acctDateFrom, acctDateTo])

  const paginatedWos = useMemo(() => {
    if (acctPerPage === 0) return filteredWos
    const start = (acctPage - 1) * acctPerPage
    return filteredWos.slice(start, start + acctPerPage)
  }, [filteredWos, acctPage, acctPerPage])

  const fmt = (n: number) => '$' + (n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const fmtDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
    catch { return d }
  }

  const S = {
    page: { fontFamily: FONT, background: t.bg, minHeight: '100vh', color: t.text, padding: 24 } as React.CSSProperties,
    card: { background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, marginBottom: 12 } as React.CSSProperties,
    label: { fontSize: 10, fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase' as const, letterSpacing: '.04em' } as React.CSSProperties,
    pill: (bg: string, color: string): React.CSSProperties => ({ display: 'inline-flex', padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: bg, color }),
    btn: (bg: string, color: string, outline?: boolean): React.CSSProperties => ({
      padding: '9px 20px', background: outline ? 'transparent' : bg, color,
      border: outline ? `1px solid ${color}` : 'none',
      borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
    }),
    input: { width: '100%', padding: '9px 12px', background: t.border, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 13, color: t.text, outline: 'none', fontFamily: FONT, boxSizing: 'border-box' as const, minHeight: 80, resize: 'vertical' as const } as React.CSSProperties,
  }

  if (loading) {
    return <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><div style={{ color: t.textSecondary }}>Loading...</div></div>
  }

  // Main list view
  return (
    <div style={S.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>Invoice Review Queue</div>
          <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 4 }}>
            {wos.length > 0 ? `${wos.length} work order${wos.length !== 1 ? 's' : ''} in queue` : 'No work orders in accounting queue'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${t.border}`, marginBottom: 20 }}>
        {TABS.map((tt, i) => (
          <button key={tt} onClick={() => setTab(i)} style={{
            padding: '10px 20px', background: 'transparent', border: 'none',
            borderBottom: tab === i ? `2px solid ${BLUE}` : '2px solid transparent',
            color: tab === i ? t.text : t.textSecondary, fontWeight: tab === i ? 700 : 500,
            fontSize: 13, cursor: 'pointer', fontFamily: FONT,
          }}>
            {tt}
            {i === 0 && (() => { const c = wos.filter(w => ['accounting_review', 'pending_accounting', 'quality_check_failed'].includes(w.invoice_status)).length; return c > 0 ? ` (${c})` : '' })()}
          </button>
        ))}
      </div>

      {/* FilterBar */}
      <FilterBar
        search={acctSearch}
        onSearchChange={val => { setAcctSearch(val); setAcctPage(1) }}
        searchPlaceholder="Search WO #, customer, unit..."
        dateFrom={acctDateFrom}
        dateTo={acctDateTo}
        onDateFromChange={val => { setAcctDateFrom(val); setAcctPage(1) }}
        onDateToChange={val => { setAcctDateTo(val); setAcctPage(1) }}
        theme="dark"
      />

      {/* WO Cards */}
      {filteredWos.length === 0 && (
        <div style={{ ...S.card, textAlign: 'center', color: t.textSecondary, padding: 40 }}>
          {acctSearch || acctDateFrom || acctDateTo ? 'No results found. Try adjusting your filters.' : tab === 0 ? 'No work orders pending review' : tab === 1 ? 'No approved invoices' : 'No work orders found'}
        </div>
      )}
      {paginatedWos.map(wo => {
        const st = INVOICE_STATUS_MAP[wo.invoice_status] || INVOICE_STATUS_MAP.draft
        const customer = wo.customers as any
        const asset = wo.assets as any
        return (
          <div key={wo.id} style={{ ...S.card, cursor: 'pointer' }} onClick={() => window.location.href = getWorkorderRoute(wo.id)}
            onMouseEnter={e => (e.currentTarget.style.borderColor = t.border)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = t.border)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{wo.so_number}</span>
                  <span style={S.pill(st.bg, st.color)}>{st.label}</span>
                </div>
                <div style={{ fontSize: 13, color: t.text }}>{customer?.company_name || 'No customer'}</div>
                {asset && <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>Unit #{asset.unit_number} {[asset.year, asset.make, asset.model].filter(Boolean).join(' ')}</div>}
                {wo.accounting_notes && <div style={{ fontSize: 12, color: AMBER, marginTop: 4 }}>Notes: {wo.accounting_notes}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{fmt(wo.grand_total || 0)}</div>
                <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 2 }}>{fmtDate(wo.updated_at || wo.created_at)}</div>
              </div>
            </div>
            {wo.invoice_status === 'accounting_review' && (
              <div style={{ marginTop: 10 }}>
                <button style={{ ...S.btn(BLUE, t.bgLight), fontSize: 12, padding: '6px 14px' }}>Review</button>
              </div>
            )}
          </div>
        )
      })}
      <PageFooter total={filteredWos.length} page={acctPage} perPage={acctPerPage} onPageChange={setAcctPage} onPerPageChange={setAcctPerPage} />
    </div>
  )
}
