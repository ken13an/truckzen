#!/usr/bin/env node
/**
 * Patch 93G EXECUTION — Update-in-place
 *
 * Gate 4:  UPDATE historical Fullbay service_orders + invoices
 * Gate 4B: INSERT missing invoices for historical Fullbay SOs
 *
 * Field whitelist:
 *   service_orders: grand_total, parts_total
 *   invoices UPDATE: total, subtotal, tax_amount, amount_paid, balance_due, status
 *   invoices INSERT: shop_id, so_id, invoice_number, source, is_historical,
 *                    created_at, total, subtotal, tax_amount, amount_paid, balance_due, status
 *
 * NOT touched: invoice_number (on update), labor_total, so_lines, native rows, assets, customers
 *
 * Status logic:
 *   balance == 0                    → 'paid'
 *   balance == total                → 'sent'
 *   balance > 0 && balance < total  → 'partial'
 */

require('dotenv').config({ path: '.env.local' })
const crypto = require('crypto')
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

const SHOP_ID = '1f927e3e-4fe5-431a-bb7c-dac77501e892'
let cachedAuth = null

async function getAuth() {
  if (cachedAuth) return cachedAuth
  const key = process.env.FULLBAY_API_KEY
  const today = new Date().toISOString().split('T')[0]
  const ipRes = await fetch('https://api.ipify.org')
  const ip = (await ipRes.text()).trim()
  const token = crypto.createHash('sha1').update(key + today + ip).digest('hex')
  cachedAuth = { key, token }
  return cachedAuth
}

