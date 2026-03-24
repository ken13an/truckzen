# TRUCKZEN BRAIN — Full Project Context
## Last Updated: March 24, 2026 (final update)

---

## STACK
- Web: Next.js 16.2.0 with App Router + Turbopack (~/dev/truckzen/nextjs/src/)
- Mobile: React Native + Expo SDK 51 (~/dev/truckzen/mobile/)
- DB: Supabase (PostgreSQL + RLS) — project ref: tqjvyzpspcavdsqhweqo
- Hosting: Vercel → truckzen.pro
- Auth: Supabase Auth + TOTP 2FA (otplib)
- SMS: Twilio
- Email: Resend
- AI: Anthropic Claude API
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
25+ pages fixed in this session to use fetch('/api/...') instead of direct Supabase.

---

## CURRENT SHOP
- Name: UGL TRUCK CENTER
- shop_id: 1f927e3e-4fe5-431a-bb7c-dac77501e892
- Owner: kenanagasiyev@gmail.com
- Staff: 220 employees (not yet onboarded)

---

## DATA COUNTS (March 24, 2026)
- Parts: 12,954 (source = 'fullbay')
- Customers: 1,095
- Trucks/Assets: 4,107
- Work Orders: 30,823
- Purchase Orders: 27,675
- PO Lines: 54,186
- Vendors: 144
- Total PO spend: $22,662,908
- Database indexes: 245 (11 new performance indexes added today)
- Maintenance tables: 32 maint_* tables live

---

## BRAND
- Accent: #1B6EE6 (Zen Blue)
- Dark theme: bg #060708, card #161B24, text #F0F4FF
- No teal anywhere
- No emojis in projects/apps/documents

---

## ALL ROLES (16 total)
owner, gm, it_person, shop_manager,
service_manager, parts_manager, floor_manager, accounting_manager, maintenance_manager, fleet_manager,
service_writer, technician, lead_tech, maintenance_technician,
accountant, office_admin, dispatcher, driver

---

## ROLE ACCESS MATRIX

| Role | Modules | Payroll | Cost Price | Full Accounting | Maintenance |
|---|---|---|---|---|---|
| Owner | Everything | All | Yes | Yes | Yes |
| Accounting Manager | WOs, invoices, customers, parts, fleet, accounting, reports, billing | All | Yes | Yes | No |
| Accountant | Dashboard, invoices, accounting, reports | All | Yes | Yes | No |
| Service Manager | WOs, invoices, customers, parts, floor, kiosk, reports | Own team | No | No | No |
| Floor Manager | WOs, floor, customers, fleet, parts, reports | Own mechanics | No | No | No |
| Parts Manager | Parts full, WOs, floor | Own parts staff | Yes | No | No |
| Service Writer | WOs, floor, customers, parts | None | No | No | No |
| Mechanic (technician) | Floor, parts, time tracking, tech mobile | None | No | No | No |
| Maintenance Manager | Floor, parts, fleet, maintenance, reports | Own team | No | No | Yes |
| Fleet Manager | Fleet, drivers, maintenance, reports | None | No | No | Read |

---

## TODAY'S SESSION — March 24, 2026 (20+ commits)

### Critical Fix: Global RLS Bypass
- Root cause: client components using anon key → RLS blocked → 0 data
- Fixed 25+ pages to route through API endpoints with service role key
- Created /api/accounting, /api/vendors, /api/part-history, /api/purchase-orders routes

### Parts Module Fixes
- Parts API column fix: reserved_qty→reserved, removed non-existent price columns
- Vendors tab: 144 vendors with parts count
- Part History tab: 54,186 records with search + pagination
- Purchase Orders tab: 27,675 POs with line counts
- Stock status badges: In Stock (green), Low Stock (yellow), Out of Stock (red), On Order (blue)
- Part detail page: fixed API auth

### Sidebar Overhaul
- Replaced hardcoded getDeptAccess with dynamic function from permissions.ts
- Settings link gated by role permission
- All sidebar data fetches via API routes

