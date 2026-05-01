import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/server-auth'
import { requirePlatformOwner } from '@/lib/route-guards'
import * as Sentry from '@sentry/nextjs'
import type { RawCustomer, RawVehicle, RawServiceOrder, RawInvoice, RawPart, RawTechnician } from '@/lib/services/connectors/base'
import { mapSOStatus, mapInvoiceStatus, parseMoney, parseDate } from '@/lib/services/connectors/csv'

function db() {
  return createAdminSupabaseClient()
}

const BATCH_SIZE = 50
const NHTSA_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVINValuesBatch/'

interface ImportResult {
  imported: number
  updated: number
  skipped: number
  errors: { record: string; message: string }[]
}

// ── VIN decode (batch, max 5/sec to NHTSA) ──────────────────
async function vinDecodeBatch(vins: string[]): Promise<Map<string, { year: number; make: string; model: string }>> {
  const result = new Map<string, { year: number; make: string; model: string }>()
  if (!vins.length) return result

  // NHTSA batch endpoint accepts semicolon-separated VINs
  const chunks: string[][] = []
  for (let i = 0; i < vins.length; i += 50) {
    chunks.push(vins.slice(i, i + 50))
  }

  for (const chunk of chunks) {
    try {
      const body = new URLSearchParams({ format: 'json', data: chunk.join(';') })
      const res = await fetch(NHTSA_URL, { method: 'POST', body })
      if (!res.ok) continue
      const json = await res.json()
      for (const r of json.Results || []) {
        const vin = r.VIN
        if (!vin) continue
        const year = parseInt(r.ModelYear)
        const make = r.Make || ''
        const model = r.Model || ''
        if (year && make) {
          result.set(vin.toUpperCase(), { year, make, model })
        }
      }
      // Rate limit: wait 200ms between batches (5/sec)
      if (chunks.length > 1) await new Promise(r => setTimeout(r, 200))
    } catch {
      // Continue without decode data
    }
  }

  return result
}

// ── CUSTOMERS ───────────────────────────────────────────────
async function importCustomers(supabase: any, shopId: string, rows: RawCustomer[], options: any): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, updated: 0, skipped: 0, errors: [] }

  // Load existing for dedup
  const { data: existing } = await supabase.from('customers')
    .select('id, company_name, dot_number')
    .eq('shop_id', shopId)
  const dotMap = new Map<string, string>()
  const nameMap = new Map<string, string>()
  for (const c of existing || []) {
    if (c.dot_number) dotMap.set(c.dot_number.toLowerCase(), c.id)
    nameMap.set(c.company_name.toLowerCase(), c.id)
  }

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)

    for (const row of batch) {
      try {
        if (!row.company_name || row.company_name.toLowerCase() === 'unknown') {
          result.skipped++
          continue
        }

        // Dedup: DOT first, then name
        let existingId: string | undefined
        if (row.dot_number) existingId = dotMap.get(row.dot_number.toLowerCase())
        if (!existingId) existingId = nameMap.get(row.company_name.toLowerCase())

        if (existingId) {
          if (options.skip_duplicates) {
            result.skipped++
            continue
          }
          // Update existing
          const updates: any = {}
          if (row.dot_number) updates.dot_number = row.dot_number
          if (row.mc_number) updates.mc_number = row.mc_number
          if (row.phone) updates.phone = row.phone
          if (row.email) updates.email = row.email.toLowerCase()
          if (row.address) updates.address = row.address
          if (row.payment_terms) updates.payment_terms = row.payment_terms
          if (row.notes) updates.notes = row.notes

          if (Object.keys(updates).length > 0) {
            const { error } = await supabase.from('customers').update(updates).eq('id', existingId)
            if (error) {
              result.errors.push({ record: row.company_name, message: error.message })
            } else {
              result.updated++
            }
          } else {
            result.skipped++
          }
          continue
        }

        // Build full address
        let address = row.address || ''
        if (row.city || row.state || row.zip) {
          const parts = [row.city, row.state, row.zip].filter(Boolean)
          if (address) address += ', '
          address += parts.join(', ')
        }

        const { data: inserted, error } = await supabase.from('customers').insert({
          shop_id: shopId,
          company_name: row.company_name.trim(),
          dba_name: row.dba_name || null,
          dot_number: row.dot_number || null,
          mc_number: row.mc_number || null,
          phone: row.phone || null,
          email: row.email?.toLowerCase() || null,
          address: address || null,
          payment_terms: row.payment_terms || null,
          notes: row.notes || null,
          source: 'migration',
        }).select('id').single()

        if (error) {
          result.errors.push({ record: row.company_name, message: error.message })
          continue
        }

        result.imported++
        nameMap.set(row.company_name.toLowerCase(), inserted.id)
        if (row.dot_number) dotMap.set(row.dot_number.toLowerCase(), inserted.id)

        // Insert contacts
        if (row.contacts?.length && inserted.id) {
          for (const ct of row.contacts) {
            if (!ct.name) continue
            await supabase.from('customer_contacts').insert({
              customer_id: inserted.id,
              name: ct.name,
              phone: ct.phone || null,
              email: ct.email || null,
              role: ct.role || null,
              is_primary: ct.is_primary || false,
            })
          }
        }
      } catch (err: any) {
        result.errors.push({ record: row.company_name || 'unknown', message: err.message })
      }
    }
  }

  return result
}

