import { beforeAll, describe, expect, test } from 'bun:test'

import { renderNodesToImage, SceneGraph, SkiaRenderer } from '@open-pencil/core'

import { initCanvasKit } from '#cli/headless'
import { DEFAULT_FRAME_GUIDES, upsertFrameGuides } from '#core/guides/frame'

import { expectDefined } from '#tests/helpers/assert'

let ck: Awaited<ReturnType<typeof initCanvasKit>>

function rectangleCommandsBlob(x: number, y: number, width: number, height: number): Uint8Array {
  const blob = new Uint8Array(1 + 4 * 9 + 1)
  const view = new DataView(blob.buffer)
  const points = [
    { command: 1, x, y },
    { command: 2, x: x + width, y },
    { command: 2, x: x + width, y: y + height },
    { command: 2, x, y: y + height }
  ]
  let offset = 0
  for (const point of points) {
    blob[offset] = point.command
    view.setFloat32(offset + 1, point.x, true)
    view.setFloat32(offset + 5, point.y, true)
    offset += 9
  }
  blob[offset] = 0
  return blob
}

beforeAll(async () => {
  ck = await initCanvasKit()
})

describe('raster export', () => {
  test('keeps one-pixel transparent fringes when trimming exports', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const vector = graph.createNode('VECTOR', page.id, {
      width: 10,
      height: 10,
      fillGeometry: [{ commandsBlob: rectangleCommandsBlob(1, 1, 8, 8) }],
      fills: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true
        }
      ]
    })

    const surface = expectDefined(ck.MakeSurface(1, 1), 'surface')
    const renderer = new SkiaRenderer(ck, surface)

    try {
      const png = expectDefined(
        renderNodesToImage(ck, renderer, graph, page.id, [vector.id], {
          scale: 1,
          format: 'PNG',
          trimTransparent: true
        }),
        'png'
      )
      const image = expectDefined(ck.MakeImageFromEncoded(png), 'image')

      expect(image.width()).toBe(10)
      expect(image.height()).toBe(10)

      image.delete()
    } finally {
      surface.delete()
    }
  })

  test('page exports can trim transparent text padding', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const text = graph.createNode('TEXT', page.id, {
      x: 0,
      y: 0,
      width: 120,
      height: 40,
      text: 'Primitives',
      fontSize: 30,
      lineHeight: 40,
      fills: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true
        }
      ]
    })

    const surface = expectDefined(ck.MakeSurface(1, 1), 'surface')
    const renderer = new SkiaRenderer(ck, surface)
    await renderer.loadFonts()

    try {
      const untrimmed = expectDefined(
        renderNodesToImage(ck, renderer, graph, page.id, [text.id], {
          scale: 1,
          format: 'PNG'
        }),
        'untrimmed png'
      )
      const trimmed = expectDefined(
        renderNodesToImage(ck, renderer, graph, page.id, [text.id], {
          scale: 1,
          format: 'PNG',
          trimTransparent: true
        }),
        'trimmed png'
      )

      const untrimmedImage = expectDefined(ck.MakeImageFromEncoded(untrimmed), 'untrimmed image')
      const trimmedImage = expectDefined(ck.MakeImageFromEncoded(trimmed), 'trimmed image')

      expect(untrimmedImage.height()).toBe(40)
      expect(trimmedImage.height()).toBeLessThan(untrimmedImage.height())
      expect(trimmedImage.width()).toBeLessThan(untrimmedImage.width())

      untrimmedImage.delete()
      trimmedImage.delete()
    } finally {
      surface.delete()
    }
  })

  test('excludes layout grids, margins, and bleed from artwork pixels and bounds', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, {
      width: 100,
      height: 80,
      fills: [
        {
          type: 'SOLID',
          color: { r: 1, g: 1, b: 1, a: 1 },
          opacity: 1,
          visible: true
        }
      ]
    })
    graph.createNode('RECTANGLE', frame.id, {
      x: 20,
      y: 20,
      width: 40,
      height: 30,
      fills: [
        {
          type: 'SOLID',
          color: { r: 0.2, g: 0.4, b: 0.8, a: 1 },
          opacity: 1,
          visible: true
        }
      ]
    })
    const surface = expectDefined(ck.MakeSurface(1, 1), 'surface')
    const renderer = new SkiaRenderer(ck, surface)

    try {
      const withoutGuides = expectDefined(
        renderNodesToImage(ck, renderer, graph, page.id, [frame.id], {
          scale: 1,
          format: 'PNG'
        }),
        'png without guides'
      )
      const settings = structuredClone(DEFAULT_FRAME_GUIDES)
      settings.margins.enabled = true
      settings.bleed.enabled = true
      graph.updateNode(frame.id, {
        pluginData: upsertFrameGuides([], settings),
        source: {
          ...frame.source,
          fig: {
            ...frame.source.fig,
            rawNodeFields: {
              ...frame.source.fig.rawNodeFields,
              layoutGrids: [
                {
                  pattern: 'GRID',
                  visible: true,
                  sectionSize: 10,
                  color: { r: 1, g: 0, b: 0, a: 0.5 }
                }
              ]
            }
          }
        }
      })
      const withGuides = expectDefined(
        renderNodesToImage(ck, renderer, graph, page.id, [frame.id], {
          scale: 1,
          format: 'PNG'
        }),
        'png with guides'
      )

      expect(withGuides).toEqual(withoutGuides)
      const image = expectDefined(ck.MakeImageFromEncoded(withGuides), 'guide-free image')
      expect(image.width()).toBe(100)
      expect(image.height()).toBe(80)
      image.delete()
    } finally {
      surface.delete()
    }
  })
})
