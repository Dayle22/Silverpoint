import type { Color as RGBAColor, Fill, SceneNode } from '@open-pencil/scene-graph'

import { el, renderDocument, type XMLNode } from './xml'

import type { FontFaceRef } from '#core/text/face'

export interface ColorSwatch {
  self: string
  name: string
  r: number
  g: number
  b: number
}

export type FontEntry = FontFaceRef

export function colorToRGBInts(c: RGBAColor): { r: number; g: number; b: number } {
  return {
    r: Math.round(Math.max(0, Math.min(1, c.r)) * 255),
    g: Math.round(Math.max(0, Math.min(1, c.g)) * 255),
    b: Math.round(Math.max(0, Math.min(1, c.b)) * 255)
  }
}

export function getSwatchSelfForColor(c: RGBAColor): string {
  const { r, g, b } = colorToRGBInts(c)
  if (r === 0 && g === 0 && b === 0) return 'Color/Black'
  if (r === 255 && g === 255 && b === 255) return 'Color/White'
  return `Color/C_R${r}_G${g}_B${b}`
}

export function resolveFontStyle(weight: number | undefined, italic: boolean | undefined): string {
  const isBold = typeof weight === 'number' && weight >= 700
  if (isBold) {
    return italic ? 'Bold Italic' : 'Bold'
  }
  return italic ? 'Italic' : 'Regular'
}

export function collectColorsAndFonts(nodes: SceneNode[]): {
  swatches: Map<string, ColorSwatch>
  fonts: Map<string, Set<string>>
} {
  const swatches = new Map<string, ColorSwatch>()
  const fonts = new Map<string, Set<string>>()

  swatches.set('Color/Black', { self: 'Color/Black', name: 'Black', r: 0, g: 0, b: 0 })
  swatches.set('Color/White', { self: 'Color/White', name: 'White', r: 255, g: 255, b: 255 })

  function recordColor(c: RGBAColor) {
    const { r, g, b } = colorToRGBInts(c)
    const self = getSwatchSelfForColor(c)
    if (!swatches.has(self)) {
      swatches.set(self, { self, name: `C_R${r}_G${g}_B${b}`, r, g, b })
    }
  }

  function recordFont(family: string, style: string) {
    const fam = family || 'Inter'
    const st = style || 'Regular'
    let set = fonts.get(fam)
    if (!set) {
      set = new Set()
      fonts.set(fam, set)
    }
    set.add(st)
  }

  function processFills(fills: Fill[]) {
    for (const fill of fills) {
      if (fill.visible && fill.type === 'SOLID') {
        recordColor(fill.color)
      }
    }
  }

  for (const node of nodes) {
    processFills(node.fills)
    for (const stroke of node.strokes) {
      if (stroke.visible) {
        recordColor(stroke.color)
      }
    }
    if (node.type === 'TEXT') {
      const baseFamily = node.fontFamily || 'Inter'
      recordFont(baseFamily, resolveFontStyle(node.fontWeight, node.italic))

      for (const run of node.styleRuns) {
        const runFamily = run.style.fontFamily || baseFamily
        recordFont(runFamily, resolveFontStyle(run.style.fontWeight, run.style.italic))
        if (run.style.fills) {
          processFills(run.style.fills)
        }
      }
    }
  }

  return { swatches, fonts }
}

export function buildGraphicXML(swatches: Map<string, ColorSwatch>): string {
  const swatchNodes: XMLNode[] = []

  for (const swatch of swatches.values()) {
    swatchNodes.push(
      el('Color', {
        Self: swatch.self,
        Model: 'Process',
        Space: 'RGB',
        ColorValue: `${swatch.r} ${swatch.g} ${swatch.b}`,
        ColorOverride: 'false',
        Name: swatch.name
      })
    )
  }

  const root = el(
    'idPkg:Graphic',
    {
      'xmlns:idPkg': 'http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging',
      DOMVersion: '8.0'
    },
    ...swatchNodes
  )

  return renderDocument(root)
}

export function buildFontsXML(fonts: Map<string, Set<string>>): string {
  const familyNodes: XMLNode[] = []

  for (const [familyName, styles] of fonts.entries()) {
    const fontNodes: XMLNode[] = []
    for (const styleName of styles) {
      fontNodes.push(
        el('Font', {
          Self: `di4Font$ID/${familyName} ${styleName}`,
          FontFamily: familyName,
          FontStyleName: styleName,
          Name: `${familyName} ${styleName}`,
          PostScriptName: `${familyName}-${styleName.replace(/\s+/g, '')}`,
          Status: 'Installed'
        })
      )
    }
    familyNodes.push(el('FontFamily', { Self: `di4Family$ID/${familyName}`, Name: familyName }, ...fontNodes))
  }

  const root = el(
    'idPkg:Fonts',
    {
      'xmlns:idPkg': 'http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging',
      DOMVersion: '8.0'
    },
    ...familyNodes
  )

  return renderDocument(root)
}

export function buildStylesXML(): string {
  const root = el(
    'idPkg:Styles',
    {
      'xmlns:idPkg': 'http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging',
      DOMVersion: '8.0'
    },
    el(
      'RootParagraphStyleGroup',
      { Self: 'RootParagraphStyleGroup' },
      el('ParagraphStyle', {
        Self: 'ParagraphStyle/$ID/[No paragraph style]',
        Name: '$ID/[No paragraph style]'
      })
    ),
    el(
      'RootCharacterStyleGroup',
      { Self: 'RootCharacterStyleGroup' },
      el('CharacterStyle', {
        Self: 'CharacterStyle/$ID/[No character style]',
        Name: '$ID/[No character style]'
      })
    )
  )

  return renderDocument(root)
}

export function buildPreferencesXML(options: {
  pageWidth: number
  pageHeight: number
  pageCount: number
  bleedTop?: number
  bleedBottom?: number
  bleedLeft?: number
  bleedRight?: number
}): string {
  const root = el(
    'idPkg:Preferences',
    {
      'xmlns:idPkg': 'http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging',
      DOMVersion: '8.0'
    },
    el('DocumentPreference', {
      PageWidth: options.pageWidth.toFixed(2),
      PageHeight: options.pageHeight.toFixed(2),
      PagesPerDocument: options.pageCount,
      PagesPerSpread: '1',
      FacingPages: 'false',
      DocumentBleedTopOffset: options.bleedTop ?? 0,
      DocumentBleedBottomOffset: options.bleedBottom ?? 0,
      DocumentBleedInsideOrLeftOffset: options.bleedLeft ?? 0,
      DocumentBleedOutsideOrRightOffset: options.bleedRight ?? 0
    })
  )

  return renderDocument(root)
}
