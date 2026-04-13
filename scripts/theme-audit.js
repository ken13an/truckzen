#!/usr/bin/env node
/**
 * Full theme audit.
 *
 * For every client-component `.tsx` under src/app and src/components:
 *  - Is it themed (uses useTheme and tokens)?
 *  - Does it still have hardcoded dark hex (#060708, #0D0F12, #131d2e, etc)?
 *  - Does it still have frozen THEME.dark / _t = THEME.dark?
 *  - Does it use rgba(255,255,255,x) borders that look wrong in light mode?
 *
 * Classification:
 *   FULLY_THEMED   - uses useTheme, no hardcoded dark hex, no frozen THEME.dark
 *   PARTIAL        - uses useTheme but also has hardcoded dark hex / rgba borders
 *   FROZEN_DARK    - uses const _t = THEME.dark as module-level frozen
 *   HARDCODED_DARK - hardcoded dark hex, no useTheme
 *   NEUTRAL        - no theme tokens and no dark hex (pure markup, layout, or server)
 *   NON_CLIENT     - not 'use client' (server component or static)
 */
const fs = require('fs')
const path = require('path')

const DARK_HEX = ['#060708', '#0D0F12', '#0d1520', '#131d2e', '#0C0C12', '#0c0c12',
                  '#F0F4FF', '#DDE3EE', '#1A1D23', '#1a1d23',
                  '#7C8BA0', '#48536A', '#161B24']
const RGBA_LIGHT_ON_DARK = /rgba\(255\s*,\s*255\s*,\s*255/

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (['api', 'node_modules', '.next'].includes(e.name)) continue
      walk(p, out)
    } else if (/\.tsx$/.test(e.name) && !/\.test\./.test(e.name)) {
      out.push(p)
    }
  }
  return out
}

const files = [...walk('src/app'), ...walk('src/components')]

const categories = {
  FULLY_THEMED: [],
  PARTIAL: [],
  FROZEN_DARK: [],
  HARDCODED_DARK: [],
  NEUTRAL: [],
  NON_CLIENT: [],
}

const bySection = {}
function sectionOf(file) {
  const parts = file.split('/')
  if (parts[1] === 'app') {
    if (parts.length <= 3) return 'root'
    return parts[2]
  }
  return 'components'
}

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  const useClient = /^'use client'|\n'use client'/.test(src)
  const hasUseTheme = /useTheme\s*\(\s*\)/.test(src)
  const hasFrozenT = /const\s+_t\s*=\s*THEME\.(dark|light)/.test(src)
  const hasDirectTHEMEdark = /\bTHEME\.dark\b/.test(src) && !hasFrozenT
  const hexHits = DARK_HEX.filter(h => src.includes(h))
  const hasLightRgbaBorder = RGBA_LIGHT_ON_DARK.test(src)

  let cat
  if (!useClient) cat = 'NON_CLIENT'
  else if (hasFrozenT || hasDirectTHEMEdark) cat = 'FROZEN_DARK'
  else if (hasUseTheme && (hexHits.length > 0 || hasLightRgbaBorder)) cat = 'PARTIAL'
  else if (hasUseTheme) cat = 'FULLY_THEMED'
  else if (hexHits.length > 0 || hasLightRgbaBorder) cat = 'HARDCODED_DARK'
  else cat = 'NEUTRAL'

  categories[cat].push({ file: f, hex: hexHits, rgba: hasLightRgbaBorder })

  const sec = sectionOf(f)
  bySection[sec] = bySection[sec] || { FULLY_THEMED: 0, PARTIAL: 0, FROZEN_DARK: 0, HARDCODED_DARK: 0, NEUTRAL: 0, NON_CLIENT: 0, TOTAL: 0 }
  bySection[sec][cat]++
  bySection[sec].TOTAL++
}

// Separate pages from components
const pageFiles = files.filter(f => /\/page\.tsx$/.test(f))
const layoutFiles = files.filter(f => /\/layout\.tsx$/.test(f))
const componentFiles = files.filter(f => f.startsWith('src/components/'))

function classifyList(list) {
  const counts = { FULLY_THEMED: 0, PARTIAL: 0, FROZEN_DARK: 0, HARDCODED_DARK: 0, NEUTRAL: 0, NON_CLIENT: 0 }
  for (const f of list) {
    for (const cat of Object.keys(categories)) {
      if (categories[cat].find(x => x.file === f)) { counts[cat]++; break }
    }
  }
  return counts
}

const pageCounts = classifyList(pageFiles)
const layoutCounts = classifyList(layoutFiles)
const compCounts = classifyList(componentFiles)

console.log('========================================')
console.log('  TRUCKZEN THEME AUDIT')
console.log('========================================\n')

console.log(`PAGES (page.tsx)           total: ${pageFiles.length}`)
for (const [k, v] of Object.entries(pageCounts)) console.log(`  ${k.padEnd(18)} ${v}`)
console.log(`\nLAYOUTS (layout.tsx)       total: ${layoutFiles.length}`)
for (const [k, v] of Object.entries(layoutCounts)) console.log(`  ${k.padEnd(18)} ${v}`)
console.log(`\nCOMPONENTS                 total: ${componentFiles.length}`)
for (const [k, v] of Object.entries(compCounts)) console.log(`  ${k.padEnd(18)} ${v}`)

console.log('\n---- BY SECTION ----')
const secKeys = Object.keys(bySection).sort()
console.log('section'.padEnd(18), 'FULL', ' PART', ' FROZ', ' HARD', ' NEUT', ' NC', ' TOT')
for (const s of secKeys) {
  const c = bySection[s]
  console.log(s.padEnd(18),
    String(c.FULLY_THEMED).padStart(4),
    String(c.PARTIAL).padStart(5),
    String(c.FROZEN_DARK).padStart(5),
    String(c.HARDCODED_DARK).padStart(5),
    String(c.NEUTRAL).padStart(5),
    String(c.NON_CLIENT).padStart(3),
    String(c.TOTAL).padStart(4))
}

console.log('\n---- FROZEN_DARK files (still use THEME.dark) ----')
for (const { file } of categories.FROZEN_DARK) console.log('  ' + file)

console.log('\n---- HARDCODED_DARK files (no useTheme, hex/rgba) ----')
for (const { file, hex, rgba } of categories.HARDCODED_DARK) {
  console.log('  ' + file + (hex.length ? `  hex=[${hex.slice(0, 3).join(',')}]` : '') + (rgba ? ' rgba-border' : ''))
}

console.log('\n---- PARTIAL files (useTheme + leftover hex) ----')
for (const { file, hex, rgba } of categories.PARTIAL) {
  console.log('  ' + file + (hex.length ? `  hex=[${hex.slice(0, 3).join(',')}]` : '') + (rgba ? ' rgba' : ''))
}

const summary = {
  totals: { pages: pageFiles.length, layouts: layoutFiles.length, components: componentFiles.length, all: files.length },
  pages: pageCounts,
  layouts: layoutCounts,
  components: compCounts,
  bySection,
  categories: Object.fromEntries(Object.entries(categories).map(([k, v]) => [k, v.map(x => x.file)])),
}
fs.writeFileSync('reports/theme-audit.json', JSON.stringify(summary, null, 2))
console.log('\nFull JSON: reports/theme-audit.json')
