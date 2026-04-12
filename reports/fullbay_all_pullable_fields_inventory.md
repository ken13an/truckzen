# Fullbay All Pullable Fields — Complete Source Inventory

**Patch:** Fullbay_14_all_pullable_fields
**Date:** 2026-04-04
**Type:** Read-only source inventory
**Source:** backups/patch93g_fullbay_data.json (28,460 records)

## Source Coverage Summary

| Metric | Count | % |
|--------|-------|---|
| Total records | 28,460 | 100% |
| With parts (partsTotal > 0) | 24,225 | 85.1% |
| With labor (laborTotal > 0) | 24,665 | 86.7% |
| With tax | 2,876 | 10.1% |
| With shop supplies | 22,816 | 80.2% |
| With misc charges | 10,403 | 36.6% |
| With technician name | 28,395 | 99.8% |
| With createdBy name | 28,460 | 100% |
| With QuickBooks ID | 13,740 | 48.3% |
| With multiple complaints | 15,834 | 55.6% |
| Total complaints | 78,319 | — |
| Total corrections | 78,292 | — |
| **Total part line items** | **181,205** | — |

---

## A. SERVICE ORDER / WORK ORDER HEADER

| Field | Payload Path | Example | Proven | Imported to TZ |
|-------|-------------|---------|--------|---------------|
| SO primary key | `so.primaryKey` | "4355478" | YES | YES (fullbay_id) |
| Repair order number | `so.repairOrderNumber` | "3583" | YES | YES (so_number) — **NOTE: may be Fullbay invoice#, not SO#** |
| Technician | `so.technician` | "Luis Enrique" | YES | NO |
| Technician number | `so.technicianNumber` | "" | YES | NO |
| Parts manager | `so.partsManager` | "" | YES | NO |
| Description | `so.description` | "" | YES | YES (complaint) |
| Submitter contact | `so.submitterContact` | "Uchqun" | YES | NO |
| Submitter email | `so.submitterContactEmail` | null | YES | NO |
| Submitter phone | `so.submitterContactPhone` | null | YES | NO |
| Authorizer contact | `so.authorizerContact` | "Farhod Muhsinov" | YES | NO |
| Authorizer phone | `so.authorizerContactCellPhone` | "(331) 472-9631" | YES | NO |
| Billing customer | `so.billingCustomer` | "HTS" | YES | NO |
| Unit access method | `so.unitAccessMethod` | "Customer will bring unit..." | YES | NO |
| Unit available date | `so.unitAvailableDateTime` | "2021-04-12 08:30:00" | YES | NO |
| Unit return ASAP | `so.unitReturnAsap` | "Yes" | YES | NO |
| Authorization # | `so.authorizationNumber` | "" | YES | NO |
| PO number | `so.poNumber` | "" | YES | NO |
| Parts PO number | `so.partsPoNumber` | "36577749" | YES | NO |
| Hot/priority | `so.hot` | "No" | YES | YES (priority) |
| Customer threshold | `so.customerThreshold` | 2436.8 | YES | NO |
| Pre-authorized | `so.preAuthorized` | "Yes" | YES | NO |
| Labor hours total | `so.laborHoursTotal` | 10 | YES | NO (only labor_total $) |
| Actual hours total | `so.actualHoursTotal` | 5.7 | YES | NO |
| Labor total ($) | `so.laborTotal` | 850 | YES | YES (labor_total) |
| Parts cost total | `so.partsCostTotal` | 1099.72 | YES | NO |
| Parts sell total | `so.partsTotal` | 1352.37 | YES | YES (parts_total) |
| Supplies override | `so.overrideSuppliesTotal` | "No" | YES | NO |
| All parts priced date | `so.allPartsPricedDateTime` | "2021-04-12 09:43:35" | YES | NO |
| Start date | `so.startDateTime` | "2021-04-12 08:33:33" | YES | NO |
| Completion date | `so.completionDateTime` | "2021-04-12 18:12:15" | YES | YES (completed_at) |
| Created by | `so.createdByTechnician` | "Ian Plata" | YES | NO |
| Created date | `so.created` | "2021-04-12 08:11:13" | YES | YES (created_at) |

