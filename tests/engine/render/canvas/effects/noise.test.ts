import { beforeAll, describe, expect, test } from 'bun:test'

import { renderNodesToImage, SceneGraph, SkiaRenderer } from '@open-pencil/core'
import type { Effect } from '@open-pencil/scene-graph'
import { createNoiseEffect } from '@open-pencil/scene-graph/node-defaults'

import { initCanvasKit } from '#cli/headless'

import { expectDefined } from '#tests/helpers/assert'

let ck: Awaited<ReturnType<typeof initCanvasKit>>

const SIZE = 50

beforeAll(async () => {
  ck = await initCanvasKit()
})

function renderSquare(effect?: Effect): {
  pixels: Uint8Array
  renderer: SkiaRenderer
} {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const rect = graph.createNode('RECTANGLE', page.id, {
    x: 0,
    y: 0,
    width: SIZE,
    height: SIZE,
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }],
    effects: effect ? [effect] : []
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
    return { pixels, renderer }
  } finally {
    surface.delete()
  }
}

describe('noise effect', () => {
  test('renders grain overlay modifying pixel values compared to flat baseline', () => {
    const baseline = renderSquare()
    const noise = renderSquare(createNoiseEffect())

    let diffCount = 0
    for (let i = 0; i < baseline.pixels.length; i += 4) {
      if (
        baseline.pixels[i] !== noise.pixels[i] ||
        baseline.pixels[i + 1] !== noise.pixels[i + 1] ||
        baseline.pixels[i + 2] !== noise.pixels[i + 2]
      ) {
        diffCount++
      }
    }
    expect(diffCount).toBeGreaterThan(0)
  })

  test('grain scale and color alpha alter the rendered pixel output', () => {
    const noise1 = renderSquare({
      ...createNoiseEffect(),
      radius: 1,
      color: { r: 0, g: 0, b: 0, a: 0.5 }
    })
    const noise2 = renderSquare({
      ...createNoiseEffect(),
      radius: 8,
      color: { r: 0, g: 0, b: 0, a: 0.5 }
    })

    let diffCount = 0
    for (let i = 0; i < noise1.pixels.length; i += 4) {
      if (noise1.pixels[i] !== noise2.pixels[i]) {
        diffCount++
      }
    }
    expect(diffCount).toBeGreaterThan(0)
  })

  test('reuses cached RuntimeEffect across renders', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const rect = graph.createNode('RECTANGLE', page.id, {
      x: 0,
      y: 0,
      width: SIZE,
      height: SIZE,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }],
      effects: [createNoiseEffect()]
    })

    const surface = expectDefined(ck.MakeSurface(1, 1), 'surface')
    const renderer = new SkiaRenderer(ck, surface)
    try {
      renderNodesToImage(ck, renderer, graph, page.id, [rect.id], { scale: 1, format: 'PNG' })
      expect(renderer.noiseRuntimeEffects.size).toBe(1)

      renderNodesToImage(ck, renderer, graph, page.id, [rect.id], { scale: 1, format: 'PNG' })
      expect(renderer.noiseRuntimeEffects.size).toBe(1)
    } finally {
      renderer.destroy()
    }
  })
})