// ── VEHICLES ────────────────────────────────────────────────
async function importVehicles(supabase: any, shopId: string, rows: RawVehicle[], options: any): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, updated: 0, skipped: 0, errors: [] }

  // Load existing
  const { data: existing } = await supabase.from('assets')
    .select('id, unit_number, vin')
    .eq('shop_id', shopId)
  const vinMap = new Map<string, string>()
  const unitMap = new Map<string, string>()
  for (const a of existing || []) {
    if (a.vin && a.vin.length === 17) vinMap.set(a.vin.toUpperCase(), a.id)
    unitMap.set(a.unit_number.toLowerCase(), a.id)
  }

  // Load customers for linking
  const { data: customers } = await supabase.from('customers')
    .select('id, company_name')
    .eq('shop_id', shopId)
  const custMap = new Map<string, string>()
  for (const c of customers || []) {
    custMap.set(c.company_name.toLowerCase(), c.id)
  }

  // Collect VINs that need decode
  const vinsToDecodeSet = new Set<string>()
  for (const row of rows) {
    if (row.vin && row.vin.length === 17 && (!row.year || !row.make || !row.model)) {
      vinsToDecodeSet.add(row.vin.toUpperCase())
    }
  }
  const decoded = await vinDecodeBatch(Array.from(vinsToDecodeSet))

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)

    for (const row of batch) {
      try {
        if (!row.unit_number) { result.skipped++; continue }

        const vin = row.vin?.toUpperCase()
        let existingId: string | undefined

        // Dedup: VIN first (exact 17), then unit_number+customer
        if (vin && vin.length === 17) existingId = vinMap.get(vin)
        if (!existingId) existingId = unitMap.get(row.unit_number.toLowerCase())

        if (existingId) {
          if (options.skip_duplicates) {
            result.skipped++
            continue
          }
          const updates: any = {}
          if (vin && vin.length === 17) updates.vin = vin
          if (row.year) updates.year = row.year
          if (row.make) updates.make = row.make
          if (row.model) updates.model = row.model
          if (row.mileage) updates.odometer = row.mileage
          if (row.license_plate) updates.license_plate = row.license_plate
          if (row.engine) updates.engine = row.engine

          if (Object.keys(updates).length > 0) {
            const { error } = await supabase.from('assets').update(updates).eq('id', existingId)
            if (error) {
              result.errors.push({ record: row.unit_number, message: error.message })
            } else {
              result.updated++
            }
          } else {
            result.skipped++
          }
          continue
        }

        // VIN decode fill
        let year = row.year
        let make = row.make
        let model = row.model
        if (vin && decoded.has(vin)) {
          const d = decoded.get(vin)!
          if (!year) year = d.year
          if (!make) make = d.make
          if (!model) model = d.model
        }

        const customerId = row.customer_name
          ? custMap.get(row.customer_name.toLowerCase()) || null
          : null

        const { data: inserted, error } = await supabase.from('assets').insert({
          shop_id: shopId,
          unit_number: row.unit_number,
          vin: vin || null,
          asset_type: row.unit_type?.toLowerCase() || 'truck',
          year: year || null,
          make: make || null,
          model: model || null,
          engine: row.engine || null,
          transmission: row.transmission || null,
          odometer: row.mileage || 0,
          license_plate: row.license_plate || null,
          license_state: row.license_state || null,
          customer_id: customerId,
          status: 'on_road',
        }).select('id').single()

        if (error) {
          result.errors.push({ record: row.unit_number, message: error.message })
          continue
        }

        result.imported++
        unitMap.set(row.unit_number.toLowerCase(), inserted.id)
        if (vin && vin.length === 17) vinMap.set(vin, inserted.id)
      } catch (err: any) {
        result.errors.push({ record: row.unit_number || 'unknown', message: err.message })
      }
    }
  }

  return result
}

