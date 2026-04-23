/**
 * TruckZen — Patch 125 Regression-Prevention Behavior Tests
 *
 * These assert actual runtime behavior of the canonical helpers that drive
 * the proven regression hot zones (job recognition + WO parts aggregates +
 * invoice recipient resolution). They complement the static-analysis guards
 * in critical-paths.test.ts by catching drift that keeps the right call
 * sites in place but breaks the canonical logic itself.
 */
import { describe, it, expect } from 'vitest'
import { hasRecognizedVerb, getAutoRoughParts, isDiagnosticJob } from '../lib/parts-suggestions'
import { isPartReceived, PARTS_RECEIVED_STATES, VALID_PARTS_STATUSES, PARTS_PICKUP_STATUS, PARTS_READY_STATUS } from '../lib/parts-status'
import { resolveInvoiceRecipientEmail } from '../lib/notifications/resolveInvoiceRecipientEmail'
import { shouldRedirectForNativeShell, NATIVE_BLOCKED_PATHS, NATIVE_BLOCKED_PREFIXES } from '../lib/native-shell'

// ──────────────────────────────────────────────────────────────
// JOB RECOGNITION — canonical verb-intent helper behavior
// ──────────────────────────────────────────────────────────────
describe('hasRecognizedVerb (Patch 125)', () => {
  it('recognizes deterministic clean/labor-only verb phrases', () => {
    expect(hasRecognizedVerb('clean gas tanks')).toBe(true)
    expect(hasRecognizedVerb('clean oil pan')).toBe(true)
    expect(hasRecognizedVerb('clean rear axles')).toBe(true)
    expect(hasRecognizedVerb('wash trailer')).toBe(true)
    expect(hasRecognizedVerb('full grease')).toBe(true)
    expect(hasRecognizedVerb('grease chassis')).toBe(true)
    expect(hasRecognizedVerb('check lights')).toBe(true)
    expect(hasRecognizedVerb('inspect brakes')).toBe(true)
    expect(hasRecognizedVerb('diagnose ac')).toBe(true)
  })

  it('recognizes part-candidate and material verb phrases', () => {
    expect(hasRecognizedVerb('replace alternator')).toBe(true)
    expect(hasRecognizedVerb('install new starter')).toBe(true)
    expect(hasRecognizedVerb('change oil')).toBe(true)
    expect(hasRecognizedVerb('repair leak')).toBe(true)
  })

  it('returns false for verbless noun-only input (routes to clarification)', () => {
    expect(hasRecognizedVerb('tire')).toBe(false)
    expect(hasRecognizedVerb('alternator')).toBe(false)
  })

  it('returns false for empty / whitespace input', () => {
    expect(hasRecognizedVerb('')).toBe(false)
  })
})

describe('parts-suggestions labor-only rule (Patch 125)', () => {
  it('CLEAN GAS TANKS produces no rough parts (labor-only)', () => {
    expect(getAutoRoughParts('clean gas tanks').filter(p => !p.is_labor)).toHaveLength(0)
  })

  it('CHECK LIGHTS produces no rough parts (labor-only)', () => {
    expect(getAutoRoughParts('check lights').filter(p => !p.is_labor)).toHaveLength(0)
  })

  it('isDiagnosticJob matches existing keyword family', () => {
    expect(isDiagnosticJob('perform diagnostic')).toBe(true)
    expect(isDiagnosticJob('inspection')).toBe(true)
    expect(isDiagnosticJob('replace alternator')).toBe(false)
  })
})

// ──────────────────────────────────────────────────────────────
// WO PARTS AGGREGATES — canonical classifier behavior
// ──────────────────────────────────────────────────────────────
describe('isPartReceived / PARTS_RECEIVED_STATES (Patch 125)', () => {
  it('treats received, ready_for_job, picked_up, installed as received', () => {
    expect(isPartReceived('received')).toBe(true)
    expect(isPartReceived('ready_for_job')).toBe(true)
    expect(isPartReceived('picked_up')).toBe(true)
    expect(isPartReceived('installed')).toBe(true)
  })

  it('treats pre-received statuses as not received', () => {
    expect(isPartReceived('rough')).toBe(false)
    expect(isPartReceived('sourced')).toBe(false)
    expect(isPartReceived('ordered')).toBe(false)
    expect(isPartReceived('canceled')).toBe(false)
  })

  it('treats null / undefined / empty as not received', () => {
    expect(isPartReceived(null)).toBe(false)
    expect(isPartReceived(undefined)).toBe(false)
    expect(isPartReceived('')).toBe(false)
  })

  it('canonical pickup and ready constants match the received set where expected', () => {
    expect(PARTS_RECEIVED_STATES).toContain(PARTS_PICKUP_STATUS)
    expect(PARTS_RECEIVED_STATES).toContain(PARTS_READY_STATUS)
    for (const s of PARTS_RECEIVED_STATES) {
      expect(VALID_PARTS_STATUSES as readonly string[]).toContain(s)
    }
  })
})

