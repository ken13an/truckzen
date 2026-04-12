#!/usr/bin/env node
/**
 * Warm-mode page codemod v2.
 *
 * Safer rules:
 *  - Only replaces hex INSIDE the default-exported component function body
 *    (i.e. after the opening `{` following `export default function Name(...)` or
 *    a React arrow-function default export). Hex inside module-level `const FOO =`
 *    maps are LEFT UNCHANGED — those need to stay static because `t` is not in
 *    scope there.
 *  - Replaces two forms:
 *      * Object/property value form:   `: '#xxx'`  -> `: T.tok`
 *        (works inside `style={{ color: '#...' }}` and similar)
 *      * JSX attribute form:           `attr="#xxx"` -> `attr={T.tok}`
 *        (adds curly braces)
 *  - Plain string hex not matching either form (template literals, comparisons,
 *    unquoted contexts) is left alone.
 *  - Adds `import { useTheme } from '@/hooks/useTheme'` if missing.
 *  - Adds `const { tokens: T } = useTheme()` inside the component body (where
 *    T is a collision-free alias, default `t`, else `th`, else `tt`).
 */
const fs = require('fs')
const path = require('path')

const HEX_TO_TOKEN = {
  '#060708': 'bg',
  '#0C0C12': 'bg',
  '#0c0c12': 'bg',
  '#0d1520': 'bg',
  '#0D0F12': 'bgCard',
  '#131d2e': 'bgCard',
  '#F0F4FF': 'text',
  '#DDE3EE': 'text',
  '#e2e6ed': 'text',
  '#E2E6ED': 'text',
  '#7C8BA0': 'textSecondary',
  '#8494a7': 'textSecondary',
  '#48536A': 'textTertiary',
  '#4a5568': 'textTertiary',
  '#1A1D23': 'border',
  '#1a1d23': 'border',
}
const HEX_KEYS = Object.keys(HEX_TO_TOKEN)
const hexPattern = HEX_KEYS.map(h => h.replace('#', '#')).join('|')

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'api' || e.name === 'node_modules' || e.name === '.next') continue
      walk(p, out)
    } else if (e.isFile() && /\.(tsx|ts)$/.test(e.name) && !/\.test\./.test(e.name)) {
      out.push(p)
    }
  }
  return out
}

