import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { HANDLE_HIT_RADIUS } from '@open-pencil/core/constants'

import { getRadiusControlPosition } from '#vue/shared/input/radius'
import { getRadiusCursorForSelection, updateHoverCursor } from '#vue/shared/input/select/hover'
import type { HitTestFns } from '#vue/shared/input/select'

const dummyHitFns: HitTestFns = {
  hitTestInScope: () => null,
  isInsideContainerBounds: () => false,
  hitTestSectionTitle: () => null,
  hitTestComponentLabel: () => null,
  hitTestFrameTitle: () => null
}

describe('radius cursor resolver', () => {
  test('returns grab when hovering inside a corner-radius handle hit circle', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const node = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Box',
      x: 100,
      y: 100,
      width: 200,
      height: 150
    })
    editor.select([node.id])

    for (const corner of ['nw', 'ne', 'se', 'sw'] as const) {
      const pos = getRadiusControlPosition(node, editor.graph, corner, 1)
      expect(getRadiusCursorForSelection(pos.x, pos.y, editor)).toBe('grab')
      expect(updateHoverCursor(pos.x, pos.y, editor, dummyHitFns)).toBe('grab')
    }
  })

  test('returns null when pointer is outside the handle hit radius', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const node = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Box',
      x: 100,
      y: 100,
      width: 200,
      height: 150
    })
    editor.select([node.id])

    const pos = getRadiusControlPosition(node, editor.graph, 'nw', 1)
    const outsideX = pos.x + HANDLE_HIT_RADIUS + 2
    const outsideY = pos.y + HANDLE_HIT_RADIUS + 2

    expect(getRadiusCursorForSelection(outsideX, outsideY, editor)).toBeNull()
  })

  test('respects zoom compensation for handle hit radius', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const node = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Box',
      x: 100,
      y: 100,
      width: 200,
      height: 150
    })
    editor.select([node.id])
    Object.defineProperty(editor, 'renderer', { value: { zoom: 2 }, configurable: true })

    const pos = getRadiusControlPosition(node, editor.graph, 'nw', 2)
    // Within the zoom=2 hit radius (8 / 2 = 4px)
    expect(getRadiusCursorForSelection(pos.x + 2, pos.y, editor)).toBe('grab')
    // Outside the zoom=2 hit radius (e.g. 5px away)
    expect(getRadiusCursorForSelection(pos.x + 5, pos.y, editor)).toBeNull()
  })

  test('returns null when node is locked', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const node = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Box',
      x: 100,
      y: 100,
      width: 200,
      height: 150,
      locked: true
    })
    editor.select([node.id])

    const pos = getRadiusControlPosition(node, editor.graph, 'nw', 1)
    expect(getRadiusCursorForSelection(pos.x, pos.y, editor)).toBeNull()
  })

  test('returns null for node types that do not support corner radius', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const node = editor.graph.createNode('TEXT', pageId, {
      name: 'Label',
      x: 100,
      y: 100,
      width: 200,
      height: 50,
      text: 'Hello'
    })
    editor.select([node.id])

    expect(getRadiusCursorForSelection(100, 100, editor)).toBeNull()
  })
})
