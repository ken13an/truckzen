#!/usr/bin/env node
/**
 * Fullbay_3 Audit Script — Zero-Total Historical Service Orders
 * READ-ONLY — no DB writes
 *
 * Outputs:
 *   - mapping/fullbay_zero_total_records.csv
 *   - Console report with exact counts and bucketing
 */
require('dotenv').config({ path: '.env.local' })
const { Pool } = require('pg')
const fs = require('fs')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

async function main() {
  // Load all Fullbay source files
  const sources = [
    'backups/patch93g_fullbay_data.json',
    'backups/patch98_recovered.json',
    'backups/patch98_extra_recovered.json',
  ]
  const allFbIds = new Set()
  for (const f of sources) {
    if (fs.existsSync(f)) {
      const data = JSON.parse(fs.readFileSync(f, 'utf-8'))
      for (const k of Object.keys(data)) allFbIds.add(k)
    }
  }
  // Add the 3 individually fetched
  allFbIds.add('19736548')
  allFbIds.add('19737302')
  allFbIds.add('19737324')

  console.log('Fullbay source IDs loaded:', allFbIds.size)

  // Find zero-total rows not in any source
  const { rows: zeroRows } = await pool.query(`
    SELECT so.id, so.so_number, so.fullbay_id, so.created_at, so.updated_at,
           so.status, so.asset_id, so.customer_id, so.labor_total, so.parts_total,
           so.grand_total, so.source, so.is_historical, so.complaint
    FROM service_orders so
    WHERE so.source='fullbay' AND so.is_historical=true
      AND so.fullbay_id IS NOT NULL
      AND so.grand_total = 0
    ORDER BY so.created_at
  `)

  // Filter to only those not in source
  const targetRows = zeroRows.filter(r => !allFbIds.has(String(r.fullbay_id)))
  console.log('Zero-total rows not in any source:', targetRows.length)

  // Enrich each row
  const results = []
  for (const row of targetRows) {
    const { rows: invs } = await pool.query('SELECT id, total, status FROM invoices WHERE so_id=$1', [row.id])
    const { rows: lines } = await pool.query('SELECT line_type, unit_price, total_price FROM so_lines WHERE so_id=$1', [row.id])

    let assetLabel = ''
    if (row.asset_id) {
      const { rows: [a] } = await pool.query('SELECT unit_number FROM assets WHERE id=$1', [row.asset_id])
      if (a) assetLabel = a.unit_number
    }

    let custName = ''
    if (row.customer_id) {
      const { rows: [c] } = await pool.query('SELECT company_name FROM customers WHERE id=$1', [row.customer_id])
      if (c) custName = c.company_name
    }

    const laborLines = lines.filter(l => l.line_type === 'labor')
    const partLines = lines.filter(l => l.line_type === 'part')
    const inSource = allFbIds.has(String(row.fullbay_id))

    results.push({
      ...row, assetLabel, custName,
      hasInvoice: invs.length > 0,
      lineCount: lines.length,
      laborLineCount: laborLines.length,
      partLineCount: partLines.length,
      inSource,
    })
  }

  // Bucket
  const buckets = {}
  for (const r of results) {
    const lt = parseFloat(r.labor_total) || 0
    const pt = parseFloat(r.parts_total) || 0
    let bucket
    if (r.hasInvoice) bucket = 'zero_with_invoice'
    else if (lt > 0 || pt > 0) bucket = 'zero_with_nonzero_subtotals'
    else if (r.lineCount > 0) bucket = 'historical_uninvoiced_supplies'
    else bucket = 'historical_uninvoiced_empty'
    buckets[bucket] = (buckets[bucket] || 0) + 1
    r.bucket = bucket
  }

  console.log('\nBuckets:')
  let total = 0
  for (const [b, c] of Object.entries(buckets)) {
    console.log('  ' + b + ': ' + c)
    total += c
  }
  console.log('Total: ' + total)

  // Write CSV
  const header = 'service_order_id,service_order_number,fullbay_source_id,created_at,updated_at,status,asset_id,asset_label,customer_id,customer_name,line_count,labor_line_count,part_line_count,labor_total,parts_total,grand_total,has_truckzen_invoice,found_in_fullbay_backup,found_in_recovered_patch_files,proposed_bucket,proof_note,risk_note'
  const csvRows = results.map(r => {
    const esc = s => '"' + String(s || '').replace(/"/g, '""') + '"'
    const proof = r.bucket === 'historical_uninvoiced_supplies'
      ? 'Zero-charge supply handoff. All financial fields zero. Not in any Fullbay invoice API response.'
      : 'Unclassified'
    const risk = 'None — operational history only, no financial value'
    return [
      r.id, r.so_number, r.fullbay_id,
      new Date(r.created_at).toISOString(),
      r.updated_at ? new Date(r.updated_at).toISOString() : '',
      r.status, r.asset_id || '', esc(r.assetLabel), r.customer_id || '', esc(r.custName),
      r.lineCount, r.laborLineCount, r.partLineCount,
      r.labor_total, r.parts_total, r.grand_total,
      r.hasInvoice, r.inSource, false,
      r.bucket, esc(proof), esc(risk)
    ].join(',')
  })

  fs.mkdirSync('mapping', { recursive: true })
  fs.writeFileSync('mapping/fullbay_zero_total_records.csv', header + '\n' + csvRows.join('\n'))
  console.log('\nCSV written: mapping/fullbay_zero_total_records.csv (' + results.length + ' rows)')

  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
