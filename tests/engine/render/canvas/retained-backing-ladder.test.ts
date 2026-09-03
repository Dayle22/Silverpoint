import { describe, expect, it, spyOn } from 'bun:test'
import type { Canvas, Image as CKImage, Surface } from 'canvaskit-wasm'

import type { SceneGraph } from '@open-pencil/scene-graph'
import type { SkiaRenderer } from '#core/canvas/renderer'

import {
  getSceneBackingBuildProgress,
  MAX_SCENE_BACKING_BUILD_FRAMES,
  renderSceneBacking
} from '#core/canvas/renderer/retained-backing'

const noop = () => undefined

function asType<T>(value: unknown): T {
  return value as T
}

function createMockCanvas(): Canvas {
  return asType<Canvas>({
    clear: noop,
    save: noop,
    restore: noop,
    scale: noop,
    translate: noop,
    drawImageRectOptions: noop,
    drawPicture: noop
  })
}

function createMockImage(): CKImage {
  let deleted = false
  return asType<CKImage>({
    delete: () => {
      deleted = true
    },
    get isDeleted() {
      return deleted
    }
  })
}

function createMockSurface(): { surface: Surface; getDeleted: () => boolean } {
  let deleted = false
  const mockCanvas = createMockCanvas()
  const surface = asType<Surface>({
    getCanvas: () => mockCanvas,
    flush: noop,
    makeImageSnapshot: () => createMockImage(),
    delete: () => {
      deleted = true
    }
  })
  return {
    surface,
    getDeleted: () => deleted
  }
}

function createMockRenderer(options: {
  childIds?: string[]
  pageId?: string
  makeSurfaceFails?: boolean
  onStepNode?: () => void
} = {}): {
  renderer: SkiaRenderer
  canvas: Canvas
  graph: SceneGraph
  createdSurfaces: Array<{ surface: Surface; getDeleted: () => boolean }>
} {
  const childIds = options.childIds ?? ['child-1', 'child-2', 'child-3']
  const pageId = options.pageId ?? 'page-1'
  const canvas = createMockCanvas()
  const createdSurfaces: Array<{ surface: Surface; getDeleted: () => boolean }> = []

  const graph = asType<SceneGraph>({
    rootId: 'root',
    positionPreviewVersion: 1,
    getNode: (id: string) => {
      if (id === pageId || id === 'root') {
        return { id, childIds: [...childIds], visible: true }
      }
      return {
        id,
        childIds: [],
        visible: true,
        width: 100,
        height: 100,
        strokes: [],
        effects: []
      }
    },
    getAbsolutePosition: () => ({ x: 0, y: 0 })
  })

  class MockPictureRecorder {
    beginRecording() {
      return canvas
    }
    finishRecordingAsPicture() {
      return { delete: noop }
    }
    delete() {
      return undefined
    }
  }

  const renderer = asType<SkiaRenderer>({
    pageId,
    fontGeneration: 1,
    zoom: 1,
    panX: 0,
    panY: 0,
    viewportWidth: 800,
    viewportHeight: 600,
    dpr: 1,
    pageColor: { r: 1, g: 1, b: 1 },
    sceneBackingAllocationFailed: false,
    sceneBackingPreviewUntil: 0,
    sceneBackingAverageRecordMs: 16,
    sceneBackingAverageViewportIntervalMs: 16,
    sceneBackingLastViewportEventAt: 0,
    sceneBackingNeedsCrispRender: false,
    lastSceneViewport: null,
    sceneBacking: null,
    sceneBackingBuild: null,
    scenePictureVersion: 0,
    scenePicturePositionPreviewVersion: 0,
    scenePicturePageId: null,
    dirtySubtreeNodeIds: new Set<string>(),
    subtreePictureCache: new Map(),
    subtreePictureCachePageId: null,
    subtreePictureCacheSceneVersion: 0,
    subtreePictureCachePositionPreviewVersion: 0,
    subtreePictureCacheFontGeneration: 0,
    worldViewport: { x: 0, y: 0, w: 800, h: 600 },
    opacityPaint: {
      setAlphaf: noop
    },
    ck: {
      ColorType: { RGBA_8888: 0 },
      AlphaType: { Premul: 0 },
      ColorSpace: { SRGB: 0 },
      Color4f: (r: number, g: number, b: number, a: number) => [r, g, b, a],
      LTRBRect: (l: number, t: number, r: number, b: number) => [l, t, r, b],
      FilterMode: { Linear: 0 },
      MipmapMode: { None: 0 },
      PictureRecorder: MockPictureRecorder
    },
    surface: {
      makeSurface: () => {
        if (options.makeSurfaceFails) {
          throw new Error('CanvasKit allocation failed')
        }
        const mockSurf = createMockSurface()
        if (options.onStepNode) {
          const originalGetCanvas = mockSurf.surface.getCanvas
          mockSurf.surface.getCanvas = () => {
            const c = originalGetCanvas()
            c.drawPicture = () => {
              options.onStepNode?.()
            }
            return c
          }
        }
        createdSurfaces.push(mockSurf)
        return mockSurf.surface
      }
    },
    renderNode: () => {
      options.onStepNode?.()
    }
  })

  return { renderer, canvas, graph, createdSurfaces }
}

