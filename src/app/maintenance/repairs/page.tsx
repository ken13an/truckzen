'use client'
import { MaintListPage } from '@/lib/maint-page'
const BLUE = '#1B6EE6', GREEN = '#1DB870', AMBER = '#D4882A', MUTED = '#7C8BA0'
const stColor: Record<string, string> = { open: BLUE, in_progress: AMBER, completed: GREEN, invoiced: MUTED }
export default MaintListPage({
  title: 'Road Repairs', table: 'maint_road_repairs', label: 'road repairs',
  newHref: '/maintenance/repairs/new',
  searchCols: 'repair_number,location_description,description',
  searchPlaceholder: 'Search by repair #, location, or description...',
  filterKey: 'status', filterOptions: [{ value: 'all', label: 'All' }, { value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In Progress' }, { value: 'completed', label: 'Completed' }],
  columns: [
    { key: 'repair_number', label: 'Repair #', render: r => <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, color: BLUE }}>{r.repair_number || '—'}</span> },
    { key: 'location_description', label: 'Location' },
    { key: 'description', label: 'Description', render: r => <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{r.description?.slice(0, 50) || '—'}</span> },
    { key: 'repair_date', label: 'Date', render: r => r.repair_date ? new Date(r.repair_date).toLocaleDateString() : '—' },
    { key: 'total_cost', label: 'Total', render: r => <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700 }}>${(r.total_cost || 0).toFixed(0)}</span> },
    { key: 'status', label: 'Status', render: r => <span style={{ fontSize: 9, fontWeight: 600, color: stColor[r.status] || MUTED, background: `${stColor[r.status] || MUTED}18`, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>{r.status?.replace(/_/g, ' ')}</span> },
  ],
  onRowClick: r => { window.location.href = `/maintenance/repairs/${r.id}` },
})
