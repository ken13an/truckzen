'use client'
import { MaintListPage } from '@/lib/maint-page'
const BLUE = '#1B6EE6', GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F', MUTED = '#7C8BA0'
const priColor: Record<string, string> = { low: MUTED, medium: BLUE, high: AMBER, critical: RED }
const stColor: Record<string, string> = { open: BLUE, in_progress: AMBER, resolved: GREEN, closed: MUTED }
export default MaintListPage({
  title: 'Issues', table: 'maint_issues', label: 'issues',
  newHref: '/maintenance/issues/new',
  searchCols: 'title,issue_number,description',
  searchPlaceholder: 'Search by title, issue #...',
  filterKey: 'status', filterOptions: [{ value: 'all', label: 'All' }, { value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In Progress' }, { value: 'resolved', label: 'Resolved' }],
  columns: [
    { key: 'issue_number', label: 'Issue #', render: r => <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, color: BLUE }}>{r.issue_number || '—'}</span> },
    { key: 'title', label: 'Title', render: r => <span style={{ fontWeight: 600 }}>{r.title}</span> },
    { key: 'priority', label: 'Priority', render: r => <span style={{ fontSize: 9, fontWeight: 600, color: priColor[r.priority] || MUTED, background: `${priColor[r.priority] || MUTED}18`, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>{r.priority}</span> },
    { key: 'status', label: 'Status', render: r => <span style={{ fontSize: 9, fontWeight: 600, color: stColor[r.status] || MUTED, background: `${stColor[r.status] || MUTED}18`, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>{r.status?.replace(/_/g, ' ')}</span> },
    { key: 'category', label: 'Category', render: r => <span style={{ textTransform: 'capitalize' }}>{r.category?.replace(/_/g, ' ') || '—'}</span> },
    { key: 'due_date', label: 'Due', render: r => r.due_date ? new Date(r.due_date).toLocaleDateString() : '—' },
  ],
  onRowClick: r => { window.location.href = `/maintenance/issues/${r.id}` },
  emptyMessage: 'No issues yet.',
})
