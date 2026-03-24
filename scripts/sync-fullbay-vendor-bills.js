#!/usr/bin/env node
/**
 * Fullbay Vendor Bills Sync — Populates vendors, purchase orders, parts vendor links
 * Run: node scripts/sync-fullbay-vendor-bills.js
 */
require('dotenv').config({ path: '.env.local' })
const crypto = require('crypto')
const { createClient } = require('@supabase/supabase-js')

const FULLBAY_API_KEY = process.env.FULLBAY_API_KEY
const SHOP_ID = '1f927e3e-4fe5-431a-bb7c-dac77501e892'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

if (!FULLBAY_API_KEY) { console.error('Missing FULLBAY_API_KEY'); process.exit(1) }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function getAuth() {
  const today = new Date().toISOString().split('T')[0]
  const ipRes = await fetch('https://api.ipify.org')
  const ip = (await ipRes.text()).trim()
  const token = crypto.createHash('sha1').update(FULLBAY_API_KEY + today + ip).digest('hex')
  return { key: FULLBAY_API_KEY, token }
}

async function fetchBills(startDate, endDate) {
  const { key, token } = await getAuth()
  const all = []
  let page = 1
  while (true) {
    const qs = new URLSearchParams({ key, token, startDate, endDate, page: String(page) }).toString()
    const res = await fetch(`https://app.fullbay.com/services/getVendorBills.php?${qs}`)
    const data = await res.json()
    if (data.status !== 'SUCCESS') break
    all.push(...(data.resultSet || []))
    if (page >= (data.totalPages || 1)) break
    page++
  }
  return all
}

async function main() {
  console.log('Fullbay Vendor Bills Sync — Starting...')

  // Build parts lookup
  const { data: allParts } = await db.from('parts').select('id, part_number').eq('shop_id', SHOP_ID)
  const partsMap = new Map()
  for (const p of allParts || []) {
    if (p.part_number) partsMap.set(p.part_number.toLowerCase().trim(), p.id)
  }
  console.log(`Parts lookup: ${partsMap.size} parts`)

  // Fetch all vendor bills (2020 to today, 7-day chunks)
  const allBills = []
  const startYear = new Date('2020-01-01')
  const endDate = new Date()
  let cur = new Date(startYear)
  let chunkNum = 0

  while (cur <= endDate) {
    chunkNum++
    const rangeEnd = new Date(Math.min(cur.getTime() + 6 * 86400000, endDate.getTime()))
    const sD = cur.toISOString().split('T')[0]
    const eD = rangeEnd.toISOString().split('T')[0]
    process.stdout.write(`  [${chunkNum}] ${sD} → ${eD}...`)
    try {
      const bills = await fetchBills(sD, eD)
      allBills.push(...bills)
      process.stdout.write(` ${bills.length} bills (total: ${allBills.length})\n`)
    } catch (e) {
      process.stdout.write(` ERROR: ${e.message}\n`)
    }
    cur = new Date(cur.getTime() + 7 * 86400000)
    if (chunkNum % 20 === 0) await sleep(1000)
  }
  console.log(`\nTotal vendor bills fetched: ${allBills.length}`)

  // A) Populate vendors
  console.log('\n--- A) Populating vendors ---')
  const vendorNames = new Set()
  for (const bill of allBills) {
    const name = bill.Vendor?.title?.trim()
    if (name) vendorNames.add(name)
  }
  let vendorsCreated = 0
  for (const name of vendorNames) {
    const { error } = await db.from('vendors').insert({
      shop_id: SHOP_ID, name, fullbay_name: name, source: 'fullbay',
    }).select('id').single()
    if (!error) vendorsCreated++
    // Ignore duplicate errors
  }
  console.log(`Vendors: ${vendorsCreated} created (${vendorNames.size} unique names)`)

  // Build vendor name → id map
  const { data: vendorRows } = await db.from('vendors').select('id, name').eq('shop_id', SHOP_ID)
  const vendorMap = new Map()
  for (const v of vendorRows || []) vendorMap.set(v.name.toLowerCase(), v.id)

  // B) Create purchase orders + lines
  console.log('\n--- B) Creating purchase orders ---')
  let posCreated = 0, polCreated = 0
  for (let i = 0; i < allBills.length; i++) {
    const bill = allBills[i]
    const vendorName = bill.Vendor?.title?.trim() || 'Unknown'
    const vendorId = vendorMap.get(vendorName.toLowerCase()) || null
    const fbId = String(bill.primaryKey || '')

    // Check duplicate by fullbay_id
    const { data: existing } = await db.from('purchase_orders').select('id').eq('fullbay_id', fbId).limit(1)
    if (existing && existing.length > 0) continue

    const { data: poRow, error: poErr } = await db.from('purchase_orders').insert({
      shop_id: SHOP_ID,
      vendor_id: vendorId,
      vendor_name: vendorName,
      po_number: bill.billNumber || fbId,
      source: 'fullbay',
      fullbay_id: fbId,
      status: bill.status === 'paid' ? 'paid' : 'received',
      received_date: bill.billDate || null,
      total: parseFloat(bill.amount) || 0,
      notes: `Fullbay Bill #${fbId}`,
    }).select('id').single()

    if (poErr || !poRow) continue
    posCreated++

    // Insert PO lines
    const lines = (bill.Lines || []).map(l => ({
      purchase_order_id: poRow.id,
      part_id: partsMap.get((l.partNumber || '').toLowerCase().trim()) || null,
      part_number: l.partNumber || '',
      description: l.description || '',
      quantity: parseFloat(l.quantity) || 0,
      cost_price: parseFloat(l.cost) || 0,
    }))
    if (lines.length > 0) {
      const { error } = await db.from('purchase_order_lines').insert(lines)
      if (!error) polCreated += lines.length
    }

    if (posCreated % 200 === 0 && posCreated > 0) {
      process.stdout.write(`  ${posCreated} POs, ${polCreated} lines...\n`)
    }
  }
  console.log(`POs created: ${posCreated}`)
  console.log(`PO lines created: ${polCreated}`)

  // C) Update parts.preferred_vendor — use most recent bill per part
  console.log('\n--- C) Linking parts to vendors ---')
  const partVendor = new Map() // partNumber → { vendor, date }
  for (const bill of allBills) {
    const vendorName = bill.Vendor?.title?.trim()
    if (!vendorName) continue
    for (const line of bill.Lines || []) {
      const pn = (line.partNumber || '').toLowerCase().trim()
      if (!pn) continue
      const existing = partVendor.get(pn)
      if (!existing || (bill.billDate && bill.billDate > existing.date)) {
        partVendor.set(pn, { vendor: vendorName, date: bill.billDate || '' })
      }
    }
  }
  let vendorLinks = 0
  for (const [pn, { vendor }] of partVendor) {
    const partId = partsMap.get(pn)
    if (!partId) continue
    const { error } = await db.from('parts').update({ preferred_vendor: vendor }).eq('id', partId)
    if (!error) vendorLinks++
  }
  console.log(`Parts linked to vendors: ${vendorLinks}`)

  // Summary
  console.log('\n=== SYNC COMPLETE ===')
  console.log(`Bills fetched: ${allBills.length}`)
  console.log(`Vendors created: ${vendorsCreated} (${vendorNames.size} unique)`)
  console.log(`Purchase orders: ${posCreated}`)
  console.log(`PO lines: ${polCreated}`)
  console.log(`Parts linked to vendors: ${vendorLinks}`)
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
