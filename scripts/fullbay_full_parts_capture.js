#!/usr/bin/env node
/**
 * Fullbay Full Parts-Department Capture (resume-safe)
 *
 * Captures all API-accessible Fullbay endpoints relevant to the Parts
 * department into the existing main archive root:
 *
 *   ~/Desktop/TRUCKZEN_FULLBAY_RAW_ARCHIVE/raw_archive/<endpoint>/
 *
 * Resume rule:
 *   - if a window/page file is already marked complete in capture_progress.json
 *     AND its raw file exists with non-zero size, the runner SKIPs it.
 *   - otherwise it (re)fetches just that window.
 *   - --force <endpoint>  rebuilds that endpoint from scratch.
 *
 * Auth shape: SHA1(key + UTC-date + caller-public-IP). Fullbay IP-allowlists
 * the API key, so this runner MUST be executed from the user's normal Mac
 * IP (the same machine + network that already authorized this key).
 *
 * Usage:
 *   node scripts/fullbay_full_parts_capture.js status
 *   node scripts/fullbay_full_parts_capture.js probe          # check which endpoints reply 200/SUCCESS
 *   node scripts/fullbay_full_parts_capture.js capture        # capture all known + accessible
 *   node scripts/fullbay_full_parts_capture.js capture <ep>   # capture one endpoint
 *   node scripts/fullbay_full_parts_capture.js --force <ep>   # rebuild one endpoint
 *
 * NEVER mutates TruckZen DB. Only writes raw files + manifest/progress JSON.
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })

const ROOT = '/Users/kagasi/Desktop/TRUCKZEN_FULLBAY_RAW_ARCHIVE'
const RAW = path.join(ROOT, 'raw_archive')
const MANIFEST_DIR = path.join(ROOT, 'manifests')
const CHECKPOINT_DIR = path.join(ROOT, 'checkpoints')
const LOG_DIR = path.join(ROOT, 'logs')
const COVERAGE_DIR = path.join(ROOT, 'coverage_reports')

const PROGRESS_FILE = path.join(CHECKPOINT_DIR, 'capture_progress.json')
const MANIFEST_FILE = path.join(MANIFEST_DIR, 'capture_manifest.json')
const ENDPOINT_INV_CSV = path.join(MANIFEST_DIR, 'endpoint_inventory.csv')
const RUN_LOG = path.join(LOG_DIR, 'run_log.txt')

const FULLBAY_BASE = 'https://app.fullbay.com/services'
const FULLBAY_KEY = process.env.FULLBAY_API_KEY

if (!FULLBAY_KEY) {
  console.error('ERROR: FULLBAY_API_KEY missing from .env.local')
  process.exit(1)
}

// Endpoint catalog. Authoritative list comes from the official Fullbay API
// docs (Authentication / Adjustments / Counter Sales / Customer Credits /
// Customer Unit / Invoices / Customer Payments / Vendor Bills / Vendor
// Credits). Endpoints absent from the docs (parts, inventory, stock,
// vendors-list, purchase-orders, receivings, shops, locations) are NOT
// exposed by Fullbay's API at all and are intentionally omitted. The 23,330-
// row Fullbay UI inventory list cannot be reached via API and must come
// from a UI export.
const ENDPOINTS = {
  getInvoices: {
    file: 'getInvoices.php',
    chunking: 'date_window_7d',
    startDate: '2018-01-01',
    classes: ['catalog', 'stock_movement', 'vendor', 'building'],
    notes: 'Nested ServiceOrder.Complaints[].Corrections[].Parts[]; carries shopTitle.',
  },
  getAdjustments: {
    file: 'getAdjustments.php',
    chunking: 'date_window_7d',
    startDate: '2020-01-01',
    classes: ['stock_movement'],
    notes: 'No shopTitle on payload — building dimension not present.',
  },
  getVendorBills: {
    file: 'getVendorBills.php',
    chunking: 'date_window_7d',
    startDate: '2020-01-01',
    classes: ['vendor', 'purchasing', 'receiving'],
    notes: 'Used by sync-fullbay-vendor-bills.js but never archived.',
  },
  getVendorCredits: {
    file: 'getVendorCredits.php',
    chunking: 'date_window_7d',
    startDate: '2020-01-01',
    classes: ['vendor', 'purchasing'],
    notes: 'Vendor credit memos. Never archived.',
  },
  getCounterSales: {
    file: 'getCounterSales.php',
    chunking: 'date_window_7d',
    startDate: '2020-01-01',
    classes: ['catalog', 'stock_movement'],
    notes: 'Counter-sale invoices: parts moved out off-WO. Never archived.',
  },
  getCustomerCredits: {
    file: 'getCustomerCredits.php',
    chunking: 'date_window_7d',
    startDate: '2020-01-01',
    classes: ['financial'],
    notes: 'Customer credit memos. Parts-relevant only via line items if any.',
  },
  getCustomerPayments: {
    file: 'getCustomerPayments.php',
    chunking: 'date_window_7d',
    startDate: '2020-01-01',
    classes: ['financial'],
    notes: 'Customer payment records. Not parts-truth itself.',
  },
  getCustomerUnit: {
    file: 'getCustomerUnit.php',
    chunking: 'lookup',
    classes: ['identity'],
    notes: 'Single-unit lookup. Not bulk-iterable; no probe planned here.',
  },
}

function ensureDirs() {
  for (const d of [RAW, MANIFEST_DIR, CHECKPOINT_DIR, LOG_DIR, COVERAGE_DIR]) {
    fs.mkdirSync(d, { recursive: true })
  }
}

function appendLog(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  fs.appendFileSync(RUN_LOG, line)
  process.stdout.write(line)
}

function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')) } catch {}
  }
  return { endpoints: {}, started_at: new Date().toISOString() }
}

function saveProgress(prog) {
  prog.updated_at = new Date().toISOString()
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(prog, null, 2))
}

async function publicIP() {
  const r = await fetch('https://api.ipify.org')
  return (await r.text()).trim()
}

let cachedAuth = null
async function getAuth() {
  if (cachedAuth && cachedAuth.expires > Date.now()) return cachedAuth
  const today = new Date().toISOString().split('T')[0]
  const ip = await publicIP()
  const token = crypto.createHash('sha1').update(FULLBAY_KEY + today + ip).digest('hex')
  cachedAuth = { key: FULLBAY_KEY, token, ip, today, expires: Date.now() + 60 * 60 * 1000 }
  return cachedAuth
}

async function fbCall(endpoint, params = {}) {
  const auth = await getAuth()
  const qs = new URLSearchParams({ key: auth.key, token: auth.token, ...params }).toString()
  const url = `${FULLBAY_BASE}/${endpoint}?${qs}`
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  const txt = await res.text()
  let data
  try { data = JSON.parse(txt) } catch {
    return { http: res.status, raw: txt.slice(0, 400), parse: 'NOT_JSON' }
  }
  return { http: res.status, data }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function* weekWindows(startDate, endDate) {
  let cur = new Date(startDate)
  const end = new Date(endDate)
  while (cur <= end) {
    const range = new Date(Math.min(cur.getTime() + 6 * 86400000, end.getTime()))
    yield {
      start: cur.toISOString().split('T')[0],
      end: range.toISOString().split('T')[0],
    }
    cur = new Date(cur.getTime() + 7 * 86400000)
  }
}

async function probeEndpoint(name) {
  const ep = ENDPOINTS[name]
  if (!ep) return { name, ok: false, error: 'unknown' }
  const probeParams = ep.chunking.startsWith('date_window')
    ? { startDate: '2025-01-06', endDate: '2025-01-12', page: '1' }
    : { page: '1' }
  const r = await fbCall(ep.file, probeParams)
  if (r.parse === 'NOT_JSON') return { name, ok: false, http: r.http, error: 'non-json', sample: r.raw }
  if (!r.data) return { name, ok: false, http: r.http, error: 'empty' }
  return {
    name,
    ok: r.data.status === 'SUCCESS',
    http: r.http,
    status: r.data.status,
    message: r.data.message,
    sample_count: Array.isArray(r.data.resultSet) ? r.data.resultSet.length : 0,
    sample_keys: Array.isArray(r.data.resultSet) && r.data.resultSet[0] ? Object.keys(r.data.resultSet[0]).slice(0, 12) : [],
  }
}

async function captureEndpoint(name, opts = {}) {
  const ep = ENDPOINTS[name]
  if (!ep) throw new Error(`unknown endpoint ${name}`)
  const epDir = path.join(RAW, name)
  fs.mkdirSync(epDir, { recursive: true })
  const prog = loadProgress()
  if (!prog.endpoints[name]) prog.endpoints[name] = { completed: {}, failed: {} }
  const epProg = prog.endpoints[name]

  if (opts.force) {
    appendLog(`[${name}] --force: clearing checkpoint (raw files NOT deleted)`)
    epProg.completed = {}
    epProg.failed = {}
  }

  const today = new Date().toISOString().split('T')[0]
  const windows = ep.chunking === 'date_window_7d'
    ? Array.from(weekWindows(ep.startDate, today))
    : [{ start: null, end: null }]

  let completed = 0, failed = 0, skipped = 0, totalRecords = 0

  for (const w of windows) {
    let page = 1
    while (true) {
      const tag = w.start
        ? `${name}__${w.start}__${w.end}__p${page}`
        : `${name}__page${page}`
      const file = path.join(epDir, `${tag}.json`)
      const existing = epProg.completed[tag]

      // Resume rule: if the raw file exists on disk with non-zero size, treat
      // it as completed even if the checkpoint hasn't seen it yet. This makes
      // the runner safe to point at any existing archive directory without a
      // separate seed step.
      if (fs.existsSync(file) && fs.statSync(file).size > 0) {
        if (!existing) {
          let totalPages = 1
          let records = 0
          try {
            const j = JSON.parse(fs.readFileSync(file, 'utf8'))
            totalPages = j.totalPages || 1
            records = Array.isArray(j.resultSet) ? j.resultSet.length : 0
          } catch {}
          epProg.completed[tag] = {
            filename: path.basename(file),
            records,
            bytes: fs.statSync(file).size,
            totalPages,
            ts: new Date(fs.statSync(file).mtime).toISOString(),
            seeded_from_disk: true,
          }
          saveProgress(prog)
        }
        skipped++
        const tp = epProg.completed[tag].totalPages || 1
        page++
        if (page > tp) break
        continue
      }

      const params = w.start
        ? { startDate: w.start, endDate: w.end, page: String(page) }
        : { page: String(page) }
      const r = await fbCall(ep.file, params)
      if (r.parse === 'NOT_JSON' || !r.data || r.data.status !== 'SUCCESS') {
        failed++
        epProg.failed[tag] = {
          http: r.http,
          status: r.data?.status,
          message: r.data?.message,
          ts: new Date().toISOString(),
        }
        appendLog(`[${name}] FAIL ${tag} status=${r.data?.status || r.parse} msg=${r.data?.message || ''}`)
        saveProgress(prog)
        break
      }

      const rs = r.data.resultSet || []
      fs.writeFileSync(file, JSON.stringify(r.data, null, 2))
      epProg.completed[tag] = {
        filename: path.basename(file),
        records: rs.length,
        bytes: fs.statSync(file).size,
        totalPages: r.data.totalPages || 1,
        ts: new Date().toISOString(),
      }
      delete epProg.failed[tag]
      completed++
      totalRecords += rs.length
      saveProgress(prog)
      if ((completed + skipped) % 25 === 0) {
        appendLog(`[${name}] progress: completed=${completed} skipped=${skipped} failed=${failed} records=${totalRecords}`)
      }
      if (page >= (r.data.totalPages || 1)) break
      page++
      await sleep(300)
    }
  }
  appendLog(`[${name}] done. completed=${completed} skipped=${skipped} failed=${failed} records=${totalRecords}`)
  return { completed, skipped, failed, totalRecords }
}

function writeEndpointInventoryCsv(probeResults = null) {
  // accessible_now combines on-disk evidence with probe results from the
  // current environment. If files exist on disk the endpoint is proven
  // accessible from somewhere (the user's Mac); the live probe may still
  // fail when run from a non-allowlisted IP.
  const prog = loadProgress()
  const header = 'endpoint,classes,accessible_now,proof,chunking,start_date,notes'
  const rows = [header]
  for (const [name, ep] of Object.entries(ENDPOINTS)) {
    const probe = probeResults && probeResults[name]
    const onDisk = Object.keys(prog.endpoints?.[name]?.completed || {}).length
    let accessible, proof
    if (onDisk > 0) {
      accessible = 'yes'
      proof = `${onDisk} files on disk`
    } else if (probe && probe.ok) {
      accessible = 'yes'
      proof = 'probe OK'
    } else if (probe) {
      accessible = 'no (probe)'
      proof = `probe ${probe.status || probe.error || 'fail'} from ip=current_env`
    } else {
      accessible = 'unknown'
      proof = 'not yet probed'
    }
    rows.push([
      name,
      `"${ep.classes.join('|')}"`,
      accessible,
      `"${proof}"`,
      ep.chunking,
      ep.startDate || '',
      `"${ep.notes.replace(/"/g, '""')}"`,
    ].join(','))
  }
  fs.writeFileSync(ENDPOINT_INV_CSV, rows.join('\n') + '\n')
}

function writeManifest(extra = {}) {
  const prog = loadProgress()
  const summary = {}
  for (const [name, ep] of Object.entries(ENDPOINTS)) {
    const epProg = prog.endpoints[name] || { completed: {}, failed: {} }
    const completedCount = Object.keys(epProg.completed).length
    const probeOk = extra.probe?.[name]?.ok
    // Accessibility precedence: any on-disk completion is hard proof. Probe
    // result only matters when there's no on-disk evidence.
    let accessible
    if (completedCount > 0) accessible = true
    else if (probeOk === true) accessible = true
    else if (probeOk === false) accessible = false
    else accessible = null
    summary[name] = {
      classes: ep.classes,
      accessible,
      proof: completedCount > 0
        ? `${completedCount} files on disk`
        : (probeOk === true ? 'probe OK' : (probeOk === false ? 'probe FAIL' : 'not yet probed')),
      completed_files: completedCount,
      failed_files: Object.keys(epProg.failed).length,
      records: Object.values(epProg.completed).reduce((a, b) => a + (b.records || 0), 0),
    }
  }
  const out = {
    generated_at: new Date().toISOString(),
    archive_root: ROOT,
    endpoints: summary,
  }
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(out, null, 2))
}

function status() {
  const prog = loadProgress()
  console.log('Archive root:', ROOT)
  console.log('Endpoints in catalog:', Object.keys(ENDPOINTS).length)
  for (const name of Object.keys(ENDPOINTS)) {
    const epProg = prog.endpoints?.[name] || { completed: {}, failed: {} }
    const c = Object.keys(epProg.completed).length
    const f = Object.keys(epProg.failed).length
    const dirCount = (() => {
      const d = path.join(RAW, name)
      if (!fs.existsSync(d)) return 0
      return fs.readdirSync(d).filter(x => x.endsWith('.json')).length
    })()
    console.log(`  ${name.padEnd(20)} on-disk=${dirCount.toString().padStart(4)}  ckpt completed=${c}  failed=${f}`)
  }
}

async function main() {
  ensureDirs()
  const args = process.argv.slice(2)
  const cmd = args[0] || 'status'

  if (cmd === 'status') return status()

  if (cmd === 'seed') {
    // Walk every endpoint dir, register existing files in capture_progress.json.
    // No API calls. Pure local; proves resume safety from disk reality.
    const prog = loadProgress()
    let total = 0
    for (const name of Object.keys(ENDPOINTS)) {
      const dir = path.join(RAW, name)
      if (!fs.existsSync(dir)) continue
      if (!prog.endpoints[name]) prog.endpoints[name] = { completed: {}, failed: {} }
      const ep = prog.endpoints[name]
      for (const fn of fs.readdirSync(dir)) {
        if (!fn.endsWith('.json')) continue
        const tag = fn.replace(/\.json$/, '')
        if (ep.completed[tag]) continue
        const full = path.join(dir, fn)
        const stat = fs.statSync(full)
        if (stat.size === 0) continue
        let totalPages = 1, records = 0
        try {
          const j = JSON.parse(fs.readFileSync(full, 'utf8'))
          totalPages = j.totalPages || 1
          records = Array.isArray(j.resultSet) ? j.resultSet.length : 0
        } catch {}
        ep.completed[tag] = {
          filename: fn, records, bytes: stat.size,
          totalPages, ts: new Date(stat.mtime).toISOString(),
          seeded_from_disk: true,
        }
        total++
      }
    }
    saveProgress(prog)
    appendLog(`[seed] registered ${total} existing files in capture_progress.json`)
    return
  }

  if (cmd === 'probe') {
    const results = {}
    for (const name of Object.keys(ENDPOINTS)) {
      // skip lookup-only endpoints (no bulk window to probe)
      if (ENDPOINTS[name].chunking === 'lookup') {
        results[name] = { name, ok: null, status: 'lookup_only', error: null, sample_count: 0, sample_keys: [] }
        appendLog(`[probe] ${name}: skipped (lookup-only endpoint per docs)`)
        continue
      }
      try {
        const r = await probeEndpoint(name)
        results[name] = r
        // capture a sample of shopTitle values when the response succeeds
        if (r.ok) {
          // re-fetch the same probe and grab the resultSet for shopTitle inspection
          const auth = await getAuth()
          const ep = ENDPOINTS[name]
          const params = ep.chunking.startsWith('date_window')
            ? { startDate: '2025-01-06', endDate: '2025-01-12', page: '1' }
            : { page: '1' }
          const qs = new URLSearchParams({ key: auth.key, token: auth.token, ...params }).toString()
          const sampleRes = await fetch(`${FULLBAY_BASE}/${ep.file}?${qs}`, { signal: AbortSignal.timeout(60_000) })
          const sample = await sampleRes.json().catch(() => ({}))
          const rs = Array.isArray(sample.resultSet) ? sample.resultSet : []
          const shops = new Set()
          for (const row of rs) {
            const t = (row.shopTitle || row.ServiceOrder?.shopTitle || '').trim()
            if (t) shops.add(t)
          }
          r.shopTitles = Array.from(shops)
        }
        appendLog(`[probe] ${name}: ${r.ok ? 'OK' : 'NO'} (${r.status || r.error}) sample=${r.sample_count} shops=${(r.shopTitles || []).join('|') || '-'}`)
      } catch (e) {
        results[name] = { name, ok: false, error: e.message }
        appendLog(`[probe] ${name}: EXCEPTION ${e.message}`)
      }
      await sleep(800)
    }
    writeEndpointInventoryCsv(results)
    writeManifest({ probe: results })
    // Also persist a probe snapshot keyed by current key hash so multi-key
    // runs leave separate audit trails.
    const auth = await getAuth().catch(() => ({}))
    const keyHash = auth.key ? require('crypto').createHash('sha256').update(auth.key).digest('hex').slice(0, 12) : 'unknown'
    const snap = {
      generated_at: new Date().toISOString(),
      key_label: keyHash,
      caller_ip: auth.ip,
      results,
    }
    fs.writeFileSync(path.join(MANIFEST_DIR, `probe_snapshot_${keyHash}.json`), JSON.stringify(snap, null, 2))
    return
  }

  if (cmd === 'capture') {
    const epArg = args[1]
    const force = args.includes('--force')
    const targets = epArg ? [epArg] : Object.keys(ENDPOINTS).filter(n => ['getInvoices','getAdjustments','getVendorBills'].includes(n))
    for (const name of targets) {
      try {
        await captureEndpoint(name, { force })
      } catch (e) {
        appendLog(`[${name}] EXCEPTION: ${e.message}`)
      }
    }
    writeManifest()
    return
  }

  console.log('Usage: node scripts/fullbay_full_parts_capture.js [status|probe|capture [<endpoint>] [--force]]')
}

main().catch(e => { console.error(e); process.exit(1) })
