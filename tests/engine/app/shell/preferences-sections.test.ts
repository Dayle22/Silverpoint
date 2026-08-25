// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- this Bun test file is excluded from tsconfig and checked by Bun rather than Oxlint's standalone resolver.
import { describe, expect, test } from 'bun:test'

import {
  DEFAULT_PREFERENCES_SECTION,
  PREFERENCES_SECTION_IDS,
  normalisePreferencesSection
} from '@/app/shell/preferences-sections'

describe('preferences sections', () => {
  test('defines the six section ids in fixed order', () => {
    expect(PREFERENCES_SECTION_IDS).toEqual([
      'appearance',
      'canvas',
      'guides',
      'capabilities',
      'ai',
      'shortcuts'
    ])
    expect(DEFAULT_PREFERENCES_SECTION).toBe('appearance')
  })

  test('normalises valid section ids unchanged', () => {
    for (const id of PREFERENCES_SECTION_IDS) {
      expect(normalisePreferencesSection(id)).toBe(id)
    }
  })

  test('falls back to default for invalid values', () => {
    expect(normalisePreferencesSection('nope')).toBe(DEFAULT_PREFERENCES_SECTION)
    expect(normalisePreferencesSection('')).toBe(DEFAULT_PREFERENCES_SECTION)
    expect(normalisePreferencesSection(null)).toBe(DEFAULT_PREFERENCES_SECTION)
    expect(normalisePreferencesSection(undefined)).toBe(DEFAULT_PREFERENCES_SECTION)
    expect(normalisePreferencesSection(42)).toBe(DEFAULT_PREFERENCES_SECTION)
    expect(normalisePreferencesSection({})).toBe(DEFAULT_PREFERENCES_SECTION)
  })
})
