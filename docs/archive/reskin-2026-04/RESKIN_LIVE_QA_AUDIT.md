# Reskin Live QA Audit
Generated: 2026-04-11

## 1. SUMMARY

The app is now visually consistent across all high-traffic operational screens. All core pages (dashboard, work orders, parts, shop-floor, mechanic, auth) are reskinned and using theme tokens. The remaining gaps are: (a) 6 un-reskinned shared components that appear in the app shell and inside pages, (b) the #8B5CF6 AI purple color which has no theme token equivalent (11 total instances across 4 files), and (c) the landing page which intentionally uses its own design-system constants. The visual split between old and new is no longer a dominant issue — it's now limited to secondary UI elements.

## 2. AREAS AUDITED

**Global Shell:** Sidebar, AppShell, CommandPalette, theme toggle, quick actions, clock in
**Landing/Public/Auth:** /, /login, /register, /forgot-password, /reset-password, /login/2fa, /403
**Core Operational:** /service-writer/dashboard, /work-orders, /work-orders/new, /work-orders/[id], /shop-floor, /mechanic/dashboard, /floor-manager/dashboard, /tech
**Parts:** /parts, /parts/new, /parts/[id], /parts/queue, /parts/cores
**Shared Components:** DataTable, FilterBar, Pagination, PageControls, Toast, Skeletons, NotificationBell, RoleSwitcher, DateRangePicker, WOStepper, ai-text-input, OwnershipTypeBadge

## 3. CLEAN / READY AREAS

These screens are fully reskinned and visually consistent:

- Sidebar.tsx (0 hex)
- AppShell.tsx (0 hex)
- CommandPalette.tsx (0 hex)
- DataTable.tsx (0 hex)
- FilterBar.tsx (0 hex)
- Pagination.tsx (0 hex)
- PageControls.tsx (0 hex)
- Toast.tsx (0 hex)
- Skeletons.tsx (0 hex)
- /service-writer/dashboard (0 hex)
- /work-orders (0 hex)
- /work-orders/new (0 hex)
- /mechanic/dashboard (0 hex)
- /floor-manager/dashboard (0 hex)
- /parts (0 hex)
- /parts/new (0 hex)
- /parts/[id] (0 hex)
- /parts/queue (0 hex)
- /login (0 hex)
- /register (0 hex)
- /forgot-password (0 hex)
- /reset-password (0 hex)
- /login/2fa (0 hex)
- /403 (0 hex)

## 4. ISSUES FOUND

### P0 — High visibility, affects daily use

| # | Route/Component | Problem | Source File | Fix Type | Isolated? |
|---|---|---|---|---|---|
| 1 | NotificationBell (all pages) | 18 hardcoded hex, old dark palette | src/components/NotificationBell.tsx | Shared component reskin | Repeated on every page |
| 2 | RoleSwitcher (top bar) | 13 hardcoded hex, old palette | src/components/RoleSwitcher.tsx | Shared component reskin | Repeated on every page |

### P1 — Visible but secondary

| # | Route/Component | Problem | Source File | Fix Type | Isolated? |
|---|---|---|---|---|---|
| 3 | WOStepper (WO detail) | 12 hardcoded hex, old status colors | src/components/work-orders/WOStepper.tsx | Component reskin | WO detail page |
| 4 | ai-text-input (WO detail + others) | 14 hardcoded hex, light-mode Tailwind colors | src/components/ai-text-input.tsx | Component reskin | Multiple pages |
| 5 | OwnershipTypeBadge | 10 hardcoded hex, old badge colors | src/components/OwnershipTypeBadge.tsx | Component reskin | WO list + fleet pages |
| 6 | DateRangePicker | 12 hardcoded hex, old palette | src/components/DateRangePicker.tsx | Component reskin | Report/filter pages |

### P2 — Low priority / acceptable

| # | Route/Component | Problem | Source File | Fix Type | Isolated? |
|---|---|---|---|---|---|
| 7 | WO detail AI panel | 6x #8B5CF6 (purple) | src/app/work-orders/[id]/page.tsx | Unmatched — no theme token | Feature-specific |
| 8 | Shop floor / tech / cores | 5x #8B5CF6 total | Multiple files | Unmatched — no theme token | Feature-specific |
| 9 | Landing page | 13 hex values (own design constants) | src/app/page.tsx | Intentional — landing has own palette | Isolated |

## 5. UNMATCHED COLORS STILL PRESENT

| Color | Files | Count | Acceptable? |
|---|---|---|---|
| #8B5CF6 (AI purple) | work-orders/[id], shop-floor, tech, parts/cores | 11 | Yes — feature-specific AI accent, no theme token exists |
| Landing page colors (#1B6EE6, #e2e6ed, etc.) | src/app/page.tsx | 13 | Yes — landing page intentionally uses its own design constants, not the app theme |

## 6. FIRST FIX QUEUE

### Patch 1: SharedComponents_Reskin_Round2
- **Target:** src/components/NotificationBell.tsx, src/components/RoleSwitcher.tsx
- **Fix:** Replace 31 hardcoded hex with useTheme() tokens
- **Impact:** Fixes visual split on every authenticated page (these render in AppShell top bar)

### Patch 2: WOSubcomponents_Reskin
- **Target:** src/components/work-orders/WOStepper.tsx, src/components/ai-text-input.tsx
- **Fix:** Replace 26 hardcoded hex with theme tokens
- **Impact:** Fixes WO detail page visual split

### Patch 3: BadgeAndPicker_Reskin
- **Target:** src/components/OwnershipTypeBadge.tsx, src/components/DateRangePicker.tsx
- **Fix:** Replace 22 hardcoded hex with theme tokens
- **Impact:** Fixes badge and date picker visuals across fleet/WO/report pages

### Patch 4: AI_Purple_Token (optional)
- **Target:** src/lib/config/colors.ts (add aiAccent token), then 4 page files
- **Fix:** Add #8B5CF6 as a proper theme token, replace remaining 11 instances
- **Impact:** Eliminates last hardcoded hex from all core pages

### Patch 5: Remaining_Pages_Sweep
- **Target:** Audit remaining ~100 un-reskinned low-traffic pages
- **Fix:** Batch reskin of maintenance, settings, accounting, fleet detail pages
- **Impact:** Completes the full-app visual consistency

## 7. COUNTS

- **Audited areas:** 30 routes/components
- **Clean areas:** 24
- **P0 issues:** 2 (NotificationBell, RoleSwitcher)
- **P1 issues:** 4 (WOStepper, ai-text-input, OwnershipTypeBadge, DateRangePicker)
- **P2 issues:** 3 (AI purple unmatched, landing page intentional)
- **Total remaining hex in reskinned files:** 11 (#8B5CF6 only)
- **Total remaining hex in un-reskinned shared components:** 79
- **Build status:** Clean
