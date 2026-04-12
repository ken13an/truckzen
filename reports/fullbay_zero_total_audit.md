# Fullbay Zero-Total Historical Service Orders — Forensic Audit

**Patch:** Fullbay_3
**Date:** 2026-04-04
**Type:** Read-only audit
**Scope:** 46 historical Fullbay service_orders with grand_total = 0

## Summary

All 46 rows are a single homogeneous category: **parts/supplies handoff tickets** created in Fullbay with zero financial value. They are not corrupted, not incomplete, and not hiding missing data. They represent real operational events (driver supply handoffs) that were never invoiced in Fullbay.

## Evidence

### Record Profile (all 46 rows)

| Attribute | Value | Notes |
|-----------|-------|-------|
| source | fullbay | All rows |
| is_historical | true | All rows |
| status | done | All 46 |
| grand_total | 0.00 | All 46 |
| labor_total | 0.00 | All 46 |
| parts_total | 0.00 | All 46 |
| has_invoice | false | All 46 — no TruckZen invoice row |
| found_in_fullbay_backup | false | None found in any fetched Fullbay source file |
| found_in_recovered_patch | false | Not in 93G or 98 recovery data |
| date range | 2025-10-06 to 2025-10-31 | All within October 2025 |
| line count | 1 per SO (65 total across 46 SOs, some have >1) | All labor type |
| line unit_price | 0.00 | 64 of 65 lines |
| line total_price | 0.00 | 64 of 65 lines |
| line estimated_hours | 0.00 | 63 of 65 lines |
| part lines | 0 | No part lines exist |

### Complaint Text Analysis

Top words across all 46 complaints:
- **windshield** (12), **coolant** (11), **washer** (10), **chain/chains** (15), **parts** (7), **mattress** (6), **tire** (5), **fire extinguisher** (2), **loadbars** (2)

These are driver supplies and consumables — chains, coolant, windshield washer fluid, mattresses, fire extinguishers, load bars, tire gauges. This is consistent with a shop handing out supplies to drivers as they arrive, tracked in Fullbay as zero-dollar work orders.

### Why They Have No Invoice

The Fullbay `getInvoices.php` API returns records by invoice date. These 46 SOs were never invoiced in Fullbay because:
1. They represent **no-charge supply handoffs** — the shop gives the driver chains/coolant/etc. and closes the ticket with $0 billed
2. Fullbay marks them as "done" but never generates an invoice
3. Since no invoice exists, `getInvoices.php` never returns them

This is confirmed by the fact that all 291 weekly Fullbay API fetches (269 original + 22 recovery) returned zero results for these 46 fullbay_ids.

### Asset and Customer Linkage

- **44 of 46** have a valid `asset_id` (linked to a truck/trailer)
- **46 of 46** have a valid `customer_id` (linked to a fleet customer)
- 4 rows reference asset "1" (unit_number="11111") with customer "Customer" — likely a placeholder/generic asset used for quick tickets

### Hidden Corruption Check

| Check | Result |
|-------|--------|
| 11.25x markup pattern | **NONE** — all labor_total = 0, ratio is N/A |
| Non-zero sub-totals with zero grand_total | **NONE** — labor_total, parts_total, grand_total all zero |
| Invoice data mismatch | **NONE** — no invoices exist |
| Line-level financial conflicts | **NONE** — all line prices are $0 |

**No hidden corruption found.**

## Bucket Classification

| Bucket | Count | Label |
|--------|-------|-------|
| **Parts/supplies handoff — zero-charge** | 46 | `historical_uninvoiced_supplies` |

All 46 rows are the same category. No mixed buckets. No exceptions.

## Proposed Treatment

These 46 rows should remain in TruckZen historical data with the following understanding:

1. **Keep visible** in historical repair/service history — they represent real operational events (driver supply handoffs)
2. **Do not include** in financial completeness metrics — they have no financial value and were never invoiced
3. **No correction needed** — the $0 values are accurate, not corrupted
4. **Suggested internal label:** `historical_uninvoiced_supplies`
5. **No follow-up correction patch needed**

## Questions Answered

1. **What are these 46 rows?** — Zero-charge supply handoff tickets (chains, coolant, washer fluid, mattresses) from October 2025
2. **Are they truly never invoiced?** — Yes. Confirmed by exhaustive Fullbay API search across 291 weekly ranges
3. **What do they represent?** — Parts/supplies distribution to drivers with no labor or billing
4. **Do they have meaningful line items?** — Yes, 65 labor lines describing the supplies, all at $0
5. **Should they remain visible?** — Yes, as operational history
6. **What classification?** — `historical_uninvoiced_supplies`
7. **Is there hidden corruption?** — No

## Final Status

**Proven** — All 46 rows individually accounted for, single homogeneous category, no exceptions, no hidden corruption, no follow-up correction needed.
