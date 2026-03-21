import type { RawCustomer, RawVehicle, RawServiceOrder, RawInvoice, RawPart } from './base'

// ── Date parsing ────────────────────────────────────────────
export function parseDate(val: string | undefined): string | null {
  if (!val) return null
  const v = val.trim()
  if (!v) return null
  // Unix timestamp (seconds)
  if (/^\d{10,13}$/.test(v)) {
    const ms = v.length === 10 ? parseInt(v) * 1000 : parseInt(v)
    return new Date(ms).toISOString()
  }
  // ISO: YYYY-MM-DD...
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return new Date(v).toISOString()
  // MM/DD/YYYY or M/D/YY
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(v)) {
    const [m, d, y] = v.split('/')
    const yr = y.length === 2 ? `20${y}` : y
    return new Date(`${yr}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`).toISOString()
  }
  // DD-MMM-YY (like 15-Mar-24)
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

// ── Money parsing ───────────────────────────────────────────
export function parseMoney(val: string | number | undefined): number {
  if (val == null) return 0
  if (typeof val === 'number') return val
  const cleaned = val.replace(/[$,\s]/g, '')
  // Handle parenthetical negatives like (100.00)
  if (/^\([\d.]+\)$/.test(cleaned)) {
    return -parseFloat(cleaned.replace(/[()]/g, '')) || 0
  }
  return parseFloat(cleaned) || 0
}

// ── Number parsing ──────────────────────────────────────────
function parseNum(val: string | number | undefined): number {
  if (val == null) return 0
  if (typeof val === 'number') return val
  return parseFloat(val.replace(/[,\s]/g, '')) || 0
}

function parseIntSafe(val: string | number | undefined): number | null {
  if (val == null) return null
  if (typeof val === 'number') return Math.round(val)
  const n = parseInt(val.replace(/[,\s]/g, ''))
  return isNaN(n) ? null : n
}

// ── Status mapping ──────────────────────────────────────────
const SO_STATUS_MAP: Record<string, string> = {
  'completed': 'done', 'complete': 'done', 'closed': 'done',
  'invoiced': 'done', 'in progress': 'in_progress', 'in-progress': 'in_progress',
  'waiting on parts': 'waiting_parts', 'waiting parts': 'waiting_parts',
  'waiting on auth': 'waiting_approval', 'waiting for approval': 'waiting_approval',
  'pending approval': 'waiting_approval', 'on hold': 'draft',
  'open': 'in_progress', 'new': 'draft', 'draft': 'draft',
  'done': 'done', 'cancelled': 'draft', 'canceled': 'draft',
}

export function mapSOStatus(status: string): string {
  return SO_STATUS_MAP[status.toLowerCase().trim()] || 'done'
}

const INV_STATUS_MAP: Record<string, string> = {
  'paid': 'paid', 'unpaid': 'sent', 'outstanding': 'sent',
  'partial': 'partial', 'partially paid': 'partial',
  'void': 'void', 'voided': 'void', 'draft': 'draft',
  'sent': 'sent', 'open': 'sent', 'overdue': 'overdue',
  'closed': 'paid', 'collected': 'paid',
}

export function mapInvoiceStatus(status: string): string {
  return INV_STATUS_MAP[status.toLowerCase().trim()] || 'sent'
}

// ── Column resolver ─────────────────────────────────────────
type ColMapping = Record<string, string>

function resolve(row: Record<string, any>, mapping: ColMapping, field: string): string {
  const col = mapping[field]
  if (!col) return ''
  const val = row[col]
  if (val == null || val === '') return ''
  return String(val).trim()
}

// ── Customer mapper ─────────────────────────────────────────
export function mapCustomerRows(rows: Record<string, any>[], colMappings: ColMapping): RawCustomer[] {
  return rows.map(row => {
    const c: RawCustomer = {
      external_id: resolve(row, colMappings, 'external_id') || undefined,
      company_name: resolve(row, colMappings, 'company_name'),
      dba_name: resolve(row, colMappings, 'dba_name') || undefined,
      dot_number: resolve(row, colMappings, 'dot_number') || undefined,
      mc_number: resolve(row, colMappings, 'mc_number') || undefined,
      phone: resolve(row, colMappings, 'phone') || undefined,
      email: resolve(row, colMappings, 'email') || undefined,
      address: resolve(row, colMappings, 'address') || undefined,
      city: resolve(row, colMappings, 'city') || undefined,
      state: resolve(row, colMappings, 'state') || undefined,
      zip: resolve(row, colMappings, 'zip') || undefined,
      payment_terms: resolve(row, colMappings, 'payment_terms') || undefined,
      notes: resolve(row, colMappings, 'notes') || undefined,
    }
    const taxStr = resolve(row, colMappings, 'tax_rate')
    if (taxStr) c.tax_rate = parseNum(taxStr)
    // Contact from same row
    const contactName = resolve(row, colMappings, 'contact_name')
    if (contactName) {
      c.contacts = [{
        name: contactName,
        phone: resolve(row, colMappings, 'contact_phone') || undefined,
        email: resolve(row, colMappings, 'contact_email') || undefined,
        role: resolve(row, colMappings, 'contact_role') || undefined,
        is_primary: true,
      }]
    }
    return c
  }).filter(c => c.company_name)
}

