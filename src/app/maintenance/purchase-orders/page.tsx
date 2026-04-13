'use client'
import { MaintListPage } from '@/lib/maint-page'
const BLUE = '#1B6EE6', GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F', MUTED = 'var(--tz-textSecondary)'
const stColor: Record<string, string> = { draft: MUTED, sent: BLUE, partially_received: AMBER, received: GREEN, cancelled: RED }
export default MaintListPage({
  title: 'Purchase Orders', table: 'maint_purchase_orders', label: 'purchase orders',
  newHref: '/maintenance/purchase-orders/new',
  searchCols: 'po_number,notes',
  filterKey: 'status', filterOptions: [{ value: 'all', label: 'All' }, { value: 'draft', label: 'Draft' }, { value: 'sent', label: 'Sent' }, { value: 'received', label: 'Received' }],
  columns: [
    { key: 'po_number', label: 'PO #', render: r => <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, color: BLUE }}>{r.po_number || '—'}</span> },
    { key: 'order_date', label: 'Date', render: r => r.order_date ? new Date(r.order_date).toLocaleDateString() : '—' },
    { key: 'expected_delivery', label: 'Expected', render: r => r.expected_delivery ? new Date(r.expected_delivery).toLocaleDateString() : '—' },
    { key: 'total', label: 'Total', render: r => <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700 }}>${(r.total || 0).toFixed(2)}</span> },
    { key: 'status', label: 'Status', render: r => <span style={{ fontSize: 9, fontWeight: 600, color: stColor[r.status] || MUTED, background: `${stColor[r.status] || MUTED}18`, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>{r.status?.replace(/_/g, ' ')}</span> },
  ],
  onRowClick: r => { window.location.href = `/maintenance/purchase-orders/${r.id}` },
})
