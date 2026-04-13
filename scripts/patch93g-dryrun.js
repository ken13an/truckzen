require('dotenv').config({ path: '.env.local' })
const crypto = require('crypto')
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

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
      const res = await fetch('https://app.fullbay.com/services/' + endpoint + '?' + qs)
      const data = await res.json()
      if (data.status === 'SUCCESS') return data
      if (attempt < retries) { await sleep(2000 * attempt); continue }
      throw new Error(data.status + ': ' + (data.message || ''))
    } catch (e) {
      if (attempt >= retries) throw e
      await sleep(2000 * attempt)
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  console.log('=== PATCH 93G: FULL-RANGE DRY RUN ===')
  console.log('Started:', new Date().toISOString())

  // Load ALL historical Fullbay WOs using pg directly (no 1000-row limit)
  console.log('\nLoading DB records...')
  const woResult = await pool.query(
    "SELECT id, so_number, fullbay_id, grand_total, labor_total, parts_total, status FROM service_orders WHERE source='fullbay' AND is_historical=true"
  )
  const allWOs = woResult.rows

  const woByPK = new Map()
  for (const wo of allWOs) {
    if (wo.fullbay_id) woByPK.set(String(wo.fullbay_id), wo)
  }
  console.log('DB historical WOs loaded:', woByPK.size)

  // Load all invoices
  const invResult = await pool.query(
    "SELECT id, so_id, invoice_number, total, amount_paid, balance_due, status, subtotal, tax_amount FROM invoices WHERE source='fullbay' AND is_historical=true"
  )
  const invBySO = new Map()
  for (const inv of invResult.rows) {
    invBySO.set(inv.so_id, inv)
  }
  console.log('DB historical invoices loaded:', invBySO.size)

  // Fetch ALL Fullbay invoices in 7-day chunks
  const startDate = '2021-02-01'
  const endDate = '2026-03-28'
  const start = new Date(startDate)
  const end = new Date(endDate)
  const totalWeeks = Math.ceil((end - start) / (7 * 86400000))

  console.log('\nFetching Fullbay invoices:', startDate, 'to', endDate, '(' + totalWeeks + ' chunks)')

  const allFb = []
  const fbBySO = new Map()
  let cur = new Date(start)
  let weekNum = 0
  let fetchErrors = 0

  while (cur <= end) {
    weekNum++
    const rangeEnd = new Date(Math.min(cur.getTime() + 6 * 86400000, end.getTime()))
    const sD = cur.toISOString().split('T')[0]
    const eD = rangeEnd.toISOString().split('T')[0]

    if (weekNum % 20 === 0) process.stdout.write(`  [${weekNum}/${totalWeeks}] ${sD}...${allFb.length} total\n`)

    try {
      let page = 1
      while (true) {
        const data = await fbFetch('getInvoices.php', { startDate: sD, endDate: eD, page: String(page) })
        const items = data.resultSet || []
        allFb.push(...items)

        for (const inv of items) {
          const so = inv.ServiceOrder || {}
          const pk = String(so.primaryKey || '')
          if (pk) {
            if (!fbBySO.has(pk)) fbBySO.set(pk, [])
            fbBySO.get(pk).push(inv)
          }
        }

        if (page >= (data.totalPages || 1)) break
        page++
      }
    } catch (e) {
      fetchErrors++
      if (fetchErrors <= 5) console.log('  Fetch error ' + sD + ': ' + e.message)
    }

    cur = new Date(cur.getTime() + 7 * 86400000)
  }

  console.log('\n=== FETCH COMPLETE ===')
  console.log('Total Fullbay invoice records:', allFb.length)
  console.log('Unique Fullbay SOs (by primaryKey):', fbBySO.size)
  console.log('Fetch errors:', fetchErrors)

  let multiInvSOs = 0
  for (const [, invs] of fbBySO) {
    if (invs.length > 1) multiInvSOs++
  }
  console.log('SOs with multiple invoices:', multiInvSOs)

  // STEP 3: MATCH RATE
  console.log('\n========================================')
  console.log('STEP 3: FULL-RANGE DRY-RUN MATCH RATE')
  console.log('========================================')

  let matched = 0, unmatchedDB = 0, unmatchedFB = 0
  const unmatchedDBSamples = []
  const unmatchedFBSamples = []
  const matchedPairs = []

  for (const [pk, wo] of woByPK) {
    if (fbBySO.has(pk)) {
      matched++
      matchedPairs.push({ wo, fbInvs: fbBySO.get(pk) })
    } else {
      unmatchedDB++
      if (unmatchedDBSamples.length < 10) {
        unmatchedDBSamples.push({ so_number: wo.so_number, fullbay_id: wo.fullbay_id, grand_total: wo.grand_total })
      }
    }
  }

  for (const [pk] of fbBySO) {
    if (!woByPK.has(pk)) {
      unmatchedFB++
      if (unmatchedFBSamples.length < 10) {
        const inv = fbBySO.get(pk)[0]
        unmatchedFBSamples.push({
          primaryKey: pk,
          RO: inv.ServiceOrder?.repairOrderNumber,
          total: inv.total,
          invoiceDate: inv.invoiceDate
        })
      }
    }
  }

  console.log('DB historical rows in scope:', woByPK.size)
  console.log('Fullbay source SOs scanned:', fbBySO.size)
  console.log('Matched:', matched)
  console.log('Unmatched DB rows (no Fullbay source):', unmatchedDB)
  console.log('Unmatched Fullbay rows (not in DB):', unmatchedFB)
  console.log('Match percentage:', (matched / woByPK.size * 100).toFixed(2) + '%')

  if (unmatchedDBSamples.length > 0) {
    console.log('\nUnmatched DB samples (no Fullbay source):')
    for (const s of unmatchedDBSamples) console.log('  ', JSON.stringify(s))
  }
  if (unmatchedFBSamples.length > 0) {
    console.log('\nUnmatched Fullbay samples (not in DB):')
    for (const s of unmatchedFBSamples) console.log('  ', JSON.stringify(s))
  }

  // STEP 5: CHANGED-ROW PROOF
  console.log('\n========================================')
  console.log('STEP 5: FULL-RANGE CHANGED-ROW PROOF')
  console.log('========================================')

  let woChanged = 0, woUnchanged = 0
  let invChanged = 0, invUnchanged = 0, invMissing = 0
  const changeSamples = []

  let grandTotalChanges = 0, laborTotalChanges = 0, partsTotalChanges = 0
  let invTotalChanges = 0, invAmtPaidChanges = 0, invStatusChanges = 0, invBalanceChanges = 0
  let invSubtotalChanges = 0, invTaxChanges = 0

  for (const pair of matchedPairs) {
    const wo = pair.wo
    const fbInv = pair.fbInvs[0]
    const so = fbInv.ServiceOrder || {}

    const newGT = parseFloat(fbInv.total) || 0
    const newLT = parseFloat(so.laborTotal) || 0
    const newPT = parseFloat(so.partsTotal) || 0

    const oldGT = parseFloat(wo.grand_total) || 0
    const oldLT = parseFloat(wo.labor_total) || 0
    const oldPT = parseFloat(wo.parts_total) || 0

    const gtDiff = Math.abs(oldGT - newGT) > 0.01
    const ltDiff = Math.abs(oldLT - newLT) > 0.01
    const ptDiff = Math.abs(oldPT - newPT) > 0.01
    const woHasChange = gtDiff || ltDiff || ptDiff

    if (woHasChange) {
      woChanged++
      if (gtDiff) grandTotalChanges++
      if (ltDiff) laborTotalChanges++
      if (ptDiff) partsTotalChanges++
    } else {
      woUnchanged++
    }

    const dbInv = invBySO.get(wo.id)
    if (dbInv) {
      const newInvTotal = parseFloat(fbInv.total) || 0
      const newAmtPaid = newInvTotal - (parseFloat(fbInv.balance) || 0)
      const newBalance = parseFloat(fbInv.balance) || 0
      const newStatus = newBalance > 0 ? 'sent' : 'paid'
      const newSubtotal = parseFloat(fbInv.subTotal) || 0
      const newTax = parseFloat(fbInv.taxTotal) || 0

      const oldInvTotal = parseFloat(dbInv.total) || 0
      const oldAmtPaid = parseFloat(dbInv.amount_paid) || 0
      const oldBalance = parseFloat(dbInv.balance_due) || 0
      const oldStatus = dbInv.status
      const oldSubtotal = parseFloat(dbInv.subtotal) || 0
      const oldTax = parseFloat(dbInv.tax_amount) || 0

      const itDiff = Math.abs(oldInvTotal - newInvTotal) > 0.01
      const apDiff = Math.abs(oldAmtPaid - newAmtPaid) > 0.01
      const bdDiff = Math.abs(oldBalance - newBalance) > 0.01
      const stDiff = oldStatus !== newStatus
      const subDiff = Math.abs(oldSubtotal - newSubtotal) > 0.01
      const txDiff = Math.abs(oldTax - newTax) > 0.01
      const invHasChange = itDiff || apDiff || bdDiff || stDiff || subDiff || txDiff

      if (invHasChange) {
        invChanged++
        if (itDiff) invTotalChanges++
        if (apDiff) invAmtPaidChanges++
        if (bdDiff) invBalanceChanges++
        if (stDiff) invStatusChanges++
        if (subDiff) invSubtotalChanges++
        if (txDiff) invTaxChanges++
      } else {
        invUnchanged++
      }

      if (changeSamples.length < 10 && (woHasChange || invHasChange)) {
        changeSamples.push({
          so_number: wo.so_number,
          wo_before: { grand_total: oldGT, labor_total: oldLT, parts_total: oldPT },
          wo_after: { grand_total: newGT, labor_total: newLT, parts_total: newPT },
          inv_before: { total: oldInvTotal, amount_paid: oldAmtPaid, balance_due: oldBalance, status: oldStatus },
          inv_after: { total: newInvTotal, amount_paid: newAmtPaid, balance_due: newBalance, status: newStatus },
        })
      }
    } else {
      invMissing++
    }
  }

  console.log('service_orders that WOULD change:', woChanged)
  console.log('service_orders unchanged:', woUnchanged)
  console.log('invoices that WOULD change:', invChanged)
  console.log('invoices unchanged:', invUnchanged)
  console.log('invoices missing (would need creation):', invMissing)

  // STEP 6: FIELD-LEVEL DIFF
  console.log('\n========================================')
  console.log('STEP 6: FIELD-LEVEL DIFF COUNTS')
  console.log('========================================')
  console.log('service_orders.grand_total changes:', grandTotalChanges)
  console.log('service_orders.labor_total changes:', laborTotalChanges)
  console.log('service_orders.parts_total changes:', partsTotalChanges)
  console.log('invoices.total changes:', invTotalChanges)
  console.log('invoices.amount_paid changes:', invAmtPaidChanges)
  console.log('invoices.balance_due changes:', invBalanceChanges)
  console.log('invoices.status changes:', invStatusChanges)
  console.log('invoices.subtotal changes:', invSubtotalChanges)
  console.log('invoices.tax_amount changes:', invTaxChanges)

  console.log('\n=== 10 SAMPLE BEFORE/AFTER DIFFS ===')
  for (let i = 0; i < changeSamples.length; i++) {
    const s = changeSamples[i]
    console.log('\n--- Diff ' + (i+1) + ' (SO#' + s.so_number + ') ---')
    console.log('WO before:', JSON.stringify(s.wo_before))
    console.log('WO after: ', JSON.stringify(s.wo_after))
    console.log('INV before:', JSON.stringify(s.inv_before))
    console.log('INV after: ', JSON.stringify(s.inv_after))
  }

  console.log('\n=== DRY RUN COMPLETE ===')
  console.log('Finished:', new Date().toISOString())

  await pool.end()
}

main().catch(e => { console.error('FATAL:', e); pool.end().then(() => process.exit(1)) })
