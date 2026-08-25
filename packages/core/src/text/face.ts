export interface ParsedFontStyle {
  weight: number
  italic: boolean
}

export interface FontFaceRef extends ParsedFontStyle {
  family: string
  style: string
  postscriptName?: string
}

const FONT_WEIGHT_ALIASES = [
  { weight: 100, names: ['thin', 'hairline', 'extrathin', 'ultrathin'] },
  { weight: 200, names: ['extralight', 'ultralight'] },
  { weight: 300, names: ['light'] },
  { weight: 400, names: ['regular', 'normal', 'book', 'roman', 'plain'] },
  { weight: 500, names: ['medium'] },
  { weight: 600, names: ['semibold', 'demibold'] },
  { weight: 700, names: ['bold'] },
  { weight: 800, names: ['extrabold', 'ultrabold'] },
  { weight: 900, names: ['black', 'heavy'] }
] as const

const FONT_WEIGHT_BY_STYLE: ReadonlyMap<string, number> = new Map(
  FONT_WEIGHT_ALIASES.flatMap(({ names, weight }) => names.map((name) => [name, weight] as const))
)

export function normalizeFontStyleName(style: string): string {
  return style
    .toLowerCase()
    .replace(/italic|oblique/u, '')
    .replace(/[^a-z0-9]+/gu, '')
}

export function parseFontStyle(style: string | undefined): ParsedFontStyle {
  const raw = style ?? ''
  const italic = /(?:italic|oblique)/iu.test(raw)
  const normalized = normalizeFontStyleName(raw)
  const numericWeight = normalized.match(/(?:^|[^0-9])([1-9]00)(?:[^0-9]|$)/u)?.[1]
  if (numericWeight) return { weight: Number(numericWeight), italic }

  return { weight: FONT_WEIGHT_BY_STYLE.get(normalized) ?? 400, italic }
}

export function fontFaceFromFigmaFontName(fontName: {
  family?: string
  style?: string
  postscript?: string
}): FontFaceRef {
  const style = fontName.style ?? 'Regular'
  return {
    family: fontName.family ?? 'Inter',
    style,
    postscriptName: fontName.postscript,
    ...parseFontStyle(style)
  }
}

export function fontFaceRenderFamily(family: string, style: string): string {
  return `__op_font__${family.replace(/[^a-z0-9_-]+/giu, '_')}__${style.replace(/[^a-z0-9_-]+/giu, '_')}`
}
