#!/usr/bin/env node
/**
 * Per-page warm-mode audit.
 *
 * For every page.tsx and layout.tsx under src/app (excluding api/, auth,
 * pay/portal, error/not-found, offline — all intentionally-dark or public):
 *
 * Flag patterns that won't flip with theme:
 *   - THEME.dark / const _t = THEME.dark
 *   - '#060708' '#0d1520' '#0C0C12' (dark page bg)
 *   - '#0D0F12' '#131d2e' '#161B24' '#12121A' '#0B0D11' (dark card bg)
 *   - '#F0F4FF' '#DDE3EE' '#e2e6ed' '#EDEDF0' (near-white text)
 *   - '#7C8BA0' '#8494a7' '#9CA3AF' '#9D9DA1' '#A0AABF' '#8A8F9E' '#48536A'
 *     '#4a5568' '#6B7280' (grayscale text)
 *   - '#1A1D23' '#1A1A26' '#151520' (dark borders/cards)
 *   - rgba(255,255,255, <any alpha>)
 *   - rgba(0,0,0, <any alpha>) excluding modal scrim
 *   - '#fff' / '#ffffff' used outside semantic button text
 *
 * Also flag: pages with NO useTheme() call that aren't public/stub.
 *
 * Classify each file:
 *   CLEAN      — no offending pattern
 *   PARTIAL    — uses useTheme but has offending pattern
 *   BROKEN     — offending pattern with no useTheme
 *   UNTHEMED   — no useTheme at all (not necessarily broken)
 */
const fs = require('fs')
const path = require('path')

const DARK_HEX = [
  '#060708', '#0d1520', '#0C0C12', '#0c0c12',
  '#0D0F12', '#131d2e', '#161B24', '#12121A', '#0B0D11', '#080A0D',
  '#F0F4FF', '#DDE3EE', '#e2e6ed', '#E2E6ED', '#EDEDF0',
  '#7C8BA0', '#8494a7', '#9CA3AF', '#9D9DA1', '#A0AABF', '#8A8F9E',
  '#48536A', '#4a5568', '#6B7280',
  '#1A1D23', '#1a1d23', '#1A1A26', '#151520', '#1C2130',
]
const BLUE_HARDCODES = ['#1D6FE8', '#1B6EE6', '#1248B0', '#4D9EFF']

const EXCLUDE = [
  /^src\/app\/api\//,
  /^src\/app\/login\//,
  /^src\/app\/register\//,
  /^src\/app\/forgot-password\//,
  /^src\/app\/reset-password\//,
  /^src\/app\/pay\//,
  /^src\/app\/portal\//,
  /^src\/app\/403\//,
  /^src\/app\/offline\//,
  /error\.tsx$/,
  /not-found\.tsx$/,
  /^src\/app\/terms\//,
  /^src\/app\/privacy\//,
  /^src\/app\/api-docs\//,
  /^src\/app\/support\//,
]

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (['api', 'node_modules', '.next'].includes(e.name)) continue
      walk(p, out)
    } else if (/\.tsx$/.test(e.name) && /page\.tsx$|layout\.tsx$/.test(e.name)) {
      out.push(p)
    }
  }
  return out
}
function excluded(p) { return EXCLUDE.some(re => re.test(p)) }

const files = walk('src/app').filter(f => !excluded(f))

const report = { clean: [], partial: [], broken: [], unthemed: [] }

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  const useClient = /^'use client'|\n'use client'/.test(src)
  const hasUseTheme = /useTheme\s*\(\s*\)/.test(src)

  const findings = []
  // Only flag the FROZEN pattern (const _t = THEME.dark) — legitimate
  // property access like THEME.dark.bg is the correct way to source canonical
  // tokens in code that cannot call useTheme (e.g. the pre-hydration script).
  if (/const\s+_t\s*=\s*THEME\.dark\b/.test(src)) findings.push('frozen _t')

  const hexHits = DARK_HEX.filter(h => src.includes(h))
  if (hexHits.length) findings.push(`hex: ${hexHits.slice(0, 5).join(',')}${hexHits.length > 5 ? '…' : ''}`)

  const blueHits = BLUE_HARDCODES.filter(h => src.includes(`'${h}'`) || src.includes(`"${h}"`))
  if (blueHits.length) findings.push(`blue-hc: ${blueHits.join(',')}`)

  const rgbaWhite = (src.match(/rgba\(\s*255\s*,\s*255\s*,\s*255/g) || []).length
  if (rgbaWhite) findings.push(`rgba-white:${rgbaWhite}`)

  const fff = (src.match(/['"]#fff['"]|['"]#ffffff['"]/g) || []).length
  if (fff) findings.push(`#fff:${fff}`)

  // Classify
  if (!findings.length) { report.clean.push({ file: f }); continue }
  if (!useClient) { report.broken.push({ file: f, findings }); continue }
  if (!hasUseTheme) { report.unthemed.push({ file: f, findings }); continue }
  report.partial.push({ file: f, findings })
}

console.log(`Audited: ${files.length} page/layout files`)
console.log(`CLEAN    ${report.clean.length}`)
console.log(`PARTIAL  ${report.partial.length}  (useTheme + leftovers)`)
console.log(`UNTHEMED ${report.unthemed.length} (client comp, no useTheme, has hex)`)
console.log(`BROKEN   ${report.broken.length}  (not 'use client', has hex)`)

console.log('\n--- PARTIAL (top 40 by finding count) ---')
report.partial.sort((a, b) => b.findings.join('').length - a.findings.join('').length)
for (const x of report.partial.slice(0, 40)) {
  console.log(`  ${x.file}`)
  console.log(`    ${x.findings.join(' | ')}`)
}
if (report.partial.length > 40) console.log(`  ... +${report.partial.length - 40} more`)

console.log('\n--- UNTHEMED ---')
for (const x of report.unthemed) {
  console.log(`  ${x.file}`)
  console.log(`    ${x.findings.join(' | ')}`)
}

console.log('\n--- BROKEN ---')
for (const x of report.broken) {
  console.log(`  ${x.file}`)
  console.log(`    ${x.findings.join(' | ')}`)
}

fs.writeFileSync('reports/warm-mode-per-page-audit.json', JSON.stringify(report, null, 2))
console.log('\nFull JSON: reports/warm-mode-per-page-audit.json')
