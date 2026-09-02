import { describe, expect, it } from 'bun:test'
import type { Canvas, SkPicture } from 'canvaskit-wasm'

import type { SceneGraph } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'

import {
  canUseScenePicture,
  computeRecordingViewport,
  getRecordedSceneViewport,
  isViewportContained,
  recordScenePicture,
  renderSceneToCanvas,
  scenePictureMissReason,
  setRecordedSceneViewport,
  SCENE_PICTURE_MIN_MARGIN,
  SCENE_PICTURE_VIEWPORT_MARGIN_FACTOR,
  UNBOUNDED_VIEWPORT,
  type WorldViewport
} from './pipeline'

const noop = (): void => {
  void 0
}

function castToRenderer(value: Partial<SkiaRenderer>): SkiaRenderer {
  return value as SkiaRenderer
}

function castToGraph(value: Partial<SceneGraph>): SceneGraph {
  return value as SceneGraph
}

function castToCanvas(value: Partial<Canvas>): Canvas {
  return value as Canvas
}

function castToPicture(value: Partial<SkPicture>): SkPicture {
  return value as SkPicture
}

function castTo<T>(value: unknown): T {
  return value as T
}

function createMockRenderer(initialViewport: WorldViewport = { x: 0, y: 0, w: 1920, h: 1080 }): SkiaRenderer {
  return castToRenderer({
    scenePicture: castToPicture({
      delete: noop
    }),
    scenePictureVersion: 1,
    scenePictureFontGeneration: 1,
    scenePicturePositionPreviewVersion: 1,
    scenePicturePageId: 'page-1',
    fontGeneration: 1,
    pageId: 'page-1',
    panX: 0,
    panY: 0,
    zoom: 1,
    viewportWidth: 1920,
    viewportHeight: 1080,
    worldViewport: initialViewport,
    renderNode: noop,
    ck: castTo<SkiaRenderer['ck']>({
      PictureRecorder: class {
        beginRecording(): Canvas {
          return castToCanvas({})
        }
        finishRecordingAsPicture(): SkPicture {
          return castToPicture({ delete: noop })
        }
        delete(): void {
          noop()
        }
      },
      LTRBRect: (l: number, t: number, r: number, b: number): [number, number, number, number] => [l, t, r, b]
    })
  })
}

function createMockGraph(overrides: Partial<SceneGraph> = {}): SceneGraph {
  return castToGraph({
    rootId: 'page-1',
    positionPreviewVersion: 1,
    getNode: (id: string) => {
      if (id === 'page-1') {
        return { childIds: ['node-1'] }
      }
      return null
    },
    getAbsolutePosition: () => ({ x: 100, y: 100 }),
    ...overrides
  })
}

