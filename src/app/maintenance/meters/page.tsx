'use client'
import { MaintListPage } from '@/lib/maint-page'
export default MaintListPage({
  title: 'Meter Readings', table: 'maint_meter_entries', label: 'readings',
  searchCols: 'recorded_by,meter_type',
  orderBy: 'recorded_date',
  columns: [
    { key: 'recorded_date', label: 'Date', render: r => r.recorded_date ? new Date(r.recorded_date).toLocaleDateString() : '—' },
    { key: 'meter_type', label: 'Type', render: r => <span style={{ textTransform: 'capitalize' }}>{r.meter_type || 'odometer'}</span> },
    { key: 'value', label: 'Value', render: r => <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700 }}>{r.value?.toLocaleString() || '—'}</span> },
    { key: 'recorded_by', label: 'Recorded By' },
  ],
})
