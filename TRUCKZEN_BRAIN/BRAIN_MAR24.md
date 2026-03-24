# TRUCKZEN BRAIN — Full Project Context
## Last Updated: March 24, 2026 (end of day)

---

## STACK
- Web: Next.js 16.2.0 with App Router + Turbopack (~/dev/truckzen/nextjs/src/)
- Mobile: React Native + Expo SDK 51 (~/dev/truckzen/mobile/)
- DB: Supabase (PostgreSQL + RLS) — project ref: tqjvyzpspcavdsqhweqo
- Hosting: Vercel → truckzen.pro
- Auth: Supabase Auth
- Service Role Pattern: ALL API routes use SERVICE_ROLE_KEY to bypass RLS

---

## CRITICAL DEPLOY RULE — NEVER SKIP
1. npm run build
2. git add . && git commit && git push
3. npx vercel --prod  ← MANDATORY. git push alone = Preview only, NOT truckzen.pro
4. Wait 2-3 min
5. Test on truckzen.pro

---

## ROOT CAUSE FOUND (March 24, 2026)
Client components querying Supabase with anon key = blocked by RLS = 0 data.
ALL data queries must go through API routes using service role key.
Pattern: `function db() { return createClient(SUPABASE_URL, SERVICE_ROLE_KEY) }`
25 pages were fixed in this session to use fetch('/api/...') instead of direct Supabase.

---

## CURRENT SHOP
- Name: UGL TRUCK CENTER
- shop_id: 1f927e3e-4fe5-431a-bb7c-dac77501e892
- Owner: kenanagasiyev@gmail.com

---

## DATA COUNTS (March 24, 2026)
- Parts: 12,954 (source = 'fullbay')
- Customers: 1,095
- Purchase Orders: 27,675
- PO Lines: 54,186
- Vendors: 144
- Total PO spend: $22,662,908.45
- Maintenance tables: 32 maint_* tables live
- Database indexes: 245 (11 new performance indexes added today)

---

## BRAND
- Accent: #1B6EE6 (Zen Blue)
- Dark theme: bg #060708, card #161B24, text #F0F4FF
- No teal anywhere
- No emojis in projects/apps/documents

---

## ACTIVE ROLES (14 total)
owner, gm, it_person, shop_manager, floor_manager, service_writer,
technician, lead_tech, parts_manager, accountant, office_admin,
maintenance_manager, maintenance_technician, dispatcher, driver

---

## TODAY'S SESSION — March 24, 2026 (12 commits)

### Critical Fix: Global RLS Bypass (d34a2a4)
- Root cause: client components using anon key → RLS blocked → 0 data
- Fixed 25 pages to route through API endpoints with service role key
- Pages fixed: dashboard, shop-floor, floor, accounting, invoices, work-orders/new,
  fleet, service-writer, tech, mechanic, parts sub-pages, settings, service-requests,
  customers/units
- Created /api/accounting route for accounting-specific WO query

### Parts Module Fixes
- Parts API column fix: reserved_qty→reserved, removed non-existent price_ugl_* columns (4a6c50b)
- Vendors tab: replaced "Coming Soon" with real data — 144 vendors (ca6262e)
- Part History tab: new /api/part-history route — 54,186 records (ca6262e)
- Purchase Orders tab: rewrote /api/purchase-orders — 27,675 POs (ca6262e)
- Stock status badges: In Stock (green), Low Stock (yellow), Out of Stock (red), On Order (blue) (a67b49f)
- Part detail page: fixed API auth so clicking a part opens its profile (b2544ba)

### Sidebar Fixes (a67b49f, 67baf2a)
- Replaced hardcoded getDeptAccess with dynamic function deriving from permissions.ts
- Settings link gated by role permission
- Sidebar RLS fix: permissions/counts now via API routes
- Created /api/settings/role-permissions and /api/settings/user-overrides routes

### RBAC — Role-Based Access Control (7733fd3, 67baf2a)
- Created src/lib/roleAccess.ts with 14 roles and capability flags:
  canSeeCustomerData, canSeePayroll, canSeePartsCostPrice,
  canSeeWOFinancials, canSeeFullAccounting, canSeeMaintenance, canSeePlatformAdmin
- Added floor_manager role to permissions.ts and middleware.ts
- API protection: /api/accounting and /api/accounting/payroll now require auth (were open)
- /api/accounting/payroll: department-filtered for floor_manager (mechanics only) and parts_manager (parts staff only)
- /api/parts GET: strips cost_price/average_cost/margin for unauthorized roles
- Parts page: useEmployeePermission hides costs with *** for restricted roles

### Parts Margin by Customer Type (7733fd3)
- Added parts_margin_pct, parts_markup_pct, parts_pricing_mode to shop_labor_rates
- Seeded defaults: fleet 25% markup, owner-op 43%, outside 54%
- Settings page: Parts Pricing section with mode selector, inputs, live formula preview
- WO auto-pricing: sourcing from inventory calculates sell price by customer type

### Security Hardening (919976e, 0bbeb7e, 09de63a, 7cb6185)
- Session auto-logout: 8 hours of inactivity → sign out → /login?expired=1
- Failed login lockout: 5 attempts → 15 minute lock with countdown
- Account disable check: is_active=false → force logout → /login?reason=account_disabled
- Single-device session: login on new device invalidates all previous sessions
  - UUID session_token saved to users table + httpOnly cookie
  - Middleware validates every 60 seconds (cached)
  - Mismatch → sign out → /login?reason=session_replaced
