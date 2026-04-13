#!/usr/bin/env node
/**
 * Patch 93G — Phase 2: APPLY updates from fetched Fullbay data.
 * Reads: backups/patch93g_fullbay_data.json (from patch93g-fetch.js)
 *
 * Gate 4:  UPDATE historical Fullbay service_orders + invoices
 * Gate 4B: INSERT missing invoices
 * Gate 5:  Final proof
 *
 * Field whitelist:
 *   service_orders UPDATE: grand_total, parts_total
 *   invoices UPDATE: total, subtotal, tax_amount, amount_paid, balance_due, status
 *   invoices INSERT: shop_id, so_id, invoice_number, source, is_historical,
 *                    created_at, total, subtotal, tax_amount, amount_paid, balance_due, status
 *
 * Status logic:
 *   balance == 0                    → 'paid'
 *   balance == total                → 'sent'
 *   balance > 0 && balance < total  → 'partial'
 */

require('dotenv').config({ path: '.env.local' })
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 300000,
})

const SHOP_ID = '1f927e3e-4fe5-431a-bb7c-dac77501e892'
const DATA_FILE = path.join(__dirname, '..', 'backups', 'patch93g_fullbay_data.json')

function deriveStatus(total, balance) {
  if (balance === 0) return 'paid'
  if (balance === total) return 'sent'
  if (balance > 0 && balance < total) return 'partial'
  return 'sent'
}

