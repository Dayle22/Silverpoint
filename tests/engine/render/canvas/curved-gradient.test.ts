// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- this Bun test file is excluded from tsconfig and checked by Bun rather than Oxlint's standalone resolver.
import { describe, expect, test } from 'bun:test'

import {
  CURVED_GRADIENT_BANDS,
  sampleGradientSpine,
  colorAtT,
  curvedGradientBandDescriptors,
  computeCurvedGradientBandPolygons,
  type GradientStop,
  type GradientSpinePoint
} from '@open-pencil/scene-graph'

describe('curved gradient math', () => {
  test('empty spine returns points mathematically identical to linear interpolation', () => {
    const startX = 10
    const startY = 20
    const endX = 110
    const endY = 220

    const sampledEmpty = sampleGradientSpine(startX, startY, endX, endY, [])
    expect(sampledEmpty.length).toBe(CURVED_GRADIENT_BANDS + 1)

    for (let k = 0; k <= CURVED_GRADIENT_BANDS; k++) {
      const t = k / CURVED_GRADIENT_BANDS
      const expectedX = startX + t * (endX - startX)
      const expectedY = startY + t * (endY - startY)

      expect(sampledEmpty[k].x).toBeCloseTo(expectedX, 6)
      expect(sampledEmpty[k].y).toBeCloseTo(expectedY, 6)
    }
  })

  test('zero-offset spine points remain mathematically on the straight line', () => {
    const startX = 0
    const startY = 0
    const endX = 100
    const endY = 100

    const zeroOffsetSpine: GradientSpinePoint[] = [
      { t: 0.25, offset: 0 },
      { t: 0.5, offset: 0 },
      { t: 0.75, offset: 0 }
    ]

    const sampled = sampleGradientSpine(startX, startY, endX, endY, zeroOffsetSpine)
    expect(sampled.length).toBe(CURVED_GRADIENT_BANDS + 1)

    for (let k = 0; k <= CURVED_GRADIENT_BANDS; k++) {
      const t = k / CURVED_GRADIENT_BANDS
      const expectedX = t * 100
      const expectedY = t * 100

      expect(sampled[k].x).toBeCloseTo(expectedX, 5)
      expect(sampled[k].y).toBeCloseTo(expectedY, 5)
    }
  })

  test('curved spine displaces intermediate sample points along the perpendicular axis', () => {
    const startX = 0
    const startY = 0
    const endX = 100
    const endY = 0

    // Perp to (100, 0) is (0, 100)
    // Offset 0.5 at t=0.5 means midpoint displaced by +50 in y
    const curvedSpine: GradientSpinePoint[] = [
      { t: 0.5, offset: 0.5 }
    ]

    const sampled = sampleGradientSpine(startX, startY, endX, endY, curvedSpine)
    expect(sampled.length).toBe(CURVED_GRADIENT_BANDS + 1)

    // Endpoints remain unchanged
    expect(sampled[0].x).toBeCloseTo(0, 5)
    expect(sampled[0].y).toBeCloseTo(0, 5)
    expect(sampled[CURVED_GRADIENT_BANDS].x).toBeCloseTo(100, 5)
    expect(sampled[CURVED_GRADIENT_BANDS].y).toBeCloseTo(0, 5)

    // Midpoint (band index 12 for 24 bands, t=0.5) is displaced
    const mid = sampled[12]
    expect(mid.x).toBeCloseTo(50, 2)
    expect(mid.y).toBeGreaterThan(30)
  })

  test('colorAtT correctly interpolates across gradient stops', () => {
    const stops: GradientStop[] = [
      { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
      { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
    ]

    const startColor = colorAtT(stops, 0)
    expect(Array.from(startColor)).toEqual([1, 0, 0, 1])

    const endColor = colorAtT(stops, 1)
    expect(Array.from(endColor)).toEqual([0, 0, 1, 1])

    const midColor = colorAtT(stops, 0.5)
    expect(midColor[0]).toBeCloseTo(0.5, 5)
    expect(midColor[1]).toBeCloseTo(0, 5)
    expect(midColor[2]).toBeCloseTo(0.5, 5)
    expect(midColor[3]).toBeCloseTo(1, 5)
  })

  test('curvedGradientBandDescriptors builds 24 continuous bands with matching colors', () => {
    const stops: GradientStop[] = [
      { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
      { position: 1, color: { r: 0, g: 1, b: 0, a: 1 } }
    ]
    const spine: GradientSpinePoint[] = [{ t: 0.5, offset: 0.2 }]

    const bands = curvedGradientBandDescriptors(0, 0, 200, 100, spine, stops)
    expect(bands.length).toBe(CURVED_GRADIENT_BANDS)

    for (let i = 0; i < bands.length; i++) {
      const band = bands[i]
      expect(band.P0).toBeDefined()
      expect(band.P1).toBeDefined()
      expect(band.color0.length).toBe(4)
      expect(band.color1.length).toBe(4)

      if (i > 0) {
        // Continuous endpoints between adjacent bands
        expect(band.P0.x).toBeCloseTo(bands[i - 1].P1.x, 5)
        expect(band.P0.y).toBeCloseTo(bands[i - 1].P1.y, 5)
        expect(Array.from(band.color0)).toEqual(Array.from(bands[i - 1].color1))
      }
    }
  })

  test('computeCurvedGradientBandPolygons generates continuous gapless polygons between adjacent bands', () => {
    const spine: GradientSpinePoint[] = [{ t: 0.5, offset: 0.3 }]
    const points = sampleGradientSpine(0, 50, 390, 50, spine)
    const margin = 1000
    const polygons = computeCurvedGradientBandPolygons(points, margin)

    expect(polygons.length).toBe(CURVED_GRADIENT_BANDS)

    for (let i = 0; i < polygons.length; i++) {
      const poly = polygons[i]
      expect(poly.p0a).toBeDefined()
      expect(poly.p1a).toBeDefined()
      expect(poly.p1b).toBeDefined()
      expect(poly.p0b).toBeDefined()

      // Adjacent bands must share identical boundary vertices:
      // poly[i-1].p1a === poly[i].p0a
      // poly[i-1].p1b === poly[i].p0b
      if (i > 0) {
        const prev = polygons[i - 1]
        expect(poly.p0a.x).toBeCloseTo(prev.p1a.x, 5)
        expect(poly.p0a.y).toBeCloseTo(prev.p1a.y, 5)
        expect(poly.p0b.x).toBeCloseTo(prev.p1b.x, 5)
        expect(poly.p0b.y).toBeCloseTo(prev.p1b.y, 5)
      }
    }
  })

  test('curvedGradientBandDescriptors with margin populates gapless polygons', () => {
    const stops: GradientStop[] = [
      { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
      { position: 1, color: { r: 0, g: 1, b: 0, a: 1 } }
    ]
    const spine: GradientSpinePoint[] = [{ t: 0.5, offset: -0.25 }]
    const bands = curvedGradientBandDescriptors(0, 0, 300, 200, spine, stops, 500)

    expect(bands.length).toBe(CURVED_GRADIENT_BANDS)
    for (let i = 0; i < bands.length; i++) {
      expect(bands[i].polygon).toBeDefined()
      if (i > 0) {
        expect(bands[i].polygon!.p0a.x).toBeCloseTo(bands[i - 1].polygon!.p1a.x, 5)
        expect(bands[i].polygon!.p0a.y).toBeCloseTo(bands[i - 1].polygon!.p1a.y, 5)
        expect(bands[i].polygon!.p0b.x).toBeCloseTo(bands[i - 1].polygon!.p1b.x, 5)
        expect(bands[i].polygon!.p0b.y).toBeCloseTo(bands[i - 1].polygon!.p1b.y, 5)
      }
    }
  })
})