### RBAC — Full Role-Based Access Control
- Created src/lib/roleAccess.ts with 16 roles and capability flags
- Added service_manager and accounting_manager roles
- floor_manager added to permissions.ts and middleware.ts
- API protection: /api/accounting and /api/accounting/payroll require auth
- /api/accounting/payroll: department-filtered (floor_manager→mechanics, parts_manager→parts staff)
- /api/parts GET: strips cost fields for unauthorized roles
- Invite dropdown: grouped into Management / Department Managers / Staff

### Parts Margin by Customer Type
- Added parts_margin_pct, parts_markup_pct, parts_pricing_mode to shop_labor_rates
- Seeded defaults: fleet 25% markup, owner-op 43%, outside 54%
- Settings page: Parts Pricing section with mode selector, inputs, live formula preview
- WO auto-pricing: sourcing from inventory calculates sell price by customer type

### Security Hardening
- Session auto-logout: 8 hours of inactivity → sign out → /login?expired=1
- Failed login lockout: 5 attempts → 15 minute lock (server-side via login_attempts table)
- Account disable check: is_active=false → force logout
- Single-device session enforcement: UUID token, 60s cache, mismatch = signout
- TOTP 2FA for Owner/Accounting roles (otplib + QR code setup)
- Rate limiting on parts, customers, WO APIs
- CSP headers, HSTS, X-XSS-Protection
- Kiosk rate limiting: 10 check-ins per IP per hour
- Health check: /api/health

### Record Payment on Invoices
- invoice_payments table with method, amount, reference, date, notes
- Enhanced modal: Cash/Zelle/Card/Bank Transfer/Check + amount + reference + date picker
- Partial payment support: status = 'partial' until fully paid
- Payment history section on invoice detail sidebar

### Per-Mechanic Reports
- /reports/mechanics page with summary cards + sortable table
- Period filter: This Week / This Month / Last Month / Custom
- Productivity score per mechanic (jobs/hours ratio)
- Click row for individual mechanic job detail
- Export CSV button

