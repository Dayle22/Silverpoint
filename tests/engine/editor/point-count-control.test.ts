import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'
import { createEditor } from '@open-pencil/core/editor'

import {
  applyRadiusDrag,
  calculatePointCountFromCanvasDelta,
  cancelRadiusDrag,
  commitRadiusDrag,
  getPointCountControlLocalPoint,
  getPointCountControlPosition,
  hitTestRadiusControlByMatrix,
  POINT_COUNT_STEP_SCREEN_PX,
  tryStartRadius
} from '#vue/shared/input/radius'

describe('Point Count Control Engine & Math', () => {
  test('handle placement is on upper quarter of right bounding edge', () => {
    const node = { width: 120, height: 80 }
    const pt = getPointCountControlLocalPoint(node)
    expect(pt).toEqual({ x: 120, y: 20 })
  })

  test('getPointCountControlPosition maps local handle into world coordinates', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('POLYGON', page.id, {
      x: 100,
      y: 50,
      width: 100,
      height: 100,
      pointCount: 5
    })

    const world = getPointCountControlPosition(node, graph)
    expect(world.x).toBeCloseTo(200, 4)
    expect(world.y).toBeCloseTo(75, 4)
  })

  test('calculatePointCountFromCanvasDelta steps 12 screen pixels per point', () => {
    expect(POINT_COUNT_STEP_SCREEN_PX).toBe(12)

    // start at canvas 100, zoom 1 -> +24px = +2 points
    const next2 = calculatePointCountFromCanvasDelta(100, 124, 1, 5)
    expect(next2).toBe(7)

    // -36px = -3 points -> 5 - 3 = 2 -> clamped to min 3
    const clamped = calculatePointCountFromCanvasDelta(100, 64, 1, 5)
    expect(clamped).toBe(3)

    // With zoom = 2: +12 canvas px = +24 screen px = +2 points
    const zoomed = calculatePointCountFromCanvasDelta(100, 112, 2, 4)
    expect(zoomed).toBe(6)
  })

  test('hitTestRadiusControlByMatrix detects point-count handle on polygon and star', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const poly = graph.createNode('POLYGON', page.id, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      pointCount: 5
    })

    // Handle at (100, 25)
    expect(hitTestRadiusControlByMatrix(100, 25, poly, graph, 1)).toBe('point-count')
    expect(hitTestRadiusControlByMatrix(102, 26, poly, graph, 1)).toBe('point-count')

    const star = graph.createNode('STAR', page.id, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      pointCount: 6
    })
    expect(hitTestRadiusControlByMatrix(100, 25, star, graph, 1)).toBe('point-count')
  })

  test('tryStartRadius, applyRadiusDrag, commitRadiusDrag with undo/redo', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const editor = createEditor({ graph })

    const poly = graph.createNode('POLYGON', page.id, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      pointCount: 5
    })

    editor.select([poly.id])
    const drag = tryStartRadius(100, 25, editor)
    expect(drag).not.toBeNull()
    if (!drag || !('handle' in drag) || drag.handle !== 'point-count') return

    expect(drag.originalPointCount).toBe(5)

    // Drag right by +24px -> pointCount 7
    applyRadiusDrag(drag, 124, 25, editor)
    expect(graph.getNode(poly.id)?.pointCount).toBe(7)

    // Commit drag -> records undo step
    commitRadiusDrag(drag, editor)
    expect(editor.undo.canUndo).toBe(true)

    // Undo -> restores 5
    editor.undo.undo()
    expect(graph.getNode(poly.id)?.pointCount).toBe(5)

    // Redo -> restores 7
    editor.undo.redo()
    expect(graph.getNode(poly.id)?.pointCount).toBe(7)

    // Drag left beyond minimum -> clamp 3
    const drag2 = tryStartRadius(100, 25, editor)
    if (drag2 && 'handle' in drag2 && drag2.handle === 'point-count') {
      applyRadiusDrag(drag2, 0, 25, editor)
      expect(graph.getNode(poly.id)?.pointCount).toBe(3)

      // Cancel drag -> restores 7
      cancelRadiusDrag(drag2, editor)
      expect(graph.getNode(poly.id)?.pointCount).toBe(7)
    }
  })
})
