#!/usr/bin/env node
/**
 * Fullbay_4 Audit Script — Source Separation
 * READ-ONLY — no DB writes
 *
 * Checks:
 * 1. Row markers across tables
 * 2. DB counts for source split
 * 3. Route/query separation behavior (printed as reference)
 *
 * Outputs: mapping/fullbay_source_separation_matrix.csv
 */
require('dotenv').config({ path: '.env.local' })
const { Pool } = require('pg')
const fs = require('fs')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

async function main() {
  console.log('=== Fullbay_4: Source Separation Audit ===\n')

  // Step 1: Row markers
  console.log('--- Row Markers ---')
  const tables = ['service_orders', 'invoices', 'customers', 'assets', 'so_lines']
  for (const t of tables) {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name=$1 AND column_name IN ('source','is_historical','fullbay_id','fullbay_synced_at','external_id','external_data')
       ORDER BY column_name`, [t]
    )
    console.log(t + ': ' + (rows.length > 0 ? rows.map(r => r.column_name).join(', ') : 'NONE'))
  }

  // Step 2: DB counts
  console.log('\n--- DB Counts ---')
  for (const t of ['service_orders', 'invoices']) {
    const { rows } = await pool.query(`SELECT source, is_historical, COUNT(*) FROM ${t} GROUP BY source, is_historical ORDER BY COUNT(*) DESC`)
    console.log(t + ':')
    for (const r of rows) console.log('  ' + JSON.stringify(r))
  }

  for (const t of ['customers', 'assets']) {
    const { rows } = await pool.query(`SELECT source, COUNT(*) FROM ${t} GROUP BY source ORDER BY COUNT(*) DESC`)
    console.log(t + ':')
    for (const r of rows) console.log('  ' + JSON.stringify(r))
  }

  // Step 3: Write CSV matrix
  const matrix = [
    ['api_route','service-orders (GET)','service_orders','conditional','yes','param-dependent exclude_historical','none','yes via select','Default mixes historical+native; requires exclude_historical=true param','risky_mixing'],
    ['api_route','service-orders/[id] (PATCH)','service_orders','yes','yes','none','HIGH - can update historical SO fields','no','No is_historical guard on mutations','mutation_risk'],
    ['api_route','accounting (GET)','service_orders','no','yes','always excludes via .neq(is_historical).neq(source,fullbay)','none','no','Always safe','safe_exclusion'],
    ['api_route','work-orders (GET)','service_orders','conditional','yes','param-dependent historical=true|false','none','yes via select','Explicit filtering support','safe_exclusion'],
    ['api_route','work-orders/[id] (PATCH)','service_orders','yes','yes','none','HIGH - can update historical WOs','no','No is_historical guard','mutation_risk'],
    ['api_route','invoices (GET)','invoices','conditional','conditional','param-dependent historical=true|false; default mixes','none','yes (is_historical,source in select)','Default mixes; exposes source labels','risky_mixing'],
    ['api_route','invoices/[id] (PATCH)','invoices','yes','yes','none','HIGH - can update historical invoices','no','No is_historical guard','mutation_risk'],
    ['api_route','so-lines (POST)','so_lines+service_orders','yes','yes','none','HIGH - can add lines to historical SOs + recalcTotals overwrites','no','recalcTotals would corrupt corrected Fullbay financials','mutation_risk'],
    ['api_route','so-lines/[id] (PATCH)','so_lines+service_orders','yes','yes','none','HIGH - can edit lines + recalcTotals overwrites','no','recalcTotals would corrupt corrected Fullbay financials','mutation_risk'],
    ['api_route','so-lines/[id] (DELETE)','so_lines+service_orders','yes','yes','none','HIGH - can delete lines + recalcTotals overwrites','no','recalcTotals would corrupt corrected Fullbay financials','mutation_risk'],
    ['api_route','floor-manager/jobs (GET)','service_orders','no (JS filter)','yes','JS post-query filter !is_historical','none','no','Filters in JS after query; fragile','risky_mixing'],
    ['api_route','admin/repair-totals (POST)','service_orders','no','yes','always excludes historical','none','no','Safe - only repairs native','safe_exclusion'],
    ['api_route','reports (GET)','service_orders+invoices','conditional','conditional','source_mode=live|fullbay|combined','none','no','Proper source-mode support','safe_exclusion'],
    ['api_route','customers/[id] (GET)','service_orders','no','yes','.neq(is_historical,true) on SO subquery','none','no','Safe exclusion in customer view','safe_exclusion'],
    ['api_route','work-orders (POST)','service_orders','no','yes','sets source=walk_in','none','no','New records always native','safe_exclusion'],
    ['api_route','accounting/approve (POST)','service_orders+invoices','yes','yes','none','MEDIUM - can approve/invoice historical','no','No is_historical guard','mutation_risk'],
    ['api_route','portal/[token] (GET)','service_orders','yes','yes','none','none','yes','Public portal exposes all fields','risky_mixing'],
    ['api_route','v1/work-orders (GET)','service_orders','yes','yes','none','none','yes (source,is_historical in select)','Public API exposes source labels','risky_mixing'],
    ['api_route','export/full (POST)','service_orders+invoices','yes','yes','none','none','yes','Exports raw source values','intentional_include'],
  ]

  const header = 'surface_type,file_or_route,entity,includes_historical_fullbay,includes_native,separation_behavior,mutation_risk,source_label_leak_risk,proof_note,status'
  const csvRows = matrix.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','))

  fs.mkdirSync('mapping', { recursive: true })
  fs.writeFileSync('mapping/fullbay_source_separation_matrix.csv', header + '\n' + csvRows.join('\n'))
  console.log('\nCSV written: mapping/fullbay_source_separation_matrix.csv (' + matrix.length + ' rows)')

  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
