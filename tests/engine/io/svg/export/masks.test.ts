import { describe, expect, test } from 'bun:test'

import { exportSVGOrThrow, makeGraph, pageId } from './helpers'

const WHITE_FILL = [
  { type: 'SOLID' as const, color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }
]

describe('renderNodesToSVG() masks', () => {
  test('wraps masked siblings in a native SVG mask for ALPHA masks', () => {
    const graph = makeGraph()
    const frame = graph.createNode('FRAME', pageId(graph), { width: 100, height: 100 })
    const mask = graph.createNode('ELLIPSE', frame.id, {
      width: 60,
      height: 60,
      isMask: true,
      maskType: 'ALPHA',
      fills: WHITE_FILL
    })
    graph.createNode('RECTANGLE', frame.id, {
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 }, opacity: 1, visible: true }]
    })

    const result = exportSVGOrThrow(graph, [frame.id])

    expect(result).toContain('<mask id="mask')
    expect(result).toContain('mask="url(#mask')
    expect(result).toContain('<ellipse')
    expect(result).not.toContain(`id="${mask.id}"`)
  })

  test('uses a clipPath for VECTOR masks', () => {
    const graph = makeGraph()
    const frame = graph.createNode('FRAME', pageId(graph), { width: 100, height: 100 })
    graph.createNode('ELLIPSE', frame.id, {
      width: 60,
      height: 60,
      isMask: true,
      maskType: 'VECTOR',
      fills: WHITE_FILL
    })
    graph.createNode('RECTANGLE', frame.id, {
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 0, g: 1, b: 0, a: 1 }, opacity: 1, visible: true }]
    })

    const result = exportSVGOrThrow(graph, [frame.id])

    expect(result).toContain('<clipPath id="mask-clip')
    expect(result).toContain('clip-path="url(#mask-clip')
    expect(result).not.toContain('<mask id=')
  })

  test('does not mask when the mask layer is hidden', () => {
    const graph = makeGraph()
    const frame = graph.createNode('FRAME', pageId(graph), { width: 100, height: 100 })
    graph.createNode('ELLIPSE', frame.id, {
      width: 60,
      height: 60,
      isMask: true,
      visible: false,
      fills: WHITE_FILL
    })
    graph.createNode('RECTANGLE', frame.id, {
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 0, a: 1 }, opacity: 1, visible: true }]
    })

    const result = exportSVGOrThrow(graph, [frame.id])

    expect(result).not.toContain('<mask')
    expect(result).not.toContain('<clipPath')
    expect(result).toContain('fill="#FFFF00"')
  })

  test('combines consecutive mask layers into one mask definition', () => {
    const graph = makeGraph()
    const frame = graph.createNode('FRAME', pageId(graph), { width: 100, height: 100 })
    graph.createNode('ELLIPSE', frame.id, { width: 40, height: 40, isMask: true, fills: WHITE_FILL })
    graph.createNode('RECTANGLE', frame.id, {
      width: 20,
      height: 20,
      isMask: true,
      fills: WHITE_FILL
    })
    graph.createNode('RECTANGLE', frame.id, {
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 1, a: 1 }, opacity: 1, visible: true }]
    })

    const result = exportSVGOrThrow(graph, [frame.id])

    expect(result.match(/<mask id="mask\d/g)?.length).toBe(1)
    expect(result).toContain('<ellipse')
    expect(result).toContain('<rect')
  })

  test('an unmasked rectangle before the mask renders outside the mask group', () => {
    const graph = makeGraph()
    const frame = graph.createNode('FRAME', pageId(graph), { width: 100, height: 100 })
    graph.createNode('RECTANGLE', frame.id, {
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    graph.createNode('ELLIPSE', frame.id, { width: 40, height: 40, isMask: true, fills: WHITE_FILL })
    graph.createNode('RECTANGLE', frame.id, {
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 1, a: 1 }, opacity: 1, visible: true }]
    })

    const result = exportSVGOrThrow(graph, [frame.id])

    expect(result.match(/<mask id="mask\d/g)?.length).toBe(1)
    expect(result).toContain('fill="#000000"')
  })
})
