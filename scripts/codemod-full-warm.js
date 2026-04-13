#!/usr/bin/env node
/**
 * Full warm-mode cleanup codemod (partial-pattern pass).
 *
 * Target: pages/layouts/components that already use useTheme() but still have
 * hardcoded hex or rgba literals that don't flip with theme.
 *
 * Only replaces literals INSIDE the default-exported component's body
 * (tracked via export default function Name() { .. } and the first `^}$`
 * line after it). Module-level constants outside the body are left alone,
 * unless they are referenced by name and rewriting that is safe.
 *
 * Two replacement forms:
 *   - Object/property value: `: '#xxx'` | `: "rgba(...)"` -> `: alias.tok`
 *   - JSX attribute:          `attr="#xxx"` | `attr="rgba(...)"` -> `attr={alias.tok}`
 *
 * Template literals (`1px solid ${VAR}`) are not rewritten.
 *
 * Alias picker:
 *   - If the file already has `const { tokens: X } = useTheme()`, reuse X.
 *   - Otherwise prefer `t`, fall back to `th`, `tt`.
 *
 * Skips:
 *   - api routes
 *   - auth pages, pay, portal, error, offline
 *   - ServiceWorker.tsx
 *   - landing page src/app/page.tsx (branded)
 */
const fs = require('fs')
const path = require('path')

// Hex -> token (single, reliable mapping). Order matters for first-match.
const HEX = [
  // Dark page/surface
  ['#060708', 'bg'],
  ['#0C0C12', 'bg'], ['#0c0c12', 'bg'],
  ['#0d1520', 'bg'],
  ['#0D0F12', 'bgCard'],
  ['#131d2e', 'bgCard'],
  ['#161B24', 'bgCard'],
  ['#12121A', 'bgCard'],
  ['#151520', 'bgCard'],
  ['#0B0D11', 'bgInput'],
  ['#080A0D', 'bgInput'],
  ['#1C2130', 'bgInput'],
  ['#1A1A26', 'bgCard'],

  // Text (near-white)
  ['#F0F4FF', 'text'],
  ['#DDE3EE', 'text'],
  ['#e2e6ed', 'text'], ['#E2E6ED', 'text'],
  ['#EDEDF0', 'text'],

  // Text secondary (mid gray)
  ['#7C8BA0', 'textSecondary'],
  ['#8494a7', 'textSecondary'],
  ['#9CA3AF', 'textSecondary'],
  ['#9D9DA1', 'textSecondary'],
  ['#A0AABF', 'textSecondary'],
  ['#8A8F9E', 'textSecondary'],
  ['#6B7280', 'textSecondary'],
  ['#B8C4D6', 'textSecondary'],

  // Text tertiary (darker gray)
  ['#48536A', 'textTertiary'],
  ['#4a5568', 'textTertiary'],

  // Borders
  ['#1A1D23', 'border'],
  ['#1a1d23', 'border'],
]

// Blue hardcodes → accent tokens
const BLUE = [
  ['#1D6FE8', 'accent'],
  ['#1B6EE6', 'accent'],
  ['#1248B0', 'accentHover'],
  ['#4D9EFF', 'accentLight'],
]

// White tokens (invariant)
const WHITE_HEX = ['#fff', '#ffffff', '#FFFFFF']

// rgba white (neutral borders / hover surfaces)
const RGBA_WHITE_ALPHAS = new Set(['.01', '.02', '.025', '.03', '.04', '.05', '.055', '.06', '.08', '.1', '.12', '.15', '.2', '.3'])

const EXCLUDE_PATHS = [
  /^src\/app\/api\//,
  /^src\/app\/login\//, /^src\/app\/register\//,
  /^src\/app\/forgot-password\//, /^src\/app\/reset-password\//,
  /^src\/app\/pay\//, /^src\/app\/portal\//,
  /^src\/app\/403\//, /^src\/app\/offline\//,
  /error\.tsx$/, /not-found\.tsx$/,
  /^src\/app\/terms\//, /^src\/app\/privacy\//,
  /^src\/app\/api-docs\//, /^src\/app\/support\//,
  /^src\/app\/page\.tsx$/,            // branded landing
  /^src\/app\/layout\.tsx$/,          // intentional boot tokens
  /^src\/components\/ServiceWorker\.tsx$/,
]

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
function excluded(p) { return EXCLUDE_PATHS.some(re => re.test(p)) }

