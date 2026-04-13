/**
 * TruckZen — Original Design
 * Maintenance Service Requests
 */
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import Pagination from '@/components/Pagination'
import { useTheme } from '@/hooks/useTheme'

const URGENCY: Record<string, { label: string; color: string; bg: string }> = {
  low:      { label: 'LOW',      color: '#48536A', bg: 'rgba(72,83,106,.1)' },
  normal:   { label: 'NORMAL',   color: '#7C8BA0', bg: 'rgba(124,139,160,.1)' },
  high:     { label: 'HIGH',     color: '#D4882A', bg: 'rgba(212,136,42,.12)' },
  critical: { label: 'CRITICAL', color: '#D94F4F', bg: 'rgba(217,79,79,.12)' },
}

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: 'PENDING',     color: '#F59E0B', bg: 'rgba(245,158,11,.12)' },
  approved:    { label: 'APPROVED',    color: '#22C55E', bg: 'rgba(34,197,94,.12)' },
  in_progress: { label: 'IN PROGRESS', color: '#4D9EFF', bg: 'rgba(29,111,232,.12)' },
  completed:   { label: 'COMPLETED',   color: '#48536A', bg: 'rgba(72,83,106,.1)' },
  rejected:    { label: 'REJECTED',    color: '#D94F4F', bg: 'rgba(217,79,79,.12)' },
}

export default function MaintenanceServiceRequestsPage() {
  const { tokens: t } = useTheme()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const perPage = 25

  useEffect(() => {
    async function load() {
      const u = await getCurrentUser(supabase)
      if (!u) return
      setUser(u)

      const from = (page - 1) * perPage
      const to = from + perPage - 1

      const { data, count } = await supabase
        .from('service_requests')
        .select('*', { count: 'exact' })
        .eq('shop_id', u.shop_id)
        .in('source', ['maintenance', 'fleet'])
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(from, to)

      setRequests(data || [])
      setTotal(count || 0)
      setLoading(false)
    }
    load()
  }, [page])

  if (!user) return null

  return (
    <div style={{ padding: 32, maxWidth: 1200, background: 'var(--tz-bg)', minHeight: '100vh', color: 'var(--tz-text)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tz-text)', margin: 0 }}>Service Requests</h1>
          <p style={{ fontSize: 13, color: 'var(--tz-textSecondary)', margin: '4px 0 0' }}>Maintenance department service requests</p>
        </div>
        <a href="/service-requests/new" style={{
          background: '#F59E0B', color: 'var(--tz-bgInput)', padding: '8px 16px', borderRadius: 8,
          fontSize: 13, fontWeight: 600, textDecoration: 'none',
        }}>+ New Request</a>
      </div>

      {loading ? (
        <p style={{ color: 'var(--tz-textSecondary)' }}>Loading...</p>
      ) : requests.length === 0 ? (
        <p style={{ color: 'var(--tz-textSecondary)' }}>No service requests found.</p>
      ) : (
        <>
          <div style={{ background: 'var(--tz-bgCard)', borderRadius: 12, border: `1px solid ${'var(--tz-border)'}`, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${'var(--tz-border)'}` }}>
                  {['Request', 'Unit', 'Urgency', 'Status', 'Created'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', fontSize: 10, fontWeight: 700, color: 'var(--tz-textTertiary)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.map(r => {
                  const urg = URGENCY[r.urgency] || URGENCY.normal
                  const st = STATUS[r.status] || STATUS.pending
                  return (
                    <tr key={r.id} style={{ borderBottom: `1px solid ${'var(--tz-border)'}` }}>
                      <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--tz-text)' }}>{r.title || r.description?.slice(0, 50) || '—'}</td>
                      <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--tz-textSecondary)' }}>{r.unit_number || '—'}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: urg.color, background: urg.bg, padding: '2px 8px', borderRadius: 4 }}>{urg.label}</span>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: st.color, background: st.bg, padding: '2px 8px', borderRadius: 4 }}>{st.label}</span>
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--tz-textTertiary)' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 16 }}>
            <Pagination page={page} total={total} totalPages={Math.ceil(total / perPage)} onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  )
}
