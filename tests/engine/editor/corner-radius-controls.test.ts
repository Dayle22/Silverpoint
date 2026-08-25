import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'
import { createEditor } from '@open-pencil/core/editor'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'

import {
  calculateRadiusFromLocalPointer,
  applyRadiusDrag,
  cancelRadiusDrag,
  commitRadiusDrag,
  getRadiusChanges,
  getRadiusControlLocalPoint,
  getRadiusControlPosition,
  getVertexRadiusControlLocalPoint,
  getVertexRadiusControlPosition,
  tryStartRadius
} from '#vue/shared/input/radius'

describe('corner-radius controls', () => {
  test.each([
    ['nw', { x: 12, y: 12 }],
    ['ne', { x: 188, y: 12 }],
    ['se', { x: 188, y: 88 }],
    ['sw', { x: 12, y: 88 }]
  ] as const)('places the %s control inward from its corner', (corner, expected) => {
    expect(getRadiusControlLocalPoint(corner, 200, 100, 0, 1)).toEqual(expected)
  })

  test.each([
    ['nw', { x: 40, y: 40 }],
    ['ne', { x: 160, y: 40 }],
    ['se', { x: 160, y: 60 }],
    ['sw', { x: 40, y: 60 }]
  ] as const)(
    'moves the %s control inward as radius grows past the fixed floor',
    (corner, expected) => {
      expect(getRadiusControlLocalPoint(corner, 200, 100, 40, 1)).toEqual(expected)
    }
  )

  test('keeps the 12px floor when radius is below it', () => {
    expect(getRadiusControlLocalPoint('nw', 200, 100, 5, 1)).toEqual({ x: 12, y: 12 })
  })

  test.each([
    ['nw', { x: 50, y: 50 }],
    ['se', { x: 150, y: 50 }]
  ] as const)(
    'clamps the %s control inset to half the shorter side so opposite handles never cross',
    (corner, expected) => {
      expect(getRadiusControlLocalPoint(corner, 200, 100, 999, 1)).toEqual(expected)
    }
  )

  test('the 12px floor scales with zoom but the radius-driven inset does not', () => {
    expect(getRadiusControlLocalPoint('nw', 200, 100, 0, 2)).toEqual({ x: 6, y: 6 })
    expect(getRadiusControlLocalPoint('nw', 200, 100, 40, 2)).toEqual({ x: 40, y: 40 })
  })

  describe('star/polygon vertex radius handles', () => {
    const diamond = {
      width: 200,
      height: 200,
      pointCount: 4,
      type: 'POLYGON',
      starInnerRadius: 0.38
    } as const

    test('handle sits at the fixed 12px floor when cornerRadius is 0', () => {
      expect(getVertexRadiusControlLocalPoint({ ...diamond, cornerRadius: 0 }, 0, 1)).toEqual({
        x: 100,
        y: 12
      })
    })

    test('handle moves inward as cornerRadius grows toward the vertex clamp', () => {
      expect(getVertexRadiusControlLocalPoint({ ...diamond, cornerRadius: 40 }, 0, 1)).toEqual({
        x: 100,
        y: 40
      })
    })

    test('handle clamps at the vertex max radius instead of overshooting', () => {
      const point = getVertexRadiusControlLocalPoint({ ...diamond, cornerRadius: 999 }, 0, 1)
      expect(point.x).toBeCloseTo(100, 5)
      expect(point.y).toBeCloseTo(50 * Math.SQRT2, 5)
    })

    test('a star handle set has pointCount handles, none at the inner vertices', () => {
      const editor = createEditor()
      const node = editor.graph.createNode('STAR', editor.state.currentPageId, {
        width: 200,
        height: 200,
        pointCount: 5,
        starInnerRadius: 0.38,
        cornerRadius: 0
      })
      editor.select([node.id])
      for (let i = 0; i < 5; i++) {
        const point = getVertexRadiusControlPosition(node, editor.graph, i)
        const drag = tryStartRadius(point.x, point.y, editor)
        expect(drag).not.toBeNull()
        expect(drag?.corner).toBe(`vertex:${i}`)
      }
    })

    test('dragging one vertex handle rounds the shared cornerRadius and every handle moves', () => {
      const editor = createEditor()
      const node = editor.graph.createNode('POLYGON', editor.state.currentPageId, {
        width: 200,
        height: 200,
        pointCount: 4,
        cornerRadius: 0
      })
      editor.select([node.id])
      const start = getVertexRadiusControlPosition(node, editor.graph, 0)
      const drag = tryStartRadius(start.x, start.y, editor)
      expect(drag).not.toBeNull()
      if (!drag) return

      applyRadiusDrag(drag, start.x, start.y + 28, editor)
      commitRadiusDrag(drag, editor)

      const changed = editor.graph.getNode(node.id)
      expect(changed?.cornerRadius).toBe(28)
      expect(changed?.topLeftRadius).toBe(0)
      expect(changed?.independentCorners).toBe(false)
      expect(editor.undo.undoLabel).toBe('Adjust corner radius')

      const otherHandle = getVertexRadiusControlPosition(node, editor.graph, 2)
      expect(otherHandle).toEqual({ x: 100, y: 200 - 28 })
    })

    test('cancel restores the opening cornerRadius without an undo entry', () => {
      const editor = createEditor()
      const node = editor.graph.createNode('POLYGON', editor.state.currentPageId, {
        width: 200,
        height: 200,
        pointCount: 4,
        cornerRadius: 10
      })
      editor.select([node.id])
      const point = getVertexRadiusControlPosition(node, editor.graph, 0)
      const drag = tryStartRadius(point.x, point.y, editor)
      expect(drag).not.toBeNull()
      if (!drag) return
      applyRadiusDrag(drag, point.x, point.y + 30, editor)
      cancelRadiusDrag(drag, editor)

      expect(editor.graph.getNode(node.id)?.cornerRadius).toBe(10)
      expect(editor.undo.canUndo).toBe(false)
    })

    test('ELLIPSE and VECTOR stay unsupported', () => {
      const editor = createEditor()
      const ellipse = editor.graph.createNode('ELLIPSE', editor.state.currentPageId, {
        width: 200,
        height: 100
      })
      editor.select([ellipse.id])
      expect(tryStartRadius(100, 50, editor)).toBeNull()
    })
  })

  test('maps a rotated and nested control into world coordinates', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, {
      x: 40,
      y: 30,
      width: 300,
      height: 200,
      rotation: 20
    })
    const node = graph.createNode('RECTANGLE', frame.id, {
      x: 50,
      y: 25,
      width: 200,
      height: 100,
      rotation: 15
    })

    const position = getRadiusControlPosition(node, graph, 'nw', 2)
    expect(position.x).toBeCloseTo(146.79, 1)
    expect(position.y).toBeCloseTo(16.55, 1)
  })

  test.each([
    ['nw', { x: 1, y: 1 }],
    ['ne', { x: -1, y: 1 }],
    ['se', { x: -1, y: -1 }],
    ['sw', { x: 1, y: -1 }]
  ] as const)('projects %s movement onto its inward diagonal', (corner, delta) => {
    const result = calculateRadiusFromLocalPointer(
      corner,
      40,
      40,
      40 + delta.x * 10,
      40 + delta.y * 10,
      8
    )
    expect(result).toBeCloseTo(8 + Math.sqrt(200), 5)
  })

  test('clamps invalid and outward movement to a finite non-negative radius', () => {
    expect(calculateRadiusFromLocalPointer('nw', 40, 40, -100, -100, 8)).toBe(0)
    expect(calculateRadiusFromLocalPointer('nw', 40, 40, Number.NaN, 40, 8)).toBe(8)
  })

  test('uniform mode updates all radius fields without changing independent mode', () => {
    expect(
      getRadiusChanges(
        'ne',
        {
          cornerRadius: 8,
          topLeftRadius: 8,
          topRightRadius: 8,
          bottomRightRadius: 8,
          bottomLeftRadius: 8,
          independentCorners: false
        },
        24
      )
    ).toEqual({
      cornerRadius: 24,
      topLeftRadius: 24,
      topRightRadius: 24,
      bottomRightRadius: 24,
      bottomLeftRadius: 24,
      independentCorners: false
    })
  })

  test('independent mode updates only the dragged corner', () => {
    expect(
      getRadiusChanges(
        'sw',
        {
          cornerRadius: 8,
          topLeftRadius: 4,
          topRightRadius: 12,
          bottomRightRadius: 16,
          bottomLeftRadius: 20,
          independentCorners: true
        },
        24
      )
    ).toEqual({ bottomLeftRadius: 24, independentCorners: true })
  })

  test('commits one uniform radius undo step and redo restores the final value', () => {
    const editor = createEditor()
    const node = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      x: 40,
      y: 30,
      width: 200,
      height: 100,
      cornerRadius: 8,
      topLeftRadius: 8,
      topRightRadius: 8,
      bottomRightRadius: 8,
      bottomLeftRadius: 8,
      independentCorners: false
    })
    editor.select([node.id])
    const startPoint = getRadiusControlPosition(node, editor.graph, 'nw')
    const drag = tryStartRadius(startPoint.x, startPoint.y, editor)
    expect(drag).not.toBeNull()
    if (!drag) return

    const finalPoint = Matrix.mapPoint(getWorldMatrix(node, editor.graph), { x: 30, y: 30 })
    applyRadiusDrag(drag, finalPoint.x, finalPoint.y, editor)
    commitRadiusDrag(drag, editor)

    const changed = editor.graph.getNode(node.id)
    expect(changed?.cornerRadius).toBe(33)
    expect(changed?.topLeftRadius).toBe(changed?.cornerRadius)
    expect(changed?.bottomRightRadius).toBe(changed?.cornerRadius)
    expect(editor.undo.undoLabel).toBe('Adjust corner radius')

    editor.undo.undo()
    expect(editor.graph.getNode(node.id)?.cornerRadius).toBe(8)
    editor.undo.redo()
    expect(editor.graph.getNode(node.id)?.cornerRadius).toBe(33)
  })

  test('horizontal-only drag commits to a whole-number radius', () => {
    const editor = createEditor()
    const node = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      cornerRadius: 0,
      topLeftRadius: 0,
      topRightRadius: 0,
      bottomRightRadius: 0,
      bottomLeftRadius: 0,
      independentCorners: false
    })
    editor.select([node.id])
    const startPoint = getRadiusControlPosition(node, editor.graph, 'nw')
    const drag = tryStartRadius(startPoint.x, startPoint.y, editor)
    expect(drag).not.toBeNull()
    if (!drag) return

    const finalPoint = Matrix.mapPoint(getWorldMatrix(node, editor.graph), {
      x: startPoint.x + 100,
      y: startPoint.y
    })
    applyRadiusDrag(drag, finalPoint.x, finalPoint.y, editor)
    commitRadiusDrag(drag, editor)

    const changed = editor.graph.getNode(node.id)
    expect(changed?.cornerRadius).toBe(71)
    expect(Number.isInteger(changed?.cornerRadius)).toBe(true)
  })

  test('independent mode commits only the selected corner', () => {
    const editor = createEditor()
    const node = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      width: 200,
      height: 100,
      cornerRadius: 8,
      topLeftRadius: 4,
      topRightRadius: 12,
      bottomRightRadius: 16,
      bottomLeftRadius: 20,
      independentCorners: true
    })
    editor.select([node.id])
    const startPoint = getRadiusControlPosition(node, editor.graph, 'se')
    const drag = tryStartRadius(startPoint.x, startPoint.y, editor)
    expect(drag).not.toBeNull()
    if (!drag) return

    const finalPoint = Matrix.mapPoint(getWorldMatrix(node, editor.graph), { x: 170, y: 70 })
    applyRadiusDrag(drag, finalPoint.x, finalPoint.y, editor)
    commitRadiusDrag(drag, editor)

    expect(editor.graph.getNode(node.id)).toMatchObject({
      topLeftRadius: 4,
      topRightRadius: 12,
      bottomLeftRadius: 20,
      independentCorners: true
    })
    expect(editor.graph.getNode(node.id)?.bottomRightRadius).toBe(36)
  })

  test('cancel restores the opening radius without an undo entry', () => {
    const editor = createEditor()
    const node = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      width: 200,
      height: 100,
      cornerRadius: 8,
      topLeftRadius: 8,
      topRightRadius: 8,
      bottomRightRadius: 8,
      bottomLeftRadius: 8,
      independentCorners: false
    })
    editor.select([node.id])
    const point = getRadiusControlPosition(node, editor.graph, 'sw')
    const drag = tryStartRadius(point.x, point.y, editor)
    expect(drag).not.toBeNull()
    if (!drag) return
    applyRadiusDrag(drag, point.x + 30, point.y - 30, editor)
    cancelRadiusDrag(drag, editor)

    expect(editor.graph.getNode(node.id)?.cornerRadius).toBe(8)
    expect(editor.undo.canUndo).toBe(false)
  })

  test('ignores unsupported shapes and multiple selections', () => {
    const editor = createEditor()
    const ellipse = editor.graph.createNode('ELLIPSE', editor.state.currentPageId, {
      width: 200,
      height: 100
    })
    const frame = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      x: 240,
      width: 200,
      height: 100
    })
    editor.select([ellipse.id])
    expect(tryStartRadius(12, 12, editor)).toBeNull()
    editor.select([frame.id])
    expect(tryStartRadius(252, 12, editor)).not.toBeNull()
    editor.select([ellipse.id, frame.id])
    expect(tryStartRadius(252, 12, editor)).toBeNull()
  })

  test('supports BOOLEAN_OPERATION nodes', () => {
    const editor = createEditor()
    const boolNode = editor.graph.createNode('BOOLEAN_OPERATION', editor.state.currentPageId, {
      width: 200,
      height: 100,
      booleanOperation: 'UNION'
    })
    editor.select([boolNode.id])
    expect(tryStartRadius(12, 12, editor)).not.toBeNull()
  })
})
