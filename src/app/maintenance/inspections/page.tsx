'use client'
import { MaintListPage } from '@/lib/maint-page'
const GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F'
const resColor: Record<string, string> = { pass: GREEN, fail: RED, needs_attention: AMBER }
export default MaintListPage({
  title: 'Inspections', table: 'maint_inspections', label: 'inspections',
  newHref: '/maintenance/inspections/new',
  searchCols: 'inspection_type,notes',
  filterKey: 'result', filterOptions: [{ value: 'all', label: 'All' }, { value: 'pass', label: 'Pass' }, { value: 'fail', label: 'Fail' }, { value: 'needs_attention', label: 'Needs Attention' }],
  columns: [
    { key: 'inspection_date', label: 'Date', render: r => r.inspection_date ? new Date(r.inspection_date).toLocaleDateString() : '—' },
    { key: 'inspection_type', label: 'Type', render: r => <span style={{ textTransform: 'capitalize' }}>{r.inspection_type?.replace(/_/g, ' ') || '—'}</span> },
    { key: 'odometer', label: 'Odometer', render: r => r.odometer?.toLocaleString() || '—' },
    { key: 'defects_count', label: 'Defects', render: r => <span style={{ color: (r.defects_count || 0) > 0 ? RED : GREEN, fontWeight: 700 }}>{r.defects_count || 0}</span> },
    { key: 'result', label: 'Result', render: r => <span style={{ fontSize: 9, fontWeight: 600, color: resColor[r.result] || '#7C8BA0', background: `${resColor[r.result] || '#7C8BA0'}18`, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>{r.result}</span> },
  ],
  onRowClick: r => { window.location.href = `/maintenance/inspections/${r.id}` },
})