function pickAlias(src) {
  const m = src.match(/const\s*\{\s*tokens\s*:\s*(\w+)\s*\}\s*=\s*useTheme\(\s*\)/)
  if (m) return m[1]
  const tUsed = /\bconst\s+t\s*=|\blet\s+t\s*=|\(t\s*[,)]|\.map\(\s*\(?\s*t\b|\[t\s*,/.test(src)
  if (!tUsed) return 't'
  const thUsed = /\bconst\s+th\s*=|\(th\s*[,)]|\.map\(\s*\(?\s*th\b/.test(src)
  if (!thUsed) return 'th'
  return 'tt'
}
function hasImport(src) { return /from\s+['"]@\/hooks\/useTheme['"]/.test(src) }
function hasHookCall(src) { return /useTheme\s*\(\s*\)/.test(src) }
function addImport(src) {
  if (hasImport(src)) return src
  const m = src.match(/^(?:[ \t]*(?:'use client'|import[^\n]*)\n)+/m)
  if (!m) return `import { useTheme } from '@/hooks/useTheme'\n` + src
  const end = m.index + m[0].length
  return src.slice(0, end) + `import { useTheme } from '@/hooks/useTheme'\n` + src.slice(end)
}
function findStart(src) {
  let m = src.match(/export\s+default\s+function\s+\w+\s*\([^)]*\)\s*(?::\s*[^\{]+)?\s*\{/)
  if (m) return m.index + m[0].length
  const exp = src.match(/export\s+default\s+(\w+)\s*$/m)
  if (exp) {
    const re = new RegExp(`function\\s+${exp[1]}\\s*\\([^)]*\\)\\s*(?::\\s*[^\\{]+)?\\s*\\{`)
    const mm = src.match(re)
    if (mm) return mm.index + mm[0].length
  }
  return -1
}
function findEnd(src, start) {
  const rest = src.slice(start)
  const m = rest.match(/\n\}[ \t]*(?:\r?\n|$)/)
  return m ? start + m.index + 1 : src.length
}

function buildReplacers(alias) {
  const list = []
  function addHex(hex, tok) {
    const escHex = hex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    list.push({
      re: new RegExp(`(:\\s*)(['"])${escHex}\\2`, 'g'),
      to: (m, pre) => `${pre}${alias}.${tok}`,
    })
    list.push({
      re: new RegExp(`(\\s[a-zA-Z-]+=)(['"])${escHex}\\2`, 'g'),
      to: (m, pre) => `${pre}{${alias}.${tok}}`,
    })
  }
  for (const [h, t] of HEX) addHex(h, t)
  for (const [h, t] of BLUE) addHex(h, t)
  // white
  for (const h of WHITE_HEX) addHex(h, 'bgLight')
  // rgba white with neutral alphas -> border
  for (const a of RGBA_WHITE_ALPHAS) {
    const alpha = a.replace('.', '\\.')
    list.push({
      re: new RegExp(`(:\\s*)(['"])rgba\\(\\s*255\\s*,\\s*255\\s*,\\s*255\\s*,\\s*0?${alpha}\\s*\\)\\2`, 'g'),
      to: (m, pre) => `${pre}${alias}.border`,
    })
    list.push({
      re: new RegExp(`(\\s[a-zA-Z-]+=)(['"])rgba\\(\\s*255\\s*,\\s*255\\s*,\\s*255\\s*,\\s*0?${alpha}\\s*\\)\\2`, 'g'),
      to: (m, pre) => `${pre}{${alias}.border}`,
    })
  }
  return list
}

const files = [...walk('src/app'), ...walk('src/components')].filter(f => !excluded(f))

const report = { touched: [], skipped: [], totalReplacements: 0 }

for (const f of files) {
  const original = fs.readFileSync(f, 'utf8')
  if (!/^'use client'|\n'use client'/.test(original)) continue

  const alias = pickAlias(original)
  const start = findStart(original)
  if (start < 0) continue
  const end = findEnd(original, start)

  let body = original.slice(start, end)
  let changed = 0
  const replacers = buildReplacers(alias)
  for (const { re, to } of replacers) {
    body = body.replace(re, (...args) => { changed++; return to(...args) })
  }
  if (changed === 0) continue

  let src = original.slice(0, start) + body + original.slice(end)
  if (!hasImport(src)) src = addImport(src)
  if (!hasHookCall(src)) {
    const ns = findStart(src)
    src = src.slice(0, ns) + `\n  const { tokens: ${alias} } = useTheme()` + src.slice(ns)
  }
  fs.writeFileSync(f, src)
  report.touched.push({ file: f, replacements: changed, alias })
  report.totalReplacements += changed
}

console.log(`Touched: ${report.touched.length} files`)
console.log(`Total replacements: ${report.totalReplacements}`)
fs.writeFileSync('reports/codemod-full-warm-report.json', JSON.stringify(report, null, 2))
