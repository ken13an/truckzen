/**
 * TruckZen — Original Design
 * Universal DataTable — ALWAYS includes pagination. No exceptions.
 * Every future list page uses this component.
 */
'use client'
import { useEffect, useState, useRef } from 'react'
import Pagination from '@/components/Pagination'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"

interface Column {
  key: string
  label: string
  render?: (row: any) => React.ReactNode
  style?: React.CSSProperties
  headerStyle?: React.CSSProperties
}

interface DataTableProps {
  columns: Column[]
  fetchData: (page: number, limit: number, search: string) => Promise<{ data: any[]; total: number; totalPages?: number }>
  label: string
  perPage?: number
  searchPlaceholder?: string
  onRowClick?: (row: any) => void
  emptyMessage?: string
  headerActions?: React.ReactNode
  externalSearch?: string
  externalFilter?: string
  externalDateFrom?: string
  externalDateTo?: string
}

export default function DataTable({
  columns, fetchData, label, perPage = 25, searchPlaceholder = 'Search...',
  onRowClick, emptyMessage = 'No data found', headerActions,
  externalSearch, externalFilter, externalDateFrom, externalDateTo,
}: DataTableProps) {
  const [data, setData] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const didMount = useRef(false)

  async function load(p: number, q: string) {
    setLoading(true)
    try {
      const result = await fetchData(p, perPage, q)
      setData(result.data || [])
      setTotal(result.total || 0)
      setTotalPages(result.totalPages || Math.ceil((result.total || 0) / perPage))
    } catch { setData([]); setTotal(0); setTotalPages(0) }
    setLoading(false)
  }

  useEffect(() => { load(1, externalSearch || ''); didMount.current = true }, [])
  useEffect(() => { load(page, externalSearch || search) }, [page])
  useEffect(() => {
    if (!didMount.current) return
    setPage(1); load(1, externalSearch || search)
  }, [externalSearch, externalFilter, externalDateFrom, externalDateTo])

  function handleSearch(val: string) {
    setSearch(val)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => { setPage(1); load(1, val) }, 400)
  }

  return (
    <div>
      {/* Search + header actions — hidden when external FilterBar is used */}
      {externalSearch === undefined && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder={searchPlaceholder}
            style={{ padding: '7px 12px', background: '#1C2130', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, color: '#DDE3EE', fontSize: 12, fontFamily: FONT, outline: 'none', flex: 1, minWidth: 180, maxWidth: 300 }}
          />
          {headerActions}
        </div>
      )}
      {externalSearch !== undefined && headerActions && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {headerActions}
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#161B24', border: '1px solid rgba(255,255,255,.055)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col.key} style={{ fontFamily: MONO, fontSize: 8, color: '#48536A', textTransform: 'uppercase', letterSpacing: '.1em', padding: '7px 10px', textAlign: 'left', background: '#0B0D11', whiteSpace: 'nowrap', ...col.headerStyle }}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={columns.length} style={{ padding: 40, textAlign: 'center', color: '#7C8BA0', fontSize: 13 }}>Loading...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={columns.length} style={{ padding: 40, textAlign: 'center', color: '#7C8BA0', fontSize: 13 }}>{emptyMessage}</td></tr>
              ) : data.map((row, i) => (
                <tr key={row.id || i}
                  style={{ borderBottom: '1px solid rgba(255,255,255,.025)', cursor: onRowClick ? 'pointer' : 'default' }}
                  onClick={() => onRowClick?.(row)}
                  onMouseEnter={e => { if (onRowClick) (e.currentTarget.style.background = 'rgba(255,255,255,.03)') }}
                  onMouseLeave={e => { if (onRowClick) (e.currentTarget.style.background = '') }}>
                  {columns.map(col => (
                    <td key={col.key} style={{ padding: '9px 10px', fontSize: 12, color: '#DDE3EE', ...col.style }}>
                      {col.render ? col.render(row) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} label={label} onPageChange={setPage} />
    </div>
  )
}
