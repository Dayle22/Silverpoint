import { describe, expect, test } from 'bun:test'

import {
  getGradientGeometry,
  resolveGradientEdit
} from '@open-pencil/core/canvas/overlays/gradient'
import { createEditor } from '@open-pencil/core/editor'
import { HANDLE_HIT_RADIUS } from '@open-pencil/core/constants'
import type { Fill } from '@open-pencil/scene-graph'

import {
  applyGradientDrag,
  cancelGradientDrag,
  commitGradientDrag,
  getGradientHandlePositions,
  hitTestGradientHandle,
  tryStartGradientHandle
} from '#vue/shared/input/gradient'
import {
  getGradientHandleCursorForSelection,
  updateHoverCursor
} from '#vue/shared/input/select/hover'
import type { HitTestFns } from '#vue/shared/input/select'

const dummyHitFns: HitTestFns = {
  hitTestInScope: () => null,
  isInsideContainerBounds: () => false,
  hitTestSectionTitle: () => null,
  hitTestComponentLabel: () => null,
  hitTestFrameTitle: () => null
}

function linearGradientFill(overrides: Partial<Fill> = {}): Fill {
  return {
    type: 'GRADIENT_LINEAR',
    color: { r: 1, g: 0.8, b: 0.16, a: 1 },
    opacity: 1,
    visible: true,
    gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 0, m12: 0.5 },
    gradientStops: [
      { color: { r: 1, g: 0.8, b: 0.16, a: 1 }, position: 0 },
      { color: { r: 0.05, g: 0.6, b: 1, a: 1 }, position: 1 }
    ],
    ...overrides
  } as Fill
}

describe('gradient cursor and handle interactions', () => {
  test('returns grab when hovering start and end handles on a gradient fill', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const fill = linearGradientFill()
    const node = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Box',
      x: 100,
      y: 100,
      width: 200,
      height: 150,
      fills: [fill]
    })
    editor.select([node.id])

    const { worldStart, worldEnd } = getGradientHandlePositions(node, fill, editor.graph)

    expect(getGradientHandleCursorForSelection(worldStart.x, worldStart.y, editor)).toBe('grab')
    expect(updateHoverCursor(worldStart.x, worldStart.y, editor, dummyHitFns)).toBe('grab')

    expect(getGradientHandleCursorForSelection(worldEnd.x, worldEnd.y, editor)).toBe('grab')
    expect(updateHoverCursor(worldEnd.x, worldEnd.y, editor, dummyHitFns)).toBe('grab')
  })

  test('returns grab when hovering intermediate stop handles', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const fill = linearGradientFill({
      gradientStops: [
        { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
        { color: { r: 0, g: 1, b: 0, a: 1 }, position: 0.5 },
        { color: { r: 0, g: 0, b: 1, a: 1 }, position: 1 }
      ]
    })
    const node = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Box',
      x: 100,
      y: 100,
      width: 200,
      height: 150,
      fills: [fill]
    })
    editor.select([node.id])

    const { worldStops } = getGradientHandlePositions(node, fill, editor.graph)
    expect(worldStops.length).toBe(3)
    const midStop = worldStops[1]

    expect(getGradientHandleCursorForSelection(midStop.worldPoint.x, midStop.worldPoint.y, editor)).toBe('grab')
    expect(hitTestGradientHandle(midStop.worldPoint.x, midStop.worldPoint.y, node, fill, editor.graph)).toEqual({ stopIndex: 1 })
  })

  test('returns null when pointer is outside gradient handles', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const fill = linearGradientFill()
    const node = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Box',
      x: 100,
      y: 100,
      width: 200,
      height: 150,
      fills: [fill]
    })
    editor.select([node.id])

    const { worldStart } = getGradientHandlePositions(node, fill, editor.graph)
    const outsideX = worldStart.x + HANDLE_HIT_RADIUS + 5
    const outsideY = worldStart.y + HANDLE_HIT_RADIUS + 5

    expect(getGradientHandleCursorForSelection(outsideX, outsideY, editor)).toBeNull()
  })

  test('dragging start handle updates gradientTransform', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const fill = linearGradientFill()
    const node = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Box',
      x: 100,
      y: 100,
      width: 200,
      height: 100,
      fills: [fill]
    })
    editor.select([node.id])

    const { worldStart } = getGradientHandlePositions(node, fill, editor.graph)
    const drag = tryStartGradientHandle(worldStart.x, worldStart.y, editor)
    expect(drag).not.toBeNull()
    if (!drag) return
    expect(drag.target).toBe('start')

    // Drag start point to top-center (x: 100+100=200, y: 100+0=100)
    applyGradientDrag(drag, 200, 100, editor)
    const updatedFill = editor.graph.getNode(node.id)?.fills[0]
    expect(updatedFill?.gradientTransform).toBeDefined()
    expect(updatedFill?.gradientTransform?.m00).toBeCloseTo(0.5)
    expect(updatedFill?.gradientTransform?.m10).toBeCloseTo(-0.5)

    // Commit drag
    commitGradientDrag(drag, editor)
    expect(editor.graph.getNode(node.id)?.fills[0]?.gradientTransform).toBeDefined()

    // Undo should restore original
    editor.undo.undo()
    const revertedFill = editor.graph.getNode(node.id)?.fills[0]
    expect(revertedFill?.gradientTransform).toEqual(drag.originalTransform)
  })

  test('cancelling drag restores original gradient transform', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const fill = linearGradientFill()
    const node = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Box',
      x: 100,
      y: 100,
      width: 200,
      height: 100,
      fills: [fill]
    })
    editor.select([node.id])

    const { worldEnd } = getGradientHandlePositions(node, fill, editor.graph)
    const drag = tryStartGradientHandle(worldEnd.x, worldEnd.y, editor)
    expect(drag).not.toBeNull()
    if (!drag) return
    expect(drag.target).toBe('end')

    applyGradientDrag(drag, 250, 180, editor)
    expect(editor.graph.getNode(node.id)?.fills[0]?.gradientTransform).not.toEqual(drag.originalTransform)

    cancelGradientDrag(drag, editor)
    expect(editor.graph.getNode(node.id)?.fills[0]?.gradientTransform).toEqual(drag.originalTransform)
  })
})

