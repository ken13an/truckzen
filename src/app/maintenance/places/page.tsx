'use client'
import { MaintListPage } from '@/lib/maint-page'
const BLUE = '#1B6EE6', GREEN = '#1DB870', AMBER = '#D4882A', MUTED = '#7C8BA0'
const typeColor: Record<string, string> = { yard: BLUE, shop: GREEN, customer: AMBER, fuel_stop: '#8B5CF6', weigh_station: MUTED, other: MUTED }
export default MaintListPage({
  title: 'Places', table: 'maint_places', label: 'places',
  newHref: '/maintenance/places/new',
  searchCols: 'name,city,place_type',
  searchPlaceholder: 'Search places...',
  columns: [
    { key: 'name', label: 'Name', render: r => <span style={{ fontWeight: 600, color: '#F0F4FF' }}>{r.name}</span> },
    { key: 'place_type', label: 'Type', render: r => <span style={{ fontSize: 9, fontWeight: 600, color: typeColor[r.place_type] || MUTED, background: `${typeColor[r.place_type] || MUTED}18`, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>{r.place_type?.replace(/_/g, ' ')}</span> },
    { key: 'city', label: 'City/State', render: r => [r.city, r.state].filter(Boolean).join(', ') || '—' },
    { key: 'phone', label: 'Phone' },
    { key: 'contact_person', label: 'Contact' },
  ],
  emptyMessage: 'No places yet.',
})
