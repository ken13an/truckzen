# TruckZen -- Current Status

**Last Updated:** 2026-03-20
**Last Task Completed:** Customer & Unit System Build
**Build Status:** PASS (Next.js 16.2.0, 101 pages, 0 errors)
**Branch:** dev (synced to main)

---

## What Is Built

### Core
- 101 pages, 40+ API routes
- Work Orders system (5-tab detail, AI job lines, mechanic assignment with percentage split)
- Customer system (profile with 5 tabs: fleet, WOs, contacts, billing, documents)
- Kiosk check-in (9-screen wizard, 4 languages, AI job line generation)
- Customer Portal (4-tab public page: status, estimate, pay, history)
- 10 seeded customers with 119 units and 16 contacts

### Database
- 30+ tables with RLS policies
- wo_parts, wo_job_assignments, customer_contacts, customer_documents tables
- shops: tax, labor rate, address, state/county
- assets: unit_type, warranty, ownership_type
- Duplicate WO prevention on API level

### Features
- 4 teams of mechanics (24 total) with skills
- Multi-language kiosk (EN/ES/RU/UZ) with Cyrillic Russian
- AI service writer (Claude API breaks concerns into professional job lines)
- Supabase Storage: wo-files, customer-docs buckets
- Resend email: invites, portal links, estimates
- Sentry error monitoring (configured, awaiting DSN)

### Remaining
- Unit profile page (/customers/[id]/units/[unitId])
- Downloadable registration form PDF
- Customer portal account-level view
- Invoicing + payments module
- Shop floor board
- Reports + analytics
