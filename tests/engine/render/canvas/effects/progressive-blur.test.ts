import { beforeAll, describe, expect, test } from 'bun:test'

import { renderNodesToImage, SceneGraph, SkiaRenderer } from '@open-pencil/core'
import type { Effect } from '@open-pencil/scene-graph'

import { initCanvasKit } from '#cli/headless'

import { expectDefined } from '#tests/helpers/assert'

let ck: Awaited<ReturnType<typeof initCanvasKit>>

const SIZE = 100
const END_RADIUS = 40

beforeAll(async () => {
  ck = await initCanvasKit()
})

function blurEffect(overrides: Partial<Effect> = {}): Effect {
  return {
    type: 'LAYER_BLUR',
    color: { r: 0, g: 0, b: 0, a: 1 },
    offset: { x: 0, y: 0 },
    radius: END_RADIUS,
    spread: 0,
    visible: true,
    ...overrides
  }
}

/**
 * Renders a black square carrying `effect` and returns its RGBA pixels plus the
 * image size, which includes the transparent margin the blur bleeds into.
 */
function renderBlurredSquare(effect: Effect): {
  pixels: Uint8Array
  width: number
  height: number
} {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const rect = graph.createNode('RECTANGLE', page.id, {
    x: 0,
    y: 0,
    width: SIZE,
    height: SIZE,
    fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
    effects: [effect]
  })

  const surface = expectDefined(ck.MakeSurface(1, 1), 'surface')
  const renderer = new SkiaRenderer(ck, surface)
  try {
    const png = expectDefined(
      renderNodesToImage(ck, renderer, graph, page.id, [rect.id], { scale: 1, format: 'PNG' }),
      'png'
    )
    const image = expectDefined(ck.MakeImageFromEncoded(png), 'image')
    const width = image.width()
    const height = image.height()
    const pixels = expectDefined(
      image.readPixels(0, 0, {
        width,
        height,
        colorType: ck.ColorType.RGBA_8888,
        alphaType: ck.AlphaType.Unpremul,
        colorSpace: ck.ColorSpace.SRGB
      }),
      'pixels'
    ) as Uint8Array
    image.delete()
    return { pixels, width, height }
  } finally {
    surface.delete()
  }
}

/** Mean alpha of one pixel row, 0 (clear) to 255 (opaque). */
function rowAlpha(pixels: Uint8Array, width: number, y: number): number {
  let total = 0
  for (let x = 0; x < width; x++) total += pixels[(y * width + x) * 4 + 3]
  return total / width
}

/** Alpha of a single pixel, 0 (clear) to 255 (opaque). */
function alphaAt(pixels: Uint8Array, width: number, x: number, y: number): number {
  return pixels[(y * width + x) * 4 + 3]
}

describe('progressive layer blur', () => {
  test('ramps from sharp at the start handle to blurred at the end handle', () => {
    const { pixels, width, height } = renderBlurredSquare(
      blurEffect({
        blurType: 'PROGRESSIVE',
        startRadius: 0,
        startOffset: { x: 0.5, y: 0 },
        endOffset: { x: 0.5, y: 1 }
      })
    )

    // The export pads by the blur radius on every side, so the square's own
    // top and bottom edges sit `margin` rows inside the image.
    const margin = (height - SIZE) / 2
    const aboveTop = rowAlpha(pixels, width, Math.max(0, margin - 6))
    const belowBottom = rowAlpha(pixels, width, Math.min(height - 1, margin + SIZE + 6))

    // Sharp at the start of the ramp: nothing bleeds past the top edge.
    expect(aboveTop).toBeLessThan(5)
    // Blurred at the end of it: the bottom edge bleeds well past the square.
    expect(belowBottom).toBeGreaterThan(30)
  })

  test('does not leave the sharp silhouette visible inside the blurred end', () => {
    // Ramp left to right, so the square's right edge sits at full blur.
    const { pixels, width, height } = renderBlurredSquare(
      blurEffect({
        blurType: 'PROGRESSIVE',
        startRadius: 0,
        startOffset: { x: 0, y: 0.5 },
        endOffset: { x: 1, y: 0.5 }
      })
    )

    const margin = (width - SIZE) / 2
    const rightEdge = margin + SIZE
    const midY = Math.round(height / 2)

    // Crossing the blurred edge has to stay gradual. A sharp copy showing
    // through the softer bands above it would sit fully opaque right up to the
    // silhouette and then drop away, which is the artifact this stack avoids.
    let previous = alphaAt(pixels, width, rightEdge - 12, midY)
    let largestStep = 0
    for (let dx = -9; dx <= 12; dx += 3) {
      const alpha = alphaAt(pixels, width, rightEdge + dx, midY)
      largestStep = Math.max(largestStep, Math.abs(alpha - previous))
      previous = alpha
    }

    expect(alphaAt(pixels, width, rightEdge - 3, midY)).toBeLessThan(240)
    expect(largestStep).toBeLessThan(60)
  })

  test('bleeds at both edges when the same radius is uniform', () => {
    const { pixels, width, height } = renderBlurredSquare(blurEffect())

    const margin = (height - SIZE) / 2
    const aboveTop = rowAlpha(pixels, width, Math.max(0, margin - 6))
    const belowBottom = rowAlpha(pixels, width, Math.min(height - 1, margin + SIZE + 6))

    expect(aboveTop).toBeGreaterThan(30)
    expect(belowBottom).toBeGreaterThan(30)
  })

  test('falls back to a uniform blur when the ramp axis collapses', () => {
    const collapsed = renderBlurredSquare(
      blurEffect({
        blurType: 'PROGRESSIVE',
        startRadius: 0,
        startOffset: { x: 0.5, y: 0.5 },
        endOffset: { x: 0.5, y: 0.5 }
      })
    )
    const uniform = renderBlurredSquare(blurEffect())

    const margin = (collapsed.height - SIZE) / 2
    expect(rowAlpha(collapsed.pixels, collapsed.width, Math.max(0, margin - 6))).toBeCloseTo(
      rowAlpha(uniform.pixels, uniform.width, Math.max(0, margin - 6)),
      0
    )
  })
})
