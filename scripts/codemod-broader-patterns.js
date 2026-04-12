#!/usr/bin/env node
/**
 * Broader warm-mode codemod.
 * Handles patterns the earlier passes missed:
 *   #EDEDF0 -> text (near-white)
 *   #9D9DA1 -> textSecondary (muted gray)
 *   #1C2130 -> inputBg (dark input bg)
 *   #A0AABF -> textSecondary (older secondary)
 *   rgba(255,255,255,0.0X) -> border (any alpha <= 0.1)
 *   'linear-gradient(...#1D6FE8...#1248B0...)' -> t.accent
 *
 * Only replaces inside component function bodies (same scoping as previous codemod).
 */
const fs = require('fs')
const path = require('path')

const MAP = [
  { re: /'#EDEDF0'|"#EDEDF0"/g, tok: 'text' },
  { re: /'#ededf0'|"#ededf0"/g, tok: 'text' },
  { re: /'#9D9DA1'|"#9D9DA1"/g, tok: 'textSecondary' },
  { re: /'#9d9da1'|"#9d9da1"/g, tok: 'textSecondary' },
  { re: /'#A0AABF'|"#A0AABF"/g, tok: 'textSecondary' },
  { re: /'#1C2130'|"#1C2130"/g, tok: 'inputBg' },
  { re: /'#1c2130'|"#1c2130"/g, tok: 'inputBg' },
  { re: /'#B8C4D6'|"#B8C4D6"/g, tok: 'textSecondary' },
]
const RGBA_BORDER = /'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0?\.0\d+\s*\)'|"rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0?\.0\d+\s*\)"/g
const GRADIENT_BLUE = /'linear-gradient\([^']*#1D6FE8[^']*#1248B0[^']*\)'|"linear-gradient\([^"]*#1D6FE8[^"]*#1248B0[^"]*\)"/g

const EXCLUDE_PATHS = [
  /^src\/app\/api\//,
  /^src\/app\/login\//,
  /^src\/app\/register\//,
  /^src\/app\/forgot-password\//,
  /^src\/app\/reset-password\//,
  /^src\/app\/pay\//,
  /^src\/app\/portal\//,
  /^src\/app\/403\//,
  /error\.tsx$/,
  /not-found\.tsx$/,
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
  return 'th'
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
  if (!m) return src.length
  return start + m.index + 1
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

const files = [...walk('src/app'), ...walk('src/components')].filter(f => !excluded(f))
const report = { touched: [], total: 0 }

for (const f of files) {
  const original = fs.readFileSync(f, 'utf8')
  if (!/^'use client'|\n'use client'/.test(original)) continue

  const alias = pickAlias(original)
  const start = findStart(original)
  if (start < 0) continue
  const end = findEnd(original, start)
  let body = original.slice(start, end)
  let changed = 0

  // Object-value form and JSX attr form for each hex
  for (const { re, tok } of MAP) {
    // Object value form
    const objRe = new RegExp(`(:\\s*)(?:${re.source})`, 'g')
    body = body.replace(objRe, (m, pre) => { changed++; return `${pre}${alias}.${tok}` })
    // JSX attr form
    const attrRe = new RegExp(`(\\s[a-zA-Z-]+=)(?:${re.source})`, 'g')
    body = body.replace(attrRe, (m, pre) => { changed++; return `${pre}{${alias}.${tok}}` })
  }

  // rgba white borders (alpha < 0.1 → t.border)
  body = body.replace(/(:\s*)(?:'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0?\.0\d+\s*\)'|"rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0?\.0\d+\s*\)")/g,
    (m, pre) => { changed++; return `${pre}${alias}.border` })
  body = body.replace(/(\s[a-zA-Z-]+=)(?:'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0?\.0\d+\s*\)'|"rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0?\.0\d+\s*\)")/g,
    (m, pre) => { changed++; return `${pre}{${alias}.border}` })

  // Blue gradient
  body = body.replace(/(:\s*)(?:'linear-gradient\([^']*#1D6FE8[^']*#1248B0[^']*\)'|"linear-gradient\([^"]*#1D6FE8[^"]*#1248B0[^"]*\)")/g,
    (m, pre) => { changed++; return `${pre}${alias}.accent` })

  if (changed === 0) continue
  let src = original.slice(0, start) + body + original.slice(end)
  if (!hasImport(src)) src = addImport(src)
  if (!hasHookCall(src)) {
    const ns = findStart(src)
    src = src.slice(0, ns) + `\n  const { tokens: ${alias} } = useTheme()` + src.slice(ns)
  }
  fs.writeFileSync(f, src)
  report.touched.push({ file: f, replacements: changed })
  report.total += changed
}

console.log(`Touched: ${report.touched.length} files`)
console.log(`Total replacements: ${report.total}`)
fs.writeFileSync('reports/codemod-broader-report.json', JSON.stringify(report, null, 2))
