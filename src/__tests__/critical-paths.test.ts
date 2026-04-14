/**
 * TruckZen — Critical Path Regression Tests (Crash4)
 * Minimum regression wall for auth, work-orders, invoices, payments, and import paths.
 * Uses static file analysis (same pattern as security-regressions.test.ts).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const root = resolve(__dirname, '../..')

function readFile(path: string): string {
  return readFileSync(resolve(root, path), 'utf-8')
}

function fileExists(path: string): boolean {
  return existsSync(resolve(root, path))
}

// ──────────────────────────────────────────────────────────────
// AUTH / SESSION
// ──────────────────────────────────────────────────────────────

describe('auth/session critical path', () => {
  it('login route validates email and password before proceeding', () => {
    const content = readFile('src/app/api/auth/login/route.ts')
    expect(content).toMatch(/!email\s*\|\|\s*!password/)
    expect(content).toMatch(/status:\s*400/)
  })

  it('login route has brute-force protection', () => {
    const content = readFile('src/app/api/auth/login/route.ts')
    expect(content).toMatch(/login_attempts/)
    expect(content).toMatch(/429/)
  })

  it('login route is wrapped with safeRoute', () => {
    const content = readFile('src/app/api/auth/login/route.ts')
    expect(content).toMatch(/safeRoute/)
  })

  it('session route is wrapped with safeRoute', () => {
    const content = readFile('src/app/api/auth/session/route.ts')
    expect(content).toMatch(/safeRoute/)
  })

  it('middleware protects non-public routes', () => {
    const content = readFile('middleware.ts')
    expect(content).toMatch(/tz_session_token|sb-/)
    expect(content).toMatch(/401|login/)
  })

  it('requireRouteContext returns 401 for unauthenticated requests', () => {
    const content = readFile('src/lib/api-route-auth.ts')
    expect(content).toMatch(/Unauthorized.*401/)
  })

  it('requireRoles uses impersonate_role for effective role check', () => {
    const content = readFile('src/lib/server-auth.ts')
    const fn = content.match(/function requireRoles[\s\S]*?^}/m)
    expect(fn).not.toBeNull()
    expect(fn![0]).toMatch(/impersonate_role\s*\|\|\s*actor\.role/)
  })
})

// ──────────────────────────────────────────────────────────────
// WORK ORDER CREATE / UPDATE
// ──────────────────────────────────────────────────────────────

describe('work-order critical path', () => {
  it('WO create route requires auth via requireRouteContext', () => {
    const content = readFile('src/app/api/service-orders/route.ts')
    expect(content).toMatch(/requireRouteContext/)
    expect(content).toMatch(/ctx\.error/)
  })

  it('WO create route is wrapped with safeRoute', () => {
    const content = readFile('src/app/api/service-orders/route.ts')
    expect(content).toMatch(/safeRoute/)
  })

  it('WO update route enforces status transitions', () => {
    const content = readFile('src/app/api/work-orders/[id]/route.ts')
    expect(content).toMatch(/VALID_WO_TRANSITIONS/)
    expect(content).toMatch(/Cannot transition/)
  })

  it('WO update route blocks historical record mutations', () => {
    const content = readFile('src/app/api/work-orders/[id]/route.ts')
    expect(content).toMatch(/is_historical/)
    expect(content).toMatch(/read-only|read.only/i)
  })

  it('WO update route is wrapped with safeRoute', () => {
    const content = readFile('src/app/api/work-orders/[id]/route.ts')
    expect(content).toMatch(/safeRoute/)
  })

  it('WO delete (void) route requires role check', () => {
    const content = readFile('src/app/api/work-orders/[id]/route.ts')
    // DELETE handler should use requireRouteContext with specific roles
    expect(content).toMatch(/requireRouteContext\(\[/)
  })
})

// ──────────────────────────────────────────────────────────────
// INVOICE CRITICAL PATH
// ──────────────────────────────────────────────────────────────

describe('invoice critical path', () => {
  it('invoice create route requires auth', () => {
    const content = readFile('src/app/api/invoices/route.ts')
    expect(content).toMatch(/Unauthorized.*401/)
  })

  it('invoice create route generates unique invoice numbers', () => {
    const content = readFile('src/app/api/invoices/route.ts')
    expect(content).toMatch(/INV-/)
    expect(content).toMatch(/count/)
  })

  it('invoice route is wrapped with safeRoute', () => {
    const content = readFile('src/app/api/invoices/route.ts')
    expect(content).toMatch(/safeRoute/)
  })

  it('invoice update blocks historical records', () => {
    const content = readFile('src/app/api/invoices/[id]/route.ts')
    expect(content).toMatch(/is_historical/)
    expect(content).toMatch(/read-only|read.only/i)
  })

  // Patch 123 regression guard: deterministic clean/labor-only phrases must not be
  // flagged unrecognized by the entry/submit validator. The canonical recognition
  // helper hasRecognizedVerb (parts-suggestions.ts) must be consulted before the
  // KNOWN_REPAIR_WORDS noun fallback; failing that, CLEAN GAS TANKS / CHECK LIGHTS /
  // FULL GREASE would be accepted by canonical parse and rejected by submit.
  it('job recognition: hasRecognizedVerb is exported and consulted by WO entry validator', () => {
    const partsLib = readFile('src/lib/parts-suggestions.ts')
    expect(partsLib).toMatch(/export\s+function\s+hasRecognizedVerb/)
    const newWo = readFile('src/app/work-orders/new/page.tsx')
    expect(newWo).toMatch(/hasRecognizedVerb/)
    expect(newWo).toMatch(/if\s*\(hasRecognizedVerb\(desc\)\)\s*return\s+false/)
  })

  // Patch 124 regression guard: edit-WO page has its own isUnrecognizedJob duplicate;
  // must also consult canonical hasRecognizedVerb so CLEAN GAS TANKS etc. aren't
  // flagged red in the add-job-to-existing-WO flow.
  it('job recognition: WO detail add-job validator consults hasRecognizedVerb', () => {
    const editWo = readFile('src/app/work-orders/[id]/page.tsx')
    expect(editWo).toMatch(/hasRecognizedVerb/)
    expect(editWo).toMatch(/if\s*\(hasRecognizedVerb\(desc\)\)\s*return\s+false/)
  })

  // Patch 125: picked_up parts must be classified via the canonical isPartReceived
  // helper in the pre-invoice gate, WO stepper, floor-manager quick-assign, and
  // wo-automation. Behavior of the helper itself is covered by helper-behavior.test.ts.
  it('wo-parts aggregates: callers import canonical isPartReceived', () => {
    const invoiceGate = readFile('src/app/api/work-orders/[id]/invoice/route.ts')
    expect(invoiceGate).toMatch(/from '@\/lib\/parts-status'/)
    expect(invoiceGate).toMatch(/isPartReceived/)
    const stepper = readFile('src/components/work-orders/WOStepper.tsx')
    expect(stepper).toMatch(/isPartReceived/)
    const quickAssign = readFile('src/app/floor-manager/quick-assign/page.tsx')
    expect(quickAssign).toMatch(/isPartReceived/)
    const automation = readFile('src/lib/wo-automation.ts')
    expect(automation).toMatch(/isPartReceived/)
  })

  it('job recognition: canonical verb lists cover clean/check/grease/inspect families', () => {
    const partsLib = readFile('src/lib/parts-suggestions.ts')
    expect(partsLib).toMatch(/NO_AUTO_PARTS_VERBS\s*=\s*\[[^\]]*'clean'[^\]]*\]/)
    expect(partsLib).toMatch(/NO_AUTO_PARTS_VERBS\s*=\s*\[[^\]]*'grease'[^\]]*\]/)
    expect(partsLib).toMatch(/NO_AUTO_PARTS_VERBS\s*=\s*\[[^\]]*'inspect'[^\]]*\]/)
    expect(partsLib).toMatch(/LABOR_ONLY_VERBS\s*=\s*\[[^\]]*'check'[^\]]*\]/)
  })

  // Patch 122+125: invoice outbound recipient is resolved by the canonical helper
  // resolveInvoiceRecipientEmail (kiosk_checkins.contact_email → customers.email).
  // Both accounting manual-send and sendPaymentNotifications must go through it so
  // they cannot silently diverge. Helper behavior is covered by helper-behavior.test.ts.
  it('invoice send + payment-notify both import resolveInvoiceRecipientEmail', () => {
    const sendRoute = readFile('src/app/api/invoices/[id]/send/route.ts')
    expect(sendRoute).toMatch(/resolveInvoiceRecipientEmail/)
    expect(sendRoute).toMatch(/email:\s*recipientEmail/)
    const paymentNotify = readFile('src/lib/notifications/sendPaymentNotifications.ts')
    expect(paymentNotify).toMatch(/resolveInvoiceRecipientEmail/)
    // The helper file itself must exist and look at kiosk_checkins first.
    const helper = readFile('src/lib/notifications/resolveInvoiceRecipientEmail.ts')
    expect(helper).toMatch(/kiosk_checkins/)
    expect(helper).toMatch(/contact_email/)
  })
})

// ──────────────────────────────────────────────────────────────
// PAYMENT / STRIPE WEBHOOK
// ──────────────────────────────────────────────────────────────

describe('payment/webhook critical path', () => {
  it('stripe webhook validates signature before processing', () => {
    const content = readFile('src/app/api/stripe/webhook/route.ts')
    expect(content).toMatch(/constructEvent/)
    expect(content).toMatch(/Invalid signature/)
  })

  it('stripe webhook is wrapped with safeRoute', () => {
    const content = readFile('src/app/api/stripe/webhook/route.ts')
    expect(content).toMatch(/safeRoute/)
  })

  it('pay checkout route has rate limiting', () => {
    const content = readFile('src/app/api/pay/checkout/route.ts')
    expect(content).toMatch(/checkRateLimit|rateLimit/)
    expect(content).toMatch(/429/)
  })
})

// ──────────────────────────────────────────────────────────────
// IMPORT / SYNC RESILIENCE
// ──────────────────────────────────────────────────────────────

describe('import resilience', () => {
  it('import route has idempotent dedup for customers (DOT + name)', () => {
    const content = readFile('src/app/api/migrate/import/route.ts')
    expect(content).toMatch(/dotMap/)
    expect(content).toMatch(/nameMap/)
    expect(content).toMatch(/dot_number/)
  })

  it('import route has idempotent dedup for vehicles (VIN + unit_number)', () => {
    const content = readFile('src/app/api/migrate/import/route.ts')
    expect(content).toMatch(/vinMap/)
    expect(content).toMatch(/unitMap/)
  })

  it('import route has idempotent dedup for service orders (ext_id)', () => {
    const content = readFile('src/app/api/migrate/import/route.ts')
    expect(content).toMatch(/importedExtIds/)
    expect(content).toMatch(/ext_id:/)
  })

  it('import route has idempotent dedup for invoices (invoice_number)', () => {
    const content = readFile('src/app/api/migrate/import/route.ts')
    expect(content).toMatch(/existingNums/)
    expect(content).toMatch(/invoice_number/)
  })

  it('import route has idempotent dedup for parts (part_number)', () => {
    const content = readFile('src/app/api/migrate/import/route.ts')
    expect(content).toMatch(/pnMap/)
    expect(content).toMatch(/part_number/)
  })

  it('import route has idempotent dedup for technicians (email)', () => {
    const content = readFile('src/app/api/migrate/import/route.ts')
    expect(content).toMatch(/emailSet/)
  })

  it('import route logs results to migration_logs', () => {
    const content = readFile('src/app/api/migrate/import/route.ts')
    expect(content).toMatch(/migration_logs/)
    expect(content).toMatch(/imported.*updated.*skipped/)
  })

  it('import route captures errors to Sentry', () => {
    const content = readFile('src/app/api/migrate/import/route.ts')
    expect(content).toMatch(/Sentry\.captureException/)
  })

  it('import route caps stored errors at 100', () => {
    const content = readFile('src/app/api/migrate/import/route.ts')
    expect(content).toMatch(/\.slice\(0,\s*100\)/)
  })

  it('import route marks service orders as is_historical', () => {
    const content = readFile('src/app/api/migrate/import/route.ts')
    expect(content).toMatch(/is_historical:\s*true/)
  })

  it('import route marks invoices as is_historical', () => {
    const content = readFile('src/app/api/migrate/import/route.ts')
    // Both SO and invoice importers must set is_historical
    const matches = content.match(/is_historical:\s*true/g) || []
    expect(matches.length).toBeGreaterThanOrEqual(2)
  })
})

describe('fullbay sync resilience', () => {
  it('fullbay sync route requires admin roles', () => {
    const content = readFile('src/app/api/fullbay/sync/[type]/route.ts')
    expect(content).toMatch(/ADMIN_ROLES/)
    expect(content).toMatch(/Forbidden|403|Only shop owners/)
  })

  it('fullbay sync logs to fullbay_sync_log', () => {
    const content = readFile('src/app/api/fullbay/sync/[type]/route.ts')
    expect(content).toMatch(/fullbay_sync_log/)
    expect(content).toMatch(/status:\s*'running'/)
    expect(content).toMatch(/status:\s*'completed'/)
    expect(content).toMatch(/status:\s*'failed'/)
  })

  it('fullbay sync captures errors to Sentry', () => {
    const content = readFile('src/app/api/fullbay/sync/[type]/route.ts')
    expect(content).toMatch(/Sentry\.captureException/)
  })

  it('fullbay work-orders sync captures errors to Sentry', () => {
    const content = readFile('src/app/api/fullbay/sync/work-orders/route.ts')
    expect(content).toMatch(/Sentry\.captureException/)
  })

  it('fullbay financial-repull captures errors to Sentry', () => {
    const content = readFile('src/app/api/fullbay/sync/financial-repull/route.ts')
    expect(content).toMatch(/Sentry\.captureException/)
  })
})

// ──────────────────────────────────────────────────────────────
// CRASH HARDENING (Crash1-3 regressions)
// ──────────────────────────────────────────────────────────────

describe('crash hardening regressions', () => {
  it('safeRoute wrapper exists and captures to Sentry', () => {
    const content = readFile('src/lib/api-handler.ts')
    expect(content).toMatch(/Sentry\.captureException/)
    expect(content).toMatch(/status:\s*500/)
    // Response must not include stack traces or SQL in the error message sent to client
    expect(content).toMatch(/An unexpected error occurred/)
  })

  it('route-group error boundaries exist for key areas', () => {
    const areas = ['work-orders', 'mechanic', 'accounting', 'settings']
    for (const area of areas) {
      expect(fileExists(`src/app/${area}/error.tsx`)).toBe(true)
    }
  })

  it('error boundaries capture to Sentry', () => {
    const areas = ['work-orders', 'mechanic', 'accounting', 'settings']
    for (const area of areas) {
      const content = readFile(`src/app/${area}/error.tsx`)
      expect(content).toMatch(/Sentry\.captureException/)
    }
  })

  it('query-limits shared constants exist', () => {
    const content = readFile('src/lib/query-limits.ts')
    expect(content).toMatch(/DEFAULT_PAGE_LIMIT/)
    expect(content).toMatch(/MAX_PAGE_LIMIT/)
    expect(content).toMatch(/parsePageParams/)
  })
})
