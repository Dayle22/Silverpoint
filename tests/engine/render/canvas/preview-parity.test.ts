import { beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test'

import { SceneGraph, SkiaRenderer } from '@open-pencil/core'
import type { Effect } from '@open-pencil/scene-graph'

import { initCanvasKit } from '#cli/headless'

import { expectDefined } from '#tests/helpers/assert'
import { HEAVY_TEST_TIMEOUT_MS } from '#tests/helpers/test-utils'

setDefaultTimeout(HEAVY_TEST_TIMEOUT_MS)

let ck: Awaited<ReturnType<typeof initCanvasKit>>

beforeAll(async () => {
  ck = await initCanvasKit()
})

const WIDTH = 600
const HEIGHT = 500

function createRenderer(width = WIDTH, height = HEIGHT) {
  const surface = expectDefined(ck.MakeSurface(width, height), 'surface')
  const renderer = new SkiaRenderer(ck, surface)
  renderer.viewportWidth = width
  renderer.viewportHeight = height
  renderer.dpr = 1
  renderer.panX = 0
  renderer.panY = 0
  renderer.zoom = 1
  return { surface, renderer }
}

function readPixels(renderer: SkiaRenderer, width = WIDTH, height = HEIGHT): Uint8Array {
  const image = renderer.surface.makeImageSnapshot()
  const pixels = image.readPixels(0, 0, {
    width,
    height,
    colorType: ck.ColorType.RGBA_8888,
    alphaType: ck.AlphaType.Unpremul,
    colorSpace: ck.ColorSpace.SRGB
  })
  image.delete()
  return expectDefined(pixels, 'read pixels')
}

function countDifferingPixels(a: Uint8Array, b: Uint8Array, tolerance = 8): number {
  if (a.length !== b.length) throw new Error(`Buffer size mismatch: ${a.length} vs ${b.length}`)
  let diffCount = 0
  for (let i = 0; i < a.length; i += 4) {
    const dr = Math.abs(a[i] - b[i])
    const dg = Math.abs(a[i + 1] - b[i + 1])
    const db = Math.abs(a[i + 2] - b[i + 2])
    const da = Math.abs(a[i + 3] - b[i + 3])
    if (dr > tolerance || dg > tolerance || db > tolerance || da > tolerance) {
      diffCount++
    }
  }
  return diffCount
}

function maxChannelDelta(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) throw new Error(`Buffer size mismatch: ${a.length} vs ${b.length}`)
  let maxDelta = 0
  for (let i = 0; i < a.length; i++) {
    const delta = Math.abs(a[i] - b[i])
    if (delta > maxDelta) maxDelta = delta
  }
  return maxDelta
}

