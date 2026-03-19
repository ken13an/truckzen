# TruckZen -- Current Status

**Last Updated:** Not yet started
**Last Task Completed:** None
**Build Status:** UNKNOWN -- run npm run build to check
**Branch:** dev (all new work goes here -- main is the live site at truckzen.pro)

---

## Built (working in production)

- Multi-tenant SaaS architecture (shop isolation, RLS)
- Auth + role-based access (15 roles)
- Kiosk / QR check-in (Path A)
- Service Requests (from kiosk)
- Service Orders (basic structure with tabs)
- Mechanic Action Requests
- Ken superadmin panel
- Customer Portal (magic link login)
- Smart Drop (live at truckzen.pro/smart-drop)
- Customers page (1,482 imported from FullBay)
- DVIR screens (design only)
- Fleet module (design only)
- Telegram bot architecture (design only)
- AI Service Writer (design only)
- First-time setup wizard (design only)

## In Progress

- Nothing currently in progress

## Next Up

- Prompt 000: Brand redesign (apply brand book to entire existing app) -- DO THIS FIRST
- Prompt 001: Fix all build errors
- Prompt 002: Phase 1 mega SQL migration
- Prompt 003: Service Writer In-Person Check-in
- Prompt 004: Full Repair Orders with 3C Workflow
- Prompt 005: AI Service Writer
- Prompt 006: Unit/Vehicle Profiles
- Prompt 007: Technician Time Clock
- Prompt 008: Estimates & Authorization
- Prompt 009: Invoicing & Payment

## Known Issues

- Build may have errors in: security/index.ts, stripe/webhook, dvir/page.tsx, settings/users/new, resend.ts
- Customers page may have runtime error (null fields from FullBay import)
- Next.js may be at 14.2.0 with known security vulnerability
- These are all addressed in Prompt 001

## Database Tables

### Existing (already in Supabase)
- shops
- users
- customers
- service_requests
- service_orders (to be upgraded to repair_orders)

### Needed (created by Prompt 002)
- units
- repair_orders
- repair_order_lines
- time_entries
- parts
- ro_line_parts
- estimates
- estimate_lines
- invoices
- invoice_lines
- payments
- job_templates
- ai_usage_log
- ro_photos
- shop_sequences
