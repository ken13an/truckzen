# Fullbay Source Separation — Status

**Patch:** Fullbay_4
**Date:** 2026-04-04

## Status: Not Proven

Historical Fullbay data is **not safely separated** from native TruckZen operational truth.

## Blocking Issues

1. **CRITICAL:** `recalcTotals()` in so-lines routes can overwrite corrected Fullbay financial values if any line mutation occurs on a historical SO. This is the single highest-risk gap — it could silently re-corrupt the data that Patches 93G and 98 corrected.

2. **HIGH:** No mutation guards exist on PATCH/DELETE endpoints for historical service_orders, invoices, or work-orders. A user or automated process could accidentally modify historical Fullbay records.

3. **MEDIUM:** Default list views mix historical and native rows without requiring explicit filtering, creating confusion in operational workflows.

## What Is Safe

- Accounting queue correctly excludes historical
- Reports endpoint has proper source-mode segregation
- Customer views exclude historical SOs
- New record creation always uses native source
- Admin repair-totals only targets native records

## Required Before Source Separation Can Be Proven

1. Add `is_historical` guard to so-lines POST/PATCH/DELETE (prevent recalcTotals on historical SOs)
2. Add `is_historical` guard to service-orders/[id] PATCH
3. Add `is_historical` guard to invoices/[id] PATCH
4. Add `is_historical` guard to work-orders/[id] PATCH/DELETE
5. Verify these guards work end-to-end

## Recommended Follow-Up

A narrow **Fullbay_5** patch should add `is_historical` mutation guards to the 4 critical endpoints. This is a small, targeted change — approximately 4-8 lines of code per route.
