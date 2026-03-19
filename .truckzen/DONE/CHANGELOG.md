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
