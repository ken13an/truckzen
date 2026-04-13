'use client'
import { MaintListPage } from '@/lib/maint-page'
const GREEN = '#1DB870', MUTED = 'var(--tz-textSecondary)'
export default MaintListPage({
  title: 'Shop Network', table: 'maint_vendors', label: 'shops',
  newHref: '/maintenance/shop-network/new',
  searchCols: 'name,city,specialties',
  searchPlaceholder: 'Search by name, city...',
  columns: [
    { key: 'name', label: 'Shop Name', render: r => <span style={{ fontWeight: 600 }}>{r.name}</span> },
    { key: 'city', label: 'City/State', render: r => [r.city, r.state].filter(Boolean).join(', ') || '—' },
    { key: 'phone', label: 'Phone' },
    { key: 'contact_person', label: 'Contact' },
    { key: 'active', label: 'Status', render: r => <span style={{ fontSize: 9, fontWeight: 600, color: r.active ? GREEN : MUTED, background: `${r.active ? GREEN : MUTED}18`, padding: '2px 6px', borderRadius: 4 }}>{r.active ? 'ACTIVE' : 'INACTIVE'}</span> },
  ],
  onRowClick: r => { window.location.href = `/maintenance/vendors/${r.id}` },
  emptyMessage: 'No shops in network yet.',
})
