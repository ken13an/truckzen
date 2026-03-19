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
