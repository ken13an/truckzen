# Prompt 008 -- Estimates & Customer Authorization

## Priority: HIGH
## Estimated time: 45-60 minutes
## Depends on: Prompt 004 (ROs), Prompt 006 (units)

---

## What To Do

1. Read .truckzen/TASKS/CC_RULES.md first.
3. Read .truckzen/TASKS/BRAND_GUIDE.md for all UI styling rules (colors, fonts, spacing, components).

## Build These

### 1. Generate Estimate from RO

On the RO Detail page (Tab 1: Overview), the "Create Estimate" button:
- Generates an estimate from the current RO lines
- Calls get_next_estimate_number() for the estimate number
- Creates estimates record + estimate_lines records (one per RO line)
- Each estimate line copies: complaint description, labor hours, labor rate, parts total
- Calculates: labor total, parts total, subtotal, tax, grand total
- Opens the estimate detail page

### 2. Estimate Detail Page: src/app/estimates/[id]/page.tsx

**Header:**
- Estimate number, status badge, date created
- Linked RO number (clickable)
- Customer name, email, phone

**Line Items Table:**
- Line #, Description, Labor Hours, Labor Rate, Labor Total, Parts Total, Line Total
- Each line has: Approve / Decline buttons (only visible if status = 'sent')
- Per-line authorization status badge

**Totals Section:**
- Labor subtotal, Parts subtotal, Subtotal, Tax, Grand Total

**Actions:**
- "Send to Customer" button --> sends via email (Resend) and optionally SMS
  - Email contains: estimate summary, line items, total, and a link to approve online
  - Sets status to 'sent', records sent_at
- "Mark as Approved" button (manual approval by service writer after phone call)
- "Mark as Declined" button
- "Edit" button (only if status = 'draft')
- "Void" button

### 3. Customer Approval Page: src/app/approve/[token]/page.tsx

A PUBLIC page (no auth required) where the customer can:
- See the estimate details (read-only)
- Approve or decline each line item individually
- Add their name as the approving authority
- Submit their response
- See a confirmation message

This page uses a unique token (UUID) stored on the estimate record. The token is included in the email link.

**On approval:**
- Update estimate status to 'approved' (or 'partially_approved' if some lines declined)
- Update each RO line's authorization_status to 'authorized' or 'declined'
- Update RO status to 'authorized' (if all lines approved) or 'waiting_authorization' (if partial)
- Record responded_at, approved_by

### 4. Estimates List Page: src/app/estimates/page.tsx

Table of all estimates:
- Estimate Number, RO Number, Customer, Total, Status, Sent Date, Response Date
- Filter tabs: All | Draft | Sent | Approved | Declined

### 5. API Routes

**src/app/api/estimates/route.ts**
- GET: list estimates
- POST: create estimate from RO

**src/app/api/estimates/[id]/route.ts**
- GET: estimate with lines
- PATCH: update status

**src/app/api/estimates/[id]/send/route.ts**
- POST: send estimate via email (use Resend)

**src/app/api/approve/[token]/route.ts**
- GET: get estimate details by token (public, no auth)
- POST: submit customer approval/decline (public, no auth)

### 6. Email Template

Create a clean HTML email template for the estimate:
- Shop name and logo
- Estimate number, date
- Customer name
- Line items table
- Total
- "Review & Approve" button (links to /approve/[token])
- Professional footer

Use Resend to send. Sender: no-reply@truckzen.pro

## Verification
- Creating estimate from RO works
- Estimate lines match RO lines
- Sending email works (check Resend dashboard)
- Customer approval page loads without auth
- Approving/declining updates RO line authorization status
- Estimate list page shows correct data

## After Task
Update .truckzen/DONE/ files per CC_RULES.md. Git commit and push.