function radialGradientFill(overrides: Partial<Fill> = {}): Fill {
  return {
    type: 'GRADIENT_RADIAL',
    color: { r: 1, g: 0.8, b: 0.16, a: 1 },
    opacity: 1,
    visible: true,
    gradientTransform: { m00: 0.5, m01: 0, m02: 0.5, m10: 0, m11: 0.5, m12: 0.5 },
    gradientStops: [
      { color: { r: 1, g: 0.8, b: 0.16, a: 1 }, position: 0 },
      { color: { r: 0.05, g: 0.6, b: 1, a: 1 }, position: 1 }
    ],
    ...overrides
  } as Fill
}

describe('radial gradient handles', () => {
  test('geometry exposes an ellipse outline and a second-axis handle', () => {
    const editor = createEditor()
    const fill = radialGradientFill()
    const node = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      name: 'Box',
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      fills: [fill]
    })

    const geo = getGradientGeometry(node, fill)
    expect(geo.outline).toBe('ellipse')
    // Centre at the node middle, first axis tip on the right edge
    expect(geo.start).toEqual({ x: 100, y: 50 })
    expect(geo.end).toEqual({ x: 200, y: 50 })
    // Second axis runs down from the centre
    expect(geo.widthPoint).toEqual({ x: 100, y: 100 })
  })

  test('diamond gradients report a diamond outline, linear ones none', () => {
    const editor = createEditor()
    const node = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      name: 'Box',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fills: [radialGradientFill({ type: 'GRADIENT_DIAMOND' } as Partial<Fill>)]
    })
    expect(getGradientGeometry(node, node.fills[0]).outline).toBe('diamond')
    expect(getGradientGeometry(node, linearGradientFill()).outline).toBe('none')
  })

  test('the second-axis handle is hit-testable and squashes the ellipse', () => {
    const editor = createEditor()
    const fill = radialGradientFill()
    const node = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      name: 'Box',
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      fills: [fill]
    })
    editor.select([node.id])

    const { worldWidth } = getGradientHandlePositions(node, fill, editor.graph)
    expect(hitTestGradientHandle(worldWidth.x, worldWidth.y, node, fill, editor.graph)).toBe('width')

    const drag = tryStartGradientHandle(worldWidth.x, worldWidth.y, editor)
    expect(drag?.target).toBe('width')
    if (!drag) return

    // Pull the second axis halfway back towards the centre
    applyGradientDrag(drag, 100, 75, editor)
    const updated = editor.graph.getNode(node.id)?.fills[0]?.gradientTransform
    expect(updated?.m01).toBeCloseTo(0)
    expect(updated?.m11).toBeCloseTo(0.25)
    // First axis and centre are untouched
    expect(updated?.m00).toBeCloseTo(0.5)
    expect(updated?.m02).toBeCloseTo(0.5)
  })

  test('dragging the radius handle keeps the second axis in proportion', () => {
    const editor = createEditor()
    const fill = radialGradientFill()
    const node = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      name: 'Box',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fills: [fill]
    })
    editor.select([node.id])

    const { worldEnd } = getGradientHandlePositions(node, fill, editor.graph)
    const drag = tryStartGradientHandle(worldEnd.x, worldEnd.y, editor)
    expect(drag?.target).toBe('end')
    if (!drag) return

    // Halve the radius: the perpendicular axis should halve too, not reset
    applyGradientDrag(drag, 75, 50, editor)
    const updated = editor.graph.getNode(node.id)?.fills[0]?.gradientTransform
    expect(updated?.m00).toBeCloseTo(0.25)
    expect(updated?.m10).toBeCloseTo(0)
    expect(updated?.m01).toBeCloseTo(0)
    expect(updated?.m11).toBeCloseTo(0.25)
  })
})

