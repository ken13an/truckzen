# TruckZen -- Master Build Plan

## What TruckZen Is

Multi-tenant SaaS platform for semi truck repair shop management. USA market.
Platform owner: Ken Agasiyev (kenanagasiyev@gmail.com).
Each repair shop is an isolated tenant. Ken controls all shops from a platform dashboard.

---

## The Core Chain

Customer Arrives --> Check-in (Kiosk/QR OR Service Writer In-Person) --> Service Request --> Repair Order --> Estimate --> Authorization --> Work Assigned --> Tech Clocks In --> Parts Pulled --> Work Done --> Invoice --> Payment --> Closed

### Check-in Path A: Self-Service (Kiosk / QR Code)
Customer walks in or scans QR. They enter their own info, describe the issue, select their unit. No staff needed.

### Check-in Path B: Service Writer In-Person
Service writer talks to customer face-to-face, creates Service Request on their behalf. Traditional way.

Both paths create the same Service Request. Workflow is identical after that.

---

## Tech Stack

| Technology | Role | Status |
|---|---|---|
| Next.js 14.x (App Router) | Frontend + API routes | Active |
| Supabase (Postgres) | Database, Auth, Realtime, Storage | Active |
| Vercel | Hosting (truckzen.pro) | Active |
| Stripe | SaaS billing + payment processing | Active |
| Resend | Transactional emails | Active |
| Anthropic Claude API | AI engine (all AI features) | Planned |
| Twilio | SMS notifications | Planned |
| React-PDF | Invoice/estimate PDF generation | Planned |

---

## Role System (15 Roles)

Unlimited access: Owner, General Manager, IT Person
Scoped roles: Shop Manager, Service Writer, Floor Supervisor, Mechanic/Technician, Parts Manager, Parts Clerk, Fleet Manager, Accountant, Office Admin, Driver, Dispatcher
Platform: Ken (Platform Owner) -- all shops, all data, impersonation

Critical rule: Technicians can ONLY see their own team's jobs. Enforced at database RLS level.

---

## Phase 1 -- Core Workflow (The Money Chain)

Step 1: Service Writer In-Person Check-in (Path B)
Step 2: Full Repair Orders with 3C Workflow (Complaint/Cause/Correction)
Step 3: AI Service Writer (voice input any language --> professional English 3C)
Step 4: Unit/Vehicle Profiles with service history
Step 5: Technician Time Clock on RO lines
Step 6: Parts on RO lines with AI suggestion
Step 7: Estimates and Customer Authorization
Step 8: Invoicing and Payment

## Phase 2 -- Parts and Inventory

Step 9: Parts Catalog and Inventory tracking
Step 10: Vendor Management and Purchase Orders

## Phase 3 -- Fleet, DVIR, PM

Step 11: Fleet Management Module
Step 12: DVIR (mobile driver inspections)
Step 13: PM Scheduling + GPS integration

## Phase 4 -- Intelligence and AI Tools

Step 14: Dashboard with real KPIs
Step 15: Reports (revenue, tech productivity, aging, parts)
Step 16: Telegram Bot (@servicewriter)
Step 17: Canned Jobs / Templates
Step 18: Smart Drop enhancements

## Phase 5 -- Platform Level (Ken's Advantage)

Step 19: Ken's Platform Dashboard
Step 20: Shop Onboarding Flow
Step 21: Platform Analytics

---

## AI Strategy

One Anthropic API key in Vercel env vars. All shops go through Ken's key.
Claude is INSIDE TruckZen -- not a side tool. Shops see AI as native features.
Cost: ~$0.50-1.50/day per busy shop. Covered by $200-500/month subscription.

AI features:
- AI Service Writer: voice --> multilingual --> English 3C ($0.003-0.01/call)
- Telegram Bot: natural language shop commands ($0.001-0.005/call)
- Smart Drop: CSV/Excel column mapping ($0.02-0.05/import)
- Parts Suggestion: complaint-based part recommendations ($0.002-0.005/call)

---

## Competitive Advantages

- Multi-tenant SaaS (competitors are single-shop)
- Two check-in paths (competitors have zero self-service)
- AI Service Writer in any language (competitors: English manual typing only)
- Mechanic Action Requests (competitors: no in-app communication)
- Telegram bot (competitors: no messaging integration)
- Smart Drop AI import (competitors: rigid CSV templates)
- Mobile-first modern UI (competitors: desktop-only, dated)
- Platform owner dashboard (competitors: no platform layer)
