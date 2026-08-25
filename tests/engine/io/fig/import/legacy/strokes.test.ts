import { describe, expect, test } from 'bun:test'

import { importNodeChanges } from '@open-pencil/core'

import { expectDefined } from '#tests/helpers/assert'

import { canvas, doc, node } from './helpers'

describe('fig-import: stroke options', () => {
  test('stroke cap and join', () => {
    const graph = importNodeChanges([
      doc(),
      canvas(),
      node('VECTOR', 10, 1, {
        strokePaints: [
          {
            type: 'SOLID',
            color: { r: 0, g: 0, b: 0, a: 1 },
            opacity: 1,
            visible: true,
            blendMode: 'NORMAL'
          }
        ],
        strokeWeight: 3,
        strokeAlign: 'CENTER',
        strokeCap: 'ROUND',
        strokeJoin: 'BEVEL'
      } as Partial<NodeChange>)
    ])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.strokes[0].type).toBe('SOLID')
    expect(n.strokes[0].cap).toBe('ROUND')
    expect(n.strokes[0].join).toBe('BEVEL')
  })

  test('dash pattern', () => {
    const graph = importNodeChanges([
      doc(),
      canvas(),
      node('RECTANGLE', 10, 1, {
        strokePaints: [
          {
            type: 'SOLID',
            color: { r: 0, g: 0, b: 0, a: 1 },
            opacity: 1,
            visible: true,
            blendMode: 'NORMAL'
          }
        ],
        strokeWeight: 2,
        strokeAlign: 'CENTER',
        dashPattern: [10, 5]
      } as Partial<NodeChange>)
    ])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.strokes[0].dashPattern).toEqual([10, 5])
  })

  test('linear gradient stroke', () => {
    const graph = importNodeChanges([
      doc(),
      canvas(),
      node('RECTANGLE', 10, 1, {
        strokePaints: [
          {
            type: 'GRADIENT_LINEAR',
            opacity: 1,
            visible: true,
            blendMode: 'NORMAL',
            stops: [
              { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
              { color: { r: 0, g: 0, b: 1, a: 1 }, position: 1 }
            ],
            transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
          }
        ],
        strokeWeight: 2,
        strokeAlign: 'CENTER'
      } as Partial<NodeChange>)
    ])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.strokes).toHaveLength(1)
    expect(n.strokes[0].type).toBe('GRADIENT_LINEAR')
    expect(n.strokes[0].gradientStops).toHaveLength(2)
    const gradientStops = expectDefined(n.strokes[0].gradientStops, 'linear gradient stroke stops')
    expect(gradientStops[0]?.color.r).toBe(1)
    expect(gradientStops[1]?.color.b).toBe(1)
    expect(n.strokes[0].gradientTransform).toBeDefined()
  })

  test('radial gradient stroke', () => {
    const graph = importNodeChanges([
      doc(),
      canvas(),
      node('ELLIPSE', 10, 1, {
        strokePaints: [
          {
            type: 'GRADIENT_RADIAL',
            opacity: 0.8,
            visible: true,
            blendMode: 'NORMAL',
            stops: [
              { color: { r: 1, g: 1, b: 1, a: 1 }, position: 0 },
              { color: { r: 0, g: 0, b: 0, a: 1 }, position: 1 }
            ],
            transform: { m00: 0.5, m01: 0, m02: 0.5, m10: 0, m11: 0.5, m12: 0.5 }
          }
        ],
        strokeWeight: 4,
        strokeAlign: 'INSIDE'
      } as Partial<NodeChange>)
    ])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.strokes).toHaveLength(1)
    expect(n.strokes[0].type).toBe('GRADIENT_RADIAL')
    expect(n.strokes[0].opacity).toBe(0.8)
    expect(n.strokes[0].weight).toBe(4)
    expect(n.strokes[0].align).toBe('INSIDE')
    expect(n.strokes[0].gradientStops).toHaveLength(2)
    const gradientStops = expectDefined(n.strokes[0].gradientStops, 'radial gradient stroke stops')
    expect(gradientStops[0]?.color.r).toBe(1)
    expect(gradientStops[1]?.color.r).toBe(0)
    expect(n.strokes[0].gradientTransform).toBeDefined()
  })
})
