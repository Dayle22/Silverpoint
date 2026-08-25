// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- this Bun test file is excluded from tsconfig and checked by Bun rather than Oxlint's standalone resolver.
import { describe, expect, test } from 'bun:test'

import { PANEL_REGISTRY } from '@/app/shell/panels/registry'
import { PANEL_IDS } from '@/app/shell/panels/types'

describe('panel registry', () => {
  test('freezes the stable order, ownership IDs and Window menu IDs', () => {
    expect(PANEL_REGISTRY.map((entry) => entry.id)).toEqual([...PANEL_IDS])
    expect(new Set(PANEL_REGISTRY.map((entry) => entry.id)).size).toBe(PANEL_IDS.length)
    expect(PANEL_REGISTRY.map((entry) => entry.menuId)).toEqual(PANEL_IDS.map((id) => `window-panel-${id}`))
    expect(PANEL_REGISTRY.every((entry) => entry.labelKey === entry.id)).toBe(true)
  })

  test('declares sizing kinds and default heights for every panel', () => {
    expect(PANEL_REGISTRY.every((entry) => entry.sizing === 'fill' || entry.sizing === 'content')).toBe(true)
    const fillIds = PANEL_REGISTRY.filter((entry) => entry.sizing === 'fill').map((entry) => entry.id)
    expect(fillIds).toEqual(['pages', 'history', 'assets', 'layers', 'swatches', 'ai', 'code'])
    const contentEntries = PANEL_REGISTRY.filter((entry) => entry.sizing === 'content')
    expect(contentEntries.every((entry) => entry.defaultHeight === 0)).toBe(true)
    expect(PANEL_REGISTRY.find((entry) => entry.id === 'pages')?.defaultHeight).toBe(200)
    expect(PANEL_REGISTRY.find((entry) => entry.id === 'history')?.defaultHeight).toBe(320)
    expect(PANEL_REGISTRY.find((entry) => entry.id === 'assets')?.defaultHeight).toBe(320)
    expect(PANEL_REGISTRY.find((entry) => entry.id === 'layers')?.defaultHeight).toBe(320)
    expect(PANEL_REGISTRY.find((entry) => entry.id === 'swatches')?.defaultHeight).toBe(280)
    expect(PANEL_REGISTRY.find((entry) => entry.id === 'ai')?.defaultHeight).toBe(420)
    expect(PANEL_REGISTRY.find((entry) => entry.id === 'code')?.defaultHeight).toBe(380)
  })

  test('declares defaultGroupIndex and defaultTabIndex for every panel in registry', () => {
    expect(PANEL_REGISTRY.every((entry) => typeof entry.defaultGroupIndex === 'number')).toBe(true)
    expect(PANEL_REGISTRY.every((entry) => typeof entry.defaultTabIndex === 'number')).toBe(true)
    expect(PANEL_REGISTRY.find((entry) => entry.id === 'pages')?.defaultGroupIndex).toBe(0)
    expect(PANEL_REGISTRY.find((entry) => entry.id === 'history')?.defaultGroupIndex).toBe(1)
    expect(PANEL_REGISTRY.find((entry) => entry.id === 'assets')?.defaultGroupIndex).toBe(1)
    expect(PANEL_REGISTRY.find((entry) => entry.id === 'layers')?.defaultGroupIndex).toBe(1)
    expect(PANEL_REGISTRY.find((entry) => entry.id === 'swatches')?.defaultGroupIndex).toBe(2)
    expect(PANEL_REGISTRY.find((entry) => entry.id === 'transform')?.defaultGroupIndex).toBe(0)
    expect(PANEL_REGISTRY.find((entry) => entry.id === 'appearance')?.defaultGroupIndex).toBe(1)
    expect(PANEL_REGISTRY.find((entry) => entry.id === 'appearance')?.defaultTabIndex).toBe(0)
    expect(PANEL_REGISTRY.find((entry) => entry.id === 'text')?.defaultGroupIndex).toBe(1)
    expect(PANEL_REGISTRY.find((entry) => entry.id === 'text')?.defaultTabIndex).toBe(1)
    expect(PANEL_REGISTRY.find((entry) => entry.id === 'page')?.defaultGroupIndex).toBe(2)
    expect(PANEL_REGISTRY.find((entry) => entry.id === 'page')?.defaultTabIndex).toBe(0)
    expect(PANEL_REGISTRY.find((entry) => entry.id === 'guides')?.defaultGroupIndex).toBe(2)
    expect(PANEL_REGISTRY.find((entry) => entry.id === 'guides')?.defaultTabIndex).toBe(1)
  })
})

