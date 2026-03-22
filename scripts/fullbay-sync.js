#!/usr/bin/env node
/**
 * Fullbay Sync Script — Run locally (your machine has a static IP)
 *
 * Usage:
 *   node scripts/fullbay-sync.js customers
 *   node scripts/fullbay-sync.js trucks
 *   node scripts/fullbay-sync.js parts
 *   node scripts/fullbay-sync.js all
 *   node scripts/fullbay-sync.js preview customers
 */

require('dotenv').config({ path: '.env.local' })
const crypto = require('crypto')

const FULLBAY_API_KEY = process.env.FULLBAY_API_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SHOP_ID = process.env.TRUCKZEN_SHOP_ID || '1f927e3e-4fe5-431a-bb7c-dac77501e892'

if (!FULLBAY_API_KEY) { console.error('Missing FULLBAY_API_KEY'); process.exit(1) }

const { createClient } = require('@supabase/supabase-js')
const db = createClient(SUPABASE_URL, SUPABASE_KEY)

async function getAuth() {
  const today = new Date().toISOString().split('T')[0]
  const ipRes = await fetch('https://api.ipify.org')
  const ip = (await ipRes.text()).trim()
  const token = crypto.createHash('sha1').update(FULLBAY_API_KEY + today + ip).digest('hex')
  console.log(`Auth: date=${today} ip=${ip}`)
  return { key: FULLBAY_API_KEY, token }
}

async function fbFetch(endpoint, params = {}) {
  const { key, token } = await getAuth()
  const qs = new URLSearchParams({ key, token, ...params }).toString()
  const url = `https://app.fullbay.com/services/${endpoint}?${qs}`
  const res = await fetch(url)
  const data = await res.json()
  if (data.status !== 'SUCCESS') throw new Error(`Fullbay: ${data.status} - ${data.message || ''}`)
  return data
}

async function fetchAllInvoices(startDate, endDate) {
  const all = []
  const start = new Date(startDate)
  const end = new Date(endDate)
  let cur = new Date(start)

  while (cur <= end) {
    const rangeEnd = new Date(Math.min(cur.getTime() + 6 * 86400000, end.getTime()))
    const sD = cur.toISOString().split('T')[0]
    const eD = rangeEnd.toISOString().split('T')[0]
    process.stdout.write(`  Fetching ${sD} to ${eD}...`)
    try {
      let page = 1
      while (true) {
        const data = await fbFetch('getInvoices.php', { startDate: sD, endDate: eD, page: String(page) })
        all.push(...(data.resultSet || []))
        process.stdout.write(` ${data.resultCount || 0} records`)
        if (page >= (data.totalPages || 1)) break
        page++
      }
      console.log(' OK')
    } catch (e) {
      console.log(` ERROR: ${e.message}`)
    }
    cur = new Date(cur.getTime() + 7 * 86400000)
  }
  return all
}

// Mappers
function mapCustomer(inv) {
  const c = inv.ServiceOrder?.Customer || inv.Customer || {}
  const so = inv.ServiceOrder || {}
  return {
    company_name: c.title || inv.customerTitle || '',
    contact_name: so.authorizerContact || so.submitterContact || null,
    phone: c.mainPhone || so.authorizerContactPhone || null,
    email: so.authorizerContactEmail || so.submitterContactEmail || null,
    source: 'fullbay',
    external_id: String(c.customerId || ''),
  }
}

function mapTruck(inv) {
  const u = inv.ServiceOrder?.Unit || {}
  return {
    unit_number: u.number || '',
    vin: u.vin || null,
    year: parseInt(u.year) || null,
    make: u.make || null,
    model: u.model || null,
    unit_type: (u.type || '').toLowerCase() === 'trailer' ? 'trailer' : 'tractor',
    license_plate: u.licensePlate || null,
    status: 'on_road',
    source: 'fullbay',
    external_id: String(u.customerUnitId || ''),
  }
}

function mapPart(p) {
  return {
    part_number: p.shopPartNumber || p.vendorPartNumber || null,
    description: p.description || '',
    cost_price: parseFloat(p.cost) || 0,
    sell_price: parseFloat(p.sellingPrice) || 0,
    on_hand: 0,
  }
}

async function syncCustomers(invoices) {
  const seen = new Map()
  for (const inv of invoices) {
    const c = mapCustomer(inv)
    if (c.company_name && !seen.has(c.external_id || c.company_name))
      seen.set(c.external_id || c.company_name, c)
  }
  console.log(`\nCustomers found: ${seen.size}`)
  let imported = 0, updated = 0, skipped = 0
  for (const [, record] of seen) {
    try {
      const { data: existing } = await db.from('customers').select('id').eq('shop_id', SHOP_ID)
        .or(`external_id.eq.${record.external_id},company_name.ilike.${record.company_name}`).limit(1)
      if (existing?.length) { updated++; await db.from('customers').update(record).eq('id', existing[0].id) }
      else { imported++; await db.from('customers').insert({ ...record, shop_id: SHOP_ID }) }
    } catch { skipped++ }
  }
  console.log(`  Imported: ${imported}, Updated: ${updated}, Skipped: ${skipped}`)
}

