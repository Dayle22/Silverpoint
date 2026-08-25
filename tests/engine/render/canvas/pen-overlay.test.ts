import { describe, expect, test } from 'bun:test'
import type { Canvas, Paint } from 'canvaskit-wasm'

import {
  PEN_CLOSE_ICON_OFFSET,
  PEN_CLOSE_RADIUS_BOOST,
  PEN_HANDLE_RADIUS,
  PEN_VERTEX_RADIUS
} from '#core/constants'
import { drawPenOverlay } from '#core/canvas/pen-overlay'
import type { RenderOverlays } from '#core/canvas/renderer'

import { createMockCanvas, createMockRenderer, mockCalls } from './effects/helpers'

const straight = { x: 0, y: 0 }
const basePenState: NonNullable<RenderOverlays['penState']> = {
  vertices: [{ x: 10, y: 20 }, { x: 40, y: 20 }, { x: 40, y: 50 }],
  segments: [
    { start: 0, end: 1, tangentStart: straight, tangentEnd: straight },
    { start: 1, end: 2, tangentStart: straight, tangentEnd: straight }
  ],
  dragTangent: null,
  oppositeDragTangent: null,
  closingToFirst: true
}

function createPaintStubs() {
  return {
    penLiveStrokePaint: { name: 'liveStroke' } as Paint,
    penPathPaint: { name: 'path' } as Paint,
    penHandlePaint: { name: 'handle' } as Paint,
    penVertexFill: { name: 'vertexFill' } as Paint,
    penVertexStroke: { name: 'vertexStroke' } as Paint
  }
}

describe('drawPenOverlay close icon', () => {
  test('draws a boosted first anchor plus a close ring when closingToFirst is true', () => {
    const paints = createPaintStubs()
    const r = createMockRenderer({
      zoom: 2,
      panX: 5,
      panY: -3,
      penLiveStrokePaint: paints.penLiveStrokePaint,
      penPathPaint: paints.penPathPaint,
      penHandlePaint: paints.penHandlePaint,
      penVertexFill: paints.penVertexFill,
      penVertexStroke: paints.penVertexStroke
    })
    const canvas = createMockCanvas()

    drawPenOverlay(r, canvas as Canvas, structuredClone(basePenState))

    const circleCalls = mockCalls(canvas.drawCircle)
    expect(circleCalls).toHaveLength(7)

    const boostedRadius = PEN_VERTEX_RADIUS + PEN_CLOSE_RADIUS_BOOST
    expect(circleCalls[0]).toEqual([25, 37, boostedRadius, paints.penVertexFill])
    expect(circleCalls[1]).toEqual([25, 37, boostedRadius, paints.penVertexStroke])

    expect(circleCalls[2]).toEqual([
      25 + PEN_CLOSE_ICON_OFFSET,
      37 - PEN_CLOSE_ICON_OFFSET,
      PEN_HANDLE_RADIUS,
      paints.penVertexStroke
    ])

    expect(circleCalls[3]).toEqual([40 * 2 + 5, 20 * 2 - 3, PEN_VERTEX_RADIUS, paints.penVertexFill])
    expect(circleCalls[4]).toEqual([40 * 2 + 5, 20 * 2 - 3, PEN_VERTEX_RADIUS, paints.penVertexStroke])
    expect(circleCalls[5]).toEqual([40 * 2 + 5, 50 * 2 - 3, PEN_VERTEX_RADIUS, paints.penVertexFill])
    expect(circleCalls[6]).toEqual([40 * 2 + 5, 50 * 2 - 3, PEN_VERTEX_RADIUS, paints.penVertexStroke])
  })

  test('keeps constant screen offset and radius when renderer zoom and pan change', () => {
    const paints = createPaintStubs()
    const r = createMockRenderer({
      zoom: 0.5,
      panX: 100,
      panY: 50,
      penLiveStrokePaint: paints.penLiveStrokePaint,
      penPathPaint: paints.penPathPaint,
      penHandlePaint: paints.penHandlePaint,
      penVertexFill: paints.penVertexFill,
      penVertexStroke: paints.penVertexStroke
    })
    const canvas = createMockCanvas()

    drawPenOverlay(r, canvas as Canvas, structuredClone(basePenState))

    const circleCalls = mockCalls(canvas.drawCircle)
    const firstAnchorX = 10 * 0.5 + 100
    const firstAnchorY = 20 * 0.5 + 50
    const boostedRadius = PEN_VERTEX_RADIUS + PEN_CLOSE_RADIUS_BOOST

    expect(circleCalls[0]).toEqual([firstAnchorX, firstAnchorY, boostedRadius, paints.penVertexFill])
    expect(circleCalls[1]).toEqual([firstAnchorX, firstAnchorY, boostedRadius, paints.penVertexStroke])
    expect(circleCalls[2]).toEqual([
      firstAnchorX + PEN_CLOSE_ICON_OFFSET,
      firstAnchorY - PEN_CLOSE_ICON_OFFSET,
      PEN_HANDLE_RADIUS,
      paints.penVertexStroke
    ])
  })

  test('draws no close ring when closingToFirst is false', () => {
    const paints = createPaintStubs()
    const r = createMockRenderer({
      zoom: 2,
      panX: 5,
      panY: -3,
      penLiveStrokePaint: paints.penLiveStrokePaint,
      penPathPaint: paints.penPathPaint,
      penHandlePaint: paints.penHandlePaint,
      penVertexFill: paints.penVertexFill,
      penVertexStroke: paints.penVertexStroke
    })
    const canvas = createMockCanvas()

    const penState = structuredClone(basePenState)
    penState.closingToFirst = false

    drawPenOverlay(r, canvas as Canvas, penState)

    const circleCalls = mockCalls(canvas.drawCircle)
    expect(circleCalls).toHaveLength(6)
    for (const call of circleCalls) {
      expect(call[2]).toBe(PEN_VERTEX_RADIUS)
    }
  })
})
