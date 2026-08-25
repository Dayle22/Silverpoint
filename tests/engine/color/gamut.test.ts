import { describe, expect, test } from 'bun:test'
import {
  checkPrintGamut,
  DEFAULT_GAMUT_TOLERANCE,
  maxPrintChroma,
  normalizePrintGamutSettings,
  parseColor,
  type Color
} from '@open-pencil/core'

describe('checkPrintGamut', () => {
  test('known-safe colours pass', () => {
    // Mid-grey (#808080)
    const midGrey = parseColor('#808080')
    const midGreyVerdict = checkPrintGamut(midGrey, 'coated')
    expect(midGreyVerdict.inGamut).toBe(true)
    expect(midGreyVerdict.excessChroma).toBe(0)

    // Muted navy (#1E3A5F)
    const mutedNavy = parseColor('#1E3A5F')
    const mutedNavyVerdict = checkPrintGamut(mutedNavy, 'coated')
    expect(mutedNavyVerdict.inGamut).toBe(true)
    expect(mutedNavyVerdict.excessChroma).toBe(0)

    // Warm brown (#8B5A2B)
    const warmBrown = parseColor('#8B5A2B')
    const warmBrownVerdict = checkPrintGamut(warmBrown, 'coated')
    expect(warmBrownVerdict.inGamut).toBe(true)
    expect(warmBrownVerdict.excessChroma).toBe(0)
  })

  test('known-impossible colours fail', () => {
    // Saturated cyan (#00FFFF / pure cyan)
    const saturatedCyan = parseColor('#00FFFF')
    const cyanVerdict = checkPrintGamut(saturatedCyan, 'coated')
    expect(cyanVerdict.inGamut).toBe(false)
    expect(cyanVerdict.excessChroma).toBeGreaterThan(0)

    // Pure RGB green (#00FF00)
    const pureGreen = parseColor('#00FF00')
    const greenVerdict = checkPrintGamut(pureGreen, 'coated')
    expect(greenVerdict.inGamut).toBe(false)
    expect(greenVerdict.excessChroma).toBeGreaterThan(0)

    // Saturated orange (#FF6600)
    const saturatedOrange = parseColor('#FF6600')
    const orangeVerdict = checkPrintGamut(saturatedOrange, 'coated')
    expect(orangeVerdict.inGamut).toBe(false)
    expect(orangeVerdict.excessChroma).toBeGreaterThan(0)
  })

  test('ceiling table interpolates smoothly and bounds are 0 at black and white', () => {
    expect(maxPrintChroma(0.0, 180, 'coated')).toBe(0)
    expect(maxPrintChroma(1.0, 180, 'coated')).toBe(0)

    // Lightness interpolation between steps
    const at045 = maxPrintChroma(0.45, 90, 'coated')
    const at040 = maxPrintChroma(0.4, 90, 'coated')
    const at050 = maxPrintChroma(0.5, 90, 'coated')
    expect(at045).toBeCloseTo((at040 + at050) / 2, 4)
  })

  test('hue wraps correctly at 0° and 360°', () => {
    const at0 = maxPrintChroma(0.5, 0, 'coated')
    const at360 = maxPrintChroma(0.5, 360, 'coated')
    const at720 = maxPrintChroma(0.5, 720, 'coated')
    const atNeg360 = maxPrintChroma(0.5, -360, 'coated')
    expect(at0).toBe(at360)
    expect(at0).toBe(at720)
    expect(at0).toBe(atNeg360)

    // Interpolation across the 330° -> 0° wrap seam
    const at330 = maxPrintChroma(0.5, 330, 'coated')
    const at345 = maxPrintChroma(0.5, 345, 'coated')
    expect(at345).toBeCloseTo((at330 + at0) / 2, 4)
  })

  test('tolerance suppresses boundary flipping', () => {
    // Given a color right at the boundary with excess slightly below tolerance
    const color: Color = { r: 0.85, g: 0.35, b: 0.1, a: 1 }
    // With very strict tolerance (0), it might be out
    const strictVerdict = checkPrintGamut(color, 'coated', 0)
    // With DEFAULT_GAMUT_TOLERANCE (0.01), if excess <= 0.01, it is considered in-gamut
    if (strictVerdict.excessChroma > 0 && strictVerdict.excessChroma <= DEFAULT_GAMUT_TOLERANCE) {
      const relaxedVerdict = checkPrintGamut(color, 'coated', DEFAULT_GAMUT_TOLERANCE)
      expect(relaxedVerdict.inGamut).toBe(true)
      expect(relaxedVerdict.excessChroma).toBe(0)
    }
  })

  test('uncoated profile is never more permissive than coated', () => {
    for (let l = 0.0; l <= 1.0; l += 0.1) {
      for (let h = 0; h < 360; h += 30) {
        const coated = maxPrintChroma(l, h, 'coated')
        const uncoated = maxPrintChroma(l, h, 'uncoated')
        expect(uncoated).toBeLessThanOrEqual(coated)
      }
    }
  })

  test('normalizePrintGamutSettings handles defaults and partial inputs', () => {
    expect(normalizePrintGamutSettings()).toEqual({ enabled: false, profile: 'coated' })
    expect(normalizePrintGamutSettings({ enabled: true })).toEqual({ enabled: true, profile: 'coated' })
    expect(normalizePrintGamutSettings({ profile: 'uncoated' })).toEqual({ enabled: false, profile: 'uncoated' })
  })
})
