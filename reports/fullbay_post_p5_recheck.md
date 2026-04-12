# Fullbay Post-Fullbay_5 Re-Audit

**Patch:** Fullbay_6
**Date:** 2026-04-04
**Type:** Read-only audit
**Scope:** Verify Fullbay_5 mutation guards from code

## Mutation Entry Point Verification

All 8 mutation entry points across 5 files verified from actual code.

| File | Method | Guard Line | DB Truth Source | Blocks Before Write | Blocks Before recalcTotals | Native Intact |
|------|--------|-----------|----------------|--------------------|--------------------------|----|
| so-lines/route.ts | POST | 72 | `so.is_historical` (line 69 select) | YES | YES (line 99 unreachable) | YES |
| so-lines/[id]/route.ts | PATCH | 41 | `wo.is_historical` (line 40 select) | YES | YES (line 76 unreachable) | YES |
| so-lines/[id]/route.ts | DELETE | 112 | `wo.is_historical` (line 111 select) | YES | YES (line 121 unreachable) | YES |
| service-orders/[id]/route.ts | PATCH | 51 | `current.is_historical` (line 48 select *) | YES | N/A | YES |
| service-orders/[id]/route.ts | DELETE | 108 | `delTarget.is_historical` (line 107 select) | YES | N/A | YES |
| work-orders/[id]/route.ts | PATCH | 159 | `existing.is_historical` (line 156 select) | YES | N/A | YES |
| work-orders/[id]/route.ts | DELETE | 273 | `wo.is_historical` (line 270 select) | YES | N/A | YES |
| invoices/[id]/route.ts | PATCH | 37 | `current.is_historical` (line 34 select *) | YES | N/A | YES |

### Guard Quality

- All guards check **DB row truth** (fetched record's `is_historical` field), not request body
- All guards return **403** with message "Historical Fullbay records are read-only"
- All guards execute **before** any write or recalcTotals call
- All guards are **early returns** — no partial writes possible
- Native paths remain unchanged — guards only trigger when `is_historical === true`

## Fullbay_4 Gap List Reclassification

| # | Gap | Severity | Status After Fullbay_5 |
|---|-----|----------|----------------------|
| 1 | recalcTotals can overwrite historical Fullbay financials | CRITICAL | **CLOSED** — all 3 so-lines mutation paths guarded before recalcTotals |
| 2 | No mutation guard on historical SOs | HIGH | **CLOSED** — service-orders/[id] PATCH + DELETE guarded |
| 3 | No mutation guard on historical invoices | HIGH | **CLOSED** — invoices/[id] PATCH guarded |
| 4 | No mutation guard on historical WOs | HIGH | **CLOSED** — work-orders/[id] PATCH + DELETE guarded |
| 5 | Default list views mix historical + native | MEDIUM | **STILL OPEN** — out of scope for Fullbay_5 (non-mutation) |
| 6 | Floor manager JS post-query filter | LOW | **STILL OPEN** — out of scope for Fullbay_5 (non-mutation) |
| 7 | Source labels in public API | LOW | **STILL OPEN** — out of scope for Fullbay_5 (non-mutation) |

## Classification After Fullbay_5

| Category | Status |
|----------|--------|
| **Mutation safety** | **Proven** — all mutation paths in the 5 audited files are guarded |
| **recalcTotals protection** | **Proven** — cannot be reached for historical parents |
| **Source separation (full)** | Not proven — 3 non-mutation gaps remain (list mixing, JS filter, label leakage) |
| **Native path integrity** | Proven from code review — guards are conditional on `is_historical === true` only |

## Remaining Non-Mutation Gaps

These are LOW-MEDIUM severity display/API issues, not data-integrity risks:

1. **List mixing (MEDIUM):** `api/service-orders` and `api/invoices` GET default to showing both historical and native rows without requiring explicit filter param
2. **JS post-query filter (LOW):** `api/floor-manager/jobs` filters `!is_historical` in JavaScript after full query instead of at DB level
3. **Label leakage (LOW):** `api/v1/work-orders` and `api/invoices` expose `source` and `is_historical` in API responses

None of these can corrupt data. They are UX/display concerns that can be addressed in a future cleanup patch if desired.
