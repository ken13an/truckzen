'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Plus, Pencil, Trash2, Download, Upload, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import SourceBadge from '@/components/ui/SourceBadge'
import OwnershipTypeBadge from '@/components/OwnershipTypeBadge'
import { validateFile, sanitizeFilename, DOC_EXTENSIONS, DOC_MIMES, MAX_DOC_SIZE } from '@/lib/upload-safety'
import { getWorkorderRoute, getNewWorkorderRoute } from '@/lib/navigation/workorder-route'
import { useTheme } from '@/hooks/useTheme'

type Tab = 'fleet' | 'work-orders' | 'contacts' | 'billing' | 'documents' | 'parts'

export default function CustomerProfilePage() {
  const { tokens: th } = useTheme()
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const id = params.id as string

  const [user, setUser] = useState<any>(null)
  const [customer, setCustomer] = useState<any>(null)
  const [units, setUnits] = useState<any[]>([])
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('fleet')
  const [toast, setToast] = useState('')
  const [fleetSearch, setFleetSearch] = useState('')
  const [showExternalData, setShowExternalData] = useState(false)
  const [woPage, setWoPage] = useState(1)
  const woPerPage = 25

  // Edit modal state
  const [editModal, setEditModal] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  // Contact modal state
  const [contactModal, setContactModal] = useState(false)
  const [contactForm, setContactForm] = useState<any>({ name: '', role: '', phone: '', email: '', is_primary: false })
  const [editingContactId, setEditingContactId] = useState<string | null>(null)

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false
    const timeout = setTimeout(() => {
      if (!cancelled && loading) {
        setLoading(false)
        setLoadError('Loading timed out. Please refresh the page.')
      }
    }, 10000)

    async function load() {
      try {
        const profile = await getCurrentUser(supabase)
        if (!profile) { router.push('/login'); return }
        if (cancelled) return
        setUser(profile)

        // Fetch customer data (includes assets + service_orders via API)
        const res = await fetch(`/api/customers/${id}?shop_id=${profile.shop_id}`)
        if (!res.ok) { router.push('/customers'); return }
        if (cancelled) return
        const data = await res.json()
        setCustomer(data)
        setUnits(data.assets || [])
        setWorkOrders(data.service_orders || [])

        // Fetch contacts and documents in parallel
        const [contactsRes, docsRes] = await Promise.all([
          supabase.from('customer_contacts').select('*').eq('customer_id', id).order('is_primary', { ascending: false }),
          supabase.from('customer_documents').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
        ])
        if (cancelled) return
        setContacts(contactsRes.data || [])
        setDocuments(docsRes.data || [])
      } catch (err: any) {
        if (!cancelled) setLoadError(err.message || 'Failed to load customer')
      }
      if (!cancelled) setLoading(false)
    }
    load()

    return () => { cancelled = true; clearTimeout(timeout) }
  }, [id])

  // -- Customer status change --
  async function updateStatus(newStatus: string) {
    const res = await fetch(`/api/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_status: newStatus }),
    })
    if (res.ok) {
      const updated = await res.json()
      setCustomer((c: any) => ({ ...c, ...updated }))
      flash('Status updated')
    }
  }

  // -- Save company info edit --
  async function saveEdit() {
    setSaving(true)
    const res = await fetch(`/api/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    if (res.ok) {
      const updated = await res.json()
      setCustomer((c: any) => ({ ...c, ...updated }))
      setEditModal(false)
      flash('Customer updated')
    }
    setSaving(false)
  }

  // -- Payment terms / credit limit --
  async function updateField(field: string, value: any) {
    const res = await fetch(`/api/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    if (res.ok) {
      const updated = await res.json()
      setCustomer((c: any) => ({ ...c, ...updated }))
      flash('Saved')
    }
  }

  // -- Contacts CRUD --
  async function saveContact() {
    setSaving(true)
    if (editingContactId) {
      const { data, error } = await supabase
        .from('customer_contacts')
        .update(contactForm)
        .eq('id', editingContactId)
        .select()
        .single()
      if (!error && data) {
        setContacts(prev => prev.map(c => c.id === editingContactId ? data : c))
        flash('Contact updated')
      }
    } else {
      const { data, error } = await supabase
        .from('customer_contacts')
        .insert({ ...contactForm, customer_id: id })
        .select()
        .single()
      if (!error && data) {
        setContacts(prev => [data, ...prev])
        flash('Contact added')
      }
    }
    setContactModal(false)
    setEditingContactId(null)
    setContactForm({ name: '', role: '', phone: '', email: '', is_primary: false })
    setSaving(false)
  }

  async function deleteContact(contactId: string) {
    if (!confirm('Delete this contact?')) return
    const { error } = await supabase.from('customer_contacts').delete().eq('id', contactId)
    if (!error) {
      setContacts(prev => prev.filter(c => c.id !== contactId))
      flash('Contact deleted')
    }
  }

  // -- Documents --
  async function uploadDocument(file: File) {
    const err = validateFile(file, DOC_EXTENSIONS, DOC_MIMES, MAX_DOC_SIZE)
    if (err) { flash(err); return }
    const safeName = sanitizeFilename(file.name)
    const shopPrefix = user?.shop_id || 'unknown'
    const path = `${shopPrefix}/${id}/${Date.now()}_${safeName}`
    const { error: upErr } = await supabase.storage.from('customer-docs').upload(path, file)
    if (upErr) { flash('Upload failed: ' + upErr.message); return }

    const { data: doc, error: dbErr } = await supabase
      .from('customer_documents')
      .insert({
        customer_id: id,
        filename: safeName,
        storage_path: path,
        file_type: file.type || 'application/octet-stream',
        file_size: file.size,
      })
      .select()
      .single()
    if (!dbErr && doc) {
      setDocuments(prev => [doc, ...prev])
      flash('Document uploaded')
    }
  }

  async function deleteDocument(doc: any) {
    if (!confirm('Delete this document?')) return
    await supabase.storage.from('customer-docs').remove([doc.storage_path])
    const { error } = await supabase.from('customer_documents').delete().eq('id', doc.id)
    if (!error) {
      setDocuments(prev => prev.filter(d => d.id !== doc.id))
      flash('Document deleted')
    }
  }

  async function downloadDocument(doc: any) {
    const { data } = await supabase.storage.from('customer-docs').createSignedUrl(doc.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  // -- Loading state --
  if (loading) {
    return (
      <div style={{ background: 'var(--tz-bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", color: 'var(--tz-textSecondary)' }}>
        Loading...
      </div>
    )
  }

  if (loadError) {
    return (
      <div style={{ background: 'var(--tz-bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", color: 'var(--tz-danger)', gap: 16 }}>
        <div style={{ fontSize: 15 }}>{loadError}</div>
        <button onClick={() => window.location.reload()} style={{ padding: '8px 20px', background: 'var(--tz-accent)', color: 'var(--tz-bgLight)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Refresh</button>
      </div>
    )
  }

  // -- Computed --
  const filteredUnits = units.filter((u: any) =>
    !fleetSearch || u.unit_number?.toLowerCase().includes(fleetSearch.toLowerCase())
  )
  const woCount = workOrders.length
  const lifetimeSpend = customer?.total_spent || 0
  const avgWO = woCount > 0 ? lifetimeSpend / woCount : 0

  const statusColor = (s: string) => {
    if (s === 'active') return '#22C55E'
    if (s === 'inactive') return '#7C8BA0'
    if (s === 'blacklisted') return '#EF4444'
    return '#7C8BA0'
  }

  const paymentTermsColor = (t: string) => {
    if (t === 'cod') return { bg: 'rgba(239,68,68,0.15)', color: '#EF4444' }
    if (t === 'net15') return { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B' }
    if (t === 'net30') return { bg: 'rgba(59,130,246,0.15)', color: '#3B82F6' }
    if (t === 'net60') return { bg: 'rgba(139,92,246,0.15)', color: '#8B5CF6' }
    return { bg: 'var(--tz-border)', color: 'var(--tz-textSecondary)' }
  }

  const unitTypeBadge = (type: string) => {
    const t = (type || 'tractor').toLowerCase()
    if (t === 'tractor') return { label: 'TRACTOR', bg: 'rgba(59,130,246,0.15)', color: '#3B82F6' }
    if (t.includes('reefer')) return { label: 'TRAILER-REEFER', bg: 'rgba(245,158,11,0.15)', color: '#F59E0B' }
    if (t.includes('trailer')) return { label: 'TRAILER', bg: 'rgba(139,92,246,0.15)', color: '#8B5CF6' }
    return { label: t.toUpperCase(), bg: 'var(--tz-border)', color: 'var(--tz-textSecondary)' }
  }

  const woStatusColor = (s: string) => {
    if (s === 'draft') return '#7C8BA0'
    if (s === 'in_progress') return '#F59E0B'
    if (s === 'waiting_parts') return '#F59E0B'
    if (s === 'good_to_go' || s === 'completed') return '#22C55E'
    return '#7C8BA0'
  }

  const ptc = paymentTermsColor(customer?.payment_terms || '')
  const PRICING_ROLES = ['owner', 'gm', 'it_person', 'shop_manager', 'parts_manager', 'service_writer', 'accountant', 'office_admin']
  const canSeePricing = user && PRICING_ROLES.includes(user.role)
  const tabs: { key: Tab; label: string }[] = [
    { key: 'fleet', label: 'Fleet' },
    { key: 'work-orders', label: 'Work Orders' },
    { key: 'contacts', label: 'Contacts' },
    { key: 'billing', label: 'Billing' },
    ...(canSeePricing ? [{ key: 'parts' as Tab, label: 'Parts' }] : []),
    { key: 'documents', label: 'Documents' },
  ]

  return (
    <div style={{ background: 'var(--tz-bg)', minHeight: '100vh', color: 'var(--tz-text)', fontFamily: "'Inter', sans-serif", padding: 24 }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 999, background: 'var(--tz-accent)', color: 'var(--tz-bgLight)', padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>
          {toast}
        </div>
      )}

      {/* Back button */}
      <a href="/customers" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--tz-border)', borderRadius: 8, fontSize: 14, fontWeight: 700, color: 'var(--tz-text)', textDecoration: 'none', marginBottom: 20 }}>
        <ChevronLeft size={16} strokeWidth={2} /> Customers
      </a>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--tz-text)' }}>{customer.company_name || 'Unknown'}</div>
            <SourceBadge source={customer.source} />
            {customer.is_owner_operator && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 4, background: 'rgba(217,119,6,0.15)', color: '#D97706', textTransform: 'uppercase' as const, letterSpacing: '.03em' }}>
                Owner Operator
              </span>
            )}
            {!customer.is_owner_operator && customer.customer_type === 'outside_customer' && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 4, background: 'rgba(107,114,128,0.15)', color: 'var(--tz-textSecondary)', textTransform: 'uppercase' as const, letterSpacing: '.03em' }}>
                Outside
              </span>
            )}
            {!customer.is_owner_operator && (!customer.customer_type || customer.customer_type === 'company') && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 4, background: 'rgba(59,130,246,0.15)', color: '#3B82F6', textTransform: 'uppercase' as const, letterSpacing: '.03em' }}>
                Company
              </span>
            )}
            <select
              value={customer.customer_status || 'active'}
              onChange={e => updateStatus(e.target.value)}
              style={{
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 600,
                fontFamily: "'Inter', sans-serif",
                background: 'var(--tz-border)',
                border: `1px solid ${statusColor(customer.customer_status || 'active')}40`,
                borderRadius: 6,
                color: statusColor(customer.customer_status || 'active'),
                cursor: 'pointer',
                outline: 'none',
                textTransform: 'uppercase' as const,
              }}
            >
              <option value="active" style={{ background: 'var(--tz-bgCard)', color: 'var(--tz-text)' }}>Active</option>
              <option value="inactive" style={{ background: 'var(--tz-bgCard)', color: 'var(--tz-text)' }}>Inactive</option>
              <option value="blacklisted" style={{ background: 'var(--tz-bgCard)', color: 'var(--tz-text)' }}>Blacklisted</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--tz-textSecondary)', flexWrap: 'wrap' }}>
            {customer.dot_number && <span>DOT #{customer.dot_number}</span>}
            {customer.dot_number && customer.mc_number && <span style={{ color: '#3A3A4A' }}>|</span>}
            {customer.mc_number && <span>MC #{customer.mc_number}</span>}
            {(customer.dot_number || customer.mc_number) && customer.phone && <span style={{ color: '#3A3A4A' }}>|</span>}
            {customer.phone && <span>{customer.phone}</span>}
            {customer.payment_terms && (
              <>
                <span style={{ color: '#3A3A4A' }}>|</span>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  background: ptc.bg,
                  color: ptc.color,
                  textTransform: 'uppercase' as const,
                }}>
                  {customer.payment_terms}
                </span>
              </>
            )}
          </div>
        </div>

        <button
          onClick={() => {
            setEditForm({
              company_name: customer.company_name || '',
              contact_name: customer.contact_name || '',
              phone: customer.phone || '',
              email: customer.email || '',
              address: customer.address || '',
              dot_number: customer.dot_number || '',
              mc_number: customer.mc_number || '',
              notes: customer.notes || '',
              is_owner_operator: customer.is_owner_operator || false,
              customer_type: customer.customer_type || 'company',
            })
            setEditModal(true)
          }}
          style={{
            padding: '9px 20px',
            borderRadius: 8,
            border: `1px solid ${'var(--tz-border)'}`,
            background: 'var(--tz-border)',
            color: 'var(--tz-text)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: "'Inter', sans-serif",
          }}
        >
          Edit
        </button>
      </div>

      {/* Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total WOs', value: String(woCount) },
          { label: 'Spend This Year', value: '$0.00' },
          { label: 'Lifetime Spend', value: `$${lifetimeSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
          { label: 'Avg WO Value', value: `$${avgWO.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--tz-text)', fontFamily: "'Inter', sans-serif" }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'var(--tz-textSecondary)', textTransform: 'uppercase' as const, letterSpacing: '.05em', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: `1px solid ${'var(--tz-border)'}` }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid #3B82F6' : '2px solid transparent',
              color: tab === t.key ? '#3B82F6' : 'var(--tz-textSecondary)',
              fontFamily: "'Inter', sans-serif",
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ==================== FLEET TAB ==================== */}
      {tab === 'fleet' && (
        <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <input
              placeholder="Search unit number..."
              value={fleetSearch}
              onChange={e => setFleetSearch(e.target.value)}
              style={{
                padding: '9px 14px',
                background: 'var(--tz-border)',
                border: `1px solid ${'var(--tz-border)'}`,
                borderRadius: 8,
                fontSize: 12,
                color: 'var(--tz-text)',
                outline: 'none',
                width: 260,
                fontFamily: "'Inter', sans-serif",
              }}
            />
            <a
              href={`/fleet/new?customer=${id}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 16px',
                background: '#3B82F6',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--tz-bgLight)',
                textDecoration: 'none',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              <Plus size={14} /> Add Unit
            </a>
          </div>

          {filteredUnits.length === 0 ? (
            <div style={{ color: 'var(--tz-textSecondary)', textAlign: 'center', padding: 40, fontSize: 13 }}>No units found</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
              <thead>
                <tr>
                  {['Unit #', 'Type', 'Truck Type', 'Year / Make / Model', 'Mileage', 'Status', ''].map(h => (
                    <th key={h} style={{ fontSize: 10, color: 'var(--tz-textSecondary)', textTransform: 'uppercase' as const, letterSpacing: '.05em', padding: '8px 12px', textAlign: 'left' as const, borderBottom: `1px solid ${'var(--tz-border)'}`, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUnits.map((u: any) => {
                  const badge = unitTypeBadge(u.unit_type)
                  return (
                    <tr key={u.id} style={{ borderBottom: `1px solid ${'var(--tz-border)'}` }}>
                      <td style={{ padding: '10px 12px', fontSize: 13 }}>
                        <a href={`/customers/${id}/units/${u.id}`} style={{ color: '#3B82F6', textDecoration: 'none', fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>
                          #{u.unit_number}
                        </a>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: badge.bg, color: badge.color, textTransform: 'uppercase' as const, letterSpacing: '.03em' }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <OwnershipTypeBadge type={u.is_owner_operator ? 'owner_operator' : u.ownership_type} size="sm" dark />
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--tz-textSecondary)' }}>
                        {[u.year, u.make, u.model].filter(Boolean).join(' ') || '\u2014'}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--tz-textSecondary)', fontVariantNumeric: 'tabular-nums' }}>
                        {u.odometer ? u.odometer.toLocaleString() : '\u2014'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, color: u.status === 'on_road' ? '#22C55E' : u.status === 'in_shop' ? '#F59E0B' : 'var(--tz-textSecondary)' }}>
                          {u.status?.replace(/_/g, ' ') || 'unknown'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' as const }}>
                        <a
                          href={getNewWorkorderRoute({ customer: id, unit: u.id })}
                          style={{ fontSize: 11, color: '#3B82F6', textDecoration: 'none', fontWeight: 600 }}
                        >
                          Create WO
                        </a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ==================== WORK ORDERS TAB ==================== */}
      {tab === 'work-orders' && (
        <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tz-text)' }}>Service History ({woCount})</div>
            <a
              href={getNewWorkorderRoute({ customer: id as string })}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 16px',
                background: '#3B82F6',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--tz-bgLight)',
                textDecoration: 'none',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              <Plus size={14} /> New WO
            </a>
          </div>

          {workOrders.length === 0 ? (
            <div style={{ color: 'var(--tz-textSecondary)', textAlign: 'center', padding: 40, fontSize: 13 }}>No work orders yet</div>
          ) : (() => {
            const sorted = [...workOrders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            const totalPages = Math.ceil(sorted.length / woPerPage)
            const paginated = sorted.slice((woPage - 1) * woPerPage, woPage * woPerPage)
            return (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                  <thead>
                    <tr>
                      {['WO #', 'Unit', 'Status', 'Created', 'Total'].map(h => (
                        <th key={h} style={{ fontSize: 10, color: 'var(--tz-textSecondary)', textTransform: 'uppercase' as const, letterSpacing: '.05em', padding: '8px 12px', textAlign: 'left' as const, borderBottom: `1px solid ${'var(--tz-border)'}`, fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((wo: any) => (
                      <tr key={wo.id} style={{ borderBottom: `1px solid ${'var(--tz-border)'}`, cursor: 'pointer' }} onClick={() => router.push(getWorkorderRoute(wo.id, undefined, 'customer'))}>
                        <td style={{ padding: '10px 12px', fontSize: 13 }}>
                          <a href={getWorkorderRoute(wo.id, undefined, 'customer')} style={{ color: '#3B82F6', textDecoration: 'none', fontWeight: 700 }} onClick={e => e.stopPropagation()}>
                            {wo.so_number}
                          </a>
                          {wo.is_historical && (
                            <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 4, background: 'rgba(124,139,160,0.1)', color: 'var(--tz-textSecondary)', fontSize: 9, fontWeight: 600, textTransform: 'uppercase' as const }}>Historical</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--tz-textSecondary)' }}>
                          {(wo.assets as any)?.unit_number ? `#${(wo.assets as any).unit_number}` : '\u2014'}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, color: woStatusColor(wo.status) }}>
                            {wo.status?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--tz-textSecondary)' }}>
                          {wo.created_at ? new Date(wo.created_at).toLocaleDateString() : '\u2014'}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--tz-text)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          ${(wo.grand_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16, fontSize: 12, color: 'var(--tz-textSecondary)' }}>
                    <button
                      disabled={woPage <= 1}
                      onClick={() => setWoPage(p => Math.max(1, p - 1))}
                      style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${'var(--tz-border)'}`, background: 'var(--tz-border)', color: 'var(--tz-text)', cursor: woPage <= 1 ? 'default' : 'pointer', opacity: woPage <= 1 ? 0.4 : 1, fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600 }}
                    >
                      Prev
                    </button>
                    <span>Page {woPage} of {totalPages}</span>
                    <button
                      disabled={woPage >= totalPages}
                      onClick={() => setWoPage(p => Math.min(totalPages, p + 1))}
                      style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${'var(--tz-border)'}`, background: 'var(--tz-border)', color: 'var(--tz-text)', cursor: woPage >= totalPages ? 'default' : 'pointer', opacity: woPage >= totalPages ? 0.4 : 1, fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600 }}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}

      {/* ==================== CONTACTS TAB ==================== */}
      {tab === 'contacts' && (
        <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tz-text)' }}>Contacts ({contacts.length})</div>
            <button
              onClick={() => {
                setContactForm({ name: '', role: '', phone: '', email: '', is_primary: false })
                setEditingContactId(null)
                setContactModal(true)
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 16px',
                background: '#3B82F6',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--tz-bgLight)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              <Plus size={14} /> Add Contact
            </button>
          </div>

          {contacts.length === 0 ? (
            <div style={{ color: 'var(--tz-textSecondary)', textAlign: 'center', padding: 40, fontSize: 13 }}>No contacts yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {contacts.map((c: any) => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'var(--tz-border)', borderRadius: 8, border: `1px solid ${'var(--tz-border)'}` }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tz-text)' }}>{c.name}</span>
                      {c.is_primary && (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(59,130,246,0.15)', color: '#3B82F6', textTransform: 'uppercase' as const }}>
                          Primary
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: 12, color: 'var(--tz-textSecondary)' }}>
                      {c.role && <span>{c.role}</span>}
                      {c.phone && <span>{c.phone}</span>}
                      {c.email && <span>{c.email}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => {
                        setContactForm({ name: c.name || '', role: c.role || '', phone: c.phone || '', email: c.email || '', is_primary: c.is_primary || false })
                        setEditingContactId(c.id)
                        setContactModal(true)
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tz-textSecondary)', padding: 4 }}
                      title="Edit contact"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => deleteContact(c.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tz-textSecondary)', padding: 4 }}
                      title="Delete contact"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== BILLING TAB ==================== */}
      {tab === 'billing' && (
        <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tz-text)', marginBottom: 20 }}>Billing Settings</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--tz-textSecondary)', textTransform: 'uppercase' as const, letterSpacing: '.05em', marginBottom: 6, fontWeight: 600 }}>Payment Terms</label>
              <select
                value={customer.payment_terms || ''}
                onChange={e => updateField('payment_terms', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'var(--tz-border)',
                  border: `1px solid ${'var(--tz-border)'}`,
                  borderRadius: 8,
                  fontSize: 13,
                  color: 'var(--tz-text)',
                  outline: 'none',
                  fontFamily: "'Inter', sans-serif",
                  cursor: 'pointer',
                }}
              >
                <option value="" style={{ background: 'var(--tz-bgCard)' }}>Select...</option>
                <option value="cod" style={{ background: 'var(--tz-bgCard)' }}>COD</option>
                <option value="net15" style={{ background: 'var(--tz-bgCard)' }}>Net 15</option>
                <option value="net30" style={{ background: 'var(--tz-bgCard)' }}>Net 30</option>
                <option value="net60" style={{ background: 'var(--tz-bgCard)' }}>Net 60</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--tz-textSecondary)', textTransform: 'uppercase' as const, letterSpacing: '.05em', marginBottom: 6, fontWeight: 600 }}>Credit Limit</label>
              <input
                type="number"
                defaultValue={customer.credit_limit || ''}
                placeholder="0.00"
                onBlur={e => {
                  const val = parseFloat(e.target.value)
                  if (!isNaN(val)) updateField('credit_limit', val)
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'var(--tz-border)',
                  border: `1px solid ${'var(--tz-border)'}`,
                  borderRadius: 8,
                  fontSize: 13,
                  color: 'var(--tz-text)',
                  outline: 'none',
                  fontFamily: "'Inter', sans-serif",
                  boxSizing: 'border-box' as const,
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--tz-textSecondary)', textTransform: 'uppercase' as const, letterSpacing: '.05em', marginBottom: 6, fontWeight: 600 }}>Default Truck Type</label>
              <select
                value={customer.default_ownership_type || 'fleet_asset'}
                onChange={e => updateField('default_ownership_type', e.target.value)}
                style={{ width: '100%', padding: '10px 14px', background: 'var(--tz-border)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 8, fontSize: 13, color: 'var(--tz-text)', outline: 'none', fontFamily: "'Inter', sans-serif", appearance: 'none' as const, boxSizing: 'border-box' as const }}
              >
                <option value="fleet_asset" style={{ background: 'var(--tz-bgCard)' }}>Company Truck</option>
                <option value="owner_operator" style={{ background: 'var(--tz-bgCard)' }}>Owner Operator</option>
                <option value="outside_customer" style={{ background: 'var(--tz-bgCard)' }}>Outside Customer</option>
              </select>
              <div style={{ fontSize: 10, color: 'var(--tz-textTertiary)', marginTop: 4 }}>Changing this does not update existing trucks — only new trucks added after this change</div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== DOCUMENTS TAB ==================== */}
      {tab === 'documents' && (
        <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tz-text)' }}>Documents ({documents.length})</div>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 16px',
                background: '#3B82F6',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--tz-bgLight)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              <Upload size={14} /> Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) uploadDocument(file)
                e.target.value = ''
              }}
            />
          </div>

          {documents.length === 0 ? (
            <div style={{ color: 'var(--tz-textSecondary)', textAlign: 'center', padding: 40, fontSize: 13 }}>No documents uploaded yet</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
              <thead>
                <tr>
                  {['Filename', 'Type', 'Date', ''].map(h => (
                    <th key={h} style={{ fontSize: 10, color: 'var(--tz-textSecondary)', textTransform: 'uppercase' as const, letterSpacing: '.05em', padding: '8px 12px', textAlign: 'left' as const, borderBottom: `1px solid ${'var(--tz-border)'}`, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {documents.map((doc: any) => (
                  <tr key={doc.id} style={{ borderBottom: `1px solid ${'var(--tz-border)'}` }}>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--tz-text)', fontWeight: 600 }}>{doc.filename}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--tz-textSecondary)' }}>{doc.file_type || '\u2014'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--tz-textSecondary)' }}>
                      {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : '\u2014'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' as const }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => downloadDocument(doc)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3B82F6', padding: 4 }}
                          title="Download"
                        >
                          <Download size={14} />
                        </button>
                        <button
                          onClick={() => deleteDocument(doc)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tz-textSecondary)', padding: 4 }}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ==================== PARTS TAB ==================== */}
      {tab === 'parts' && (
        <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--tz-text)', marginBottom: 16 }}>Pricing Tier</div>
          <div style={{ fontSize: 12, color: 'var(--tz-textSecondary)', marginBottom: 16, lineHeight: 1.6 }}>
            Determines which price level is used when parts are quoted for this customer&apos;s work orders.
          </div>

          {/* Current tier badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <span style={{ fontSize: 12, color: 'var(--tz-textSecondary)' }}>Current tier:</span>
            <span style={{
              padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700,
              background: customer.pricing_tier === 'ugl_company' ? 'rgba(59,130,246,0.15)' : customer.pricing_tier === 'ugl_owner_operator' ? 'rgba(245,158,11,0.15)' : 'rgba(107,114,128,0.15)',
              color: customer.pricing_tier === 'ugl_company' ? '#3B82F6' : customer.pricing_tier === 'ugl_owner_operator' ? '#F59E0B' : 'var(--tz-textSecondary)',
              textTransform: 'uppercase' as const, letterSpacing: '.03em',
            }}>
              {customer.pricing_tier === 'ugl_company' ? 'UGL Company' : customer.pricing_tier === 'ugl_owner_operator' ? 'UGL Owner Operator' : 'Outside Customer'}
            </span>
          </div>

          {/* Change tier */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <select
              value={customer.pricing_tier || 'outside'}
              onChange={async (e) => {
                const newTier = e.target.value
                const res = await fetch(`/api/customers/${id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ pricing_tier: newTier }),
                })
                if (res.ok) {
                  const updated = await res.json()
                  setCustomer((c: any) => ({ ...c, ...updated }))
                  flash('Pricing tier updated')
                }
              }}
              style={{
                padding: '8px 14px', fontSize: 12, borderRadius: 8,
                background: 'var(--tz-border)', border: `1px solid ${'var(--tz-border)'}`,
                color: 'var(--tz-text)', fontFamily: "'Inter', sans-serif", cursor: 'pointer', outline: 'none',
              }}
            >
              <option value="ugl_company" style={{ background: 'var(--tz-bgCard)' }}>UGL Company</option>
              <option value="ugl_owner_operator" style={{ background: 'var(--tz-bgCard)' }}>UGL Owner Operator</option>
              <option value="outside" style={{ background: 'var(--tz-bgCard)' }}>Outside Customer</option>
            </select>
          </div>

          {/* Tier descriptions */}
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
            {[
              { tier: 'ugl_company', label: 'UGL Company', desc: 'Company-owned trucks on UGL account', color: '#3B82F6' },
              { tier: 'ugl_owner_operator', label: 'UGL Owner Operator', desc: 'Independent operators under UGL', color: '#F59E0B' },
              { tier: 'outside', label: 'Outside Customer', desc: 'Standard outside customer pricing', color: 'var(--tz-textSecondary)' },
            ].map(t => (
              <div key={t.tier} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8,
                background: customer.pricing_tier === t.tier ? 'var(--tz-border)' : 'transparent',
                border: customer.pricing_tier === t.tier ? `1px solid ${t.color}30` : '1px solid transparent',
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tz-text)' }}>{t.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--tz-textSecondary)' }}>{t.desc}</div>
                </div>
                {customer.pricing_tier === t.tier && (
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: t.color, fontWeight: 700 }}>ACTIVE</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== EDIT COMPANY MODAL ==================== */}
      {editModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setEditModal(false)}>
          <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, padding: 24, width: 520, maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto' as const }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--tz-text)' }}>Edit Customer</div>
              <button onClick={() => setEditModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tz-textSecondary)', padding: 4 }}><X size={18} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              {[
                { key: 'company_name', label: 'Company Name' },
                { key: 'contact_name', label: 'Contact Person' },
                { key: 'phone', label: 'Phone' },
                { key: 'email', label: 'Email' },
                { key: 'dot_number', label: 'DOT #' },
                { key: 'mc_number', label: 'MC #' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--tz-textSecondary)', textTransform: 'uppercase' as const, letterSpacing: '.05em', marginBottom: 4, fontWeight: 600 }}>{f.label}</label>
                  <input
                    value={editForm[f.key] || ''}
                    onChange={e => setEditForm((p: any) => ({ ...p, [f.key]: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      background: 'var(--tz-border)',
                      border: `1px solid ${'var(--tz-border)'}`,
                      borderRadius: 8,
                      fontSize: 13,
                      color: 'var(--tz-text)',
                      outline: 'none',
                      fontFamily: "'Inter', sans-serif",
                      boxSizing: 'border-box' as const,
                    }}
                  />
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--tz-textSecondary)', textTransform: 'uppercase' as const, letterSpacing: '.05em', marginBottom: 4, fontWeight: 600 }}>Address</label>
              <input
                value={editForm.address || ''}
                onChange={e => setEditForm((p: any) => ({ ...p, address: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  background: 'var(--tz-border)',
                  border: `1px solid ${'var(--tz-border)'}`,
                  borderRadius: 8,
                  fontSize: 13,
                  color: 'var(--tz-text)',
                  outline: 'none',
                  fontFamily: "'Inter', sans-serif",
                  boxSizing: 'border-box' as const,
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--tz-textSecondary)', textTransform: 'uppercase' as const, letterSpacing: '.05em', marginBottom: 4, fontWeight: 600 }}>Notes</label>
              <textarea
                value={editForm.notes || ''}
                onChange={e => setEditForm((p: any) => ({ ...p, notes: e.target.value }))}
                rows={3}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  background: 'var(--tz-border)',
                  border: `1px solid ${'var(--tz-border)'}`,
                  borderRadius: 8,
                  fontSize: 13,
                  color: 'var(--tz-text)',
                  outline: 'none',
                  fontFamily: "'Inter', sans-serif",
                  boxSizing: 'border-box' as const,
                  resize: 'vertical' as const,
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <button
                onClick={() => setEditForm((p: any) => ({ ...p, is_owner_operator: !p.is_owner_operator, customer_type: !p.is_owner_operator ? 'owner_operator' : 'company' }))}
                style={{
                  width: 36,
                  height: 20,
                  borderRadius: 10,
                  border: 'none',
                  background: editForm.is_owner_operator ? '#D97706' : 'var(--tz-border)',
                  cursor: 'pointer',
                  position: 'relative' as const,
                  transition: 'background 0.2s',
                }}
              >
                <div style={{
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  background: 'var(--tz-bgCard)',
                  position: 'absolute' as const,
                  top: 3,
                  left: editForm.is_owner_operator ? 19 : 3,
                  transition: 'left 0.2s',
                }} />
              </button>
              <span style={{ fontSize: 12, color: 'var(--tz-text)' }}>Owner Operator</span>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditModal(false)}
                style={{ padding: '9px 18px', borderRadius: 8, border: `1px solid ${'var(--tz-border)'}`, background: 'transparent', color: 'var(--tz-textSecondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#3B82F6', color: 'var(--tz-bgLight)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', sans-serif", opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADDITIONAL INFO (external_data) */}
      {customer.external_data && typeof customer.external_data === 'object' && Object.keys(customer.external_data).length > 0 && (
        <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, padding: 16, marginTop: 12 }}>
          <button
            onClick={() => setShowExternalData(!showExternalData)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 700, color: 'var(--tz-text)', display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}
          >
            <span style={{ transform: showExternalData ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', display: 'inline-block' }}>&#9654;</span>
            Additional Info
          </button>
          {showExternalData && (
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {Object.entries(customer.external_data).map(([key, val]) => (
                <div key={key} style={{ fontSize: 12 }}>
                  <span style={{ color: 'var(--tz-textSecondary)', fontWeight: 600 }}>{key.replace(/_/g, ' ')}: </span>
                  <span style={{ color: 'var(--tz-text)' }}>{val != null ? String(val) : '\u2014'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== CONTACT MODAL ==================== */}
      {contactModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setContactModal(false)}>
          <div style={{ background: 'var(--tz-bgCard)', border: `1px solid ${'var(--tz-border)'}`, borderRadius: 12, padding: 24, width: 440, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--tz-text)' }}>{editingContactId ? 'Edit Contact' : 'Add Contact'}</div>
              <button onClick={() => setContactModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tz-textSecondary)', padding: 4 }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { key: 'name', label: 'Name', type: 'text' },
                { key: 'role', label: 'Role', type: 'text' },
                { key: 'phone', label: 'Phone', type: 'text' },
                { key: 'email', label: 'Email', type: 'email' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--tz-textSecondary)', textTransform: 'uppercase' as const, letterSpacing: '.05em', marginBottom: 4, fontWeight: 600 }}>{f.label}</label>
                  <input
                    type={f.type}
                    value={contactForm[f.key] || ''}
                    onChange={e => setContactForm((p: any) => ({ ...p, [f.key]: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      background: 'var(--tz-border)',
                      border: `1px solid ${'var(--tz-border)'}`,
                      borderRadius: 8,
                      fontSize: 13,
                      color: 'var(--tz-text)',
                      outline: 'none',
                      fontFamily: "'Inter', sans-serif",
                      boxSizing: 'border-box' as const,
                    }}
                  />
                </div>
              ))}

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={() => setContactForm((p: any) => ({ ...p, is_primary: !p.is_primary }))}
                  style={{
                    width: 36,
                    height: 20,
                    borderRadius: 10,
                    border: 'none',
                    background: contactForm.is_primary ? '#3B82F6' : 'var(--tz-border)',
                    cursor: 'pointer',
                    position: 'relative' as const,
                    transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    background: 'var(--tz-bgCard)',
                    position: 'absolute' as const,
                    top: 3,
                    left: contactForm.is_primary ? 19 : 3,
                    transition: 'left 0.2s',
                  }} />
                </button>
                <span style={{ fontSize: 12, color: 'var(--tz-text)' }}>Primary contact</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                onClick={() => setContactModal(false)}
                style={{ padding: '9px 18px', borderRadius: 8, border: `1px solid ${'var(--tz-border)'}`, background: 'transparent', color: 'var(--tz-textSecondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}
              >
                Cancel
              </button>
              <button
                onClick={saveContact}
                disabled={saving || !contactForm.name}
                style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#3B82F6', color: 'var(--tz-bgLight)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', sans-serif", opacity: (saving || !contactForm.name) ? 0.5 : 1 }}
              >
                {saving ? 'Saving...' : editingContactId ? 'Update' : 'Add Contact'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
