'use client'
import { MaintListPage } from '@/lib/maint-page'
const GREEN = '#1DB870', MUTED = 'var(--tz-textSecondary)'
export default MaintListPage({
  title: 'Service Programs', table: 'maint_service_programs', label: 'service programs',
  newHref: '/maintenance/service-programs/new',
  searchCols: 'name,service_type',
  searchPlaceholder: 'Search programs...',
  columns: [
    { key: 'name', label: 'Name', render: r => <span style={{ fontWeight: 600 }}>{r.name}</span> },
    { key: 'service_type', label: 'Type', render: r => <span style={{ textTransform: 'capitalize' }}>{r.service_type?.replace(/_/g, ' ') || '—'}</span> },
    { key: 'interval_miles', label: 'Interval', render: r => [r.interval_miles ? `${r.interval_miles.toLocaleString()} mi` : null, r.interval_days ? `${r.interval_days}d` : null].filter(Boolean).join(' / ') || '—' },
    { key: 'vehicles_count', label: 'Vehicles', render: r => <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700 }}>{r.vehicles_count || 0}</span> },
    { key: 'active', label: 'Status', render: r => <span style={{ fontSize: 9, fontWeight: 600, color: r.active ? GREEN : MUTED, background: `${r.active ? GREEN : MUTED}18`, padding: '2px 6px', borderRadius: 4 }}>{r.active ? 'ACTIVE' : 'INACTIVE'}</span> },
  ],
  emptyMessage: 'No service programs yet.',
})
