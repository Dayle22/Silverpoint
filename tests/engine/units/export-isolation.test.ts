import { describe, expect, test } from 'bun:test'

import { SceneGraph, renderNodesToSVG } from '@open-pencil/core'
import { upsertDocumentUnits } from '@open-pencil/core/units/document'

describe('export isolation', () => {
  test('SVG export output is byte-identical regardless of document units or DPI', () => {
    const graph1 = new SceneGraph()
    const page1 = graph1.getPages()[0]
    const rect1 = graph1.createNode('RECTANGLE', page1.id, {
      x: 100,
      y: 200,
      width: 300,
      height: 150,
      fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.8, a: 1 }, opacity: 1, visible: true }]
    })
    graph1.updateNode(graph1.rootId, {
      pluginData: upsertDocumentUnits([], { unit: 'px', dpi: 300 })
    })

    const svg1 = renderNodesToSVG(graph1, page1.id, [rect1.id])

    const graph2 = new SceneGraph()
    const page2 = graph2.getPages()[0]
    const rect2 = graph2.createNode('RECTANGLE', page2.id, {
      x: 100,
      y: 200,
      width: 300,
      height: 150,
      fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.8, a: 1 }, opacity: 1, visible: true }]
    })
    graph2.updateNode(graph2.rootId, {
      pluginData: upsertDocumentUnits([], { unit: 'mm', dpi: 600 })
    })

    const svg2 = renderNodesToSVG(graph2, page2.id, [rect2.id])

    const graph3 = new SceneGraph()
    const page3 = graph3.getPages()[0]
    const rect3 = graph3.createNode('RECTANGLE', page3.id, {
      x: 100,
      y: 200,
      width: 300,
      height: 150,
      fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.8, a: 1 }, opacity: 1, visible: true }]
    })
    graph3.updateNode(graph3.rootId, {
      pluginData: upsertDocumentUnits([], { unit: 'in', dpi: 72 })
    })

    const svg3 = renderNodesToSVG(graph3, page3.id, [rect3.id])

    expect(svg1).not.toBeNull()
    expect(svg1).toBe(svg2)
    expect(svg1).toBe(svg3)
  })
})
