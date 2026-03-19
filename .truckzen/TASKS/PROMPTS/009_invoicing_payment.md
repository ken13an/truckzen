# Prompt 009 -- Invoicing & Payment

## Priority: HIGH
## Estimated time: 45-60 minutes
## Depends on: Prompt 004 (ROs), Prompt 008 (estimates)

---

## What To Do

1. Read .truckzen/TASKS/CC_RULES.md first.
3. Read .truckzen/TASKS/BRAND_GUIDE.md for all UI styling rules (colors, fonts, spacing, components).

## Build These

### 1. Generate Invoice from Completed RO

On the RO Detail page, when status = 'completed', show a "Create Invoice" button:
- Calls get_next_invoice_number()
- Creates invoices record with snapshots of customer/unit info
- Creates invoice_lines from RO lines:
  - Labor lines: description from complaint, qty = actual_hours, unit_price = labor_rate
  - Parts lines: one per part used, qty and prices from ro_line_parts
  - Shop supplies line (configurable percentage of labor, e.g., 3%)
  - Environmental fee (flat fee from shop settings)
- Calculates tax based on shop's tax_rate
- Calculates grand total
- Updates RO status to 'invoiced'
- Redirects to invoice detail page

### 2. Invoice Detail Page: src/app/invoices/[id]/page.tsx

**Header:**
- Invoice number, status badge, date, due date
- Linked RO number
- Customer: name, address, email, phone
- Unit: description (year make model, unit number)

**Line Items Table:**
- Type icon (wrench for labor, box for parts, etc.)
- Description, Quantity, Unit Price, Total, Taxable (yes/no)

**Totals:**
- Labor subtotal, Parts subtotal, Shop supplies, Environmental fee
- Subtotal, Tax (rate + amount), Grand Total
- Amount Paid, Balance Due (highlighted if > 0)

**Payment Section:**
- "Record Payment" button opens a modal:
  - Amount (defaults to balance due)
  - Payment method dropdown: Cash, Check, Credit Card, Debit Card, ACH, Wire, Fleet Account
  - Reference number (check number, transaction ID)
  - Date (defaults to today)
  - Notes
  - Save button
- Payment history list below: date, amount, method, reference, recorded by

**Actions:**
- "Send Invoice" button (email via Resend + optional SMS)
- "Print / PDF" button (generate PDF for printing)
- "Void Invoice" button
- "Record Payment" button

### 3. Invoice List Page: src/app/invoices/page.tsx

Table of all invoices:
- Invoice Number, RO Number, Customer, Total, Paid, Balance, Status, Date, Due Date
- Filter tabs: All | Draft | Sent | Partial | Paid | Overdue
- Overdue tab auto-calculates based on due_date < now AND balance > 0
- Color coding: red for overdue, green for paid, yellow for partial

### 4. PDF Generation

Install react-pdf if not already installed:
```bash
npm install @react-pdf/renderer
```

Create src/lib/pdf/invoice-pdf.tsx:
- Professional invoice layout
- Shop name/address at top
- Customer billing info
- Unit info
- Line items table
- Totals section
- Payment terms
- Footer with shop contact info

Create API route src/app/api/invoices/[id]/pdf/route.ts:
- Generates PDF using react-pdf
- Returns PDF as downloadable file

### 5. Invoice Email Template

Similar to estimate email:
- Invoice number, date, due date
- Line items summary
- Total due
- "Pay Now" button (links to Stripe payment page or /pay/[token])
- Payment terms reminder

### 6. API Routes

**src/app/api/invoices/route.ts**
- GET: list invoices with filters
- POST: create invoice from RO

**src/app/api/invoices/[id]/route.ts**
- GET: invoice with lines and payments
- PATCH: update status

**src/app/api/invoices/[id]/send/route.ts**
- POST: send via email

**src/app/api/invoices/[id]/payments/route.ts**
- GET: list payments for this invoice
- POST: record a payment (updates invoice amount_paid, balance_due, status)

## Verification
- Creating invoice from RO works with correct calculations
- Invoice lines include labor, parts, supplies, fees
- Tax calculation is correct
- Recording payment updates balance correctly
- Status changes: draft -> sent -> partial -> paid
- PDF generates and downloads
- Email sends successfully
- Invoice list filters work

## After Task
Update .truckzen/DONE/ files per CC_RULES.md. Git commit and push.
