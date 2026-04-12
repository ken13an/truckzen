# Fullbay Number Mapping — Status Report

Patch: Fullbay_15_updated
Date: 2026-04-04

## Files created
1. `reports/fullbay_number_mapping_proof.md` — full mapping proof with evidence
2. `reports/fullbay_number_mapping_status.md` — this file
3. `mapping/fullbay_number_mapping_samples.csv` — 26-row side-by-side comparison

## Proven findings

1. **`service_orders.so_number` = `ServiceOrder.repairOrderNumber`** — PROVEN across 17/17 matched records with exact value + total match
2. **`service_orders.fullbay_id` = `ServiceOrder.primaryKey`** — PROVEN across 17/17 matched records
3. **`invoices.invoice_number` = `"INV-FB-" + repairOrderNumber`** — PROVEN. This is the RO#, not the Fullbay invoice#
4. **Fullbay `invoiceNumber` is NOT stored in TruckZen** — PROVEN by absence in all DB fields
5. **Fullbay top-level `primaryKey` (invoice internal key) is NOT stored in TruckZen** — PROVEN by absence
6. **"Bldg X" / "Building X" is present in `shopTitle` and `shopPhysicalAddress`** — PROVEN from source
7. **`locationInformation` is empty in all 28,460 records** — PROVEN
8. **WO 39104 mapping is correct** — PROVEN (repairOrderNumber=39104, fullbay_id=23619307, total=2.92)

## Not proven findings

1. **"Bldg H"** — NOT FOUND in any of the 28,460 source records. Source unknown.
2. **WO 21242** — NOT FOUND in source backup or TruckZen DB. Cannot classify.

## Blockers / exceptions

1. The Fullbay `invoiceNumber` (the actual Fullbay invoice #) is currently lost — not stored anywhere in TruckZen. If users need to cross-reference by Fullbay invoice number, this is a gap.
2. 9 of 26 sampled records (early Feb 2021, repairOrderNumbers < ~3400) are not present in TruckZen — they were outside the original import range.
3. "Bldg H" cannot be resolved from available source data.

## Final status

**Proven** — mapping truth is established for SO#, invoice#, fullbay_id, and building text. Known gaps documented honestly.