function pickAlias(src) {
  // If the file already destructures tokens from useTheme, reuse that alias.
  const m = src.match(/const\s*\{\s*tokens\s*:\s*(\w+)\s*\}\s*=\s*useTheme\(\s*\)/)
  if (m) return m[1]
  // Otherwise detect likely collisions.
  const tUsed = /\bconst\s+t\s*=|\blet\s+t\s*=|\(t\s*[,)]|\.map\(\s*\(?\s*t\b|\[t\s*,/.test(src)
  if (!tUsed) return 't'
  const thUsed = /\bconst\s+th\s*=|\blet\s+th\s*=|\(th\s*[,)]|\.map\(\s*\(?\s*th\b/.test(src)
  if (!thUsed) return 'th'
  return 'tt'
}

function hasUseThemeImport(src) {
  return /from\s+['"]@\/hooks\/useTheme['"]/.test(src)
}

function alreadyCallsUseTheme(src) {
  return /useTheme\s*\(\s*\)/.test(src)
}

function addImport(src) {
  if (hasUseThemeImport(src)) return src
  const m = src.match(/^(?:[ \t]*(?:'use client'|import[^\n]*)\n)+/m)
  if (!m) return `import { useTheme } from '@/hooks/useTheme'\n` + src
  const end = m.index + m[0].length
  return src.slice(0, end) + `import { useTheme } from '@/hooks/useTheme'\n` + src.slice(end)
}

/**
 * Find the opening `{` index of the default-exported component function body.
 * Returns -1 if not found.
 */
function findComponentBodyStart(src) {
  // Try: export default function Name(args) {
  let m = src.match(/export\s+default\s+function\s+\w+\s*\([^)]*\)\s*(?::\s*[^\{]+)?\s*\{/)
  if (m) return m.index + m[0].length
  // Try: const Name = (args) => { ... } then export default Name
  const name = (src.match(/export\s+default\s+(\w+)\s*$/m) || [])[1]
  if (name) {
    const re = new RegExp(`(?:const|let|var)\\s+${name}\\s*[:=][^\\{]*?\\([^)]*\\)\\s*(?::\\s*[^\\{]+)?\\s*=>\\s*\\{`)
    const mm = src.match(re)
    if (mm) return mm.index + mm[0].length
  }
  // Try: export default (args) => { }
  m = src.match(/export\s+default\s*\([^)]*\)\s*=>\s*\{/)
  if (m) return m.index + m[0].length
  return -1
}

function insertHookCall(src, alias, bodyStart) {
  // Insert just after the opening brace of the component body with indent 2.
  const indent = '  '
  return src.slice(0, bodyStart) + `\n${indent}const { tokens: ${alias} } = useTheme()` + src.slice(bodyStart)
}

// Heuristic: find the first line starting with `}` (at column 0) after `start`.
// Works for top-level React function components which conventionally close at
// column 0. Much more robust than brace-counting with regex literals in the mix.
function findComponentBodyEnd(src, start) {
  const re = /^\}\s*$/m
  re.lastIndex = start
  const rest = src.slice(start)
  const m = rest.match(/\n\}[ \t]*(?:\r?\n|$)/)
  if (!m) return src.length
  return start + m.index + 1 + 1 // index of the `}` itself
}
function matchBraceEnd(src, start) {
  let depth = 1
  let i = start
  function skipTemplate() {
    while (i < src.length) {
      if (src[i] === '\\') { i += 2; continue }
      if (src[i] === '`') { i++; return }
      if (src[i] === '$' && src[i + 1] === '{') {
        let dd = 1; i += 2
        while (i < src.length && dd > 0) {
          const c = src[i]
          if (c === '/' && src[i + 1] === '/') { const nl = src.indexOf('\n', i); i = nl === -1 ? src.length : nl + 1; continue }
          if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e === -1 ? src.length : e + 2; continue }
          if (c === '\'' || c === '"') { const q = c; i++; while (i < src.length && src[i] !== q) { if (src[i] === '\\') i += 2; else i++ } i++; continue }
          if (c === '`') { i++; skipTemplate(); continue }
          if (c === '{') dd++
          else if (c === '}') dd--
          i++
        }
        continue
      }
      i++
    }
  }
  while (i < src.length && depth > 0) {
    const c = src[i]
    if (c === '/' && src[i + 1] === '/') { const nl = src.indexOf('\n', i); i = nl === -1 ? src.length : nl + 1; continue }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e === -1 ? src.length : e + 2; continue }
    if (c === '\'' || c === '"') { const q = c; i++; while (i < src.length && src[i] !== q) { if (src[i] === '\\') i += 2; else i++ } i++; continue }
    if (c === '`') { i++; skipTemplate(); continue }
    if (c === '{') depth++
    else if (c === '}') { depth--; if (depth === 0) return i }
    i++
  }
  return src.length
}

function rewriteInRange(src, alias, startIdx, endIdx) {
  const before = src.slice(0, startIdx)
  const after = src.slice(endIdx)
  let body = src.slice(startIdx, endIdx)
  let changed = 0

  for (const hex of HEX_KEYS) {
    const escHex = hex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const token = HEX_TO_TOKEN[hex]

    // Form 1: object/property value  `: '#xxx'` or `: "#xxx"`
    const reObj = new RegExp(`(:\\s*)(['"])${escHex}\\2`, 'g')
    body = body.replace(reObj, (m, pre, q, offset) => {
      // Skip codemod-skip lines
      const ls = body.lastIndexOf('\n', offset) + 1
      const le = body.indexOf('\n', offset)
      const line = body.slice(ls, le === -1 ? body.length : le)
      if (line.includes('codemod-skip')) return m
      changed++
      return `${pre}${alias}.${token}`
    })

    // Form 2: JSX attribute  ` attr="#xxx"`  -> ` attr={T.tok}`
    const reJsx = new RegExp(`(\\s[a-zA-Z-]+=)(['"])${escHex}\\2`, 'g')
    body = body.replace(reJsx, (m, pre, q, offset) => {
      const ls = body.lastIndexOf('\n', offset) + 1
      const le = body.indexOf('\n', offset)
      const line = body.slice(ls, le === -1 ? body.length : le)
      if (line.includes('codemod-skip')) return m
      changed++
      return `${pre}{${alias}.${token}}`
    })
  }
  return { out: before + body + after, changed }
}

const TARGET_DIRS = ['src/app', 'src/components']
const files = TARGET_DIRS.flatMap(d => walk(d))

const report = { touched: [], skipped: [], totalReplacements: 0 }

for (const f of files) {
  const original = fs.readFileSync(f, 'utf8')
  if (!/^'use client'|\n'use client'/.test(original)) continue
  if (!HEX_KEYS.some(h => original.includes(h))) continue

  const alias = pickAlias(original)
  const bodyStart = findComponentBodyStart(original)
  if (bodyStart < 0) { report.skipped.push({ file: f, reason: 'no component body' }); continue }

  const bodyEnd = findComponentBodyEnd(original, bodyStart)
  const { out, changed } = rewriteInRange(original, alias, bodyStart, bodyEnd)
  if (changed === 0) continue

  let src = out
  if (!hasUseThemeImport(src)) src = addImport(src)
  if (!alreadyCallsUseTheme(src)) {
    const newBodyStart = findComponentBodyStart(src)
    src = insertHookCall(src, alias, newBodyStart)
  }

  fs.writeFileSync(f, src)
  report.touched.push({ file: f, replacements: changed, alias })
  report.totalReplacements += changed
}

console.log(`Touched: ${report.touched.length} files`)
console.log(`Total replacements: ${report.totalReplacements}`)
console.log(`Skipped: ${report.skipped.length}`)
for (const s of report.skipped.slice(0, 30)) console.log(`  SKIP ${s.file} - ${s.reason}`)
fs.writeFileSync('reports/codemod-warmmode-report.json', JSON.stringify(report, null, 2))
