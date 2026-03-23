'use client'
import { MaintListPage } from '@/lib/maint-page'
const GREEN = '#1DB870', AMBER = '#D4882A', MUTED = '#7C8BA0'
const stColor: Record<string, string> = { active: GREEN, in_repair: AMBER, retired: MUTED }
export default MaintListPage({
  title: 'Equipment', table: 'maint_equipment', label: 'equipment',
  searchCols: 'name,serial_number,make',
  columns: [
    { key: 'name', label: 'Name', render: r => <span style={{ fontWeight: 600, color: '#F0F4FF' }}>{r.name}</span> },
    { key: 'equipment_type', label: 'Type', render: r => <span style={{ textTransform: 'capitalize' }}>{r.equipment_type?.replace(/_/g, ' ') || '—'}</span> },
    { key: 'serial_number', label: 'Serial #', render: r => <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10 }}>{r.serial_number || '—'}</span> },
    { key: 'make', label: 'Make/Model', render: r => [r.make, r.model].filter(Boolean).join(' ') || '—' },
    { key: 'location', label: 'Location' },
    { key: 'status', label: 'Status', render: r => <span style={{ fontSize: 9, fontWeight: 600, color: stColor[r.status] || MUTED, background: `${stColor[r.status] || MUTED}18`, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>{r.status?.replace(/_/g, ' ')}</span> },
    { key: 'hourmeter', label: 'Hours', render: r => r.hourmeter?.toFixed(0) || '0' },
  ],
})
