#!/usr/bin/env node
/**
 * Settings-cluster polish codemod — tight-scope.
 * Only: src/app/settings/**\/page.tsx (actual product settings).
 *
 * Replaces neutral hex/rgba inside component bodies (not semantic status colors):
 *   '#fff' | '#ffffff' -> t.bgLight
 *   '#1A1D23' -> t.border
 *   rgba(255,255,255,0.0X) or 0.1X -> t.border
 */
const fs = require('fs')
const path = require('path')

const FILES = [
  'src/app/settings/page.tsx',
  'src/app/settings/billing/page.tsx',
  'src/app/settings/bulk-skills/page.tsx',
  'src/app/settings/import/page.tsx',
  'src/app/settings/permissions/page.tsx',
  'src/app/settings/staff-import/page.tsx',
  'src/app/settings/users/page.tsx',
  'src/app/settings/users/new/page.tsx',
]

function findStart(src) {
  const m = src.match(/export\s+default\s+function\s+\w+\s*\([^)]*\)\s*(?::\s*[^\{]+)?\s*\{/)
  return m ? m.index + m[0].length : -1
}
function findEnd(src, start) {
  const rest = src.slice(start)
  const m = rest.match(/\n\}[ \t]*(?:\r?\n|$)/)
  return m ? start + m.index + 1 : src.length
}
function pickAlias(src) {
  const m = src.match(/const\s*\{\s*tokens\s*:\s*(\w+)\s*\}\s*=\s*useTheme\(\s*\)/)
  return m ? m[1] : 't'
}

const report = []

for (const f of FILES) {
  if (!fs.existsSync(f)) { report.push({ file: f, status: 'missing' }); continue }
  const original = fs.readFileSync(f, 'utf8')
  const alias = pickAlias(original)
  const start = findStart(original)
  if (start < 0) { report.push({ file: f, status: 'no-body' }); continue }
  const end = findEnd(original, start)
  let body = original.slice(start, end)
  let changed = 0

  function rep(re, expr) {
    // Object value form
    const objRe = new RegExp(`(:\\s*)(?:${re.source})`, 'g')
    body = body.replace(objRe, (m, pre) => { changed++; return `${pre}${expr}` })
    // JSX attr form
    const attrRe = new RegExp(`(\\s[a-zA-Z-]+=)(?:${re.source})`, 'g')
    body = body.replace(attrRe, (m, pre) => { changed++; return `${pre}{${expr}}` })
  }

  rep(/'#fff'|"#fff"|'#ffffff'|"#ffffff"/, `${alias}.bgLight`)
  rep(/'#1A1D23'|"#1A1D23"|'#1a1d23'|"#1a1d23"/, `${alias}.border`)
  // rgba white with any low alpha <= .2
  rep(/'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0?\.(?:0[0-9]|1[0-5])\d?\s*\)'|"rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0?\.(?:0[0-9]|1[0-5])\d?\s*\)"/, `${alias}.border`)
  // Template-literal border: border: `1px solid rgba(255,255,255,.0X)` -> use alias.border
  body = body.replace(/`1px solid rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0?\.0\d+\s*\)`/g,
    (m) => { changed++; return `\`1px solid \${${alias}.border}\`` })

  if (changed === 0) { report.push({ file: f, status: 'no-change' }); continue }
  const out = original.slice(0, start) + body + original.slice(end)
  fs.writeFileSync(f, out)
  report.push({ file: f, status: 'patched', replacements: changed })
}

for (const r of report) console.log(r)
