import { describe, expect, test } from 'bun:test'

import type { Canvas } from 'canvaskit-wasm'

import { SceneGraph } from '@open-pencil/scene-graph'
import type { SceneNode } from '@open-pencil/scene-graph'

import {
  drawEllipseArcHandles,
  drawNodeSelection,
  drawPointCountHandle,
  drawRadiusHandles,
  drawVertexRadiusHandles
} from '#core/canvas/overlays/selection'

import { createMockCanvas, createMockRenderer, mockCalls } from './effects/helpers'

describe('Selection Outline & Handle Overlays', () => {
  test('drawRadiusHandles draws 4 white dots on rectangle', () => {
    const r = createMockRenderer({ zoom: 1 })
    const canvas = createMockCanvas()
    const node = {
      id: 'rect',
      type: 'RECTANGLE',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      cornerRadius: 10,
      independentCorners: false,
      locked: false
    } as SceneNode

    drawRadiusHandles(r, canvas as Canvas, node)

    // 4 corners * 2 calls each (fill + stroke) = 8 drawCircle calls
    expect(mockCalls(canvas.drawCircle)).toHaveLength(8)
  })

  test('drawVertexRadiusHandles and drawPointCountHandle draw on polygon and star', () => {
    const r = createMockRenderer({ zoom: 1 })
    const canvas = createMockCanvas()
    const poly = {
      id: 'poly',
      type: 'POLYGON',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      pointCount: 3,
      cornerRadius: 0,
      locked: false
    } as SceneNode

    drawVertexRadiusHandles(r, canvas as Canvas, poly)
    // 3 vertices * 2 calls = 6 drawCircle calls
    expect(mockCalls(canvas.drawCircle)).toHaveLength(6)

    const canvas2 = createMockCanvas()
    drawPointCountHandle(r, canvas2 as Canvas, poly)
    // 1 point-count handle * 2 calls = 2 drawCircle calls
    expect(mockCalls(canvas2.drawCircle)).toHaveLength(2)
  })

  test('drawEllipseArcHandles draws end and inner handles on full ellipse, start on partial', () => {
    const r = createMockRenderer({ zoom: 1 })
    const canvas = createMockCanvas()
    const fullEllipse = {
      id: 'el',
      type: 'ELLIPSE',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      arcData: null,
      locked: false
    } as SceneNode

    drawEllipseArcHandles(r, canvas as Canvas, fullEllipse)
    // End handle (2 calls) + Inner handle (2 calls) = 4 drawCircle calls
    expect(mockCalls(canvas.drawCircle)).toHaveLength(4)

    const canvas2 = createMockCanvas()
    const partialPie = {
      id: 'pie',
      type: 'ELLIPSE',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      arcData: { startingAngle: 0, endingAngle: Math.PI / 2, innerRadius: 0 },
      locked: false
    } as SceneNode

    drawEllipseArcHandles(r, canvas2 as Canvas, partialPie)
    // End handle (2 calls) + Start handle (2 calls) + Inner handle (2 calls) = 6 drawCircle calls
    expect(mockCalls(canvas2.drawCircle)).toHaveLength(6)
  })

  test('drawNodeSelection dispatches overlay handles for polygon, star, and ellipse', () => {
    const r = createMockRenderer({ zoom: 1 })
    const canvas = createMockCanvas()
    const graph = new SceneGraph()
    const page = graph.getPages()[0]

    const star = graph.createNode('STAR', page.id, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      pointCount: 5,
      cornerRadius: 0,
      locked: false
    })

    drawNodeSelection(r, canvas as Canvas, star, 0, graph)
    // Star has 5 vertex handles + 1 point-count handle = 6 handles * 2 = 12 drawCircle calls
    expect(mockCalls(canvas.drawCircle)).toHaveLength(12)

    // Locked node has no handles
    const canvasLocked = createMockCanvas()
    const lockedStar = { ...star, locked: true } as SceneNode
    drawNodeSelection(r, canvasLocked as Canvas, lockedStar, 0, graph)
    expect(mockCalls(canvasLocked.drawCircle)).toHaveLength(0)
  })
})
