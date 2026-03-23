#!/usr/bin/env node
/**
 * Fullbay Adjustment Sync — Populates parts on_hand, vendors, part history, POs
 * Run: node scripts/sync-fullbay-adjustments.js
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

async function fetchAdjustments(startDate, endDate) {
  const { key, token } = await getAuth()
  const all = []
  let page = 1
  while (true) {
    const qs = new URLSearchParams({ key, token, startDate, endDate, page: String(page) }).toString()
    const res = await fetch(`https://app.fullbay.com/services/getAdjustments.php?${qs}`)
    const data = await res.json()
    if (data.status !== 'SUCCESS') break
    all.push(...(data.resultSet || []))
    if (page >= (data.totalPages || 1)) break
    page++
  }
  return all
}

async function main() {
  console.log('Fullbay Adjustment Sync — Starting...')

  // Build parts lookup map
  const { data: allParts } = await db.from('parts').select('id, part_number').eq('shop_id', SHOP_ID)
  const partsMap = new Map()
  for (const p of allParts || []) {
    if (p.part_number) partsMap.set(p.part_number.toLowerCase().trim(), p.id)
  }
  console.log(`Parts lookup: ${partsMap.size} parts`)

  // Fetch all adjustments (2020 to today, 7-day chunks per Fullbay API limit)
  const allAdj = []
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
      const adj = await fetchAdjustments(sD, eD)
      allAdj.push(...adj)
      process.stdout.write(` ${adj.length} adj (total: ${allAdj.length})\n`)
    } catch (e) {
      process.stdout.write(` ERROR: ${e.message}\n`)
    }
    cur = new Date(cur.getTime() + 7 * 86400000)
    if (chunkNum % 20 === 0) await sleep(1000) // rate limit
  }
  console.log(`\nTotal adjustments fetched: ${allAdj.length}`)

  // Parse adjustment lines
  const movements = [] // { partNumber, description, qty, cost, sell, type, vendor, date, ref }
  for (const adj of allAdj) {
    for (const line of adj.Lines || []) {
      movements.push({
        partNumber: (line.partNumber || '').trim(),
        description: (line.description || '').trim(),
        qty: parseFloat(line.quantityChange) || 0,
        cost: parseFloat(line.cost) || 0,
        sell: parseFloat(line.sellingPrice) || 0,
        type: adj.type || '',
        vendor: adj.createdByTechnician || null, // vendor name often in this field for receipts
        date: adj.created || new Date().toISOString(),
        ref: adj.createdFromNumber || null,
      })
    }
  }
  console.log(`Parsed ${movements.length} movement lines`)

  // A) Reconstruct on_hand
  console.log('\n--- A) Reconstructing on_hand ---')
  const qtyByPart = new Map()
  for (const m of movements) {
    const key = m.partNumber.toLowerCase()
    if (!key) continue
    qtyByPart.set(key, (qtyByPart.get(key) || 0) + m.qty)
  }
  let partsUpdated = 0
  for (const [pn, qty] of qtyByPart) {
    const partId = partsMap.get(pn)
    if (!partId) continue
    const onHand = Math.max(0, Math.round(qty * 100) / 100)
    const { error } = await db.from('parts').update({ on_hand: onHand }).eq('id', partId)
    if (!error) partsUpdated++
  }
  console.log(`Updated on_hand for ${partsUpdated} parts`)

  // B) Calculate average_cost
  console.log('\n--- B) Calculating average_cost ---')
  const costByPart = new Map() // pn → [costs]
  for (const m of movements) {
    if (m.type !== 'Received from Vendor' && !m.type.includes('Received')) continue
    if (m.cost <= 0) continue
    const key = m.partNumber.toLowerCase()
    if (!costByPart.has(key)) costByPart.set(key, [])
    costByPart.get(key).push(m.cost)
  }
  let costsUpdated = 0
  for (const [pn, costs] of costByPart) {
    const partId = partsMap.get(pn)
    if (!partId) continue
    const avg = costs.reduce((s, c) => s + c, 0) / costs.length
    await db.from('parts').update({ average_cost: Math.round(avg * 100) / 100 }).eq('id', partId)
    costsUpdated++
  }
  console.log(`Updated average_cost for ${costsUpdated} parts`)

  // C) Write to part_field_history
  console.log('\n--- C) Populating part_field_history ---')
  let historyRows = 0
  const BATCH = 100
  for (let i = 0; i < movements.length; i += BATCH) {
    const batch = movements.slice(i, i + BATCH)
    const rows = batch.filter(m => {
      const partId = partsMap.get(m.partNumber.toLowerCase())
      return partId
    }).map(m => ({
      part_id: partsMap.get(m.partNumber.toLowerCase()),
      field_name: 'on_hand',
      old_value: null,
      new_value: String(m.qty),
      changed_at: m.date,
      source: 'fullbay',
      notes: m.type + (m.ref ? ' — ' + m.ref : ''),
    }))
    if (rows.length > 0) {
      const { error } = await db.from('part_field_history').insert(rows)
      if (!error) historyRows += rows.length
    }
    if (i % 1000 === 0 && i > 0) process.stdout.write(`  ${historyRows} rows...\n`)
  }
  console.log(`Inserted ${historyRows} history rows`)

  // D) Populate vendors
  console.log('\n--- D) Populating vendors ---')
  const vendorNames = new Set()
  const vendorByPart = new Map() // pn → most recent vendor
  for (const m of movements) {
    if (m.type !== 'Received from Vendor' && !m.type.includes('Received')) continue
    if (m.vendor) {
      vendorNames.add(m.vendor.trim())
      vendorByPart.set(m.partNumber.toLowerCase(), m.vendor.trim())
    }
  }
  let vendorsCreated = 0
  for (const name of vendorNames) {
    const { error } = await db.from('vendors').upsert({
      shop_id: SHOP_ID,
      name,
      fullbay_name: name,
      source: 'fullbay',
    }, { onConflict: 'shop_id, name', ignoreDuplicates: true })
    if (!error) vendorsCreated++
  }
  console.log(`Created/updated ${vendorsCreated} vendors`)

  // Link parts to vendors
  let vendorLinks = 0
  for (const [pn, vendorName] of vendorByPart) {
    const partId = partsMap.get(pn)
    if (!partId) continue
    await db.from('parts').update({ preferred_vendor: vendorName }).eq('id', partId)
    vendorLinks++
  }
  console.log(`Linked ${vendorLinks} parts to vendors`)

  // E) Create purchase orders
  console.log('\n--- E) Creating purchase orders ---')
  const poGroups = new Map() // ref → { vendor, lines[], date }
  for (const m of movements) {
    if (m.type !== 'Received from Vendor' && !m.type.includes('Received')) continue
    const ref = m.ref || `FB-ADJ-${m.date.split('T')[0]}`
    if (!poGroups.has(ref)) poGroups.set(ref, { vendor: m.vendor, lines: [], date: m.date })
    poGroups.get(ref).lines.push(m)
  }

  let posCreated = 0
  for (const [ref, po] of poGroups) {
    const totalCost = po.lines.reduce((s, l) => s + Math.abs(l.qty) * l.cost, 0)
    // Get vendor ID
    const { data: v } = await db.from('vendors').select('id').eq('shop_id', SHOP_ID).eq('name', po.vendor || '').limit(1).single()

    const { data: poRow, error: poErr } = await db.from('purchase_orders').insert({
      shop_id: SHOP_ID,
      vendor_id: v?.id || null,
      vendor_name: po.vendor || 'Unknown',
      po_number: ref,
      source: 'fullbay',
      status: 'received',
      received_date: po.date.split('T')[0],
      total: Math.round(totalCost * 100) / 100,
    }).select('id').single()

    if (poErr || !poRow) continue
    posCreated++

    // Insert PO lines
    const poLines = po.lines.map(l => ({
      purchase_order_id: poRow.id,
      part_id: partsMap.get(l.partNumber.toLowerCase()) || null,
      part_number: l.partNumber,
      description: l.description,
      quantity: Math.abs(l.qty),
      cost_price: l.cost,
      sell_price: l.sell,
    }))
    await db.from('purchase_order_lines').insert(poLines)
  }
  console.log(`Created ${posCreated} purchase orders`)

  // Summary
  console.log('\n=== SYNC COMPLETE ===')
  console.log(`Adjustments fetched: ${allAdj.length}`)
  console.log(`Movement lines: ${movements.length}`)
  console.log(`Parts on_hand updated: ${partsUpdated}`)
  console.log(`Parts average_cost updated: ${costsUpdated}`)
  console.log(`History rows: ${historyRows}`)
  console.log(`Vendors created: ${vendorsCreated}`)
  console.log(`Parts linked to vendors: ${vendorLinks}`)
  console.log(`Purchase orders: ${posCreated}`)
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
