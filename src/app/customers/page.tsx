'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import ExcelJS from 'exceljs'
import { PageFooter } from '@/components/ui/PageControls'
import SourceBadge from '@/components/ui/SourceBadge'
import FilterBar from '@/components/FilterBar'
import { useTheme } from '@/hooks/useTheme'

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
  const { tokens: t } = useTheme()
  const supabase = createClient()
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [activeCount, setActiveCount] = useState(0)
  const [inactiveCount, setInactiveCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
  const [shopId, setShopId] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  const fetchCustomers = async (sid: string, p: number) => {
    if (!sid) return
    setLoading(true)
    setError('')
    try {
      let url = `/api/customers?shop_id=${sid}&page=${p}&per_page=${perPage}`
      if (search) url += `&q=${encodeURIComponent(search)}`
      if (statusFilter !== 'all') url += `&status=${statusFilter}`
      if (dateFrom) url += `&date_from=${dateFrom}`
      if (dateTo) url += `&date_to=${dateTo}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to load customers')
      const json = await res.json()
      setCustomers(json.data || [])
      setTotal(json.total || 0)
      setActiveCount(json.active_count || 0)
      setInactiveCount(json.inactive_count || 0)
    } catch (err: any) {
      setError(err.message || 'Failed to load customers')
    }
    setLoading(false)
  }

  useEffect(() => {
    getCurrentUser(supabase).then((p: any) => {
      if (!p) { window.location.href = '/login'; return }
      setShopId(p.shop_id)
      fetchCustomers(p.shop_id, 1)
    })
  }, [])

  // Re-fetch when page, status filter, or date filters change
  useEffect(() => {
    if (!shopId) return
    fetchCustomers(shopId, page)
  }, [page, statusFilter, dateFrom, dateTo, perPage])

  // Debounced search
  useEffect(() => {
    if (!shopId) return
    if (searchTimer) clearTimeout(searchTimer)
    const t = setTimeout(() => { setPage(1); fetchCustomers(shopId, 1) }, 400)
    setSearchTimer(t)
    return () => clearTimeout(t)
  }, [search])




  async function bulkFleetUpload() {
    const wb = new ExcelJS.Workbook()
    const BLUE = '1B6EE6'
    const GRAY_TEXT: Partial<ExcelJS.Font> = { color: { argb: '999999' }, italic: true }
    const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
    const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFF' }, size: 11 }
    const THIN_BORDER: Partial<ExcelJS.Borders> = { top: { style: 'thin', color: { argb: 'E5E7EB' } }, bottom: { style: 'thin', color: { argb: 'E5E7EB' } }, left: { style: 'thin', color: { argb: 'E5E7EB' } }, right: { style: 'thin', color: { argb: 'E5E7EB' } } }

    function styleHeaders(ws: ExcelJS.Worksheet, count: number) {
      const row = ws.getRow(1)
      row.eachCell((cell) => { cell.fill = HEADER_FILL; cell.font = HEADER_FONT; cell.alignment = { vertical: 'middle' } })
      row.height = 24
      ws.views = [{ state: 'frozen', ySplit: 1 }]
      ws.autoFilter = { from: 'A1', to: String.fromCharCode(64 + count) + '1' }
    }

    function addBorders(ws: ExcelJS.Worksheet, startRow: number, endRow: number, cols: number) {
      for (let r = startRow; r <= endRow; r++) {
        const row = ws.getRow(r)
        for (let c = 1; c <= cols; c++) { row.getCell(c).border = THIN_BORDER }
      }
    }

    // ── SHEET 1: Companies ──
    const s1 = wb.addWorksheet('Companies')
    const s1Headers = ['Company Name', 'Parent / Holding Company', 'DOT Number', 'MC Number', 'Address', 'City', 'State', 'ZIP', 'Contact Name', 'Contact Phone', 'Contact Email', 'Contact Role', 'Total Units', 'Payment Terms', 'Notes']
    s1.addRow(s1Headers)
    s1.addRow(['ABC Trucking LLC', 'National Transport Holdings', '1234567', 'MC-987654', '123 Industrial Blvd', 'Chicago', 'IL', '60601', 'John Smith', '(312) 555-0100', 'john@abctrucking.com', 'Fleet Manager', '85', 'Net 30', 'Part of National Transport Holdings group'])
    s1.getRow(2).eachCell(c => { c.font = GRAY_TEXT })
    for (let i = 0; i < 50; i++) s1.addRow([])
    s1.columns = [{ width: 30 }, { width: 30 }, { width: 18 }, { width: 18 }, { width: 35 }, { width: 20 }, { width: 10 }, { width: 12 }, { width: 25 }, { width: 18 }, { width: 30 }, { width: 18 }, { width: 12 }, { width: 18 }, { width: 30 }]
    styleHeaders(s1, 15)
    addBorders(s1, 2, 52, 15)

    // ── SHEET 2: Trucks & Trailers ──
    const s2 = wb.addWorksheet('Trucks & Trailers')
    const s2Headers = ['Company Name', 'Unit Number', 'VIN', 'Unit Type', 'Year', 'Make', 'Model', 'Engine Make', 'Engine Model', 'Transmission', 'Current Mileage', 'License Plate', 'License State', 'Color', 'Status', 'Notes']
    s2.addRow(s2Headers)
    const examples = [
      ['ABC Trucking LLC', 'T-001', '1XKAD49X04J012345', 'TRACTOR', '2022', 'Peterbilt', '579', 'Cummins', 'X15', 'Eaton Fuller 18spd', '485000', 'IL-T001', 'IL', 'White', 'Active', ''],
      ['ABC Trucking LLC', 'T-002', '4V4NC9EJ5GN567890', 'TRACTOR', '2023', 'Volvo', 'VNL860', 'Volvo', 'D13', 'Volvo I-Shift 12spd', '312000', 'IL-T002', 'IL', 'Blue', 'Active', ''],
      ['XYZ Freight Inc', 'XYZ-100', '1FDJU6H61LHA11111', 'TRACTOR', '2021', 'Freightliner', 'Cascadia', 'Detroit', 'DD15', 'Detroit DT12', '621000', 'TX-100', 'TX', 'Red', 'Active', 'Part of National Transport Holdings'],
      ['Midwest Haulers Co', 'MH-500', '1XKWDP9X8NJ22222', 'TRACTOR', '2024', 'Kenworth', 'T680', 'PACCAR', 'MX-13', 'Eaton Fuller 10spd', '98000', 'OH-500', 'OH', 'Silver', 'Active', ''],
      ['ABC Trucking LLC', 'TR-050', '1JJV532D4KL333333', 'TRAILER', '2020', 'Great Dane', 'Everest SS', '', '', '', '0', 'IL-TR50', 'IL', 'White', 'Active', '53ft Dry Van'],
    ]
    for (const ex of examples) { const r = s2.addRow(ex); r.eachCell(c => { c.font = GRAY_TEXT }) }
    for (let i = 0; i < 1500; i++) s2.addRow([])
    s2.columns = [{ width: 30 }, { width: 15 }, { width: 22 }, { width: 15 }, { width: 10 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 16 }, { width: 15 }, { width: 14 }, { width: 12 }, { width: 14 }, { width: 30 }]
    styleHeaders(s2, 16)
    addBorders(s2, 2, 1506, 16)
    // Data validations
    for (let r = 7; r <= 1506; r++) {
      s2.getCell(`D${r}`).dataValidation = { type: 'list', formulae: ['"TRACTOR,TRAILER,STRAIGHT TRUCK,BOX TRUCK,REEFER,FLATBED,TANKER,OTHER"'], showErrorMessage: true }
      s2.getCell(`F${r}`).dataValidation = { type: 'list', formulae: ['"Freightliner,Kenworth,Peterbilt,Volvo,Mack,International,Western Star,Navistar,Hino,Isuzu,Great Dane,Wabash,Utility Trailer,Hyundai Translead,Stoughton,Vanguard,OTHER"'], showErrorMessage: true }
      s2.getCell(`O${r}`).dataValidation = { type: 'list', formulae: ['"Active,In Shop,Out of Service,Parked,Sold"'], showErrorMessage: true }
    }

    // ── SHEET 3: Owners & Contacts ──
    const s3 = wb.addWorksheet('Owners & Contacts')
    s3.addRow(['Company Name', 'Full Name', 'Phone', 'Email', 'Role', 'CDL Number', 'CDL Expiry', 'Notes'])
    const contactExamples = [
      ['ABC Trucking LLC', 'John Smith', '(312) 555-0100', 'john@abctrucking.com', 'Fleet Manager', '', '', 'Primary contact'],
      ['ABC Trucking LLC', 'Maria Garcia', '(312) 555-0101', 'maria@abctrucking.com', 'Dispatcher', '', '', ''],
      ['XYZ Freight Inc', 'Bob Johnson', '(214) 555-0200', 'bob@xyzfreight.com', 'Owner', 'TX12345678', '2027-06-15', ''],
    ]
    for (const ex of contactExamples) { const r = s3.addRow(ex); r.eachCell(c => { c.font = GRAY_TEXT }) }
    for (let i = 0; i < 200; i++) s3.addRow([])
    s3.columns = [{ width: 30 }, { width: 25 }, { width: 18 }, { width: 30 }, { width: 18 }, { width: 20 }, { width: 15 }, { width: 30 }]
    styleHeaders(s3, 8)
    addBorders(s3, 2, 204, 8)

    // ── DOWNLOAD ──
    const buf = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'TruckZen_Bulk_Fleet_Upload.xlsx'
    a.click()
    URL.revokeObjectURL(url)
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
        background: isActive ? 'rgba(34,197,94,0.12)' : t.border,
        color: isActive ? '#4ADE80' : t.textLightSecondary,
        whiteSpace: 'nowrap',
      }}>
        {isActive ? 'Active' : 'Inactive'}
      </span>
    )
  }

  return (
    <div style={{
      background: t.bg,
      minHeight: '100vh',
      color: t.text,
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
            color: t.text,
            margin: 0,
            lineHeight: 1.2,
          }}>
            Customers
          </h1>
          <div style={{ fontSize: 13, color: t.textLightSecondary, marginTop: 4 }}>
            {total.toLocaleString()} customers
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={bulkFleetUpload}
            style={{
              padding: '8px 14px',
              background: 'transparent',
              border: '1px solid rgba(29,111,232,0.3)',
              borderRadius: 8,
              color: t.accent,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Fleet Onboarding Form
          </button>
          <button
            onClick={() => router.push('/customers/new')}
            style={{
              padding: '8px 16px',
              background: t.accent,
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

      {/* FilterBar */}
      <FilterBar
        search={search}
        onSearchChange={val => { setSearch(val) }}
        searchPlaceholder="Search by company name, DOT#, phone, or contact..."
        statusOptions={[
          { value: 'all', label: `All (${(activeCount + inactiveCount).toLocaleString()})` },
          { value: 'active', label: `Active (${activeCount})` },
          { value: 'inactive', label: `Inactive (${inactiveCount})` },
        ]}
        statusValue={statusFilter}
        onStatusChange={val => { setStatusFilter(val as FilterStatus); setPage(1) }}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={val => { setDateFrom(val); setPage(1) }}
        onDateToChange={val => { setDateTo(val); setPage(1) }}
        theme="dark"
      />

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
        border: `1px solid ${t.bgActive}`,
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
                    color: t.textLightSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    padding: '10px 14px',
                    textAlign: 'left',
                    background: '#12121A',
                    whiteSpace: 'nowrap',
                    borderBottom: `1px solid ${t.border}`,
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
                  <td colSpan={6} style={{ textAlign: 'center', color: t.textLightSecondary, padding: 48, fontSize: 13 }}>
                    Loading...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: t.textLightSecondary, padding: 48, fontSize: 13 }}>
                    {search || statusFilter !== 'all' || dateFrom || dateTo ? 'No results found. Try adjusting your filters.' : 'No customers found'}
                  </td>
                </tr>
              ) : customers.map(c => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/customers/${c.id}`)}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <td style={{
                    padding: '11px 14px',
                    borderBottom: `1px solid ${t.bgHover}`,
                    fontSize: 13,
                    fontWeight: 600,
                    color: t.accent,
                  }}>
                    {c.company_name || 'Unnamed'} <SourceBadge source={c.source} />
                  </td>
                  <td style={{
                    padding: '11px 14px',
                    borderBottom: `1px solid ${t.bgHover}`,
                    fontSize: 13,
                    fontFamily: "'IBM Plex Mono', monospace",
                    color: '#9CA3AF',
                  }}>
                    {c.dot_number || '—'}
                  </td>
                  <td style={{
                    padding: '11px 14px',
                    borderBottom: `1px solid ${t.bgHover}`,
                    fontSize: 13,
                    color: '#9CA3AF',
                  }}>
                    {c.phone || '—'}
                  </td>
                  <td style={{
                    padding: '11px 14px',
                    borderBottom: `1px solid ${t.bgHover}`,
                    fontSize: 13,
                  }}>
                    {paymentBadge(c.payment_terms)}
                  </td>
                  <td style={{
                    padding: '11px 14px',
                    borderBottom: `1px solid ${t.bgHover}`,
                    fontSize: 13,
                  }}>
                    {statusBadge(c.customer_status)}
                  </td>
                  <td style={{
                    padding: '11px 14px',
                    borderBottom: `1px solid ${t.bgHover}`,
                    fontSize: 13,
                    color: t.textLightSecondary,
                  }}>
                    {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <PageFooter total={total} page={page} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage} />
    </div>
  )
}
