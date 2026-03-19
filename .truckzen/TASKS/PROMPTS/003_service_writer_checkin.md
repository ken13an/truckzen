# Prompt 003 -- Service Writer In-Person Check-in (Path B)

## Priority: CRITICAL
## Estimated time: 30-45 minutes
## Depends on: Prompt 002 (database tables must exist)

---

## What To Do

1. Read .truckzen/TASKS/CC_RULES.md first.
3. Read .truckzen/TASKS/BRAND_GUIDE.md for all UI styling rules (colors, fonts, spacing, components).
2. Read .truckzen/DONE/CURRENT_STATUS.md to confirm Prompt 002 is done.

## Context

TruckZen has two check-in paths. Path A (Kiosk/QR) already exists. This builds Path B: the service writer creates a Service Request on behalf of the customer during a face-to-face or phone conversation.

Both paths produce the exact same service_request record. The only difference is check_in_type = 'service_writer' and created_by = the writer's user ID.

## Build This

### Page: src/app/service-requests/new/page.tsx

A full-page form for the service writer to create a new Service Request. The form has these sections:

**Section 1: Customer Selection**
- Search box that searches existing customers by company name, contact name, or phone
- Results appear as you type (debounced 300ms)
- Click a customer to select them
- "New Customer" button that expands an inline form: company name, contact name, phone, email
- Selected customer shows as a card with their info

**Section 2: Unit Selection**
- Only appears after customer is selected
- Shows units already linked to this customer (from the units table)
- Each unit shows: unit_number, year/make/model, VIN
- Click to select
- "New Unit" button that expands: unit_number, year, make, model, VIN, unit_type dropdown, mileage
- If no units exist for this customer, show the new unit form automatically

**Section 3: Complaint Description**
- Large textarea for the service writer to type what the customer is describing
- Placeholder: "Describe the customer's complaint or reason for visit..."
- Priority dropdown: Low, Normal, High, Urgent (default: Normal)
- Check-in type is auto-set to 'service_writer'

**Section 4: Writer Notes**
- Textarea for internal notes (not visible to customer)
- Placeholder: "Internal notes for the shop team..."

**Submit Button: "Create Service Request"**
- On submit: creates the service_request record with check_in_type = 'service_writer' and created_by = current user
- If new customer was created, create customer first, then link
- If new unit was created, create unit first, then link
- After success: redirect to /service-requests with a success toast
- On error: show error message, don't lose the form data

### API Route: src/app/api/service-requests/route.ts

POST handler that:
- Validates all required fields
- Gets the authenticated user via Supabase auth
- Gets shop_id by querying the users table with the auth user's ID (NOT from JWT -- shop_id is not in standard Supabase JWT)
- If new_customer data is present, creates the customer first (include shop_id)
- If new_unit data is present, creates the unit first (linked to customer, include shop_id)
- Creates the service_request record (include shop_id, check_in_type, created_by)
- Returns the created service request

### Update: src/app/service-requests/page.tsx

The existing service requests list page should:
- Show a "New Service Request" button at the top that links to /service-requests/new
- Display the check_in_type for each request (show "Kiosk", "QR Code", or "Service Writer" as a badge)
- Show the created_by name if check_in_type is 'service_writer'

### UI Rules
- Use Tailwind CSS only
- Mobile-responsive (service writers often use tablets)
- Clean, professional, no clutter
- Form validation: customer and complaint are required, unit is optional but recommended
- Loading states on all buttons during submission

## Verification

- npm run build passes clean
- The /service-requests/new page renders without errors
- Form validation works (try submitting empty)
- Customer search returns results
- New customer creation works
- New unit creation works
- Service request is created in the database with correct check_in_type and created_by
- Redirect to /service-requests works after creation

## After Task
Update .truckzen/DONE/ files per CC_RULES.md. Git commit and push.
