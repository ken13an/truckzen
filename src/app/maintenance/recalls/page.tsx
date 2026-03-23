'use client'
import { MaintListPage } from '@/lib/maint-page'
const GREEN = '#1DB870', MUTED = '#7C8BA0'
export default MaintListPage({
  title: 'Recalls', table: 'maint_recalls', label: 'recalls',
  newHref: '/maintenance/recalls/new',
  searchCols: 'recall_number,title,manufacturer',
  searchPlaceholder: 'Search by recall #, title...',
  filterKey: 'status', filterOptions: [{ value: 'all', label: 'All' }, { value: 'open', label: 'Open' }, { value: 'completed', label: 'Completed' }],
  columns: [
    { key: 'recall_number', label: 'Recall #', render: r => <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, color: '#1B6EE6' }}>{r.recall_number || '—'}</span> },
    { key: 'title', label: 'Title', render: r => <span style={{ fontWeight: 600, color: '#F0F4FF' }}>{r.title}</span> },
    { key: 'manufacturer', label: 'Manufacturer' },
    { key: 'nhtsa_id', label: 'NHTSA ID', render: r => <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: '#7C8BA0' }}>{r.nhtsa_id || '—'}</span> },
    { key: 'status', label: 'Status', render: r => <span style={{ fontSize: 9, fontWeight: 600, color: r.status === 'completed' ? GREEN : '#D94F4F', background: `${r.status === 'completed' ? GREEN : '#D94F4F'}18`, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>{r.status}</span> },
  ],
  onRowClick: r => { window.location.href = `/maintenance/recalls/${r.id}` },
  emptyMessage: 'No recalls yet.',
})
