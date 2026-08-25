import { describe, expect, test } from 'bun:test'

import { rulerLabel, rulerStep } from '@open-pencil/core/canvas/rulers'
import {
  DEFAULT_DOCUMENT_UNITS,
  pxToUnit,
  unitToPx,
  type DocumentUnits
} from '@open-pencil/core/units'

function mockRenderer(zoom: number, units: DocumentUnits = DEFAULT_DOCUMENT_UNITS) {
  return {
    zoom,
    documentUnits: units
  }
}

describe('ruler step and label calculations', () => {
  test('px ruler step maintains 1/2/5 decade behavior', () => {
    // Target spacing is 100 screen pixels.
    // zoom = 1.0 -> rawStep = 100 -> magnitude 100, normalized 1 -> step = 100
    const r1 = mockRenderer(1.0, { unit: 'px', dpi: 300 })
    expect(rulerStep(r1)).toBe(100)

    // zoom = 2.0 -> rawStep = 50 -> magnitude 10, normalized 5 -> step = 50
    const r2 = mockRenderer(2.0, { unit: 'px', dpi: 300 })
    expect(rulerStep(r2)).toBe(50)

    // zoom = 0.5 -> rawStep = 200 -> magnitude 100, normalized 2 -> step = 200
    const r3 = mockRenderer(0.5, { unit: 'px', dpi: 300 })
    expect(rulerStep(r3)).toBe(200)
  })

  test('mm ruler step selects correct ladder entries', () => {
    // 300 DPI: 1 mm = 300 / 25.4 = 11.811 px.
    // Target spacing 100 px.
    // At zoom = 1.0, targetWorldPx = 100 px = 8.466 mm.
    // Smallest ladder entry >= 8.466 is 10 mm.
    // Step in px = 10 * 11.8110236 = 118.110236 px.
    const r1 = mockRenderer(1.0, { unit: 'mm', dpi: 300 })
    const step1 = rulerStep(r1)
    expect(pxToUnit(step1, { unit: 'mm', dpi: 300 })).toBeCloseTo(10, 5)

    // At zoom = 4.0, targetWorldPx = 25 px = 2.116 mm.
    // Smallest ladder entry >= 2.116 is 5 mm.
    const r2 = mockRenderer(4.0, { unit: 'mm', dpi: 300 })
    const step2 = rulerStep(r2)
    expect(pxToUnit(step2, { unit: 'mm', dpi: 300 })).toBeCloseTo(5, 5)

    // At zoom = 0.1, targetWorldPx = 1000 px = 84.66 mm.
    // Smallest ladder entry >= 84.66 is 100 mm.
    const r3 = mockRenderer(0.1, { unit: 'mm', dpi: 300 })
    const step3 = rulerStep(r3)
    expect(pxToUnit(step3, { unit: 'mm', dpi: 300 })).toBeCloseTo(100, 5)
  })

  test('in ruler step selects binary fractions and inch ladder entries', () => {
    // 300 DPI: 1 in = 300 px.
    // Target spacing 100 px.
    // At zoom = 1.0, targetWorldPx = 100 px = 0.333 in.
    // Smallest ladder entry >= 0.333 is 0.5 in.
    const r1 = mockRenderer(1.0, { unit: 'in', dpi: 300 })
    const step1 = rulerStep(r1)
    expect(pxToUnit(step1, { unit: 'in', dpi: 300 })).toBeCloseTo(0.5, 5)

    // At zoom = 4.0, targetWorldPx = 25 px = 0.0833 in.
    // Smallest ladder entry >= 0.0833 is 0.125 in.
    const r2 = mockRenderer(4.0, { unit: 'in', dpi: 300 })
    const step2 = rulerStep(r2)
    expect(pxToUnit(step2, { unit: 'in', dpi: 300 })).toBeCloseTo(0.125, 5)

    // At zoom = 0.05, targetWorldPx = 2000 px = 6.666 in.
    // Smallest ladder entry >= 6.666 is 10 in.
    const r3 = mockRenderer(0.05, { unit: 'in', dpi: 300 })
    const step3 = rulerStep(r3)
    expect(pxToUnit(step3, { unit: 'in', dpi: 300 })).toBeCloseTo(10, 5)
  })

  test('rulerLabel formats in active units without suffix', () => {
    const pxUnits: DocumentUnits = { unit: 'px', dpi: 300 }
    expect(rulerLabel(150, pxUnits)).toBe('150')

    const mmUnits: DocumentUnits = { unit: 'mm', dpi: 300 }
    const mm10Px = unitToPx(10, mmUnits)
    expect(rulerLabel(mm10Px, mmUnits)).toBe('10')

    const inUnits: DocumentUnits = { unit: 'in', dpi: 300 }
    const in25Px = unitToPx(2.5, inUnits)
    expect(rulerLabel(in25Px, inUnits)).toBe('2.5')
  })
})
