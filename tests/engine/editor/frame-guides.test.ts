import { describe, expect, test } from 'bun:test'

import type { PluginDataEntry } from '@open-pencil/scene-graph'

import {
  DEFAULT_FRAME_GUIDES,
  FRAME_GUIDES_PLUGIN_KEY,
  parseFrameGuides,
  setFrameGuideEdge,
  setFrameGuideLinked,
  upsertFrameGuides
} from '#core/guides/frame'

describe('frame guide settings', () => {
  test('uses safe defaults for missing, malformed, and unsupported data', () => {
    expect(parseFrameGuides([])).toEqual(DEFAULT_FRAME_GUIDES)
    expect(
      parseFrameGuides([
        { pluginId: 'open-pencil', key: FRAME_GUIDES_PLUGIN_KEY, value: '{bad json' }
      ])
    ).toEqual(DEFAULT_FRAME_GUIDES)
    expect(
      parseFrameGuides([
        {
          pluginId: 'open-pencil',
          key: FRAME_GUIDES_PLUGIN_KEY,
          value: JSON.stringify({ version: 2 })
        }
      ])
    ).toEqual(DEFAULT_FRAME_GUIDES)
  })

  test('clamps finite values and preserves unrelated plugin data on upsert', () => {
    const pluginData: PluginDataEntry[] = [
      { pluginId: 'another-plugin', key: 'keep', value: 'yes' },
      { pluginId: 'open-pencil', key: 'other', value: 'also-keep' }
    ]
    const next = structuredClone(DEFAULT_FRAME_GUIDES)
    next.margins.enabled = true
    next.margins.top = 24

    const result = upsertFrameGuides(pluginData, next)
    expect(result.slice(0, 2)).toEqual(pluginData)
    expect(result.filter((entry) => entry.key === FRAME_GUIDES_PLUGIN_KEY)).toHaveLength(1)
    expect(parseFrameGuides(result)).toEqual(next)
  })

  test('applies linked edits and prevents margins from crossing the frame interior', () => {
    const initial = structuredClone(DEFAULT_FRAME_GUIDES)
    const linked = setFrameGuideEdge(initial, 'margins', 'top', 30, 100, 80)
    expect(linked.margins).toMatchObject({ top: 30, right: 30, bottom: 30, left: 30 })

    const unlinked = setFrameGuideLinked(linked, 'margins', false)
    const clamped = setFrameGuideEdge(unlinked, 'margins', 'left', 90, 100, 80)
    expect(clamped.margins.left).toBe(69.999999)
    expect(clamped.margins.right).toBe(30)

    const bleedUnlinked = setFrameGuideLinked(unlinked, 'bleed', false)
    const bleed = setFrameGuideEdge(bleedUnlinked, 'bleed', 'right', 200000, 100, 80)
    expect(bleed.bleed.right).toBe(100000)
    expect(bleed.bleed.left).toBe(16)
  })

  test('relinking copies the top edge to every side', () => {
    const initial = structuredClone(DEFAULT_FRAME_GUIDES)
    initial.margins.linked = false
    initial.margins.top = 12
    initial.margins.right = 20
    initial.margins.bottom = 30
    initial.margins.left = 40

    expect(setFrameGuideLinked(initial, 'margins', true).margins).toMatchObject({
      linked: true,
      top: 12,
      right: 12,
      bottom: 12,
      left: 12
    })
  })
})
