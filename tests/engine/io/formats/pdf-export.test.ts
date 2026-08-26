// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- this Bun test file is excluded from tsconfig and checked by Bun rather than Oxlint's standalone resolver.
import { describe, expect, it } from 'bun:test'
import { SceneGraph } from '@open-pencil/scene-graph'

import { renderNodesToPDF } from '#core/io/formats/pdf'
import { setupFakeDomEnvironment } from '#tests/helpers/svg-dom-shim'

setupFakeDomEnvironment()

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

describe('PDF Export — stroke gradient regression', () => {
  it('renders a node with a GRADIENT_LINEAR stroke to a non-empty PDF Uint8Array', async () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Gradient Stroke Rect',
      x: 0,
      y: 0,
      width: 200,
      height: 150,
      fills: [],
      strokes: [
        {
          type: 'GRADIENT_LINEAR',
          color: { r: 0, g: 0, b: 0, a: 1 },
          weight: 4,
          opacity: 1,
          visible: true,
          align: 'INSIDE',
          gradientStops: [
            { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
            { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
          ],
          gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
        }
      ]
    })

    const pdf = await renderNodesToPDF(graph, pageId(graph), [node.id])
    expect(pdf).not.toBeNull()
    expect(pdf).toBeInstanceOf(Uint8Array)
    expect(pdf?.length).toBeGreaterThan(0)
  })
})