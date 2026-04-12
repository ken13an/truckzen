# Fullbay Source Separation Audit

**Patch:** Fullbay_4
**Date:** 2026-04-04
**Type:** Read-only audit
**Scope:** Historical Fullbay vs native TruckZen data separation

## 1. Row Markers

| Table | source | is_historical | fullbay_id | fullbay_synced_at | external_id | external_data |
|-------|--------|--------------|------------|-------------------|-------------|---------------|
| service_orders | YES | YES | YES | YES | - | YES |
| invoices | YES | YES | - | - | - | - |
| customers | YES | - | - | - | YES | YES |
| assets | YES | - | YES | - | YES | YES |
| so_lines | - | - | - | - | - | YES |

**Gap:** `so_lines` has no `source` or `is_historical` column. Historical lines are only identifiable via join to `service_orders`.

**Gap:** `customers` and `assets` have `source='fullbay'` but no `is_historical` flag. All Fullbay-sourced customers and assets are shared between historical and native workflows — this is correct (a truck is a truck regardless of which system created the record).

## 2. Current DB Split

| Table | Fullbay Historical | Native | Total |
|-------|-------------------|--------|-------|
| service_orders | 30,818 | 93 | 30,911 |
| invoices | 30,772 | 0 | 30,772 |
| customers | 1,095 (source=fullbay) | 2 (source=walk_in) | 1,097 |
| assets | 4,107 (source=fullbay) | 3 (source=truckzen) | 4,110 |
| so_lines | 87,735 (via join) | 327 (via join) | 88,062 |

## 3. Route Audit — Read Operations

### SAFE EXCLUSIONS (5 routes)

| Route | Filter | Proof |
|-------|--------|-------|
| `api/accounting` GET | `.neq('is_historical', true).neq('source', 'fullbay')` | Always excludes — accounting queue shows only native WOs |
| `api/work-orders` POST | Sets `source: 'walk_in'` | New records always native |
| `api/admin/repair-totals` POST | `.or('is_historical.is.null,is_historical.eq.false')` | Only recalculates native WOs |
| `api/reports` GET | `applySOSourceFilter()` with `source_mode=live|fullbay|combined` | Proper source-mode segregation |
| `api/customers/[id]` GET | `.neq('is_historical', true)` on SO subquery | Historical excluded from customer SO list |

### INTENTIONAL INCLUDES (3 routes)

| Route | Behavior | Proof |
|-------|----------|-------|
| `api/service-orders/[id]` GET | No filter (single record detail) | Correct — detail views should show all data |
| `api/work-orders/[id]` GET | No filter (single record detail) | Correct — detail views should show all data |
| `api/export/full` POST | Exports both source and is_historical | Intentional for data portability |

### RISKY MIXING (4 routes)

| Route | Issue | Severity |
|-------|-------|----------|
| `api/service-orders` GET | Default mixes historical + native; requires `exclude_historical=true` param | MEDIUM — client-dependent |
| `api/invoices` GET | Default mixes; requires `historical=false` param; also exposes `is_historical, source` in response | MEDIUM |
| `api/floor-manager/jobs` GET | Filters `!is_historical` in JavaScript AFTER full query | LOW — works but fragile |
| `api/v1/work-orders` GET | Public API exposes `source, is_historical` without filtering | MEDIUM — label leakage |

## 4. Route Audit — Mutation Operations

### CRITICAL: NO is_historical GUARD ON MUTATIONS

| Route | Operation | Risk | Impact |
|-------|-----------|------|--------|
| **`api/so-lines` POST** | Add line to SO | **CRITICAL** | `recalcTotals()` overwrites `grand_total, labor_total, parts_total` on parent SO — would corrupt corrected Fullbay financials |
| **`api/so-lines/[id]` PATCH** | Edit line | **CRITICAL** | Same — `recalcTotals()` recalculates from lines, destroying Fullbay source truth |
| **`api/so-lines/[id]` DELETE** | Delete line | **CRITICAL** | Same — `recalcTotals()` recalculates after delete |
| `api/service-orders/[id]` PATCH | Update SO fields | HIGH | Can change status, complaint, priority etc. on historical records |
| `api/work-orders/[id]` PATCH | Update WO | HIGH | Can update status, team, bay etc. |
| `api/invoices/[id]` PATCH | Update invoice | HIGH | Can change invoice status, amounts |
| `api/accounting/approve` POST | Approve/invoice | MEDIUM | Can trigger invoice creation for historical SO |

**The `recalcTotals()` function at `api/so-lines/[id]/route.ts:22-25` and `api/so-lines/route.ts:20-23` is the highest-risk mutation.** It unconditionally recalculates `grand_total` from line items. If a user accidentally adds, edits, or deletes a line on a historical Fullbay SO, the corrected Fullbay financial values would be overwritten with a TruckZen-calculated total.

## 5. Source Label Leakage

| Route | Leaks `source` | Leaks `is_historical` | Severity |
|-------|---------------|----------------------|----------|
| `api/invoices` GET | YES (in select) | YES (in select) | MEDIUM |
| `api/v1/work-orders` GET | YES | YES | MEDIUM — public API |
| `api/export/full` POST | YES | YES | LOW — intentional export |
| `api/portal/[token]` GET | Possible | Possible | LOW — limited scope |

## 6. Gap List

| # | Gap | File/Route | Severity | Fix Type |
|---|-----|-----------|----------|----------|
| 1 | **recalcTotals can overwrite historical Fullbay financials** | `api/so-lines/route.ts`, `api/so-lines/[id]/route.ts` | **CRITICAL** | Add is_historical guard before recalcTotals |
| 2 | No mutation guard on historical SOs | `api/service-orders/[id]/route.ts` PATCH | HIGH | Add is_historical check |
| 3 | No mutation guard on historical invoices | `api/invoices/[id]/route.ts` PATCH | HIGH | Add is_historical check |
| 4 | No mutation guard on historical WOs | `api/work-orders/[id]/route.ts` PATCH/DELETE | HIGH | Add is_historical check |
| 5 | Default list views mix historical + native | `api/service-orders/route.ts`, `api/invoices/route.ts` | MEDIUM | Flip default to exclude historical |
| 6 | Floor manager JS filter instead of DB filter | `api/floor-manager/jobs/route.ts` | LOW | Move filter to query |
| 7 | Source labels in public API response | `api/v1/work-orders/route.ts` | LOW | Consider removing from public response |