describe('F-018g Viewport Culling & Picture Cache Containment', () => {
  it('defines the expected constants', () => {
    expect(SCENE_PICTURE_VIEWPORT_MARGIN_FACTOR).toBe(1.5)
    expect(SCENE_PICTURE_MIN_MARGIN).toBe(1024)
    expect(UNBOUNDED_VIEWPORT).toEqual({
      x: -1e9,
      y: -1e9,
      w: 2e9,
      h: 2e9
    })
  })

  it('computes recording viewport with margin factor and minimum margin', () => {
    // Large viewport where margin factor dominates
    const largeViewport: WorldViewport = { x: 100, y: 200, w: 10000, h: 8000 }
    const largeRecorded = computeRecordingViewport(largeViewport)
    // marginX = max(10000 * 0.5 / 2, 1024) = 2500
    // marginY = max(8000 * 0.5 / 2, 1024) = 2000
    expect(largeRecorded.x).toBe(100 - 2500)
    expect(largeRecorded.y).toBe(200 - 2000)
    expect(largeRecorded.w).toBe(10000 + 5000)
    expect(largeRecorded.h).toBe(8000 + 4000)

    // Small viewport where min margin dominates
    const smallViewport: WorldViewport = { x: 0, y: 0, w: 500, h: 400 }
    const smallRecorded = computeRecordingViewport(smallViewport)
    // marginX = max(500 * 0.25, 1024) = 1024
    // marginY = max(400 * 0.25, 1024) = 1024
    expect(smallRecorded.x).toBe(-1024)
    expect(smallRecorded.y).toBe(-1024)
    expect(smallRecorded.w).toBe(500 + 2048)
    expect(smallRecorded.h).toBe(400 + 2048)
  })

  it('correctly determines viewport containment', () => {
    const outer: WorldViewport = { x: -500, y: -500, w: 2000, h: 2000 }

    // Identical
    expect(isViewportContained(outer, outer)).toBe(true)

    // Well inside
    expect(isViewportContained({ x: 0, y: 0, w: 1000, h: 1000 }, outer)).toBe(true)

    // Escaped left
    expect(isViewportContained({ x: -600, y: 0, w: 1000, h: 1000 }, outer)).toBe(false)

    // Escaped right
    expect(isViewportContained({ x: 600, y: 0, w: 1000, h: 1000 }, outer)).toBe(false)

    // Escaped top
    expect(isViewportContained({ x: 0, y: -600, w: 1000, h: 1000 }, outer)).toBe(false)

    // Escaped bottom
    expect(isViewportContained({ x: 0, y: 600, w: 1000, h: 1000 }, outer)).toBe(false)

    // Zoomed out larger than outer
    expect(isViewportContained({ x: -500, y: -500, w: 2500, h: 2500 }, outer)).toBe(false)
  })

  it('allows cache hit when visible viewport is within recorded margin', () => {
    const initialViewport: WorldViewport = { x: 0, y: 0, w: 1920, h: 1080 }
    const r = createMockRenderer(initialViewport)
    const graph = createMockGraph()

    // Recorded viewport with 1024 margin
    const recorded = computeRecordingViewport(initialViewport)
    setRecordedSceneViewport(r, recorded)

    // Initial position should hit cache
    expect(canUseScenePicture(r, graph, 1, false)).toBe(true)
    expect(scenePictureMissReason(r, graph, {}, 1, false)).toBe('unknown')

    // Pan within margin (e.g. pan right by 200 units)
    r.worldViewport = { x: 200, y: 50, w: 1920, h: 1080 }
    expect(canUseScenePicture(r, graph, 1, false)).toBe(true)
    expect(scenePictureMissReason(r, graph, {}, 1, false)).toBe('unknown')
  })

  it('invalidates cache with viewport-escaped reason when panned outside recorded margin', () => {
    const initialViewport: WorldViewport = { x: 0, y: 0, w: 1920, h: 1080 }
    const r = createMockRenderer(initialViewport)
    const graph = createMockGraph()

    // marginX is max(1920 * 0.25, 1024) = 1024
    const recorded = computeRecordingViewport(initialViewport)
    setRecordedSceneViewport(r, recorded)

    // Pan outside right margin: x + w = 1500 + 1920 = 3420 > recorded.x + recorded.w (1920 + 1024 = 2944)
    r.worldViewport = { x: 1500, y: 0, w: 1920, h: 1080 }
    expect(canUseScenePicture(r, graph, 1, false)).toBe(false)
    expect(scenePictureMissReason(r, graph, {}, 1, false)).toBe('viewport-escaped')

    // Pan outside left margin: x = -1500 < recorded.x (-1024)
    r.worldViewport = { x: -1500, y: 0, w: 1920, h: 1080 }
    expect(canUseScenePicture(r, graph, 1, false)).toBe(false)
    expect(scenePictureMissReason(r, graph, {}, 1, false)).toBe('viewport-escaped')
  })

  it('reports correct miss reasons for other cache invalidations', () => {
    const initialViewport: WorldViewport = { x: 0, y: 0, w: 1920, h: 1080 }
    const r = createMockRenderer(initialViewport)
    const graph = createMockGraph()
    const recorded = computeRecordingViewport(initialViewport)
    setRecordedSceneViewport(r, recorded)

    // Missing picture
    const rNoPic = createMockRenderer(initialViewport)
    rNoPic.scenePicture = null
    expect(canUseScenePicture(rNoPic, graph, 1, false)).toBe(false)
    expect(scenePictureMissReason(rNoPic, graph, {}, 1, false)).toBe('missing-picture')

    // Scene version mismatch
    expect(canUseScenePicture(r, graph, 2, false)).toBe(false)
    expect(scenePictureMissReason(r, graph, {}, 2, false)).toBe('scene-version')

    // Font generation mismatch
    r.fontGeneration = 2
    expect(canUseScenePicture(r, graph, 1, false)).toBe(false)
    expect(scenePictureMissReason(r, graph, {}, 1, false)).toBe('font-generation')
    r.fontGeneration = 1

    // Page mismatch
    r.pageId = 'page-2'
    expect(canUseScenePicture(r, graph, 1, false)).toBe(false)
    expect(scenePictureMissReason(r, graph, {}, 1, false)).toBe('page')
    r.pageId = 'page-1'

    // Volatile overlay active
    expect(
      scenePictureMissReason(
        r,
        graph,
        { dropTargetId: 'target-1' },
        1,
        false
      )
    ).toBe('volatile-overlay')

    // Position preview
    expect(scenePictureMissReason(r, graph, {}, 1, true)).toBe('position-preview')
  })

  it('renderSceneToCanvas temporarily sets UNBOUNDED_VIEWPORT and restores prevViewport', () => {
    const initialViewport: WorldViewport = { x: 10, y: 20, w: 300, h: 400 }
    const r = createMockRenderer(initialViewport)
    const graph = createMockGraph()
    let viewportDuringRender: WorldViewport | null = null

    r.renderNode = () => {
      viewportDuringRender = r.worldViewport
    }

    const mockCanvas = castToCanvas({})
    renderSceneToCanvas(r, mockCanvas, graph, 'page-1')

    expect(viewportDuringRender).toEqual(UNBOUNDED_VIEWPORT)
    expect(r.worldViewport).toEqual(initialViewport)
  })

  it('recordScenePicture computes recording viewport from visible viewport and records it in the WeakMap', () => {
    const initialViewport: WorldViewport = { x: 100, y: 200, w: 1920, h: 1080 }
    const r = createMockRenderer(initialViewport)
    const graph = createMockGraph()
    let viewportDuringRecording: WorldViewport | null = null

    r.renderNode = () => {
      viewportDuringRecording = r.worldViewport
    }

    const mockCanvas = castToCanvas({
      drawPicture: noop
    })

    recordScenePicture(r, mockCanvas, graph, 1)

    // During recording, worldViewport should be the expanded recording viewport
    const expectedRecordingViewport = computeRecordingViewport(initialViewport)
    expect(viewportDuringRecording).toEqual(expectedRecordingViewport)

    // After recording, worldViewport is restored to initial visible viewport
    expect(r.worldViewport).toEqual(initialViewport)

    // And the recorded viewport is saved in the WeakMap
    expect(getRecordedSceneViewport(r)).toEqual(expectedRecordingViewport)
  })
})
