import { describe, expect, test } from 'bun:test'

import { PROGRESSIVE_BLUR_BANDS } from '@open-pencil/scene-graph'

import { exportSVGOrThrow, makeGraph, pageId } from './helpers'

describe('progressive blur SVG export', () => {
  test('progressive layer blur exports as a masked band stack', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 50,
      height: 50,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
      effects: [
        {
          type: 'LAYER_BLUR',
          color: { r: 0, g: 0, b: 0, a: 0 },
          offset: { x: 0, y: 0 },
          radius: 12,
          spread: 0,
          visible: true,
          blurType: 'PROGRESSIVE',
          startRadius: 0,
          startOffset: { x: 0.5, y: 0 },
          endOffset: { x: 0.5, y: 1 }
        }
      ]
    })
    const result = exportSVGOrThrow(graph, [node.id])

    // One masked copy per band, from the sharp band through the blurriest.
    expect(result.match(/<use /g)?.length).toBe(PROGRESSIVE_BLUR_BANDS + 1)
    expect(result.match(/<mask /g)?.length).toBe(PROGRESSIVE_BLUR_BANDS + 1)
    expect(result).toContain('<linearGradient')
    // The ramp runs down the node, matching the normalised offsets.
    expect(result).toContain('y1="0"')
    expect(result).toContain('y2="50"')
    // The end radius is the blurriest band.
    expect(result).toContain('stdDeviation="6"')
  })

  test('progressive layer blur with a collapsed axis exports as a uniform blur', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 50,
      height: 50,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
      effects: [
        {
          type: 'LAYER_BLUR',
          color: { r: 0, g: 0, b: 0, a: 0 },
          offset: { x: 0, y: 0 },
          radius: 12,
          spread: 0,
          visible: true,
          blurType: 'PROGRESSIVE',
          startRadius: 0,
          startOffset: { x: 0.5, y: 0.5 },
          endOffset: { x: 0.5, y: 0.5 }
        }
      ]
    })
    const result = exportSVGOrThrow(graph, [node.id])

    expect(result).not.toContain('<use ')
    expect(result).toContain('stdDeviation="6"')
  })
})
