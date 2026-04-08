/**
 * TruckZen — Build/Config Gate Tests
 * Proves: required config/script files exist in repo.
 * Does NOT prove: build succeeds, runtime works, or pages load.
 */
import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { resolve } from 'path'

const root = resolve(__dirname, '../..')

describe('build and config gate', () => {
  it('next.config exists', () => {
    const exists = existsSync(resolve(root, 'next.config.ts')) || existsSync(resolve(root, 'next.config.js')) || existsSync(resolve(root, 'next.config.mjs'))
    expect(exists).toBe(true)
  })

  it('tsconfig.json exists', () => {
    expect(existsSync(resolve(root, 'tsconfig.json'))).toBe(true)
  })

  it('package.json has build script', () => {
    const pkg = require(resolve(root, 'package.json'))
    expect(pkg.scripts.build).toBeDefined()
  })

  it('package.json has test script', () => {
    const pkg = require(resolve(root, 'package.json'))
    expect(pkg.scripts.test).toBeDefined()
  })

  it('package.json has typecheck script', () => {
    const pkg = require(resolve(root, 'package.json'))
    expect(pkg.scripts.typecheck).toBeDefined()
  })
})
