#!/usr/bin/env node
/**
 * Fullbay Complete Sync — Run locally (static IP required)
 *
 * Usage:
 *   node scripts/fullbay-sync.js preview
 *   node scripts/fullbay-sync.js customers
 *   node scripts/fullbay-sync.js trucks
 *   node scripts/fullbay-sync.js link-trucks
 *   node scripts/fullbay-sync.js parts
 *   node scripts/fullbay-sync.js work-orders
 *   node scripts/fullbay-sync.js staff-excel
 *   node scripts/fullbay-sync.js all
 *   node scripts/fullbay-sync.js status
 */

require('dotenv').config({ path: '.env.local' })
const crypto = require('crypto')
const { createClient } = require('@supabase/supabase-js')

const FULLBAY_API_KEY = process.env.FULLBAY_API_KEY
const SHOP_ID = '1f927e3e-4fe5-431a-bb7c-dac77501e892'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

if (!FULLBAY_API_KEY) { console.error('Missing FULLBAY_API_KEY in .env.local'); process.exit(1) }

// ── Fullbay API ──────────────────────────────────────────

async function getAuth() {
  const today = new Date().toISOString().split('T')[0]
  const ipRes = await fetch('https://api.ipify.org')
  const ip = (await ipRes.text()).trim()
  const token = crypto.createHash('sha1').update(FULLBAY_API_KEY + today + ip).digest('hex')
  return { key: FULLBAY_API_KEY, token, ip, date: today }
}

