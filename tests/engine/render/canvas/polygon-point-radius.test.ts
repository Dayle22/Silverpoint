import { beforeAll, describe, expect, mock, test } from 'bun:test'

import type { CanvasKit } from 'canvaskit-wasm'

import { SceneGraph } from '@open-pencil/scene-graph'
import { SkiaRenderer } from '@open-pencil/core'
import type { SkiaRenderer as SkiaRendererType } from '#core/canvas/renderer'
import { makePolygonPath } from '#core/canvas/shapes'
import { initCanvasKit } from '#cli/headless'
import { expectDefined } from '#tests/helpers/assert'

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

function createMockRenderer() {
  const paths: Array<{
    moveTo: ReturnType<typeof mock>
    lineTo: ReturnType<typeof mock>
    arcToTangent: ReturnType<typeof mock>
    close: ReturnType<typeof mock>
    delete: ReturnType<typeof mock>
  }> = []

  class MockPath {
    moveTo = mock(() => undefined)
    lineTo = mock(() => undefined)
    arcToTangent = mock(() => this)
    close = mock(() => undefined)
    delete = mock(() => undefined)

    constructor() {
      paths.push(this)
    }
  }

  const renderer = { ck: { Path: MockPath } } as SkiaRendererType
  return { renderer, paths }
}

describe('makePolygonPath: mock-based geometry contract', () => {
  test('radius 0 uses the plain sharp-vertex loop, no arcToTangent', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('POLYGON', pageId(graph), {
      width: 200,
      height: 200,
      pointCount: 4,
      cornerRadius: 0
    })
    const { renderer, paths } = createMockRenderer()

    makePolygonPath(renderer, node).delete()

    expect(paths).toHaveLength(1)
    expect(paths[0].moveTo).toHaveBeenCalledTimes(1)
    expect(paths[0].lineTo).toHaveBeenCalledTimes(3)
    expect(paths[0].arcToTangent).not.toHaveBeenCalled()
    expect(paths[0].close).toHaveBeenCalled()
  })

  test('a positive radius calls arcToTangent once per vertex, including a star inner vertex', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('STAR', pageId(graph), {
      width: 200,
      height: 200,
      pointCount: 5,
      cornerRadius: 5
    })
    const { renderer, paths } = createMockRenderer()

    makePolygonPath(renderer, node).delete()

    expect(paths).toHaveLength(1)
    expect(paths[0].moveTo).toHaveBeenCalledTimes(1)
    expect(paths[0].lineTo).not.toHaveBeenCalled()
    expect(paths[0].arcToTangent).toHaveBeenCalledTimes(10)
    expect(paths[0].close).toHaveBeenCalled()
  })

  test('a radius past the vertex clamp is reduced, not applied verbatim', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('POLYGON', pageId(graph), {
      width: 200,
      height: 200,
      pointCount: 4,
      cornerRadius: 500
    })
    const { renderer, paths } = createMockRenderer()

    makePolygonPath(renderer, node).delete()

    const call = paths[0].arcToTangent.mock.calls[0] as unknown[]
    const appliedRadius = call[4] as number
    expect(appliedRadius).toBeLessThan(500)
    expect(appliedRadius).toBeCloseTo(50 * Math.SQRT2, 5)
  })
})

describe('makePolygonPath: real-CanvasKit render regression', () => {
  let ck: CanvasKit

  beforeAll(async () => {
    ck = await initCanvasKit()
  })

  function getPixel(
    pixels: Uint8Array,
    width: number,
    x: number,
    y: number
  ): [number, number, number, number] {
    const idx = (Math.round(y) * width + Math.round(x)) * 4
    return [pixels[idx], pixels[idx + 1], pixels[idx + 2], pixels[idx + 3]]
  }

  function isFilledColored(
    pixel: [number, number, number, number],
    bg: [number, number, number, number]
  ): boolean {
    const diff =
      Math.abs(pixel[0] - bg[0]) + Math.abs(pixel[1] - bg[1]) + Math.abs(pixel[2] - bg[2])
    return diff > 30 && pixel[0] > pixel[2]
  }

  function renderDiamond(radius: number) {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    graph.createNode('POLYGON', page.id, {
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      pointCount: 4,
      cornerRadius: radius,
      fills: [
        { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true, blendMode: 'NORMAL' }
      ],
      strokes: []
    })

    const width = 200
    const height = 200
    const surface = expectDefined(ck.MakeSurface(width, height), 'surface')
    const renderer = new SkiaRenderer(ck, surface)
    renderer.viewportWidth = width
    renderer.viewportHeight = height
    renderer.pageId = page.id
    renderer.panX = 0
    renderer.panY = 0
    renderer.zoom = 1
    renderer.dpr = 1
    renderer.showRulers = false
    renderer.render(graph, new Set(), {}, 1)

    const image = surface.makeImageSnapshot()
    const pixels = expectDefined(
      image.readPixels(0, 0, {
        width,
        height,
        colorType: ck.ColorType.RGBA_8888,
        alphaType: ck.AlphaType.Unpremul,
        colorSpace: ck.ColorSpace.SRGB
      }),
      'pixels'
    )
    const bg = getPixel(pixels, width, 2, 2)
    image.delete()
    surface.delete()
    return { pixels, width, bg }
  }

  test('sharp diamond tip is filled when point radius is 0', () => {
    const { pixels, width, bg } = renderDiamond(0)
    expect(isFilledColored(getPixel(pixels, width, 100, 1), bg)).toBe(true)
  })

  test('a positive point radius rounds the tip away, interior stays filled', () => {
    const { pixels, width, bg } = renderDiamond(40)
    expect(isFilledColored(getPixel(pixels, width, 100, 1), bg)).toBe(false)
    expect(isFilledColored(getPixel(pixels, width, 100, 100), bg)).toBe(true)
  })

  test('a very large point radius clamps instead of self-intersecting or throwing', () => {
    expect(() => renderDiamond(500)).not.toThrow()
    const { pixels, width, bg } = renderDiamond(500)
    expect(isFilledColored(getPixel(pixels, width, 100, 100), bg)).toBe(true)
  })
})
