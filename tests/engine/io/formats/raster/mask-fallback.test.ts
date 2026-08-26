import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { nodeNeedsMaskFallback } from '#core/io/formats/raster'

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

describe('nodeNeedsMaskFallback()', () => {
  test('is false for a subtree with no masks', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', pageId(graph), { width: 100, height: 100 })
    graph.createNode('RECTANGLE', frame.id, { width: 50, height: 50 })

    expect(nodeNeedsMaskFallback(graph, frame.id)).toBe(false)
  })

  test('is true when a descendant is a visible mask', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', pageId(graph), { width: 100, height: 100 })
    const group = graph.createNode('GROUP', frame.id, {})
    graph.createNode('ELLIPSE', group.id, { width: 40, height: 40, isMask: true })

    expect(nodeNeedsMaskFallback(graph, frame.id)).toBe(true)
  })

  test('is false when the only mask descendant is hidden', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', pageId(graph), { width: 100, height: 100 })
    graph.createNode('ELLIPSE', frame.id, { width: 40, height: 40, isMask: true, visible: false })

    expect(nodeNeedsMaskFallback(graph, frame.id)).toBe(false)
  })
})