describe('F-018h Scene Backing Incremental Build & Fallback Removal', () => {
  it('defines MAX_SCENE_BACKING_BUILD_FRAMES as 600 (~10s at 60Hz)', () => {
    expect(MAX_SCENE_BACKING_BUILD_FRAMES).toBe(600)
  })

  describe('getSceneBackingBuildProgress', () => {
    it('returns inactive state with zero counts when no build is active', () => {
      const { renderer } = createMockRenderer()
      const progress = getSceneBackingBuildProgress(renderer)

      expect(progress).toEqual({
        active: false,
        nodesProcessed: 0,
        nodesTotal: 0,
        startedAt: 0,
        elapsedMs: 0,
        framesSpent: 0
      })
    })

    it('reports accurate progress while an incremental build is in progress', () => {
      let currentTime = 1000
      const nowSpy = spyOn(performance, 'now').mockImplementation(() => currentTime)

      // Advance time by 7ms on each node so it yields after 1 node
      const childIds = Array.from({ length: 20 }, (_, i) => `node-${i}`)
      const { renderer, canvas, graph } = createMockRenderer({
        childIds,
        onStepNode: () => {
          currentTime += 7
        }
      })

      // First frame starts the incremental build and processes 1 node
      renderSceneBacking(renderer, canvas, graph, 1)

      const progress1 = getSceneBackingBuildProgress(renderer)
      expect(progress1.active).toBe(true)
      expect(progress1.nodesTotal).toBe(20)
      expect(progress1.nodesProcessed).toBe(1)
      expect(progress1.framesSpent).toBe(1)
      expect(progress1.startedAt).toBe(1000)
      expect(progress1.elapsedMs).toBeGreaterThanOrEqual(7)

      // Second frame processes another node
      renderSceneBacking(renderer, canvas, graph, 1)
      const progress2 = getSceneBackingBuildProgress(renderer)
      expect(progress2.active).toBe(true)
      expect(progress2.framesSpent).toBe(2)
      expect(progress2.nodesProcessed).toBe(2)

      nowSpy.mockRestore()
    })

    it('returns inactive again once build completes', () => {
      const { renderer, canvas, graph } = createMockRenderer({ childIds: ['node-1'] })

      // With 1 child and normal time, build completes within the 6ms budget
      renderSceneBacking(renderer, canvas, graph, 1)

      const progress = getSceneBackingBuildProgress(renderer)
      expect(progress.active).toBe(false)
      expect(progress.nodesProcessed).toBe(0)
      expect(progress.nodesTotal).toBe(0)
      expect(renderer.sceneBacking).not.toBeNull()
    })
  })

  describe('Draw ladder and fallback behavior', () => {
    it('falls back to direct draw (returns false) on cold start when no backing exists', () => {
      let currentTime = 1000
      const nowSpy = spyOn(performance, 'now').mockImplementation(() => currentTime)

      const childIds = Array.from({ length: 20 }, (_, i) => `node-${i}`)
      const { renderer, canvas, graph } = createMockRenderer({
        childIds,
        onStepNode: () => {
          currentTime += 7
        }
      })

      // On cold start, renderer.sceneBacking is null.
      // Priority 1 (previous backing) is not available.
      // Priority 2 (direct scene draw) is chosen -> returns false to let pipeline render directly.
      const rendered = renderSceneBacking(renderer, canvas, graph, 1)

      expect(rendered).toBe(false)
      expect(renderer.sceneBackingBuild).not.toBeNull()

      nowSpy.mockRestore()
    })

    it('draws previous backing image (returns true) while rebuild is in progress', () => {
      let currentTime = 1000
      const nowSpy = spyOn(performance, 'now').mockImplementation(() => currentTime)

      const childIds = Array.from({ length: 20 }, (_, i) => `node-${i}`)
      const { renderer, canvas, graph } = createMockRenderer({
        childIds,
        onStepNode: () => {
          currentTime += 7
        }
      })

      // Seed an existing backing covering the viewport
      const mockImage = createMockImage()
      let drawImageCalled = false
      canvas.drawImageRectOptions = () => {
        drawImageCalled = true
      }

      renderer.sceneBacking = {
        image: mockImage,
        pageId: 'page-1',
        sceneVersion: 1,
        positionPreviewVersion: 1,
        fontGeneration: 1,
        panX: 0,
        panY: 0,
        width: 1200,
        height: 900,
        worldX: 0,
        worldY: 0,
        worldWidth: 1200,
        worldHeight: 900,
        zoom: 1,
        dpr: 1
      }

      // Bump sceneVersion to 2 (e.g. user edited a node).
      // Incremental build starts for version 2.
      // Priority 1 ladder: previous backing image exists and covers viewport -> draws it and returns true.
      const rendered = renderSceneBacking(renderer, canvas, graph, 2)

      expect(rendered).toBe(true)
      expect(drawImageCalled).toBe(true)
      expect(renderer.sceneBackingBuild).not.toBeNull()
      expect(renderer.sceneBackingBuild?.sceneVersion).toBe(2)

      nowSpy.mockRestore()
    })

    it('falls back to direct draw (returns false) when previous backing is from a different page', () => {
      let currentTime = 1000
      const nowSpy = spyOn(performance, 'now').mockImplementation(() => currentTime)

      const childIds = Array.from({ length: 20 }, (_, i) => `node-${i}`)
      const { renderer, canvas, graph } = createMockRenderer({
        childIds,
        pageId: 'page-2',
        onStepNode: () => {
          currentTime += 7
        }
      })

      // Seed existing backing for page-1
      renderer.sceneBacking = {
        image: createMockImage(),
        pageId: 'page-1',
        sceneVersion: 1,
        positionPreviewVersion: 1,
        fontGeneration: 1,
        panX: 0,
        panY: 0,
        width: 1200,
        height: 900,
        worldX: 0,
        worldY: 0,
        worldWidth: 1200,
        worldHeight: 900,
        zoom: 1,
        dpr: 1
      }

      // Renders page-2: old backing belongs to page-1 so it must not be drawn.
      // Direct draw (priority 2) is used -> returns false.
      const rendered = renderSceneBacking(renderer, canvas, graph, 1)

      expect(rendered).toBe(false)
      expect(renderer.sceneBackingBuild).not.toBeNull()
      expect(renderer.sceneBackingBuild?.pageId).toBe('page-2')

      nowSpy.mockRestore()
    })

    it('draws completed crisp backing (returns true) once build finishes', () => {
      const { renderer, canvas, graph } = createMockRenderer({ childIds: ['node-1'] })

      let drawImageCalled = false
      canvas.drawImageRectOptions = () => {
        drawImageCalled = true
      }

      const rendered = renderSceneBacking(renderer, canvas, graph, 1)

      expect(rendered).toBe(true)
      expect(drawImageCalled).toBe(true)
      expect(renderer.sceneBackingBuild).toBeNull()
      expect(renderer.sceneBacking?.sceneVersion).toBe(1)
    })
  })

  describe('Watchdog abandonment', () => {
    it('abandons a stuck build exceeding MAX_SCENE_BACKING_BUILD_FRAMES, disposes resources, and permanently uses direct draw for that scene', () => {
      let currentTime = 1000
      const nowSpy = spyOn(performance, 'now').mockImplementation(() => currentTime)

      // 1000 children, 1 node processed per frame because onStepNode advances by 7ms (> 6ms budget)
      const childIds = Array.from({ length: 1000 }, (_, i) => `node-${i}`)
      const { renderer, canvas, graph, createdSurfaces } = createMockRenderer({
        childIds,
        onStepNode: () => {
          currentTime += 7
        }
      })

      const warnSpy = spyOn(console, 'warn').mockImplementation(noop)

      // Frames 1 through 599: build stays in progress
      for (let frame = 1; frame < MAX_SCENE_BACKING_BUILD_FRAMES; frame++) {
        renderSceneBacking(renderer, canvas, graph, 1)
        expect(renderer.sceneBackingBuild).not.toBeNull()
      }

      expect(warnSpy).not.toHaveBeenCalled()
      expect(createdSurfaces[0].getDeleted()).toBe(false)

      // Frame 600: hits MAX_SCENE_BACKING_BUILD_FRAMES watchdog
      const renderedAt600 = renderSceneBacking(renderer, canvas, graph, 1)

      // Watchdog triggered:
      // 1. Logs warning
      expect(warnSpy).toHaveBeenCalled()
      // 2. Disposes partial build resources
      expect(createdSurfaces[0].getDeleted()).toBe(true)
      expect(renderer.sceneBackingBuild).toBeNull()
      // 3. Falls back to direct draw (Priority 2 -> returns false)
      expect(renderedAt600).toBe(false)

      // Subsequent frame for the same scene: stays permanently in direct draw, does not restart build
      const renderedNext = renderSceneBacking(renderer, canvas, graph, 1)
      expect(renderedNext).toBe(false)
      expect(renderer.sceneBackingBuild).toBeNull()

      // When sceneVersion increments (e.g. user edits), it can attempt to build the new scene
      const renderedNewScene = renderSceneBacking(renderer, canvas, graph, 2)
      expect(renderedNewScene).toBe(false)
      // New build is started for sceneVersion 2
      expect(renderer.sceneBackingBuild).not.toBeNull()
      expect(renderer.sceneBackingBuild?.sceneVersion).toBe(2)

      warnSpy.mockRestore()
      nowSpy.mockRestore()
    })
  })
})
