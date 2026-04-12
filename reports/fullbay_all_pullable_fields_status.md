# Fullbay All Pullable Fields — Status

**Patch:** Fullbay_14_all_pullable_fields
**Date:** 2026-04-04

## Status: Audited only

Source inventory is complete. No writes performed.

## Key Finding

The Fullbay source data is far richer than what was imported. The original migration imported ~10 fields per record. The source contains 80+ fields per record including **181,205 individual part line items** that were completely dropped.

## What the original migration captured

- SO header: primary key, RO number, status, dates, labor/parts/grand totals
- Invoice: totals, tax, balance → derived amount_paid and status
- Customer/asset linkage (by ID matching)

## What the original migration dropped

| Category | Available in Source | Imported | Gap |
|----------|-------------------|----------|-----|
| Part line items | 181,205 with name/PN/qty/price/cost | 0 | **100% missing** |
| Complaint records | 78,319 | 1 per SO (first only) | **~55% of complaints missing** |
| Correction records | 78,292 with actual fix text | Partial (first only) | Most missing |
| Technician assignments | Per-complaint tech names + hours | None | **100% missing** |
| Shop supplies | 22,816 records with $amounts | None | **100% missing** |
| Misc charges | 10,403 records | None | **100% missing** |
| Real Fullbay invoice # | All records | None (invented INV-FB-{RO#}) | **Wrong values stored** |
| Created-by user | All records | None | **100% missing** |
| Start/completion times | All records | Only completion date | Start missing |
| Labor hours (billed/actual) | Per complaint + per tech | None | **100% missing** |
| QuickBooks IDs | 13,740 records | None | 100% missing |

## Source Data Quality

All fields proven from actual payload inspection of backup files. No assumptions. No "should be there" claims. Every field listed has been seen in real records with real values.

## Blockers

1. The `repairOrderNumber` field in the API may not match what Fullbay UI shows as "Service Order #" — field mapping needs verification against the Fullbay UI for a few records before any re-migration
2. The `invoiceNumber` field in the API may not match the Fullbay UI invoice number — same verification needed
3. These backup files contain data from the `getInvoices.php` API only — SOs that were never invoiced are not in the backup files
