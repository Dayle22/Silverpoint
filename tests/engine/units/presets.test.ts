import { describe, expect, test } from 'bun:test'

import {
  DPI_PRESETS,
  FRAME_GUIDE_MAX,
  FRAME_PRESETS,
  unitToPx,
  type FramePresetDefinition
} from '@open-pencil/core'

function getPreset(id: string): FramePresetDefinition {
  const preset = FRAME_PRESETS.find((p) => p.id === id)
  if (!preset) throw new Error(`Missing preset: ${id}`)
  return preset
}

describe('frame presets', () => {
  test('preset IDs are unique, non-empty, and stable', () => {
    const ids = FRAME_PRESETS.map((p) => p.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(FRAME_PRESETS.length)
    expect(ids).toEqual([
      'square-1080',
      'story-1080x1920',
      'portrait-1080x1440',
      'a4',
      'us-letter',
      'business-card',
      'poster',
      'tri-fold'
    ])
    for (const preset of FRAME_PRESETS) {
      expect(preset.id.length).toBeGreaterThan(0)
      expect(preset.labelKey.length).toBeGreaterThan(0)
      expect(preset.width).toBeGreaterThan(0)
      expect(preset.height).toBeGreaterThan(0)
      expect(['screen', 'print']).toContain(preset.group)
      expect(['px', 'mm', 'in']).toContain(preset.unit)
    }
  })

  test('converts each preset to expected pixel dimensions at 300 DPI (hand-computed)', () => {
    const a4 = getPreset('a4')
    expect(unitToPx(a4.width, { unit: a4.unit, dpi: 300 })).toBeCloseTo(2480.3149606, 6)
    expect(unitToPx(a4.height, { unit: a4.unit, dpi: 300 })).toBeCloseTo(3507.8740157, 6)
    expect(a4.margin).toBeDefined()
    expect(a4.bleed).toBeDefined()
    if (a4.margin && a4.bleed) {
      expect(unitToPx(a4.margin.value, { unit: a4.margin.unit, dpi: 300 })).toBeCloseTo(118.1102362, 6)
      expect(unitToPx(a4.bleed.value, { unit: a4.bleed.unit, dpi: 300 })).toBeCloseTo(35.4330708, 6)
    }

    const letter = getPreset('us-letter')
    expect(unitToPx(letter.width, { unit: letter.unit, dpi: 300 })).toBe(2550)
    expect(unitToPx(letter.height, { unit: letter.unit, dpi: 300 })).toBe(3300)
    expect(letter.margin).toBeDefined()
    expect(letter.bleed).toBeDefined()
    if (letter.margin && letter.bleed) {
      expect(unitToPx(letter.margin.value, { unit: letter.margin.unit, dpi: 300 })).toBe(150)
      expect(unitToPx(letter.bleed.value, { unit: letter.bleed.unit, dpi: 300 })).toBe(37.5)
    }

    const bcard = getPreset('business-card')
    expect(unitToPx(bcard.width, { unit: bcard.unit, dpi: 300 })).toBe(1050)
    expect(unitToPx(bcard.height, { unit: bcard.unit, dpi: 300 })).toBe(600)
    expect(bcard.margin).toBeDefined()
    expect(bcard.bleed).toBeDefined()
    if (bcard.margin && bcard.bleed) {
      expect(unitToPx(bcard.margin.value, { unit: bcard.margin.unit, dpi: 300 })).toBe(37.5)
      expect(unitToPx(bcard.bleed.value, { unit: bcard.bleed.unit, dpi: 300 })).toBe(37.5)
    }

    const poster = getPreset('poster')
    expect(unitToPx(poster.width, { unit: poster.unit, dpi: 300 })).toBe(5400)
    expect(unitToPx(poster.height, { unit: poster.unit, dpi: 300 })).toBe(7200)
    expect(poster.margin).toBeDefined()
    expect(poster.bleed).toBeDefined()
    if (poster.margin && poster.bleed) {
      expect(unitToPx(poster.margin.value, { unit: poster.margin.unit, dpi: 300 })).toBe(150)
      expect(unitToPx(poster.bleed.value, { unit: poster.bleed.unit, dpi: 300 })).toBe(37.5)
    }

    const trifold = getPreset('tri-fold')
    expect(unitToPx(trifold.width, { unit: trifold.unit, dpi: 300 })).toBe(3300)
    expect(unitToPx(trifold.height, { unit: trifold.unit, dpi: 300 })).toBe(2550)
    expect(trifold.margin).toBeDefined()
    expect(trifold.bleed).toBeDefined()
    if (trifold.margin && trifold.bleed) {
      expect(unitToPx(trifold.margin.value, { unit: trifold.margin.unit, dpi: 300 })).toBe(75)
      expect(unitToPx(trifold.bleed.value, { unit: trifold.bleed.unit, dpi: 300 })).toBe(37.5)
    }
    expect(trifold.panels).toBe(3)

    const square = getPreset('square-1080')
    expect(unitToPx(square.width, { unit: square.unit, dpi: 300 })).toBe(1080)
    expect(unitToPx(square.height, { unit: square.unit, dpi: 300 })).toBe(1080)

    const story = getPreset('story-1080x1920')
    expect(unitToPx(story.width, { unit: story.unit, dpi: 300 })).toBe(1080)
    expect(unitToPx(story.height, { unit: story.unit, dpi: 300 })).toBe(1920)

    const portraitScreen = getPreset('portrait-1080x1440')
    expect(unitToPx(portraitScreen.width, { unit: portraitScreen.unit, dpi: 300 })).toBe(1080)
    expect(unitToPx(portraitScreen.height, { unit: portraitScreen.unit, dpi: 300 })).toBe(1440)
  })

  test('converts print presets accurately at 96 DPI (hand-computed)', () => {
    const a4 = getPreset('a4')
    expect(unitToPx(a4.width, { unit: a4.unit, dpi: 96 })).toBeCloseTo(793.7007874, 6)
    expect(unitToPx(a4.height, { unit: a4.unit, dpi: 96 })).toBeCloseTo(1122.519685, 6)

    const letter = getPreset('us-letter')
    expect(unitToPx(letter.width, { unit: letter.unit, dpi: 96 })).toBe(816)
    expect(unitToPx(letter.height, { unit: letter.unit, dpi: 96 })).toBe(1056)

    const bcard = getPreset('business-card')
    expect(unitToPx(bcard.width, { unit: bcard.unit, dpi: 96 })).toBe(336)
    expect(unitToPx(bcard.height, { unit: bcard.unit, dpi: 96 })).toBe(192)

    const poster = getPreset('poster')
    expect(unitToPx(poster.width, { unit: poster.unit, dpi: 96 })).toBe(1728)
    expect(unitToPx(poster.height, { unit: poster.unit, dpi: 96 })).toBe(2304)

    const trifold = getPreset('tri-fold')
    expect(unitToPx(trifold.width, { unit: trifold.unit, dpi: 96 })).toBe(1056)
    expect(unitToPx(trifold.height, { unit: trifold.unit, dpi: 96 })).toBe(816)
  })

  test('every preset dimensions stay inside FRAME_GUIDE_MAX across standard DPI presets', () => {
    for (const preset of FRAME_PRESETS) {
      for (const dpi of [...DPI_PRESETS, 2400]) {
        const wPx = unitToPx(preset.width, { unit: preset.unit, dpi })
        const hPx = unitToPx(preset.height, { unit: preset.unit, dpi })
        expect(wPx).toBeLessThan(FRAME_GUIDE_MAX)
        expect(hPx).toBeLessThan(FRAME_GUIDE_MAX)
        if (preset.margin) {
          const mPx = unitToPx(preset.margin.value, { unit: preset.margin.unit, dpi })
          expect(mPx).toBeLessThan(FRAME_GUIDE_MAX)
        }
        if (preset.bleed) {
          const bPx = unitToPx(preset.bleed.value, { unit: preset.bleed.unit, dpi })
          expect(bPx).toBeLessThan(FRAME_GUIDE_MAX)
        }
      }
    }
  })

  test('orientation swap toggles long and short dimensions correctly', () => {
    function resolveOriented(preset: FramePresetDefinition, orientation: 'portrait' | 'landscape') {
      const w = orientation === 'landscape' ? Math.max(preset.width, preset.height) : Math.min(preset.width, preset.height)
      const h = orientation === 'landscape' ? Math.min(preset.width, preset.height) : Math.max(preset.width, preset.height)
      return { w, h }
    }

    const a4 = getPreset('a4')
    expect(resolveOriented(a4, 'landscape')).toEqual({ w: 297, h: 210 })
    expect(resolveOriented(a4, 'portrait')).toEqual({ w: 210, h: 297 })

    const trifold = getPreset('tri-fold')
    expect(resolveOriented(trifold, 'landscape')).toEqual({ w: 11, h: 8.5 })
    expect(resolveOriented(trifold, 'portrait')).toEqual({ w: 8.5, h: 11 })
  })
})
