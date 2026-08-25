import { BLACK, WHITE } from '#core/constants'
import { findDescendants, parseXML, type XMLParseNode } from '#core/io/formats/idml/xml-parse'
import type { Color as RGBAColor } from '@open-pencil/scene-graph'

import type { IdmlImportDiagnostic } from './types'

export interface ColorSwatchTable {
  swatches: Map<string, RGBAColor | null>
}

function parseRgbColor(parts: number[]): RGBAColor {
  const isFloat = parts.some((p) => p > 0 && p <= 1 && p % 1 !== 0) && parts.every((p) => p <= 1)
  const r = isFloat ? parts[0] : parts[0] / 255
  const g = isFloat ? parts[1] : parts[1] / 255
  const b = isFloat ? parts[2] : parts[2] / 255
  return {
    r: Math.max(0, Math.min(1, r)),
    g: Math.max(0, Math.min(1, g)),
    b: Math.max(0, Math.min(1, b)),
    a: 1
  }
}

function parseCmykColor(parts: number[]): RGBAColor {
  const isPercent = parts.some((p) => p > 1)
  const c = isPercent ? parts[0] / 100 : parts[0]
  const m = isPercent ? parts[1] / 100 : parts[1]
  const y = isPercent ? parts[2] / 100 : parts[2]
  const k = isPercent ? parts[3] / 100 : parts[3]

  const r = (1 - c) * (1 - k)
  const g = (1 - m) * (1 - k)
  const b = (1 - y) * (1 - k)

  return {
    r: Math.max(0, Math.min(1, r)),
    g: Math.max(0, Math.min(1, g)),
    b: Math.max(0, Math.min(1, b)),
    a: 1
  }
}

function applyTintNodes(root: XMLParseNode, swatches: Map<string, RGBAColor | null>): void {
  const tintNodes = findDescendants(root, 'Tint')
  for (const tintNode of tintNodes) {
    const self = tintNode.attrs['Self']
    const baseColorSelf = tintNode.attrs['BaseColor']
    const tintValue = Number.parseFloat(tintNode.attrs['TintValue'] || '100') / 100
    if (self && baseColorSelf && swatches.has(baseColorSelf)) {
      const base = swatches.get(baseColorSelf)
      if (base) {
        swatches.set(self, {
          r: 1 - (1 - base.r) * tintValue,
          g: 1 - (1 - base.g) * tintValue,
          b: 1 - (1 - base.b) * tintValue,
          a: base.a
        })
      } else {
        swatches.set(self, null)
      }
    }
  }
}

export function parseGraphicSwatches(
  graphicXml: string | undefined,
  diagnostics: IdmlImportDiagnostic[]
): ColorSwatchTable {
  const swatches = new Map<string, RGBAColor | null>()

  // Builtin default swatches
  swatches.set('Color/Black', BLACK)
  swatches.set('Color/White', WHITE)
  swatches.set('Color/Paper', WHITE)
  swatches.set('Color/None', null)
  swatches.set('Color/Registration', BLACK)
  swatches.set('Swatch/None', null)

  if (!graphicXml) {
    return { swatches }
  }

  let root: XMLParseNode
  try {
    root = parseXML(graphicXml)
  } catch {
    return { swatches }
  }

  const colorNodes = findDescendants(root, 'Color')

  for (const colorNode of colorNodes) {
    const self = colorNode.attrs['Self'] || colorNode.attrs['id']
    if (!self) continue

    const name = colorNode.attrs['Name'] || self
    const space = (colorNode.attrs['Space'] || 'RGB').toUpperCase()
    const colorValueStr = colorNode.attrs['ColorValue'] || ''
    const parts = colorValueStr
      .trim()
      .split(/\s+/)
      .map((v) => Number.parseFloat(v))
      .filter((v) => !Number.isNaN(v))

    if (space === 'RGB' && parts.length >= 3) {
      swatches.set(self, parseRgbColor(parts))
    } else if (space === 'CMYK' && parts.length >= 4) {
      swatches.set(self, parseCmykColor(parts))
      diagnostics.push({
        severity: 'info',
        code: 'IDML_CMYK_CONVERTED',
        message: `CMYK colour "${name}" was converted to RGB approximation.`,
        detail: name
      })
    } else if (space !== 'RGB' && space !== 'CMYK') {
      swatches.set(self, null)
      diagnostics.push({
        severity: 'warning',
        code: 'IDML_UNSUPPORTED_COLOR_SPACE',
        message: `Colour space "${space}" for swatch "${name}" is not supported; item will have no fill.`,
        detail: name
      })
    }
  }

  applyTintNodes(root, swatches)

  return { swatches }
}

export function resolveColor(
  swatchName: string | undefined,
  swatches: Map<string, RGBAColor | null>,
  tintPercent?: number
): RGBAColor | null {
  if (!swatchName) return null
  let color = swatches.get(swatchName)
  if (color === undefined) {
    // Try matching by suffix if namespace is omitted
    const match = Array.from(swatches.entries()).find(([k]) => k.endsWith(`/${swatchName}`))
    if (match) color = match[1]
  }

  if (!color) return null

  if (typeof tintPercent === 'number' && tintPercent >= 0 && tintPercent < 100) {
    const t = tintPercent / 100
    return {
      r: 1 - (1 - color.r) * t,
      g: 1 - (1 - color.g) * t,
      b: 1 - (1 - color.b) * t,
      a: color.a
    }
  }

  return color
}