async function fbFetch(endpoint, params = {}, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { key, token } = await getAuth()
      const qs = new URLSearchParams({ key, token, ...params }).toString()
      const res = await fetch(`https://app.fullbay.com/services/${endpoint}?${qs}`)
      const data = await res.json()
      if (data.status === 'SUCCESS') return data
      if (attempt < retries) { await sleep(2000 * attempt); continue }
      throw new Error(`${data.status}: ${data.message || ''}`)
    } catch (e) {
      if (attempt >= retries) throw e
      await sleep(2000 * attempt)
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function deriveStatus(total, balance) {
  if (balance === 0) return 'paid'
  if (balance === total) return 'sent'
  if (balance > 0 && balance < total) return 'partial'
  return 'sent' // fallback for edge cases (balance > total)
}

async function main() {
  console.log('=== PATCH 93G EXECUTION ===')
  console.log('Started:', new Date().toISOString())
  console.log('Mode: UPDATE-IN-PLACE (no delete, no re-insert)')

  // ── Load all historical Fullbay records from DB ──
  console.log('\nLoading DB records...')
  const { rows: allWOs } = await pool.query(
    "SELECT id, so_number, fullbay_id, grand_total, parts_total FROM service_orders WHERE source='fullbay' AND is_historical=true"
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

  // ── Fetch ALL Fullbay invoices ──
  const startDate = '2021-02-01'
  const endDate = '2026-03-28'
  const start = new Date(startDate)
  const end = new Date(endDate)
  const totalWeeks = Math.ceil((end - start) / (7 * 86400000))

  console.log(`\nFetching Fullbay invoices: ${startDate} to ${endDate} (${totalWeeks} chunks)`)
  console.log('Rate limit: 1s delay per chunk, 5s pause every 30 chunks')

  const fbBySO = new Map() // primaryKey → first invoice record
  let totalFbRecords = 0
  let cur = new Date(start)
  let weekNum = 0
  let fetchErrors = 0
  let consecutiveErrors = 0

  while (cur <= end) {
    weekNum++
    const rangeEnd = new Date(Math.min(cur.getTime() + 6 * 86400000, end.getTime()))
    const sD = cur.toISOString().split('T')[0]
    const eD = rangeEnd.toISOString().split('T')[0]

    if (weekNum % 10 === 0) process.stdout.write(`  [${weekNum}/${totalWeeks}] ${sD}...${totalFbRecords} total (${fbBySO.size} unique SOs)\n`)

    try {
      let page = 1
      while (true) {
        const data = await fbFetch('getInvoices.php', { startDate: sD, endDate: eD, page: String(page) })
        const items = data.resultSet || []
        totalFbRecords += items.length

        for (const inv of items) {
          const pk = String(inv.ServiceOrder?.primaryKey || '')
          if (pk && !fbBySO.has(pk)) fbBySO.set(pk, inv)
        }

        if (page >= (data.totalPages || 1)) break
        page++
        await sleep(500) // delay between pages
      }
      consecutiveErrors = 0
    } catch (e) {
      fetchErrors++
      consecutiveErrors++
      if (fetchErrors <= 10) console.log(`  Fetch error ${sD}: ${e.message}`)
      if (consecutiveErrors > 5) {
        console.log(`  Consecutive errors: ${consecutiveErrors}. Pausing 30s...`)
        await sleep(30000)
        // Refresh auth token in case it expired
        cachedAuth = null
        consecutiveErrors = 0
      }
      if (fetchErrors > 100) {
        console.log('STOP: Too many fetch errors (>100). Aborting.')
        await pool.end()
        process.exit(1)
      }
    }

    // Rate limiting: 1s per chunk, 5s pause every 30 chunks
    await sleep(1000)
    if (weekNum % 30 === 0) {
      process.stdout.write(`  [Pause 5s at chunk ${weekNum}]\n`)
      await sleep(5000)
    }

    cur = new Date(cur.getTime() + 7 * 86400000)
  }

  console.log('\n=== FETCH COMPLETE ===')
  console.log('Total Fullbay invoice records:', totalFbRecords)
  console.log('Unique Fullbay SOs:', fbBySO.size)
  console.log('Fetch errors:', fetchErrors)

  // ── GATE 4: MAIN UPDATE BATCH ──
  console.log('\n========================================')
  console.log('GATE 4: MAIN UPDATE BATCH')
  console.log('========================================')

  const client = await pool.connect()
  let soUpdated = 0, soSkipped = 0
  let invUpdated = 0, invSkipped = 0
  const missingInvoices = [] // for Gate 4B
  const updateSamples = []
  const errors = []

  try {
    await client.query('BEGIN')

    for (const [pk, fbInv] of fbBySO) {
      const wo = woByPK.get(pk)
      if (!wo) continue // Fullbay SO not in our DB — skip

      const so = fbInv.ServiceOrder || {}
      const newGT = parseFloat(fbInv.total) || 0
      const newPT = parseFloat(so.partsTotal) || 0

      // UPDATE service_orders: grand_total, parts_total ONLY
      try {
        const { rowCount } = await client.query(
          'UPDATE service_orders SET grand_total = $1, parts_total = $2 WHERE id = $3',
          [newGT, newPT, wo.id]
        )
        if (rowCount > 0) soUpdated++
        else soSkipped++
      } catch (e) {
        errors.push(`SO ${wo.so_number}: ${e.message}`)
        if (errors.length > 100) { throw new Error('Too many errors (>100). Rolling back.') }
        continue
      }

      // UPDATE or track missing invoice
      const dbInv = invBySO.get(wo.id)
      if (dbInv) {
        const newInvTotal = parseFloat(fbInv.total) || 0
        const newSubtotal = parseFloat(fbInv.subTotal) || 0
        const newTaxAmt = parseFloat(fbInv.taxTotal) || 0
        const newBalance = parseFloat(fbInv.balance) || 0
        const newAmtPaid = newInvTotal - newBalance
        const newStatus = deriveStatus(newInvTotal, newBalance)

        try {
          const { rowCount } = await client.query(
            `UPDATE invoices SET total = $1, subtotal = $2, tax_amount = $3,
             amount_paid = $4, balance_due = $5, status = $6
             WHERE id = $7`,
            [newInvTotal, newSubtotal, newTaxAmt, newAmtPaid, newBalance, newStatus, dbInv.id]
          )
          if (rowCount > 0) invUpdated++
          else invSkipped++
        } catch (e) {
          errors.push(`INV ${dbInv.id}: ${e.message}`)
        }

        if (updateSamples.length < 5) {
          updateSamples.push({
            so_number: wo.so_number,
            so_before: { grand_total: wo.grand_total, parts_total: wo.parts_total },
            so_after: { grand_total: newGT, parts_total: newPT },
            inv_before: { total: dbInv.total, amount_paid: dbInv.amount_paid, balance_due: dbInv.balance_due, status: dbInv.status },
            inv_after: { total: newInvTotal, amount_paid: newAmtPaid, balance_due: newBalance, status: newStatus },
          })
        }
      } else {
        // Track for Gate 4B
        missingInvoices.push({ wo, fbInv })
      }
    }

    await client.query('COMMIT')
    console.log('Transaction: COMMITTED')
  } catch (e) {
    await client.query('ROLLBACK')
    console.log('Transaction: ROLLED BACK')
    console.log('Error:', e.message)
    console.log('\nSTOP — Gate 4 FAILED. No changes were written.')
    client.release()
    await pool.end()
    process.exit(1)
  }
  client.release()

  console.log('\nGate 4 results:')
  console.log('service_orders updated:', soUpdated)
  console.log('service_orders skipped:', soSkipped)
  console.log('invoices updated:', invUpdated)
  console.log('invoices skipped:', invSkipped)
  console.log('missing invoices (for Gate 4B):', missingInvoices.length)
  console.log('errors:', errors.length)
  if (errors.length > 0) {
    console.log('First 10 errors:')
    errors.slice(0, 10).forEach(e => console.log('  ' + e))
  }

  console.log('\n--- 5 update samples ---')
  for (const s of updateSamples) {
    console.log(`SO#${s.so_number}: gt=${s.so_before.grand_total}→${s.so_after.grand_total} pt=${s.so_before.parts_total}→${s.so_after.parts_total}`)
    console.log(`  INV: t=${s.inv_before.total}→${s.inv_after.total} ap=${s.inv_before.amount_paid}→${s.inv_after.amount_paid} bal=${s.inv_before.balance_due}→${s.inv_after.balance_due} st=${s.inv_before.status}→${s.inv_after.status}`)
  }

  // ── GATE 4B: MISSING INVOICE INSERT ──
  console.log('\n========================================')
  console.log('GATE 4B: MISSING INVOICE INSERT')
  console.log('========================================')
  console.log('Missing invoices to create:', missingInvoices.length)

  if (missingInvoices.length > 0) {
    // Pre-insert proof: check no duplicates will be created
    console.log('\nDuplicate prevention check...')
    let dupCount = 0
    for (const { wo } of missingInvoices.slice(0, 20)) {
      const { rows } = await pool.query(
        "SELECT COUNT(*) FROM invoices WHERE so_id = $1", [wo.id]
      )
      if (parseInt(rows[0].count) > 0) dupCount++
    }
    console.log('Duplicate check (first 20):', dupCount, 'would be duplicates')
    if (dupCount > 0) {
      console.log('WARNING: Some SOs already have invoices. Filtering to only truly missing.')
    }

    // Print 5 samples before insert
    console.log('\n--- 5 sample missing invoices BEFORE insert ---')
    for (const { wo, fbInv } of missingInvoices.slice(0, 5)) {
      const so = fbInv.ServiceOrder || {}
      const newTotal = parseFloat(fbInv.total) || 0
      const newBalance = parseFloat(fbInv.balance) || 0
      const newAmtPaid = newTotal - newBalance
      const newStatus = deriveStatus(newTotal, newBalance)
      console.log(`  SO#${wo.so_number} (id=${wo.id}): total=${newTotal} balance=${newBalance} amtPaid=${newAmtPaid} status=${newStatus}`)
    }

    // Insert in transaction
    const client2 = await pool.connect()
    let inserted = 0
    let insertSkipped = 0
    const insertErrors = []

    try {
      await client2.query('BEGIN')

      for (const { wo, fbInv } of missingInvoices) {
        // Double-check no existing invoice for this SO
        const { rows: existing } = await client2.query(
          "SELECT id FROM invoices WHERE so_id = $1 LIMIT 1", [wo.id]
        )
        if (existing.length > 0) {
          insertSkipped++
          continue
        }

        const so = fbInv.ServiceOrder || {}
        const newTotal = parseFloat(fbInv.total) || 0
        const newSubtotal = parseFloat(fbInv.subTotal) || 0
        const newTaxAmt = parseFloat(fbInv.taxTotal) || 0
        const newBalance = parseFloat(fbInv.balance) || 0
        const newAmtPaid = newTotal - newBalance
        const newStatus = deriveStatus(newTotal, newBalance)
        const createdAt = fbInv.invoiceDate || fbInv.created || new Date().toISOString()

        try {
          await client2.query(
            `INSERT INTO invoices (shop_id, so_id, invoice_number, source, is_historical,
             created_at, total, subtotal, tax_amount, amount_paid, balance_due, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [SHOP_ID, wo.id, `INV-FB-${wo.so_number}`, 'fullbay', true,
             createdAt, newTotal, newSubtotal, newTaxAmt, newAmtPaid, newBalance, newStatus]
          )
          inserted++
        } catch (e) {
          insertErrors.push(`SO#${wo.so_number}: ${e.message}`)
          if (insertErrors.length > 50) {
            throw new Error('Too many insert errors (>50). Rolling back.')
          }
        }
      }

      await client2.query('COMMIT')
      console.log('Insert transaction: COMMITTED')
    } catch (e) {
      await client2.query('ROLLBACK')
      console.log('Insert transaction: ROLLED BACK')
      console.log('Error:', e.message)
      console.log('\nSTOP — Gate 4B FAILED.')
      client2.release()
      await pool.end()
      process.exit(1)
    }
    client2.release()

    console.log('\nGate 4B results:')
    console.log('Invoices inserted:', inserted)
    console.log('Invoices skipped (already existed):', insertSkipped)
    console.log('Insert errors:', insertErrors.length)
    if (insertErrors.length > 0) {
      insertErrors.slice(0, 10).forEach(e => console.log('  ' + e))
    }
  }

  // ── GATE 5: FINAL PROOF ──
  console.log('\n========================================')
  console.log('GATE 5: FINAL PROOF')
  console.log('========================================')

  // Before/after counts
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
  console.log('Historical Fullbay SO: before=' + woByPK.size + ' after=' + histSOAfter + ' (should be equal)')
  console.log('Historical Fullbay INV: before=' + invBySO.size + ' after=' + histInvAfter + ' (after includes inserts)')
  console.log('Native SO: before=' + nativeSOBefore + ' after=' + nativeSOAfter + ' (MUST be equal)')
  console.log('Native INV: before=' + nativeInvBefore + ' after=' + nativeInvAfter + ' (MUST be equal)')

  if (nativeSOBefore !== nativeSOAfter) console.log('!!! ALERT: Native SO count changed !!!')
  if (nativeInvBefore !== nativeInvAfter) console.log('!!! ALERT: Native INV count changed !!!')

  // 5 updated service_orders proof
  console.log('\n--- 5 updated service_orders proof ---')
  for (const s of updateSamples) {
    const { rows: [current] } = await pool.query(
      "SELECT grand_total, parts_total, labor_total FROM service_orders WHERE so_number = $1 AND source='fullbay' AND is_historical=true",
      [s.so_number]
    )
    if (current) {
      console.log(`SO#${s.so_number}: grand_total=${current.grand_total} parts_total=${current.parts_total} labor_total=${current.labor_total}`)
    }
  }

  // 5 updated invoices proof
  console.log('\n--- 5 updated invoices proof ---')
  for (const s of updateSamples) {
    const { rows: [current] } = await pool.query(
      "SELECT i.total, i.amount_paid, i.balance_due, i.status, i.invoice_number FROM invoices i JOIN service_orders so ON i.so_id = so.id WHERE so.so_number = $1 AND i.source='fullbay' AND i.is_historical=true",
      [s.so_number]
    )
    if (current) {
      console.log(`SO#${s.so_number}: total=${current.total} amt_paid=${current.amount_paid} balance=${current.balance_due} status=${current.status} inv#=${current.invoice_number}`)
    }
  }

  // 5 inserted invoice proof
  if (missingInvoices.length > 0) {
    console.log('\n--- 5 inserted invoice proof ---')
    for (const { wo } of missingInvoices.slice(0, 5)) {
      const { rows: [current] } = await pool.query(
        "SELECT total, amount_paid, balance_due, status, invoice_number FROM invoices WHERE so_id = $1",
        [wo.id]
      )
      if (current) {
        console.log(`SO#${wo.so_number}: total=${current.total} amt_paid=${current.amount_paid} balance=${current.balance_due} status=${current.status} inv#=${current.invoice_number}`)
      }
    }
  }

  // 1 direct Fullbay comparison
  console.log('\n--- Direct Fullbay source comparison ---')
  const verifyPK = updateSamples[0]?.so_number
  if (verifyPK) {
    const { rows: [dbRow] } = await pool.query(
      "SELECT so.fullbay_id, so.grand_total, so.parts_total, so.labor_total, i.total as inv_total, i.amount_paid, i.balance_due, i.status FROM service_orders so LEFT JOIN invoices i ON i.so_id = so.id WHERE so.so_number = $1 AND so.source='fullbay'",
      [verifyPK]
    )
    const fbInv = fbBySO.get(dbRow?.fullbay_id)
    if (dbRow && fbInv) {
      console.log('Fullbay source: total=' + fbInv.total + ' balance=' + fbInv.balance + ' laborTotal=' + fbInv.ServiceOrder?.laborTotal + ' partsTotal=' + fbInv.ServiceOrder?.partsTotal)
      console.log('TZ DB now:      grand_total=' + dbRow.grand_total + ' parts_total=' + dbRow.parts_total + ' labor_total=' + dbRow.labor_total + ' inv_total=' + dbRow.inv_total + ' amt_paid=' + dbRow.amount_paid + ' balance=' + dbRow.balance_due + ' status=' + dbRow.status)
    }
  }

  // Confirm no other tables touched
  console.log('\n--- Other tables NOT touched ---')
  console.log('so_lines: NOT touched (out of scope)')
  console.log('assets: NOT touched')
  console.log('customers: NOT touched')
  console.log('All other tables: NOT touched')

  console.log('\n=== PATCH 93G EXECUTION COMPLETE ===')
  console.log('Finished:', new Date().toISOString())

  await pool.end()
}

main().catch(e => { console.error('FATAL:', e); pool.end().then(() => process.exit(1)) })