## B. COMPLAINT / CORRECTION / JOB STRUCTURE

| Field | Payload Path | Example | Proven | Imported to TZ |
|-------|-------------|---------|--------|---------------|
| Complaint primary key | `Complaint.primaryKey` | 10998431 | YES | NO |
| Complaint type | `Complaint.type` | "Complaint" | YES | NO |
| Complaint note | `Complaint.note` | "Coolant leak problem" | YES | PARTIAL (first complaint → so.complaint) |
| Complaint cause | `Complaint.cause` | "Customer request" | YES | NO |
| Complaint severity | `Complaint.severity` | " - " | YES | NO |
| Complaint authorized | `Complaint.authorized` | "Yes" | YES | NO |
| Labor rate name | `Complaint.laborRate` | "United customers" | YES | NO |
| Labor hours total | `Complaint.laborHoursTotal` | 2 | YES | PARTIAL (first → so_lines.estimated_hours) |
| Actual hours total | `Complaint.actualHoursTotal` | 1.74 | YES | PARTIAL (first → so_lines.actual_hours) |
| Labor total ($) | `Complaint.laborTotal` | 170 | YES | PARTIAL (first → so_lines.unit_price) |
| Parts cost total | `Complaint.partsCostTotal` | 41.81 | YES | NO |
| Parts sell total | `Complaint.partsTotal` | 53.09 | YES | NO |
| Supplies total | `Complaint.suppliesTotal` | — | YES (at invoice level) | NO |
| Created date | `Complaint.created` | "2021-04-12 08:11:13" | YES | NO |
| Assigned technicians | `Complaint.AssignedTechnicians[]` | [{technician: "Rafael Luna", actualHours: 1.74}] | YES | NO |
| Correction primary key | `Correction.primaryKey` | "9891284" | YES | NO |
| Correction recommended | `Correction.recommendedCorrection` | "Coolant leak problem" | YES | PARTIAL (first → so_lines.resolution) |
| Correction actual | `Correction.actualCorrection` | "Replaced 2 heater core hoses" | YES | NO |
| Correction performed | `Correction.correctionPerformed` | "Performed" | YES | NO |
| Correction labor hours | `Correction.laborHoursTotal` | 2 | YES | NO |
| Correction labor total | `Correction.laborTotal` | 170 | YES | NO |
| Correction parts cost | `Correction.partsCostTotal` | 41.81 | YES | NO |
| Correction parts sell | `Correction.partsTotal` | 53.09 | YES | NO |
| Correction taxable | `Correction.taxable` | "No" | YES | NO |

## C. LABOR DETAIL

| Field | Payload Path | Example | Proven | Imported to TZ |
|-------|-------------|---------|--------|---------------|
| Per-complaint labor hours | `Complaint.laborHoursTotal` | 2 | YES | PARTIAL (1st only) |
| Per-complaint actual hours | `Complaint.actualHoursTotal` | 1.74 | YES | PARTIAL (1st only) |
| Per-complaint labor $ | `Complaint.laborTotal` | 170 | YES | PARTIAL (1st only) |
| Labor rate name | `Complaint.laborRate` | "United customers" | YES | NO |
| Per-correction labor hours | `Correction.laborHoursTotal` | 2 | YES | NO |
| Per-correction labor $ | `Correction.laborTotal` | 170 | YES | NO |
| Assigned tech name | `AssignedTechnicians[].technician` | "Rafael Luna" | YES | NO |
| Assigned tech actual hours | `AssignedTechnicians[].actualHours` | 1.74 | YES | NO |
| Assigned tech portion % | `AssignedTechnicians[].portion` | 100 | YES | NO |