describe('resolveGradientEdit', () => {
  test('falls back to the gradient fill of a single selected node', () => {
    const editor = createEditor()
    const node = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      name: 'Box',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fills: [linearGradientFill()]
    })
    editor.select([node.id])

    expect(editor.state.gradientEdit).toBeNull()
    expect(resolveGradientEdit(editor.graph, editor.state.selectedIds, null)).toEqual({
      nodeId: node.id,
      fillIndex: 0,
      property: 'fills'
    })
  })

  test('resolves curved gradient fill of a single selected node', () => {
    const editor = createEditor()
    const node = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      name: 'CurvedBox',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fills: [linearGradientFill({ type: 'GRADIENT_CURVED' })]
    })
    editor.select([node.id])

    expect(resolveGradientEdit(editor.graph, editor.state.selectedIds, null)).toEqual({
      nodeId: node.id,
      fillIndex: 0,
      property: 'fills'
    })
  })

  test('preserves explicit edit and active stop while its node is solely selected', () => {
    const editor = createEditor()
    const node = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      name: 'Box',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fills: [linearGradientFill()]
    })
    editor.select([node.id])
    const explicit = { nodeId: node.id, fillIndex: 0, property: 'fills' as const, activeStopIndex: 1 }

    expect(resolveGradientEdit(editor.graph, editor.state.selectedIds, explicit)).toEqual(explicit)
  })

  test('ignores stale explicit edit and resolves the new node when another gradient node is selected', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const nodeA = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Box A',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fills: [linearGradientFill()]
    })
    const nodeB = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Box B',
      x: 200,
      y: 0,
      width: 100,
      height: 100,
      fills: [radialGradientFill()]
    })

    const staleEdit = { nodeId: nodeA.id, fillIndex: 0, property: 'fills' as const, activeStopIndex: 1 }
    editor.select([nodeB.id])

    expect(resolveGradientEdit(editor.graph, editor.state.selectedIds, staleEdit)).toEqual({
      nodeId: nodeB.id,
      fillIndex: 0,
      property: 'fills'
    })
  })

  test('returns null when selecting a solid node with stale explicit edit', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const gradientNode = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Gradient',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fills: [linearGradientFill()]
    })
    const solidNode = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Solid',
      x: 200,
      y: 0,
      width: 100,
      height: 100
    })

    const staleEdit = { nodeId: gradientNode.id, fillIndex: 0, property: 'fills' as const }
    editor.select([solidNode.id])

    expect(resolveGradientEdit(editor.graph, editor.state.selectedIds, staleEdit)).toBeNull()
  })

  test('returns null when selection is cleared with stale explicit edit', () => {
    const editor = createEditor()
    const node = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      name: 'Gradient',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fills: [linearGradientFill()]
    })
    const staleEdit = { nodeId: node.id, fillIndex: 0, property: 'fills' as const }
    editor.select([])

    expect(resolveGradientEdit(editor.graph, editor.state.selectedIds, staleEdit)).toBeNull()
  })

  test('returns null for a solid fill, a locked node, or a multi-selection', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const solid = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Solid',
      x: 0,
      y: 0,
      width: 50,
      height: 50
    })
    const gradient = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Gradient',
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      fills: [linearGradientFill()]
    })

    editor.select([solid.id])
    expect(resolveGradientEdit(editor.graph, editor.state.selectedIds, null)).toBeNull()

    editor.select([solid.id, gradient.id])
    expect(resolveGradientEdit(editor.graph, editor.state.selectedIds, null)).toBeNull()

    // Multi-selection with explicit edit state still returns null
    const edit = { nodeId: gradient.id, fillIndex: 0, property: 'fills' as const }
    expect(resolveGradientEdit(editor.graph, editor.state.selectedIds, edit)).toBeNull()

    editor.select([gradient.id])
    editor.graph.updateNode(gradient.id, { locked: true })
    expect(resolveGradientEdit(editor.graph, editor.state.selectedIds, null)).toBeNull()
    expect(resolveGradientEdit(editor.graph, editor.state.selectedIds, edit)).toBeNull()
  })

  test('gradient handle cursor disappears when selection moves away or clears with stale explicit edit', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const gradient = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Gradient',
      x: 100,
      y: 100,
      width: 200,
      height: 150,
      fills: [linearGradientFill()]
    })
    const solid = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Solid',
      x: 400,
      y: 100,
      width: 200,
      height: 150
    })

    editor.select([gradient.id])
    editor.setGradientEdit({ nodeId: gradient.id, fillIndex: 0, property: 'fills', activeStopIndex: 0 })

    const { worldStart } = getGradientHandlePositions(gradient, gradient.fills[0], editor.graph)
    expect(getGradientHandleCursorForSelection(worldStart.x, worldStart.y, editor)).toBe('grab')
    expect(updateHoverCursor(worldStart.x, worldStart.y, editor, dummyHitFns)).toBe('grab')

    // Selecting solid node clears cursor affordance over old gradient handles
    editor.select([solid.id])
    expect(getGradientHandleCursorForSelection(worldStart.x, worldStart.y, editor)).toBeNull()

    // Clearing selection returns null
    editor.select([])
    expect(getGradientHandleCursorForSelection(worldStart.x, worldStart.y, editor)).toBeNull()
  })
})

