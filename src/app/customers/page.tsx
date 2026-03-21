'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Download } from 'lucide-react'
import * as XLSX from 'xlsx'

type Customer = {
  id: string
  company_name: string | null
  contact_name: string | null
  dot_number: string | null
  phone: string | null
  email: string | null
  payment_terms: string | null
  customer_status: string | null
  created_at: string | null
  [key: string]: any
}

type FilterStatus = 'all' | 'active' | 'inactive'

export default function CustomersPage() {
  const supabase = createClient()
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
  const [shopId, setShopId] = useState('')

  useEffect(() => {
    getCurrentUser(supabase).then((p: any) => {
      if (!p) { window.location.href = '/login'; return }
      setShopId(p.shop_id)
      fetch(`/api/customers?shop_id=${p.shop_id}&per_page=500`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to load customers')
          return res.json()
        })
        .then(data => {
          setCustomers(data.data || [])
          setLoading(false)
        })
        .catch(err => {
          setError(err.message || 'Failed to load customers')
          setLoading(false)
        })
    })
  }, [])

  const filtered = useMemo(() => {
    let list = customers

    if (statusFilter !== 'all') {
      list = list.filter(c => {
        const s = (c.customer_status || 'active').toLowerCase()
        return s === statusFilter
      })
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim()
      list = list.filter(c =>
        (c.company_name || '').toLowerCase().includes(q) ||
        (c.dot_number || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.contact_name || '').toLowerCase().includes(q)
      )
    }

    return list
  }, [customers, search, statusFilter])

  const activeCount = useMemo(() => customers.filter(c => (c.customer_status || 'active').toLowerCase() === 'active').length, [customers])
  const inactiveCount = useMemo(() => customers.filter(c => (c.customer_status || 'active').toLowerCase() === 'inactive').length, [customers])

  function handleDownloadForm() {
    window.open(`/api/documents/registration-form?shop_id=${shopId}`, '_blank')
  }

  function exportExcel() {
    if (filtered.length === 0) return
    const headers = ['Company Name', 'DOT #', 'Phone', 'Contact', 'Email', 'Payment Terms', 'Status', 'Created']
    const rows = filtered.map(c => [
      c.company_name || '',
      c.dot_number || '',
      c.phone || '',
      c.contact_name || '',
      c.email || '',
      c.payment_terms || '',
      c.customer_status || '',
      c.created_at ? new Date(c.created_at).toLocaleDateString() : '',
    ])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    // Set column widths
    ws['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 16 }, { wch: 20 }, { wch: 28 }, { wch: 14 }, { wch: 10 }, { wch: 12 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Customers')
    XLSX.writeFile(wb, `customers-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  function exportOnboardingTemplate() {
    const wb = XLSX.utils.book_new()
    const today = new Date().toISOString().split('T')[0]

    // Sheet 1: Company Details
    const companyHeaders = ['Company Name', 'DOT #', 'MC #', 'Phone', 'Contact Name', 'Contact Email', 'Address', 'City', 'State', 'ZIP', 'Payment Terms', 'Tax ID / FEIN']
    const companyData = filtered.map(c => [
      c.company_name || '', c.dot_number || '', '', c.phone || '', c.contact_name || '',
      c.email || '', '', '', '', '', c.payment_terms || '', '',
    ])
    const ws1 = XLSX.utils.aoa_to_sheet([companyHeaders, ...companyData])
    ws1['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 20 }, { wch: 28 }, { wch: 30 }, { wch: 16 }, { wch: 8 }, { wch: 10 }, { wch: 14 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, ws1, 'Companies')

    // Sheet 2: Trucks & Trailers Template
    const unitHeaders = ['Unit #', 'Type', 'Year', 'Make', 'Model', 'VIN', 'License Plate', 'State', 'Ownership', 'Current Mileage', 'Engine Make', 'Notes']
    const exampleRow = ['T-001', 'TRACTOR', '2022', 'Peterbilt', '579', '1XPWD49X82D123456', 'IL-2022-TZ', 'IL', 'Owned', '187000', 'Cummins X15', 'Example row — delete this']
    const emptyRows: string[][] = Array.from({ length: 100 }, () => Array(12).fill(''))
    const ws2 = XLSX.utils.aoa_to_sheet([unitHeaders, exampleRow, ...emptyRows])
    ws2['!cols'] = [{ wch: 10 }, { wch: 10 }, { wch: 6 }, { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 14 }, { wch: 6 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 28 }]
    // Freeze header row
    ws2['!freeze'] = { xSplit: 0, ySplit: 1 }

    XLSX.utils.book_append_sheet(wb, ws2, 'Trucks & Trailers')

    XLSX.writeFile(wb, `TruckZen_Onboarding_Template_${today}.xlsx`)
  }

  function paymentBadge(terms: string | null) {
    const t = (terms || '').toLowerCase()
    let bg = 'rgba(255,255,255,0.06)'
    let color = '#8A8F9E'
    let label = terms || '—'

    if (t === 'cod') {
      bg = 'rgba(239,68,68,0.12)'
      color = '#F87171'
      label = 'COD'
    } else if (t === 'net15' || t === 'net_15') {
      bg = 'rgba(245,158,11,0.12)'
      color = '#FBBF24'
      label = 'Net 15'
    } else if (t === 'net30' || t === 'net_30') {
      bg = 'rgba(29,111,232,0.12)'
      color = '#60A5FA'
      label = 'Net 30'
    }

    return (
      <span style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: bg,
        color: color,
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
    )
  }

  function statusBadge(status: string | null) {
    const s = (status || 'active').toLowerCase()
    const isActive = s === 'active'
    return (
      <span style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: isActive ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)',
        color: isActive ? '#4ADE80' : '#6B7280',
        whiteSpace: 'nowrap',
      }}>
        {isActive ? 'Active' : 'Inactive'}
      </span>
    )
  }

  const filterPills: { key: FilterStatus; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: customers.length },
    { key: 'active', label: 'Active', count: activeCount },
    { key: 'inactive', label: 'Inactive', count: inactiveCount },
  ]

  return (
    <div style={{
      background: '#0C0C12',
      minHeight: '100vh',
      color: '#EDEDF0',
      fontFamily: "'Inter', sans-serif",
      padding: 24,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 24,
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div>
          <h1 style={{
            fontSize: 24,
            fontWeight: 700,
            color: '#EDEDF0',
            margin: 0,
            lineHeight: 1.2,
          }}>
            Customers
          </h1>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
            {filtered.length} of {customers.length} customers
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={exportExcel}
            style={{
              padding: '8px 12px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
              color: '#9CA3AF',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Export Excel
          </button>
          <button
            onClick={exportOnboardingTemplate}
            style={{
              padding: '8px 12px',
              background: 'transparent',
              border: '1px solid rgba(29,111,232,0.3)',
              borderRadius: 8,
              color: '#1D6FE8',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Onboarding Template
          </button>
          <button
            onClick={handleDownloadForm}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
              color: '#EDEDF0',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            <Download size={14} />
            Download Form
          </button>
          <button
            onClick={() => router.push('/customers/new')}
            style={{
              padding: '8px 16px',
              background: '#1D6FE8',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            + New Customer
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by company name, DOT#, phone, or contact..."
          style={{
            width: '100%',
            padding: '10px 14px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            color: '#EDEDF0',
            fontSize: 13,
            fontFamily: "'Inter', sans-serif",
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {filterPills.map(pill => {
          const active = statusFilter === pill.key
          return (
            <button
              key={pill.key}
              onClick={() => setStatusFilter(pill.key)}
              style={{
                padding: '6px 14px',
                borderRadius: 999,
                border: active ? '1px solid rgba(29,111,232,0.4)' : '1px solid rgba(255,255,255,0.08)',
                background: active ? 'rgba(29,111,232,0.12)' : 'transparent',
                color: active ? '#60A5FA' : '#6B7280',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {pill.label} ({pill.count})
            </button>
          )
        })}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
          fontSize: 13,
          color: '#EF4444',
        }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{
        background: '#151520',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr>
                {['Company Name', 'DOT #', 'Phone', 'Payment Terms', 'Status', 'Last Visit'].map(h => (
                  <th key={h} style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 10,
                    color: '#6B7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    padding: '10px 14px',
                    textAlign: 'left',
                    background: '#12121A',
                    whiteSpace: 'nowrap',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    fontWeight: 500,
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: '#6B7280', padding: 48, fontSize: 13 }}>
                    Loading...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: '#6B7280', padding: 48, fontSize: 13 }}>
                    {search || statusFilter !== 'all' ? 'No customers match your filters' : 'No customers found'}
                  </td>
                </tr>
              ) : filtered.map(c => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/customers/${c.id}`)}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <td style={{
                    padding: '11px 14px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#1D6FE8',
                  }}>
                    {c.company_name || 'Unnamed'}
                  </td>
                  <td style={{
                    padding: '11px 14px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    fontSize: 13,
                    fontFamily: "'IBM Plex Mono', monospace",
                    color: '#9CA3AF',
                  }}>
                    {c.dot_number || '—'}
                  </td>
                  <td style={{
                    padding: '11px 14px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    fontSize: 13,
                    color: '#9CA3AF',
                  }}>
                    {c.phone || '—'}
                  </td>
                  <td style={{
                    padding: '11px 14px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    fontSize: 13,
                  }}>
                    {paymentBadge(c.payment_terms)}
                  </td>
                  <td style={{
                    padding: '11px 14px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    fontSize: 13,
                  }}>
                    {statusBadge(c.customer_status)}
                  </td>
                  <td style={{
                    padding: '11px 14px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    fontSize: 13,
                    color: '#6B7280',
                  }}>
                    {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
