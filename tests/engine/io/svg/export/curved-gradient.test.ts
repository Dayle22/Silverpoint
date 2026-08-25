import { describe, expect, test } from 'bun:test'

import { CURVED_GRADIENT_BANDS } from '@open-pencil/scene-graph'

import { exportSVGOrThrow, makeGraph, pageId } from './helpers'

describe('curved gradient SVG export', () => {
  test('exporting a node with GRADIENT_CURVED fill produces valid SVG with pattern and 24 linearGradient and clipPath defs', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 200,
      height: 100,
      fills: [
        {
          type: 'GRADIENT_CURVED',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
          gradientStops: [
            { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
            { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
          ],
          gradientSpine: [{ t: 0.5, offset: 0.25 }]
        }
      ]
    })

    const result = exportSVGOrThrow(graph, [node.id])

    // Must define pattern referenced by the rect fill
    expect(result).toContain('<pattern')
    expect(result).toContain('fill="url(#grad')

    // Must contain exactly 24 linearGradients and 24 clipPaths
    const linearGradients = result.match(/<linearGradient /g)
    const clipPaths = result.match(/<clipPath /g)
    expect(linearGradients?.length).toBe(CURVED_GRADIENT_BANDS)
    expect(clipPaths?.length).toBe(CURVED_GRADIENT_BANDS)

    // Verify pattern attributes and rect clips
    expect(result).toContain('patternUnits="userSpaceOnUse"')
    expect(result).toContain('width="200"')
    expect(result).toContain('height="100"')
    expect(result).toContain('<polygon points="')
  })

  test('zero-spine / empty spine export runs seamlessly', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 150,
      height: 80,
      fills: [
        {
          type: 'GRADIENT_CURVED',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
          gradientStops: [
            { position: 0, color: { r: 1, g: 1, b: 0, a: 1 } },
            { position: 1, color: { r: 0, g: 1, b: 1, a: 1 } }
          ]
          // gradientSpine is undefined (empty)
        }
      ]
    })

    const result = exportSVGOrThrow(graph, [node.id])

    expect(result).toContain('<pattern')
    expect(result).toContain('fill="url(#grad')
    const linearGradients = result.match(/<linearGradient /g)
    const clipPaths = result.match(/<clipPath /g)
    expect(linearGradients?.length).toBe(CURVED_GRADIENT_BANDS)
    expect(clipPaths?.length).toBe(CURVED_GRADIENT_BANDS)
  })
})
