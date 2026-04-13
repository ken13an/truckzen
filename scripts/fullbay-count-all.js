#!/usr/bin/env node
/**
 * Count ALL Fullbay service orders by scanning every week from 2018-01-01 to today.
 * Resumable: saves progress on timeout/error and can be restarted.
 */
require('dotenv').config({ path: '.env.local' })
const crypto = require('crypto')
const fs = require('fs')

const PROGRESS_FILE = 'backups/fullbay_count_progress.json'
const RESULTS_FILE = 'backups/fullbay_count_results.json'
const sleep = ms => new Promise(r => setTimeout(r, ms))

let cachedAuth = null

async function getAuth() {
  const key = process.env.FULLBAY_API_KEY
  const today = new Date().toISOString().split('T')[0]
  const ipRes = await fetch('https://api.ipify.org')
  const ip = (await ipRes.text()).trim()
  const token = crypto.createHash('sha1').update(key + today + ip).digest('hex')
  cachedAuth = { key, token }
  return cachedAuth
}

async function fetchWeek(startDate, endDate) {
  if (!cachedAuth) await getAuth()
  const { key, token } = cachedAuth
  const all = []
  let page = 1
  while (true) {
    const qs = new URLSearchParams({ key, token, startDate, endDate, page: String(page) }).toString()
    const res = await fetch('https://app.fullbay.com/services/getInvoices.php?' + qs, { signal: AbortSignal.timeout(90000) })
    const data = await res.json()
    if (data.status !== 'SUCCESS') throw new Error(data.status)
    const items = data.resultSet || []
    all.push(...items)
    if (page >= (data.totalPages || 1)) break
    page++
    await sleep(500)
  }
  return all
}

async function main() {
  // Wide range: 2018-01-01 to today
  const START = '2018-01-01'
  const END = new Date().toISOString().split('T')[0]

  // Load progress
  let allSOs = new Map() // primaryKey → {ro, invNum, total, date, customer, unit}
  let startChunk = 0
  if (fs.existsSync(PROGRESS_FILE)) {
    const prog = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'))
    startChunk = prog.lastChunk || 0
    console.log('Resuming from chunk', startChunk)
    if (fs.existsSync(RESULTS_FILE)) {
      const saved = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf-8'))
      for (const [k, v] of Object.entries(saved)) allSOs.set(k, v)
      console.log('Loaded', allSOs.size, 'existing records')
    }
  }

  const start = new Date(START)
  const end = new Date(END)
  const totalWeeks = Math.ceil((end - start) / (7 * 86400000))
  console.log('Range:', START, 'to', END, '(' + totalWeeks + ' weeks, starting at', startChunk + ')')

  let cur = new Date(start.getTime() + startChunk * 7 * 86400000)
  let weekNum = startChunk
  let errors = 0
  let consecutiveErrors = 0

  while (cur <= end) {
    weekNum++
    const rangeEnd = new Date(Math.min(cur.getTime() + 6 * 86400000, end.getTime()))
    const sD = cur.toISOString().split('T')[0]
    const eD = rangeEnd.toISOString().split('T')[0]

    if (weekNum % 10 === 0) {
      process.stdout.write('[' + weekNum + '/' + totalWeeks + '] ' + sD + '...' + allSOs.size + ' unique SOs\n')
    }

    try {
      const items = await fetchWeek(sD, eD)
      for (const inv of items) {
        const so = inv.ServiceOrder || {}
        const pk = String(so.primaryKey || '')
        if (pk && !allSOs.has(pk)) {
          allSOs.set(pk, {
            ro: so.repairOrderNumber,
            invNum: inv.invoiceNumber,
            total: inv.total,
            date: inv.invoiceDate,
            customer: inv.customerTitle,
            unit: so.Unit?.number || '',
          })
        }
      }
      consecutiveErrors = 0
    } catch (e) {
      errors++
      consecutiveErrors++
      if (weekNum % 1 === 0) process.stdout.write('  Error ' + sD + ': ' + e.message + '\n')
      if (consecutiveErrors >= 3) {
        // Save and pause
        const obj = Object.fromEntries(allSOs)
        fs.writeFileSync(RESULTS_FILE, JSON.stringify(obj))
        fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ lastChunk: weekNum, uniqueSOs: allSOs.size, ts: new Date().toISOString() }))
        console.log('Saved progress at chunk ' + weekNum + ': ' + allSOs.size + ' SOs. Pausing 60s...')
        await sleep(60000)
        cachedAuth = null
        consecutiveErrors = 0
      }
    }

    // Save every 20 chunks
    if (weekNum % 20 === 0) {
      const obj = Object.fromEntries(allSOs)
      fs.writeFileSync(RESULTS_FILE, JSON.stringify(obj))
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ lastChunk: weekNum, uniqueSOs: allSOs.size, ts: new Date().toISOString() }))
      await sleep(5000)
    }

    await sleep(2000)
    cur = new Date(cur.getTime() + 7 * 86400000)
  }

  // Final save
  const obj = Object.fromEntries(allSOs)
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(obj))
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ lastChunk: weekNum, uniqueSOs: allSOs.size, ts: new Date().toISOString(), complete: true }))

  console.log('\n=== COMPLETE ===')
  console.log('Total unique SOs:', allSOs.size)
  console.log('Errors:', errors)
  console.log('Date range scanned:', START, 'to', END)

  // Per-year breakdown
  const byYear = {}
  for (const [pk, rec] of allSOs) {
    const y = (rec.date || '').slice(0, 4)
    if (y) byYear[y] = (byYear[y] || 0) + 1
  }
  console.log('\nPer year:')
  for (const [y, c] of Object.entries(byYear).sort()) console.log('  ' + y + ': ' + c)
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
