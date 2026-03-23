'use client'
import { MaintListPage } from '@/lib/maint-page'
const GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F'
export default MaintListPage({
  title: 'Maintenance Parts', table: 'maint_parts', label: 'parts',
  newHref: '/maintenance/maint-parts/new',
  searchCols: 'description,part_number',
  columns: [
    { key: 'part_number', label: 'Part #', render: r => <span style={{ fontFamily: "'IBM Plex Mono',monospace", color: '#4D9EFF' }}>{r.part_number || '—'}</span> },
    { key: 'description', label: 'Description', render: r => <span style={{ fontWeight: 600, color: '#F0F4FF' }}>{r.description}</span> },
    { key: 'category', label: 'Category' },
    { key: 'cost_price', label: 'Cost', render: r => `$${(r.cost_price || 0).toFixed(2)}` },
    { key: 'quantity_on_hand', label: 'Qty', render: r => <span style={{ fontWeight: 700, color: r.quantity_on_hand === 0 ? RED : r.quantity_on_hand <= (r.reorder_point || 2) ? AMBER : '#DDE3EE' }}>{r.quantity_on_hand}</span> },
    { key: 'bin_location', label: 'Bin' },
    { key: 'active', label: 'Status', render: r => { const isOut = r.quantity_on_hand === 0; const isLow = r.quantity_on_hand <= (r.reorder_point || 2); return <span style={{ fontSize: 9, fontWeight: 600, color: isOut ? RED : isLow ? AMBER : GREEN, background: `${isOut ? RED : isLow ? AMBER : GREEN}18`, padding: '2px 6px', borderRadius: 4 }}>{isOut ? 'OUT' : isLow ? 'LOW' : 'OK'}</span> } },
  ],
})
