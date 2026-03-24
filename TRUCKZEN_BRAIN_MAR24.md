# TRUCKZEN BRAIN — Full Handoff
## Session: March 24, 2026 (End of Day)
## Paste this at the start of any new chat to restore full context.

---

## WHO YOU ARE

Ken Agasiyev — non-technical entrepreneur and platform owner of TruckZen.
Email: kenanagasiyev@gmail.com
You run up to 4 Claude Code terminals simultaneously (CC1, CC2, CC3, CC4).
Claude writes all prompts as .md files. You paste them to CC terminals.
Claude never gives you manual steps — everything goes through CC prompts.

---

## WHAT IS TRUCKZEN

TruckZen is a multi-tenant SaaS shop management platform for semi-truck repair shops.
First customer: UGL Truck Center Inc, Montgomery IL.
Positioned to replace Fullbay ($15K/mo) and Fleetio for UGL.

**Live at:** https://truckzen.pro
**GitHub:** ken13an/truckzen
**Stack:** Next.js (App Router) + Supabase + Vercel Pro
**Mobile:** React Native + Expo (built, submitted to App Store and Play Store)
**Brand accent:** #1B6EE6 (Zen Blue)
**No emojis in code, docs, or projects. Ever.**

---

## STACK DETAILS

- Frontend: Next.js 16, Tailwind, Lucide icons
- Database: Supabase (PostgreSQL + RLS) — Pro plan, Medium compute
- Auth: Supabase Auth
- Hosting: Vercel Pro → truckzen.pro
- Email: Resend
- SMS/Calls: Twilio
- AI: Anthropic Claude API (AI Service Writer)
- Proxy: Railway (Fullbay static IP)
- Mobile: React Native + Expo, bundle ID com.truckzen.app

---

## CRITICAL RULES — NEVER BREAK THESE

1. **Deploy rule:** After every CC task → npm run build → git add . && git commit && git push → npx vercel --prod → wait 3 min → test on truckzen.pro. Git push alone = Preview only, NOT production.
2. **API pattern:** All data queries use two-client pattern. Session client (anon key) for auth. Service client (SERVICE_ROLE_KEY) for all data queries. Never query Supabase directly from client components.
3. **No manual steps:** Everything through CC prompts. No manual Supabase dashboard changes.
4. **Global fixes:** Every bug fix applied globally across entire app, never just the page where bug was found.
5. **Claude suggests, Ken approves:** Never add, remove, or change anything without Ken's explicit approval.
6. **CC prompt format:** Always .md files, two files per prompt (main + checklist), numbered verifications V1..VX, end with "DO NOT mark complete without V1 through VX."
7. **No hardcoding:** Never hardcode shop_id or any IDs.
8. **Wait rule:** When Ken says "wait" or "more coming" — do nothing until explicit go-ahead.

---

## SHOP DATA (UGL)

- shop_id: 1f927e3e-4fe5-431a-bb7c-dac77501e892
- Customers: 1,095
- Trucks/Assets: 4,107
- Parts: 12,954 (all source = fullbay)
- Work Orders: 30,823 (17,956 linked to trucks)
- Purchase Orders: 27,675
- PO Lines: 54,186
- Vendors: 144
- Total PO spend: $22,662,908
- Staff: 220 employees (not yet onboarded)
- Languages: EN, RU, UK, ES, UZ

---

## ACTIVE ROLES

1. Service Writer
2. Floor Manager
3. Mechanic
4. Accounting
5. Parts Manager
6. Parts Staff
7. Owner (Ken — kenanagasiyev@gmail.com, is_platform_owner=true)
8. Maintenance Team (future)

---

## ROLE ACCESS MATRIX

| Role | Modules | Payroll | Cost Price | Full Accounting | Maintenance |
|---|---|---|---|---|---|
| Owner | Everything | All | Yes | Yes | Yes |
| Accounting | Everything except maintenance | All | Yes | Yes | No |
| Floor Manager | WOs, floor, customers, parts, reports | Own mechanics | No | No | No |
| Service Writer | WOs, customers, parts, maintenance (read) | None | No | No | Read only |
| Parts Manager | Parts full, WOs, customers | Own parts staff | Yes | No | No |
| Parts Staff | Parts, WOs, customers | None | No | No | No |
| Mechanic | Dashboard, settings only | None | No | No | No |
| Maintenance Team | Maintenance, dashboard | None | No | No | Yes |

---

## DATA SOURCES

- Shop modules (WOs, parts, customers) → Fullbay ONLY
- Maintenance module → Fleetio ONLY
- NEVER mix them

---

## WHAT IS BUILT AND LIVE (truckzen.pro) — 179+ pages

