import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { sceneNodeToKiwi } from '#core/kiwi/fig/node-change/serialize'

describe('Figma stroke gradient export', () => {
  test('exports GRADIENT_LINEAR and GRADIENT_RADIAL stroke paints with stops and transform', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('RECTANGLE', page.id, {
      strokes: [
        {
          type: 'GRADIENT_LINEAR',
          color: { r: 1, g: 0, b: 0, a: 1 },
          opacity: 0.9,
          visible: true,
          weight: 2,
          align: 'CENTER',
          cap: 'NONE',
          join: 'MITER',
          dashPattern: [],
          gradientStops: [
            { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
            { color: { r: 0, g: 0, b: 1, a: 1 }, position: 1 }
          ],
          gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
        },
        {
          type: 'GRADIENT_RADIAL',
          color: { r: 0, g: 1, b: 0, a: 1 },
          opacity: 0.8,
          visible: true,
          weight: 4,
          align: 'INSIDE',
          cap: 'ROUND',
          join: 'BEVEL',
          dashPattern: [],
          gradientStops: [
            { color: { r: 1, g: 1, b: 1, a: 1 }, position: 0 },
            { color: { r: 0, g: 0, b: 0, a: 1 }, position: 1 }
          ],
          gradientTransform: { m00: 0.5, m01: 0, m02: 0.5, m10: 0, m11: 0.5, m12: 0.5 }
        }
      ]
    })

    const changes = sceneNodeToKiwi(node, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [])
    const strokePaints = changes[0].strokePaints

    expect(strokePaints?.[0]).toMatchObject({
      type: 'GRADIENT_LINEAR',
      opacity: 0.9,
      visible: true,
      blendMode: 'NORMAL',
      stops: [
        { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
        { color: { r: 0, g: 0, b: 1, a: 1 }, position: 1 }
      ],
      transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
    })
    expect(strokePaints?.[1]).toMatchObject({
      type: 'GRADIENT_RADIAL',
      opacity: 0.8,
      visible: true,
      blendMode: 'NORMAL',
      stops: [
        { color: { r: 1, g: 1, b: 1, a: 1 }, position: 0 },
        { color: { r: 0, g: 0, b: 0, a: 1 }, position: 1 }
      ],
      transform: { m00: 0.5, m01: 0, m02: 0.5, m10: 0, m11: 0.5, m12: 0.5 }
    })
  })
})