- Rate limiting: /api/customers, /api/parts, /api/work-orders
- Health check: /api/health returns DB connection status + latency
- Audit log triggers migration file ready
- Backup cron route at /api/admin/backup

### Staff Management (bc7d3c9)
- Staff bulk import: upload Excel, create Supabase auth accounts, send invites
- /settings/staff-import page with drag-and-drop UI
- /api/staff/import and /api/staff/template routes
- src/lib/parseStaffFile.ts for Excel parsing

### Infrastructure
- In-memory cache utility: src/lib/cache.ts (used by vendors, labor-rates, role-permissions)
- Kiosk rate limiting: src/lib/kioskRateLimit.ts
- Performance indexes: 11 new indexes on service_orders, parts, customers, assets, invoices, users, notifications, audit_log, so_lines
- DATABASE_URL_POOLER added to Vercel production env
- Mobile dashboard API: /api/mobile/dashboard

---

## WHAT'S BUILT (live on truckzen.pro)

### Service Department
- Dashboard, Work Orders (30,818), Shop Floor, Service Requests

### Parts Department
- Dashboard, Parts Queue, Inventory (12,954 parts with stock badges)
- Core Parts, Reorder with auto-PO creation
- Vendors tab (144 vendors), Part History (54,186 records), Purchase Orders (27,675 POs)
- Stock status badges: In Stock / Low Stock / Out of Stock / On Order

### Fleet
- Fleet list, Unit detail with Overview + Full History tab
- History: unified in-house + outside repairs with cost comparison
- Customers (1,095), Service Requests

### Maintenance
- 28+ pages (road repairs, drivers, PM schedules, inspections, fuel, vendors, etc.)
- All maint_* tables indexed

### Accounting
- Dashboard (ready to invoice, outstanding, revenue)
- Invoices, Reports, Payroll (/accounting/payroll)
- Parts pricing by customer type (margin/markup settings)

### Admin & Security
- Platform Admin: multi-tenant control panel (owner only)
- Permissions panel: /settings/permissions with department tabs + toggles
- Session management: 8h timeout, single-device enforcement, failed login lockout
- Account disable check in middleware
- RBAC: 14 roles with data-level visibility (roleAccess.ts)

### Settings
- Shop info, Tax, Labor rates, Parts pricing, Kiosk mode
- Staff bulk import (Excel upload)
- Branding, Notifications, Integrations, Billing

---

## WHAT WAS BROKEN → NOW FIXED (March 24)
1. Parts inventory 0 → FIXED (12,954 via API route)
2. Vendors tab "Coming Soon" → FIXED (144 vendors)
3. Part History "Coming Soon" → FIXED (54,186 records)
4. Purchase Orders "Coming Soon" → FIXED (27,675 POs)
5. Payroll not in sidebar → FIXED (added to Accounting section)
6. Part detail page redirect → FIXED (API auth fix)
7. Accounting dashboard $0 → FIXED (dedicated /api/accounting route)
8. Sidebar navigation glitch → FIXED (dynamic getDeptAccess from permissions.ts)
9. Customer detail page freeze → FIXED (removed redundant 500-WO fetch)
10. 25 pages showing 0 data → FIXED (global RLS bypass via API routes)
11. Accounting/payroll APIs open to anyone → FIXED (auth + role checks added)

---

## WHAT STILL NEEDS WORK
1. DATABASE_URL password — direct Postgres connection works, pooler connection fails (may need pooler enabled in Supabase dashboard)
2. Audit log triggers — migration file ready, not yet applied
3. part_pricing_exceptions — table exists but no frontend UI for per-part overrides
4. WO auto-pricing — wired but needs live testing
5. Mobile PNG assets — no icon/splash images
6. Maintenance module pages — still query Supabase directly (no API routes for maint_* tables)

---

## NEXT QUEUE
1. Geofence: auto check-in when truck enters shop
2. Data migration: 1,500 trucks bulk upload
3. Per-mechanic payroll reports
4. Global smart filters (In Stock, status, date range, search)
5. Camera system: bay cameras + inspection
6. AI Service Writer: text first, voice premium
7. Fleetio integration for maintenance
8. Custom role builder (enterprise)

---

## RULES
- No manual steps ever — everything through CC
- No hardcoding IDs
- Every fix applied globally — never local
- Claude suggests, Ken approves — never assume
- When Ken says "wait" or "more coming" — do nothing until green light
- CC prompts = .md files, verification steps V1..VX
- NEVER mark complete without all verifications passing
- ALWAYS run npx vercel --prod after git push

---

## DATA SOURCES
- Maintenance module → Fleetio ONLY
- Shop modules → Fullbay ONLY
- Never mix them

---

## KEY FILE LOCATIONS
- Role access config: src/lib/roleAccess.ts
- Permission system: src/lib/permissions.ts
- Permission definitions: src/lib/permissionDefinitions.ts
- Sidebar: src/components/Sidebar.tsx
- Middleware: middleware.ts
- Auth helpers: src/lib/auth.ts (client), src/lib/supabase/server.ts (server)
- Cache utility: src/lib/cache.ts
- Session API: src/app/api/auth/session/route.ts
- Health check: src/app/api/health/route.ts
- Brain files: TRUCKZEN_BRAIN/
