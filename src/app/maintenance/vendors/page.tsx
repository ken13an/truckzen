'use client'
import { MaintListPage } from '@/lib/maint-page'
const BLUE = '#1B6EE6', AMBER = '#D4882A', RED = '#D94F4F', GREEN = '#1DB870', PURPLE = '#8B5CF6'
const typeColor: Record<string, string> = { repair_shop: BLUE, dealer: PURPLE, tire_shop: AMBER, parts_supplier: GREEN, towing: RED }
export default MaintListPage({
  title: 'Vendors', table: 'maint_vendors', label: 'vendors',
  newHref: '/maintenance/vendors/new',
  searchCols: 'name,city,specialties',
  searchPlaceholder: 'Search by name, city, or specialty...',
  columns: [
    { key: 'name', label: 'Name', render: r => <span style={{ fontWeight: 600 }}>{r.name}</span> },
    { key: 'vendor_type', label: 'Type', render: r => <span style={{ fontSize: 9, fontWeight: 600, color: typeColor[r.vendor_type] || '#7C8BA0', background: `${typeColor[r.vendor_type] || '#7C8BA0'}18`, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>{r.vendor_type?.replace(/_/g, ' ') || '—'}</span> },
    { key: 'city', label: 'City/State', render: r => [r.city, r.state].filter(Boolean).join(', ') || '—' },
    { key: 'phone', label: 'Phone' },
    { key: 'contact_person', label: 'Contact' },
    { key: 'active', label: 'Status', render: r => <span style={{ fontSize: 9, fontWeight: 600, color: r.active ? GREEN : '#7C8BA0', background: `${r.active ? GREEN : '#7C8BA0'}18`, padding: '2px 6px', borderRadius: 4 }}>{r.active ? 'ACTIVE' : 'INACTIVE'}</span> },
  ],
  onRowClick: r => { window.location.href = `/maintenance/vendors/${r.id}` },
})
