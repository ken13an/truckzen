# Fullbay → TruckZen Number/ID Mapping Proof

Patch: Fullbay_15_updated
Date: 2026-04-04
Type: READ-ONLY AUDIT — no writes performed

## A. Fullbay Number Fields (from source payload)

| Field | Location in payload | Meaning (PROVEN) |
|---|---|---|
| `primaryKey` | Top-level invoice object | Fullbay internal invoice primary key. NOT the user-facing invoice number. |
| `invoiceNumber` | Top-level `invoiceNumber` | Fullbay user-facing invoice number (sequential, e.g., "2033", "7756", "37318"). |
| `ServiceOrder.primaryKey` | Nested `ServiceOrder.primaryKey` | Fullbay internal service order primary key. NOT the user-facing SO/RO number. |
| `ServiceOrder.repairOrderNumber` | Nested `ServiceOrder.repairOrderNumber` | Fullbay user-facing service order / repair order number (sequential, e.g., "2737", "9308", "39104"). This is what Fullbay UI calls "Service Order #" or "RO #". |

### Key distinction (PROVEN from 26 samples):
- `repairOrderNumber` ≠ `invoiceNumber` — they are always different numbers
- `repairOrderNumber` is always numerically higher than `invoiceNumber` for the same record
- `ServiceOrder.primaryKey` ≠ top-level `primaryKey` — they are different internal IDs for different entities (SO vs invoice)

## B. TruckZen Imported Fields (from DB)

| TruckZen field | Source mapping (PROVEN) |
|---|---|
| `service_orders.so_number` | = `ServiceOrder.repairOrderNumber` (the Fullbay RO#) |
| `service_orders.fullbay_id` | = `ServiceOrder.primaryKey` (the Fullbay internal SO key) |
| `invoices.invoice_number` | = `"INV-FB-" + service_orders.so_number` = `"INV-FB-" + repairOrderNumber` |
| `invoices.so_id` | = linked `service_orders.id` UUID |

### Critical finding:
TruckZen `invoices.invoice_number` is built from the **repairOrderNumber** (SO#), NOT from the Fullbay `invoiceNumber`. This means:
- TruckZen invoice display shows `INV-FB-39104` (the RO#)
- The actual Fullbay invoice number for that record is `37318`
- The Fullbay `invoiceNumber` field is **not stored anywhere in TruckZen DB**

## C. User-Facing UI Truth

| What Fullbay UI shows | Fullbay source field | What TruckZen shows | Match? |
|---|---|---|---|
| "Service Order #" / "RO #" | `repairOrderNumber` | `so_number` (e.g., "39104") | **CORRECT** |
| "Invoice #" | `invoiceNumber` | `invoice_number` = "INV-FB-39104" | **WRONG** — TruckZen shows the RO#, not the Fullbay invoice# |

### Impact:
If a user searches by Fullbay invoice number (e.g., "37318"), they will NOT find it in TruckZen. TruckZen only has the RO# in the invoice_number field.

## D. Invoice/Location Text Fields (bldg h / bldg x)

### Source evidence from 28,460 Fullbay records:

| Field | Values found | Building markers? |
|---|---|---|
| `shopTitle` | 3 distinct values: "Oswego Truck Center", "UGL Truck Center Inc", "UGL Truck Center Inc (Bldg X)" | **YES — "Bldg X" appears directly in shopTitle** |
| `shopPhysicalAddress` | 4 distinct values (see below) | **YES — "Building X", "suite x106" appear in address** |
| `ServiceOrder.locationInformation` | Empty string in ALL 28,460 records inspected | **NO location text in this field** |

### Distinct shopPhysicalAddress values:
1. `3485 State Route IL-126Unit BOswego, IL 60543` (early records, Oswego location)
2. `325 State Route 31Building XMontgomery, IL 60538` (mid-period, badly concatenated)
3. `325 State Route 31 Building X, Montgomery, IL 60538, US` (mid-period, properly formatted)
4. `325 State Rte 31 suite x106, Montgomery, IL 60538, US` (later records)

### Building marker truth:
- **"Bldg X"** / **"Building X"** appears in `shopTitle` and `shopPhysicalAddress`
- The early Oswego address has "Unit B" (appears to be address formatting, not a building marker)
- **"Bldg H"** — NOT FOUND in any of the 28,460 source records. If user sees "Bldg H" in Fullbay UI, it may come from a different Fullbay data source not present in the invoice export, or may be a user memory error.
- `ServiceOrder.locationInformation` is consistently empty — building info comes only from `shopTitle` and `shopPhysicalAddress`

## E. Known Confusing Examples

### WO 21242
- **NOT FOUND** in Fullbay source backup (28,460 invoice records)
- **NOT FOUND** in TruckZen DB (`so_number = '21242'` returns no rows)
- Classification: **NOT PROVEN** — may be outside the date range of the export, or may reference a different identifier

### WO 39104
- **FOUND** in Fullbay source: `repairOrderNumber = 39104`, `invoiceNumber = 37318`, `primaryKey = 21522166`, `SO primaryKey = 23619307`
- **FOUND** in TruckZen: `so_number = "39104"`, `fullbay_id = "23619307"`, `grand_total = 2.92` (matches source `total = 2.92`)
- TruckZen invoice: `INV-FB-39104`
- Classification: **CONFIRMED MATCH** — mapping is correct

## F. Sample Proof Summary (26 records)

| Classification | Count |
|---|---|
| confirmed_match (so_number=repairOrderNumber, fullbay_id=SO.primaryKey, totals match) | 17 |
| not_found (early records not imported into TruckZen) | 9 |
| mismatch | 0 |
| ambiguous | 0 |

The 9 "not_found" records are all from the earliest date range (repairOrderNumbers 2737-3103, Feb 2021) — these were likely outside the original import date range. No mismatches found in any imported record.

## G. Mapping Truth Summary

| Question | Answer | Status |
|---|---|---|
| repairOrderNumber maps to? | Fullbay UI "Service Order #" / "RO #" → TruckZen `so_number` | **PROVEN** |
| invoiceNumber maps to? | Fullbay UI "Invoice #" — NOT stored in TruckZen | **PROVEN (not imported)** |
| ServiceOrder.primaryKey maps to? | Internal Fullbay SO key → TruckZen `fullbay_id` | **PROVEN** |
| Top-level primaryKey maps to? | Internal Fullbay invoice key — NOT stored in TruckZen | **PROVEN (not imported)** |
| "Bldg X" / "Building X" present in source? | Yes — in `shopTitle` and `shopPhysicalAddress` | **PROVEN** |
| "Bldg H" present in source? | No — not found in 28,460 records | **NOT PROVEN** |
| locationInformation field useful? | No — empty in all records | **PROVEN (empty)** |
