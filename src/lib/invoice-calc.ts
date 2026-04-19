/**
 * TruckZen — Canonical Invoice Calculation
 * One source of truth for all invoice-facing totals.
 * Used by: accounting review, WO invoice tab, sent invoices, maintenance invoices, approve API.
 *
 * Rules:
 * - Labor: billed_hours ONLY (no fallback to actual/estimated for invoice/customer totals)
 * - Parts: only kept/billable parts (canceled excluded)
 * - Tax: applied once from shop config
 * - No stale WO summary fields — always recalculate from lines
 */

export interface InvoiceTotals {
  laborTotal: number
  partsTotal: number
  chargesTotal: number
  subtotal: number
  taxAmount: number
  grandTotal: number
}

// Phase 4 billable predicate. A supplement row is billable only after the
// customer approves it OR a manager records an emergency override. Pending
// supplements (is_additional=true, customer_approved IS NULL) are excluded
// from invoice totals until they are resolved. Pre-approval rows and fleet
// rows have is_additional=false/null and pass through unchanged.
const isBillable = (l: any): boolean =>
  l.is_additional !== true ||
  l.customer_approved === true ||
  l.emergency_override_at != null

export function calcInvoiceTotals(
  lines: any[],
  laborRate: number,
  taxRate: number,
  taxLabor: boolean,
  shopCharges?: any[],
): InvoiceTotals {
  const laborLines = lines.filter((l: any) => l.line_type === 'labor' && isBillable(l))
  const partLines = lines.filter((l: any) => l.line_type === 'part' && l.parts_status !== 'canceled' && isBillable(l))

  // Labor: billed_hours preferred, fallback to estimated_hours for invoice truth
  const laborTotal = laborLines.reduce((sum: number, l: any) => {
    const hrs = l.billed_hours || l.estimated_hours || 0
    return sum + (hrs * laborRate)
  }, 0)

  // Parts: kept/billable parts only, use confirmed pricing
  const partsTotal = partLines.reduce((sum: number, l: any) => {
    const sell = l.parts_sell_price || l.unit_price || 0
    const qty = l.quantity || 1
    return sum + (sell * qty)
  }, 0)

  // Shop charges
  const chargesTotal = (shopCharges || []).reduce((sum: number, c: any) => sum + (c.amount || 0), 0)

  const subtotal = laborTotal + partsTotal + chargesTotal
  const taxableAmount = partsTotal + (taxLabor ? laborTotal : 0)
  const taxAmount = taxRate > 0 ? taxableAmount * (taxRate / 100) : 0
  const grandTotal = subtotal + taxAmount

  return {
    laborTotal: Math.round(laborTotal * 100) / 100,
    partsTotal: Math.round(partsTotal * 100) / 100,
    chargesTotal: Math.round(chargesTotal * 100) / 100,
    subtotal: Math.round(subtotal * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    grandTotal: Math.round(grandTotal * 100) / 100,
  }
}

/**
 * Internal WO totals — uses fallback chain for operational display.
 * NOT for customer-facing/invoice use.
 */
export function calcWoOperationalTotals(
  lines: any[],
  laborRate: number,
  taxRate: number,
  taxLabor: boolean,
  shopCharges?: any[],
): InvoiceTotals {
  const laborLines = lines.filter((l: any) => l.line_type === 'labor' && isBillable(l))
  const partLines = lines.filter((l: any) => l.line_type === 'part' && l.parts_status !== 'canceled' && isBillable(l))

  // Operational: fallback chain for internal display
  const laborTotal = laborLines.reduce((sum: number, l: any) => {
    const hrs = l.billed_hours || l.actual_hours || l.estimated_hours || 0
    return sum + (hrs * laborRate)
  }, 0)

  const partsTotal = partLines.reduce((sum: number, l: any) => {
    const sell = l.parts_sell_price || l.unit_price || 0
    const qty = l.quantity || 1
    return sum + (sell * qty)
  }, 0)

  const chargesTotal = (shopCharges || []).reduce((sum: number, c: any) => sum + (c.amount || 0), 0)
  const subtotal = laborTotal + partsTotal + chargesTotal
  const taxableAmount = partsTotal + (taxLabor ? laborTotal : 0)
  const taxAmount = taxRate > 0 ? taxableAmount * (taxRate / 100) : 0
  const grandTotal = subtotal + taxAmount

  return {
    laborTotal: Math.round(laborTotal * 100) / 100,
    partsTotal: Math.round(partsTotal * 100) / 100,
    chargesTotal: Math.round(chargesTotal * 100) / 100,
    subtotal: Math.round(subtotal * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    grandTotal: Math.round(grandTotal * 100) / 100,
  }
}
