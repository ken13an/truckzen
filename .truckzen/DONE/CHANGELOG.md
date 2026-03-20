# TruckZen -- Changelog

All changes made by Claude Code, in reverse chronological order.

---

<!-- CC: Append new entries at the top, below this line. Format:

## YYYY-MM-DD -- [Prompt Number] Brief Title
- What was done
- Files created: list
- Files modified: list
- Database changes: list
- Build status: PASS / FAIL
- Git commit: hash

-->

## 2026-03-19 -- [000] FINAL: Revert UI, Logo Swap, Emoji Removal
- REVERTED entire src/ to pre-redesign state (commit 04fbb51)
- Removed Tailwind 4: deleted globals.css, tailwind.config.ts, postcss.config.js
- Restored original package.json (no tailwindcss, no @tailwindcss/postcss, no lucide-react)
- Created new Logo component: white TZ icon + blue #1D6FE8 dot, "truck" white / "zen." blue
- Updated logo in: login, forgot-password, reset-password, sidebar
- Login page restyled: #0a0a10 bg, #12131a card, 16px radius, 48px 40px padding, solid #1D6FE8 button, #1D6FE8 forgot link
- Removed 106 emoji occurrences across 22+ files
- Added permanent no-emoji rule to CC_RULES.md
- Blue accent #1D6FE8 preserved -- zero teal in codebase (except nowhere)
- Files created: src/components/Logo.tsx
- Files modified: 77 files
- Database changes: none
- Build status: PASS (84 pages, 0 errors)
- Git commit: ecd5c2f

## 2026-03-19 -- [000] Logo Fix + Global Blue→Teal Color Replace (REVERTED)
- Created Logo.tsx with correct brand mark: white rounded square, bold TZ, teal dot bottom-left
- Wordmark: "truckzen." lowercase — "truck" white, "zen." teal (with period)
- Updated sidebar, login, forgot-password, reset-password to use Logo component
- Global replacement of ALL blue accent colors (#1D6FE8, #4D9EFF, #1248B0) → teal (#00E0B0, #00805F)
- 198 references across 51 files updated to teal
- Zero remaining blue accent references
- Files created: src/components/Logo.tsx
- Files modified: 55 files (all pages, components, and libs)
- Build status: PASS (84 pages, 0 errors)
- Git commit: c1f4dd2

## 2026-03-19 -- [000] Brand Redesign Session 2 (Settings + Auth pages)
- Restyled settings page: brand tabs, inputs, cards, Lucide LogOut/UserPlus/ExternalLink/Copy
- Restyled 403 page: Lucide ShieldX, teal CTA
- Restyled not-found page: Lucide FileQuestion, teal CTA
- Restyled offline page: Lucide WifiOff, teal retry
- Restyled forgot-password: Lucide Mail/Loader2/XCircle, brand form
- Restyled reset-password: Lucide Loader2/XCircle/CheckCircle2/ShieldX, brand form
- Files modified: settings/page.tsx, 403/page.tsx, not-found.tsx, offline/page.tsx, forgot-password/page.tsx, reset-password/page.tsx
- Build status: PASS (84 pages, 0 errors)
- Git commit: 3961737

## 2026-03-19 -- [000] Brand Redesign Core Pages
- Restyled sidebar: 22 Lucide icons mapped, brand colors (teal active, surface bg), collapse/expand
- Restyled login page: Tailwind, Lucide Eye/Loader2, teal CTA, brand card, ambient glow
- Restyled dashboard: brand stat cards, brand table, Lucide Truck icon, teal accents
- Restyled orders page: 4 tabs, status badges (teal/warning/purple/success/error), Lucide Plus
- Restyled customers page: server-side pagination, Lucide chevrons, brand table
- Restyled fleet page: sub-nav tabs, status badges, brand table
- Updated permissions module: icon field from emojis to Lucide icon name strings
- Renamed "Service Orders" to "Repair Orders" in sidebar/orders page
- Files modified: Sidebar.tsx, permissions.ts, login/page.tsx, dashboard/page.tsx, orders/page.tsx, customers/page.tsx, fleet/page.tsx
- Build status: PASS (84 pages, 0 errors)
- Git commits: 140f65b, cd79ea0, 398875e, e9595d3, e37c452, 84deec5

## 2026-03-19 -- [000] Brand Redesign Foundation
- Installed Tailwind CSS 4 + PostCSS + lucide-react
- Created tailwind.config.ts with full brand color palette from BRAND_GUIDE.md
- Created postcss.config.js for Tailwind 4
- Created src/app/globals.css with all CSS variables, body defaults, scrollbar styling, reduced-motion support
- Updated layout.tsx: imported globals.css, switched fonts to Inter + JetBrains Mono, removed inline body styles
- Files created: tailwind.config.ts, postcss.config.js, src/app/globals.css
- Files modified: src/app/layout.tsx, package.json, package-lock.json
- Database changes: none
- Build status: PASS (84 pages, 0 errors)