// ── SERVICE ORDERS ──────────────────────────────────────────
async function importServiceOrders(supabase: any, shopId: string, rows: RawServiceOrder[], options: any): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, updated: 0, skipped: 0, errors: [] }

  // Load lookups
  const { data: customers } = await supabase.from('customers')
    .select('id, company_name, dot_number')
    .eq('shop_id', shopId)
  const custNameMap = new Map<string, string>()
  const custDotMap = new Map<string, string>()
  for (const c of customers || []) {
    custNameMap.set(c.company_name.toLowerCase(), c.id)
    if (c.dot_number) custDotMap.set(c.dot_number, c.id)
  }

  const { data: assets } = await supabase.from('assets')
    .select('id, unit_number, vin')
    .eq('shop_id', shopId)
  const assetUnitMap = new Map<string, string>()
  const assetVinMap = new Map<string, string>()
  for (const a of assets || []) {
    assetUnitMap.set(a.unit_number.toLowerCase(), a.id)
    if (a.vin) assetVinMap.set(a.vin.toUpperCase(), a.id)
  }

  // Get current SO count for numbering
  const { count: soCount } = await supabase.from('service_orders')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', shopId)
  let soNum = (soCount || 0) + 1

  // Track imported external IDs for dedup
  const { data: existingSOs } = await supabase.from('service_orders')
    .select('id, internal_notes')
    .eq('shop_id', shopId)
    .not('internal_notes', 'is', null)
  const importedExtIds = new Set<string>()
  for (const so of existingSOs || []) {
    const match = so.internal_notes?.match(/ext_id:(\S+)/)
    if (match) importedExtIds.add(match[1])
  }

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)

    for (const row of batch) {
      try {
        if (!row.so_number) { result.skipped++; continue }

        // Dedup by external_id
        if (row.external_id && importedExtIds.has(row.external_id)) {
          result.skipped++
          continue
        }

        // Resolve customer
        let customerId: string | null = null
        if (row.customer_name) customerId = custNameMap.get(row.customer_name.toLowerCase()) || null

        // Resolve asset
        let assetId: string | null = null
        if (row.unit_vin) assetId = assetVinMap.get(row.unit_vin.toUpperCase()) || null
        if (!assetId && row.unit_number) assetId = assetUnitMap.get(row.unit_number.toLowerCase()) || null

        const status = row.status ? mapSOStatus(row.status) : 'done'
        const internalSoNumber = `SO-${String(soNum).padStart(5, '0')}`
        soNum++

        const laborTotal = row.total_labor_hours ? (row.total_labor_hours * 125) : 0 // Estimate $125/hr if only hours given
        const partsTotal = row.total_parts_cost || 0
        const totalAmount = row.total_amount || (laborTotal + partsTotal)
        const taxTotal = Math.round(totalAmount * 0.0825 * 100) / 100

        const { data: inserted, error } = await supabase.from('service_orders').insert({
          shop_id: shopId,
          so_number: internalSoNumber,
          status,
          source: 'walk_in',
          priority: row.priority || 'normal',
          asset_id: assetId,
          customer_id: customerId,
          complaint: row.concern || 'Imported service order',
          cause: row.cause || null,
          correction: row.correction || null,
          internal_notes: `ext_id:${row.external_id || row.so_number}\nOriginal #: ${row.so_number}\nMigrated -- ${new Date().toISOString()}`,
          labor_total: laborTotal,
          parts_total: partsTotal,
          tax_total: taxTotal,
          grand_total: Math.round((totalAmount + taxTotal) * 100) / 100,
          is_historical: true,
          created_at: row.date_created || new Date().toISOString(),
        }).select('id').single()

        if (error) {
          result.errors.push({ record: row.so_number, message: error.message })
          continue
        }

        result.imported++
        if (row.external_id) importedExtIds.add(row.external_id)

        // Insert line items
        if (row.lines?.length && inserted?.id) {
          for (const line of row.lines) {
            await supabase.from('so_lines').insert({
              service_order_id: inserted.id,
              line_type: line.line_type || 'labor',
              description: line.description || '',
              part_number: line.part_number || null,
              quantity: line.quantity || 1,
              unit_price: line.unit_price || 0,
              total_price: line.total_price || 0,
              hours: line.hours || null,
              tech_name: line.tech_name || null,
            })
          }
        }
      } catch (err: any) {
        result.errors.push({ record: row.so_number || 'unknown', message: err.message })
      }
    }
  }

  return result
}