### Core App
- Login, RBAC, multilingual (EN/RU/UK/ES/UZ)
- Kiosk — /kiosk/ugl, 9-screen flow, AI Service Writer, PIN auth, VIN decode
- Work Orders — full lifecycle, 5 tabs, AI job line splitting, 5-stage invoice workflow
- Service Orders — 4 tabs, kiosk → service requests flow
- Shop Floor — Kanban board
- Customers & Fleet — 1,095 customers, 4,107 trucks, unit profiles
- Parts — 12,954 parts, Vendors (144), Part History (54,186), Purchase Orders (27,675)
- Part detail page — full profile, edit mode, pricing, inventory
- Accounting — invoices, payroll (sidebar), reports
- Maintenance — 32 maint_* tables, 28+ pages (Fleetio replacement)
- Platform Admin — /platform-admin, 8 pages, shop management, impersonation
- Notifications — table, RLS, bell API, Supabase Realtime
- Time Clock — mechanics clock in/out
- Estimates — two-track (company trucks skip, OO/outside require approval)
- Invoicing — 5-stage workflow, Stripe integrated
- Smart Drop — CSV/XLSX bulk import
- Reports dashboard
- Public landing page — truckzen.pro
- Privacy policy + Terms of service

### Security (built and deployed March 24)
- Audit log table with 8 triggers on critical tables — VERIFIED LIVE
- Weekly + daily backup crons to Supabase Storage (backups + backups-offsite buckets)
- Rate limiting — 200 req/min per user on parts, WOs, customers
- Health check endpoint — truckzen.pro/api/health (HTTP 200 confirmed)
- Accounting + payroll APIs require auth (401)
- Platform admin restricted to owner only (403)
- RBAC fully implemented — per-role API filtering
- Parts cost price stripped from API for unauthorized roles
- Content Security Policy headers — frame-ancestors none, base-uri self, form-action self
- X-XSS-Protection, HSTS, referrer-policy, permissions-policy all set
- Kiosk rate limiting — 10 check-ins per IP per hour
- Session timeout — 8 hours inactivity
- Failed login lockout — 5 attempts, 15 min block (localStorage-based, server-side upgrade in progress)
- Deactivated user check — middleware signs out and redirects to /login?reason=account_disabled
- Immediate session invalidation for deactivated users
- UptimeRobot monitoring — truckzen.pro + /api/health every 5 min
- Single device session enforcement — new login invalidates all previous sessions, amber banner shown

### Performance (deployed March 24)
- 11 performance indexes applied to DB
- Parts and customers capped at 200 rows per request (was 2000)
- Realtime subscriptions scoped per-user (was global)
- Pagination added to 8 unbounded WO queries
- Caching on all 7 key routes with correct TTLs

### Infrastructure (upgraded March 24)
- Supabase compute: Nano → Medium (4GB RAM, 2-core ARM, $59/mo)
- PITR 7 days enabled ($100/mo)
- Daily physical backups confirmed (7 days rolling)
- DATABASE_URL fixed — direct connection working
- DATABASE_URL_POOLER — password correct, pooler endpoint issue (harmless, direct works)

### Mobile App
- React Native + Expo, 47+ files
- 4 roles: Mechanics, Floor Supervisors, Service Writers, Accounting
- Bundle ID: com.truckzen.app
- App icon: TZ logo — light rounded square, TZ bold dark, Zen Blue dot bottom-right of Z
- iOS build submitted to App Store Connect (App ID: 6761073593) — FAILED due to Xcode 16 SDK issue, CC1 fixing now
- Android build: .aab ready, waiting for Google Play account approval (submitted today, 1-3 day review)
- Google Play developer account: created today, pending Google review
- EAS account: ken13an, Starter plan ($29/mo)

### Marketing/Docs
- Investor deck V3 — 20 slides, Zen Blue brand
- Brand Book v1.1
- TruckZen Survival Guide (DOCX + PDF)
- Telematics pitch deck + business plan
- UGL Staff Roster Excel template (220 rows, dropdowns)
- App icon: TruckZen_AppIcon_1024.png, 512.png, 180.png — approved and in use

---

## WHAT IS IN PROGRESS RIGHT NOW (4 CCs running)

| Terminal | Task | Status |
|---|---|---|
| CC1 | Fix iOS build — update Expo SDK for Xcode 16 / iOS 18 SDK compatibility | Running |
| CC2 | Update operational costs in Platform Admin panel | Running |
| CC3 | Server-side login lockout — move from localStorage to Supabase DB | Running |
| CC4 | 2FA for Owner + Accounting roles (TOTP) | Running |

---

## WHAT IS NOT DONE YET

### Immediate (next session)
1. iOS App Store submission — submitted, processing at Apple (5-10 min), then TestFlight review
2. Android Play Store submission — waiting for Google Play account approval (1-3 days)
3. UGL staff onboarding — 220 employees still can't log in. Bulk import page at /settings/staff-import
4. Truck profile unified history tab — in-house vs outside, cost comparison

