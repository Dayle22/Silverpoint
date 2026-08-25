import { describe, expect, test } from 'bun:test'

import {
  applyAdjustmentRgb,
  normaliseAdjustment
} from '@open-pencil/scene-graph/effect-adjustments'

describe('adjustment parameters', () => {
  test('clamps each adjustment type to its supported range', () => {
    expect(normaliseAdjustment({ type: 'BRIGHTNESS_CONTRAST', brightness: -140, contrast: 120 })).toEqual({
      type: 'BRIGHTNESS_CONTRAST',
      brightness: -100,
      contrast: 100
    })
    expect(normaliseAdjustment({ type: 'SATURATION', saturation: 240 })).toEqual({
      type: 'SATURATION',
      saturation: 200
    })
    expect(normaliseAdjustment({ type: 'CURVES', gamma: 0 })).toEqual({
      type: 'CURVES',
      gamma: 0.1
    })
  })

  test('applies brightness/contrast, saturation, and gamma in order', () => {
    const result = applyAdjustmentRgb(
      [0.5, 0.25, 0.75],
      [
        { type: 'BRIGHTNESS_CONTRAST', brightness: 10, contrast: 0 },
        { type: 'SATURATION', saturation: 0 },
        { type: 'CURVES', gamma: 2 }
      ]
    )

    const expected = Math.sqrt(0.6 * 0.2126 + 0.35 * 0.7152 + 0.85 * 0.0722)
    expect(result[0]).toBeCloseTo(expected, 6)
    expect(result[1]).toBeCloseTo(expected, 6)
    expect(result[2]).toBeCloseTo(expected, 6)
  })
})