// ── INVOICES ────────────────────────────────────────────────
async function importInvoices(supabase: any, shopId: string, rows: RawInvoice[], options: any): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, updated: 0, skipped: 0, errors: [] }

  // Load lookups
  const { data: customers } = await supabase.from('customers')
    .select('id, company_name')
    .eq('shop_id', shopId)
  const custMap = new Map<string, string>()
  for (const c of customers || []) {
    custMap.set(c.company_name.toLowerCase(), c.id)
  }

  // Load SOs for linking
  const { data: serviceOrders } = await supabase.from('service_orders')
    .select('id, so_number, internal_notes')
    .eq('shop_id', shopId)
  const soMap = new Map<string, string>()
  for (const so of serviceOrders || []) {
    soMap.set(so.so_number.toLowerCase(), so.id)
    // Also map original numbers from internal_notes
    const match = so.internal_notes?.match(/Original #: (\S+)/)
    if (match) soMap.set(match[1].toLowerCase(), so.id)
  }

  // Existing invoices for dedup
  const { data: existingInvs } = await supabase.from('invoices')
    .select('invoice_number')
    .eq('shop_id', shopId)
  const existingNums = new Set((existingInvs || []).map((i: any) => i.invoice_number.toLowerCase()))

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)

    for (const row of batch) {
      try {
        if (!row.invoice_number) { result.skipped++; continue }

        if (existingNums.has(row.invoice_number.toLowerCase())) {
          result.skipped++
          continue
        }

        const customerId = row.customer_name
          ? custMap.get(row.customer_name.toLowerCase()) || null
          : null

        const soId = row.so_number
          ? soMap.get(row.so_number.toLowerCase()) || null
          : null

        const status = row.status ? mapInvoiceStatus(row.status) : 'sent'
        const total = row.total || 0
        const taxAmount = row.tax_amount || (row.tax_rate ? Math.round(total * row.tax_rate * 100) / 100 : 0)
        const subtotal = row.subtotal || Math.max(total - taxAmount, 0)
        const amountPaid = row.amount_paid || (status === 'paid' ? total : 0)
        const balanceDue = row.balance_due ?? (total - amountPaid)

        const { data: inserted, error } = await supabase.from('invoices').insert({
          shop_id: shopId,
          invoice_number: row.invoice_number,
          service_order_id: soId,
          customer_id: customerId,
          status,
          subtotal,
          tax_amount: taxAmount,
          total,
          amount_paid: amountPaid,
          payment_method: row.payment_method || null,
          payment_terms: row.payment_terms || null,
          due_date: row.due_date || null,
          paid_at: row.paid_at || (status === 'paid' ? new Date().toISOString() : null),
          sent_at: ['sent', 'paid', 'overdue', 'partial'].includes(status) ? (row.date_created || new Date().toISOString()) : null,
          is_historical: true,
          created_at: row.date_created || new Date().toISOString(),
        }).select('id').single()

        if (error) {
          result.errors.push({ record: row.invoice_number, message: error.message })
          continue
        }

        result.imported++
        existingNums.add(row.invoice_number.toLowerCase())

        // Insert line items
        if (row.lines?.length && inserted?.id) {
          for (const line of row.lines) {
            await supabase.from('invoice_lines').insert({
              invoice_id: inserted.id,
              line_type: line.line_type || 'service',
              description: line.description || '',
              quantity: line.quantity || 1,
              unit_price: line.unit_price || 0,
              total_price: line.total_price || 0,
            })
          }
        }
      } catch (err: any) {
        result.errors.push({ record: row.invoice_number || 'unknown', message: err.message })
      }
    }
  }

  return result
}

