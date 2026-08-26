import type { Color } from '@open-pencil/scene-graph'
import type { BarcodeScanCheck } from './types'

export function linearizeColorChannel(c: number): number {
  const clamped = Math.max(0, Math.min(1, c))
  if (clamped <= 0.04045) {
    return clamped / 12.92
  }
  return ((clamped + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(color: Color): number {
  const r = linearizeColorChannel(color.r)
  const g = linearizeColorChannel(color.g)
  const b = linearizeColorChannel(color.b)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function calculateContrastRatio(colorA: Color, colorB: Color): number {
  const lumA = relativeLuminance(colorA)
  const lumB = relativeLuminance(colorB)
  const lighter = Math.max(lumA, lumB)
  const darker = Math.min(lumA, lumB)
  return (lighter + 0.05) / (darker + 0.05)
}

export function checkBarcodeContrast(
  darkColor: Color,
  lightColor: Color,
  warnings: string[]
): number {
  const ratio = calculateContrastRatio(darkColor, lightColor)
  const darkLum = relativeLuminance(darkColor)
  const lightLum = relativeLuminance(lightColor)

  if (darkLum > lightLum) {
    warnings.push('Inverted barcode polarity: dark modules are lighter than background.')
  }

  if (ratio < 3.0) {
    warnings.push(`Low contrast ratio (${ratio.toFixed(2)}:1) between the dark and light colors.`)
  }

  return ratio
}

export function evaluateScanCheck(warnings: string[], contrastRatio: number): BarcodeScanCheck {
  return {
    status: warnings.length === 0 ? 'PASS' : 'WARN',
    contrastRatio,
    warnings
  }
}