describe('active colour stop highlight', () => {
  function threeStopFill(): Fill {
    return linearGradientFill({
      gradientStops: [
        { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
        { color: { r: 0, g: 1, b: 0, a: 1 }, position: 0.5 },
        { color: { r: 0, g: 0, b: 1, a: 1 }, position: 1 }
      ]
    } as Partial<Fill>)
  }

  function setup() {
    const editor = createEditor()
    const fill = threeStopFill()
    const node = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      name: 'Box',
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      fills: [fill]
    })
    editor.select([node.id])
    return { editor, node, fill }
  }

  test('grabbing a stop on canvas highlights it', () => {
    const { editor, node, fill } = setup()
    const { worldStops } = getGradientHandlePositions(node, fill, editor.graph)

    const mid = worldStops[1].worldPoint
    expect(tryStartGradientHandle(mid.x, mid.y, editor)?.target).toBe(1)
    expect(editor.state.gradientEdit?.activeStopIndex).toBe(1)
  })

  test('the two ends map to the first and last stop', () => {
    const { editor, node, fill } = setup()
    const { worldStart, worldEnd } = getGradientHandlePositions(node, fill, editor.graph)

    tryStartGradientHandle(worldStart.x, worldStart.y, editor)
    expect(editor.state.gradientEdit?.activeStopIndex).toBe(0)

    tryStartGradientHandle(worldEnd.x, worldEnd.y, editor)
    expect(editor.state.gradientEdit?.activeStopIndex).toBe(2)
  })

  test('the second-axis handle leaves the highlight alone', () => {
    const editor = createEditor()
    const fill = radialGradientFill()
    const node = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      name: 'Box',
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      fills: [fill]
    })
    editor.select([node.id])
    editor.setGradientEdit({ nodeId: node.id, fillIndex: 0, property: 'fills', activeStopIndex: 1 })

    const { worldWidth } = getGradientHandlePositions(node, fill, editor.graph)
    expect(tryStartGradientHandle(worldWidth.x, worldWidth.y, editor)?.target).toBe('width')
    expect(editor.state.gradientEdit?.activeStopIndex).toBe(1)
  })
})

