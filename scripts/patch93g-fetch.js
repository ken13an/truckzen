#!/usr/bin/env node
/**
 * Patch 93G — Phase 1: FETCH all Fullbay invoices and save to disk.
 * Resumable: reads progress file and continues from last completed chunk.
 * Output: backups/patch93g_fullbay_data.json
 */
require('dotenv').config({ path: '.env.local' })
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const DATA_FILE = path.join(__dirname, '..', 'backups', 'patch93g_fullbay_data.json')
const PROGRESS_FILE = path.join(__dirname, '..', 'backups', 'patch93g_fetch_progress.json')

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

async function fbFetch(endpoint, params = {}, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (!cachedAuth) await getAuth()
      const { key, token } = cachedAuth
      const qs = new URLSearchParams({ key, token, ...params }).toString()
      const res = await fetch(`https://app.fullbay.com/services/${endpoint}?${qs}`, { signal: AbortSignal.timeout(60000) })
      const data = await res.json()
      if (data.status === 'SUCCESS') return data
      if (attempt < retries) { await sleep(3000 * attempt); cachedAuth = null; continue }
      throw new Error(`${data.status}: ${data.message || ''}`)
    } catch (e) {
      if (attempt >= retries) throw e
      console.log(`    Retry ${attempt}: ${e.message}`)
      await sleep(3000 * attempt)
      cachedAuth = null // force re-auth
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  console.log('=== Patch 93G FETCH ===')

  // Load existing progress
  let fbBySO = new Map()
  let startChunk = 0
  if (fs.existsSync(PROGRESS_FILE)) {
    const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'))
    startChunk = progress.lastChunk || 0
    console.log('Resuming from chunk', startChunk)
    if (fs.existsSync(DATA_FILE)) {
      const existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
      for (const [pk, inv] of Object.entries(existing)) fbBySO.set(pk, inv)
      console.log('Loaded', fbBySO.size, 'existing records')
    }
  }

  const startDate = '2021-02-01'
  const endDate = '2026-03-28'
  const start = new Date(startDate)
  const end = new Date(endDate)
  const totalWeeks = Math.ceil((end - start) / (7 * 86400000))

  console.log(`Fetching: ${startDate} to ${endDate} (${totalWeeks} chunks, starting at ${startChunk})`)

  let cur = new Date(start.getTime() + startChunk * 7 * 86400000)
  let weekNum = startChunk
  let totalFetched = 0
  let fetchErrors = 0
  let consecutiveErrors = 0

  while (cur <= end) {
    weekNum++
    const rangeEnd = new Date(Math.min(cur.getTime() + 6 * 86400000, end.getTime()))
    const sD = cur.toISOString().split('T')[0]
    const eD = rangeEnd.toISOString().split('T')[0]

    if (weekNum % 10 === 0) {
      console.log(`  [${weekNum}/${totalWeeks}] ${sD}...${fbBySO.size} unique SOs`)
    }

    try {
      let page = 1
      while (true) {
        const data = await fbFetch('getInvoices.php', { startDate: sD, endDate: eD, page: String(page) })
        const items = data.resultSet || []
        totalFetched += items.length

        for (const inv of items) {
          const pk = String(inv.ServiceOrder?.primaryKey || '')
          if (pk && !fbBySO.has(pk)) fbBySO.set(pk, inv)
        }

        if (page >= (data.totalPages || 1)) break
        page++
        await sleep(500)
      }
      consecutiveErrors = 0
    } catch (e) {
      fetchErrors++
      consecutiveErrors++
      console.log(`  Error chunk ${weekNum} (${sD}): ${e.message}`)
      if (consecutiveErrors >= 3) {
        console.log(`  3 consecutive errors. Saving progress and pausing 60s...`)
        // Save progress
        const obj = Object.fromEntries(fbBySO)
        fs.writeFileSync(DATA_FILE, JSON.stringify(obj))
        fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ lastChunk: weekNum, uniqueSOs: fbBySO.size, timestamp: new Date().toISOString() }))
        await sleep(60000)
        cachedAuth = null
        consecutiveErrors = 0
      }
    }

    // Save progress every 20 chunks
    if (weekNum % 20 === 0) {
      const obj = Object.fromEntries(fbBySO)
      fs.writeFileSync(DATA_FILE, JSON.stringify(obj))
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ lastChunk: weekNum, uniqueSOs: fbBySO.size, timestamp: new Date().toISOString() }))
      console.log(`  [Saved progress at chunk ${weekNum}: ${fbBySO.size} SOs]`)
      await sleep(10000)
    }

    await sleep(2000)
    cur = new Date(cur.getTime() + 7 * 86400000)
  }

  // Final save
  const obj = Object.fromEntries(fbBySO)
  fs.writeFileSync(DATA_FILE, JSON.stringify(obj))
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ lastChunk: weekNum, uniqueSOs: fbBySO.size, timestamp: new Date().toISOString(), complete: true }))

  console.log('\n=== FETCH COMPLETE ===')
  console.log('Total invoice records fetched:', totalFetched)
  console.log('Unique SOs:', fbBySO.size)
  console.log('Fetch errors:', fetchErrors)
  console.log('Data saved to:', DATA_FILE)
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
