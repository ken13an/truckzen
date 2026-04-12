#!/usr/bin/env node
/**
 * PASS C: Scoped partial-pattern cleanup.
 *
 * Targets the 4 missed patterns from the audit:
 *   #161B24             -> t.bgCard (dark card surface, used as card bg)
 *   #7C8BA0             -> t.textSecondary
 *   #48536A             -> t.textTertiary
 *   rgba(255,255,255,0.X) -> t.border (neutral border)
 *
 * Constraints:
 *   - Only inside the default-exported component function body
 *   - Only in authenticated product files (src/app except excluded + src/components except excluded)
 *   - Replaces both object-value form (`: '#xxx'`) and JSX attr form (`attr="#xxx"`)
 *   - Reuses existing `const { tokens: T }` alias if present; otherwise picks 't', 'th', 'tt'
 *   - Skips lines with `// codemod-skip`
 *
 * Out of scope (exclude):
 *   - src/app/api (any depth)
 *   - src/app/login (any depth), register, forgot-password, reset-password, 2fa
 *   - src/app/pay (any depth), src/app/portal (any depth)
 *   - error.tsx and not-found.tsx at any depth
 *   - src/components/ServiceWorker.tsx
 */
const fs = require('fs')
const path = require('path')

const PATTERNS = [
  { match: /'#161B24'|"#161B24"/g, expr: (a) => `${a}.bgCard`, jsx: (a) => `{${a}.bgCard}` },
  { match: /'#7C8BA0'|"#7C8BA0"/g, expr: (a) => `${a}.textSecondary`, jsx: (a) => `{${a}.textSecondary}` },
  { match: /'#48536A'|"#48536A"/g, expr: (a) => `${a}.textTertiary`, jsx: (a) => `{${a}.textTertiary}` },
  // rgba(255,255,255,0.X) with optional spaces
  { match: /['"]rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0?\.\d+\s*\)['"]/g, expr: (a) => `${a}.border`, jsx: (a) => `{${a}.border}` },
]

const EXCLUDE_PATHS = [
  /^src\/app\/api\//,
  /^src\/app\/login\//,
  /^src\/app\/register\//,
  /^src\/app\/forgot-password\//,
  /^src\/app\/reset-password\//,
  /^src\/app\/pay\//,
  /^src\/app\/portal\//,
  /^src\/app\/403\//,
  /^src\/app\/error\.tsx$/,
  /^src\/app\/not-found\.tsx$/,
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
  const thUsed = /\bconst\s+th\s*=|\(th\s*[,)]|\.map\(\s*\(?\s*th\b/.test(src)
  if (!thUsed) return 'th'
  return 'tt'
}

function findComponentBodyStart(src) {
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
function findComponentBodyEnd(src, start) {
  const rest = src.slice(start)
  const m = rest.match(/\n\}[ \t]*(?:\r?\n|$)/)
  if (!m) return src.length
  return start + m.index + 1
}

function hasUseThemeImport(src) { return /from\s+['"]@\/hooks\/useTheme['"]/.test(src) }
function alreadyCallsUseTheme(src) { return /useTheme\s*\(\s*\)/.test(src) }

function addImport(src) {
  if (hasUseThemeImport(src)) return src
  const m = src.match(/^(?:[ \t]*(?:'use client'|import[^\n]*)\n)+/m)
  if (!m) return `import { useTheme } from '@/hooks/useTheme'\n` + src
  const end = m.index + m[0].length
  return src.slice(0, end) + `import { useTheme } from '@/hooks/useTheme'\n` + src.slice(end)
}

function insertHookCall(src, alias, bodyStart) {
  return src.slice(0, bodyStart) + `\n  const { tokens: ${alias} } = useTheme()` + src.slice(bodyStart)
}

const files = [...walk('src/app'), ...walk('src/components')].filter(f => !excluded(f))

const report = { touched: [], totalReplacements: 0 }

for (const f of files) {
  const original = fs.readFileSync(f, 'utf8')
  if (!/^'use client'|\n'use client'/.test(original)) continue
  // Quick contains check
  const has = PATTERNS.some(p => p.match.test(original))
  // Reset regex stateful .lastIndex
  for (const p of PATTERNS) p.match.lastIndex = 0
  if (!has) continue

  const alias = pickAlias(original)
  const bodyStart = findComponentBodyStart(original)
  if (bodyStart < 0) continue
  const bodyEnd = findComponentBodyEnd(original, bodyStart)

  let body = original.slice(bodyStart, bodyEnd)
  let changed = 0

  // For each pattern do two passes: JSX attr form and object-value form.
  for (const p of PATTERNS) {
    // JSX attr form:  `\s<attr>="<hex>"`  -> `\s<attr>={alias.tok}`
    const coreHex = p.match.source.split('|')[0].replace(/['"]/g, '').replace(/^\//, '').replace(/\/$/, '')
    // Build safer JSX attr regex per pattern
    // Generic: attribute="value"
    // For rgba we also handle multi-alpha; just use the original match with a preceding ` attr=`
    const attrRe = new RegExp(`(\\s[a-zA-Z-]+=)${p.match.source.replace(/\//g, '')}`, 'g')
    body = body.replace(attrRe, (m, pre, offset) => {
      const ls = body.lastIndexOf('\n', offset) + 1
      const le = body.indexOf('\n', offset)
      const line = body.slice(ls, le === -1 ? body.length : le)
      if (line.includes('codemod-skip')) return m
      changed++
      return `${pre}${p.jsx(alias)}`
    })

    // Object value form:  `: 'hex'`  -> `: alias.tok`
    const objRe = new RegExp(`(:\\s*)${p.match.source.replace(/\//g, '')}`, 'g')
    body = body.replace(objRe, (m, pre, offset) => {
      const ls = body.lastIndexOf('\n', offset) + 1
      const le = body.indexOf('\n', offset)
      const line = body.slice(ls, le === -1 ? body.length : le)
      if (line.includes('codemod-skip')) return m
      changed++
      return `${pre}${p.expr(alias)}`
    })

    // Template-literal border inside style values — handle `1px solid rgba(...)` forms.
    const tmplRe = new RegExp(`(\`[^\`]*?1px solid )${p.match.source.replace(/\//g, '').replace(/\['"\]/g, '')}([^\`]*?\`)`, 'g')
    // (skip template rewriting – too risky, handled elsewhere)

    for (const pp of PATTERNS) pp.match.lastIndex = 0
  }

  if (changed === 0) continue

  let src = original.slice(0, bodyStart) + body + original.slice(bodyEnd)
  if (!hasUseThemeImport(src)) src = addImport(src)
  if (!alreadyCallsUseTheme(src)) {
    const newStart = findComponentBodyStart(src)
    src = insertHookCall(src, alias, newStart)
  }

  fs.writeFileSync(f, src)
  report.touched.push({ file: f, replacements: changed, alias })
  report.totalReplacements += changed
}

console.log(`Touched: ${report.touched.length} files`)
console.log(`Total replacements: ${report.totalReplacements}`)
fs.writeFileSync('reports/codemod-partial-patterns-report.json', JSON.stringify(report, null, 2))
