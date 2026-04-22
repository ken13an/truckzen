# Design Reskin Mismatch Audit
Generated: 2026-04-11

## 1. SUMMARY

The app is visually split. Only 13 out of 164 page files use theme tokens (useTheme/THEME). The remaining ~151 pages still use hardcoded hex colors from the old palette (#060708, #0D0F12, #F0F4FF, #48536A, etc.). The reskinned pages (sidebar, AppShell, service dashboard, landing page) look correct with the new navy-dark design, but nearly every other page still renders with the old color scheme. Shared components are partially migrated — 15 shared components use useTheme, but 17 component files still contain hardcoded hex.

## 2. TOTAL PAGE COUNT

- **Total page.tsx files:** 164
- **Pages using theme tokens:** 13 (7.9%)
- **Pages with hardcoded hex:** ~151 (92.1%)
- **Component files with hardcoded hex:** 17
- **Component files using theme tokens:** 15

## 3. RESKIN-COMPLIANT PAGES

These pages use useTheme() or THEME tokens and appear compliant:

- src/app/service-writer/dashboard/page.tsx (Phase 3 reskin)
- src/app/dashboard/page.tsx (uses useTheme)
- src/app/work-orders/page.tsx (uses useTheme)
- src/app/customers/page.tsx (uses useTheme)
- src/app/accounting/page.tsx (uses useTheme)
- src/app/fleet/page.tsx (uses useTheme)
- src/app/maintenance/page.tsx (uses useTheme)
- src/app/settings/page.tsx (uses useTheme)
- src/app/admin/shops/page.tsx (uses useTheme)
- src/app/admin/shops/[id]/page.tsx (uses useTheme)
- src/app/admin/migrate/page.tsx (uses useTheme)
- src/app/admin/audit-log/page.tsx (uses useTheme)
- src/app/admin/data-requests/page.tsx (uses useTheme)
- src/app/page.tsx (landing page — uses THEME constants directly)
- src/components/Sidebar.tsx (Phase 2 reskin)
- src/components/AppShell.tsx (Phase 2 reskin)
- src/components/CommandPalette.tsx (uses THEME.dark)

## 4. LIKELY-MISMATCHED PAGES

### P0 — High visibility, actively used

| Path | Why mismatched | Scope |
|------|----------------|-------|
| src/app/work-orders/[id]/page.tsx | Massive file, heavy hardcoded hex throughout | Page-wide |
| src/app/work-orders/new/page.tsx | Hardcoded hex colors | Page-wide |
| src/app/shop-floor/page.tsx | Hardcoded hex, old palette | Page-wide |
| src/app/parts/page.tsx | Hardcoded hex | Page-wide |
| src/app/parts/queue/page.tsx | Hardcoded hex | Page-wide |
| src/app/tech/page.tsx | Hardcoded hex, mechanic-facing | Page-wide |
| src/app/mechanic/dashboard/page.tsx | Hardcoded hex | Page-wide |
| src/app/floor-manager/dashboard/page.tsx | Hardcoded hex | Page-wide |
| src/app/service-requests/page.tsx | Hardcoded hex | Page-wide |
| src/app/login/page.tsx | Auth page, first screen for new users | Page-wide |

### P1 — Common secondary screens

| Path | Why mismatched | Scope |
|------|----------------|-------|
| src/app/parts/[id]/page.tsx | Part detail, hardcoded hex | Page-wide |
| src/app/parts/cores/page.tsx | Hardcoded hex | Page-wide |
| src/app/parts/new/page.tsx | Hardcoded hex | Page-wide |
| src/app/parts/reorder/page.tsx | Hardcoded hex | Page-wide |
| src/app/parts/wo/[id]/page.tsx | Hardcoded hex | Page-wide |
| src/app/customers/[id]/page.tsx | Customer detail, hardcoded hex | Page-wide |
| src/app/customers/new/page.tsx | Hardcoded hex | Page-wide |
| src/app/customers/[id]/units/[unitId]/page.tsx | Hardcoded hex | Page-wide |
| src/app/fleet/[id]/page.tsx | Asset detail, hardcoded hex | Page-wide |
| src/app/fleet/new/page.tsx | Hardcoded hex | Page-wide |
| src/app/fleet/compliance/page.tsx | Hardcoded hex | Page-wide |
| src/app/fleet/service-requests/page.tsx | Hardcoded hex | Page-wide |
| src/app/invoices/[id]/page.tsx | Invoice detail, hardcoded hex | Page-wide |
| src/app/reports/page.tsx | Hardcoded hex | Page-wide |
| src/app/reports/mechanics/page.tsx | Hardcoded hex | Page-wide |
| src/app/trash/page.tsx | Hardcoded hex | Page-wide |
| src/app/smart-drop/page.tsx | Hardcoded hex | Page-wide |
| src/app/time-tracking/page.tsx | Hardcoded hex | Page-wide |
| src/app/service-requests/new/page.tsx | Hardcoded hex | Page-wide |
| src/app/accounting/payroll/page.tsx | Hardcoded hex | Page-wide |
| src/app/accounting/payroll/punch-report/page.tsx | Hardcoded hex | Page-wide |
| src/app/accounting/history/page.tsx | Hardcoded hex | Page-wide |
| src/app/settings/users/page.tsx | Hardcoded hex | Page-wide |
| src/app/settings/users/new/page.tsx | Hardcoded hex | Page-wide |
| src/app/settings/permissions/page.tsx | Hardcoded hex | Page-wide |
| src/app/settings/billing/page.tsx | Hardcoded hex | Page-wide |
| src/app/settings/import/page.tsx | Hardcoded hex | Page-wide |
| src/app/settings/export/page.tsx | Hardcoded hex | Page-wide |
| src/app/settings/staff-import/page.tsx | Hardcoded hex | Page-wide |
| src/app/settings/bulk-skills/page.tsx | Hardcoded hex | Page-wide |

### P2 — Low-traffic admin/edge/maintenance screens

| Path | Why mismatched |
|------|----------------|
| src/app/maintenance/dashboard/page.tsx | Hardcoded hex |
| src/app/maintenance/invoices/page.tsx | Hardcoded hex |
| src/app/maintenance/[id]/page.tsx | Hardcoded hex |
| src/app/maintenance/new/page.tsx | Hardcoded hex |
| src/app/maintenance/activity/page.tsx | Hardcoded hex |
| src/app/maintenance/equipment/page.tsx + /new | Hardcoded hex |
| src/app/maintenance/warranties/page.tsx + /new | Hardcoded hex |
| src/app/maintenance/warranty-review/page.tsx | Hardcoded hex |
| src/app/maintenance/inspections/page.tsx + [id] + /new | Hardcoded hex |
| src/app/maintenance/pm/page.tsx + [id] + /new | Hardcoded hex |
| src/app/maintenance/purchase-orders/page.tsx + [id] + /new | Hardcoded hex |
| src/app/maintenance/repairs/page.tsx + [id] + /new | Hardcoded hex |
| src/app/maintenance/drivers/page.tsx + [id] + /new | Hardcoded hex |
| src/app/maintenance/vendors/page.tsx + [id] + /new | Hardcoded hex |
| src/app/maintenance/fuel/page.tsx + /new | Hardcoded hex |
| src/app/maintenance/recalls/page.tsx + [id] + /new | Hardcoded hex |
| src/app/maintenance/issues/page.tsx + [id] + /new | Hardcoded hex |
| src/app/maintenance/faults/page.tsx + [id] + /new | Hardcoded hex |
| src/app/maintenance/reports/page.tsx | Hardcoded hex |
| src/app/maintenance/documents/page.tsx | Hardcoded hex |
| src/app/maintenance/map/page.tsx | Hardcoded hex |
| src/app/maintenance/service-requests/page.tsx | Hardcoded hex |
| src/app/maintenance/parts/page.tsx + /new | Hardcoded hex |
| src/app/maintenance/meters/new/page.tsx | Hardcoded hex |
| src/app/maintenance/expenses/new/page.tsx | Hardcoded hex |
| src/app/maintenance/places/page.tsx + /new | Hardcoded hex |
| src/app/maintenance/contact-renewals/page.tsx + /new | Hardcoded hex |
| src/app/maintenance/vehicle-renewals/page.tsx + /new | Hardcoded hex |
| src/app/maintenance/service-programs/page.tsx + /new | Hardcoded hex |
| src/app/maintenance/service-reminders/page.tsx + /new | Hardcoded hex |
| src/app/maintenance/shop-network/page.tsx + /new | Hardcoded hex |
| src/app/maintenance/maint-parts/page.tsx | Hardcoded hex |
| src/app/maintenance/parts-lifecycle/page.tsx | Hardcoded hex |
| src/app/platform-admin/page.tsx | Hardcoded hex |
| src/app/platform-admin/shops/page.tsx | Hardcoded hex |
| src/app/platform-admin/autobots/page.tsx | Hardcoded hex |
| src/app/platform-admin/costs/page.tsx | Hardcoded hex |
| src/app/platform-admin/ai-usage/page.tsx | Hardcoded hex |
| src/app/platform-admin/registrations/page.tsx | Hardcoded hex |
| src/app/platform-admin/impersonate/page.tsx | Hardcoded hex |
| src/app/platform-admin/activity/page.tsx | Hardcoded hex |
| src/app/platform-admin/test-results/page.tsx | Hardcoded hex |
| src/app/admin/roles-guide/page.tsx | Hardcoded hex |
| src/app/admin/permissions/page.tsx | Hardcoded hex |
| src/app/admin/progress/page.tsx | Hardcoded hex |
| src/app/kiosk/page.tsx + [code] | Hardcoded hex |
| src/app/kiosk-admin/page.tsx | Hardcoded hex |
| src/app/cleaning/page.tsx | Hardcoded hex |
| src/app/floor/page.tsx | Hardcoded hex |
| src/app/setup/page.tsx | Hardcoded hex |
| src/app/register/page.tsx | Hardcoded hex |
| src/app/forgot-password/page.tsx | Hardcoded hex |
| src/app/reset-password/page.tsx | Hardcoded hex |
| src/app/waiting/page.tsx | Hardcoded hex |
| src/app/offline/page.tsx | Hardcoded hex |
| src/app/portal/page.tsx + [token] + estimate/[token] | Hardcoded hex |
| src/app/pay/[token]/page.tsx + success | Hardcoded hex |
| src/app/dvir/page.tsx | Hardcoded hex |
| src/app/api-docs/page.tsx | Hardcoded hex |
| src/app/terms/page.tsx | Hardcoded hex |
| src/app/privacy/page.tsx | Hardcoded hex |
| src/app/support/page.tsx | Hardcoded hex |
| src/app/login/2fa/page.tsx | Hardcoded hex |
| src/app/403/page.tsx | Hardcoded hex |

## 5. NEEDS MANUAL VISUAL CHECK

| Path | Uncertainty |
|------|-------------|
| src/app/floor-manager/quick-view/page.tsx | Uses hex but may be intentionally distinct layout |
| src/app/floor-manager/quick-assign/page.tsx | Same |
| src/app/compliance/page.tsx | May be a redirect or thin wrapper |
| src/app/orders/new/page.tsx | Known redirect to /work-orders/new |
| src/app/drivers/page.tsx + [id] + /new | May share maintenance styling |

## 6. SHARED COMPONENT RISKS

Components still containing hardcoded hex that are imported across many pages:

| Component | Impact | Hex count |
|-----------|--------|-----------|
| src/components/DataTable.tsx | Used by most list pages | High |
| src/components/FilterBar.tsx | Used on list pages | Medium |
| src/components/NotificationBell.tsx | Rendered in AppShell for all users | Medium |
| src/components/RoleSwitcher.tsx | Rendered in AppShell | Medium |
| src/components/KioskFlow.tsx | Kiosk-specific, large file | Isolated |
| src/components/Toast.tsx | App-wide | Medium |
| src/components/Logo.tsx | Used in sidebar + landing | Low (intentional brand colors) |
| src/components/DateRangePicker.tsx | Used on reporting pages | Medium |
| src/components/Pagination.tsx | Used on list pages | Medium |
| src/components/Skeletons.tsx | Loading states everywhere | Medium |
| src/components/work-orders/WOStepper.tsx | WO detail page | Isolated |
| src/components/ai-text-input.tsx | AI input fields | Medium |
| src/components/OwnershipTypeBadge.tsx | Used on WO/fleet pages | Low |
| src/components/ui/SourceBadge.tsx | Source indicators | Low |
| src/components/ui/PageControls.tsx | Page controls | Medium |

## 7. FIRST FIX QUEUE

### Patch 1: SharedComponents_Reskin
- **Target:** DataTable.tsx, FilterBar.tsx, Pagination.tsx, Toast.tsx, Skeletons.tsx
- **Fix:** Replace hardcoded hex with useTheme() tokens
- **Impact:** Fixes visual split on every list/table page at once

### Patch 2: WorkOrders_Reskin
- **Target:** src/app/work-orders/[id]/page.tsx, src/app/work-orders/new/page.tsx
- **Fix:** Replace hardcoded hex with useTheme() tokens
- **Impact:** Most-used pages in the app

### Patch 3: ShopFloor_Mechanic_Reskin
- **Target:** src/app/shop-floor/page.tsx, src/app/tech/page.tsx, src/app/mechanic/dashboard/page.tsx, src/app/floor-manager/dashboard/page.tsx
- **Fix:** Replace hardcoded hex with useTheme() tokens
- **Impact:** All shop-floor-facing screens

### Patch 4: Parts_Reskin
- **Target:** src/app/parts/page.tsx, src/app/parts/[id]/page.tsx, src/app/parts/queue/page.tsx, src/app/parts/cores/page.tsx, src/app/parts/new/page.tsx
- **Fix:** Replace hardcoded hex with useTheme() tokens
- **Impact:** Entire parts department

### Patch 5: Auth_Public_Reskin
- **Target:** src/app/login/page.tsx, src/app/login/2fa/page.tsx, src/app/register/page.tsx, src/app/forgot-password/page.tsx, src/app/reset-password/page.tsx
- **Fix:** Replace hardcoded hex with useTheme() tokens or consistent public styling
- **Impact:** First-impression screens for all users

## 8. COUNTS

- **Compliant pages:** ~17 (including components)
- **Likely-mismatched pages:** ~146
- **Manual-check pages:** 5