## D. PARTS DETAIL — 181,205 part line items available

| Field | Payload Path | Example | Proven | Imported to TZ |
|-------|-------------|---------|--------|---------------|
| Part primary key | `Part.primaryKey` | "14680703" | YES | NO |
| Part description | `Part.description` | "HOSE - HEATER" | YES | **NO** |
| Shop part number | `Part.shopPartNumber` | "05-32664-000" | YES | **NO** |
| Vendor part number | `Part.vendorPartNumber` | "05-32664-000" | YES | **NO** |
| Quantity | `Part.quantity` | 1 | YES | **NO** |
| Cost price | `Part.cost` | 12.83 | YES | **NO** |
| Sell price | `Part.sellingPrice` | 16.29 | YES | **NO** |
| Sell price overridden | `Part.sellingPriceOverridden` | "No" | YES | NO |
| Taxable | `Part.taxable` | "Yes" | YES | NO |
| Inventory flag | `Part.inventory` | "Yes" | YES | NO |
| Core type | `Part.coreType` | "" | YES | NO |
| Sublet flag | `Part.sublet` | "No" | YES | NO |
| QuickBooks item | `Part.quickBooksItem` | "Part" | YES | NO |
| Created date | `Part.created` | "2021-04-12 11:39:36" | YES | NO |

## E. INVOICE HEADER

