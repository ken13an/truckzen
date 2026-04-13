#!/usr/bin/env node
/**
 * Full warm-mode cleanup v2.
 *
 * Extends the previous codemod with:
 *   - Ternary `? '#xxx'` form (in addition to `: '#xxx'` object form)
 *   - `|| '#xxx'` / `&& '#xxx'` fallback form
 *   - JSX expression container tail: `{ ... '#xxx' ... }` via object form
 *   - Module-level style block relocation: `const X: React.CSSProperties = {...}`
 *     or `const X: Record<string, React.CSSProperties> = {...}` that contains
 *     any dark hex is MOVED inside the component function (right after the
 *     useTheme destructure) and hex literals inside are replaced with token
 *     references. Call sites keep the same name, so no usage updates needed.
 *
 * Only processes files that already use useTheme() (this is a PARTIAL pass).
 */
const fs = require('fs')
const path = require('path')

const HEX = [
  ['#060708', 'bg'], ['#0C0C12', 'bg'], ['#0c0c12', 'bg'], ['#0d1520', 'bg'],
  ['#0D0F12', 'bgCard'], ['#131d2e', 'bgCard'], ['#161B24', 'bgCard'],
  ['#12121A', 'bgCard'], ['#151520', 'bgCard'], ['#1A1A26', 'bgCard'],
  ['#0B0D11', 'bgInput'], ['#080A0D', 'bgInput'], ['#1C2130', 'bgInput'],
  ['#F0F4FF', 'text'], ['#DDE3EE', 'text'],
  ['#e2e6ed', 'text'], ['#E2E6ED', 'text'], ['#EDEDF0', 'text'],
  ['#7C8BA0', 'textSecondary'], ['#8494a7', 'textSecondary'],
  ['#9CA3AF', 'textSecondary'], ['#9D9DA1', 'textSecondary'],
  ['#A0AABF', 'textSecondary'], ['#8A8F9E', 'textSecondary'],
  ['#6B7280', 'textSecondary'], ['#B8C4D6', 'textSecondary'],
  ['#48536A', 'textTertiary'], ['#4a5568', 'textTertiary'],
  ['#1A1D23', 'border'], ['#1a1d23', 'border'],
]
const BLUE = [
  ['#1D6FE8', 'accent'], ['#1B6EE6', 'accent'],
  ['#1248B0', 'accentHover'], ['#4D9EFF', 'accentLight'],
]
const WHITE_HEX = ['#fff', '#ffffff', '#FFFFFF']
const RGBA_WHITE_ALPHAS = ['.01','.02','.025','.03','.04','.05','.055','.06','.08','.1','.12','.15','.2','.3']

const EXCLUDE_PATHS = [
  /^src\/app\/api\//,
  /^src\/app\/login\//, /^src\/app\/register\//,
  /^src\/app\/forgot-password\//, /^src\/app\/reset-password\//,
  /^src\/app\/pay\//, /^src\/app\/portal\//,
  /^src\/app\/403\//, /^src\/app\/offline\//,
  /error\.tsx$/, /not-found\.tsx$/,
  /^src\/app\/terms\//, /^src\/app\/privacy\//,
  /^src\/app\/api-docs\//, /^src\/app\/support\//,
  /^src\/app\/page\.tsx$/, /^src\/app\/layout\.tsx$/,
  /^src\/components\/ServiceWorker\.tsx$/,
]

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (['api', 'node_modules', '.next'].includes(e.name)) continue
      walk(p, out)
    } else if (/\.tsx$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p)
  }
  return out
}
function excluded(p) { return EXCLUDE_PATHS.some(re => re.test(p)) }
function pickAlias(src) {
  const m = src.match(/const\s*\{\s*tokens\s*:\s*(\w+)\s*\}\s*=\s*useTheme\(\s*\)/)
  if (m) return m[1]
  const existing = new Set()
  for (const mm of src.matchAll(/\b(?:const|let|var|function)\s+(\w+)\b/g)) existing.add(mm[1])
  for (const mm of src.matchAll(/\(\s*(\w+)\s*[,)]/g)) existing.add(mm[1])
  for (const cand of ['t', 'th', '_tz', '_th', 'tz']) {
    if (!existing.has(cand)) return cand
  }
  return '__tz'
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
  // Use real brace matching from `start` (which is just after the opening `{`).
  return matchBraceEnd(src, start)
}

