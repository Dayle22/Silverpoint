import { beforeAll, describe, expect, test } from 'bun:test'
import type { CanvasKit } from 'canvaskit-wasm'
import { SceneGraph } from '@open-pencil/scene-graph'
import { SkiaRenderer } from '@open-pencil/core'
import { initCanvasKit } from '#cli/headless'
import { expectDefined } from '#tests/helpers/assert'

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
  const px = Math.round(x)
  const py = Math.round(y)
  const idx = (py * width + px) * 4
  return [pixels[idx], pixels[idx + 1], pixels[idx + 2], pixels[idx + 3]]
}

function isSelectionColored(
  pixel: [number, number, number, number],
  bg: [number, number, number, number]
): boolean {
  const diff =
    Math.abs(pixel[0] - bg[0]) + Math.abs(pixel[1] - bg[1]) + Math.abs(pixel[2] - bg[2])
  return diff > 30 && pixel[2] > pixel[0]
}

describe('T-062: Selection outline fidelity', () => {
  test('single selection outline follows rounded corner arc instead of square corner', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const rect = graph.createNode('RECTANGLE', page.id, {
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      cornerRadius: 30,
      fills: [],
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

    renderer.render(graph, new Set([rect.id]), {}, 1)

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

    const bgPixel = getPixel(pixels, width, 10, 10)

    // (56, 56) is in the top-left square corner region outside the rounded arc (r=30)
    // and outside the corner handle at (50,50). It MUST NOT be stroked.
    const cornerPixel = getPixel(pixels, width, 56, 56)
    expect(isSelectionColored(cornerPixel, bgPixel)).toBe(false)

    // (90, 50) is on the straight top edge and MUST be stroked.
    const topEdgePixel = getPixel(pixels, width, 90, 50)
    expect(isSelectionColored(topEdgePixel, bgPixel)).toBe(true)

    image.delete()
    surface.delete()
  })

  test('selection outline updates continuously when cornerRadius changes live', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const rect = graph.createNode('RECTANGLE', page.id, {
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      cornerRadius: 0,
      fills: [],
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

    // Step 1: cornerRadius = 0 (top edge at x=70, y=50 is straight and stroked)
    renderer.render(graph, new Set([rect.id]), {}, 1)
    let image = surface.makeImageSnapshot()
    let pixels = expectDefined(
      image.readPixels(0, 0, {
        width,
        height,
        colorType: ck.ColorType.RGBA_8888,
        alphaType: ck.AlphaType.Unpremul,
        colorSpace: ck.ColorSpace.SRGB
      }),
      'pixels'
    )
    const bgPixel = getPixel(pixels, width, 10, 10)
    const straightEdgePixel = getPixel(pixels, width, 70, 50)
    expect(isSelectionColored(straightEdgePixel, bgPixel)).toBe(true)
    image.delete()

    // Step 2: mutate node cornerRadius directly to 35 (simulating updateNodePreview during radius drag)
    graph.updateNode(rect.id, { cornerRadius: 35 })
    renderer.render(graph, new Set([rect.id]), {}, 2)
    image = surface.makeImageSnapshot()
    pixels = expectDefined(
      image.readPixels(0, 0, {
        width,
        height,
        colorType: ck.ColorType.RGBA_8888,
        alphaType: ck.AlphaType.Unpremul,
        colorSpace: ck.ColorSpace.SRGB
      }),
      'pixels'
    )

    // (70, 50) was on the square edge, but is now rounded away with r=35 -> not stroked
    const roundedAwayPixel = getPixel(pixels, width, 70, 50)
    expect(isSelectionColored(roundedAwayPixel, bgPixel)).toBe(false)

    // (90, 50) is on the top straight edge of the r=35 rounded rectangle -> stroked
    const topEdgePixel = getPixel(pixels, width, 90, 50)
    expect(isSelectionColored(topEdgePixel, bgPixel)).toBe(true)

    image.delete()
    surface.delete()
  })

  test('independent corner radii outline follows each corner arc independently', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const rect = graph.createNode('RECTANGLE', page.id, {
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      independentCorners: true,
      topLeftRadius: 40,
      topRightRadius: 0,
      bottomRightRadius: 40,
      bottomLeftRadius: 0,
      fills: [],
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

    renderer.render(graph, new Set([rect.id]), {}, 1)

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

    const bgPixel = getPixel(pixels, width, 10, 10)

    // Top-left has radius 40: (56, 56) is in the rounded-away region -> not stroked
    const tlPixel = getPixel(pixels, width, 56, 56)
    expect(isSelectionColored(tlPixel, bgPixel)).toBe(false)

    // Top-right has radius 0: straight top edge extends to (140, 50) -> stroked
    const trTopEdge = getPixel(pixels, width, 140, 50)
    expect(isSelectionColored(trTopEdge, bgPixel)).toBe(true)

    // Bottom-right has radius 40: (142, 142) is in the rounded-away region -> not stroked
    const brPixel = getPixel(pixels, width, 142, 142)
    expect(isSelectionColored(brPixel, bgPixel)).toBe(false)

    // Bottom-left has radius 0: straight bottom edge extends to (60, 150) -> stroked
    const blBottomEdge = getPixel(pixels, width, 60, 150)
    expect(isSelectionColored(blBottomEdge, bgPixel)).toBe(true)

    image.delete()
    surface.delete()
  })

  test('multi-selection stroke width is zoom-invariant (1 / r.zoom)', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node1 = graph.createNode('RECTANGLE', page.id, {
      x: 10,
      y: 10,
      width: 40,
      height: 40,
      fills: [],
      strokes: []
    })
    const node2 = graph.createNode('RECTANGLE', page.id, {
      x: 60,
      y: 10,
      width: 40,
      height: 40,
      fills: [],
      strokes: []
    })

    const width = 300
    const height = 300
    const surface = expectDefined(ck.MakeSurface(width, height), 'surface')
    const renderer = new SkiaRenderer(ck, surface)
    renderer.viewportWidth = width
    renderer.viewportHeight = height
    renderer.pageId = page.id

    // At zoom = 2, selection paint stroke width is set to 1 / 2 = 0.5 canvas unit
    renderer.panX = 0
    renderer.panY = 0
    renderer.zoom = 2
    renderer.dpr = 1
    renderer.render(graph, new Set([node1.id, node2.id]), {}, 1)

    // Check that selectionPaint has stroke width 1 / zoom = 0.5
    expect(renderer.selectionPaint.getStrokeWidth()).toBeCloseTo(0.5, 3)

    // At zoom = 0.5, selection paint stroke width is set to 1 / 0.5 = 2.0 canvas units
    renderer.zoom = 0.5
    renderer.render(graph, new Set([node1.id, node2.id]), {}, 2)
    expect(renderer.selectionPaint.getStrokeWidth()).toBeCloseTo(2.0, 3)

    surface.delete()
  })
})

describe('T-050a: Radius handle inward tracking', () => {
  function sampleRingHit(
    pixels: Uint8Array,
    width: number,
    cx: number,
    cy: number,
    dotRadius: number,
    bg: [number, number, number, number]
  ): boolean {
    const offsets: [number, number][] = [
      [dotRadius, 0],
      [-dotRadius, 0],
      [0, dotRadius],
      [0, -dotRadius]
    ]
    return offsets.some(([dx, dy]) =>
      isSelectionColored(getPixel(pixels, width, cx + dx, cy + dy), bg)
    )
  }

  function renderRect(radius: number) {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const rect = graph.createNode('RECTANGLE', page.id, {
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      cornerRadius: radius,
      fills: [],
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
    renderer.render(graph, new Set([rect.id]), {}, 1)

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
    const bg = getPixel(pixels, width, 10, 10)
    image.delete()
    surface.delete()
    return { pixels, width, bg }
  }

  test('handle sits at the fixed 12px floor when cornerRadius is 0', () => {
    const { pixels, width, bg } = renderRect(0)
    expect(sampleRingHit(pixels, width, 62, 62, 4, bg)).toBe(true)
    expect(sampleRingHit(pixels, width, 90, 90, 4, bg)).toBe(false)
  })

  test('handle moves inward to track cornerRadius as it grows', () => {
    const { pixels, width, bg } = renderRect(40)
    expect(sampleRingHit(pixels, width, 90, 90, 4, bg)).toBe(true)
    expect(sampleRingHit(pixels, width, 62, 62, 4, bg)).toBe(false)
  })

  test('handle clamps at the shape centre instead of overshooting past it', () => {
    const { pixels, width, bg } = renderRect(200)
    expect(sampleRingHit(pixels, width, 100, 100, 4, bg)).toBe(true)
  })
})

describe('T-050b2: Star/polygon vertex radius handles', () => {
  function renderPolygon(radius: number) {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('POLYGON', page.id, {
      x: 50,
      y: 50,
      width: 200,
      height: 200,
      pointCount: 4,
      cornerRadius: radius,
      fills: [],
      strokes: []
    })

    const width = 300
    const height = 300
    const surface = expectDefined(ck.MakeSurface(width, height), 'surface')
    const renderer = new SkiaRenderer(ck, surface)
    renderer.viewportWidth = width
    renderer.viewportHeight = height
    renderer.pageId = page.id
    renderer.panX = 0
    renderer.panY = 0
    renderer.zoom = 1
    renderer.dpr = 1
    renderer.render(graph, new Set([node.id]), {}, 1)

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
    const bg = getPixel(pixels, width, 10, 10)
    image.delete()
    surface.delete()
    return { pixels, width, bg }
  }

  function sampleRingHit(
    pixels: Uint8Array,
    width: number,
    cx: number,
    cy: number,
    dotRadius: number,
    bg: [number, number, number, number]
  ): boolean {
    const offsets: [number, number][] = [
      [dotRadius, 0],
      [-dotRadius, 0],
      [0, dotRadius],
      [0, -dotRadius]
    ]
    return offsets.some(([dx, dy]) =>
      isSelectionColored(getPixel(pixels, width, cx + dx, cy + dy), bg)
    )
  }

  test('a top-vertex handle sits at the fixed floor when cornerRadius is 0', () => {
    const { pixels, width, bg } = renderPolygon(0)
    expect(sampleRingHit(pixels, width, 150, 62, 4, bg)).toBe(true)
    expect(sampleRingHit(pixels, width, 150, 90, 4, bg)).toBe(false)
  })

  test('the handle moves inward as cornerRadius grows', () => {
    const { pixels, width, bg } = renderPolygon(40)
    expect(sampleRingHit(pixels, width, 150, 90, 4, bg)).toBe(true)
    expect(sampleRingHit(pixels, width, 150, 55, 4, bg)).toBe(false)
  })

  test('the handle clamps at the vertex max radius instead of flying past it', () => {
    const { pixels, width, bg } = renderPolygon(999)
    expect(sampleRingHit(pixels, width, 150, 120.71, 4, bg)).toBe(true)
  })

  test('a 4-point polygon draws exactly 4 handles, none at the shape centre', () => {
    const { pixels, width, bg } = renderPolygon(40)
    expect(sampleRingHit(pixels, width, 150, 150, 4, bg)).toBe(false)
  })
})

