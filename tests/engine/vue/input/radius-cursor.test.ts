import { beforeAll, describe, expect, test } from 'bun:test'

import { SceneGraph, SkiaRenderer } from '@open-pencil/core'
import { drawRadiusHandles } from '@open-pencil/core/canvas/overlays'
import { createEditor } from '@open-pencil/core/editor'

import { initCanvasKit } from '#cli/headless'
import { getRadiusCursorForSelection, updateHoverCursor } from '#vue/shared/input/select/hover'

import { expectDefined } from '#tests/helpers/assert'

let ck: Awaited<ReturnType<typeof initCanvasKit>>

beforeAll(async () => {
  ck = await initCanvasKit()
})

describe('On-Canvas Radius Cursor & Overlay', () => {
  test('updateHoverCursor and getRadiusCursorForSelection return grab cursor when hovering radius handles', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const editor = createEditor({ graph })

    const node = graph.createNode('RECTANGLE', page.id, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      cornerRadius: 20
    })

    editor.select([node.id])

    const hitFns = {
      hitTestInScope: () => null,
      hitTestSectionTitle: () => null,
      hitTestComponentLabel: () => null
    }

    // NW handle at (20, 20)
    const cursorNW = updateHoverCursor(20, 20, editor, hitFns)
    expect(cursorNW).toBe('grab')
    expect(getRadiusCursorForSelection(20, 20, editor)).toBe('grab')

    // NE handle at (80, 20)
    const cursorNE = updateHoverCursor(80, 20, editor, hitFns)
    expect(cursorNE).toBe('grab')

    // Miss far away
    const cursorMiss = updateHoverCursor(500, 500, editor, hitFns)
    expect(cursorMiss).toBeNull()
    expect(getRadiusCursorForSelection(500, 500, editor)).toBeNull()
  })

  test('getRadiusCursorForSelection returns null when node is locked or multi-selected', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const editor = createEditor({ graph })

    const node1 = graph.createNode('RECTANGLE', page.id, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      cornerRadius: 20
    })
    const node2 = graph.createNode('RECTANGLE', page.id, {
      x: 200,
      y: 0,
      width: 100,
      height: 100,
      cornerRadius: 20
    })

    editor.select([node1.id, node2.id])
    expect(getRadiusCursorForSelection(20, 20, editor)).toBeNull()

    editor.select([node1.id])
    graph.updateNode(node1.id, { locked: true })
    expect(getRadiusCursorForSelection(20, 20, editor)).toBeNull()
  })

  test('drawRadiusHandles renders on canvas without throwing', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]

    const node = graph.createNode('RECTANGLE', page.id, {
      width: 100,
      height: 100,
      cornerRadius: 15
    })

    const surface = expectDefined(ck.MakeSurface(200, 200), 'surface')
    const renderer = new SkiaRenderer(ck, surface)
    const canvas = surface.getCanvas()

    try {
      expect(() => {
        drawRadiusHandles(renderer, canvas, node)
      }).not.toThrow()

      const independentNode = graph.createNode('FRAME', page.id, {
        width: 120,
        height: 120,
        independentCorners: true,
        topLeftRadius: 10,
        topRightRadius: 20,
        bottomRightRadius: 30,
        bottomLeftRadius: 40
      })

      expect(() => {
        drawRadiusHandles(renderer, canvas, independentNode)
      }).not.toThrow()
    } finally {
      renderer.destroy()
    }
  })
})
