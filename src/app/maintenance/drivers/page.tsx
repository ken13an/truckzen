'use client'
import { MaintListPage } from '@/lib/maint-page'
const GREEN = '#1DB870', AMBER = '#D4882A', RED = '#D94F4F', MUTED = 'var(--tz-textSecondary)'
function expiryColor(d: string | null) { if (!d) return RED; const days = Math.floor((new Date(d).getTime() - Date.now()) / 86400000); return days < 0 ? RED : days < 60 ? AMBER : GREEN }
export default MaintListPage({
  title: 'Drivers', table: 'maint_drivers', label: 'drivers',
  newHref: '/maintenance/drivers/new',
  searchCols: 'full_name,cdl_number,phone',
  searchPlaceholder: 'Search by name, CDL, or phone...',
  columns: [
    { key: 'full_name', label: 'Name', render: r => <span style={{ fontWeight: 600 }}>{r.full_name}</span> },
    { key: 'phone', label: 'Phone' },
    { key: 'cdl_class', label: 'CDL', render: r => `Class ${r.cdl_class || 'A'}` },
    { key: 'cdl_expiry', label: 'CDL Expiry', render: r => <span style={{ color: expiryColor(r.cdl_expiry) }}>{r.cdl_expiry ? new Date(r.cdl_expiry).toLocaleDateString() : 'Not set'}</span> },
    { key: 'medical_card_expiry', label: 'Medical', render: r => <span style={{ color: expiryColor(r.medical_card_expiry) }}>{r.medical_card_expiry ? new Date(r.medical_card_expiry).toLocaleDateString() : 'Not set'}</span> },
    { key: 'active', label: 'Status', render: r => <span style={{ fontSize: 9, fontWeight: 600, color: r.active ? GREEN : MUTED, background: `${r.active ? GREEN : MUTED}18`, padding: '2px 6px', borderRadius: 4 }}>{r.active ? 'ACTIVE' : 'INACTIVE'}</span> },
  ],
  onRowClick: r => { window.location.href = `/maintenance/drivers/${r.id}` },
})
