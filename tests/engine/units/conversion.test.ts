import { describe, expect, test } from 'bun:test'

import {
  DEFAULT_DOCUMENT_UNITS,
  DPI_PRESETS,
  formatUnitValue,
  normalizeDocumentUnits,
  pxPerUnit,
  pxToUnit,
  resolveUnitCommitPx,
  unitStepLadder,
  unitToPx,
  type DocumentUnits
} from '@open-pencil/core/units'

describe('units conversion', () => {
  test('pxPerUnit across all DPI presets', () => {
    for (const dpi of DPI_PRESETS) {
      expect(pxPerUnit({ unit: 'px', dpi })).toBe(1)
      expect(pxPerUnit({ unit: 'in', dpi })).toBe(dpi)
      expect(pxPerUnit({ unit: 'mm', dpi })).toBeCloseTo(dpi / 25.4, 10)
      expect(pxPerUnit({ unit: 'cm', dpi })).toBeCloseTo(dpi / 2.54, 10)
    }
  })

  test('25.4 mm === 1 in at every DPI preset', () => {
    for (const dpi of DPI_PRESETS) {
      const mmPx = unitToPx(25.4, { unit: 'mm', dpi })
      const inPx = unitToPx(1, { unit: 'in', dpi })
      expect(mmPx).toBeCloseTo(inPx, 9)
      expect(mmPx).toBeCloseTo(dpi, 9)

      const cmPx = unitToPx(2.54, { unit: 'cm', dpi })
      expect(cmPx).toBeCloseTo(inPx, 9)
    }
  })

  test('pxToUnit and unitToPx are inverses', () => {
    const unitsList: DocumentUnits[] = [
      { unit: 'px', dpi: 300 },
      { unit: 'mm', dpi: 300 },
      { unit: 'cm', dpi: 150 },
      { unit: 'in', dpi: 600 }
    ]

    for (const units of unitsList) {
      const values = [0, 1, 10, 25.4, 100, 500.5, -20]
      for (const v of values) {
        const px = unitToPx(v, units)
        const back = pxToUnit(px, units)
        expect(back).toBeCloseTo(v, 9)
      }
    }
  })

  test('formatUnitValue decimals and zero trimming', () => {
    const pxUnits: DocumentUnits = { unit: 'px', dpi: 300 }
    expect(formatUnitValue(0, pxUnits)).toBe('0')
    expect(formatUnitValue(25.4, pxUnits)).toBe('25')
    expect(formatUnitValue(25.6, pxUnits)).toBe('26')

    const mmUnits: DocumentUnits = { unit: 'mm', dpi: 300 }
    // 300 px at 300 dpi mm = 25.4 mm
    expect(formatUnitValue(300, mmUnits)).toBe('25.4')
    // 300 / (300/25.4) = 25.4
    // 1 mm in px = 300 / 25.4
    expect(formatUnitValue(300 / 25.4, mmUnits)).toBe('1')
    // 0.13 mm in px = 0.13 * (300 / 25.4)
    expect(formatUnitValue(0.13 * (300 / 25.4), mmUnits)).toBe('0.13')
    expect(formatUnitValue(0, mmUnits)).toBe('0')
  })

  test('normalizeDocumentUnits handles valid and garbage inputs safely', () => {
    expect(normalizeDocumentUnits(null)).toEqual(DEFAULT_DOCUMENT_UNITS)
    expect(normalizeDocumentUnits(undefined)).toEqual(DEFAULT_DOCUMENT_UNITS)
    expect(normalizeDocumentUnits('px')).toEqual(DEFAULT_DOCUMENT_UNITS)
    expect(normalizeDocumentUnits([])).toEqual(DEFAULT_DOCUMENT_UNITS)
    expect(normalizeDocumentUnits({})).toEqual(DEFAULT_DOCUMENT_UNITS)
    expect(normalizeDocumentUnits({ unit: 'unknown', dpi: -50 })).toEqual({
      unit: 'px',
      dpi: 1
    })
    expect(normalizeDocumentUnits({ unit: 'mm', dpi: 99999 })).toEqual({
      unit: 'mm',
      dpi: 2400
    })
    expect(normalizeDocumentUnits({ unit: 'in', dpi: 300.4 })).toEqual({
      unit: 'in',
      dpi: 300
    })
    expect(normalizeDocumentUnits({ unit: 'cm', dpi: 150 })).toEqual({
      unit: 'cm',
      dpi: 150
    })
  })

  test('unitStepLadder returns correct sequences', () => {
    expect(unitStepLadder('px')).toEqual([1, 2, 5, 10])
    expect(unitStepLadder('mm')).toEqual([1, 2, 5, 10, 20, 50, 100, 200, 500, 1000])
    expect(unitStepLadder('cm')).toEqual([0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100])
    expect(unitStepLadder('in')).toEqual([0.125, 0.25, 0.5, 1, 2, 5, 10, 25, 50, 100])
  })

  test('no-drift round trip: committing displayed string keeps stored px bit-identical (100 iterations)', () => {
    const testUnits: DocumentUnits[] = [
      { unit: 'px', dpi: 72 },
      { unit: 'px', dpi: 300 },
      { unit: 'mm', dpi: 150 },
      { unit: 'mm', dpi: 300 },
      { unit: 'cm', dpi: 300 },
      { unit: 'in', dpi: 300 },
      { unit: 'in', dpi: 600 }
    ]

    for (const units of testUnits) {
      for (let i = 0; i < 100; i++) {
        // Random stored pixel value
        const storedPx = (i * 37.12345 + 1.234567) % 5000
        const displayed = formatUnitValue(storedPx, units)
        const typedValue = Number(displayed)
        const committedPx = resolveUnitCommitPx(typedValue, storedPx, units)

        // Must be bit-identical
        expect(committedPx).toBe(storedPx)
      }
    }
  })
})