async function main() {
  console.log('=== PATCH 93G — PHASE 2: APPLY ===')
  console.log('Started:', new Date().toISOString())

  // Load fetched Fullbay data
  if (!fs.existsSync(DATA_FILE)) {
    console.log('STOP: Data file not found:', DATA_FILE)
    process.exit(1)
  }
  const fbData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
  const fbBySO = new Map(Object.entries(fbData))
  console.log('Fullbay SOs loaded from file:', fbBySO.size)

  // Load DB records
  console.log('\nLoading DB records...')
  const { rows: allWOs } = await pool.query(
    "SELECT id, so_number, fullbay_id, grand_total, parts_total, shop_id FROM service_orders WHERE source='fullbay' AND is_historical=true"
  )
  const woByPK = new Map()
  for (const wo of allWOs) {
    if (wo.fullbay_id) woByPK.set(String(wo.fullbay_id), wo)
  }
  console.log('DB historical WOs:', woByPK.size)

  const { rows: allInvs } = await pool.query(
    "SELECT id, so_id, total, subtotal, tax_amount, amount_paid, balance_due, status FROM invoices WHERE source='fullbay' AND is_historical=true"
  )
  const invBySO = new Map()
  for (const inv of allInvs) invBySO.set(inv.so_id, inv)
  console.log('DB historical invoices:', invBySO.size)

  // Snapshot native counts
  const { rows: [{ count: nativeSOBefore }] } = await pool.query(
    "SELECT COUNT(*) FROM service_orders WHERE NOT (source='fullbay' AND is_historical=true)"
  )
  const { rows: [{ count: nativeInvBefore }] } = await pool.query(
    "SELECT COUNT(*) FROM invoices WHERE NOT (source='fullbay' AND is_historical=true)"
  )
  console.log('Native SO count (must not change):', nativeSOBefore)
  console.log('Native invoice count (must not change):', nativeInvBefore)

  // ── GATE 4: MAIN UPDATE BATCH ──
  console.log('\n========================================')
  console.log('GATE 4: MAIN UPDATE BATCH (chunked transactions)')
  console.log('========================================')

  // Prepare all updates first (no DB calls)
  const soUpdates = []   // { id, grand_total, parts_total }
  const invUpdates = []  // { id, total, subtotal, tax_amount, amount_paid, status }
  const missingInvoices = []
  const updateSamples = []
  let soNoMatch = 0

  for (const [pk, fbInv] of fbBySO) {
    const wo = woByPK.get(pk)
    if (!wo) { soNoMatch++; continue }

    const so = fbInv.ServiceOrder || {}
    const newGT = parseFloat(fbInv.total) || 0
    const newPT = parseFloat(so.partsTotal) || 0

    soUpdates.push({ id: wo.id, grand_total: newGT, parts_total: newPT })

    const dbInv = invBySO.get(wo.id)
    if (dbInv) {
      const newInvTotal = parseFloat(fbInv.total) || 0
      const newSubtotal = parseFloat(fbInv.subTotal) || 0
      const newTaxAmt = parseFloat(fbInv.taxTotal) || 0
      const newBalance = parseFloat(fbInv.balance) || 0
      const newAmtPaid = newInvTotal - newBalance
      const newStatus = deriveStatus(newInvTotal, newBalance)

      invUpdates.push({ id: dbInv.id, total: newInvTotal, subtotal: newSubtotal, tax_amount: newTaxAmt, amount_paid: newAmtPaid, status: newStatus })

      if (updateSamples.length < 5) {
        updateSamples.push({
          so_number: wo.so_number, fullbay_id: pk,
          so_before: { grand_total: wo.grand_total, parts_total: wo.parts_total },
          so_after: { grand_total: newGT, parts_total: newPT },
          inv_before: { total: dbInv.total, amount_paid: dbInv.amount_paid, balance_due: dbInv.balance_due, status: dbInv.status },
          inv_after: { total: newInvTotal, amount_paid: newAmtPaid, balance_due: newBalance, status: newStatus },
        })
      }
    } else {
      missingInvoices.push({ wo, fbInv })
    }
  }

  console.log('Prepared SO updates:', soUpdates.length)
  console.log('Prepared invoice updates:', invUpdates.length)
  console.log('Fullbay SOs not in DB:', soNoMatch)
  console.log('Missing invoices (for Gate 4B):', missingInvoices.length)

  // Execute SO updates in chunks of 500 using batch UPDATE
  const CHUNK = 500
  let soUpdated = 0
  const soErrors = []

  console.log('\nUpdating service_orders in chunks of', CHUNK, '...')
  for (let i = 0; i < soUpdates.length; i += CHUNK) {
    const chunk = soUpdates.slice(i, i + CHUNK)
    const ids = chunk.map(r => r.id)
    const gts = chunk.map(r => r.grand_total)
    const pts = chunk.map(r => r.parts_total)

    try {
      const result = await pool.query(
        `UPDATE service_orders SET
          grand_total = data.gt::numeric,
          parts_total = data.pt::numeric
        FROM (SELECT unnest($1::uuid[]) AS id, unnest($2::numeric[]) AS gt, unnest($3::numeric[]) AS pt) AS data
        WHERE service_orders.id = data.id`,
        [ids, gts, pts]
      )
      soUpdated += result.rowCount
    } catch (e) {
      soErrors.push(`Chunk ${i}: ${e.message}`)
    }

    if ((i / CHUNK) % 10 === 0 && i > 0) console.log(`  SO: ${soUpdated} updated (${i}/${soUpdates.length})`)
  }
  console.log('SO updates complete:', soUpdated)
  if (soErrors.length > 0) { console.log('SO errors:'); soErrors.forEach(e => console.log('  ' + e)) }

  // Execute invoice updates in chunks
  let invUpdated = 0
  const invErrors = []

  console.log('\nUpdating invoices in chunks of', CHUNK, '...')
  for (let i = 0; i < invUpdates.length; i += CHUNK) {
    const chunk = invUpdates.slice(i, i + CHUNK)
    const ids = chunk.map(r => r.id)
    const totals = chunk.map(r => r.total)
    const subtotals = chunk.map(r => r.subtotal)
    const taxAmts = chunk.map(r => r.tax_amount)
    const amtPaids = chunk.map(r => r.amount_paid)
    const statuses = chunk.map(r => r.status)

    try {
      // balance_due is a generated column, do NOT update it
      const result = await pool.query(
        `UPDATE invoices SET
          total = data.t::numeric,
          subtotal = data.st::numeric,
          tax_amount = data.ta::numeric,
          amount_paid = data.ap::numeric,
          status = data.s::invoice_status
        FROM (SELECT unnest($1::uuid[]) AS id, unnest($2::numeric[]) AS t, unnest($3::numeric[]) AS st,
              unnest($4::numeric[]) AS ta, unnest($5::numeric[]) AS ap, unnest($6::text[]) AS s) AS data
        WHERE invoices.id = data.id`,
        [ids, totals, subtotals, taxAmts, amtPaids, statuses]
      )
      invUpdated += result.rowCount
    } catch (e) {
      invErrors.push(`Chunk ${i}: ${e.message}`)
    }

    if ((i / CHUNK) % 10 === 0 && i > 0) console.log(`  INV: ${invUpdated} updated (${i}/${invUpdates.length})`)
  }
  console.log('Invoice updates complete:', invUpdated)
  if (invErrors.length > 0) { console.log('Invoice errors:'); invErrors.forEach(e => console.log('  ' + e)) }

  const errors = [...soErrors, ...invErrors]

  console.log('\nGate 4 results:')
  console.log('  service_orders updated:', soUpdated)
  console.log('  service_orders skipped (no rowCount):', soSkipped)
  console.log('  Fullbay SOs not in DB:', soNoMatch)
  console.log('  invoices updated:', invUpdated)
  console.log('  invoices skipped:', invSkipped)
  console.log('  missing invoices (for Gate 4B):', missingInvoices.length)
  console.log('  errors:', errors.length)
  if (errors.length > 0) errors.slice(0, 10).forEach(e => console.log('    ' + e))

  console.log('\n--- 5 update samples ---')
  for (const s of updateSamples) {
    console.log(`SO#${s.so_number}: gt=${s.so_before.grand_total}→${s.so_after.grand_total} pt=${s.so_before.parts_total}→${s.so_after.parts_total}`)
    console.log(`  INV: t=${s.inv_before.total}→${s.inv_after.total} ap=${s.inv_before.amount_paid}→${s.inv_after.amount_paid} bal=${s.inv_before.balance_due}→${s.inv_after.balance_due} st=${s.inv_before.status}→${s.inv_after.status}`)
  }

  // ── GATE 4B: MISSING INVOICE INSERT ──
  console.log('\n========================================')
  console.log('GATE 4B: MISSING INVOICE INSERT (separate transaction)')
  console.log('========================================')
  console.log('Missing invoices to create:', missingInvoices.length)

  if (missingInvoices.length > 0) {
    // Print 5 samples before insert
    console.log('\n--- 5 sample missing invoices ---')
    for (const { wo, fbInv } of missingInvoices.slice(0, 5)) {
      const newTotal = parseFloat(fbInv.total) || 0
      const newBalance = parseFloat(fbInv.balance) || 0
      const newAmtPaid = newTotal - newBalance
      const newStatus = deriveStatus(newTotal, newBalance)
      console.log(`  SO#${wo.so_number} (id=${wo.id}): total=${newTotal} balance=${newBalance} amtPaid=${newAmtPaid} status=${newStatus}`)
    }

    const client2 = await pool.connect()
    let inserted = 0, insertSkipped = 0
    const insertErrors = []
    const insertSamples = []

    try {
      await client2.query('BEGIN')

      for (const { wo, fbInv } of missingInvoices) {
        // Duplicate check
        const { rows: existing } = await client2.query(
          'SELECT id FROM invoices WHERE so_id = $1 LIMIT 1', [wo.id]
        )
        if (existing.length > 0) { insertSkipped++; continue }

        const so = fbInv.ServiceOrder || {}
        const newTotal = parseFloat(fbInv.total) || 0
        const newSubtotal = parseFloat(fbInv.subTotal) || 0
        const newTaxAmt = parseFloat(fbInv.taxTotal) || 0
        const newBalance = parseFloat(fbInv.balance) || 0
        const newAmtPaid = newTotal - newBalance
        const newStatus = deriveStatus(newTotal, newBalance)
        const createdAt = fbInv.invoiceDate || fbInv.created || new Date().toISOString()

        try {
          // balance_due is a generated column (total - amount_paid), do NOT insert it
          await client2.query(
            `INSERT INTO invoices (shop_id, so_id, invoice_number, source, is_historical,
             created_at, total, subtotal, tax_amount, amount_paid, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [wo.shop_id || SHOP_ID, wo.id, `INV-FB-${wo.so_number}`, 'fullbay', true,
             createdAt, newTotal, newSubtotal, newTaxAmt, newAmtPaid, newStatus]
          )
          inserted++
          if (insertSamples.length < 5) {
            insertSamples.push({ so_number: wo.so_number, total: newTotal, amtPaid: newAmtPaid, balance: newBalance, status: newStatus })
          }
        } catch (e) {
          insertErrors.push(`SO#${wo.so_number}: ${e.message}`)
          if (insertErrors.length > 50) throw new Error('Too many insert errors. Rolling back.')
        }
      }

      await client2.query('COMMIT')
      console.log('Insert transaction: COMMITTED')
    } catch (e) {
      await client2.query('ROLLBACK')
      console.log('Insert transaction: ROLLED BACK — ' + e.message)
      console.log('STOP — Gate 4B FAILED.')
      client2.release()
      await pool.end()
      process.exit(1)
    }
    client2.release()

    console.log('\nGate 4B results:')
    console.log('  Invoices inserted:', inserted)
    console.log('  Invoices skipped (already existed):', insertSkipped)
    console.log('  Insert errors:', insertErrors.length)
    if (insertErrors.length > 0) insertErrors.slice(0, 10).forEach(e => console.log('    ' + e))

    console.log('\n--- 5 inserted invoice samples ---')
    for (const s of insertSamples) {
      console.log(`  SO#${s.so_number}: total=${s.total} amtPaid=${s.amtPaid} balance=${s.balance} status=${s.status}`)
    }
  }

  // ── GATE 5: FINAL PROOF ──
  console.log('\n========================================')
  console.log('GATE 5: FINAL PROOF')
  console.log('========================================')

  const { rows: [{ count: histSOAfter }] } = await pool.query(
    "SELECT COUNT(*) FROM service_orders WHERE source='fullbay' AND is_historical=true"
  )
  const { rows: [{ count: histInvAfter }] } = await pool.query(
    "SELECT COUNT(*) FROM invoices WHERE source='fullbay' AND is_historical=true"
  )
  const { rows: [{ count: nativeSOAfter }] } = await pool.query(
    "SELECT COUNT(*) FROM service_orders WHERE NOT (source='fullbay' AND is_historical=true)"
  )
  const { rows: [{ count: nativeInvAfter }] } = await pool.query(
    "SELECT COUNT(*) FROM invoices WHERE NOT (source='fullbay' AND is_historical=true)"
  )

  console.log('\n--- Row counts ---')
  console.log('Historical Fullbay SO: before=' + woByPK.size + ' after=' + histSOAfter + ' (must be equal)')
  console.log('Historical Fullbay INV: before=' + invBySO.size + ' after=' + histInvAfter + ' (after = before + inserts)')
  console.log('Native SO: before=' + nativeSOBefore + ' after=' + nativeSOAfter + ' (MUST be equal)')
  console.log('Native INV: before=' + nativeInvBefore + ' after=' + nativeInvAfter + ' (MUST be equal)')

  const nativeSOSafe = nativeSOBefore === nativeSOAfter
  const nativeInvSafe = nativeInvBefore === nativeInvAfter
  console.log('Native SO unchanged:', nativeSOSafe ? 'YES' : '!!! ALERT !!!')
  console.log('Native INV unchanged:', nativeInvSafe ? 'YES' : '!!! ALERT !!!')

  // 5 updated service_orders proof
  console.log('\n--- 5 updated service_orders proof ---')
  for (const s of updateSamples) {
    const { rows: [current] } = await pool.query(
      "SELECT grand_total, parts_total, labor_total FROM service_orders WHERE fullbay_id = $1", [s.fullbay_id]
    )
    if (current) console.log(`SO#${s.so_number}: grand_total=${current.grand_total} parts_total=${current.parts_total} labor_total=${current.labor_total}`)
  }

  // 5 updated invoices proof
  console.log('\n--- 5 updated invoices proof ---')
  for (const s of updateSamples) {
    const { rows: [current] } = await pool.query(
      "SELECT i.total, i.amount_paid, i.balance_due, i.status, i.invoice_number FROM invoices i JOIN service_orders so ON i.so_id = so.id WHERE so.fullbay_id = $1 AND i.source='fullbay'", [s.fullbay_id]
    )
    if (current) console.log(`SO#${s.so_number}: total=${current.total} amt_paid=${current.amount_paid} balance=${current.balance_due} status=${current.status} inv#=${current.invoice_number}`)
  }

  // 1 direct Fullbay source comparison
  console.log('\n--- Direct Fullbay source comparison ---')
  if (updateSamples[0]) {
    const s = updateSamples[0]
    const fbInv = fbBySO.get(s.fullbay_id)
    const { rows: [dbRow] } = await pool.query(
      "SELECT so.grand_total, so.parts_total, so.labor_total, i.total as inv_total, i.amount_paid, i.balance_due, i.status FROM service_orders so LEFT JOIN invoices i ON i.so_id = so.id WHERE so.fullbay_id = $1", [s.fullbay_id]
    )
    if (fbInv && dbRow) {
      const so = fbInv.ServiceOrder || {}
      console.log('Fullbay source: total=' + fbInv.total + ' balance=' + fbInv.balance + ' laborTotal=' + so.laborTotal + ' partsTotal=' + so.partsTotal)
      console.log('TZ DB now:      grand_total=' + dbRow.grand_total + ' parts_total=' + dbRow.parts_total + ' labor_total=' + dbRow.labor_total)
      console.log('TZ Invoice:     total=' + dbRow.inv_total + ' amt_paid=' + dbRow.amount_paid + ' balance=' + dbRow.balance_due + ' status=' + dbRow.status)
    }
  }

  console.log('\n--- Tables NOT touched ---')
  console.log('so_lines: NOT touched')
  console.log('assets: NOT touched')
  console.log('customers: NOT touched')
  console.log('All other tables: NOT touched')

  // Final status
  const allGood = nativeSOSafe && nativeInvSafe && errors.length === 0
  console.log('\n========================================')
  console.log('PATCH 93G STATUS:', allGood ? 'PROVEN' : 'NOT PROVEN — review alerts above')
  console.log('========================================')
  console.log('Finished:', new Date().toISOString())

  await pool.end()
}

main().catch(e => { console.error('FATAL:', e); pool.end().then(() => process.exit(1)) })