function rewriteInRange(src, alias) {
  let body = src
  let changed = 0

  const all = [
    ...HEX.map(([h, t]) => ({ hex: h, expr: `${alias}.${t}` })),
    ...BLUE.map(([h, t]) => ({ hex: h, expr: `${alias}.${t}` })),
    ...WHITE_HEX.map(h => ({ hex: h, expr: `${alias}.bgLight` })),
  ]

  for (const { hex, expr } of all) {
    const escHex = hex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Object value / ternary else / operator chain -> bare expression
    const bareBefore = `([(?:,&|])\\s*(['"])${escHex}\\2`
    body = body.replace(new RegExp(bareBefore, 'g'), (m, pre) => {
      changed++; return `${pre} ${expr}`
    })
    // Leading colon (object value) — match even without bracket context
    body = body.replace(new RegExp(`(:\\s+)(['"])${escHex}\\2`, 'g'), (m, pre) => {
      changed++; return `${pre}${expr}`
    })
    // Question mark (ternary then)
    body = body.replace(new RegExp(`(\\?\\s+)(['"])${escHex}\\2`, 'g'), (m, pre) => {
      changed++; return `${pre}${expr}`
    })
    // JSX attr form -> wrap in {}
    body = body.replace(new RegExp(`(\\s[a-zA-Z-]+=)(['"])${escHex}\\2`, 'g'), (m, pre) => {
      changed++; return `${pre}{${expr}}`
    })
    // Assignment form (e.g. onMouseEnter arrow body: .style.background = '#xxx')
    body = body.replace(new RegExp(`(=\\s*)(['"])${escHex}\\2`, 'g'), (m, pre) => {
      changed++; return `${pre}${expr}`
    })
  }

  // "1px solid #hex" string form — rewrite to template literal with token
  for (const { hex, expr } of all) {
    const escHex = hex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    for (const style of ['solid', 'dashed', 'dotted']) {
      for (const width of ['1px', '2px', '3px']) {
        body = body.replace(new RegExp(`(['"])${width} ${style} ${escHex}\\1`, 'g'), () => {
          changed++; return `\`${width} ${style} \${${expr}}\``
        })
      }
    }
  }

  // rgba white (neutral borders / hover)
  for (const a of RGBA_WHITE_ALPHAS) {
    const alpha = a.replace('.', '\\.')
    const rgbaRe = `rgba\\(\\s*255\\s*,\\s*255\\s*,\\s*255\\s*,\\s*0?${alpha}\\s*\\)`
    body = body.replace(new RegExp(`([(?:,&|])\\s*(['"])${rgbaRe}\\2`, 'g'), (m, pre) => {
      changed++; return `${pre} ${alias}.border`
    })
    body = body.replace(new RegExp(`(:\\s+)(['"])${rgbaRe}\\2`, 'g'), (m, pre) => {
      changed++; return `${pre}${alias}.border`
    })
    body = body.replace(new RegExp(`(\\?\\s+)(['"])${rgbaRe}\\2`, 'g'), (m, pre) => {
      changed++; return `${pre}${alias}.border`
    })
    body = body.replace(new RegExp(`(\\s[a-zA-Z-]+=)(['"])${rgbaRe}\\2`, 'g'), (m, pre) => {
      changed++; return `${pre}{${alias}.border}`
    })
    // Template literal expression: `1px solid rgba(...)` or `${x}X${y}rgba(...)`
    // Handle only the standalone `1px solid rgba(...)` form commonly used for borders.
    body = body.replace(new RegExp(`\`1px solid ${rgbaRe}\``, 'g'), () => {
      changed++; return `\`1px solid \${${alias}.border}\``
    })
    // Plain string '1px solid rgba(...)' -> template literal
    body = body.replace(new RegExp(`(['"])1px solid ${rgbaRe}\\1`, 'g'), () => {
      changed++; return `\`1px solid \${${alias}.border}\``
    })
    body = body.replace(new RegExp(`(['"])2px solid ${rgbaRe}\\1`, 'g'), () => {
      changed++; return `\`2px solid \${${alias}.border}\``
    })
    // Dashed variants
    body = body.replace(new RegExp(`(['"])1px dashed ${rgbaRe}\\1`, 'g'), () => {
      changed++; return `\`1px dashed \${${alias}.border}\``
    })
    body = body.replace(new RegExp(`(['"])2px dashed ${rgbaRe}\\1`, 'g'), () => {
      changed++; return `\`2px dashed \${${alias}.border}\``
    })
    // Standalone quoted rgba string (e.g. assignment in onMouseEnter):
    //   style.background = 'rgba(255,255,255,.02)'   ->   alias.border
    body = body.replace(new RegExp(`(=\\s*)(['"])${rgbaRe}\\2`, 'g'), (m, pre) => {
      changed++; return `${pre}${alias}.border`
    })
  }
  return { out: body, changed }
}

// Match the matching brace of an object literal. Starts just after the {.
function matchBraceEnd(src, start) {
  let d = 1, i = start
  while (i < src.length && d > 0) {
    const c = src[i]
    if (c === '/' && src[i + 1] === '/') { const nl = src.indexOf('\n', i); i = nl === -1 ? src.length : nl + 1; continue }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e === -1 ? src.length : e + 2; continue }
    if (c === '\'' || c === '"') { const q = c; i++; while (i < src.length && src[i] !== q) { if (src[i] === '\\') i += 2; else i++ } i++; continue }
    if (c === '`') { i++; while (i < src.length) { if (src[i] === '\\') { i += 2; continue } if (src[i] === '`') { i++; break } i++ } continue }
    if (c === '{') d++
    else if (c === '}') { d--; if (d === 0) return i }
    i++
  }
  return src.length
}

