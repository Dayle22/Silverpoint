import { describe, expect, mock, test } from 'bun:test'

import type { Canvas } from 'canvaskit-wasm'

import { SceneGraph } from '@open-pencil/scene-graph'

import { drawNodeFill } from '#core/canvas/fills'
import type { SkiaRenderer } from '#core/canvas/renderer'
import { makePolygonPath } from '#core/canvas/shapes'
import { drawNodeStroke } from '#core/canvas/strokes'

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

function createRenderer() {
  const paths: Array<{
    moveTo: ReturnType<typeof mock>
    lineTo: ReturnType<typeof mock>
    arcToTangent: ReturnType<typeof mock>
    close: ReturnType<typeof mock>
    delete: ReturnType<typeof mock>
  }> = []

  class MockPathBuilder {
    moveTo = mock(() => this)
    lineTo = mock(() => this)
    arcToTangent = mock(() => this)
    close = mock(() => this)
    detachAndDelete = mock(() => ({ delete: mock(() => undefined) }))

    constructor() {
      paths.push(this)
    }
  }

  const renderer = {
    ck: {
      PathBuilder: MockPathBuilder,
      LTRBRect: mock((l, t, r, b) => new Float32Array([l, t, r, b]))
    },
    fillPaint: {
      setColor: mock(() => undefined)
    },
    strokePaint: {
      setColor: mock(() => undefined),
      setStrokeWidth: mock(() => undefined)
    },
    makePolygonPath(node: Parameters<typeof makePolygonPath>[1]) {
      return makePolygonPath(renderer, node)
    }
  } as SkiaRenderer

  return { renderer, paths }
}

function createCanvas() {
  return {
    drawPath: mock(() => undefined),
    drawRRect: mock(() => undefined),
    drawRect: mock(() => undefined)
  }
}

describe('star and polygon point-radius model and rendering (F-017c)', () => {
  test('creates sharp polygon path when cornerRadius is 0', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('POLYGON', pageId(graph), {
      width: 100,
      height: 100,
      pointCount: 3,
      cornerRadius: 0
    })

    const { renderer, paths } = createRenderer()
    const path = makePolygonPath(renderer, node)
    path.delete()

    expect(paths).toHaveLength(1)
    expect(paths[0].moveTo).toHaveBeenCalledTimes(1)
    expect(paths[0].lineTo).toHaveBeenCalledTimes(2)
    expect(paths[0].arcToTangent).not.toHaveBeenCalled()
    expect(paths[0].close).toHaveBeenCalledTimes(1)
  })

  test('creates rounded polygon path with arcToTangent when cornerRadius > 0', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('POLYGON', pageId(graph), {
      width: 100,
      height: 100,
      pointCount: 5,
      cornerRadius: 10
    })

    const { renderer, paths } = createRenderer()
    const path = makePolygonPath(renderer, node)
    path.delete()

    expect(paths).toHaveLength(1)
    expect(paths[0].moveTo).toHaveBeenCalledTimes(1)
    expect(paths[0].arcToTangent).toHaveBeenCalledTimes(5)
    expect(paths[0].close).toHaveBeenCalledTimes(1)
  })

  test('creates rounded star path rounding both outer and inner vertices', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('STAR', pageId(graph), {
      width: 100,
      height: 100,
      pointCount: 5,
      starInnerRadius: 0.382,
      cornerRadius: 8
    })

    const { renderer, paths } = createRenderer()
    const path = makePolygonPath(renderer, node)
    path.delete()

    expect(paths).toHaveLength(1)
    // 5-point star has 10 total vertices (5 outer, 5 inner)
    expect(paths[0].arcToTangent).toHaveBeenCalledTimes(10)
    expect(paths[0].close).toHaveBeenCalledTimes(1)
  })

  test('clamps vertex radius to maximum allowable bisector tangent length', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('POLYGON', pageId(graph), {
      width: 60,
      height: 60,
      pointCount: 3,
      cornerRadius: 500 // huge radius exceeding triangle dimensions
    })

    const { renderer, paths } = createRenderer()
    const path = makePolygonPath(renderer, node)
    path.delete()

    expect(paths).toHaveLength(1)
    expect(paths[0].arcToTangent).toHaveBeenCalledTimes(3)
    // Verify that radius passed to arcToTangent is clamped well below 500
    for (const call of paths[0].arcToTangent.mock.calls) {
      const radius = call[4] as number
      expect(radius).toBeLessThan(60)
      expect(radius).toBeGreaterThan(0)
    }
  })

  test('delegates fill and stroke rendering through makePolygonPath', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('STAR', pageId(graph), {
      width: 100,
      height: 100,
      pointCount: 5,
      cornerRadius: 10,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
      strokes: [{ type: 'SOLID', color: { r: 0, g: 1, b: 0, a: 1 }, opacity: 1, visible: true, weight: 2 }]
    })

    const { renderer } = createRenderer()
    const canvas = createCanvas()

    drawNodeFill(renderer, canvas as Canvas, node, new Float32Array([0, 0, 100, 100]), false)
    expect(canvas.drawPath).toHaveBeenCalled()

    drawNodeStroke(renderer, canvas as Canvas, node, new Float32Array([0, 0, 100, 100]), false)
    expect(canvas.drawPath).toHaveBeenCalled()
  })
})
