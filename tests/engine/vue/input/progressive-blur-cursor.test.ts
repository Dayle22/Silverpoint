import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { HANDLE_HIT_RADIUS } from '@open-pencil/core/constants'
import type { Effect } from '@open-pencil/scene-graph'

import {
  getProgressiveBlurHandlePosition
} from '#vue/shared/input/progressive-blur'
import {
  getProgressiveBlurCursorForSelection,
  updateHoverCursor
} from '#vue/shared/input/select/hover'
import type { HitTestFns } from '#vue/shared/input/select'

const dummyHitFns: HitTestFns = {
  hitTestInScope: () => null,
  isInsideContainerBounds: () => false,
  hitTestSectionTitle: () => null,
  hitTestComponentLabel: () => null,
  hitTestFrameTitle: () => null
}

function progressiveBlurEffect(overrides: Partial<Effect> = {}): Effect {
  return {
    type: 'LAYER_BLUR',
    blurType: 'PROGRESSIVE',
    color: { r: 0, g: 0, b: 0, a: 1 },
    offset: { x: 0, y: 0 },
    radius: 40,
    startRadius: 0,
    startOffset: { x: 0.2, y: 0.2 },
    endOffset: { x: 0.8, y: 0.8 },
    spread: 0,
    visible: true,
    ...overrides
  } as Effect
}

describe('progressive-blur cursor resolver', () => {
  test('returns grab when hovering inside start and end handle hit circles', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const effect = progressiveBlurEffect()
    const node = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Box',
      x: 100,
      y: 100,
      width: 200,
      height: 150,
      effects: [effect]
    })
    editor.select([node.id])
    editor.state.progressiveBlurEdit = { nodeId: node.id, effectIndex: 0 }

    for (const end of ['start', 'end'] as const) {
      const pos = getProgressiveBlurHandlePosition(node, effect, editor.graph, end)
      expect(getProgressiveBlurCursorForSelection(pos.x, pos.y, editor)).toBe('grab')
      expect(updateHoverCursor(pos.x, pos.y, editor, dummyHitFns)).toBe('grab')
    }
  })

  test('returns null when progressiveBlurEdit is not active', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const effect = progressiveBlurEffect()
    const node = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Box',
      x: 100,
      y: 100,
      width: 200,
      height: 150,
      effects: [effect]
    })
    editor.select([node.id])
    // progressiveBlurEdit is null by default
    const pos = getProgressiveBlurHandlePosition(node, effect, editor.graph, 'start')

    expect(getProgressiveBlurCursorForSelection(pos.x, pos.y, editor)).toBeNull()
  })

  test('returns null when pointer is outside both endpoints', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const effect = progressiveBlurEffect()
    const node = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Box',
      x: 100,
      y: 100,
      width: 200,
      height: 150,
      effects: [effect]
    })
    editor.select([node.id])
    editor.state.progressiveBlurEdit = { nodeId: node.id, effectIndex: 0 }

    const pos = getProgressiveBlurHandlePosition(node, effect, editor.graph, 'start')
    const outsideX = pos.x + HANDLE_HIT_RADIUS + 2
    const outsideY = pos.y + HANDLE_HIT_RADIUS + 2

    expect(getProgressiveBlurCursorForSelection(outsideX, outsideY, editor)).toBeNull()
  })

  test('respects zoom compensation for handle hit radius', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const effect = progressiveBlurEffect()
    const node = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Box',
      x: 100,
      y: 100,
      width: 200,
      height: 150,
      effects: [effect]
    })
    editor.select([node.id])
    editor.state.progressiveBlurEdit = { nodeId: node.id, effectIndex: 0 }
    Object.defineProperty(editor, 'renderer', { value: { zoom: 2 }, configurable: true })

    const pos = getProgressiveBlurHandlePosition(node, effect, editor.graph, 'start')
    // Within the zoom=2 hit radius (8 / 2 = 4px)
    expect(getProgressiveBlurCursorForSelection(pos.x + 2, pos.y, editor)).toBe('grab')
    // Outside the zoom=2 hit radius (e.g. 5px away)
    expect(getProgressiveBlurCursorForSelection(pos.x + 5, pos.y, editor)).toBeNull()
  })

  test('returns null when node is locked or effect is hidden', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const effect = progressiveBlurEffect({ visible: false })
    const node = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Box',
      x: 100,
      y: 100,
      width: 200,
      height: 150,
      effects: [effect]
    })
    editor.select([node.id])
    editor.state.progressiveBlurEdit = { nodeId: node.id, effectIndex: 0 }

    const pos = getProgressiveBlurHandlePosition(node, effect, editor.graph, 'start')
    expect(getProgressiveBlurCursorForSelection(pos.x, pos.y, editor)).toBeNull()

    // Now make effect visible, but lock node
    node.effects[0].visible = true
    node.locked = true
    expect(getProgressiveBlurCursorForSelection(pos.x, pos.y, editor)).toBeNull()
  })

  test('progressive blur cursor takes precedence over radius cursor in updateHoverCursor', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    // Position start handle at top-left corner (0, 0)
    const effect = progressiveBlurEffect({ startOffset: { x: 0, y: 0 } })
    const node = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Box',
      x: 100,
      y: 100,
      width: 200,
      height: 150,
      effects: [effect]
    })
    editor.select([node.id])
    editor.state.progressiveBlurEdit = { nodeId: node.id, effectIndex: 0 }

    const blurPos = getProgressiveBlurHandlePosition(node, effect, editor.graph, 'start')
    expect(updateHoverCursor(blurPos.x, blurPos.y, editor, dummyHitFns)).toBe('grab')
  })
})
