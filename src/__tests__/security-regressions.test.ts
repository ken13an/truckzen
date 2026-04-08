/**
 * TruckZen — Static Security Regression Tests
 * Proves: known-bad patterns do NOT exist in sensitive files.
 * Does NOT prove: auth actually works at runtime, or that no new vulnerabilities exist elsewhere.
 *
 * These tests use static file content analysis (grep-style) to catch regressions
 * in files that have been specifically hardened in Security P0-P4 patches.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const root = resolve(__dirname, '../..')

function readFile(path: string): string {
  return readFileSync(resolve(root, path), 'utf-8')
}

describe('no hardcoded platform-owner email in permission helpers', () => {
  const files = [
    'src/lib/getPermissions.ts',
    'src/lib/server-auth.ts',
    'src/lib/route-guards.ts',
  ]

  for (const file of files) {
    it(`${file} has no hardcoded email for platform-owner check`, () => {
      const content = readFile(file)
      // Must not contain hardcoded email addresses used for platform-owner detection
      expect(content).not.toMatch(/PLATFORM_OWNER_EMAIL/)
      expect(content).not.toMatch(/blvckdragonken@/)
      expect(content).not.toMatch(/email\s*===?\s*['"][^'"]+@[^'"]+['"]/)
    })
  }
})

describe('no frontend-trusted auth in maintenance/crud route', () => {
  it('maintenance/crud does not trust body.shop_id for auth', () => {
    const content = readFile('src/app/api/maintenance/crud/route.ts')
    // shop_id must come from session, not from request body for auth decisions
    expect(content).not.toMatch(/body\.shop_id/)
    expect(content).not.toMatch(/body\.user_id/)
  })

  it('maintenance/crud does not trust query param shop_id for auth', () => {
    const content = readFile('src/app/api/maintenance/crud/route.ts')
    // The route reads table from searchParams which is fine (allowlisted),
    // but shop_id must not be used from query params for data scoping
    expect(content).not.toMatch(/searchParams\.get\(['"]shop_id['"]\)/)
    expect(content).not.toMatch(/searchParams\.get\(['"]user_id['"]\)/)
  })
})

describe('no raw service key bypass in financial-repull', () => {
  it('financial-repull does not trust body for role/auth', () => {
    const content = readFile('src/app/api/fullbay/sync/financial-repull/route.ts')
    expect(content).not.toMatch(/body\.user_role/)
    expect(content).not.toMatch(/body\.user_id/)
  })
})

describe('impersonation-aware permission helpers (Security P3)', () => {
  it('getPermissions checks impersonate_role before granting full access', () => {
    const content = readFile('src/lib/getPermissions.ts')
    // Must reference impersonate_role somewhere in the permission logic
    expect(content).toMatch(/impersonate_role/)
    // Must NOT have a bare "if (isPlatformOwner) return FULL_ACCESS" without impersonation check
    expect(content).not.toMatch(/if\s*\(isPlatformOwner\)\s*\{?\s*return\s*\{?\s*\.\.\.FULL_ACCESS/)
  })

  it('requireRoles checks impersonate_role before bypassing', () => {
    const content = readFile('src/lib/server-auth.ts')
    // The requireRoles function must reference impersonate_role
    const fnMatch = content.match(/function requireRoles[\s\S]*?^}/m)
    expect(fnMatch).not.toBeNull()
    expect(fnMatch![0]).toMatch(/impersonate_role/)
  })

  it('requireRole in route-guards checks impersonate_role before bypassing', () => {
    const content = readFile('src/lib/route-guards.ts')
    const fnMatch = content.match(/function requireRole[\s\S]*?^}/m)
    expect(fnMatch).not.toBeNull()
    expect(fnMatch![0]).toMatch(/impersonate_role/)
  })
})

describe('shared role constants are canonical source (Security P2)', () => {
  it('roles.ts exports ADMIN_ROLES', () => {
    const content = readFile('src/lib/roles.ts')
    expect(content).toMatch(/export const ADMIN_ROLES/)
  })

  it('roles.ts exports ACCOUNTING_ROLES', () => {
    const content = readFile('src/lib/roles.ts')
    expect(content).toMatch(/export const ACCOUNTING_ROLES/)
  })

  it('roles.ts exports INVOICE_ACTION_ROLES', () => {
    const content = readFile('src/lib/roles.ts')
    expect(content).toMatch(/export const INVOICE_ACTION_ROLES/)
  })

  it('invoice-lock.ts imports from roles.ts instead of defining own arrays', () => {
    const content = readFile('src/lib/invoice-lock.ts')
    expect(content).toMatch(/from ['"]@\/lib\/roles['"]/)
    // Must NOT have a locally-defined array for ACCOUNTING_EDIT_ROLES
    expect(content).not.toMatch(/ACCOUNTING_EDIT_ROLES\s*=\s*\[/)
  })

  it('route-guards.ts imports from roles.ts instead of defining own arrays', () => {
    const content = readFile('src/lib/route-guards.ts')
    expect(content).toMatch(/from ['"]@\/lib\/roles['"]/)
    // Must NOT have locally-defined ACCOUNTING_ROLES or MANAGEMENT_ROLES arrays
    expect(content).not.toMatch(/ACCOUNTING_ROLES\s*=\s*\[/)
    expect(content).not.toMatch(/MANAGEMENT_ROLES\s*=\s*\[/)
  })
})