| Field | Payload Path | Example | Proven | Imported to TZ |
|-------|-------------|---------|--------|---------------|
| Invoice primary key | `inv.primaryKey` | "4012957" | YES | NO |
| Invoice number | `inv.invoiceNumber` | "2389" | YES | **NO** (TZ uses INV-FB-{RO#} instead) |
| Invoice date | `inv.invoiceDate` | "2021-04-13" | YES | YES (created_at) |
| Due date | `inv.dueDate` | "2021-04-13" | YES | NO |
| Exported flag | `inv.exported` | "1" | YES | NO |
| Customer title | `inv.customerTitle` | "HTS Logistics" | YES | NO (linked via customer_id) |
| Customer billing employee | `inv.customerBillingEmployee` | "Uchqun" | YES | NO |
| Customer billing email | `inv.customerBillingEmail` | "" | YES | NO |
| Shop title | `inv.shopTitle` | "Oswego Truck Center" | YES | NO |
| Shop email | `inv.shopEmail` | "accounting..." | YES | NO |
| Shop physical address | `inv.shopPhysicalAddress` | "3485 State Route..." | YES | NO |
| Misc charge total | `inv.miscChargeTotal` | 0 | YES | NO |
| Service call total | `inv.serviceCallTotal` | 0 | YES | NO |
| Mileage total | `inv.mileageTotal` | 0 | YES | NO |
| Parts total | `inv.partsTotal` | 1352.37 | YES | YES (via so.partsTotal) |
| Labor hours total | `inv.laborHoursTotal` | 10 | YES | NO |
| Labor total | `inv.laborTotal` | 850 | YES | YES (via so.laborTotal) |
| Sublet labor total | `inv.subletLaborTotal` | null | YES | NO |
| **Supplies total** | `inv.suppliesTotal` | **68** | **YES** | **NO** |
| Subtotal | `inv.subTotal` | 2270.37 | YES | YES (subtotal) |
| Tax title | `inv.taxTitle` | "Local" | YES | NO |
| Tax rate | `inv.taxRate` | "8.5" | YES | YES (via mapInvoice) |
| Tax total | `inv.taxTotal` | 102.98 | YES | YES (tax_amount) |
| Total | `inv.total` | 2373.35 | YES | YES (total) |
| Balance | `inv.balance` | 0 | YES | YES (→ amount_paid derived) |
| QuickBooks ID | `inv.quickBooksId` | "27849" | YES | NO |
| Promise to pay date | `inv.promiseToPayDate` | "" | YES | NO |
| Created by | `inv.createdByTechnician` | "Omar Montes" | YES | NO |
| Created date | `inv.created` | "2021-04-13 13:41:16" | YES | NO |
| Tax line detail | `inv.TaxInformation.TaxLineInformation[]` | [{taxTitle, taxRate, taxTotal}] | YES | NO |

## F. INVOICE LINE-LEVEL

Invoice payloads do NOT contain direct line items. All line detail must be reconstructed from the nested `ServiceOrder.Complaints[].Corrections[].Parts[]` structure. Labor lines come from `Complaints[]` directly. Shop supplies exist only as `inv.suppliesTotal` (no breakdown).

## G. TRUCK / ASSET

| Field | Payload Path | Example | Proven | Imported to TZ |
|-------|-------------|---------|--------|---------------|
| Customer unit ID | `Unit.customerUnitId` | "1661567" | YES | YES (external_id) |
| Unit number | `Unit.number` | "302" | YES | YES (unit_number) |
| Nickname | `Unit.nickname` | "Zukhrob aka" | YES | NO |
| Type | `Unit.type` | "Truck" | YES | YES (unit_type) |
| Subtype | `Unit.subType` | "Heavy" | YES | NO |
| Year | `Unit.year` | "2018" | YES | YES |
| Make | `Unit.make` | "Freightliner" | YES | YES |
| Model | `Unit.model` | "New Cascadia 126" | YES | YES |
| VIN | `Unit.vin` | "3AKJHHDR5JSHR0772" | YES | YES |
| License plate | `Unit.licensePlate` | "" | YES | YES |

## H. CUSTOMER / CONTACT

| Field | Payload Path | Example | Proven | Imported to TZ |
|-------|-------------|---------|--------|---------------|
| Customer ID | `Customer.customerId` | 651757 | YES | YES (external_id) |
| Customer title | `Customer.title` | "HTS" | YES | YES (company_name) |
| Main phone | `Customer.mainPhone` | "(331) 212-4141" | YES | YES (phone) |
| Secondary phone | `Customer.secondaryPhone` | "" | YES | NO |
| External ID | `Customer.externalId` | null | YES | NO |

## I. CREATOR / USER / SHOP / METADATA

| Field | Payload Path | Example | Proven | Imported to TZ |
|-------|-------------|---------|--------|---------------|
| SO created by | `so.createdByTechnician` | "Ian Plata" | YES | NO |
| Invoice created by | `inv.createdByTechnician` | "Omar Montes" | YES | NO |
| SO technician | `so.technician` | "Luis Enrique" | YES | NO |
| Per-complaint technician | `AssignedTechnicians[].technician` | "Rafael Luna" | YES | NO |
| Parts manager | `so.partsManager` | "" | YES | NO |
| Shop title | `inv.shopTitle` | "Oswego Truck Center" | YES | NO |
| Shop email | `inv.shopEmail` | "accounting..." | YES | NO |

---

## WHAT WAS IMPORTED vs WHAT WAS SKIPPED

### Imported (10 fields)
- SO primary key → fullbay_id
- RO number → so_number
- SO created → created_at
- SO completed → completed_at
- Labor total $ → labor_total
- Parts total $ → parts_total
- Grand total → grand_total (from inv.total)
- Invoice subtotal, tax, total, amount_paid
- Customer linkage, asset linkage

### Skipped — Available in Source (key items)
- **181,205 individual part line items** (name, PN, qty, sell price, cost)
- **78,319 complaint records** (only first complaint text imported)
- **78,292 correction records** (actual correction text, recommended correction)
- Per-complaint and per-tech labor breakdowns
- Technician assignments per job
- Shop supplies total ($22,816 records have this)
- Misc charges ($10,403 records)
- Real Fullbay invoice number (TZ invented INV-FB-{RO#} instead)
- SO created-by user name
- Start/completion timestamps
- Customer threshold, authorization, PO numbers
- Tax line detail
- QuickBooks linkage IDs