// ── PARTS ───────────────────────────────────────────────────
async function importParts(supabase: any, shopId: string, rows: RawPart[], options: any): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, updated: 0, skipped: 0, errors: [] }

  const { data: existing } = await supabase.from('parts')
    .select('id, part_number')
    .eq('shop_id', shopId)
  const pnMap = new Map<string, string>()
  for (const p of existing || []) {
    if (p.part_number) pnMap.set(p.part_number.toLowerCase(), p.id)
  }

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)

    for (const row of batch) {
      try {
        if (!row.description && !row.part_number) { result.skipped++; continue }

        const pn = row.part_number || ''
        if (pn && pnMap.has(pn.toLowerCase())) {
          if (options.skip_duplicates) {
            result.skipped++
            continue
          }
          // Update existing
          const existingId = pnMap.get(pn.toLowerCase())!
          const updates: any = {}
          if (row.quantity != null) updates.on_hand = row.quantity
          if (row.unit_cost != null) updates.cost_price = row.unit_cost
          if (row.sell_price != null) updates.sell_price = row.sell_price
          if (row.vendor) updates.vendor = row.vendor
          if (row.location) updates.bin_location = row.location

          if (Object.keys(updates).length > 0) {
            const { error } = await supabase.from('parts').update(updates).eq('id', existingId)
            if (error) {
              result.errors.push({ record: pn, message: error.message })
            } else {
              result.updated++
            }
          } else {
            result.skipped++
          }
          continue
        }

        const { error } = await supabase.from('parts').insert({
          shop_id: shopId,
          source: 'csv_import',
          part_number: pn || null,
          description: row.description || pn,
          category: row.category || 'other',
          on_hand: row.quantity || 0,
          reorder_point: row.min_stock || 2,
          cost_price: row.unit_cost || 0,
          sell_price: row.sell_price || 0,
          vendor: row.vendor || null,
          bin_location: row.location || null,
        })

        if (error) {
          result.errors.push({ record: pn || row.description, message: error.message })
        } else {
          result.imported++
          if (pn) pnMap.set(pn.toLowerCase(), 'new')
        }
      } catch (err: any) {
        result.errors.push({ record: row.part_number || row.description || 'unknown', message: err.message })
      }
    }
  }

  return result
}

