import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'
import { createEditor } from '@open-pencil/core/editor'

import {
  applyRadiusDrag,
  calculateRadiusFromLocalPointer,
  calculateVertexRadiusFromLocalPointer,
  cancelRadiusDrag,
  commitRadiusDrag,
  CORNER_DIRECTIONS,
  CORNER_RADIUS_TYPES,
  cornerPoint,
  getRadiusChanges,
  getRadiusControlLocalPoint,
  getRadiusControlPosition,
  getVertexRadiusControlLocalPoint,
  getVertexRadiusControlPosition,
  hitTestRadiusControlByMatrix,
  POINT_RADIUS_TYPES,
  RADIUS_CONTROL_SCREEN_INSET,
  RADIUS_FIELD_BY_CORNER,
  radiusForCorner,
  tryStartRadius
} from '#vue/shared/input/radius'

describe('Corner Radius Controls Engine & Math', () => {
  test('CORNER_RADIUS_TYPES includes rectangle, rounded_rectangle, frame, component, instance, boolean_operation', () => {
    expect(CORNER_RADIUS_TYPES.has('RECTANGLE')).toBe(true)
    expect(CORNER_RADIUS_TYPES.has('ROUNDED_RECTANGLE')).toBe(true)
    expect(CORNER_RADIUS_TYPES.has('FRAME')).toBe(true)
    expect(CORNER_RADIUS_TYPES.has('COMPONENT')).toBe(true)
    expect(CORNER_RADIUS_TYPES.has('INSTANCE')).toBe(true)
    expect(CORNER_RADIUS_TYPES.has('BOOLEAN_OPERATION')).toBe(true)
    expect(CORNER_RADIUS_TYPES.has('TEXT')).toBe(false)
    expect(CORNER_RADIUS_TYPES.has('LINE')).toBe(false)
    expect(RADIUS_CONTROL_SCREEN_INSET).toBe(12)
    expect(CORNER_DIRECTIONS.nw).toEqual({ x: 1, y: 1 })
    expect(RADIUS_FIELD_BY_CORNER.nw).toBe('topLeftRadius')
  })

  test('cornerPoint computes correct inwards inset positions for nw, ne, se, sw', () => {
    const w = 100
    const h = 80
    const inset = 10
    expect(cornerPoint('nw', w, h, inset)).toEqual({ x: 10, y: 10 })
    expect(cornerPoint('ne', w, h, inset)).toEqual({ x: 90, y: 10 })
    expect(cornerPoint('se', w, h, inset)).toEqual({ x: 90, y: 70 })
    expect(cornerPoint('sw', w, h, inset)).toEqual({ x: 10, y: 70 })
  })

  test('radiusForCorner returns uniform or per-corner radius depending on independentCorners flag', () => {
    const uniform = {
      cornerRadius: 15,
      topLeftRadius: 15,
      topRightRadius: 15,
      bottomRightRadius: 15,
      bottomLeftRadius: 15,
      independentCorners: false
    }
    expect(radiusForCorner('nw', uniform)).toBe(15)
    expect(radiusForCorner('ne', uniform)).toBe(15)
    expect(radiusForCorner('se', uniform)).toBe(15)
    expect(radiusForCorner('sw', uniform)).toBe(15)

    const independent = {
      cornerRadius: 0,
      topLeftRadius: 5,
      topRightRadius: 10,
      bottomRightRadius: 15,
      bottomLeftRadius: 20,
      independentCorners: true
    }
    expect(radiusForCorner('nw', independent)).toBe(5)
    expect(radiusForCorner('ne', independent)).toBe(10)
    expect(radiusForCorner('se', independent)).toBe(15)
    expect(radiusForCorner('sw', independent)).toBe(20)
  })

  test('getRadiusControlLocalPoint clamps between screen inset min, safe radius, and half-dimension max', () => {
    const w = 100
    const h = 100

    // Zoom = 1 -> minInset = 12
    const ptSmallRadius = getRadiusControlLocalPoint('nw', w, h, 4, 1)
    expect(ptSmallRadius).toEqual({ x: 12, y: 12 })

    // Zoom = 1 -> radius = 24 > minInset (12)
    const ptMedRadius = getRadiusControlLocalPoint('nw', w, h, 24, 1)
    expect(ptMedRadius).toEqual({ x: 24, y: 24 })

    // Radius exceeds max inset (50)
    const ptLargeRadius = getRadiusControlLocalPoint('nw', w, h, 80, 1)
    expect(ptLargeRadius).toEqual({ x: 50, y: 50 })

    // Zoom = 2 -> minInset = 6
    const ptZoomed = getRadiusControlLocalPoint('nw', w, h, 8, 2)
    expect(ptZoomed).toEqual({ x: 8, y: 8 })
  })

  test('getRadiusControlPosition maps local control position through world transform matrix', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('RECTANGLE', page.id, {
      x: 100,
      y: 50,
      width: 100,
      height: 100,
      cornerRadius: 20
    })

    // nw control at inset 20 is local (20, 20) -> world (120, 70)
    const nwPos = getRadiusControlPosition(node, graph, 'nw', 1)
    expect(nwPos.x).toBeCloseTo(120, 4)
    expect(nwPos.y).toBeCloseTo(70, 4)

    // ne control at local (80, 20) -> world (180, 70)
    const nePos = getRadiusControlPosition(node, graph, 'ne', 1)
    expect(nePos.x).toBeCloseTo(180, 4)
    expect(nePos.y).toBeCloseTo(70, 4)
  })

  test('hitTestRadiusControlByMatrix detects hit on corner radius handles', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('RECTANGLE', page.id, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      cornerRadius: 20
    })

    // (20, 20) is exact NW handle position
    expect(hitTestRadiusControlByMatrix(20, 20, node, graph, 1)).toBe('nw')
    expect(hitTestRadiusControlByMatrix(22, 21, node, graph, 1)).toBe('nw')

    // NE handle at (80, 20)
    expect(hitTestRadiusControlByMatrix(80, 20, node, graph, 1)).toBe('ne')

    // SE handle at (80, 80)
    expect(hitTestRadiusControlByMatrix(80, 80, node, graph, 1)).toBe('se')

    // SW handle at (20, 80)
    expect(hitTestRadiusControlByMatrix(20, 80, node, graph, 1)).toBe('sw')

    // Center or far away should be null
    expect(hitTestRadiusControlByMatrix(50, 50, node, graph, 1)).toBeNull()
    expect(hitTestRadiusControlByMatrix(500, 500, node, graph, 1)).toBeNull()
  })

  test('calculateRadiusFromLocalPointer tracks inward drag and clamps at 0', () => {
    const origRadius = 20
    const startX = 20
    const startY = 20

    // Drag nw handle inward diagonally by (+10, +10) -> delta along diagonal is 10 * sqrt(2) / sqrt(2) = 10 * 2 / sqrt(2) = 10 * sqrt(2) ~ 14.14
    const nextRadius = calculateRadiusFromLocalPointer('nw', startX, startY, startX + 10, startY + 10, origRadius)
    expect(nextRadius).toBeGreaterThan(origRadius)
    expect(nextRadius).toBeCloseTo(20 + 20 / Math.SQRT2, 4)

    // Drag outward -> reduces radius
    const outwardRadius = calculateRadiusFromLocalPointer('nw', startX, startY, startX - 30, startY - 30, origRadius)
    expect(outwardRadius).toBe(0) // clamped to 0
  })

  test('getRadiusChanges updates uniform or per-corner fields', () => {
    const origUniform = {
      cornerRadius: 10,
      topLeftRadius: 10,
      topRightRadius: 10,
      bottomRightRadius: 10,
      bottomLeftRadius: 10,
      independentCorners: false
    }

    const changesUniform = getRadiusChanges('ne', origUniform, 25)
    expect(changesUniform).toEqual({
      cornerRadius: 25,
      topLeftRadius: 25,
      topRightRadius: 25,
      bottomRightRadius: 25,
      bottomLeftRadius: 25,
      independentCorners: false
    })

    const origIndependent = {
      cornerRadius: 0,
      topLeftRadius: 5,
      topRightRadius: 10,
      bottomRightRadius: 15,
      bottomLeftRadius: 20,
      independentCorners: true
    }

    const changesIndependent = getRadiusChanges('ne', origIndependent, 30)
    expect(changesIndependent).toEqual({
      topRightRadius: 30,
      independentCorners: true
    })
  })

  test('tryStartRadius respects selection size, locked state, and node type', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const editor = createEditor({ graph })

    const rect = graph.createNode('RECTANGLE', page.id, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      cornerRadius: 20
    })

    // No selection
    expect(tryStartRadius(20, 20, editor)).toBeNull()

    // Multiple selection
    const rect2 = graph.createNode('RECTANGLE', page.id, { x: 200, y: 0, width: 100, height: 100 })
    editor.select([rect.id, rect2.id])
    expect(tryStartRadius(20, 20, editor)).toBeNull()

    // Single selection on locked node
    editor.select([rect.id])
    graph.updateNode(rect.id, { locked: true })
    expect(tryStartRadius(20, 20, editor)).toBeNull()

    // Unlocked rectangle
    graph.updateNode(rect.id, { locked: false })
    const drag = tryStartRadius(20, 20, editor)
    expect(drag).not.toBeNull()
    expect(drag?.type).toBe('radius')
    expect(drag?.nodeId).toBe(rect.id)
    expect(drag?.corner).toBe('nw')
    expect(drag?.startLocalX).toBeCloseTo(20, 4)
    expect(drag?.startLocalY).toBeCloseTo(20, 4)
    expect(drag?.original.cornerRadius).toBe(20)
  })

  test('applyRadiusDrag, commitRadiusDrag, and cancelRadiusDrag support interactive editing and undo/redo', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const editor = createEditor({ graph })

    const node = graph.createNode('RECTANGLE', page.id, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      cornerRadius: 10
    })

    editor.select([node.id])

    const drag = tryStartRadius(12, 12, editor) // default min inset when cornerRadius is 10 (12px inset)
    expect(drag).not.toBeNull()
    if (!drag) return

    // Apply inward drag
    applyRadiusDrag(drag, 22, 22, editor)
    const updated = graph.getNode(node.id)
    expect(updated?.cornerRadius).toBeGreaterThan(10)
    expect(Number.isInteger(updated?.cornerRadius)).toBe(true)

    // Commit drag with undo
    commitRadiusDrag(drag, editor)
    expect(editor.undo.canUndo).toBe(true)

    // Undo reverts back to 10
    editor.undo.undo()
    expect(graph.getNode(node.id)?.cornerRadius).toBe(10)

    // Redo restores dragged radius
    editor.undo.redo()
    expect(graph.getNode(node.id)?.cornerRadius).toBe(updated?.cornerRadius)

    // Cancel drag restores original snapshot
    const nextDrag = tryStartRadius(12, 12, editor)
    if (nextDrag) {
      applyRadiusDrag(nextDrag, 35, 35, editor)
      cancelRadiusDrag(nextDrag, editor)
      expect(graph.getNode(node.id)?.cornerRadius).toBe(nextDrag.original.cornerRadius)
    }
  })

  test('POINT_RADIUS_TYPES includes STAR and POLYGON', () => {
    expect(POINT_RADIUS_TYPES.has('STAR')).toBe(true)
    expect(POINT_RADIUS_TYPES.has('POLYGON')).toBe(true)
    expect(POINT_RADIUS_TYPES.has('RECTANGLE')).toBe(false)
  })

  test('getVertexRadiusControlLocalPoint and getVertexRadiusControlPosition for polygon and star', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const poly = graph.createNode('POLYGON', page.id, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      pointCount: 3,
      cornerRadius: 0
    })

    // Top vertex at (50, 0), center at (50, 50). Direction is down (0, 1).
    // minInset at zoom 1 is 12 -> handle should be at (50, 12)
    const localTop = getVertexRadiusControlLocalPoint(poly, 0, 1)
    expect(localTop.x).toBeCloseTo(50, 4)
    expect(localTop.y).toBeCloseTo(12, 4)

    const worldTop = getVertexRadiusControlPosition(poly, graph, 0, 1)
    expect(worldTop.x).toBeCloseTo(50, 4)
    expect(worldTop.y).toBeCloseTo(12, 4)

    // Star with 5 points: outer vertex 0 is top at (50, 0), handle at (50, 12)
    const star = graph.createNode('STAR', page.id, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      pointCount: 5,
      starInnerRadius: 0.4,
      cornerRadius: 0
    })
    const starTop = getVertexRadiusControlLocalPoint(star, 0, 1)
    expect(starTop.x).toBeCloseTo(50, 4)
    expect(starTop.y).toBeCloseTo(12, 4)
  })

  test('hitTestRadiusControlByMatrix detects vertex radius handle hits on polygon and star', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const poly = graph.createNode('POLYGON', page.id, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      pointCount: 3,
      cornerRadius: 0
    })

    // Top handle at (50, 12)
    expect(hitTestRadiusControlByMatrix(50, 12, poly, graph, 1)).toBe('vertex:0')
    expect(hitTestRadiusControlByMatrix(51, 13, poly, graph, 1)).toBe('vertex:0')
    expect(hitTestRadiusControlByMatrix(50, 50, poly, graph, 1)).toBeNull()
  })

  test('calculateVertexRadiusFromLocalPointer projects pointer delta along vertex bisector', () => {
    const direction = { x: 0, y: 1 } // pointing straight down
    const startX = 50
    const startY = 12

    // Drag down by +10px
    const nextRadius = calculateVertexRadiusFromLocalPointer(direction, startX, startY, 50, 22, 0)
    expect(nextRadius).toBe(10)

    // Drag up (outward) clamps to 0
    const negRadius = calculateVertexRadiusFromLocalPointer(direction, startX, startY, 50, 2, 0)
    expect(negRadius).toBe(0)
  })

  test('polygon and star vertex radius drag, undo/redo, and escape restoration', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const editor = createEditor({ graph })

    const star = graph.createNode('STAR', page.id, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      pointCount: 5,
      cornerRadius: 0
    })

    editor.select([star.id])
    const drag = tryStartRadius(50, 12, editor)
    expect(drag).not.toBeNull()
    if (!drag || !('direction' in drag)) return

    expect(drag.corner).toBe('vertex:0')
    expect(drag.direction?.y).toBeGreaterThan(0.9)

    // Drag inward
    applyRadiusDrag(drag, 50, 27, editor)
    expect(graph.getNode(star.id)?.cornerRadius).toBeGreaterThan(10)

    // Commit with undo
    commitRadiusDrag(drag, editor)
    expect(editor.undo.canUndo).toBe(true)

    // Undo restores 0
    editor.undo.undo()
    expect(graph.getNode(star.id)?.cornerRadius).toBe(0)

    // Redo restores dragged value
    editor.undo.redo()
    expect(graph.getNode(star.id)?.cornerRadius).toBeGreaterThan(10)

    // Cancel restoration
    const drag2 = tryStartRadius(50, 12, editor)
    if (drag2) {
      applyRadiusDrag(drag2, 50, 40, editor)
      cancelRadiusDrag(drag2, editor)
      expect(graph.getNode(star.id)?.cornerRadius).toBe(drag2.original.cornerRadius)
    }
  })
})
