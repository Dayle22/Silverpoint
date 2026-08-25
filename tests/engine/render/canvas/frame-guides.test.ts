import { describe, expect, mock, test } from 'bun:test'

import type { Canvas } from 'canvaskit-wasm'

import { SceneGraph } from '@open-pencil/scene-graph'

import { drawFrameGuides } from '#core/canvas/frame-guides'
import { DEFAULT_FRAME_GUIDES, upsertFrameGuides } from '#core/guides/frame'

import { createMockCanvas, createMockRenderer, mockCalls } from './effects/helpers'

function graphWithFrame(settings = DEFAULT_FRAME_GUIDES): SceneGraph {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  graph.createNode('FRAME', page.id, {
    x: 50,
    y: 60,
    width: 200,
    height: 100,
    rotation: 0,
    pluginData: upsertFrameGuides([], settings)
  })
  return graph
}

describe('frame guide rendering', () => {
  test('draws enabled margins and bleed as one-screen-pixel transformed outlines', () => {
    const settings = structuredClone(DEFAULT_FRAME_GUIDES)
    settings.margins = {
      enabled: true,
      linked: false,
      top: 10,
      right: 20,
      bottom: 30,
      left: 40
    }
    settings.bleed = {
      enabled: true,
      linked: false,
      top: 6,
      right: 7,
      bottom: 8,
      left: 5
    }
    const graph = graphWithFrame(settings)
    const r = createMockRenderer({
      pageId: graph.getPages()[0].id,
      panX: 10,
      panY: 20,
      zoom: 2
    })
    const canvas = { ...createMockCanvas(), concat: mock(() => undefined) }

    drawFrameGuides(r, canvas as Canvas, graph)

    expect(mockCalls(r.ck.LTRBRect)).toEqual([
      [40, 10, 180, 70],
      [-5, -6, 207, 108]
    ])
    expect(mockCalls(r.auxStroke.setStrokeWidth)).toEqual([[0.5]])
    expect(canvas.drawRect).toHaveBeenCalledTimes(2)
    expect(canvas.concat).toHaveBeenCalledTimes(1)
  })

  test('skips disabled, malformed, rotated, and off-page frame guides', () => {
    const r = createMockRenderer({ pageId: 'other' })
    const canvas = { ...createMockCanvas(), concat: mock(() => undefined) }

    drawFrameGuides(r, canvas as Canvas, graphWithFrame())

    expect(canvas.drawRect).not.toHaveBeenCalled()
  })
})
