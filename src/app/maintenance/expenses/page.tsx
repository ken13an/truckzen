'use client'
import { MaintListPage } from '@/lib/maint-page'
export default MaintListPage({
  title: 'Expenses', table: 'maint_expenses', label: 'expenses',
  newHref: '/maintenance/expenses/new',
  searchCols: 'description,expense_type',
  orderBy: 'expense_date',
  columns: [
    { key: 'expense_date', label: 'Date', render: r => r.expense_date ? new Date(r.expense_date).toLocaleDateString() : '—' },
    { key: 'expense_type', label: 'Type', render: r => <span style={{ textTransform: 'capitalize' }}>{r.expense_type?.replace(/_/g, ' ') || '—'}</span> },
    { key: 'description', label: 'Description' },
    { key: 'amount', label: 'Amount', render: r => <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700 }}>${(r.amount || 0).toFixed(2)}</span> },
  ],
})