async function fbFetch(endpoint, params = {}, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { key, token } = await getAuth()
      const qs = new URLSearchParams({ key, token, ...params }).toString()
      const res = await fetch(`https://app.fullbay.com/services/${endpoint}?${qs}`)
      const data = await res.json()
      if (data.status === 'SUCCESS') return data
      if (data.status === 'FAIL' && attempt < retries) {
        const wait = Math.pow(2, attempt) * 1000
        console.log(`  Retry in ${wait/1000}s (${data.message || 'FAIL'})`)
        await sleep(wait)
        continue
      }
      throw new Error(`Fullbay: ${data.status} - ${data.message || ''}`)
    } catch (e) {
      if (attempt >= retries) throw e
      await sleep(Math.pow(2, attempt) * 1000)
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchAllInvoices(startDate, endDate, label = '') {
  const all = []
  const start = new Date(startDate)
  const end = new Date(endDate)
  let cur = new Date(start)
  let weekNum = 0
  const totalWeeks = Math.ceil((end - start) / (7 * 86400000))

  while (cur <= end) {
    weekNum++
    const rangeEnd = new Date(Math.min(cur.getTime() + 6 * 86400000, end.getTime()))
    const sD = cur.toISOString().split('T')[0]
    const eD = rangeEnd.toISOString().split('T')[0]
    process.stdout.write(`  [${weekNum}/${totalWeeks}] ${sD} to ${eD}...`)
    try {
      let page = 1
      while (true) {
        const data = await fbFetch('getInvoices.php', { startDate: sD, endDate: eD, page: String(page) })
        all.push(...(data.resultSet || []))
        if (page >= (data.totalPages || 1)) break
        page++
      }
      process.stdout.write(` ${all.length} total\n`)
    } catch (e) {
      process.stdout.write(` ERROR: ${e.message}\n`)
    }
    cur = new Date(cur.getTime() + 7 * 86400000)
  }
  return all
}

// ── Sync State ───────────────────────────────────────────

async function getSyncState(entityType) {
  const { data } = await db.from('fullbay_sync_state').select('*').eq('entity_type', entityType).single()
  return data
}

async function updateSyncState(entityType, updates) {
  await db.from('fullbay_sync_state').upsert({ entity_type: entityType, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'entity_type' })
}

// ── Mappers ──────────────────────────────────────────────

function mapCustomer(inv) {
  const c = inv.ServiceOrder?.Customer || inv.Customer || {}
  const so = inv.ServiceOrder || {}
  return {
    company_name: c.title || inv.customerTitle || '',
    contact_name: so.authorizerContact || so.submitterContact || null,
    phone: c.mainPhone || so.authorizerContactPhone || null,
    email: so.authorizerContactEmail || so.submitterContactEmail || null,
    source: 'fullbay', external_id: String(c.customerId || ''),
  }
}

function mapTruck(inv) {
  const u = inv.ServiceOrder?.Unit || {}
  return {
    unit_number: u.number || '', vin: u.vin || null,
    year: parseInt(u.year) || null, make: u.make || null, model: u.model || null,
    unit_type: (u.type || '').toLowerCase() === 'trailer' ? 'trailer' : 'tractor',
    license_plate: u.licensePlate || null, status: 'on_road',
    source: 'fullbay', external_id: String(u.customerUnitId || ''),
    fullbay_id: String(u.customerUnitId || ''),
  }
}

// ── Sync Functions ───────────────────────────────────────

async function syncCustomers(invoices) {
  const state = await getSyncState('customers')
  if (state?.status === 'completed') { console.log('\nCustomers: already synced, skipping'); return }
  await updateSyncState('customers', { status: 'running' })

  const seen = new Map()
  for (const inv of invoices) {
    const c = mapCustomer(inv)
    const key = c.external_id || c.company_name
    if (key && !seen.has(key)) seen.set(key, c)
  }
  console.log(`\nCustomers found: ${seen.size}`)
  let imported = 0, updated = 0, skipped = 0
  for (const [, record] of seen) {
    try {
      if (!record.company_name) { skipped++; continue }
      const { data: existing } = await db.from('customers').select('id').eq('shop_id', SHOP_ID)
        .or(`external_id.eq.${record.external_id},company_name.ilike.${record.company_name}`).limit(1)
      if (existing?.length) { await db.from('customers').update(record).eq('id', existing[0].id); updated++ }
      else { await db.from('customers').insert({ ...record, shop_id: SHOP_ID }); imported++ }
    } catch { skipped++ }
  }
  console.log(`  Imported: ${imported}, Updated: ${updated}, Skipped: ${skipped}`)
  await updateSyncState('customers', { status: 'completed', total_synced: imported + updated })
}

async function syncTrucks(invoices) {
  const state = await getSyncState('trucks')
  if (state?.status === 'completed') { console.log('\nTrucks: already synced, skipping'); return }
  await updateSyncState('trucks', { status: 'running' })

  const seen = new Map()
  for (const inv of invoices) {
    const t = mapTruck(inv)
    const key = t.vin || t.unit_number
    if (key && !seen.has(key)) seen.set(key, { ...t, _inv: inv })
  }
  console.log(`\nTrucks found: ${seen.size}`)

  const { data: custs } = await db.from('customers').select('id, company_name, external_id').eq('shop_id', SHOP_ID)
  const custMap = new Map()
  for (const c of custs || []) { if (c.external_id) custMap.set(c.external_id, c.id); custMap.set(c.company_name?.toLowerCase(), c.id) }

  let imported = 0, updated = 0, skipped = 0
  for (const [, { _inv, ...record }] of seen) {
    try {
      if (!record.unit_number) { skipped++; continue }
      const custExtId = String(_inv.ServiceOrder?.Customer?.customerId || '')
      const custName = (_inv.ServiceOrder?.Customer?.title || '').toLowerCase()
      const customer_id = custMap.get(custExtId) || custMap.get(custName) || null

      const { data: existing } = await db.from('assets').select('id').eq('shop_id', SHOP_ID)
        .or(record.vin ? `vin.eq.${record.vin},unit_number.eq.${record.unit_number}` : `unit_number.eq.${record.unit_number}`).limit(1)
      if (existing?.length) {
        const { error } = await db.from('assets').update({ ...record, customer_id }).eq('id', existing[0].id)
        if (error) { skipped++; if (skipped <= 3) console.log(`  Update err: ${error.message}`) } else updated++
      } else {
        const { error } = await db.from('assets').insert({ ...record, shop_id: SHOP_ID, customer_id })
        if (error) { skipped++; if (skipped <= 3) console.log(`  Insert err: ${error.message}`) } else imported++
      }
    } catch (e) { skipped++; if (skipped <= 3) console.log(`  Exception: ${e.message}`) }
  }
  console.log(`  Imported: ${imported}, Updated: ${updated}, Skipped: ${skipped}`)
  await updateSyncState('trucks', { status: 'completed', total_synced: imported + updated })
}

async function syncParts(invoices) {
  const state = await getSyncState('parts')
  if (state?.status === 'completed') { console.log('\nParts: already synced, skipping'); return }
  await updateSyncState('parts', { status: 'running' })

  const seen = new Map()
  for (const inv of invoices) {
    for (const comp of inv.ServiceOrder?.Complaints || []) {
      for (const corr of comp.Corrections || []) {
        for (const p of corr.Parts || []) {
          const pn = p.shopPartNumber || p.vendorPartNumber
          if (pn && !seen.has(pn)) seen.set(pn, {
            part_number: pn, description: p.description || '',
            cost_price: parseFloat(p.cost) || 0, sell_price: parseFloat(p.sellingPrice) || 0, on_hand: 0,
          })
        }
      }
    }
  }
  console.log(`\nParts found: ${seen.size}`)
  let imported = 0, skipped = 0
  for (const [, record] of seen) {
    try {
      const { data: existing } = await db.from('parts').select('id').eq('shop_id', SHOP_ID).eq('part_number', record.part_number).limit(1)
      if (existing?.length) { skipped++; continue }
      await db.from('parts').insert({ ...record, shop_id: SHOP_ID }); imported++
    } catch { skipped++ }
  }
  console.log(`  Imported: ${imported}, Skipped: ${skipped}`)
  await updateSyncState('parts', { status: 'completed', total_synced: imported })
}

async function syncWorkOrders(invoices) {
  const state = await getSyncState('work_orders')
  if (state?.status === 'completed') { console.log('\nWork Orders: already synced, skipping'); return }
  await updateSyncState('work_orders', { status: 'running' })

  // Build lookup maps
  const { data: custs } = await db.from('customers').select('id, external_id, company_name').eq('shop_id', SHOP_ID)
  const custMap = new Map()
  for (const c of custs || []) { if (c.external_id) custMap.set(c.external_id, c.id); custMap.set(c.company_name?.toLowerCase(), c.id) }

  const { data: assets } = await db.from('assets').select('id, unit_number, vin, external_id').eq('shop_id', SHOP_ID)
  const assetMap = new Map()
  for (const a of assets || []) {
    if (a.vin) assetMap.set(a.vin, a.id)
    assetMap.set(a.unit_number, a.id)
    if (a.external_id) assetMap.set(a.external_id, a.id)
  }

  // Status mapping: Fullbay → TruckZen so_status enum
  const STATUS_MAP = {
    'open': 'in_progress', 'in progress': 'in_progress', 'completed': 'done',
    'invoiced': 'done', 'closed': 'done', 'void': 'void', 'cancelled': 'void',
  }

  console.log(`\nWork Orders: processing ${invoices.length} invoices`)
  let imported = 0, updated = 0, skipped = 0, lineCount = 0
  const seen = new Set()

  for (let i = 0; i < invoices.length; i++) {
    const inv = invoices[i]
    const so = inv.ServiceOrder || {}
    const fbId = String(so.primaryKey || '')

    if (!fbId || seen.has(fbId)) { skipped++; continue }
    seen.add(fbId)

    // Rate limit: pause every 100 WOs
    if (imported > 0 && imported % 100 === 0) {
      process.stdout.write(`  [${imported} WOs imported, ${i}/${invoices.length} invoices processed]\n`)
      await sleep(2000)
    }

    try {
      // Check duplicate
      const { data: existing } = await db.from('service_orders').select('id').eq('fullbay_id', fbId).limit(1)
      if (existing?.length) { updated++; continue }

      // Find customer + asset
      const custExtId = String(so.Customer?.customerId || '')
      const custName = (so.Customer?.title || '').toLowerCase()
      const customer_id = custMap.get(custExtId) || custMap.get(custName) || null

      const unit = so.Unit || {}
      const asset_id = assetMap.get(unit.vin || '') || assetMap.get(unit.number || '') || assetMap.get(String(unit.customerUnitId || '')) || null

      // Map status
      const fbStatus = (inv.balance && parseFloat(inv.balance) <= 0) ? 'invoiced' : 'completed'
      const status = STATUS_MAP[fbStatus] || 'done'

      // Insert WO
      const { data: woData, error: woErr } = await db.from('service_orders').insert({
        shop_id: SHOP_ID,
        so_number: so.repairOrderNumber || `FB-${fbId}`,
        customer_id, asset_id, status,
        complaint: so.description || (so.Complaints?.[0]?.note || 'Fullbay imported'),
        source: 'fullbay', fullbay_id: fbId, is_historical: true,
        fullbay_synced_at: new Date().toISOString(),
        created_at: so.created || inv.created || new Date().toISOString(),
        labor_total: parseFloat(so.laborTotal) || 0,
        parts_total: parseFloat(so.partsTotal) || 0,
        grand_total: parseFloat(inv.total) || 0,
      }).select('id').single()

      if (woErr) { skipped++; if (skipped <= 5) console.log(`  WO err ${so.repairOrderNumber}: ${woErr.message}`); continue }
      imported++

      // Insert job lines from Complaints
      for (const comp of so.Complaints || []) {
        try {
          await db.from('so_lines').insert({
            so_id: woData.id,
            line_type: 'labor',
            description: comp.note || 'Service',
            finding: comp.cause || null,
            resolution: comp.Corrections?.[0]?.actualCorrection || comp.Corrections?.[0]?.recommendedCorrection || null,
            estimated_hours: parseFloat(comp.laborHoursTotal) || 0,
            actual_hours: parseFloat(comp.actualHoursTotal) || 0,
            unit_price: parseFloat(comp.laborTotal) || 0,
            line_status: 'completed',
          })
          lineCount++
        } catch {}
      }
    } catch (e) {
      skipped++
      if (skipped <= 5) console.log(`  Exception: ${e.message}`)
    }
  }
  console.log(`  WOs: Imported: ${imported}, Already existed: ${updated}, Skipped: ${skipped}`)
  console.log(`  Job lines: ${lineCount}`)
  await updateSyncState('work_orders', { status: 'completed', total_synced: imported, last_synced_at: new Date().toISOString() })
}

async function generateStaffExcel(invoices) {
  console.log('\nGenerating staff Excel...')
  // Extract unique technicians from invoices
  const techMap = new Map()
  for (const inv of invoices) {
    // Main technician
    const so = inv.ServiceOrder || {}
    if (so.technician && !techMap.has(so.technician)) {
      techMap.set(so.technician, { name: so.technician, number: so.technicianNumber || '' })
    }
    // Assigned technicians from complaints
    for (const comp of so.Complaints || []) {
      for (const at of comp.AssignedTechnicians || []) {
        if (at.technician && !techMap.has(at.technician)) {
          techMap.set(at.technician, { name: at.technician, number: at.technicianNumber || '' })
        }
      }
    }
    // Parts manager
    if (so.partsManager && !techMap.has(so.partsManager)) {
      techMap.set(so.partsManager, { name: so.partsManager, number: so.partsManagerNumber || '', role: 'Parts' })
    }
    // Created by
    if (inv.createdByTechnician && !techMap.has(inv.createdByTechnician)) {
      techMap.set(inv.createdByTechnician, { name: inv.createdByTechnician, number: inv.createdByTechnicianNumber || '' })
    }
  }

  const staff = Array.from(techMap.values())
  console.log(`  Found ${staff.length} unique staff members`)

  // Role suggestion
  function suggestRole(name, fbRole) {
    const n = (name || '').toLowerCase()
    if (fbRole === 'Parts') return 'parts_manager'
    return 'mechanic' // default — Ken reviews
  }

  // Role sort order
  const ROLE_ORDER = { owner: 0, gm: 1, service_writer: 2, floor_supervisor: 3, parts_manager: 4, accounting: 5, mechanic: 6 }

  const rows = staff.map(s => ({
    name: s.name,
    email: '',
    phone: '',
    fullbay_role: s.role || 'Technician',
    truckzen_role: suggestRole(s.name, s.role),
    include: 'YES',
    notes: '',
  })).sort((a, b) => (ROLE_ORDER[a.truckzen_role] || 99) - (ROLE_ORDER[b.truckzen_role] || 99))

  // Generate Excel
  const ExcelJS = require('exceljs')
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Staff Review')

  ws.columns = [
    { header: 'Full Name', key: 'name', width: 30 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Phone', key: 'phone', width: 18 },
    { header: 'Fullbay Role', key: 'fullbay_role', width: 18 },
    { header: 'TruckZen Role', key: 'truckzen_role', width: 18 },
    { header: 'Include?', key: 'include', width: 12 },
    { header: 'Notes', key: 'notes', width: 40 },
  ]

  // Header style
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B6EE6' } }

  for (const row of rows) ws.addRow(row)

  // Data validation for TruckZen Role
  for (let i = 2; i <= rows.length + 1; i++) {
    ws.getCell(`E${i}`).dataValidation = {
      type: 'list', allowBlank: false,
      formulae: ['"mechanic,service_writer,floor_supervisor,accounting,parts_manager,it_person,owner,gm"'],
    }
    ws.getCell(`F${i}`).dataValidation = {
      type: 'list', allowBlank: false, formulae: ['"YES,NO"'],
    }
  }

  // Footer note
  const footerRow = ws.addRow([])
  const noteRow = ws.addRow(['Review each person. Change TruckZen Role if incorrect. Set Include? to NO for anyone who should not have access. Return this file to Ken when done.'])
  noteRow.getCell(1).font = { italic: true, color: { argb: 'FF7C8BA0' } }

  const filePath = require('path').join(__dirname, 'UGL_Staff_Review.xlsx')
  await wb.xlsx.writeFile(filePath)
  console.log(`  Saved to: ${filePath}`)
  console.log(`  Staff count: ${rows.length}`)
  for (const role of ['mechanic', 'service_writer', 'floor_supervisor', 'parts_manager', 'accounting']) {
    const count = rows.filter(r => r.truckzen_role === role).length
    if (count) console.log(`    ${role}: ${count}`)
  }
}

async function linkTrucks(invoices) {
  const { data: unlinked } = await db.from('assets').select('id, unit_number, vin, external_id').eq('shop_id', SHOP_ID).is('customer_id', null)
  console.log(`\nUnlinked trucks: ${unlinked?.length || 0}`)
  if (!unlinked?.length) return

  const unitCustMap = new Map()
  for (const inv of invoices) {
    const u = inv.ServiceOrder?.Unit || {}
    const c = inv.ServiceOrder?.Customer || {}
    const key = u.vin || u.number
    if (key && c.customerId) unitCustMap.set(key, { custExtId: String(c.customerId), custName: c.title })
  }

  const { data: custs } = await db.from('customers').select('id, company_name, external_id').eq('shop_id', SHOP_ID)
  const custMap = new Map()
  for (const c of custs || []) { if (c.external_id) custMap.set(c.external_id, c.id); custMap.set(c.company_name?.toLowerCase(), c.id) }

  let linked = 0
  for (const asset of unlinked) {
    const match = unitCustMap.get(asset.vin || asset.unit_number)
    if (match) {
      const custId = custMap.get(match.custExtId) || custMap.get(match.custName?.toLowerCase())
      if (custId) { await db.from('assets').update({ customer_id: custId }).eq('id', asset.id); linked++ }
    }
  }
  console.log(`  Linked: ${linked}`)
}

// ── Main ─────────────────────────────────────────────────

async function main() {
  const [,, command] = process.argv
  if (!command) {
    console.log('Usage: node scripts/fullbay-sync.js [preview|customers|trucks|link-trucks|parts|work-orders|staff-excel|all|status]')
    process.exit(1)
  }

  if (command === 'status') {
    const { data } = await db.from('fullbay_sync_state').select('*').order('updated_at')
    console.log('Sync State:')
    for (const s of data || []) console.log(`  ${s.entity_type}: ${s.status} (${s.total_synced} synced)`)
    const counts = await db.rpc('', {}).catch(() => null) // won't work, do manual
    for (const t of ['customers', 'assets', 'parts', 'service_orders']) {
      const { count } = await db.from(t).select('*', { count: 'exact', head: true }).eq('shop_id', SHOP_ID)
      console.log(`  ${t}: ${count} rows`)
    }
    return
  }

  if (command === 'preview') {
    const { ip } = await getAuth()
    console.log(`IP: ${ip}`)
    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 6)
    const data = await fbFetch('getInvoices.php', { startDate: weekAgo.toISOString().split('T')[0], endDate: today })
    console.log(`Invoices this week: ${data.resultCount}`)
    if (data.resultSet?.[0]) {
      const inv = data.resultSet[0]
      console.log(`Sample: #${inv.invoiceNumber} - ${inv.customerTitle} - $${inv.total}`)
      console.log(`Unit: ${inv.ServiceOrder?.Unit?.number} ${inv.ServiceOrder?.Unit?.year} ${inv.ServiceOrder?.Unit?.make} ${inv.ServiceOrder?.Unit?.model}`)
    }
    return
  }

  // Pull invoices (5 years for 'all' and 'work-orders', 180 days otherwise)
  const years = (command === 'all' || command === 'work-orders') ? 5 : 0.5
  const endDate = new Date().toISOString().split('T')[0]
  const startDate = new Date(); startDate.setFullYear(startDate.getFullYear() - years)
  console.log(`Pulling Fullbay invoices: ${startDate.toISOString().split('T')[0]} to ${endDate} (${years} years)`)
  const invoices = await fetchAllInvoices(startDate.toISOString().split('T')[0], endDate)
  console.log(`Total invoices: ${invoices.length}`)

  if (command === 'customers' || command === 'all') await syncCustomers(invoices)
  if (command === 'trucks' || command === 'all') await syncTrucks(invoices)
  if (command === 'link-trucks' || command === 'all') await linkTrucks(invoices)
  if (command === 'parts' || command === 'all') await syncParts(invoices)
  if (command === 'work-orders' || command === 'all') await syncWorkOrders(invoices)
  if (command === 'staff-excel' || command === 'all') await generateStaffExcel(invoices)

  console.log('\nSync complete.')
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
