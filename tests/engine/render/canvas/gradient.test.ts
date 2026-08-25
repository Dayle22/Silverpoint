import { beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test'

import { initCanvasKit } from '#cli/headless'
import { linearGradientEndpoints } from '#core/canvas/fills'
import { getGradientGeometry } from '#core/canvas/overlays/gradient'
import { applyStrokePaint, releaseStrokeShader } from '#core/canvas/strokes'
import { SkiaRenderer } from '#core/canvas/renderer'
import { SceneGraph } from '@open-pencil/scene-graph'
import { HEAVY_TEST_TIMEOUT_MS } from '#tests/helpers/test-utils'

setDefaultTimeout(HEAVY_TEST_TIMEOUT_MS)

let ck: Awaited<ReturnType<typeof initCanvasKit>>

beforeAll(async () => {
  ck = await initCanvasKit()
}, 60_000)

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

  test('computes gradient geometry for linear gradient', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', graph.rootId, {
      name: 'Rect',
      width: 200,
      height: 100,
      fills: [
        {
          type: 'GRADIENT_LINEAR',
          color: { r: 1, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 0, m12: 0.5 },
          gradientStops: [
            { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
            { color: { r: 0, g: 0, b: 1, a: 1 }, position: 1 }
          ]
        }
      ]
    })

    const geo = getGradientGeometry(node, node.fills[0])
    expect(geo.start).toEqual({ x: 200, y: 50 })
    expect(geo.end).toEqual({ x: 0, y: 50 })
    expect(geo.stops.length).toBe(2)
  })

  test('computes gradient geometry for radial gradient', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('ELLIPSE', graph.rootId, {
      name: 'Circle',
      width: 100,
      height: 100,
      fills: [
        {
          type: 'GRADIENT_RADIAL',
          color: { r: 1, g: 1, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          gradientTransform: { m00: 0.5, m01: 0, m02: 0.5, m10: 0, m11: 0.5, m12: 0.5 },
          gradientStops: [
            { color: { r: 1, g: 1, b: 0, a: 1 }, position: 0 },
            { color: { r: 0, g: 1, b: 0, a: 1 }, position: 1 }
          ]
        }
      ]
    })

    const geo = getGradientGeometry(node, node.fills[0])
    expect(geo.start).toEqual({ x: 50, y: 50 })
    expect(geo.end).toEqual({ x: 100, y: 50 })
  })

  test('applyStrokePaint manages activeStrokeShader lifecycle across solid and gradient strokes', () => {
    const surface = ck.MakeSurface(200, 200)
    if (!surface) throw new Error('Surface creation failed')
    const renderer = new SkiaRenderer(ck, surface)

    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', graph.rootId, {
      name: 'Rect',
      width: 200,
      height: 100,
      strokes: [
        {
          type: 'GRADIENT_LINEAR',
          color: { r: 1, g: 0, b: 0, a: 1 },
          weight: 2,
          opacity: 1,
          visible: true,
          align: 'CENTER',
          gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 0, m12: 0.5 },
          gradientStops: [
            { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
            { color: { r: 0, g: 0, b: 1, a: 1 }, position: 1 }
          ]
        }
      ]
    })

    // 1. Gradient stroke sets activeStrokeShader
    applyStrokePaint(renderer, node.strokes[0], node, graph, 0)
    expect(renderer.activeStrokeShader).not.toBeNull()

    // 2. Applying solid stroke releases activeStrokeShader
    const solidStroke = {
      type: 'SOLID' as const,
      color: { r: 0, g: 1, b: 0, a: 1 },
      weight: 1,
      opacity: 1,
      visible: true,
      align: 'CENTER' as const
    }
    applyStrokePaint(renderer, solidStroke, node, graph, 0)
    expect(renderer.activeStrokeShader).toBeNull()

    // 3. Applying radial gradient creates new shader
    const radialStroke = {
      type: 'GRADIENT_RADIAL' as const,
      color: { r: 1, g: 1, b: 0, a: 1 },
      weight: 2,
      opacity: 1,
      visible: true,
      align: 'CENTER' as const,
      gradientTransform: { m00: 0.5, m01: 0, m02: 0.5, m10: 0, m11: 0.5, m12: 0.5 },
      gradientStops: [
        { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
        { color: { r: 0, g: 0, b: 1, a: 1 }, position: 1 }
      ]
    }
    applyStrokePaint(renderer, radialStroke, node, graph, 0)
    expect(renderer.activeStrokeShader).not.toBeNull()

    // 4. releaseStrokeShader cleans up
    releaseStrokeShader(renderer)
    expect(renderer.activeStrokeShader).toBeNull()

    // 5. Angular gradient stroke
    const angularStroke = {
      type: 'GRADIENT_ANGULAR' as const,
      color: { r: 1, g: 1, b: 0, a: 1 },
      weight: 2,
      opacity: 1,
      visible: true,
      align: 'CENTER' as const,
      gradientTransform: { m00: 0.5, m01: 0, m02: 0.5, m10: 0, m11: 0.5, m12: 0.5 },
      gradientStops: [
        { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
        { color: { r: 0, g: 0, b: 1, a: 1 }, position: 1 }
      ]
    }
    applyStrokePaint(renderer, angularStroke, node, graph, 0)
    expect(renderer.activeStrokeShader).not.toBeNull()

    // 6. destroyRenderer cleans up active stroke shader without leaking or crashing
    renderer.destroy()
    expect(renderer.activeStrokeShader).toBeNull()
  })

  test('renders regular rectangle and section with linear gradient stroke', () => {
    const surface = ck.MakeSurface(300, 300)
    if (!surface) throw new Error('Surface creation failed')
    const renderer = new SkiaRenderer(ck, surface)

    const graph = new SceneGraph()
    const rectNode = graph.createNode('RECTANGLE', graph.rootId, {
      name: 'RectWithGradientStroke',
      x: 10,
      y: 10,
      width: 100,
      height: 80,
      cornerRadius: 8,
      strokes: [
        {
          type: 'GRADIENT_LINEAR',
          color: { r: 1, g: 0, b: 0, a: 1 },
          weight: 4,
          opacity: 1,
          visible: true,
          align: 'CENTER',
          gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 0, m12: 0.5 },
          gradientStops: [
            { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
            { color: { r: 0, g: 0, b: 1, a: 1 }, position: 1 }
          ]
        }
      ]
    })

    const sectionNode = graph.createNode('SECTION', graph.rootId, {
      name: 'SectionWithGradientStroke',
      x: 120,
      y: 10,
      width: 150,
      height: 120,
      strokes: [
        {
          type: 'GRADIENT_RADIAL',
          color: { r: 1, g: 1, b: 0, a: 1 },
          weight: 2,
          opacity: 1,
          visible: true,
          align: 'INSIDE',
          gradientTransform: { m00: 0.5, m01: 0, m02: 0.5, m10: 0, m11: 0.5, m12: 0.5 },
          gradientStops: [
            { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
            { color: { r: 0, g: 1, b: 0, a: 1 }, position: 1 }
          ]
        }
      ]
    })

    const canvas = surface.getCanvas()
    renderer.renderShapeUncached(canvas, rectNode, graph)
    expect(renderer.activeStrokeShader).toBeNull()

    renderer.renderSection(canvas, sectionNode, graph)
    expect(renderer.activeStrokeShader).toBeNull()

    renderer.destroy()
  })

  test('renders shape with curved gradient fill without leaking activeFillShader', () => {
    const surface = ck.MakeSurface(300, 300)
    if (!surface) throw new Error('Surface creation failed')
    const renderer = new SkiaRenderer(ck, surface)

    const graph = new SceneGraph()
    const curvedRect = graph.createNode('RECTANGLE', graph.rootId, {
      name: 'RectWithCurvedGradientFill',
      x: 10,
      y: 10,
      width: 200,
      height: 150,
      cornerRadius: 12,
      fills: [
        {
          type: 'GRADIENT_CURVED',
          color: { r: 1, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 0, m12: 0.5 },
          gradientSpine: [
            { t: 0.5, offset: 0.3 }
          ],
          gradientStops: [
            { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
            { color: { r: 0, g: 0, b: 1, a: 1 }, position: 1 }
          ]
        }
      ]
    })

    const canvas = surface.getCanvas()
    renderer.renderShapeUncached(canvas, curvedRect, graph)
    expect(renderer.activeFillShader).toBeNull()

    renderer.destroy()
  })
})