### Fixed this session (no longer outstanding)
- Vendors/Part History/PO tabs — fixed
- Part detail page click — fixed, opens /parts/[id]
- Payroll showing in accounting sidebar — fixed
- Accounting dashboard $0 — fixed
- Sidebar navigation glitch — fixed
- 2FA for Owner + Accounting — live
- Server-side login lockout — live
- Single device session enforcement — live

### Near-term
10. QuickBooks sync
11. Telegram bot
12. Fleetio data migration
13. Global smart filters across all list pages
14. Per-mechanic payroll reports
15. WO auto-pricing live test — code built, not tested with real WO
16. part_pricing_exceptions UI — per-part price override not built

### Business (Ken must do)
17. Sign agreement with UGL before charging them
18. LLC formation — Illinois, before charging money
19. D-U-N-S number for Organization Apple Developer account after LLC
20. Bulk fleet upload — holding company 1,500 trucks (clarify if already done)
21. UGL fuel report — needed to replace estimated gas savings in investor deck

### Future modules (code hidden from current roles)
22. Fleet Intelligence — 8 features (warranty tracking, fault codes, cost per mile, etc.)
23. Driver/DVIR module
24. Camera system — bay cameras + AI damage detection
25. Smart Shop — 360 camera tunnel concept
26. Samsara/Motive/Geotab telematics integration
27. TruckZen Telematics division (ELD + GPS + AI cameras — pitch deck built)
28. Smart Gas Station routing
29. Multi-tenant admin panel enhancements
30. 2FA — in progress (CC4)
31. Server-side login lockout — in progress (CC3)

---

## MONTHLY COSTS (updated March 24)

| Service | Cost |
|---|---|
| Vercel Pro | $20/mo |
| Supabase Pro + Medium compute | $84/mo |
| Supabase PITR 7 days | $100/mo |
| Railway (Fullbay proxy) | $5/mo |
| Resend (email) | $20/mo |
| Twilio (SMS + calls) | ~$68/mo variable |
| Claude API | ~$9/mo variable |
| Claude Max | ~$100/mo |
| ChatGPT Plus (Sora) | $20/mo |
| Apple Developer | ~$8/mo ($99/yr) |
| UptimeRobot Pro | $7/mo |
| Expo EAS Starter | $29/mo |
| **Total** | **~$470/mo** |

---

## PARTS MARGIN BY CUSTOMER TYPE

| Customer Type | Markup % | Margin % | Mode |
|---|---|---|---|
| Company Truck | 25% | 20% | Both |
| Owner Operator | 43% | 30% | Both |
| Outside Customer | 54% | 35% | Both |

---

## IMPORTANT TECHNICAL NOTES

- **DATABASE_URL:** Direct connection works. Pooler endpoint has auth issue — harmless, app uses REST API.
- **Supabase plan:** Pro + Medium compute. Connection pool: handled by PostgREST automatically.
- **DB latency:** ~290ms from Vercel edge — acceptable.
- **Audit log:** 8 triggers verified live on critical tables.
- **Backup buckets:** backups + backups-offsite both in Supabase Storage.
- **Session security:** Single device enforcement live. 2FA in progress.
- **.env.local:** Backed up to Apple Notes (locked) on Ken's Mac.

---

## MOBILE APP — APP STORE STATUS

- **iOS:** App ID 6761073593, Build 2, Version 1.0.0. Rejected — Xcode 16 SDK issue. CC1 fixing now.
- **Android:** .aab build ready. Google Play account pending review.
- **Apple Team ID:** 88R2SKR6Q4
- **Apple Provider ID:** 128698284
- **EAS project:** ken13an/truckzen

---

## BUSINESS CONTEXT

- UGL pays ~$15K/mo for Fullbay + Fleetio combined
- TruckZen pricing model: base fee + per user (exact prices TBD)
- Target: 50-100 shops at avg $1,500-2,000/mo = $75K-200K/mo revenue
- Immigrant-owned shop segment is key market (multilingual advantage)
- Apple Developer account: Individual (kenanagasiyev@gmail.com)
- LLC formation: Illinois, planned but not done yet — form before charging money

---

## REMINDERS FOR NEXT SESSION

1. Check CC1 output — iOS build fix, then resubmit to App Store
2. Check Google Play account approval — submit Android when approved
3. Remind Ken: sign agreement with UGL before charging them
4. Remind Ken: LLC formation Illinois before charging money
5. Remind Ken: UGL fuel report needed for investor deck
6. Remind Ken: decide if Maintenance module gets its own Accounting role
7. Tomorrow fixes queue: Vendors tab, Part History tab, PO tab, Part detail click, Payroll sidebar, Accounting $0, Sidebar glitch
8. Truck profile unified history tab still not built
9. Global smart filters still not built
10. Staff onboarding 220 UGL employees still pending
