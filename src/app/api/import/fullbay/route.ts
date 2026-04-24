import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/server-auth'
import { requirePlatformOwner } from '@/lib/route-guards'
import { parse } from 'csv-parse/sync'

function getSupabase() {
  return createAdminSupabaseClient()
}

// ── COLUMN NAME RESOLVER ────────────────────────────────────
function col(row: any, ...names: string[]): string {
  for (const n of names) {
    if (row[n] !== undefined && row[n] !== null && row[n] !== '') return String(row[n]).trim()
  }
  return ''
}

function colNum(row: any, ...names: string[]): number {
  const v = col(row, ...names)
  const n = parseFloat(v.replace(/[$,]/g, ''))
  return isNaN(n) ? 0 : n
}

function colInt(row: any, ...names: string[]): number {
  return Math.round(colNum(row, ...names))
}

// ── STATUS MAPPINGS ─────────────────────────────────────────
const SO_STATUS_MAP: Record<string, string> = {
  'draft': 'draft', 'in progress': 'in_progress', 'waiting': 'waiting_parts',
  'waiting for parts': 'waiting_parts', 'completed': 'done', 'invoiced': 'good_to_go',
  'closed': 'good_to_go', 'cancelled': 'draft', 'approved': 'in_progress',
  'pending approval': 'waiting_approval', 'done': 'done', 'open': 'in_progress',
}

const INV_STATUS_MAP: Record<string, string> = {
  'draft': 'draft', 'sent': 'sent', 'paid': 'paid', 'overdue': 'overdue',
  'void': 'void', 'open': 'sent', 'closed': 'paid', 'partial': 'sent',
}

const CATEGORY_MAP: Record<string, string> = {
  'engine': 'engine', 'motor': 'engine', 'electrical': 'electrical', 'wiring': 'electrical',
  'brake': 'brakes', 'brakes': 'brakes', 'filter': 'filters_fluids', 'fluid': 'filters_fluids',
  'oil': 'filters_fluids', 'transmission': 'transmission', 'body': 'body_chassis',
  'chassis': 'body_chassis', 'tire': 'tires', 'tires': 'tires', 'wheel': 'tires',
  'light': 'lights', 'lights': 'lights', 'lamp': 'lights',
}

function mapCategory(raw: string): string {
  const lower = raw.toLowerCase()
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return val
  }
  return 'other'
}

function mapSOStatus(raw: string): string {
  return SO_STATUS_MAP[raw.toLowerCase()] || 'draft'
}

function mapInvStatus(raw: string): string {
  return INV_STATUS_MAP[raw.toLowerCase()] || 'draft'
}

// ── PARSE CSV ───────────────────────────────────────────────
function parseCSV(text: string): any[] {
  return parse(text, { columns: true, skip_empty_lines: true, trim: true, cast: false, relax_column_count: true })
}

