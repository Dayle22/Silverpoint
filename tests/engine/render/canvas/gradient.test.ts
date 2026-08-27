import { beforeAll, describe, expect, test } from 'bun:test'

import { SceneGraph, SkiaRenderer } from '@open-pencil/core'
import type { SceneNode, Stroke } from '@open-pencil/scene-graph'

import { initCanvasKit } from '#cli/headless'
import { linearGradientEndpoints } from '#core/canvas/fills'
import { applyStrokePaint, releaseStrokeShader, setStrokeShader } from '#core/canvas/strokes'

import { expectDefined } from '#tests/helpers/assert'

let ck: Awaited<ReturnType<typeof initCanvasKit>>

beforeAll(async () => {
  ck = await initCanvasKit()
})

describe('canvas gradients', () => {
  test('maps figma linear gradient start color to transformed x-axis endpoint', () => {
    const endpoints = linearGradientEndpoints(188, 270, {
      m00: 0,
      m01: 1,
      m02: 0,
      m10: -1,
      m11: 0,
      m12: 1
    })

    expect(endpoints.start).toEqual({ x: 0, y: 0 })
    expect(endpoints.end).toEqual({ x: 0, y: 270 })
  })

  test('applies and releases stroke gradient shaders on SkiaRenderer', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('RECTANGLE', page.id, {
      width: 100,
      height: 100,
      strokes: [
        {
          type: 'GRADIENT_LINEAR',
          color: { r: 1, g: 0, b: 0, a: 1 },
          weight: 4,
          opacity: 1,
          visible: true,
          align: 'CENTER',
          gradientStops: [
            { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
            { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
          ],
          gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
        }
      ]
    })

    const surface = expectDefined(ck.MakeSurface(100, 100), 'surface')
    const renderer = new SkiaRenderer(ck, surface)

    try {
      const stroke = node.strokes[0]
      applyStrokePaint(renderer, stroke, node, graph)
      expect(renderer.activeStrokeShader).not.toBeNull()

      // Solid stroke should release the gradient shader
      const solidStroke: Stroke = {
        type: 'SOLID',
        color: { r: 0, g: 1, b: 0, a: 1 },
        weight: 2,
        opacity: 1,
        visible: true,
        align: 'CENTER'
      }
      applyStrokePaint(renderer, solidStroke, node, graph)
      expect(renderer.activeStrokeShader).toBeNull()

      // Re-apply gradient then explicitly release
      applyStrokePaint(renderer, stroke, node, graph)
      expect(renderer.activeStrokeShader).not.toBeNull()
      releaseStrokeShader(renderer)
      expect(renderer.activeStrokeShader).toBeNull()
    } finally {
      renderer.destroy()
    }
  })

  test('renders shapes and sections with gradient strokes', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const rect = graph.createNode('RECTANGLE', page.id, {
      width: 80,
      height: 80,
      strokes: [
        {
          type: 'GRADIENT_LINEAR',
          color: { r: 1, g: 0, b: 0, a: 1 },
          weight: 4,
          opacity: 1,
          visible: true,
          align: 'INSIDE',
          gradientStops: [
            { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
            { position: 1, color: { r: 0, g: 1, b: 0, a: 1 } }
          ],
          gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
        }
      ]
    })

    const surface = expectDefined(ck.MakeSurface(100, 100), 'surface')
    const renderer = new SkiaRenderer(ck, surface)
    const canvas = surface.getCanvas()

    try {
      renderer.renderShape(canvas, rect, graph)
      expect(renderer.activeStrokeShader).toBeNull()
    } finally {
      renderer.destroy()
    }
  })
})
