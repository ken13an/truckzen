/**
 * TruckZen — Repo Structure Smoke Tests
 * Proves: key TruckZen page/route directories still exist in the repo.
 * Does NOT prove: pages render, routes return 200, or features work end-to-end.
 */
import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { resolve } from 'path'

const root = resolve(__dirname, '../..')

const REQUIRED_SURFACES = [
  // Pages
  'src/app/login',
  'src/app/work-orders',
  'src/app/accounting',
  'src/app/maintenance',
  'src/app/parts',
  'src/app/shop-floor',
  'src/app/dashboard',
  'src/app/settings',
  // API routes
  'src/app/api/work-orders',
  'src/app/api/export',
  'src/app/api/billing',
  'src/app/api/maintenance/crud',
  'src/app/api/fullbay/sync/financial-repull',
  'src/app/api/accounting',
  'src/app/api/invoices',
  'src/app/api/mechanic',
  'src/app/api/users',
  // Shared libs
  'src/lib/roles.ts',
  'src/lib/server-auth.ts',
  'src/lib/getPermissions.ts',
  'src/lib/invoice-lock.ts',
  'src/lib/invoice-calc.ts',
  'src/lib/auth.ts',
  'src/lib/route-guards.ts',
]

describe('repo structure smoke checks', () => {
  for (const surface of REQUIRED_SURFACES) {
    it(`${surface} exists`, () => {
      expect(existsSync(resolve(root, surface))).toBe(true)
    })
  }
})