function curvedGradientFill(overrides: Partial<Fill> = {}): Fill {
  return {
    type: 'GRADIENT_CURVED',
    color: { r: 1, g: 0.8, b: 0.16, a: 1 },
    opacity: 1,
    visible: true,
    gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 0, m12: 0.5 },
    gradientStops: [
      { color: { r: 1, g: 0.8, b: 0.16, a: 1 }, position: 0 },
      { color: { r: 0.05, g: 0.6, b: 1, a: 1 }, position: 1 }
    ],
    gradientSpine: [{ t: 0.5, offset: 0.2 }],
    ...overrides
  } as Fill
}

describe('curved gradient bend handle', () => {
  test('returns grab when hovering the bend handle of a curved gradient', () => {
    const editor = createEditor()
    const fill = curvedGradientFill()
    const node = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      name: 'CurvedBox',
      x: 100,
      y: 100,
      width: 200,
      height: 100,
      fills: [fill]
    })
    editor.select([node.id])

    const { worldBend } = getGradientHandlePositions(node, fill, editor.graph)
    expect(worldBend).toBeDefined()
    if (!worldBend) return

    expect(getGradientHandleCursorForSelection(worldBend.x, worldBend.y, editor)).toBe('grab')
    expect(updateHoverCursor(worldBend.x, worldBend.y, editor, dummyHitFns)).toBe('grab')
  })

  test('hitTestGradientHandle returns bend', () => {
    const editor = createEditor()
    const fill = curvedGradientFill()
    const node = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      name: 'CurvedBox',
      x: 100,
      y: 100,
      width: 200,
      height: 100,
      fills: [fill]
    })
    editor.select([node.id])

    const { worldBend } = getGradientHandlePositions(node, fill, editor.graph)
    expect(worldBend).toBeDefined()
    if (!worldBend) return

    expect(hitTestGradientHandle(worldBend.x, worldBend.y, node, fill, editor.graph)).toBe('bend')
  })

  test('applyGradientDrag with target bend updates fill.gradientSpine offset correctly', () => {
    const editor = createEditor()
    const fill = curvedGradientFill({ gradientSpine: [{ t: 0.5, offset: 0.2 }] })
    const node = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      name: 'CurvedBox',
      x: 100,
      y: 100,
      width: 200,
      height: 100,
      fills: [fill]
    })
    editor.select([node.id])

    const { worldBend } = getGradientHandlePositions(node, fill, editor.graph)
    expect(worldBend).toBeDefined()
    if (!worldBend) return

    const drag = tryStartGradientHandle(worldBend.x, worldBend.y, editor)
    expect(drag).not.toBeNull()
    if (!drag) return
    expect(drag.target).toBe('bend')
    expect(drag.originalSpine).toEqual([{ t: 0.5, offset: 0.2 }])

    const getSpine = () => {
      const n = editor.graph.getNode(node.id)
      return n ? n.fills[0]?.gradientSpine : undefined
    }

    // Drag bend handle to change offset
    applyGradientDrag(drag, 200, 70, editor)

    const updatedSpine = getSpine()
    expect(updatedSpine).toBeDefined()
    expect(updatedSpine?.[0]?.t).toBe(0.5)
    expect(updatedSpine?.[0]?.offset).toBeCloseTo(0.4)

    // Commit drag and undo
    commitGradientDrag(drag, editor)
    expect(getSpine()?.[0]?.offset).toBeCloseTo(0.4)

    editor.undo.undo()
    expect(getSpine()).toEqual([{ t: 0.5, offset: 0.2 }])

    // Redo and cancel drag check
    editor.undo.redo()
    expect(getSpine()?.[0]?.offset).toBeCloseTo(0.4)

    cancelGradientDrag(drag, editor)
    expect(getSpine()).toEqual([{ t: 0.5, offset: 0.2 }])
  })
})
