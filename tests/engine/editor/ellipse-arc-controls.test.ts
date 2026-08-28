import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'
import { createEditor } from '@open-pencil/core/editor'

import {
  applyRadiusDrag,
  calculateEllipseArcPointerAngle,
  calculateEllipseInnerRadius,
  cancelRadiusDrag,
  commitRadiusDrag,
  ELLIPSE_ARC_TYPES,
  getEllipseArcControlLocalPoint,
  getEllipseArcControlPosition,
  hitTestRadiusControlByMatrix,
  isPartialEllipseSweep,
  MAX_ELLIPSE_INNER_RADIUS,
  tryStartRadius
} from '#vue/shared/input/radius'

describe('Ellipse Arc & Donut Controls Engine & Math', () => {
  test('ELLIPSE_ARC_TYPES contains ELLIPSE', () => {
    expect(ELLIPSE_ARC_TYPES.has('ELLIPSE')).toBe(true)
    expect(ELLIPSE_ARC_TYPES.has('RECTANGLE')).toBe(false)
  })

  test('isPartialEllipseSweep detects full circle vs partial arc', () => {
    expect(isPartialEllipseSweep(null)).toBe(false)
    expect(isPartialEllipseSweep({ startingAngle: 0, endingAngle: 0, innerRadius: 0 })).toBe(false)
    expect(isPartialEllipseSweep({ startingAngle: 0, endingAngle: Math.PI * 2, innerRadius: 0 })).toBe(false)
    expect(isPartialEllipseSweep({ startingAngle: 0, endingAngle: Math.PI, innerRadius: 0 })).toBe(true)
    expect(isPartialEllipseSweep({ startingAngle: 0.5, endingAngle: 2.5, innerRadius: 0.5 })).toBe(true)
  })

  test('getEllipseArcControlLocalPoint computes handle positions', () => {
    const plainEllipse = { width: 100, height: 100, arcData: null }

    // Plain full circle: arc-end at East (100, 50), arc-start is null, arc-inner at center (50, 50)
    expect(getEllipseArcControlLocalPoint(plainEllipse, 'arc-end')).toEqual({ x: 100, y: 50 })
    expect(getEllipseArcControlLocalPoint(plainEllipse, 'arc-start')).toBeNull()
    expect(getEllipseArcControlLocalPoint(plainEllipse, 'arc-inner')).toEqual({ x: 50, y: 50 })

    // Partial pie: startingAngle 0 (East), endingAngle PI/2 (South)
    const pie = {
      width: 100,
      height: 100,
      arcData: { startingAngle: 0, endingAngle: Math.PI / 2, innerRadius: 0 }
    }
    const endPt = getEllipseArcControlLocalPoint(pie, 'arc-end')
    expect(endPt?.x).toBeCloseTo(50, 4)
    expect(endPt?.y).toBeCloseTo(100, 4)

    const startPt = getEllipseArcControlLocalPoint(pie, 'arc-start')
    expect(startPt?.x).toBeCloseTo(100, 4)
    expect(startPt?.y).toBeCloseTo(50, 4)

    // Donut: innerRadius 0.5 -> inner handle at (50, 50 - 50 * 0.5) = (50, 25)
    const donut = {
      width: 100,
      height: 100,
      arcData: { startingAngle: 0, endingAngle: Math.PI * 2, innerRadius: 0.5 }
    }
    const innerPt = getEllipseArcControlLocalPoint(donut, 'arc-inner')
    expect(innerPt?.x).toBeCloseTo(50, 4)
    expect(innerPt?.y).toBeCloseTo(25, 4)

    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('ELLIPSE', page.id, {
      x: 10,
      y: 20,
      width: 100,
      height: 100,
      arcData: { startingAngle: 0, endingAngle: Math.PI * 2, innerRadius: 0.5 }
    })
    const worldInner = getEllipseArcControlPosition(node, graph, 'arc-inner')
    expect(worldInner?.x).toBeCloseTo(60, 4)
    expect(worldInner?.y).toBeCloseTo(45, 4)
  })

  test('calculateEllipseArcPointerAngle converts local coords to clockwise angles', () => {
    const node = { width: 100, height: 100 }
    // East: (100, 50) -> angle 0
    expect(calculateEllipseArcPointerAngle(node, { x: 100, y: 50 })).toBeCloseTo(0, 4)
    // South: (50, 100) -> angle PI/2
    expect(calculateEllipseArcPointerAngle(node, { x: 50, y: 100 })).toBeCloseTo(Math.PI / 2, 4)
    // West: (0, 50) -> angle PI
    expect(calculateEllipseArcPointerAngle(node, { x: 0, y: 50 })).toBeCloseTo(Math.PI, 4)
    // North: (50, 0) -> angle 3*PI/2
    expect(calculateEllipseArcPointerAngle(node, { x: 50, y: 0 })).toBeCloseTo((3 * Math.PI) / 2, 4)
  })

  test('calculateEllipseInnerRadius clamps to [0, 0.99]', () => {
    const node = { width: 100, height: 100 }
    // Center -> 0
    expect(calculateEllipseInnerRadius(node, { x: 50, y: 50 })).toBeCloseTo(0, 4)
    // Halfway to rim -> 0.5
    expect(calculateEllipseInnerRadius(node, { x: 50, y: 25 })).toBeCloseTo(0.5, 4)
    // Beyond rim -> clamped to 0.99
    expect(calculateEllipseInnerRadius(node, { x: 50, y: -50 })).toBe(MAX_ELLIPSE_INNER_RADIUS)
  })

  test('hitTestRadiusControlByMatrix on ellipse detects arc-end and arc-inner handles', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const ellipse = graph.createNode('ELLIPSE', page.id, {
      x: 0,
      y: 0,
      width: 100,
      height: 100
    })

    // East handle at (100, 50)
    expect(hitTestRadiusControlByMatrix(100, 50, ellipse, graph, 1)).toBe('arc-end')
    // Center handle at (50, 50)
    expect(hitTestRadiusControlByMatrix(50, 50, ellipse, graph, 1)).toBe('arc-inner')
  })

  test('dragging arc-end creates pie, records single undo step, Escape cancels', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const editor = createEditor({ graph })

    const ellipse = graph.createNode('ELLIPSE', page.id, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      arcData: null
    })

    editor.select([ellipse.id])

    // Drag arc-end from East (100, 50) to South (50, 100)
    const drag = tryStartRadius(100, 50, editor)
    expect(drag).not.toBeNull()
    if (!drag || !('handle' in drag) || drag.handle !== 'arc-end') return

    applyRadiusDrag(drag, 50, 100, editor)
    const preview = graph.getNode(ellipse.id)?.arcData
    expect(preview).not.toBeNull()
    expect(preview?.startingAngle).toBe(0)
    expect(preview?.endingAngle).toBeCloseTo(Math.PI / 2, 3)

    // Commit drag -> undo record created
    commitRadiusDrag(drag, editor)
    expect(editor.undo.canUndo).toBe(true)

    // Undo -> restores arcData: null
    editor.undo.undo()
    expect(graph.getNode(ellipse.id)?.arcData).toBeNull()

    // Redo -> restores pie
    editor.undo.redo()
    expect(graph.getNode(ellipse.id)?.arcData?.endingAngle).toBeCloseTo(Math.PI / 2, 3)

    // Cancel restoration
    const drag2 = tryStartRadius(50, 100, editor)
    if (drag2 && 'handle' in drag2 && drag2.handle === 'arc-end') {
      applyRadiusDrag(drag2, 0, 50, editor) // drag to West
      cancelRadiusDrag(drag2, editor)
      expect(graph.getNode(ellipse.id)?.arcData?.endingAngle).toBeCloseTo(Math.PI / 2, 3)
    }
  })

  test('dragging arc-inner creates donut hole with [0, 0.99] clamp', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const editor = createEditor({ graph })

    const ellipse = graph.createNode('ELLIPSE', page.id, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      arcData: null
    })

    editor.select([ellipse.id])

    // Drag arc-inner from center (50, 50) outward to (50, 25)
    const drag = tryStartRadius(50, 50, editor)
    expect(drag).not.toBeNull()
    if (!drag || !('handle' in drag) || drag.handle !== 'arc-inner') return

    applyRadiusDrag(drag, 50, 25, editor)
    const preview = graph.getNode(ellipse.id)?.arcData
    expect(preview?.innerRadius).toBeCloseTo(0.5, 3)

    commitRadiusDrag(drag, editor)
    expect(editor.undo.canUndo).toBe(true)

    editor.undo.undo()
    expect(graph.getNode(ellipse.id)?.arcData).toBeNull()
  })
})