async function syncTrucks(invoices) {
  const seen = new Map()
  for (const inv of invoices) {
    const t = mapTruck(inv)
    const key = t.vin || t.unit_number
    if (key && !seen.has(key)) seen.set(key, { ...t, _inv: inv })
  }
  console.log(`\nTrucks found: ${seen.size}`)
  // Get customer map
  const { data: custs } = await db.from('customers').select('id, company_name, external_id').eq('shop_id', SHOP_ID)
  const custMap = new Map()
  for (const c of custs || []) { if (c.external_id) custMap.set(c.external_id, c.id); custMap.set(c.company_name?.toLowerCase(), c.id) }

  let imported = 0, updated = 0, skipped = 0
  for (const [, { _inv, ...record }] of seen) {
    try {
      const custId = custMap.get(String(_inv.ServiceOrder?.Customer?.customerId || '')) ||
        custMap.get((_inv.ServiceOrder?.Customer?.title || '').toLowerCase()) || null
      const q = record.vin ? db.from('assets').select('id').eq('shop_id', SHOP_ID).eq('vin', record.vin) :
        db.from('assets').select('id').eq('shop_id', SHOP_ID).eq('unit_number', record.unit_number)
      const { data: existing } = await q.limit(1)
      if (existing?.length) { updated++; await db.from('assets').update({ ...record, customer_id: custId }).eq('id', existing[0].id) }
      else { imported++; await db.from('assets').insert({ ...record, shop_id: SHOP_ID, customer_id: custId }) }
    } catch { skipped++ }
  }
  console.log(`  Imported: ${imported}, Updated: ${updated}, Skipped: ${skipped}`)
}

async function syncParts(invoices) {
  const seen = new Map()
  for (const inv of invoices) {
    for (const comp of inv.ServiceOrder?.Complaints || []) {
      for (const corr of comp.Corrections || []) {
        for (const p of corr.Parts || []) {
          const mapped = mapPart(p)
          if (mapped.part_number && !seen.has(mapped.part_number)) seen.set(mapped.part_number, mapped)
        }
      }
    }
  }
  console.log(`\nParts found: ${seen.size}`)
  let imported = 0, skipped = 0
  for (const [, record] of seen) {
    try {
      if (record.part_number) {
        const { data: existing } = await db.from('parts').select('id').eq('shop_id', SHOP_ID).eq('part_number', record.part_number).limit(1)
        if (existing?.length) { skipped++; continue }
      }
      await db.from('parts').insert({ ...record, shop_id: SHOP_ID })
      imported++
    } catch { skipped++ }
  }
  console.log(`  Imported: ${imported}, Skipped: ${skipped}`)
}

async function main() {
  const [,, command, subtype] = process.argv
  if (!command) { console.log('Usage: node scripts/fullbay-sync.js [customers|trucks|parts|all|preview] [type]'); process.exit(1) }

  if (command === 'preview') {
    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 6)
    const data = await fbFetch('getInvoices.php', { startDate: weekAgo.toISOString().split('T')[0], endDate: today })
    console.log(`Invoices this week: ${data.resultCount}`)
    if (data.resultSet?.[0]) {
      const inv = data.resultSet[0]
      console.log(`\nSample: ${inv.invoiceNumber} - ${inv.customerTitle} - $${inv.total}`)
      console.log(`Unit: ${inv.ServiceOrder?.Unit?.number} ${inv.ServiceOrder?.Unit?.year} ${inv.ServiceOrder?.Unit?.make} ${inv.ServiceOrder?.Unit?.model}`)
    }
    return
  }

  // Pull last 180 days of invoices
  const endDate = new Date().toISOString().split('T')[0]
  const startDate = new Date(); startDate.setDate(startDate.getDate() - 180)
  console.log(`Pulling Fullbay invoices: ${startDate.toISOString().split('T')[0]} to ${endDate}`)
  const invoices = await fetchAllInvoices(startDate.toISOString().split('T')[0], endDate)
  console.log(`Total invoices: ${invoices.length}`)

  if (command === 'customers' || command === 'all') await syncCustomers(invoices)
  if (command === 'trucks' || command === 'all') await syncTrucks(invoices)
  if (command === 'parts' || command === 'all') await syncParts(invoices)

  console.log('\nSync complete.')
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
