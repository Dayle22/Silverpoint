import { describe, expect, test } from 'bun:test'
import {
  analyzeGraphGamut,
  headlessRenderNodes,
  parseColor,
  renderNodesToSVG,
  SceneGraph
} from '@open-pencil/core'

import { createUndoManager, undoEntry } from '#tests/helpers/undo'

describe('analyzeGraphGamut', () => {
  test('fixture graph detects out-of-gamut fills, strokes, gradients, text runs, and marks images as unanalysable', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]

    // 1. In-gamut rectangle (mid-grey fill, no strokes)
    const safeRect = graph.createNode('RECTANGLE', page.id, {
      name: 'Safe Rect',
      fills: [{ type: 'SOLID', color: parseColor('#808080'), opacity: 1, visible: true }],
      strokes: []
    })

    // 2. Out-of-gamut rectangle with pure green fill and out-of-gamut stroke
    const badRect = graph.createNode('RECTANGLE', page.id, {
      name: 'Bad Rect',
      fills: [{ type: 'SOLID', color: parseColor('#00FF00'), opacity: 1, visible: true }],
      strokes: [{ color: parseColor('#FF6600'), weight: 2, opacity: 1, visible: true, align: 'INSIDE' }]
    })

    // 3. Rectangle with gradient fill: stop 0 safe (#808080), stop 1 impossible (#00FF00)
    const gradientRect = graph.createNode('RECTANGLE', page.id, {
      name: 'Gradient Rect',
      fills: [
        {
          type: 'GRADIENT_LINEAR',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          gradientStops: [
            { position: 0, color: parseColor('#808080') },
            { position: 1, color: parseColor('#00FF00') }
          ]
        }
      ]
    })

    // 4. Text node with a style run containing an out-of-gamut fill
    const textNode = graph.createNode('TEXT', page.id, {
      name: 'Text Node',
      characters: 'Sample',
      styleRuns: [
        {
          start: 0,
          length: 6,
          style: {
            fills: [{ type: 'SOLID', color: parseColor('#00FF00'), opacity: 1, visible: true }]
          }
        }
      ]
    })

    // 5. Image node with an image fill
    const imageNode = graph.createNode('RECTANGLE', page.id, {
      name: 'Image Node',
      fills: [
        {
          type: 'IMAGE',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          imageHash: 'test-hash'
        }
      ]
    })

    const findings = analyzeGraphGamut(graph, page.id, 'coated')

    // Expect findings for:
    // - badRect fill (pure green)
    // - badRect stroke (saturated orange)
    // - gradientRect stop 1 (pure green)
    // - textNode text-fill (pure green)
    // - imageNode image fill (excessChroma: -1)
    expect(findings.length).toBe(5)

    const badRectFillFinding = findings.find((f) => f.nodeId === badRect.id && f.source === 'fill')
    expect(badRectFillFinding).toBeDefined()
    expect(badRectFillFinding?.excessChroma).toBeGreaterThan(0)

    const badRectStrokeFinding = findings.find((f) => f.nodeId === badRect.id && f.source === 'stroke')
    expect(badRectStrokeFinding).toBeDefined()
    expect(badRectStrokeFinding?.excessChroma).toBeGreaterThan(0)

    const gradientFindings = findings.filter((f) => f.nodeId === gradientRect.id)
    expect(gradientFindings.length).toBe(1)
    expect(gradientFindings[0].source).toBe('fill')
    expect(gradientFindings[0].index).toBe(1) // stop 1
    expect(gradientFindings[0].excessChroma).toBeGreaterThan(0)

    const textFindings = findings.filter((f) => f.nodeId === textNode.id)
    expect(textFindings.length).toBe(1)
    expect(textFindings[0].source).toBe('text-fill')
    expect(textFindings[0].excessChroma).toBeGreaterThan(0)

    const imageFindings = findings.filter((f) => f.nodeId === imageNode.id)
    expect(imageFindings.length).toBe(1)
    expect(imageFindings[0].source).toBe('fill')
    expect(imageFindings[0].excessChroma).toBe(-1)

    // Ensure safeRect generated zero findings
    expect(findings.find((f) => f.nodeId === safeRect.id)).toBeUndefined()
  })

  test('non-mutation guarantee: graph, undo stack, and SVG/PNG export bytes remain byte-identical', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]

    const rect = graph.createNode('RECTANGLE', page.id, {
      name: 'Rect 1',
      x: 10,
      y: 20,
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: parseColor('#00FF00'), opacity: 1, visible: true }]
    })

    // Undo manager is not passed to analyzeGraphGamut at all (Fixed Decision
    // #4's signature takes only graph/pageId/profile/tolerance), so the
    // strongest available assertion is that a manager tracking unrelated
    // history is left completely untouched by the analysis call - same
    // top label before and after, and still exactly one entry deep.
    const undo = createUndoManager()
    undo.push(undoEntry('unrelated edit'))
    const undoLabelBefore = undo.undoLabel

    // Take snapshot before
    const graphSnapshotBefore = JSON.stringify([...graph.nodes.entries()])
    const svgBefore = renderNodesToSVG(graph, page.id, [page.id])
    const pngBefore = await headlessRenderNodes(graph, page.id, [rect.id], { format: 'PNG' })

    // Run gamut analysis
    const findings = analyzeGraphGamut(graph, page.id, 'coated')
    expect(findings.length).toBeGreaterThan(0)

    // Take snapshot after
    const graphSnapshotAfter = JSON.stringify([...graph.nodes.entries()])
    const svgAfter = renderNodesToSVG(graph, page.id, [page.id])
    const pngAfter = await headlessRenderNodes(graph, page.id, [rect.id], { format: 'PNG' })
    const undoLabelAfter = undo.undoLabel

    expect(graphSnapshotAfter).toBe(graphSnapshotBefore)
    expect(svgAfter).toBe(svgBefore)
    expect(pngBefore).not.toBeNull()
    expect(pngAfter).not.toBeNull()
    expect(Buffer.from(pngAfter as Uint8Array).equals(Buffer.from(pngBefore as Uint8Array))).toBe(true)
    expect(undoLabelAfter).toBe(undoLabelBefore)

    // Exactly one entry deep: the unrelated edit undoes, and nothing remains behind it.
    expect(undo.canUndo).toBe(true)
    expect(undo.undo()).toBe('unrelated edit')
    expect(undo.canUndo).toBe(false)
  })
})
