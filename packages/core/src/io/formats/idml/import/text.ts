import { BLACK } from '#core/constants'
import { findDescendants, parseXML, type XMLParseNode } from '#core/io/formats/idml/xml-parse'
import type { Color as RGBAColor, SceneNode, StyleRun } from '@open-pencil/scene-graph'

import { resolveColor } from './color'
import { STANDARD_FONTS, type IdmlImportDiagnostic } from './types'

export interface ParsedStoryChunk {
  text: string
  fontFamily: string
  fontStyle: string
  fontSize: number
  fillColor?: RGBAColor | null
  fontWeight: number
  italic: boolean
}

export interface ParsedStory {
  self: string
  text: string
  chunks: ParsedStoryChunk[]
  justification?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED'
}

export interface StoryTable {
  stories: Map<string, ParsedStory>
}

function mapJustification(val?: string): 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED' {
  if (!val) return 'LEFT'
  const v = val.toLowerCase()
  if (v.includes('center')) return 'CENTER'
  if (v.includes('right')) return 'RIGHT'
  if (v.includes('justify') || v.includes('justified')) return 'JUSTIFIED'
  return 'LEFT'
}

function mapFontStyle(styleName: string): { fontWeight: number; italic: boolean } {
  const s = styleName.toLowerCase()
  let fontWeight = 400
  let italic = false

  if (s.includes('italic') || s.includes('oblique')) {
    italic = true
  }

  if (s.includes('thin') || s.includes('hairline')) fontWeight = 100
  else if (s.includes('extra light') || s.includes('ultra light')) fontWeight = 200
  else if (s.includes('light')) fontWeight = 300
  else if (s.includes('medium')) fontWeight = 500
  else if (s.includes('semi bold') || s.includes('demi bold') || s.includes('semibold')) fontWeight = 600
  else if (s.includes('extra bold') || s.includes('ultra bold') || s.includes('extrabold')) fontWeight = 800
  else if (s.includes('bold') || s.includes('black') || s.includes('heavy')) fontWeight = 700

  return { fontWeight, italic }
}

function parseCharacterStyleRange(
  charRange: XMLParseNode,
  swatches: Map<string, RGBAColor | null>,
  diagnostics: IdmlImportDiagnostic[],
  seenMissingFonts: Set<string>
): ParsedStoryChunk | null {
  const rawFont = charRange.attrs['AppliedFont'] || 'Inter'
  const fontStyle = charRange.attrs['FontStyle'] || 'Regular'
  const ptSize = Number.parseFloat(charRange.attrs['PointSize'] || '12') || 12
  const fillColor = resolveColor(charRange.attrs['FillColor'], swatches)

  const normalizedFont = rawFont.trim()
  const fontKey = normalizedFont.toLowerCase()

  let targetFont = normalizedFont
  if (!STANDARD_FONTS.has(fontKey)) {
    targetFont = 'Inter'
    if (!seenMissingFonts.has(normalizedFont)) {
      seenMissingFonts.add(normalizedFont)
      diagnostics.push({
        severity: 'warning',
        code: 'IDML_UNRESOLVED_FONT',
        message: `Font "${normalizedFont}" is not installed; substituted with Inter.`,
        detail: normalizedFont
      })
    }
  }

  const { fontWeight, italic } = mapFontStyle(fontStyle)

  const contentNodes = findDescendants(charRange, 'Content')
  let chunkText = ''
  if (contentNodes.length > 0) {
    chunkText = contentNodes.map((c) => c.text).join('')
  } else {
    chunkText = charRange.text
  }

  const brNodes = findDescendants(charRange, 'Br')
  if (brNodes.length > 0 && chunkText.length === 0) {
    chunkText = '\n'
  }

  if (chunkText.length === 0) return null

  return {
    text: chunkText,
    fontFamily: targetFont,
    fontStyle,
    fontSize: ptSize,
    fillColor,
    fontWeight,
    italic
  }
}

export function parseStories(
  entries: Record<string, Uint8Array | undefined>,
  storyPaths: string[],
  swatches: Map<string, RGBAColor | null>,
  diagnostics: IdmlImportDiagnostic[],
  seenMissingFonts: Set<string>
): StoryTable {
  const stories = new Map<string, ParsedStory>()

  for (const storyPath of storyPaths) {
    const rawBytes = entries[storyPath]
    if (!rawBytes) continue

    const storyXML = new TextDecoder().decode(rawBytes)
    let root: XMLParseNode
    try {
      root = parseXML(storyXML)
    } catch {
      continue
    }

    const storyNodes = findDescendants(root, 'Story')
    const storyNode = root.tag === 'Story' ? root : storyNodes.at(0)
    if (!storyNode) continue

    const storySelf = storyNode.attrs['Self'] || storyPath.replace(/^.*\//, '').replace(/\.xml$/, '')
    const chunks: ParsedStoryChunk[] = []
    let primaryJustification: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED' = 'LEFT'

    const paraRanges = findDescendants(storyNode, 'ParagraphStyleRange')
    const effectiveParaRanges = paraRanges.length > 0 ? paraRanges : [storyNode]

    for (const para of effectiveParaRanges) {
      if (para.attrs['Justification']) {
        primaryJustification = mapJustification(para.attrs['Justification'])
      }

      const charRanges = findDescendants(para, 'CharacterStyleRange')
      const effectiveCharRanges = charRanges.length > 0 ? charRanges : [para]

      for (const charRange of effectiveCharRanges) {
        const chunk = parseCharacterStyleRange(charRange, swatches, diagnostics, seenMissingFonts)
        if (chunk) {
          chunks.push(chunk)
        }
      }
    }

    const fullText = chunks.map((c) => c.text).join('')
    stories.set(storySelf, {
      self: storySelf,
      text: fullText,
      chunks,
      justification: primaryJustification
    })
  }

  return { stories }
}

export function populateTextNodeFromStory(
  node: SceneNode,
  story: ParsedStory,
  pxPerPt: number
): void {
  node.text = story.text
  node.textAlignHorizontal = story.justification || 'LEFT'

  if (story.chunks.length === 0) return

  const firstChunk = story.chunks[0]
  node.fontFamily = firstChunk.fontFamily
  node.fontSize = firstChunk.fontSize * pxPerPt
  node.fontWeight = firstChunk.fontWeight
  node.italic = firstChunk.italic
  if (firstChunk.fillColor) {
    node.fills = [{ type: 'SOLID', color: firstChunk.fillColor, opacity: 1, visible: true }]
  } else {
    node.fills = [{ type: 'SOLID', color: BLACK, opacity: 1, visible: true }]
  }

  if (story.chunks.length > 1) {
    const styleRuns: StyleRun[] = []
    let currentOffset = 0

    for (const chunk of story.chunks) {
      const len = chunk.text.length
      if (len > 0) {
        styleRuns.push({
          start: currentOffset,
          length: len,
          style: {
            fontFamily: chunk.fontFamily,
            fontSize: chunk.fontSize * pxPerPt,
            fontWeight: chunk.fontWeight,
            italic: chunk.italic,
            fills: chunk.fillColor
              ? [{ type: 'SOLID', color: chunk.fillColor, opacity: 1, visible: true }]
              : [{ type: 'SOLID', color: BLACK, opacity: 1, visible: true }]
          }
        })
        currentOffset += len
      }
    }

    node.styleRuns = styleRuns
  }
}
