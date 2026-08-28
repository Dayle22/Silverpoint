import { describe, expect, mock, test } from 'bun:test'

import type { Canvas } from 'canvaskit-wasm'

import { SceneGraph } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { buildIndividualStrokeRingPath } from '#core/canvas/shapes'
import { drawIndividualSideStrokes } from '#core/canvas/strokes'

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

function createRenderer() {
  const createdPaths: Array<{
    moveTo: ReturnType<typeof mock>
    lineTo: ReturnType<typeof mock>
    arcToRotated: ReturnType<typeof mock>
    close: ReturnType<typeof mock>
    delete: ReturnType<typeof mock>
  }> = []

  const deletedPaths: unknown[] = []

  class MockPath {
    deleted = false
    delete = mock(() => {
      this.deleted = true
      deletedPaths.push(this)
    })
  }

  class MockPathBuilder {
    moveTo = mock(() => this)
    lineTo = mock(() => this)
    arcToRotated = mock(() => this)
    close = mock(() => this)
    detachAndDelete = mock(() => {
      const p = new MockPath()
      createdPaths.push(this)
      return p
    })
  }

  const strokePaint = {
    style: 1,
    setStyle: mock((s: number) => {
      strokePaint.style = s
    }),
    setStrokeWidth: mock(() => undefined)
  }

  const renderer = {
    ck: {
      PathBuilder: MockPathBuilder,
      Path: {
        MakeFromOp: mock((_p1, _p2, _op) => {
          return new MockPath()
        })
      },
      PathOp: {
        Difference: 1
      },
      PaintStyle: {
        Fill: 0,
        Stroke: 1
      },
      LTRBRect: mock((l, t, r, b) => new Float32Array([l, t, r, b]))
    },
    strokePaint,
    fillPaint: {}
  } as SkiaRenderer

  return { renderer, createdPaths, deletedPaths, strokePaint }
}

function createCanvas() {
  return {
    drawLine: mock(() => undefined),
    drawPath: mock(() => undefined),
    drawRRect: mock(() => undefined),
    drawRect: mock(() => undefined)
  }
}

describe('individual stroke corners (F-017b)', () => {
  test('takes 4-drawLine fast path when all corner radii are 0', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 100,
      height: 60,
      cornerRadius: 0,
      independentStrokeWeights: true,
      borderTopWeight: 2,
      borderRightWeight: 4,
      borderBottomWeight: 2,
      borderLeftWeight: 4
    })

    const { renderer } = createRenderer()
    const canvas = createCanvas()

    drawIndividualSideStrokes(renderer, canvas as Canvas, node, 'INSIDE')

    expect(canvas.drawLine).toHaveBeenCalledTimes(4)
    expect(canvas.drawPath).not.toHaveBeenCalled()
  })

  test('builds ring path and draws filled path when corner radius > 0', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 100,
      height: 60,
      cornerRadius: 12,
      independentStrokeWeights: true,
      borderTopWeight: 2,
      borderRightWeight: 6,
      borderBottomWeight: 4,
      borderLeftWeight: 8
    })

    const { renderer, strokePaint, deletedPaths } = createRenderer()
    const canvas = createCanvas()

    drawIndividualSideStrokes(renderer, canvas as Canvas, node, 'INSIDE')

    expect(canvas.drawLine).not.toHaveBeenCalled()
    expect(canvas.drawPath).toHaveBeenCalledTimes(1)
    expect(strokePaint.setStyle).toHaveBeenCalledWith(renderer.ck.PaintStyle.Fill)
    expect(strokePaint.setStyle).toHaveBeenCalledWith(renderer.ck.PaintStyle.Stroke)
    // Verify intermediate and final paths are deleted
    expect(deletedPaths.length).toBeGreaterThanOrEqual(2)
  })

  test('supports CENTER and OUTSIDE stroke alignments with mixed weights', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 120,
      height: 80,
      independentCorners: true,
      topLeftRadius: 16,
      topRightRadius: 8,
      bottomRightRadius: 20,
      bottomLeftRadius: 4,
      independentStrokeWeights: true,
      borderTopWeight: 3,
      borderRightWeight: 5,
      borderBottomWeight: 7,
      borderLeftWeight: 9
    })

    const { renderer, createdPaths } = createRenderer()

    const pathOutside = buildIndividualStrokeRingPath(renderer, node, 'OUTSIDE', {
      topLeft: 16,
      topRight: 8,
      bottomRight: 20,
      bottomLeft: 4
    })
    pathOutside.delete()

    const pathCenter = buildIndividualStrokeRingPath(renderer, node, 'CENTER', {
      topLeft: 16,
      topRight: 8,
      bottomRight: 20,
      bottomLeft: 4
    })
    pathCenter.delete()

    expect(createdPaths.length).toBeGreaterThanOrEqual(4)
    expect(createdPaths[0].arcToRotated).toHaveBeenCalled()
  })

  test('clamps corner budget cleanly when radii exceed bounds', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 40,
      height: 30,
      cornerRadius: 100,
      independentStrokeWeights: true,
      borderTopWeight: 2,
      borderRightWeight: 2,
      borderBottomWeight: 2,
      borderLeftWeight: 2
    })

    const { renderer } = createRenderer()
    const canvas = createCanvas()

    drawIndividualSideStrokes(renderer, canvas as Canvas, node, 'INSIDE')

    expect(canvas.drawPath).toHaveBeenCalledTimes(1)
  })

  test('handles degenerate inner dimensions without crashing', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 20,
      height: 20,
      cornerRadius: 5,
      independentStrokeWeights: true,
      borderTopWeight: 15,
      borderRightWeight: 15,
      borderBottomWeight: 15,
      borderLeftWeight: 15
    })

    const { renderer } = createRenderer()
    const path = buildIndividualStrokeRingPath(renderer, node, 'INSIDE', {
      topLeft: 5,
      topRight: 5,
      bottomRight: 5,
      bottomLeft: 5
    })

    expect(path).toBeDefined()
    path.delete()
  })
})
