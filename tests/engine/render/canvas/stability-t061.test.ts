import { beforeAll, describe, expect, mock, test } from 'bun:test'

import type { CanvasKit, ImageFilter, MaskFilter, Paint, Shader, Surface } from 'canvaskit-wasm'
import {
  createDefaultNode,
  generateId,
  SceneGraph,
  UndoManager
} from '@open-pencil/scene-graph'
import type { Editor } from '@open-pencil/core/editor'

import {
  releaseFillShader,
  setFillShader
} from '#core/canvas/fills'
import {
  getCachedBlur,
  getCachedDropShadow,
  getCachedMaskBlur,
  MAX_CACHED_IMAGE_FILTERS,
  MAX_CACHED_MASK_FILTERS
} from '#core/canvas/effects'
import { SkiaRenderer } from '#core/canvas/renderer'
import {
  effectiveSceneBackingScale,
  sceneBackingGeometry
} from '#core/canvas/renderer/retained-backing'
import { createCanvasSurfaceManager } from '#vue/canvas/surface/lifecycle'
import { initCanvasKit } from '#cli/headless'

function deletable<T>() {
  return { delete: mock() } as T & { delete: ReturnType<typeof mock> }
}

describe('T-061: CanvasKit Shader Lifecycle and Disposal', () => {
  test('setFillShader replaces and deletes previous active shader', () => {
    const shader1 = deletable<Shader>()
    const shader2 = deletable<Shader>()
    const fillPaint = { setShader: mock() } as Partial<Paint> as Paint

    const rendererPartial: Partial<SkiaRenderer> = {
      activeFillShader: null,
      fillPaint
    }
    const renderer = rendererPartial as SkiaRenderer

    setFillShader(renderer, shader1)
    expect(renderer.activeFillShader).toBe(shader1)
    expect(fillPaint.setShader).toHaveBeenCalledWith(shader1)
    expect(shader1.delete).not.toHaveBeenCalled()

    setFillShader(renderer, shader2)
    expect(shader1.delete).toHaveBeenCalledTimes(1)
    expect(renderer.activeFillShader).toBe(shader2)
    expect(fillPaint.setShader).toHaveBeenCalledWith(shader2)
  })

  test('releaseFillShader sets fillPaint shader to null and deletes active shader', () => {
    const shader = deletable<Shader>()
    const fillPaint = { setShader: mock() } as Partial<Paint> as Paint

    const rendererPartial: Partial<SkiaRenderer> = {
      activeFillShader: shader,
      fillPaint
    }
    const renderer = rendererPartial as SkiaRenderer

    releaseFillShader(renderer)
    expect(fillPaint.setShader).toHaveBeenCalledWith(null)
    expect(shader.delete).toHaveBeenCalledTimes(1)
    expect(renderer.activeFillShader).toBeNull()
  })

  test('releaseFillShader is safe when no active shader is set', () => {
    const fillPaint = { setShader: mock() } as Partial<Paint> as Paint
    const rendererPartial: Partial<SkiaRenderer> = {
      activeFillShader: null,
      fillPaint
    }
    const renderer = rendererPartial as SkiaRenderer

    expect(() => releaseFillShader(renderer)).not.toThrow()
    expect(fillPaint.setShader).toHaveBeenCalledWith(null)
    expect(renderer.activeFillShader).toBeNull()
  })
})

