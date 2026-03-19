# TruckZen — Industry Research Notes

## Fullbay Service Order Workflow
- SO starts as an Estimate → converted to SO when tech assigned
- Customer + Vehicle selected from dropdowns, with history
- "Canned jobs" / global services auto-fill labor time and rates
- MOTOR integration provides standard labor times
- Parts added during estimate phase from inventory or marketplace (40+ vendors)
- Authorization step: estimate emailed/texted to fleet manager for approval
- Tech assignment converts estimate to SO
- Auto clock-in: every time tech opens SO, they're clocked in
- When all issues marked complete → invoice notification ping
- Invoice sent via text/email/customer portal
- AI features: clean up notes, voice-to-text, professional formatting
- Automated SO: checks PM schedules nightly, generates SOs for items due within 10 days
- DVIR integration (Whip Around): inspection defects → repair requests

## Tekmetric Repair Order Flow
- Job Board: 3 columns — Estimates / Work-In-Progress / Completed
- Custom color-coded labels per workflow step
- Service advisor dispatches ROs to technicians (or individual line items to different techs)
- Parts management: require POs for all parts, track assigned/inventory/returns
- Parts reassignment between jobs within an RO
- Technician can search/find parts themselves, not just through advisor

## Shop-Ware Digital Workflow
- Single screen dashboard with all active ROs
- Color-coded labels: service type, customer status, approval waiting
- Real-time notifications when ROs need attention
- Mobile/tablet task assignment from the bay
- Files transfer with RO when reassigned
- KPI tracking: billed hours, completion percentage
- TechApp for technician findings entry
- AI Parts Matrix for automated pricing

## Kiosk Best Practices
- Barcode scanning to minimize manual entry (VIN scanning)
- Simple step-by-step flow (hotel check-in analogy)
- Large touch targets for non-tech-savvy drivers
- QR code scan from cab as alternative to kiosk
- Automatic text message notifications and instructions
- Contact-free workflow preferred

## Shop Floor Board Patterns
- Kanban with drag-and-drop status changes
- Table view with sortable columns and group headers
- TV/Monitor view: large cards, auto-refresh, high contrast
- Color coding by priority and status universally
- Real-time updates across all views
- Filter by team, bay, mechanic, priority

## Telegram Bot Implementation
- Use Next.js API route as webhook endpoint
- Set webhook via Telegram API with secret token
- Parse incoming update JSON, extract message and sender
- Look up user by telegram_id in database
- Process intent with AI, execute action, reply with confirmation

## Key Design Decisions for TruckZen
1. SO lifecycle: Pending → Assigned → In Progress → Waiting Parts → Ready Inspection → Good to Go / Failed
2. Service Writer is primary SO creator (not "Service Advisor")
3. can_create_so permission for override access
4. Voice input → AI complaint/cause/correction generation
5. Parts auto-suggestion from inventory + knowledge base
6. Real-time notifications: in-app bell + Telegram
7. Shop Floor: Table + Kanban + TV Monitor (3 views)
8. Kiosk: 5-step flow with voice input and VIN scanning
9. All statuses color-coded consistently across all views