function relocateModuleStyles(src, alias, bodyStart, bodyEnd) {
  // Find top-level const X = {...} (or X: CSSProperties / Record<*, CSSProperties> = {...})
  // that sit OUTSIDE the component function body and contain offending hex.
  // Move them inside the component body (after the useTheme() destructure)
  // and rewrite hex inside to token references.
  const re = /^const\s+(\w+)\s*(?::\s*(?:React\.)?CSSProperties\s*|:\s*Record<[^>]+,\s*(?:React\.)?CSSProperties>\s*|)=\s*\{/gm
  const blocks = []
  let m
  while ((m = re.exec(src)) !== null) {
    // Only collect blocks OUTSIDE the component body
    if (m.index >= bodyStart && m.index < bodyEnd) continue
    const openIdx = src.indexOf('{', m.index)
    const closeIdx = matchBraceEnd(src, openIdx + 1)
    const blockEnd = closeIdx + 1
    const blockSrc = src.slice(m.index, blockEnd)
    const hasOffender = HEX.some(([h]) => blockSrc.includes(h))
      || BLUE.some(([h]) => blockSrc.includes(h))
      || WHITE_HEX.some(h => blockSrc.includes(`'${h}'`) || blockSrc.includes(`"${h}"`))
      || /rgba\(\s*255\s*,\s*255\s*,\s*255/.test(blockSrc)
    if (!hasOffender) continue
    blocks.push({ name: m[1], start: m.index, end: blockEnd, src: blockSrc })
  }
  if (!blocks.length) return { src, moved: 0 }

  // Remove blocks (in reverse order to preserve indices) and collect rewritten versions.
  let working = src
  const toInject = []
  const sortedDesc = blocks.slice().sort((a, b) => b.start - a.start)
  for (const b of sortedDesc) {
    const { out } = rewriteInRange(b.src, alias)
    toInject.unshift(out) // preserve original order
    working = working.slice(0, b.start) + working.slice(b.end).replace(/^[\t ]*\n?/, '')
  }

  // Recompute body start (positions shifted after removals)
  const newBodyStart = findStart(working)
  if (newBodyStart < 0) return { src: working, moved: blocks.length } // safe fallback

  // Find the useTheme destructure line end
  const hookRe = new RegExp(`const\\s*\\{\\s*tokens\\s*:\\s*${alias}\\s*\\}\\s*=\\s*useTheme\\(\\s*\\)[^\\n]*\\n`)
  const inject = '\n  ' + toInject.join('\n  ') + '\n'
  const hookMatch = working.slice(newBodyStart).match(hookRe)
  let idxInBody
  if (hookMatch) {
    idxInBody = newBodyStart + hookMatch.index + hookMatch[0].length
    return { src: working.slice(0, idxInBody) + inject + working.slice(idxInBody), moved: blocks.length }
  }
  // No hook call yet — insert hook then blocks right after body start
  const injectAll = `\n  const { tokens: ${alias} } = useTheme()` + inject
  return { src: working.slice(0, newBodyStart) + injectAll + working.slice(newBodyStart), moved: blocks.length }
}

const files = [...walk('src/app'), ...walk('src/components')].filter(f => !excluded(f))
const report = { touched: [], totalReplacements: 0, movedBlocks: 0 }

for (const f of files) {
  const original = fs.readFileSync(f, 'utf8')
  if (!/^'use client'|\n'use client'/.test(original)) continue
  if (!/useTheme\s*\(\s*\)/.test(original)) continue // only PARTIAL pass

  const alias = pickAlias(original)
  const start = findStart(original)
  if (start < 0) continue
  const end = findEnd(original, start)

  // 1) Rewrite body hex
  const body = original.slice(start, end)
  const { out: newBody, changed: bodyChanges } = rewriteInRange(body, alias)
  let src = original.slice(0, start) + newBody + original.slice(end)

  // 2) Relocate module-level style blocks (before and after the component)
  const newStart = findStart(src)
  const newEnd = findEnd(src, newStart)
  const { src: src2, moved } = relocateModuleStyles(src, alias, newStart, newEnd)
  src = src2

  const totalChanges = bodyChanges + moved
  if (totalChanges === 0) continue
  if (src === original) continue
  fs.writeFileSync(f, src)
  report.touched.push({ file: f, replacements: bodyChanges, movedBlocks: moved })
  report.totalReplacements += bodyChanges
  report.movedBlocks += moved
}

console.log(`Touched: ${report.touched.length} files`)
console.log(`Body replacements: ${report.totalReplacements}`)
console.log(`Module blocks relocated: ${report.movedBlocks}`)
fs.writeFileSync('reports/codemod-full-warm-v2.json', JSON.stringify(report, null, 2))
