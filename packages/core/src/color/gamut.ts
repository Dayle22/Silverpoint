import { converter } from 'culori'

import type { Color } from '@open-pencil/scene-graph/primitives'

export type PrintGamutProfile = 'coated' | 'uncoated'

export interface GamutVerdict {
  inGamut: boolean
  excessChroma: number // 0 when in gamut; how far past the ceiling otherwise
}

export interface PrintGamutSettings {
  enabled: boolean
  profile: PrintGamutProfile
}

export const DEFAULT_GAMUT_TOLERANCE = 0.01

export const DEFAULT_PRINT_GAMUT_SETTINGS: PrintGamutSettings = {
  enabled: false,
  profile: 'coated'
}

/**
 * Module-level converter singleton per management.ts singleton pattern.
 * Avoids per-call converter instantiation.
 */
const toOklch = converter('oklch')

/**
 * Scale factor for uncoated stock.
 * Uncoated offset paper absorbs more ink into paper fibres, reducing maximum dynamic
 * range and saturation across all hues by approximately 20% relative to coated stock.
 */
const UNCOATED_CHROMA_SCALE = 0.8

/**
 * Approximate OKLCh chroma ceiling table for standard coated offset CMYK printing (e.g. FOGRA39 / GRACoL).
 *
 * Lightness rows: L = 0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0 (11 steps).
 * Hue columns: H = 0°, 30°, 60°, 90°, 120°, 150°, 180°, 210°, 240°, 270°, 300°, 330° (12 steps, 30° spacing).
 */
const COATED_CHROMA_TABLE: readonly (readonly number[])[] = [
  // L = 0.0 (Black point)
  [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
  // L = 0.1 (Deep shadows)
  [0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.04, 0.04, 0.04, 0.04, 0.04, 0.03],
  // L = 0.2 (Dark tones)
  [0.07, 0.06, 0.06, 0.06, 0.06, 0.07, 0.08, 0.08, 0.08, 0.09, 0.08, 0.07],
  // L = 0.3 (Deep colours / navy / dark reds)
  [0.12, 0.1, 0.09, 0.09, 0.09, 0.1, 0.11, 0.12, 0.13, 0.14, 0.13, 0.12],
  // L = 0.4 (Rich blues, purples, dark greens, deep reds)
  [0.17, 0.14, 0.12, 0.12, 0.12, 0.13, 0.13, 0.14, 0.16, 0.18, 0.17, 0.17],
  // L = 0.5 (Midtones: peak for reds, magentas, blues)
  [0.21, 0.17, 0.15, 0.14, 0.14, 0.14, 0.14, 0.15, 0.16, 0.18, 0.19, 0.21],
  // L = 0.6 (Mid-lights: magentas, cyans, oranges)
  [0.2, 0.18, 0.17, 0.16, 0.15, 0.14, 0.15, 0.16, 0.14, 0.15, 0.18, 0.2],
  // L = 0.7 (Lights: cyans, oranges, light magentas)
  [0.16, 0.16, 0.18, 0.18, 0.14, 0.12, 0.14, 0.15, 0.12, 0.11, 0.14, 0.16],
  // L = 0.8 (Bright highlights: yellows peak here)
  [0.1, 0.12, 0.17, 0.19, 0.13, 0.09, 0.09, 0.1, 0.08, 0.07, 0.09, 0.1],
  // L = 0.9 (Very light pastels)
  [0.04, 0.06, 0.12, 0.14, 0.08, 0.05, 0.04, 0.04, 0.03, 0.03, 0.04, 0.04],
  // L = 1.0 (White point)
  [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
]

export function normalizePrintGamutSettings(
  settings?: Partial<PrintGamutSettings> | null
): PrintGamutSettings {
  const profile: PrintGamutProfile = settings?.profile === 'uncoated' ? 'uncoated' : 'coated'
  return {
    enabled: Boolean(settings?.enabled),
    profile
  }
}

/**
 * Returns the approximate maximum printable chroma for a given lightness and hue in OKLCh.
 * Uses bilinear interpolation over the committed chroma ceiling table.
 */
export function maxPrintChroma(
  l: number,
  h: number,
  profile: PrintGamutProfile = 'coated'
): number {
  const clampedL = Math.max(0, Math.min(1, l))
  if (clampedL <= 0 || clampedL >= 1) return 0

  const normH = ((h % 360) + 360) % 360

  const lIndex = Math.min(9, Math.floor(clampedL / 0.1))
  const lFrac = (clampedL - lIndex * 0.1) / 0.1

  const hIndex = Math.floor(normH / 30) % 12
  const nextHIndex = (hIndex + 1) % 12
  const hFrac = (normH - hIndex * 30) / 30

  const rowTop = COATED_CHROMA_TABLE[lIndex]
  const rowBottom = COATED_CHROMA_TABLE[lIndex + 1]

  const c00 = rowTop[hIndex]
  const c01 = rowTop[nextHIndex]
  const c10 = rowBottom[hIndex]
  const c11 = rowBottom[nextHIndex]

  const top = c00 * (1 - hFrac) + c01 * hFrac
  const bottom = c10 * (1 - hFrac) + c11 * hFrac
  let maxChroma = top * (1 - lFrac) + bottom * lFrac

  if (profile === 'uncoated') {
    maxChroma *= UNCOATED_CHROMA_SCALE
  }

  return maxChroma
}

/**
 * Evaluates whether a given colour falls within the approximate print gamut.
 * Alpha is evaluated at full opacity per Fixed Decision #6.
 */
export function checkPrintGamut(
  color: Color,
  profile: PrintGamutProfile = 'coated',
  tolerance: number = DEFAULT_GAMUT_TOLERANCE
): GamutVerdict {
  const oklch = toOklch({
    mode: 'rgb',
    r: color.r,
    g: color.g,
    b: color.b,
    alpha: 1
  })

  const l = oklch.l
  const c = oklch.c
  const h = oklch.h ?? 0

  const ceiling = maxPrintChroma(l, h, profile)
  const excess = c - ceiling

  if (excess <= tolerance) {
    return { inGamut: true, excessChroma: 0 }
  }

  return { inGamut: false, excessChroma: excess }
}
