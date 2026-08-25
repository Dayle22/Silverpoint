import { describe, expect, test } from 'bun:test'

import type { CanvasKit, Surface } from 'canvaskit-wasm'

import {
  createCanvasSurface,
  type SurfaceColorSpaceSource
} from '#vue/canvas/surface/gl-surface'

type SurfaceCounts = { glCalls: number; swCalls: number }

function createCanvasKit({ gl = true, sw = true }: { gl?: boolean; sw?: boolean } = {}): {
  ck: CanvasKit
  counts: SurfaceCounts
} {
  const surface: Surface = {} as Surface
  const counts: SurfaceCounts = { glCalls: 0, swCalls: 0 }

  const kit: Partial<CanvasKit> = {
    ColorSpace: { SRGB: {}, DISPLAY_P3: {}, ADOBE_RGB: {}, Make: () => ({}) } as CanvasKit['ColorSpace'],
    GetWebGLContext: () => (gl ? 1 : 0),
    MakeGrContext: () => ({ delete: () => undefined }) as ReturnType<CanvasKit['MakeGrContext']>,
    MakeOnScreenGLSurface: () => {
      counts.glCalls++
      return gl ? surface : null
    },
    MakeSWCanvasSurface: () => {
      counts.swCalls++
      return sw ? surface : null
    }
  }

  return { ck: kit as CanvasKit, counts }
}

function createCanvas(): HTMLCanvasElement {
  const canvas: Partial<HTMLCanvasElement> = { width: 800, height: 600, getContext: () => null }
  return canvas as HTMLCanvasElement
}

const editor: SurfaceColorSpaceSource = { graph: { documentColorSpace: 'srgb' } }

describe('createCanvasSurface', () => {
  test('builds a GPU surface when acceleration is requested', () => {
    const { ck, counts } = createCanvasKit()

    const result = createCanvasSurface(ck, createCanvas(), editor, {}, null)

    expect(result.surface).not.toBeNull()
    expect(result.info.backend).toBe('gpu')
    expect(result.info.accelerationRequested).toBe(true)
    expect(counts.swCalls).toBe(0)
  })

  test('defaults to the GPU when no preference is supplied', () => {
    const { ck, counts } = createCanvasKit()

    const result = createCanvasSurface(ck, createCanvas(), editor, undefined, null)

    expect(result.info.backend).toBe('gpu')
    expect(counts.swCalls).toBe(0)
  })

  test('builds a CPU surface when acceleration is declined', () => {
    const { ck, counts } = createCanvasKit()

    const result = createCanvasSurface(ck, createCanvas(), editor, { accelerated: () => false }, null)

    expect(result.surface).not.toBeNull()
    expect(result.info.backend).toBe('cpu')
    expect(result.info.accelerationRequested).toBe(false)
    expect(counts.glCalls).toBe(0)
  })

  test('reports no backend when the GPU surface cannot be created', () => {
    const { ck, counts } = createCanvasKit({ gl: false })

    const result = createCanvasSurface(ck, createCanvas(), editor, {}, null)

    expect(result.surface).toBeNull()
    expect(result.info.backend).toBe('none')
    // A failed GPU attempt must not silently retry on the CPU: the canvas
    // already holds a WebGL context and could not take a 2D one.
    expect(counts.swCalls).toBe(0)
  })

  test('reports no backend when the CPU surface cannot be created', () => {
    const { ck } = createCanvasKit({ sw: false })

    const result = createCanvasSurface(ck, createCanvas(), editor, { accelerated: () => false }, null)

    expect(result.surface).toBeNull()
    expect(result.info.backend).toBe('none')
  })
})
