# TRUCKZEN BRAIN — Full Project Context
## Last Updated: March 24, 2026

---

## STACK
- Web: Next.js (~/dev/truckzen/nextjs/src/)
- Mobile: React Native + Expo (~/dev/truckzen/mobile/)
- DB: Supabase (PostgreSQL + RLS)
- Hosting: Vercel → truckzen.pro
- Auth: Supabase Auth

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
Two-client pattern required in every API route:
1. Session client (anon key) → authenticate user
2. Service client (SERVICE_ROLE_KEY) → query data, bypasses RLS

---

## CURRENT SHOP
- Name: UGL TRUCK CENTER
- shop_id: 1f927e3e-4fe5-431a-bb7c-dac77501e892
- Owner: kenanagasiyev@gmail.com

---

## DATA COUNTS (March 24, 2026)
- Parts: 12,954 (all source = 'fullbay')
- Customers: 1,095
- Purchase Orders: 27,675
- PO Lines: 54,186
- Vendors: 144
- Total PO spend: $22,662,908.45
- Maintenance tables: 32 maint_* tables live

---

## BRAND
- Accent: #1B6EE6 (Zen Blue)
- No teal anywhere
- No emojis in projects/apps/documents

---

## ACTIVE ROLES
1. Service Writers
2. Floor Managers
3. Mechanics
4. Accounting

---

## WHAT'S BUILT (live on truckzen.pro)
- Service: Dashboard, Work Orders, Shop Floor
- Parts: Dashboard, Parts Queue, Inventory (12,954), Core Parts, Purchase Orders
- Fleet: Dashboard, Service Requests, Customers
- Maintenance: 28+ pages
- Accounting: Dashboard, Invoices, Reports, Payroll
- Platform Admin: Multi-tenant control panel
- Notifications: Table, RLS, bell API
- shop_labor_rates: 3 tiers ($95/$105/$125)
- employee_permissions: Table ready
- Soft delete: deleted_at on 12 tables, /trash page
- Mechanic intelligence: idle alerts, unplanned jobs, reports
- Parts workflow: pricing tiers, line items, submit/ready flow

---

## WHAT'S BROKEN (as of March 24, 2026)
1. Vendors tab — 144 vendors exist, not showing
2. Part History tab — 54,186 lines exist, not showing
3. Purchase Orders tab — 27,675 POs exist, not showing
4. Payroll — page exists but not in sidebar on live site
5. Part detail page — clicking part redirects back to inventory
6. Accounting dashboard — shows $0
7. Sidebar navigation glitch — some items highlight wrong

---

## TOMORROW QUEUE
1. Fix vendors, part history, PO tabs
2. Fix part detail page click
3. Fix Payroll in accounting sidebar
4. Fix accounting dashboard $0
5. Fix sidebar navigation globally
6. Truck profile unified history tab (in-house vs outside)
7. Global smart filters (In Stock, status, date range, search)
8. Geofence feature — auto check-in when truck enters shop
9. Data migration — 1,500 trucks bulk upload
10. Per-mechanic payroll reports

---

## RULES
- No manual steps ever — everything through CC
- No hardcoding IDs
- Every fix applied globally — never local
- Claude suggests, Ken approves — never assume
- When Ken says "wait" or "more coming" — do nothing until green light
- Always search past chats before writing CC prompts
- CC prompts = .md files, two files per prompt (main + checklist)
- Verification steps V1..VX, never mark complete without all passing

---

## DATA SOURCES
- Maintenance module → Fleetio ONLY
- Shop modules → Fullbay ONLY
- Never mix them

---

## FUTURE FEATURES
- Geofence: auto check-in, auto clock-in, fleet tracking, customer notifications
- Camera system: bay cameras + inspection system, AI damage detection
- AI Service Writer: text first, voice as premium
- Fleetio integration for maintenance
- Per-mechanic performance reports
- Custom role builder (enterprise)