// ── Vehicle mapper ──────────────────────────────────────────
export function mapVehicleRows(rows: Record<string, any>[], colMappings: ColMapping): RawVehicle[] {
  return rows.map(row => {
    const v: RawVehicle = {
      external_id: resolve(row, colMappings, 'external_id') || undefined,
      unit_number: resolve(row, colMappings, 'unit_number'),
      vin: resolve(row, colMappings, 'vin') || undefined,
      unit_type: resolve(row, colMappings, 'unit_type') || undefined,
      year: parseIntSafe(resolve(row, colMappings, 'year')),
      make: resolve(row, colMappings, 'make') || undefined,
      model: resolve(row, colMappings, 'model') || undefined,
      engine: resolve(row, colMappings, 'engine') || undefined,
      transmission: resolve(row, colMappings, 'transmission') || undefined,
      mileage: parseIntSafe(resolve(row, colMappings, 'mileage')),
      license_plate: resolve(row, colMappings, 'license_plate') || undefined,
      license_state: resolve(row, colMappings, 'license_state') || undefined,
      customer_name: resolve(row, colMappings, 'customer_name') || undefined,
      customer_external_id: resolve(row, colMappings, 'customer_external_id') || undefined,
      status: resolve(row, colMappings, 'status') || undefined,
    }
    return v
  }).filter(v => v.unit_number)
}

// ── Service Order mapper ────────────────────────────────────
export function mapServiceOrderRows(rows: Record<string, any>[], colMappings: ColMapping): RawServiceOrder[] {
  return rows.map(row => {
    const so: RawServiceOrder = {
      external_id: resolve(row, colMappings, 'external_id') || undefined,
      so_number: resolve(row, colMappings, 'so_number'),
      customer_name: resolve(row, colMappings, 'customer_name') || undefined,
      customer_external_id: resolve(row, colMappings, 'customer_external_id') || undefined,
      unit_number: resolve(row, colMappings, 'unit_number') || undefined,
      unit_vin: resolve(row, colMappings, 'unit_vin') || undefined,
      status: resolve(row, colMappings, 'status') || undefined,
      priority: resolve(row, colMappings, 'priority') || undefined,
      concern: resolve(row, colMappings, 'concern') || resolve(row, colMappings, 'complaint') || undefined,
      cause: resolve(row, colMappings, 'cause') || undefined,
      correction: resolve(row, colMappings, 'correction') || undefined,
      tech_name: resolve(row, colMappings, 'tech_name') || undefined,
      date_created: parseDate(resolve(row, colMappings, 'date_created')) || undefined,
      date_completed: parseDate(resolve(row, colMappings, 'date_completed')) || undefined,
      total_labor_hours: parseNum(resolve(row, colMappings, 'total_labor_hours')) || undefined,
      total_parts_cost: parseMoney(resolve(row, colMappings, 'total_parts_cost')) || undefined,
      total_amount: parseMoney(resolve(row, colMappings, 'total_amount')) || undefined,
    }
    return so
  }).filter(so => so.so_number)
}

// ── Invoice mapper ──────────────────────────────────────────
export function mapInvoiceRows(rows: Record<string, any>[], colMappings: ColMapping): RawInvoice[] {
  return rows.map(row => {
    const inv: RawInvoice = {
      external_id: resolve(row, colMappings, 'external_id') || undefined,
      invoice_number: resolve(row, colMappings, 'invoice_number'),
      so_number: resolve(row, colMappings, 'so_number') || undefined,
      customer_name: resolve(row, colMappings, 'customer_name') || undefined,
      customer_external_id: resolve(row, colMappings, 'customer_external_id') || undefined,
      status: resolve(row, colMappings, 'status') || undefined,
      subtotal: parseMoney(resolve(row, colMappings, 'subtotal')) || undefined,
      tax_rate: parseNum(resolve(row, colMappings, 'tax_rate')) || undefined,
      tax_amount: parseMoney(resolve(row, colMappings, 'tax_amount')) || undefined,
      total: parseMoney(resolve(row, colMappings, 'total')) || undefined,
      amount_paid: parseMoney(resolve(row, colMappings, 'amount_paid')) || undefined,
      balance_due: parseMoney(resolve(row, colMappings, 'balance_due')) || undefined,
      payment_terms: resolve(row, colMappings, 'payment_terms') || undefined,
      due_date: parseDate(resolve(row, colMappings, 'due_date')) || undefined,
      paid_at: parseDate(resolve(row, colMappings, 'paid_at')) || undefined,
      payment_method: resolve(row, colMappings, 'payment_method') || undefined,
      date_created: parseDate(resolve(row, colMappings, 'date_created')) || undefined,
    }
    return inv
  }).filter(inv => inv.invoice_number)
}

// ── Part mapper ─────────────────────────────────────────────
export function mapPartRows(rows: Record<string, any>[], colMappings: ColMapping): RawPart[] {
  return rows.map(row => {
    const p: RawPart = {
      part_number: resolve(row, colMappings, 'part_number') || undefined,
      description: resolve(row, colMappings, 'description'),
      quantity: parseNum(resolve(row, colMappings, 'quantity')) || undefined,
      unit_cost: parseMoney(resolve(row, colMappings, 'unit_cost')) || undefined,
      sell_price: parseMoney(resolve(row, colMappings, 'sell_price')) || undefined,
      vendor: resolve(row, colMappings, 'vendor') || undefined,
      location: resolve(row, colMappings, 'location') || undefined,
      min_stock: parseNum(resolve(row, colMappings, 'min_stock')) || undefined,
      category: resolve(row, colMappings, 'category') || undefined,
    }
    return p
  }).filter(p => p.description)
}