### Customer Notifications
- SMS via Twilio when WO marked good_to_go (unit number, WO #, shop phone)
- Email already existed via truckReadyEmail
- /api/notifications/customer-ready: standalone endpoint with duplicate prevention
- sms_opted_out and email_opted_out columns on customers table

### Truck Profile History Tab
- Unified in-house + outside repairs timeline
- Cost comparison bar: In-House % vs Outside %
- Role-based cost hiding (mechanics see ***)
- Search, source filter, pagination

### Staff Management
- Staff bulk import: upload Excel, create auth accounts, send invites
- Team Members page redesigned with departments, filters, pagination
- /settings/staff-import with drag-and-drop

### Infrastructure
- In-memory cache: src/lib/cache.ts
- 245 database indexes
- DATABASE_URL_POOLER in Vercel production
- Supabase Medium compute (4GB RAM, 2-core ARM)
- PITR 7 days enabled
- UptimeRobot monitoring
- Audit log triggers migration ready
- Backup cron routes

---

## WHAT'S BUILT (live on truckzen.pro) — 180+ pages

### Service Department
- Dashboard, Work Orders (30,823), Shop Floor, Service Requests, Kiosk

### Parts Department
- Dashboard, Parts Queue, Inventory (12,954 with stock badges)
- Core Parts, Reorder with auto-PO
- Vendors (144), Part History (54,186), Purchase Orders (27,675)

### Fleet
- Fleet list, Unit detail with Overview + Full History tab
- History: unified in-house + outside, cost comparison bar
- Customers (1,095), Service Requests

### Maintenance
- 28+ pages (road repairs, drivers, PM, inspections, fuel, vendors, etc.)

### Accounting
- Dashboard, Invoices with Record Payment + payment history
- Payroll (/accounting/payroll), Reports
- Parts pricing by customer type (margin/markup)

### Reports
- Mechanic reports with productivity scores, CSV export

### Admin & Security
- Platform Admin (owner only)
- Permissions panel: /settings/permissions
- 2FA: TOTP setup + QR code for Owner/Accounting
- Session: 8h timeout, single-device, failed login lockout
- Account disable in middleware

### Settings
- Shop info, Tax, Labor rates, Parts pricing
- Staff bulk import, Team members with departments
- Kiosk mode, Branding, 2FA Security section

---

## WHAT WAS BROKEN → NOW FIXED (March 24)
1. Parts inventory 0 → 12,954 via API route
2. Vendors "Coming Soon" → 144 vendors
3. Part History "Coming Soon" → 54,186 records
4. Purchase Orders "Coming Soon" → 27,675 POs
5. Payroll not in sidebar → added
6. Part detail redirect → fixed API auth
7. Accounting dashboard $0 → dedicated API route
8. Sidebar glitch → dynamic getDeptAccess
9. Customer detail freeze → removed redundant fetch
10. 25 pages showing 0 → global RLS bypass
11. Accounting/payroll APIs open → auth + role checks
12. floor_manager ghost role → added to permissions + middleware

---

## WHAT STILL NEEDS WORK
1. DATABASE_URL_POOLER — pooler endpoint auth issue (direct connection works, app uses REST API)
2. Audit log triggers — migration file ready, not yet applied via SQL editor
3. part_pricing_exceptions — table exists but no frontend UI
4. WO auto-pricing — wired but needs live testing
5. Mobile PNG assets — no icon/splash images
6. Maintenance pages — still query Supabase directly (no API routes for maint_* tables)
7. iOS App Store — build failed (Xcode 16 SDK issue, CC1 fixing)
8. Android Play Store — waiting for Google account approval
9. Staff onboarding — 220 UGL employees not yet imported
10. QuickBooks sync — not started
11. Telegram bot — not started
12. Fleetio data migration — not started

---

## NEXT QUEUE
1. Fix iOS build + resubmit to App Store
2. Submit Android when Google Play approved
3. UGL staff onboarding (220 employees)
4. Geofence: auto check-in when truck enters shop
5. Global smart filters across all list pages
6. Per-mechanic payroll reports (beyond productivity — actual pay)
7. QuickBooks integration
8. Fleetio data migration
9. Camera system + AI damage detection
10. AI Service Writer: text first, voice premium
11. Custom role builder (enterprise)

---

## MONTHLY COSTS
| Service | Cost |
|---|---|
| Vercel Pro | $20/mo |
| Supabase Pro + Medium compute | $84/mo |
| Supabase PITR 7 days | $100/mo |
| Railway (Fullbay proxy) | $5/mo |
| Resend (email) | $20/mo |
| Twilio (SMS + calls) | ~$68/mo |
| Claude API | ~$9/mo |
| Claude Max | ~$100/mo |
| Apple Developer | ~$8/mo |
| UptimeRobot Pro | $7/mo |
| Expo EAS Starter | $29/mo |
| **Total** | **~$450/mo** |

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
- 2FA API: src/app/api/auth/2fa/route.ts
- Login API: src/app/api/auth/login/route.ts
- Invoice payments API: src/app/api/invoice-payments/route.ts
- Mechanic reports API: src/app/api/reports/mechanics/route.ts
- Customer ready API: src/app/api/notifications/customer-ready/route.ts
- Health check: src/app/api/health/route.ts
- Brain files: TRUCKZEN_BRAIN/
- Root brain: TRUCKZEN_BRAIN_MAR24.md

---

## RULES
- No manual steps — everything through CC prompts
- No hardcoding IDs
- Every fix applied globally
- Claude suggests, Ken approves
- When Ken says "wait" — do nothing until green light
- CC prompts = .md files, V1..VX verifications
- NEVER mark complete without all verifications passing
- ALWAYS run npx vercel --prod after git push
- git push alone = Preview only, NOT production

---

## DATA SOURCES
- Shop modules (WOs, parts, customers) → Fullbay ONLY
- Maintenance module → Fleetio ONLY
- Never mix them
