#!/usr/bin/env node
/**
 * bgLight was too aggressive in the earlier hex->token mapping. bgLight is
 * pure white in BOTH modes (intentionally invariant). Pages that were light-
 * theme-only and had `#ffffff` as page/card bg got mapped to bgLight, which
 * means they stay white on a dark shell in dark mode.
 *
 * Fix: for usages that are clearly a page/card container, remap to
 *   - 'var(--tz-bg)'    when it's a page wrapper (minHeight + layout)
 *   - 'var(--tz-bgCard)' when it's a rounded card container
 * Leave bgLight for small invariant UI (toggle dots, QR codes, button text
 * color on accent bg, etc).
 */
const fs = require('fs')
const path = require('path')

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (['api', 'node_modules', '.next'].includes(e.name)) continue
      walk(p, out)
    } else if (/\.tsx$/.test(e.name)) out.push(p)
  }
  return out
}

let touched = 0, total = 0
for (const f of walk('src/app').concat(walk('src/components'))) {
  if (/\/api\/|ServiceWorker\.tsx|colors\.ts/.test(f)) continue
  let s = fs.readFileSync(f, 'utf8')
  const before = s

  // Case A: page-level bg — minHeight: '100vh' context
  //   background: 'var(--tz-bgLight)', minHeight: '100vh'  ->  background: 'var(--tz-bg)', minHeight: '100vh'
  s = s.replace(
    /background:\s*'var\(--tz-bgLight\)'(\s*,[^}]*?minHeight:\s*'100vh')/g,
    (m, tail) => { total++; return `background: 'var(--tz-bg)'${tail}` }
  )
  // And the reverse order (minHeight before background)
  s = s.replace(
    /minHeight:\s*'100vh'([^}]*?),\s*background:\s*'var\(--tz-bgLight\)'/g,
    (m, mid) => { total++; return `minHeight: '100vh'${mid}, background: 'var(--tz-bg)'` }
  )

  // Case B: card-like container — with borderRadius and padding
  //   background: 'var(--tz-bgLight)', border: ..., borderRadius: N
  s = s.replace(
    /background:\s*'var\(--tz-bgLight\)',(\s*border[^}]*?borderRadius:\s*\d+)/g,
    (m, tail) => { total++; return `background: 'var(--tz-bgCard)',${tail}` }
  )

  // Case C: bgLight used as fontSize 200 QR surface — LEAVE as-is

  // Case D: body-level background property as part of { ... } object:
  //   background: 'var(--tz-bgLight)', minHeight ... (already handled)
  //   background: 'var(--tz-bgLight)', fontFamily: FONT   (page wrapper, flip)
  s = s.replace(
    /background:\s*'var\(--tz-bgLight\)',(\s*fontFamily)/g,
    (m, tail) => { total++; return `background: 'var(--tz-bg)',${tail}` }
  )

  if (s !== before) { fs.writeFileSync(f, s); touched++ }
}
console.log(`Touched ${touched} files, ${total} replacements`)
