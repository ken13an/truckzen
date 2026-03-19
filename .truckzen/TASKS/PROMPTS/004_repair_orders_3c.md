# Prompt 004 -- Full Repair Orders with 3C Workflow

## Priority: CRITICAL
## Estimated time: 60-90 minutes (this is the biggest single feature)
## Depends on: Prompt 002 (tables), Prompt 003 (service requests)

---

## What To Do

1. Read .truckzen/TASKS/CC_RULES.md first.
3. Read .truckzen/TASKS/BRAND_GUIDE.md for all UI styling rules (colors, fonts, spacing, components).
2. Read .truckzen/DONE/CURRENT_STATUS.md to confirm Prompts 002 and 003 are done.

## Context

Repair Orders are the core of TruckZen. Every dollar of revenue flows through an RO. The 3C workflow (Complaint/Cause/Correction) is the industry standard for heavy-duty truck repair. Fleet managers, insurance companies, and DOT auditors all expect this format.

An RO can be created from a Service Request (convert), or directly by a service writer.

## Build These

### 1. RO List Page: src/app/repair-orders/page.tsx

A table/list view showing all ROs for this shop.

**Top bar:**
- Title: "Repair Orders"
- "New Repair Order" button
- Filter tabs: All | Open | In Progress | Waiting | Completed | Invoiced

**Table columns:**
- RO Number (link to detail page)
- Status (colored badge)
- Priority (colored badge if high/urgent)
- Customer (company name)
- Unit (unit_number + year/make)
- Service Writer (name)
- Technician (name or "Unassigned")
- Created date
- Age (days since created, red if > 7 days)
- Total ($)

**Features:**
- Click any row to go to /repair-orders/[id]
- Search box (search by RO number, customer name, unit number)
- Sort by any column
- Pagination (25 per page)

### 2. New RO Page: src/app/repair-orders/new/page.tsx

A form to create a new RO. Similar to service request but more detailed.

**Customer + Unit Selection** (same pattern as Prompt 003 -- reuse components if possible)

**Initial Complaint Lines:**
- At least one complaint line is required
- Each line has: complaint text (required), estimated hours (optional), notes (optional)
- "Add Another Complaint" button to add more lines
- Each line can be removed (except the last one)

**Assignment:**
- Assign Service Writer dropdown (current user is default)
- Assign Technician dropdown (optional)
- Bay number (optional text input)
- Priority dropdown

**On Submit:**
- Call get_next_ro_number() function to generate RO number
- Create repair_orders record
- Create repair_order_lines records for each complaint
- Redirect to /repair-orders/[id]

### 3. RO Detail Page: src/app/repair-orders/[id]/page.tsx

This is the main workspace for a repair order. It has tabs:

**Tab 1: Overview**
- RO header: RO number, status badge, priority badge, created date, age
- Customer card: company name, contact, phone, email
- Unit card: unit_number, year/make/model, VIN, mileage
- Assignment: service writer, technician, bay
- Totals summary: labor total, parts total, tax, grand total
- Action buttons: "Create Estimate", "Complete RO", "Void RO"

**Tab 2: Complaint Lines (3C)**
- List of all complaint lines for this RO
- Each line shows:
  - Line number
  - Complaint text (always visible)
  - Cause text (editable -- this is where tech fills in what they found)
  - Correction text (editable -- this is where tech fills in what they did)
  - Authorization status badge
  - Assigned tech name
  - Estimated hours / Actual hours
  - Labor total / Parts total / Line total
  - Status badge
- "Add Complaint Line" button
- Each line is an expandable card -- click to expand and edit
- Save button per line (auto-save would be even better)
- NOTE: The AI Service Writer (Prompt 005) will add voice input here later. For now, cause and correction are manual text input.

**Tab 3: Parts**
- List of parts attached to this RO (grouped by complaint line)
- "Add Part" button per complaint line
  - Part search (search parts catalog by part number or description)
  - Quantity input
  - Prices auto-fill from parts catalog
  - Can also manually enter a part not in catalog
- Each part shows: part_number, description, qty, unit cost, unit sell, line total, status
- Remove part button

**Tab 4: Time Log**
- List of all time entries for this RO
- Shows: tech name, complaint line, clock in, clock out, hours, type
- If tech is currently clocked in: show live timer
- NOTE: Clock in/out buttons will be built in Prompt 005. For now, this is a read-only log.

**Tab 5: Photos**
- Grid of photos attached to this RO
- Upload button (uses Supabase Storage)
- Each photo shows: thumbnail, caption, photo type, who uploaded, when
- Click to view full size
- NOTE: This can be basic for now. Just upload and display.

**Tab 6: Notes & History**
- Internal notes (editable textarea)
- Customer notes (editable textarea)
- Activity log (auto-generated): "RO created by [writer]", "Line 2 cause updated by [tech]", "Status changed to in_progress", etc.

### 4. Convert Service Request to RO

On the service requests list page (/service-requests), add a "Convert to RO" button for each request that hasn't been converted yet.

When clicked:
- Create a new RO pre-filled with the service request's customer, unit, and complaint
- Set service_request_id on the RO
- Set converted_to_ro_id on the service request
- Change service request status to 'converted'
- Redirect to the new RO detail page

### 5. API Routes

Create these API routes:

**src/app/api/repair-orders/route.ts**
- GET: list ROs with filters (status, search, pagination)
- POST: create new RO (with lines)

**src/app/api/repair-orders/[id]/route.ts**
- GET: single RO with all relations (lines, parts, time entries, photos)
- PATCH: update RO fields (status, assignment, notes, totals)

**src/app/api/repair-orders/[id]/lines/route.ts**
- POST: add a complaint line
- PATCH: update a line (cause, correction, status, hours)
- DELETE: remove a line (soft delete by setting status = 'void')

**src/app/api/repair-orders/[id]/parts/route.ts**
- POST: add a part to a line
- DELETE: remove a part

**src/app/api/repair-orders/[id]/photos/route.ts**
- POST: upload a photo (use Supabase Storage)
- DELETE: remove a photo

### 6. Shared Components

Create reusable components in src/components/:
- CustomerSelector.tsx (search + select + create new -- reusable from Prompt 003)
- UnitSelector.tsx (same pattern)
- StatusBadge.tsx (colored badge for any status)
- PriorityBadge.tsx
- ROLineCard.tsx (expandable 3C complaint line card)

### 7. Navigation

Add "Repair Orders" to the main sidebar navigation if it doesn't exist already. It should be a top-level nav item.

## UI Rules
- Tailwind CSS only
- Mobile-responsive but optimized for desktop (service writers work on monitors)
- Clean tab navigation (not cramped)
- Tables should be sortable and searchable
- Loading skeletons while data fetches
- Toast notifications on save/error
- All money values formatted as $X,XXX.XX

## Verification

- npm run build passes clean
- /repair-orders page shows list of ROs (empty state if none)
- /repair-orders/new creates an RO with complaint lines
- /repair-orders/[id] shows all tabs with correct data
- Adding/editing complaint lines works
- Adding parts to lines works
- Convert from service request works
- RO number auto-generates correctly
- Multi-tenant isolation: only shows current shop's ROs

## After Task
Update .truckzen/DONE/ files per CC_RULES.md. Git commit and push.