// ── TECHNICIANS ─────────────────────────────────────────────
async function importTechnicians(supabase: any, shopId: string, rows: RawTechnician[], options: any): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, updated: 0, skipped: 0, errors: [] }

  // Load existing users for the shop
  const { data: existingUsers } = await supabase.from('users')
    .select('id, email, full_name')
    .eq('shop_id', shopId)
  const emailSet = new Set<string>()
  for (const u of existingUsers || []) {
    if (u.email) emailSet.add(u.email.toLowerCase())
  }

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)

    for (const row of batch) {
      try {
        if (!row.full_name || row.full_name === 'Unknown') { result.skipped++; continue }

        // Skip if email already exists
        if (row.email && emailSet.has(row.email.toLowerCase())) {
          result.skipped++
          continue
        }

        // Generate a temp email if none provided
        const email = row.email?.toLowerCase() || `${row.full_name.toLowerCase().replace(/\s+/g, '.')}@temp.truckzen.com`

        if (emailSet.has(email)) {
          result.skipped++
          continue
        }

        // Generate temp password
        const tempPassword = `TZ-${Math.random().toString(36).slice(2, 10)}!`

        const { error } = await supabase.from('users').insert({
          shop_id: shopId,
          full_name: row.full_name,
          email,
          phone: row.phone || null,
          role: 'technician',
          team: row.team || null,
          hourly_rate: row.hourly_rate || null,
          temp_password: tempPassword,
          is_active: true,
        })

        if (error) {
          result.errors.push({ record: row.full_name, message: error.message })
        } else {
          result.imported++
          emailSet.add(email)
        }
      } catch (err: any) {
        result.errors.push({ record: row.full_name || 'unknown', message: err.message })
      }
    }
  }

  return result
}

// POST /api/migrate/import — bulk cross-shop migration ingest.
// Platform-owner only: the body-supplied shop_id drives service-role inserts
// into customers/vehicles/service_orders/invoices/parts/technicians across
// arbitrary shops, so the actor must prove platform-owner status on the
// server. Body-supplied user_id is ignored for permission; migration_logs
// uses the server-derived actor.id instead.
export async function POST(req: Request) {
  const { actor, error: authError } = await requirePlatformOwner()
  if (authError || !actor) return authError!

  const supabase = db()
  let body: any = {}

  try {
    body = await req.json()
    const { shop_id, source, data_type, rows, options = {} } = body

    if (!shop_id || !data_type || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'shop_id, data_type, and rows[] are required' }, { status: 400 })
    }

    if (!rows.length) {
      return NextResponse.json({ imported: 0, updated: 0, skipped: 0, errors: [] })
    }

    const opts = { skip_duplicates: true, ...options }
    let result: ImportResult

    switch (data_type) {
      case 'customers':
        result = await importCustomers(supabase, shop_id, rows as RawCustomer[], opts)
        break
      case 'vehicles':
        result = await importVehicles(supabase, shop_id, rows as RawVehicle[], opts)
        break
      case 'service_orders':
        result = await importServiceOrders(supabase, shop_id, rows as RawServiceOrder[], opts)
        break
      case 'invoices':
        result = await importInvoices(supabase, shop_id, rows as RawInvoice[], opts)
        break
      case 'parts':
        result = await importParts(supabase, shop_id, rows as RawPart[], opts)
        break
      case 'technicians':
        result = await importTechnicians(supabase, shop_id, rows as RawTechnician[], opts)
        break
      default:
        return NextResponse.json({ error: `Unknown data_type: ${data_type}` }, { status: 400 })
    }

    // Log the migration event
    await supabase.from('migration_logs').insert({
      shop_id,
      user_id: actor.id,
      source: source || 'csv_import',
      data_type,
      status: result.errors.length > 0 ? 'completed_with_errors' : 'completed',
      imported: result.imported,
      updated: result.updated,
      skipped: result.skipped,
      error_count: result.errors.length,
      errors: result.errors.length > 0 ? result.errors.slice(0, 100) : null, // Cap at 100 errors
    }).then(() => {}) // Don't fail if log table doesn't exist yet

    return NextResponse.json(result)
  } catch (err: any) {
    Sentry.captureException(err, { extra: { shop_id: body?.shop_id, data_type: body?.data_type, row_count: body?.rows?.length } })
    return NextResponse.json({ error: err.message || 'Import failed' }, { status: 500 })
  }
}
