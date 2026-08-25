import type { FigmaFontName } from '#core/figma-api/fonts'
import { parseFontStyle } from '#core/text/face'

export function chooseLocalFontMatch<T extends FigmaFontName>(
  fonts: T[],
  family: string,
  style?: string
): T | undefined {
  const families = [family]
  const normalized = normalizeFontFamily(family)
  if (normalized !== family) families.push(normalized)
  const requested = parseFontStyle(style)

  for (const candidateFamily of families) {
    const exact = style
      ? fonts.find((font) => font.family === candidateFamily && font.style === style)
      : undefined
    if (exact) return exact

    const candidates = fonts.filter((font) => font.family === candidateFamily)
    const sameStyle = candidates.find((font) => {
      const parsed = parseFontStyle(font.style)
      return parsed.weight === requested.weight && parsed.italic === requested.italic
    })
    if (sameStyle) return sameStyle
    if (style) continue

    const sameSlant = candidates.filter(
      (font) => parseFontStyle(font.style).italic === requested.italic
    )
    if (sameSlant.length > 0) return sameSlant[0]
    if (candidates.length > 0) return candidates[0]
  }

  return undefined
}

export const FONT_WEIGHT_NAMES: Record<number, string> = {
  100: 'Thin',
  200: 'Extra Light',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'Semi Bold',
  700: 'Bold',
  800: 'Extra Bold',
  900: 'Black'
}

export function normalizeFontFamily(family: string): string {
  return family.replace(/\s+(Variable|\d+(?:pt|px|em))$/i, '')
}

export function styleToVariant(style: string): string {
  const weight = styleToWeight(style)
  const italic = style.toLowerCase().includes('italic')
  if (weight === 400 && !italic) return 'regular'
  if (weight === 400 && italic) return 'italic'
  return italic ? `${weight}italic` : `${weight}`
}

export function isVariableFont(data: ArrayBuffer): boolean {
  if (data.byteLength < 12) return false
  const view = new DataView(data)
  const numTables = view.getUint16(4)
  for (let i = 0; i < numTables && 12 + i * 16 + 4 <= data.byteLength; i++) {
    const tag = String.fromCharCode(
      view.getUint8(12 + i * 16),
      view.getUint8(12 + i * 16 + 1),
      view.getUint8(12 + i * 16 + 2),
      view.getUint8(12 + i * 16 + 3)
    )
    if (tag === 'fvar') return true
  }
  return false
}

export function styleToWeight(style: string): number {
  return parseFontStyle(style).weight
}

export function weightToStyle(weight: number, italic = false): string {
  const rounded = Math.round(weight / 100) * 100
  const label = (FONT_WEIGHT_NAMES[rounded] ?? 'Regular').replace(/ /g, '')
  return italic ? `${label} Italic` : label
}

export function weightToFigmaStyle(weight: number, italic = false): string {
  const rounded = Math.round(weight / 100) * 100
  const label = FONT_WEIGHT_NAMES[rounded] ?? 'Regular'
  return italic ? `${label} Italic` : label
}