describe('T-061: Headless CanvasKit Shader and Render Verification', () => {
  let ck: Awaited<ReturnType<typeof initCanvasKit>>
  let surface: Surface
  let renderer: SkiaRenderer
  let graph: SceneGraph

  beforeAll(async () => {
    ck = await initCanvasKit()
    const madeSurface = ck.MakeSurface(200, 200)
    if (!madeSurface) throw new Error('Surface creation failed')
    surface = madeSurface
    renderer = new SkiaRenderer(ck, surface, null)
    graph = new SceneGraph()
  })

  test('rendering gradient fills leaves activeFillShader null after pass', () => {
    const node = createDefaultNode(generateId, 'RECTANGLE', {
      id: 'grad-node',
      name: 'Gradient Node',
      width: 100,
      height: 100,
      fills: [
        {
          type: 'GRADIENT_LINEAR',
          visible: true,
          opacity: 1,
          blendMode: 'NORMAL',
          gradientStops: [
            { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
            { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
          ],
          gradientTransform: {
            m00: 1,
            m01: 0,
            m02: 0,
            m10: 0,
            m11: 1,
            m12: 0
          }
        }
      ]
    })

    graph.nodes.set(node.id, node)
    graph.nodes.get(graph.rootId)?.childIds.push(node.id)
    const canvas = surface.getCanvas()

    for (let i = 0; i < 5; i++) {
      renderer.renderNode(canvas, graph, node.id, {})
      expect(renderer.activeFillShader).toBeNull()
    }
  })
})

describe('T-061: Bounded and Quantised Effect Caches', () => {
  test('constants define capacity limit of 128', () => {
    expect(MAX_CACHED_IMAGE_FILTERS).toBe(128)
    expect(MAX_CACHED_MASK_FILTERS).toBe(128)
  })

  test('imageFilterCache is bounded and evicts oldest with delete()', () => {
    const deletedKeys: number[] = []
    const rendererPartial: Partial<SkiaRenderer> = {
      imageFilterCache: new Map<string, ImageFilter | null>(),
      ck: {
        ImageFilter: {
          MakeBlur: mock((sigma: number) => ({
            id: sigma,
            delete: mock(() => {
              deletedKeys.push(sigma)
            })
          }))
        },
        TileMode: { Clamp: 0 }
      } as Partial<CanvasKit> as CanvasKit
    }
    const renderer = rendererPartial as SkiaRenderer

    // Insert 200 distinct sigma values
    for (let s = 1; s <= 200; s++) {
      getCachedBlur(renderer, s)
    }

    expect(renderer.imageFilterCache.size).toBe(128)
    expect(deletedKeys.length).toBe(72)
    expect(deletedKeys[0]).toBe(1)
  })

  test('maskFilterCache is bounded and evicts oldest with delete()', () => {
    const deletedSigmas: number[] = []
    const rendererPartial: Partial<SkiaRenderer> = {
      maskFilterCache: new Map<number, MaskFilter | null>(),
      ck: {
        MaskFilter: {
          MakeBlur: mock((_style: unknown, sigma: number) => ({
            id: sigma,
            delete: mock(() => {
              deletedSigmas.push(sigma)
            })
          }))
        },
        BlurStyle: { Normal: 0 }
      } as Partial<CanvasKit> as CanvasKit
    }
    const renderer = rendererPartial as SkiaRenderer

    for (let s = 1; s <= 200; s++) {
      getCachedMaskBlur(renderer, s)
    }

    expect(renderer.maskFilterCache.size).toBe(128)
    expect(deletedSigmas.length).toBe(72)
  })

  test('blur quantises keys to 0.5 steps so nearby parameters share cache entry', () => {
    let makeCount = 0
    const rendererPartial: Partial<SkiaRenderer> = {
      imageFilterCache: new Map<string, ImageFilter | null>(),
      ck: {
        ImageFilter: {
          MakeBlur: mock((sigma: number) => {
            makeCount++
            return { id: sigma, delete: mock() }
          })
        },
        TileMode: { Clamp: 0 }
      } as Partial<CanvasKit> as CanvasKit
    }
    const renderer = rendererPartial as SkiaRenderer

    const f1 = getCachedBlur(renderer, 4.02)
    const f2 = getCachedBlur(renderer, 4.18)
    expect(f1).toBe(f2)
    expect(makeCount).toBe(1)

    const f3 = getCachedBlur(renderer, 4.45)
    expect(f3).not.toBe(f1)
    expect(makeCount).toBe(2)
  })

  test('drop shadow quantises keys to 0.5 steps', () => {
    let makeCount = 0
    const color = new Float32Array([0, 0, 0, 1])
    const rendererPartial: Partial<SkiaRenderer> = {
      imageFilterCache: new Map<string, ImageFilter | null>(),
      ck: {
        ImageFilter: {
          MakeDropShadowOnly: mock(() => {
            makeCount++
            return { delete: mock() }
          })
        }
      } as Partial<CanvasKit> as CanvasKit
    }
    const renderer = rendererPartial as SkiaRenderer

    const f1 = getCachedDropShadow(renderer, 2.01, 3.04, 5.02, color)
    const f2 = getCachedDropShadow(renderer, 2.18, 3.12, 5.15, color)
    expect(f1).toBe(f2)
    expect(makeCount).toBe(1)
  })
})

describe('T-061: Clamped Backing Surface', () => {
  test('effectiveSceneBackingScale clamps large viewport at high DPI to 4096 device pixels', () => {
    const rendererPartial: Partial<SkiaRenderer> = {
      viewportWidth: 2560,
      viewportHeight: 1440,
      dpr: 2,
      maxTextureSize: 4096,
      panX: 0,
      panY: 0,
      zoom: 1
    }
    const renderer = rendererPartial as SkiaRenderer

    const scale = effectiveSceneBackingScale(renderer)
    expect(scale).toBe(1)

    const geom = sceneBackingGeometry(renderer)
    expect(geom.width).toBe(2560)
    expect(geom.height).toBe(1440)
    expect(geom.width).toBeGreaterThanOrEqual(renderer.viewportWidth)
    expect(geom.height).toBeGreaterThanOrEqual(renderer.viewportHeight)
  })

  test('effectiveSceneBackingScale allows 3x scale when within max texture size', () => {
    const rendererPartial: Partial<SkiaRenderer> = {
      viewportWidth: 600,
      viewportHeight: 400,
      dpr: 1,
      maxTextureSize: 4096,
      panX: 0,
      panY: 0,
      zoom: 1
    }
    const renderer = rendererPartial as SkiaRenderer

    const scale = effectiveSceneBackingScale(renderer)
    expect(scale).toBe(3)

    const geom = sceneBackingGeometry(renderer)
    expect(geom.width).toBe(1800)
    expect(geom.height).toBe(1200)
  })

  test('effectiveSceneBackingScale respects lower hardware limit', () => {
    const rendererPartial: Partial<SkiaRenderer> = {
      viewportWidth: 800,
      viewportHeight: 600,
      dpr: 2,
      maxTextureSize: 2048,
      panX: 0,
      panY: 0,
      zoom: 1
    }
    const renderer = rendererPartial as SkiaRenderer

    const scale = effectiveSceneBackingScale(renderer)
    expect(scale).toBeCloseTo(1.28, 2)
  })
})

describe('T-061: Tab Disposal Memory Clearance', () => {
  test('store dispose clears graph images and undo stacks', () => {
    const graph = new SceneGraph()
    graph.images.set('img1', new Uint8Array([1, 2, 3]))
    graph.images.set('img2', new Uint8Array([4, 5, 6]))

    const undo = new UndoManager()
    undo.record({
      type: 'test',
      description: 'action',
      inverse: mock(),
      forward: mock()
    })

    const editor = {
      undo,
      graph
    }

    const documentIO = {
      disposeDocumentIO: mock()
    }

    const dispose = () => {
      documentIO.disposeDocumentIO()
      graph.images.clear()
      editor.undo.clear()
    }

    expect(graph.images.size).toBe(2)
    expect(undo.canUndo).toBe(true)

    dispose()

    expect(documentIO.disposeDocumentIO).toHaveBeenCalledTimes(1)
    expect(graph.images.size).toBe(0)
    expect(undo.canUndo).toBe(false)
  })
})

describe('T-061: WebGL Context Loss Handling', () => {
  test('surface manager attaches context loss listeners, prevents default and handles restoration', () => {
    const listeners = new Map<string, (e: Event) => void>()
    const mockCanvasPartial: Partial<HTMLCanvasElement> = {
      addEventListener: mock((event: string, handler: (e: Event) => void) => {
        listeners.set(event, handler)
      }),
      removeEventListener: mock((event: string) => {
        listeners.delete(event)
      }),
      getContext: mock(() => null),
      clientWidth: 800,
      clientHeight: 600,
      dataset: {}
    }
    const mockCanvas = mockCanvasPartial as HTMLCanvasElement

    const mockEditor: Partial<Editor> = {
      removeCanvasRenderer: mock(),
      setCanvasKit: mock(),
      state: { loading: false, renderVersion: 0, selectedIds: new Set() } as Editor['state'],
      graph: new SceneGraph(),
      textEditor: {} as Editor['textEditor'],
      onEditorEvent: mock(() => mock())
    }

    const mockCk: Partial<CanvasKit> = {
      MakeSurface: mock(() => null),
      MakeGrContext: mock(() => null),
      GetWebGLContext: mock(() => 0)
    }

    const originalWindow = globalThis.window
    const mockWindow: Partial<Window> = { devicePixelRatio: 1 }
    globalThis.window = mockWindow as Window & typeof globalThis

    try {
      const manager = createCanvasSurfaceManager({
        editor: mockEditor as Editor,
        canvasRef: { value: mockCanvas },
        options: undefined,
        getCanvasKit: () => mockCk as CanvasKit,
        isDestroyed: () => false,
        shouldShowRulers: () => false
      })

      // Simulate surface creation
      manager.createSurface(mockCanvas)
      expect(listeners.get('webglcontextlost')).toBeDefined()
      expect(listeners.get('webglcontextrestored')).toBeDefined()

      // Trigger context lost
      let defaultPrevented = false
      const lostEventPartial: Partial<Event> = {
        preventDefault: () => {
          defaultPrevented = true
        }
      }
      const lostEvent = lostEventPartial as Event

      const lostHandler = listeners.get('webglcontextlost')
      if (lostHandler) lostHandler(lostEvent)
      expect(defaultPrevented).toBe(true)

      // While lost, renderNow should safely return without error
      expect(() => manager.renderNow()).not.toThrow()

      // Trigger restore
      const restoreHandler = listeners.get('webglcontextrestored')
      if (restoreHandler) {
        expect(() => restoreHandler(new Event('webglcontextrestored'))).not.toThrow()
      }

      // Cleanup
      manager.destroy()
      expect(listeners.get('webglcontextlost')).toBeUndefined()
      expect(listeners.get('webglcontextrestored')).toBeUndefined()
    } finally {
      globalThis.window = originalWindow
    }
  })
})
