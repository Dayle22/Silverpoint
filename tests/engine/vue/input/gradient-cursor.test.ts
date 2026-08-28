import { beforeAll, describe, expect, test } from 'bun:test'

import { SceneGraph, SkiaRenderer } from '@open-pencil/core'
import { linearGradientEndpoints } from '@open-pencil/core/canvas/fills'
import {
  drawGradientHandles,
  drawGradientOverlay,
  endpointsToGradientTransform,
  getGradientLinePoints,
  resolveGradientEdit
} from '@open-pencil/core/canvas/overlays'
import { createEditor } from '@open-pencil/core/editor'

import { initCanvasKit } from '#cli/headless'
import {
  applyGradientDrag,
  commitGradientDrag,
  hitTestGradientHandle,
  insertGradientStop,
  tryStartGradientHandle,
  updateGradientStopColor
} from '#vue/shared/input/gradient'
import { updateHoverCursor } from '#vue/shared/input/select/hover'
import { ref } from 'vue'

import { expectDefined } from '#tests/helpers/assert'

let ck: Awaited<ReturnType<typeof initCanvasKit>>

beforeAll(async () => {
  ck = await initCanvasKit()
})

describe('On-Canvas 2D Gradient Tool', () => {
  test('insertGradientStop adds an interpolated stop at the clicked line position', () => {
    const result = insertGradientStop(
      [
        { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
        { position: 1, color: { r: 0, g: 0, b: 1, a: 0.5 } }
      ],
      0.25
    )

    expect(result.index).toBe(1)
    expect(result.stops).toHaveLength(3)
    expect(result.stops[1]).toEqual({
      position: 0.25,
      color: { r: 0.75, g: 0, b: 0.25, a: 0.875 }
    })
  })

  test('updateGradientStopColor changes only the chosen stop', () => {
    const stops = [
      { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
      { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
    ]

    expect(updateGradientStopColor(stops, 1, { r: 0, g: 1, b: 0, a: 0.5 })).toEqual([
      { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
      { position: 1, color: { r: 0, g: 1, b: 0, a: 0.5 } }
    ])
  })

  test('endpointsToGradientTransform round-trips with linearGradientEndpoints', () => {
    const width = 200
    const height = 100
    const start = { x: 20, y: 30 }
    const end = { x: 180, y: 90 }

    const transform = endpointsToGradientTransform(start, end, width, height)
    const result = linearGradientEndpoints(width, height, transform)

    expect(result.start.x).toBeCloseTo(start.x, 4)
    expect(result.start.y).toBeCloseTo(start.y, 4)
    expect(result.end.x).toBeCloseTo(end.x, 4)
    expect(result.end.y).toBeCloseTo(end.y, 4)
  })

  test('resolveGradientEdit resolves gradient fills and strokes', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]

    const rectWithFill = graph.createNode('RECTANGLE', page.id, {
      width: 100,
      height: 100,
      fills: [
        {
          type: 'GRADIENT_LINEAR',
          color: { r: 1, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          gradientStops: [
            { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
            { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
          ],
          gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
        }
      ]
    })

    const resolved = resolveGradientEdit(graph, new Set([rectWithFill.id]))
    expect(resolved).not.toBeNull()
    expect(resolved?.property).toBe('fills')
    expect(resolved?.index).toBe(0)
    expect(resolved?.nodeId).toBe(rectWithFill.id)

    // Stroke gradient
    const rectWithStroke = graph.createNode('RECTANGLE', page.id, {
      width: 100,
      height: 100,
      fills: [],
      strokes: [
        {
          type: 'GRADIENT_LINEAR',
          color: { r: 0, g: 1, b: 0, a: 1 },
          weight: 2,
          opacity: 1,
          visible: true,
          align: 'CENTER',
          gradientStops: [
            { position: 0, color: { r: 0, g: 1, b: 0, a: 1 } },
            { position: 1, color: { r: 1, g: 1, b: 0, a: 1 } }
          ],
          gradientTransform: { m00: 0, m01: 1, m02: 0, m10: -1, m11: 0, m12: 1 }
        }
      ]
    })

    const resolvedStroke = resolveGradientEdit(graph, new Set([rectWithStroke.id]))
    expect(resolvedStroke).not.toBeNull()
    expect(resolvedStroke?.property).toBe('strokes')
    expect(resolvedStroke?.index).toBe(0)

    // Explicit edit override
    const explicitResolved = resolveGradientEdit(graph, new Set([rectWithStroke.id]), {
      nodeId: rectWithStroke.id,
      fillIndex: 0,
      property: 'strokes',
      activeStopIndex: 1
    })
    expect(explicitResolved).not.toBeNull()
    expect(explicitResolved?.activeStopIndex).toBe(1)
  })

  test('getGradientLinePoints computes local and world points', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]

    const node = graph.createNode('RECTANGLE', page.id, {
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      fills: [
        {
          type: 'GRADIENT_LINEAR',
          color: { r: 1, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          gradientStops: [
            { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
            { position: 0.5, color: { r: 0, g: 1, b: 0, a: 1 } },
            { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
          ],
          // Start at (0, 0), End at (100, 100) -> m02 = 1, m12 = 1, m00 = -1, m10 = -1
          gradientTransform: { m00: -1, m01: 1, m02: 1, m10: -1, m11: -1, m12: 1 }
        }
      ]
    })

    const fill = node.fills[0]
    const pts = getGradientLinePoints(node, fill, graph)

    expect(pts.start.local.x).toBeCloseTo(0, 4)
    expect(pts.start.local.y).toBeCloseTo(0, 4)
    expect(pts.end.local.x).toBeCloseTo(100, 4)
    expect(pts.end.local.y).toBeCloseTo(100, 4)

    // World coords are offset by node.x, node.y (50, 50)
    expect(pts.start.world.x).toBeCloseTo(50, 4)
    expect(pts.start.world.y).toBeCloseTo(50, 4)
    expect(pts.end.world.x).toBeCloseTo(150, 4)
    expect(pts.end.world.y).toBeCloseTo(150, 4)

    // Midpoint stop at position 0.5
    expect(pts.stops).toHaveLength(3)
    expect(pts.stops[1].position).toBe(0.5)
    expect(pts.stops[1].local.x).toBeCloseTo(50, 4)
    expect(pts.stops[1].local.y).toBeCloseTo(50, 4)
    expect(pts.stops[1].world.x).toBeCloseTo(100, 4)
    expect(pts.stops[1].world.y).toBeCloseTo(100, 4)
  })

  test('hitTestGradientHandle detects start, end, stop, and line hits', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]

    const node = graph.createNode('RECTANGLE', page.id, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fills: [
        {
          type: 'GRADIENT_LINEAR',
          color: { r: 1, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          gradientStops: [
            { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
            { position: 0.5, color: { r: 0, g: 1, b: 0, a: 1 } },
            { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
          ],
          gradientTransform: { m00: -1, m01: 1, m02: 1, m10: -1, m11: -1, m12: 1 }
        }
      ]
    })

    const fill = node.fills[0]

    // Hit stop 1 (midpoint at 50, 50)
    const hitStop = hitTestGradientHandle(50, 50, node, fill, graph, 1)
    expect(hitStop).toEqual({ stopIndex: 1 })

    // Hit start (0, 0)
    const hitStart = hitTestGradientHandle(0, 0, node, fill, graph, 1)
    expect(hitStart).toBe('start')

    // Hit end (100, 100)
    const hitEnd = hitTestGradientHandle(100, 100, node, fill, graph, 1)
    expect(hitEnd).toBe('end')

    // Hit line between start and stop (25, 25)
    const hitLine = hitTestGradientHandle(25, 25, node, fill, graph, 1)
    expect(hitLine).not.toBeNull()
    if (typeof hitLine === 'object' && hitLine !== null && 'line' in hitLine) {
      expect(hitLine.line).toBeCloseTo(0.25, 2)
    }

    // Far away point -> null
    const hitMiss = hitTestGradientHandle(300, 300, node, fill, graph, 1)
    expect(hitMiss).toBeNull()
  })

  test('tryStartGradientHandle initiates drag and sets gradientEdit activeStop', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const editor = createEditor({ graph })

    const node = graph.createNode('RECTANGLE', page.id, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fills: [
        {
          type: 'GRADIENT_LINEAR',
          color: { r: 1, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          gradientStops: [
            { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
            { position: 0.5, color: { r: 0, g: 1, b: 0, a: 1 } },
            { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
          ],
          gradientTransform: { m00: -1, m01: 1, m02: 1, m10: 0, m11: 0, m12: 0 }
        }
      ]
    })

    editor.select([node.id])

    const drag = tryStartGradientHandle(50, 0, editor)
    expect(drag).not.toBeNull()
    expect(drag?.nodeId).toBe(node.id)
    expect(drag?.property).toBe('fills')

    const release = tryStartGradientHandle(50, 0, editor)
    expect(release?.releaseRequested).toBe(true)
    if (release) commitGradientDrag(release, editor)
    expect(editor.undo.canUndo).toBe(false)

    const doubleClick = tryStartGradientHandle(50, 0, editor, 2)
    expect(doubleClick?.releaseRequested).toBeUndefined()
    expect(editor.state.gradientEdit?.activeStopIndex).toBe(1)
  })

  test('tryStartGradientHandle inserts and selects a stop when clicking the gradient line', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const editor = createEditor({ graph })
    const node = graph.createNode('RECTANGLE', page.id, {
      width: 100,
      height: 100,
      fills: [
        {
          type: 'GRADIENT_LINEAR',
          color: { r: 1, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          gradientStops: [
            { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
            { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
          ],
          gradientTransform: { m00: -1, m01: 1, m02: 1, m10: 0, m11: 0, m12: 0 }
        }
      ]
    })
    editor.select([node.id])

    const drag = tryStartGradientHandle(50, 0, editor)

    expect(drag?.target).toEqual({ stopIndex: 1 })
    expect(graph.getNode(node.id)?.fills[0].gradientStops).toHaveLength(3)
    expect(graph.getNode(node.id)?.fills[0].gradientStops?.[1].position).toBe(0.5)
    expect(editor.state.gradientEdit?.activeStopIndex).toBe(1)

    if (drag) applyGradientDrag(drag, { cx: 60, cy: 0 }, { editor })
    expect(graph.getNode(node.id)?.fills[0].gradientStops).toHaveLength(3)
    expect(graph.getNode(node.id)?.fills[0].gradientStops?.[1].position).toBe(0.6)
  })

  test('tryStartGradientHandle releases an active endpoint stop', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const editor = createEditor({ graph })
    const node = graph.createNode('RECTANGLE', page.id, {
      width: 100,
      height: 100,
      fills: [
        {
          type: 'GRADIENT_LINEAR',
          color: { r: 1, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          gradientStops: [
            { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
            { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
          ],
          gradientTransform: { m00: -1, m01: 1, m02: 1, m10: 0, m11: 0, m12: 0 }
        }
      ]
    })
    editor.select([node.id])

    tryStartGradientHandle(0, 0, editor)
    expect(editor.state.gradientEdit?.activeStopIndex).toBe(0)

    const release = tryStartGradientHandle(0, 0, editor)
    expect(release?.releaseRequested).toBe(true)
  })

  test('applyGradientDrag modifies start, end, and stop positions', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const editor = createEditor({ graph })

    const node = graph.createNode('RECTANGLE', page.id, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fills: [
        {
          type: 'GRADIENT_LINEAR',
          color: { r: 1, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          gradientStops: [
            { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
            { position: 0.5, color: { r: 0, g: 1, b: 0, a: 1 } },
            { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
          ],
          gradientTransform: { m00: -1, m01: 1, m02: 1, m10: 0, m11: 0, m12: 0 }
        }
      ]
    })

    editor.select([node.id])

    // Drag start handle to (10, 20)
    const dragStart = tryStartGradientHandle(0, 0, editor)
    expect(dragStart).not.toBeNull()
    if (dragStart) {
      applyGradientDrag(dragStart, { cx: 10, cy: 20 }, { editor })
      const updatedNode = graph.getNode(node.id)
      const fill = updatedNode?.fills[0]
      expect(fill?.gradientTransform).toBeDefined()
      if (fill?.gradientTransform) {
        const pts = linearGradientEndpoints(100, 100, fill.gradientTransform)
        expect(pts.start.x).toBeCloseTo(10, 2)
        expect(pts.start.y).toBeCloseTo(20, 2)
      }
    }

    // Drag stop handle at (55, 10) to 80% along the line
    const dragStop = tryStartGradientHandle(55, 10, editor)
    expect(dragStop).not.toBeNull()
    if (dragStop) {
      applyGradientDrag(dragStop, { cx: 82, cy: 4 }, { editor })
      const updatedNode = graph.getNode(node.id)
      const fill = updatedNode?.fills[0]
      expect(fill?.gradientStops?.[1].position).toBeCloseTo(0.8, 1)
    }
  })

  test('commitGradientDrag and cancelGradientDrag support undo and rollback', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const editor = createEditor({ graph })

    const node = graph.createNode('RECTANGLE', page.id, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fills: [
        {
          type: 'GRADIENT_LINEAR',
          color: { r: 1, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          gradientStops: [
            { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
            { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
          ],
          gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
        }
      ]
    })

    editor.select([node.id])

    const drag = tryStartGradientHandle(100, 0, editor)
    expect(drag).not.toBeNull()
    if (drag) {
      applyGradientDrag(drag, { cx: 120, cy: 30 }, { editor })
      commitGradientDrag(drag, editor)

      // Undo reverts change
      expect(editor.undo.canUndo).toBe(true)
      editor.undo.undo()
      const revertedNode = graph.getNode(node.id)
      expect(revertedNode?.fills[0].gradientTransform?.m00).toBe(1)

      // Redo reapplies change
      expect(editor.undo.canRedo).toBe(true)
      editor.undo.redo()
      const redoneNode = graph.getNode(node.id)
      expect(redoneNode?.fills[0].gradientTransform?.m00).not.toBe(1)
    }
  })

  test('updateHoverCursor returns grab cursor when hovering gradient handles', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const editor = createEditor({ graph })

    const node = graph.createNode('RECTANGLE', page.id, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fills: [
        {
          type: 'GRADIENT_LINEAR',
          color: { r: 1, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          gradientStops: [
            { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
            { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
          ],
          gradientTransform: { m00: -1, m01: 1, m02: 1, m10: 0, m11: 0, m12: 0 }
        }
      ]
    })

    editor.select([node.id])

    const hitFns = {
      hitTestInScope: () => null,
      hitTestSectionTitle: () => null,
      hitTestComponentLabel: () => null
    }

    // Hover start handle at (0, 0)
    const cursorStart = updateHoverCursor(0, 0, editor, hitFns)
    expect(cursorStart).toBe('grab')

    // Hover end handle at (100, 0)
    const cursorEnd = updateHoverCursor(100, 0, editor, hitFns)
    expect(cursorEnd).toBe('grab')

    // Hover far away
    const cursorMiss = updateHoverCursor(500, 500, editor, hitFns)
    expect(cursorMiss).toBeNull()
  })

  test('drawGradientOverlay renders without throwing', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]

    const node = graph.createNode('RECTANGLE', page.id, {
      width: 100,
      height: 100,
      fills: [
        {
          type: 'GRADIENT_LINEAR',
          color: { r: 1, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          gradientStops: [
            { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
            { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
          ],
          gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
        }
      ]
    })

    const surface = expectDefined(ck.MakeSurface(200, 200), 'surface')
    const renderer = new SkiaRenderer(ck, surface)
    const canvas = surface.getCanvas()

    try {
      expect(() => {
        drawGradientOverlay(renderer, canvas, graph, new Set([node.id]), {})
      }).not.toThrow()

      expect(() => {
        drawGradientHandles(renderer, canvas, graph, node, node.fills[0], 0, 'start')
      }).not.toThrow()
    } finally {
      renderer.destroy()
    }
  })

  test('gradient drag works through Vue reactive ref without throwing DataCloneError', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const editor = createEditor({ graph })

    const node = graph.createNode('RECTANGLE', page.id, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fills: [
        {
          type: 'GRADIENT_LINEAR',
          color: { r: 1, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          gradientStops: [
            { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
            { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
          ],
          gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
        }
      ]
    })

    editor.select([node.id])

    const drag = tryStartGradientHandle(100, 0, editor)
    expect(drag).not.toBeNull()
    if (!drag) return

    // Simulate Vue reactive ref holding the drag state (as in useCanvasInput)
    const dragRef = ref(drag)
    expect(() => {
      applyGradientDrag(dragRef.value, { cx: 120, cy: 30 }, { editor })
      commitGradientDrag(dragRef.value, editor)
    }).not.toThrow()

    expect(editor.undo.canUndo).toBe(true)
    editor.undo.undo()
    expect(graph.getNode(node.id)?.fills[0].gradientTransform?.m00).toBe(1)
  })
})
