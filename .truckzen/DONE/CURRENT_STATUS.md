# TruckZen -- Current Status

**Last Updated:** 2026-03-20
**Last Task Completed:** Mechanic skills migration (in progress)
**Build Status:** PASS (Next.js 16.2.0, 101 pages, 0 errors)
**Branch:** dev (synced to main)

---

## What Is Built

### Core System
- 101 pages, 40+ API routes
- Work Orders: 5-tab detail (Overview, Parts, Estimate, Files & Notes, Activity), AI job lines, multi-mechanic assignment with % split
- Customers: profile with 5 tabs (Fleet, WOs, Contacts, Billing, Documents), 10 seeded customers with 119 units
- Kiosk: 9-screen check-in wizard, 4 languages (EN/ES/RU/UZ), voice input, AI job line generation
- Customer Portal: 4-tab public page (Status, Estimate, Pay, History) at /portal/[token]
- Homepage: public landing page at /
- User Management: team members page with edit/invite/disable/delete

### Database
- 30+ tables with RLS policies
- wo_parts, wo_job_assignments, customer_contacts, customer_documents tables
- shops: tax_rate 10.25%, default_labor_rate $105, state/county/address
- assets: unit_type (tractor + 6 trailer types), ownership_type, warranty fields
- so_lines: required_skills TEXT[] column added
- users: skills TEXT[], availability VARCHAR columns
- find_mechanics_by_skills() SQL function
- Duplicate WO prevention on API (work-orders + kiosk-checkin)

### Mechanics (28 total)
- 4 teams, each with 1 lead tech + 5 mechanics:
  - Heavy Engine: Viktor Petrov (lead) + 5
  - Brakes & Suspension: Sergei Kozlov (lead) + 5
  - Electrical & Diagnostics: Aleksandr Novak (lead) + 5
  - Body & Trailer: David Kim (lead) + 5
- Each mechanic has 3-5 skills matching their specialty
- Skills: Engine Repair, Brake Service, Electrical/Diagnostics, Transmission, Suspension, HVAC/AC, Tire Service, Body/Frame, Trailer Repair, Welding, DOT Inspection, Preventive Maintenance, Diesel Fuel Systems, Exhaust/Aftertreatment, Hydraulics

### Kiosk Features
- Validation: all required fields checked, concern min 10 chars + 3 words
- Languages: EN, ES (accented), RU (Cyrillic), UZ
- Submit: Loader2 spinner, email sent async (fire-and-forget)
- State persistence across back/forward navigation
- Trailer support in new unit form (7 types)
- Unit search triggers at 1 character

### Other
- Sentry configured (awaiting DSN)
- Supabase Storage: wo-files, customer-docs buckets
- Resend email: invites, portal links
- Sidebar: Lucide icons, correct order, Sign Out at bottom only
- Universal ChevronLeft back buttons on all deep pages

---

## In Progress (stopped mid-task)
- AI prompt update to return required_skills per job line (not started yet)
- Mechanic skills shown in assignment dropdown (partially done -- dropdown groups by team, shows skills)
- Smart skill-based suggestions in assignment modal (not started)

## Remaining
- Unit profile page (/customers/[id]/units/[unitId])
- Downloadable customer registration form PDF
- Customer portal account-level view (/portal/account/[token])
- Invoicing + payments module
- Shop floor board
- Reports + analytics
- Sentry DSN activation