describe('preview-parity (T-028)', () => {
  test('DROP_SHADOW: preview frame matches committed frame pixel-for-pixel', async () => {
    const { surface, renderer } = createRenderer()
    await renderer.loadFonts()

    try {
      const graph = new SceneGraph()
      const page = graph.getPages()[0]
      renderer.pageId = page.id

      const rect = graph.createNode('RECTANGLE', page.id, {
        x: 100,
        y: 100,
        width: 140,
        height: 100,
        fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.9, a: 1 }, opacity: 1, visible: true }],
        effects: [
          {
            type: 'DROP_SHADOW',
            color: { r: 0, g: 0, b: 0, a: 0.6 },
            offset: { x: 12, y: 12 },
            radius: 16,
            spread: 4,
            visible: true
          }
        ]
      })

      // Frame 1: baseline at version 1
      renderer.render(graph, new Set(), {}, 1)
      expect(renderer.profiler.stats.scenePictureMode).toBe('record')

      // Frame 2: drag preview (transient position move at unchanged sceneVersion 1)
      graph.updateNodePositionPreview(rect.id, 180, 160)
      renderer.render(graph, new Set(), {}, 1)
      expect(renderer.positionPreviewActive).toBe(true)
      expect(renderer.profiler.stats.scenePictureMode).toBe('volatile')
      const previewPixels = readPixels(renderer)

      // Frame 3: committed move at bumped sceneVersion 2
      graph.updateNode(rect.id, { x: 180, y: 160 })
      renderer.render(graph, new Set(), {}, 2)
      expect(renderer.positionPreviewActive).toBe(false)
      const committedPixels = readPixels(renderer)

      expect(countDifferingPixels(previewPixels, committedPixels, 8)).toBe(0)
      expect(maxChannelDelta(previewPixels, committedPixels)).toBeLessThanOrEqual(8)
    } finally {
      surface.delete()
    }
  })

  test('INNER_SHADOW: preview frame matches committed frame pixel-for-pixel', async () => {
    const { surface, renderer } = createRenderer()
    await renderer.loadFonts()

    try {
      const graph = new SceneGraph()
      const page = graph.getPages()[0]
      renderer.pageId = page.id

      const rect = graph.createNode('RECTANGLE', page.id, {
        x: 80,
        y: 80,
        width: 160,
        height: 120,
        fills: [{ type: 'SOLID', color: { r: 0.9, g: 0.6, b: 0.2, a: 1 }, opacity: 1, visible: true }],
        effects: [
          {
            type: 'INNER_SHADOW',
            color: { r: 0, g: 0, b: 0, a: 0.8 },
            offset: { x: 8, y: 8 },
            radius: 12,
            spread: 2,
            visible: true
          }
        ]
      })

      // Frame 1: baseline
      renderer.render(graph, new Set(), {}, 1)

      // Frame 2: preview
      graph.updateNodePositionPreview(rect.id, 150, 140)
      renderer.render(graph, new Set(), {}, 1)
      expect(renderer.positionPreviewActive).toBe(true)
      const previewPixels = readPixels(renderer)

      // Frame 3: commit
      graph.updateNode(rect.id, { x: 150, y: 140 })
      renderer.render(graph, new Set(), {}, 2)
      expect(renderer.positionPreviewActive).toBe(false)
      const committedPixels = readPixels(renderer)

      expect(countDifferingPixels(previewPixels, committedPixels, 8)).toBe(0)
      expect(maxChannelDelta(previewPixels, committedPixels)).toBeLessThanOrEqual(8)
    } finally {
      surface.delete()
    }
  })

  test('LAYER_BLUR: preview frame matches committed frame pixel-for-pixel', async () => {
    const { surface, renderer } = createRenderer()
    await renderer.loadFonts()

    try {
      const graph = new SceneGraph()
      const page = graph.getPages()[0]
      renderer.pageId = page.id

      const rect = graph.createNode('RECTANGLE', page.id, {
        x: 120,
        y: 100,
        width: 120,
        height: 120,
        fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.8, b: 0.4, a: 1 }, opacity: 1, visible: true }],
        effects: [
          {
            type: 'LAYER_BLUR',
            color: { r: 0, g: 0, b: 0, a: 1 },
            offset: { x: 0, y: 0 },
            radius: 20,
            spread: 0,
            visible: true
          }
        ]
      })

      // Frame 1: baseline
      renderer.render(graph, new Set(), {}, 1)

      // Frame 2: preview
      graph.updateNodePositionPreview(rect.id, 200, 180)
      renderer.render(graph, new Set(), {}, 1)
      expect(renderer.positionPreviewActive).toBe(true)
      const previewPixels = readPixels(renderer)

      // Frame 3: commit
      graph.updateNode(rect.id, { x: 200, y: 180 })
      renderer.render(graph, new Set(), {}, 2)
      expect(renderer.positionPreviewActive).toBe(false)
      const committedPixels = readPixels(renderer)

      expect(countDifferingPixels(previewPixels, committedPixels, 8)).toBe(0)
      expect(maxChannelDelta(previewPixels, committedPixels)).toBeLessThanOrEqual(8)
    } finally {
      surface.delete()
    }
  })

  test('BACKGROUND_BLUR: over patterned backdrop matches committed frame', async () => {
    const { surface, renderer } = createRenderer()
    await renderer.loadFonts()

    try {
      const graph = new SceneGraph()
      const page = graph.getPages()[0]
      renderer.pageId = page.id

      // Create high-contrast background stripes
      for (let i = 0; i < 6; i++) {
        graph.createNode('RECTANGLE', page.id, {
          x: i * 90,
          y: 0,
          width: 50,
          height: 450,
          fills: [
            {
              type: 'SOLID',
              color: { r: i % 2 === 0 ? 0.9 : 0.1, g: 0.2, b: i % 2 === 0 ? 0.2 : 0.9, a: 1 },
              opacity: 1,
              visible: true
            }
          ]
        })
      }

      // Semi-transparent frosted glass shape with background blur
      const glass = graph.createNode('RECTANGLE', page.id, {
        x: 60,
        y: 60,
        width: 180,
        height: 140,
        cornerRadius: 16,
        fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 0.35 }, opacity: 0.35, visible: true }],
        effects: [
          {
            type: 'BACKGROUND_BLUR',
            color: { r: 0, g: 0, b: 0, a: 0 },
            offset: { x: 0, y: 0 },
            radius: 18,
            spread: 0,
            visible: true
          }
        ]
      })

      // Frame 1: baseline
      renderer.render(graph, new Set(), {}, 1)

      // Frame 2: drag preview across background stripes
      graph.updateNodePositionPreview(glass.id, 160, 140)
      renderer.render(graph, new Set(), {}, 1)
      expect(renderer.positionPreviewActive).toBe(true)
      const previewPixels = readPixels(renderer)

      // Frame 3: committed position
      graph.updateNode(glass.id, { x: 160, y: 140 })
      renderer.render(graph, new Set(), {}, 2)
      expect(renderer.positionPreviewActive).toBe(false)
      const committedPixels = readPixels(renderer)

      expect(countDifferingPixels(previewPixels, committedPixels, 8)).toBe(0)
      expect(maxChannelDelta(previewPixels, committedPixels)).toBeLessThanOrEqual(8)
    } finally {
      surface.delete()
    }
  })

  test('Progressive LAYER_BLUR: preview frame matches committed frame', async () => {
    const { surface, renderer } = createRenderer()
    await renderer.loadFonts()

    try {
      const graph = new SceneGraph()
      const page = graph.getPages()[0]
      renderer.pageId = page.id

      const rect = graph.createNode('RECTANGLE', page.id, {
        x: 100,
        y: 80,
        width: 150,
        height: 150,
        fills: [{ type: 'SOLID', color: { r: 0.8, g: 0.1, b: 0.6, a: 1 }, opacity: 1, visible: true }],
        effects: [
          {
            type: 'LAYER_BLUR',
            blurType: 'PROGRESSIVE',
            startRadius: 0,
            radius: 24,
            startOffset: { x: 0.5, y: 0 },
            endOffset: { x: 0.5, y: 1 },
            color: { r: 0, g: 0, b: 0, a: 1 },
            offset: { x: 0, y: 0 },
            spread: 0,
            visible: true
          } as Effect
        ]
      })

      // Frame 1: baseline
      renderer.render(graph, new Set(), {}, 1)

      // Frame 2: preview
      graph.updateNodePositionPreview(rect.id, 180, 160)
      renderer.render(graph, new Set(), {}, 1)
      expect(renderer.positionPreviewActive).toBe(true)
      const previewPixels = readPixels(renderer)

      // Frame 3: commit
      graph.updateNode(rect.id, { x: 180, y: 160 })
      renderer.render(graph, new Set(), {}, 2)
      expect(renderer.positionPreviewActive).toBe(false)
      const committedPixels = readPixels(renderer)

      expect(countDifferingPixels(previewPixels, committedPixels, 8)).toBe(0)
      expect(maxChannelDelta(previewPixels, committedPixels)).toBeLessThanOrEqual(8)
    } finally {
      surface.delete()
    }
  })

  test('Nested child inside a clipsContent frame: preview matches committed frame', async () => {
    const { surface, renderer } = createRenderer()
    await renderer.loadFonts()

    try {
      const graph = new SceneGraph()
      const page = graph.getPages()[0]
      renderer.pageId = page.id

      const frame = graph.createNode('FRAME', page.id, {
        x: 50,
        y: 50,
        width: 250,
        height: 250,
        clipsContent: true,
        fills: [{ type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.95, a: 1 }, opacity: 1, visible: true }]
      })

      const child = graph.createNode('RECTANGLE', frame.id, {
        x: 30,
        y: 30,
        width: 100,
        height: 100,
        fills: [{ type: 'SOLID', color: { r: 0.3, g: 0.6, b: 0.9, a: 1 }, opacity: 1, visible: true }],
        effects: [
          {
            type: 'DROP_SHADOW',
            color: { r: 0, g: 0, b: 0, a: 0.5 },
            offset: { x: 8, y: 8 },
            radius: 12,
            spread: 0,
            visible: true
          }
        ]
      })

      // Frame 1: baseline
      renderer.render(graph, new Set(), {}, 1)

      // Frame 2: preview moving child partly outside frame bounds
      graph.updateNodePositionPreview(child.id, 160, 160)
      renderer.render(graph, new Set(), {}, 1)
      expect(renderer.positionPreviewActive).toBe(true)
      const previewPixels = readPixels(renderer)

      // Frame 3: commit
      graph.updateNode(child.id, { x: 160, y: 160 })
      renderer.render(graph, new Set(), {}, 2)
      expect(renderer.positionPreviewActive).toBe(false)
      const committedPixels = readPixels(renderer)

      expect(countDifferingPixels(previewPixels, committedPixels, 8)).toBe(0)
      expect(maxChannelDelta(previewPixels, committedPixels)).toBeLessThanOrEqual(8)
    } finally {
      surface.delete()
    }
  })

  test('Multi-selection: multiple shadowed nodes moved together maintain preview parity', async () => {
    const { surface, renderer } = createRenderer()
    await renderer.loadFonts()

    try {
      const graph = new SceneGraph()
      const page = graph.getPages()[0]
      renderer.pageId = page.id

      const nodeA = graph.createNode('RECTANGLE', page.id, {
        x: 60,
        y: 60,
        width: 100,
        height: 100,
        fills: [{ type: 'SOLID', color: { r: 0.8, g: 0.2, b: 0.3, a: 1 }, opacity: 1, visible: true }],
        effects: [
          {
            type: 'DROP_SHADOW',
            color: { r: 0, g: 0, b: 0, a: 0.6 },
            offset: { x: 6, y: 6 },
            radius: 10,
            spread: 0,
            visible: true
          }
        ]
      })

      const nodeB = graph.createNode('RECTANGLE', page.id, {
        x: 220,
        y: 60,
        width: 100,
        height: 100,
        fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.7, b: 0.4, a: 1 }, opacity: 1, visible: true }],
        effects: [
          {
            type: 'DROP_SHADOW',
            color: { r: 0, g: 0, b: 0, a: 0.6 },
            offset: { x: 6, y: 6 },
            radius: 10,
            spread: 0,
            visible: true
          }
        ]
      })

      // Frame 1: baseline
      renderer.render(graph, new Set([nodeA.id, nodeB.id]), {}, 1)

      // Frame 2: preview moving both nodes by dx=+50, dy=+40
      graph.updateNodePositionPreview(nodeA.id, 110, 100)
      graph.updateNodePositionPreview(nodeB.id, 270, 100)
      renderer.render(graph, new Set([nodeA.id, nodeB.id]), {}, 1)
      expect(renderer.positionPreviewActive).toBe(true)
      const previewPixels = readPixels(renderer)

      // Frame 3: commit both nodes
      graph.updateNode(nodeA.id, { x: 110, y: 100 })
      graph.updateNode(nodeB.id, { x: 270, y: 100 })
      renderer.render(graph, new Set([nodeA.id, nodeB.id]), {}, 2)
      expect(renderer.positionPreviewActive).toBe(false)
      const committedPixels = readPixels(renderer)

      expect(countDifferingPixels(previewPixels, committedPixels, 8)).toBe(0)
      expect(maxChannelDelta(previewPixels, committedPixels)).toBeLessThanOrEqual(8)
    } finally {
      surface.delete()
    }
  })

  test('Retained backing: layer="scene" across successive preview ticks exercises volatile path', async () => {
    const { surface, renderer } = createRenderer()
    await renderer.loadFonts()

    try {
      const graph = new SceneGraph()
      const page = graph.getPages()[0]
      renderer.pageId = page.id

      const rect = graph.createNode('RECTANGLE', page.id, {
        x: 80,
        y: 80,
        width: 120,
        height: 120,
        fills: [{ type: 'SOLID', color: { r: 0.5, g: 0.2, b: 0.8, a: 1 }, opacity: 1, visible: true }],
        effects: [
          {
            type: 'DROP_SHADOW',
            color: { r: 0, g: 0, b: 0, a: 0.5 },
            offset: { x: 10, y: 10 },
            radius: 14,
            spread: 0,
            visible: true
          }
        ]
      })

      // 4 warm frames on layer='scene'
      for (let i = 0; i < 4; i++) {
        renderer.render(graph, new Set(), {}, 1, 'scene')
      }

      // 10 successive drag preview ticks
      let lastPreviewPixels: Uint8Array | null = null
      for (let tick = 1; tick <= 10; tick++) {
        graph.updateNodePositionPreview(rect.id, 80 + tick * 8, 80 + tick * 6)
        renderer.render(graph, new Set(), {}, 1, 'scene')
        expect(renderer.positionPreviewActive).toBe(true)
        expect(renderer.profiler.stats.scenePictureMode).toBe('volatile')
        lastPreviewPixels = readPixels(renderer)
      }

      // Commit at final tick position
      const finalX = 80 + 10 * 8
      const finalY = 80 + 10 * 6
      graph.updateNode(rect.id, { x: finalX, y: finalY })
      renderer.render(graph, new Set(), {}, 2, 'scene')
      expect(renderer.positionPreviewActive).toBe(false)
      const committedPixels = readPixels(renderer)

      expect(lastPreviewPixels).not.toBeNull()
      if (lastPreviewPixels) {
        expect(countDifferingPixels(lastPreviewPixels, committedPixels, 8)).toBe(0)
        expect(maxChannelDelta(lastPreviewPixels, committedPixels)).toBeLessThanOrEqual(8)
      }

      // Subsequent frame at version 2 recovers scene picture hit
      renderer.render(graph, new Set(), {}, 2, 'scene')
      expect(renderer.profiler.stats.scenePictureMode).toBe('hit')
    } finally {
      surface.delete()
    }
  })

  test('Drag cancellation preserves graph state', async () => {
    const { surface, renderer } = createRenderer()
    await renderer.loadFonts()

    try {
      const graph = new SceneGraph()
      const page = graph.getPages()[0]
      renderer.pageId = page.id

      const startX = 70
      const startY = 70
      const rect = graph.createNode('RECTANGLE', page.id, {
        x: startX,
        y: startY,
        width: 100,
        height: 100,
        fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.6, b: 0.9, a: 1 }, opacity: 1, visible: true }],
        effects: [
          {
            type: 'DROP_SHADOW',
            color: { r: 0, g: 0, b: 0, a: 0.5 },
            offset: { x: 5, y: 5 },
            radius: 8,
            spread: 0,
            visible: true
          }
        ]
      })

      // Frame 1: baseline
      renderer.render(graph, new Set(), {}, 1)

      // Start drag preview
      graph.updateNodePositionPreview(rect.id, 200, 200)
      renderer.render(graph, new Set(), {}, 1)
      expect(renderer.positionPreviewActive).toBe(true)

      // Cancel drag (restore previewed node position)
      graph.updateNodePositionPreview(rect.id, startX, startY)
      renderer.render(graph, new Set(), {}, 1)

      const cancelledNode = expectDefined(graph.getNode(rect.id), 'node')
      expect(cancelledNode.x).toBe(startX)
      expect(cancelledNode.y).toBe(startY)

      // Commit a valid move
      const targetX = 140
      const targetY = 120
      graph.updateNode(rect.id, { x: targetX, y: targetY })
      renderer.render(graph, new Set(), {}, 2)
      expect(renderer.positionPreviewActive).toBe(false)

      const committedNode = expectDefined(graph.getNode(rect.id), 'node')
      expect(committedNode.x).toBe(targetX)
      expect(committedNode.y).toBe(targetY)
    } finally {
      surface.delete()
    }
  })
})
