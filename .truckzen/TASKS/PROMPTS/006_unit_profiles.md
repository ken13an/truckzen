# Prompt 006 -- Unit/Vehicle Profiles with Service History

## Priority: HIGH
## Estimated time: 30-45 minutes
## Depends on: Prompt 002 (tables), Prompt 004 (ROs)

---

## What To Do

1. Read .truckzen/TASKS/CC_RULES.md first.
3. Read .truckzen/TASKS/BRAND_GUIDE.md for all UI styling rules (colors, fonts, spacing, components).

## Build These

### 1. Units List Page: src/app/units/page.tsx

Table showing all units for this shop.

**Top bar:** Title "Fleet Units", "Add Unit" button, search box
**Filter tabs:** All | Trucks | Trailers | Reefers

**Table columns:**
- Unit Number
- Type (truck/trailer/reefer icon + text)
- Year/Make/Model
- VIN (last 6 digits visible, hover for full)
- Customer (company name)
- Mileage (formatted with commas)
- Status (active/inactive badge)
- Last Service (date of most recent RO)
- Open ROs (count)

Click any row to go to /units/[id].

### 2. Unit Detail Page: src/app/units/[id]/page.tsx

**Header card:**
- Unit number (large), type badge
- Year Make Model (e.g., "2019 Peterbilt 579")
- VIN, license plate, DOT number
- Engine: make + model
- Current mileage / engine hours
- Owner: customer company name (linked to customer page)
- Status badge
- "Edit" button

**Tabs:**

**Tab 1: Service History**
- Timeline of all ROs for this unit, newest first
- Each entry shows: RO number, date, status, complaint summary, total cost
- Click to go to the RO detail page
- Shows total lifetime spend on this unit at the top

**Tab 2: Details**
- Editable form: all unit fields
- Save button

**Tab 3: Upcoming Maintenance**
- Placeholder for now (PM scheduling comes in Phase 3)
- Show message: "Preventive maintenance scheduling coming soon"

### 3. API Routes

**src/app/api/units/route.ts**
- GET: list units with filters, search, pagination
- POST: create new unit

**src/app/api/units/[id]/route.ts**
- GET: single unit with service history (join repair_orders)
- PATCH: update unit fields
- DELETE: soft delete (set status = 'inactive')

### 4. Navigation
Add "Fleet Units" to sidebar navigation under a "Fleet" section.

## Verification
- npm run build passes
- /units page lists units
- /units/[id] shows service history timeline
- Creating and editing units works
- Customer association works

## After Task
Update .truckzen/DONE/ files per CC_RULES.md. Git commit and push.
