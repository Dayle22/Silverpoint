import { describe, expect, test } from 'bun:test'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

import { nodeChangeToProps } from '#core/kiwi/fig/node-change/convert'
import {
  CURVED_GRADIENT_PLUGIN_KEY,
  OPEN_PENCIL_PLUGIN_ID
} from '#core/kiwi/fig/node-change/plugin-data'
import { sceneNodeToKiwi } from '#core/kiwi/fig/node-change/serialize'

describe('Curved gradient .fig export and import roundtrip', () => {
  test('exports GRADIENT_CURVED fill as GRADIENT_LINEAR paint and preserves spine in pluginData', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const spine = [
      { t: 0.3, offset: 0.2 },
      { t: 0.7, offset: -0.15 }
    ]
    const node = graph.createNode('RECTANGLE', page.id, {
      fills: [
        {
          type: 'GRADIENT_CURVED',
          color: { r: 1, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          gradientStops: [
            { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
            { color: { r: 0, g: 0, b: 1, a: 1 }, position: 1 }
          ],
          gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
          gradientSpine: spine
        }
      ]
    })

    const changes = sceneNodeToKiwi(node, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [])
    const nc = changes[0]

    // Paint.type is native GRADIENT_LINEAR
    expect(nc.fillPaints?.[0]?.type).toBe('GRADIENT_LINEAR')
    expect(nc.fillPaints?.[0]?.stops).toEqual([
      { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
      { color: { r: 0, g: 0, b: 1, a: 1 }, position: 1 }
    ])

    // pluginData contains curvedGradientFillsV1 entry
    const entry = nc.pluginData?.find(
      (p) => p.pluginID === OPEN_PENCIL_PLUGIN_ID && p.key === CURVED_GRADIENT_PLUGIN_KEY
    )
    expect(entry).toBeDefined()
    const payload = JSON.parse(entry?.value ?? '{}')
    expect(payload).toEqual({
      version: 1,
      byIndex: {
        0: spine
      }
    })
  })

  test('imports and reconstructs GRADIENT_CURVED with its gradientSpine from exported NodeChange', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const spine = [
      { t: 0.25, offset: 0.5 },
      { t: 0.75, offset: -0.5 }
    ]
    const node = graph.createNode('RECTANGLE', page.id, {
      fills: [
        {
          type: 'SOLID',
          color: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
          opacity: 1,
          visible: true
        },
        {
          type: 'GRADIENT_CURVED',
          color: { r: 0, g: 1, b: 0, a: 1 },
          opacity: 0.8,
          visible: true,
          gradientStops: [
            { color: { r: 0, g: 1, b: 0, a: 1 }, position: 0 },
            { color: { r: 1, g: 1, b: 0, a: 1 }, position: 1 }
          ],
          gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
          gradientSpine: spine
        }
      ]
    })

    const changes = sceneNodeToKiwi(node, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [])
    const importedProps = nodeChangeToProps(changes[0], [])

    expect(importedProps.fills?.[0]?.type).toBe('SOLID')
    expect(importedProps.fills?.[1]?.type).toBe('GRADIENT_CURVED')
    expect(importedProps.fills?.[1]?.gradientSpine).toEqual(spine)
    expect(importedProps.fills?.[1]?.gradientStops).toEqual([
      { color: { r: 0, g: 1, b: 0, a: 1 }, position: 0 },
      { color: { r: 1, g: 1, b: 0, a: 1 }, position: 1 }
    ])
  })

  test('plain Figma files without pluginData remain standard GRADIENT_LINEAR', () => {
    const nc: NodeChange = {
      type: 'RECTANGLE',
      fillPaints: [
        {
          type: 'GRADIENT_LINEAR',
          color: { r: 1, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          stops: [
            { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
            { color: { r: 0, g: 0, b: 1, a: 1 }, position: 1 }
          ],
          transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
        }
      ]
    }

    const importedProps = nodeChangeToProps(nc, [])

    expect(importedProps.fills?.[0]?.type).toBe('GRADIENT_LINEAR')
    expect(importedProps.fills?.[0]?.gradientSpine).toBeUndefined()
  })
})