// ──────────────────────────────────────────────────────────────
// INVOICE RECIPIENT — canonical resolver behavior
// ──────────────────────────────────────────────────────────────

function fakeSupabaseReturning(checkinEmail: string | null) {
  return {
    from(_table: string) {
      const chain: any = {
        _value: checkinEmail,
        select() { return chain },
        eq() { return chain },
        order() { return chain },
        limit() { return chain },
        async maybeSingle() {
          return checkinEmail ? { data: { contact_email: checkinEmail } } : { data: null }
        },
      }
      return chain
    },
  }
}

describe('resolveInvoiceRecipientEmail (Patch 125)', () => {
  it('prefers kiosk_checkin contact_email when present', async () => {
    const supabase = fakeSupabaseReturning('owner@example.com')
    const out = await resolveInvoiceRecipientEmail(supabase, 'wo-123', 'maintenance@example.com')
    expect(out).toBe('owner@example.com')
  })

  it('falls back to customers.email when no kiosk contact', async () => {
    const supabase = fakeSupabaseReturning(null)
    const out = await resolveInvoiceRecipientEmail(supabase, 'wo-123', 'maintenance@example.com')
    expect(out).toBe('maintenance@example.com')
  })

  it('returns null when neither source has an email', async () => {
    const supabase = fakeSupabaseReturning(null)
    const out = await resolveInvoiceRecipientEmail(supabase, 'wo-123', null)
    expect(out).toBeNull()
  })

  it('skips kiosk lookup when soId is missing and uses fallback', async () => {
    // If soId is falsy the helper must not attempt the kiosk query branch.
    const supabase = fakeSupabaseReturning('should-not-be-read@example.com')
    const out = await resolveInvoiceRecipientEmail(supabase, null, 'customer@example.com')
    expect(out).toBe('customer@example.com')
  })
})

// ──────────────────────────────────────────────────────────────
// NATIVE SHELL — Security_P0_Patch2_NativeBlock_1 (F-06)
// ──────────────────────────────────────────────────────────────
describe('shouldRedirectForNativeShell (F-06)', () => {
  it('blocks exact public marketing/auth/legal paths', () => {
    for (const p of ['/', '/register', '/forgot-password', '/reset-password', '/privacy', '/terms', '/support', '/accept-invite']) {
      expect(shouldRedirectForNativeShell(p), `${p} must be blocked`).toBe(true)
    }
  })

  it('blocks prefix families /portal, /pay, /kiosk, /smart-drop', () => {
    expect(shouldRedirectForNativeShell('/portal')).toBe(true)
    expect(shouldRedirectForNativeShell('/portal/abc123')).toBe(true)
    expect(shouldRedirectForNativeShell('/portal/estimate/xyz')).toBe(true)
    expect(shouldRedirectForNativeShell('/pay')).toBe(true)
    expect(shouldRedirectForNativeShell('/pay/token-123')).toBe(true)
    expect(shouldRedirectForNativeShell('/kiosk')).toBe(true)
    expect(shouldRedirectForNativeShell('/kiosk/shop-code')).toBe(true)
    expect(shouldRedirectForNativeShell('/smart-drop')).toBe(true)
    expect(shouldRedirectForNativeShell('/smart-drop/anything')).toBe(true)
  })

  it('does NOT match path that only starts with a prefix as a substring', () => {
    // /portal is blocked; /portalxyz must not match (prefix family only at segment boundary)
    expect(shouldRedirectForNativeShell('/portalxyz')).toBe(false)
    expect(shouldRedirectForNativeShell('/payment')).toBe(false)
    expect(shouldRedirectForNativeShell('/kiosks-admin')).toBe(false)
  })

  it('does NOT block the login sink or app-safe operational routes', () => {
    expect(shouldRedirectForNativeShell('/login'), '/login is the redirect sink — must NOT be blocked').toBe(false)
    for (const p of ['/dashboard', '/work-orders', '/work-orders/abc', '/mechanic/dashboard', '/parts', '/parts/queue', '/accounting', '/floor-manager/quick-assign', '/maintenance/invoices', '/notifications', '/settings', '/settings/users']) {
      expect(shouldRedirectForNativeShell(p), `${p} must NOT be blocked`).toBe(false)
    }
  })

  it('exports the blocked sets as expected shapes', () => {
    expect(NATIVE_BLOCKED_PATHS).toBeInstanceOf(Set)
    expect(NATIVE_BLOCKED_PATHS.has('/')).toBe(true)
    expect(Array.isArray(NATIVE_BLOCKED_PREFIXES)).toBe(true)
    expect(NATIVE_BLOCKED_PREFIXES).toContain('/portal')
  })
})
