#!/usr/bin/env node
const fs = require('fs')

const FILES = [
  'src/app/fleet/layout.tsx',
  'src/app/accounting/layout.tsx',
  'src/app/parts/layout.tsx',
  'src/app/shop-floor/layout.tsx',
  'src/app/invoices/layout.tsx',
]

for (const p of FILES) {
  let s = fs.readFileSync(p, 'utf8')
  const before = s

  if (!s.includes("from '@/hooks/useTheme'")) {
    s = s.replace(
      /(import \{ getCurrentUser \} from '@\/lib\/auth'\n)/,
      (m) => m + "import { useTheme } from '@/hooks/useTheme'\n"
    )
  }
  // Insert const tokens inside the component body
  s = s.replace(
    /(export default function \w+\([^)]*\) \{\n  )(const supabase = createClient\(\))/,
    (m, a, b) => a + 'const { tokens: t } = useTheme()\n  ' + b
  )
  s = s.replace(/background: '#060708'/g, 'background: t.bg')
  s = s.replace(/color: '#7C8BA0'/g, 'color: t.textSecondary')

  if (s !== before) {
    fs.writeFileSync(p, s)
    console.log('patched:', p)
  } else {
    console.log('no-op:', p)
  }
}
