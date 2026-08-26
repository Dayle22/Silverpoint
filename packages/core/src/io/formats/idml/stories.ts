import type { SceneNode } from '@open-pencil/scene-graph'

import { getSwatchSelfForColor, resolveFontStyle } from './styles'
import { el, renderDocument, type XMLNode } from './xml'

function mapHorizontalAlignment(align?: string): string {
  switch (align) {
    case 'CENTER':
      return 'CenterAlign'
    case 'RIGHT':
      return 'RightAlign'
    case 'JUSTIFIED':
      return 'JustifyLeft'
    default:
      return 'LeftAlign'
  }
}

export function buildStoryXML(node: SceneNode, storyId: string, ptPerPx: number): string {
  const text = node.text
  const justification = mapHorizontalAlignment(node.textAlignHorizontal)
  const baseFamily = node.fontFamily || 'Inter'
  const baseSize = node.fontSize * ptPerPx
  const baseStyle = resolveFontStyle(node.fontWeight, node.italic)

  const firstSolidFill = node.fills.find((f) => f.visible && f.type === 'SOLID')
  const baseFillColor = firstSolidFill?.color
    ? getSwatchSelfForColor(firstSolidFill.color)
    : 'Color/Black'

  const characterStyleRanges: XMLNode[] = []

  if (node.styleRuns.length > 0) {
    let lastIndex = 0
    for (const run of node.styleRuns) {
      const runStart = Math.max(0, Math.min(text.length, run.start))
      const runEnd = Math.max(runStart, Math.min(text.length, run.start + run.length))

      if (runStart > lastIndex) {
        const gapText = text.slice(lastIndex, runStart)
        characterStyleRanges.push(
          el(
            'CharacterStyleRange',
            {
              AppliedCharacterStyle: 'CharacterStyle/$ID/[No Character Style]',
              AppliedFont: baseFamily,
              FontStyle: baseStyle,
              PointSize: baseSize,
              FillColor: baseFillColor
            },
            el('Content', {}, gapText)
          )
        )
      }

      const chunk = text.slice(runStart, runEnd)
      if (chunk.length > 0) {
        const runFamily = run.style.fontFamily || baseFamily
        const runSize = (run.style.fontSize ?? node.fontSize) * ptPerPx
        const runStyle = resolveFontStyle(run.style.fontWeight, run.style.italic)

        const runSolidFill = run.style.fills?.find((f) => f.visible && f.type === 'SOLID')
        const runFillColor = runSolidFill?.color
          ? getSwatchSelfForColor(runSolidFill.color)
          : baseFillColor

        characterStyleRanges.push(
          el(
            'CharacterStyleRange',
            {
              AppliedCharacterStyle: 'CharacterStyle/$ID/[No Character Style]',
              AppliedFont: runFamily,
              FontStyle: runStyle,
              PointSize: runSize,
              FillColor: runFillColor
            },
            el('Content', {}, chunk)
          )
        )
      }

      lastIndex = runEnd
    }

    if (lastIndex < text.length) {
      const remainingText = text.slice(lastIndex)
      characterStyleRanges.push(
        el(
          'CharacterStyleRange',
          {
            AppliedCharacterStyle: 'CharacterStyle/$ID/[No Character Style]',
            AppliedFont: baseFamily,
            FontStyle: baseStyle,
            PointSize: baseSize,
            FillColor: baseFillColor
          },
          el('Content', {}, remainingText)
        )
      )
    }
  } else {
    characterStyleRanges.push(
      el(
        'CharacterStyleRange',
        {
          AppliedCharacterStyle: 'CharacterStyle/$ID/[No Character Style]',
          AppliedFont: baseFamily,
          FontStyle: baseStyle,
          PointSize: baseSize,
          FillColor: baseFillColor
        },
        el('Content', {}, text)
      )
    )
  }

  const paragraphRange = el(
    'ParagraphStyleRange',
    {
      AppliedParagraphStyle: 'ParagraphStyle/$ID/[No Paragraph Style]',
      Justification: justification
    },
    ...characterStyleRanges
  )

  const root = el(
    'idPkg:Story',
    {
      'xmlns:idPkg': 'http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging',
      DOMVersion: '8.0'
    },
    el(
      'Story',
      {
        Self: storyId,
        UserText: 'true'
      },
      paragraphRange
    )
  )

  return renderDocument(root)
}
