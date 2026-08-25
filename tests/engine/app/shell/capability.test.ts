// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- this Bun test file is excluded from tsconfig and checked by Bun rather than Oxlint's standalone resolver.
import { beforeEach, describe, expect, test } from 'bun:test'

import {
  appCapability,
  capability,
  CAPABILITY_VERSION,
  DEFAULT_CAPABILITY,
  isSimple,
  normalise,
  setCapability
} from '@/app/shell/capability'

describe('capability store', () => {
  beforeEach(() => {
    setCapability('full')
  })

  test('default capability is full', () => {
    setCapability('full')
    expect(appCapability.value).toEqual({ version: CAPABILITY_VERSION, capability: 'full' })
    expect(capability.value).toBe('full')
    expect(isSimple.value).toBe(false)
  })

  test('valid simple record round-trips and updates state', () => {
    setCapability('simple')
    expect(capability.value).toBe('simple')
    expect(isSimple.value).toBe(true)
    expect(appCapability.value).toEqual({ version: CAPABILITY_VERSION, capability: 'simple' })

    setCapability('full')
    expect(capability.value).toBe('full')
    expect(isSimple.value).toBe(false)
    expect(appCapability.value).toEqual({ version: CAPABILITY_VERSION, capability: 'full' })
  })

  test('normalise returns full for non-object or null input', () => {
    expect(normalise(null)).toEqual(DEFAULT_CAPABILITY)
    expect(normalise(undefined)).toEqual(DEFAULT_CAPABILITY)
    expect(normalise('invalid')).toEqual(DEFAULT_CAPABILITY)
    expect(normalise(123)).toEqual(DEFAULT_CAPABILITY)
  })

  test('normalise returns full for wrong version', () => {
    expect(normalise({ version: 999, capability: 'simple' })).toEqual(DEFAULT_CAPABILITY)
    expect(normalise({ version: 0, capability: 'simple' })).toEqual(DEFAULT_CAPABILITY)
  })

  test('normalise returns full for missing field', () => {
    expect(normalise({ version: CAPABILITY_VERSION })).toEqual(DEFAULT_CAPABILITY)
    expect(normalise({ capability: 'simple' })).toEqual(DEFAULT_CAPABILITY)
  })

  test('normalise returns full for unknown capability string', () => {
    expect(
      normalise({ version: CAPABILITY_VERSION, capability: 'unknown_mode' })
    ).toEqual(DEFAULT_CAPABILITY)
    expect(
      normalise({ version: CAPABILITY_VERSION, capability: 'workspace' })
    ).toEqual(DEFAULT_CAPABILITY)
  })

  test('normalise preserves valid simple and full records', () => {
    expect(normalise({ version: CAPABILITY_VERSION, capability: 'simple' })).toEqual({
      version: CAPABILITY_VERSION,
      capability: 'simple'
    })
    expect(normalise({ version: CAPABILITY_VERSION, capability: 'full' })).toEqual({
      version: CAPABILITY_VERSION,
      capability: 'full'
    })
  })
})
