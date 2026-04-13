#!/usr/bin/env node
/**
 * Comprehensive CSS-vars conversion v2.
 *
 * Converts every remaining color reference in any file to `var(--tz-*)`
 * CSS variable strings so there is ONE source of truth (html[data-tz-mode])
 * that can never desync from React state.
 *
 * Covers:
 *   - alias.X where alias ∈ {t, th, tt, _t, tk} (usually tokens from useTheme or THEME.dark frozen)
 *   - THEME.dark.X / THEME.light.X property access
 *   - Hex literals mapped to known tokens:
 *       '#060708' '#0d1520' '#0C0C12' -> bg
 *       '#0D0F12' '#131d2e' '#161B24' '#12121A' '#151520' -> bgCard
 *       '#0B0D11' '#080A0D' '#1C2130' -> bgInput
 *       '#F0F4FF' '#DDE3EE' '#e2e6ed' '#EDEDF0' -> text
 *       '#7C8BA0' '#9CA3AF' etc -> textSecondary (already handled earlier)
 *       '#1A1D23' -> border
 *   - 'Npx solid|dashed|dotted #hex' string form -> template literal
 *   - rgba(255,255,255,0.0X) -> var(--tz-border)
 *
 * Only processes files under src/app and src/components.
 * Excludes auth, pay, portal, error/not-found, offline, landing, SW.
 * Runs regardless of whether file has useTheme — CSS vars don't need a hook.
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

const HEX_MAP = [
  ['#060708', 'bg'], ['#0d1520', 'bg'], ['#0C0C12', 'bg'], ['#0c0c12', 'bg'],
  ['#0D0F12', 'bgCard'], ['#131d2e', 'bgCard'], ['#161B24', 'bgCard'],
  ['#12121A', 'bgCard'], ['#151520', 'bgCard'], ['#1A1A26', 'bgCard'],
  ['#0B0D11', 'bgInput'], ['#080A0D', 'bgInput'], ['#1C2130', 'bgInput'],
  ['#F0F4FF', 'text'], ['#DDE3EE', 'text'],
  ['#e2e6ed', 'text'], ['#E2E6ED', 'text'], ['#EDEDF0', 'text'],
  ['#1A1D23', 'border'], ['#1a1d23', 'border'],
]

const EXCLUDE = [
  /^src\/app\/api\//,
  /^src\/app\/page\.tsx$/, /^src\/app\/layout\.tsx$/,
  /^src\/app\/login\//, /^src\/app\/register\//,
  /^src\/app\/forgot-password\//, /^src\/app\/reset-password\//,
  /^src\/app\/pay\//, /^src\/app\/portal\//,
  /^src\/app\/403\//, /^src\/app\/offline\//,
  /error\.tsx$/, /not-found\.tsx$/,
  /^src\/app\/terms\//, /^src\/app\/privacy\//,
  /^src\/app\/api-docs\//, /^src\/app\/support\//,
  /^src\/components\/ServiceWorker\.tsx$/,
  /^src\/lib\/providers\//,
  /^src\/lib\/config\/colors\.ts$/,
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
function excluded(p) { return EXCLUDE.some(re => re.test(p)) }

const files = [...walk('src/app'), ...walk('src/components')].filter(f => !excluded(f))
const report = { touched: [], total: 0 }

for (const f of files) {
  let src = fs.readFileSync(f, 'utf8')
  const before = src
  let changed = 0

  // 1) alias.X -> 'var(--tz-X)' for any common alias
  for (const alias of ['t', 'th', 'tt', '_t', 'tk']) {
    for (const tok of TOKENS) {
      const re = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\.${tok}\\b(?!\\.)`, 'g')
      const newSrc = src.replace(re, () => { changed++; return `'var(--tz-${tok})'` })
      src = newSrc
    }
  }

  // 2) THEME.dark.X / THEME.light.X -> 'var(--tz-X)'
  for (const mode of ['dark', 'light']) {
    for (const tok of TOKENS) {
      const re = new RegExp(`\\bTHEME\\.${mode}\\.${tok}\\b(?!\\.)`, 'g')
      src = src.replace(re, () => { changed++; return `'var(--tz-${tok})'` })
    }
  }

  // 3) Hex literals mapped to tokens (neutral theme-bearing, not semantic)
  for (const [hex, tok] of HEX_MAP) {
    const escHex = hex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // In object value, JSX attribute, ternary, operator-chain
    src = src.replace(new RegExp(`(['"])${escHex}\\1`, 'g'), () => { changed++; return `'var(--tz-${tok})'` })
  }

  // 4) "Npx solid|dashed|dotted #hex" string -> `Npx solid var(--tz-tok)`
  for (const [hex, tok] of HEX_MAP) {
    const escHex = hex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    for (const style of ['solid', 'dashed', 'dotted']) {
      for (const w of ['1px', '2px', '3px']) {
        src = src.replace(new RegExp(`(['"])${w} ${style} ${escHex}\\1`, 'g'), () => {
          changed++; return `'${w} ${style} var(--tz-${tok})'`
        })
      }
    }
  }

  // 5) rgba(255,255,255,.0X) -> var(--tz-border)
  for (const a of ['.01','.02','.025','.03','.04','.05','.055','.06','.08','.1','.12','.15','.2','.3']) {
    const alpha = a.replace('.', '\\.')
    const rgbaRe = `rgba\\(\\s*255\\s*,\\s*255\\s*,\\s*255\\s*,\\s*0?${alpha}\\s*\\)`
    src = src.replace(new RegExp(`(['"])${rgbaRe}\\1`, 'g'), () => { changed++; return `'var(--tz-border)'` })
    for (const style of ['solid', 'dashed', 'dotted']) {
      for (const w of ['1px', '2px', '3px']) {
        src = src.replace(new RegExp(`(['"])${w} ${style} ${rgbaRe}\\1`, 'g'), () => {
          changed++; return `'${w} ${style} var(--tz-border)'`
        })
      }
    }
  }

  if (src !== before) {
    fs.writeFileSync(f, src)
    report.touched.push({ file: f, replacements: changed })
    report.total += changed
  }
}

console.log(`Touched: ${report.touched.length} files`)
console.log(`Total replacements: ${report.total}`)
fs.writeFileSync('reports/codemod-cssvars-v2.json', JSON.stringify(report, null, 2))