// ── MAIN HANDLER ────────────────────────────────────────────
// POST /api/import/fullbay — import CSV-exported Fullbay data into a shop.
// Platform-owner only: the form-supplied shop_id is destructive (service-role
// inserts across customers/assets/service_orders/invoices/parts), so the actor
// must prove platform-owner status on the server before any write is permitted.
export async function POST(req: Request) {
  const { error: authError } = await requirePlatformOwner()
  if (authError) return authError

  const supabase = getSupabase()

  try {
    const formData = await req.formData()
    const shopId = formData.get('shop_id') as string
    const type = formData.get('type') as string
    const file = formData.get('file') as File

    if (!shopId || !type || !file) {
      return NextResponse.json({ error: 'shop_id, type, and file are required' }, { status: 400 })
    }

    const text = await file.text()
    const rows = parseCSV(text)

    if (!rows.length) {
      return NextResponse.json({ error: 'CSV file is empty or has no valid rows' }, { status: 400 })
    }

    const result = { created: 0, skipped: 0, errors: 0, total: rows.length, details: [] as string[] }

    switch (type) {
      case 'customers':
        await importCustomers(supabase, shopId, rows, result)
        break
      case 'vehicles':
        await importVehicles(supabase, shopId, rows, result)
        break
      case 'work_orders':
        await importWorkOrders(supabase, shopId, rows, result)
        break
      case 'invoices':
        await importInvoices(supabase, shopId, rows, result)
        break
      case 'parts':
        await importParts(supabase, shopId, rows, result)
        break
      default:
        return NextResponse.json({ error: `Unknown import type: ${type}` }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Import failed' }, { status: 500 })
  }
}

// ── CUSTOMERS ───────────────────────────────────────────────
async function importCustomers(supabase: any, shopId: string, rows: any[], result: any) {
  const { data: existing } = await supabase.from('customers').select('id, company_name').eq('shop_id', shopId)
  const existingNames = new Set((existing || []).map((c: any) => c.company_name.toLowerCase()))

  for (const row of rows) {
    const name = col(row, 'Company Name', 'company_name', 'Name', 'Customer Name', 'Company')
    if (!name || name.toLowerCase() === 'unknown') { result.skipped++; continue }

    if (existingNames.has(name.toLowerCase())) { result.skipped++; continue }

    const { error } = await supabase.from('customers').insert({
      shop_id: shopId,
      company_name: name,
      contact_name: col(row, 'Contact Name', 'contact_name', 'Contact'),
      phone: col(row, 'Phone', 'phone', 'Phone Number'),
      email: col(row, 'Email', 'email'),
      address: col(row, 'Address', 'address', 'Street Address'),
      notes: col(row, 'Notes', 'notes'),
      source: 'walk_in',
    })

    if (error) { result.errors++; result.details.push(`Customer "${name}": ${error.message}`) }
    else { result.created++; existingNames.add(name.toLowerCase()) }
  }
}

// ── VEHICLES ────────────────────────────────────────────────
async function importVehicles(supabase: any, shopId: string, rows: any[], result: any) {
  const { data: existing } = await supabase.from('assets').select('id, unit_number').eq('shop_id', shopId)
  const existingUnits = new Set((existing || []).map((a: any) => a.unit_number.toLowerCase()))

  // Load customers for linking
  const { data: customers } = await supabase.from('customers').select('id, company_name').eq('shop_id', shopId)
  const custMap = new Map((customers || []).map((c: any) => [c.company_name.toLowerCase(), c.id]))

  for (const row of rows) {
    const unit = col(row, 'Unit', 'unit_number', 'Unit Number', 'Vehicle', 'Truck #', 'Unit #')
    if (!unit) { result.skipped++; continue }

    if (existingUnits.has(unit.toLowerCase())) { result.skipped++; continue }

    const custName = col(row, 'Customer', 'customer', 'Company', 'Company Name')
    const customerId = custMap.get(custName.toLowerCase()) || null

    const vin = col(row, 'VIN', 'vin')

    const { error } = await supabase.from('assets').insert({
      shop_id: shopId,
      unit_number: unit,
      asset_type: col(row, 'Type', 'asset_type', 'Vehicle Type').toLowerCase() || 'truck',
      year: colInt(row, 'Year', 'year') || null,
      make: col(row, 'Make', 'make'),
      model: col(row, 'Model', 'model'),
      vin: vin || null,
      license_plate: col(row, 'License Plate', 'license_plate', 'Plate'),
      license_state: col(row, 'License State', 'license_state', 'State'),
      odometer: colInt(row, 'Odometer', 'odometer', 'Mileage') || 0,
      engine_hours: colNum(row, 'Engine Hours', 'engine_hours', 'Hours') || 0,
      customer_id: customerId,
      status: 'on_road',
    })

    if (error) { result.errors++; result.details.push(`Vehicle "${unit}": ${error.message}`) }
    else { result.created++; existingUnits.add(unit.toLowerCase()) }
  }
}

// ── WORK ORDERS → SERVICE ORDERS ────────────────────────────
async function importWorkOrders(supabase: any, shopId: string, rows: any[], result: any) {
  // Load lookups
  const { data: customers } = await supabase.from('customers').select('id, company_name').eq('shop_id', shopId)
  const custMap = new Map((customers || []).map((c: any) => [c.company_name.toLowerCase(), c.id]))

  const { data: assets } = await supabase.from('assets').select('id, unit_number').eq('shop_id', shopId)
  const assetMap = new Map((assets || []).map((a: any) => [a.unit_number.toLowerCase(), a.id]))

  // Get current SO count for numbering
  const { count } = await supabase.from('service_orders').select('id', { count: 'exact', head: true }).eq('shop_id', shopId)
  let soNum = (count || 0) + 1

  for (const row of rows) {
    const fbId = col(row, 'ID', 'id', 'Work Order #', 'WO #', 'Work Order ID')
    const complaint = col(row, 'Complaint', 'complaint', 'Description', 'Notes', 'Issue')
    const unit = col(row, 'Unit', 'unit_number', 'Vehicle', 'Truck #', 'Unit #')
    const custName = col(row, 'Customer', 'customer', 'Company', 'Company Name')

    // Skip if already imported (check internal_notes)
    if (fbId) {
      const { data: dup } = await supabase.from('service_orders')
        .select('id').eq('shop_id', shopId).ilike('internal_notes', `%fullbay:${fbId}%`).limit(1)
      if (dup?.length) { result.skipped++; continue }
    }

    const customerId = custMap.get(custName.toLowerCase()) || null
    const assetId = assetMap.get(unit.toLowerCase()) || null

    const laborTotal = colNum(row, 'Labor Total', 'labor_total', 'Labor')
    const partsTotal = colNum(row, 'Parts Total', 'parts_total', 'Parts')
    const taxTotal = (laborTotal + partsTotal) * 0.0825

    const soNumber = `SO-${String(soNum).padStart(5, '0')}`
    soNum++

    const { error } = await supabase.from('service_orders').insert({
      shop_id: shopId,
      so_number: soNumber,
      status: mapSOStatus(col(row, 'Status', 'status')),
      source: 'walk_in',
      priority: 'normal',
      asset_id: assetId,
      customer_id: customerId,
      odometer_in: colInt(row, 'Odometer In', 'odometer_in', 'Mileage In') || null,
      complaint: complaint || 'Imported from FullBay',
      cause: col(row, 'Cause', 'cause'),
      correction: col(row, 'Correction', 'correction'),
      internal_notes: `fullbay:${fbId || 'unknown'}\nMigrated from FullBay — ${new Date().toISOString()}`,
      labor_total: laborTotal,
      parts_total: partsTotal,
      tax_total: Math.round(taxTotal * 100) / 100,
      grand_total: Math.round((laborTotal + partsTotal + taxTotal) * 100) / 100,
      created_at: col(row, 'Created At', 'created_at', 'Date', 'Created') || new Date().toISOString(),
    })

    if (error) { result.errors++; result.details.push(`WO "${fbId || soNumber}": ${error.message}`) }
    else { result.created++ }
  }
}

// ── INVOICES ────────────────────────────────────────────────
async function importInvoices(supabase: any, shopId: string, rows: any[], result: any) {
  const { data: customers } = await supabase.from('customers').select('id, company_name').eq('shop_id', shopId)
  const custMap = new Map((customers || []).map((c: any) => [c.company_name.toLowerCase(), c.id]))

  const { data: existingInvs } = await supabase.from('invoices').select('invoice_number').eq('shop_id', shopId)
  const existingNums = new Set((existingInvs || []).map((i: any) => i.invoice_number))

  for (const row of rows) {
    const fbId = col(row, 'ID', 'id', 'Invoice #', 'Invoice ID')
    const invNum = col(row, 'Invoice Number', 'invoice_number', 'Number') || `INV-FB-${fbId || result.created + 1}`

    if (existingNums.has(invNum)) { result.skipped++; continue }

    const custName = col(row, 'Customer', 'customer', 'Company', 'Company Name')
    const customerId = custMap.get(custName.toLowerCase()) || null

    const total = colNum(row, 'Total', 'total', 'Amount', 'Grand Total')
    const tax = colNum(row, 'Tax', 'tax', 'Tax Amount') || Math.round(total * 0.0825 * 100) / 100
    const subtotal = Math.max(total - tax, 0) || total
    const amountPaid = colNum(row, 'Amount Paid', 'amount_paid', 'Paid')
    const status = mapInvStatus(col(row, 'Status', 'status'))

    const { error } = await supabase.from('invoices').insert({
      shop_id: shopId,
      invoice_number: invNum,
      customer_id: customerId,
      status,
      subtotal,
      tax_amount: tax,
      total,
      amount_paid: amountPaid,
      payment_method: col(row, 'Payment Method', 'payment_method') || null,
      due_date: col(row, 'Due Date', 'due_date') || null,
      paid_at: status === 'paid' ? (col(row, 'Paid At', 'paid_at') || new Date().toISOString()) : null,
      sent_at: ['sent', 'paid', 'overdue'].includes(status) ? (col(row, 'Sent At', 'sent_at') || new Date().toISOString()) : null,
      created_at: col(row, 'Created At', 'created_at', 'Date', 'Created') || new Date().toISOString(),
    })

    if (error) { result.errors++; result.details.push(`Invoice "${invNum}": ${error.message}`) }
    else { result.created++; existingNums.add(invNum) }
  }
}

// ── PARTS ───────────────────────────────────────────────────
async function importParts(supabase: any, shopId: string, rows: any[], result: any) {
  const { data: existing } = await supabase.from('parts').select('id, part_number').eq('shop_id', shopId)
  const existingPNs = new Set((existing || []).map((p: any) => p.part_number.toLowerCase()))

  for (const row of rows) {
    const pn = col(row, 'Part Number', 'part_number', 'SKU', 'PN', 'Number')
    if (!pn) { result.skipped++; continue }

    if (existingPNs.has(pn.toLowerCase())) { result.skipped++; continue }

    const { error } = await supabase.from('parts').insert({
      shop_id: shopId,
      part_number: pn,
      description: col(row, 'Description', 'description', 'Name', 'Part Name') || pn,
      category: mapCategory(col(row, 'Category', 'category')),
      on_hand: colInt(row, 'Quantity On Hand', 'quantity', 'on_hand', 'Qty', 'Stock'),
      reorder_point: colInt(row, 'Reorder Point', 'reorder_point', 'Min Stock') || 2,
      cost_price: colNum(row, 'Cost', 'cost_price', 'Cost Price'),
      sell_price: colNum(row, 'Sell Price', 'sell_price', 'Price', 'Retail'),
      vendor: col(row, 'Vendor', 'vendor', 'Supplier'),
      bin_location: col(row, 'Bin', 'bin_location', 'Location', 'Bin Location'),
    })

    if (error) { result.errors++; result.details.push(`Part "${pn}": ${error.message}`) }
    else { result.created++; existingPNs.add(pn.toLowerCase()) }
  }
}
