#!/usr/bin/env node
/**
 * Convert `const _t = THEME.dark` frozen pages to live useTheme.
 *
 * Strategy:
 *   - Keep module-level `_t = THEME.dark` (used by semantic status maps).
 *   - Inside the component body, add `const { tokens: t } = useTheme()`.
 *   - Replace `_t.` with `t.` INSIDE the component body only.
 *
 * This keeps module-level badge color maps stable (fine across themes since
 * they reference semantic colors like warning/success/danger) while making
 * all in-component background/text references flip with the theme.
 */
const fs = require('fs')

const FILES = [
  'src/app/shop-floor/page.tsx',
  'src/app/mechanic/dashboard/page.tsx',
  'src/app/floor-manager/dashboard/page.tsx',
  'src/app/floor-manager/quick-view/page.tsx',
  'src/app/tech/page.tsx',
  'src/app/parts/page.tsx',
  'src/app/parts/[id]/page.tsx',
  'src/app/parts/queue/page.tsx',
  'src/app/parts/cores/page.tsx',
  'src/app/work-orders/[id]/page.tsx',
  'src/components/CommandPalette.tsx',
  'src/components/DateRangePicker.tsx',
  'src/components/ai-text-input.tsx',
  'src/components/work-orders/WOStepper.tsx',
  'src/components/layout/AppPageShell.tsx',
]

function findComponentBodyStart(src) {
  let m = src.match(/export\s+default\s+function\s+\w+\s*\([^)]*\)\s*(?::\s*[^\{]+)?\s*\{/)
  if (m) return m.index + m[0].length
  // Named function + export default Name
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

const report = []

for (const p of FILES) {
  if (!fs.existsSync(p)) { report.push({ file: p, status: 'missing' }); continue }
  const original = fs.readFileSync(p, 'utf8')
  if (!original.includes('const _t = THEME.dark') && !original.includes('const _t=THEME.dark')) {
    report.push({ file: p, status: 'no-frozen-t' })
    continue
  }

  const start = findComponentBodyStart(original)
  if (start < 0) { report.push({ file: p, status: 'no-body' }); continue }
  const end = findComponentBodyEnd(original, start)

  const before = original.slice(0, start)
  let body = original.slice(start, end)
  const after = original.slice(end)

  // Replace `_t.` with `t.` inside body only
  const replacements = (body.match(/\b_t\./g) || []).length
  body = body.replace(/\b_t\./g, 't.')

  // Inject hook call if not present in body
  let newBody = body
  if (!/useTheme\s*\(\s*\)/.test(original)) {
    // Should never happen because file imports useTheme via our earlier passes
  }
  if (!/const\s*\{\s*tokens\s*:\s*t\s*\}\s*=\s*useTheme/.test(body)) {
    newBody = '\n  const { tokens: t } = useTheme()' + body
  }

  const out = before + newBody + after
  if (out !== original) {
    fs.writeFileSync(p, out)
    report.push({ file: p, status: 'patched', replacements })
  } else {
    report.push({ file: p, status: 'no-change' })
  }
}

for (const r of report) console.log(r)
fs.writeFileSync('reports/codemod-frozen-t-report.json', JSON.stringify(report, null, 2))
