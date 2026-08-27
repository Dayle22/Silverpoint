// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- checked by Bun
import { describe, expect, test } from 'bun:test'

import {
  CAPABILITY_VALUES,
  CAPABILITY_VERSION,
  DEFAULT_CAPABILITY,
  getDefaultCapability,
  normalise
} from '@/app/shell/capability'

describe('persona capability model', () => {
  test('defines essential, advanced, and dev personas in version 2', () => {
    expect(CAPABILITY_VERSION).toBe(2)
    expect(CAPABILITY_VALUES).toEqual(['essential', 'advanced', 'dev'])
    expect(DEFAULT_CAPABILITY).toEqual({
      version: 2,
      capability: 'essential'
    })
  })

  test('defaults to essential for new users and small screens', () => {
    expect(getDefaultCapability()).toBe('essential')
  })

  test('normalises invalid or null inputs to default essential capability', () => {
    expect(normalise(null)).toEqual({ version: 2, capability: 'essential' })
    expect(normalise(undefined)).toEqual({ version: 2, capability: 'essential' })
    expect(normalise({})).toEqual({ version: 2, capability: 'essential' })
    expect(normalise({ version: 2, capability: 'invalid' })).toEqual({
      version: 2,
      capability: 'essential'
    })
  })

  test('preserves valid v2 persona capabilities', () => {
    expect(normalise({ version: 2, capability: 'essential' })).toEqual({
      version: 2,
      capability: 'essential'
    })
    expect(normalise({ version: 2, capability: 'advanced' })).toEqual({
      version: 2,
      capability: 'advanced'
    })
    expect(normalise({ version: 2, capability: 'dev' })).toEqual({
      version: 2,
      capability: 'dev'
    })
  })

  test('migrates legacy v1 capabilities: simple -> essential, full -> advanced', () => {
    expect(normalise({ version: 1, capability: 'simple' })).toEqual({
      version: 2,
      capability: 'essential'
    })
    expect(normalise({ version: 1, capability: 'full' })).toEqual({
      version: 2,
      capability: 'advanced'
    })
    expect(normalise({ capability: 'simple' })).toEqual({
      version: 2,
      capability: 'essential'
    })
    expect(normalise({ capability: 'full' })).toEqual({
      version: 2,
      capability: 'advanced'
    })
  })
})
