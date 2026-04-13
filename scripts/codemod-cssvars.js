#!/usr/bin/env node
/**
 * Convert React inline theme token references to CSS variable strings so
 * surfaces paint correctly regardless of React subtree state drift.
 *
 *   t.bg          -> 'var(--tz-bg)'
 *   t.bgCard      -> 'var(--tz-bgCard)'
 *   t.bgElevated  -> 'var(--tz-bgElevated)'
 *   t.bgHover     -> 'var(--tz-bgHover)'
 *   t.bgInput     -> 'var(--tz-bgInput)'
 *   t.text        -> 'var(--tz-text)'
 *   t.textSecondary -> 'var(--tz-textSecondary)'
 *   t.textTertiary  -> 'var(--tz-textTertiary)'
 *   t.border      -> 'var(--tz-border)'
 *   t.cardBorder  -> 'var(--tz-cardBorder)'
 *   t.borderAccent -> 'var(--tz-borderAccent)'
 *   t.inputBg     -> 'var(--tz-inputBg)'
 *   t.inputBorder -> 'var(--tz-inputBorder)'
 *   t.accent      -> 'var(--tz-accent)'
 *   t.accentLight -> 'var(--tz-accentLight)'
 *   t.accentBg    -> 'var(--tz-accentBg)'
 *   t.accentHover -> 'var(--tz-accentHover)'
 *   t.success, t.danger, t.warning, and their Bg variants
 *   t.surfaceMuted, t.bgLight, t.sidebarBg, t.sidebarBorder
 *
 * Uses whatever alias the file is already using (`t`, `th`, `_t`, etc.)
 * — discovers it via `const { tokens: X } = useTheme()`. Skips modules
 * that don't have that pattern at all. Only modifies INSIDE the component
 * function body.
 */
const fs = require('fs')
const path = require('path')

const TOKENS = [
  'bg', 'bgCard', 'bgElevated', 'bgHover', 'bgInput',
  'text', 'textSecondary', 'textTertiary',
  'border', 'cardBorder', 'borderAccent', 'borderLight', 'borderCard',
  'inputBg', 'inputBorder',
  'accent', 'accentLight', 'accentHover', 'accentBg',
  'success', 'successBg', 'danger', 'dangerBg', 'warning', 'warningBg',
  'surfaceMuted', 'surfaceMutedText',
  'bgLight', 'bgAlt', 'textLight', 'textLightSecondary',
  'sidebarBg', 'sidebarBorder', 'sidebarText', 'sidebarTextActive',
  'sidebarActiveBg', 'sidebarActiveBorder',
  'aiPurple', 'aiPurpleBg',
]

const EXCLUDE_PATHS = [
  /^src\/app\/api\//,
  /^src\/app\/page\.tsx$/,
  /^src\/app\/layout\.tsx$/,
  /^src\/app\/login\//, /^src\/app\/register\//,
  /^src\/app\/forgot-password\//, /^src\/app\/reset-password\//,
  /^src\/app\/pay\//, /^src\/app\/portal\//,
  /^src\/app\/403\//, /^src\/app\/offline\//,
  /error\.tsx$/, /not-found\.tsx$/,
  /^src\/app\/terms\//, /^src\/app\/privacy\//,
  /^src\/app\/api-docs\//, /^src\/app\/support\//,
  /^src\/components\/ServiceWorker\.tsx$/,
  /^src\/lib\/providers\//,
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

const files = [...walk('src/app'), ...walk('src/components')].filter(f => !excluded(f))
const report = { touched: [], total: 0 }

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  const aliasMatch = src.match(/const\s*\{\s*tokens\s*:\s*(\w+)\s*\}\s*=\s*useTheme\(\s*\)/)
  if (!aliasMatch) continue
  const alias = aliasMatch[1]

  const start = findStart(src)
  if (start < 0) continue
  const end = matchBraceEnd(src, start)
  let body = src.slice(start, end)
  let changed = 0

  for (const tok of TOKENS) {
    // Replace `alias.tok` whenever used in an inline style expression.
    // Match `alias.tok` as a bare identifier (followed by non-identifier char).
    // Do NOT touch `alias.tokSomething` that would be a longer property name.
    const re = new RegExp(`\\b${alias}\\.${tok}\\b(?!\\.)`, 'g')
    body = body.replace(re, () => { changed++; return `'var(--tz-${tok})'` })
  }

  if (changed === 0) continue
  fs.writeFileSync(f, src.slice(0, start) + body + src.slice(end))
  report.touched.push({ file: f, replacements: changed })
  report.total += changed
}

console.log(`Touched: ${report.touched.length} files`)
console.log(`Total replacements: ${report.total}`)
fs.writeFileSync('reports/codemod-cssvars.json', JSON.stringify(report, null, 2))
