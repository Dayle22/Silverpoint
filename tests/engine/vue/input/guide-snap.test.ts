import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

import { DEFAULT_FRAME_GUIDES, upsertFrameGuides } from '#core/guides/frame'
import { applyMoveSnap } from '#vue/shared/input/move-snap'
import type { DragMove } from '#vue/shared/input/types'

function dragFor(id: string, x: number, y: number): DragMove {
  return {
    type: 'move',
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    startScreenX: 0,
    startScreenY: 0,
    dragStarted: true,
    originals: new Map([[id, { x, y, parentId: '' }]])
  }
}

describe('guide snapping', () => {
  test('snaps selection edges and centres to visible page guides', () => {
    const editor = createEditor()
    editor.addPageGuide('X', 100)
    const id = editor.createShape('RECTANGLE', 83, 20, 10, 10)
    editor.select([id])

    expect(applyMoveSnap(dragFor(id, 83, 20), 3, 0, editor)).toEqual({ dx: 7, dy: 0 })
    editor.state.showRulers = false
    expect(applyMoveSnap(dragFor(id, 83, 20), 3, 0, editor)).toEqual({ dx: 3, dy: 0 })
  })

  test('snaps a frame child to enabled margin edges but ignores disabled guides', () => {
    const editor = createEditor()
    const frameId = editor.createShape('FRAME', 100, 100, 200, 100)
    const childId = editor.createShape('RECTANGLE', 10, 10, 10, 10, frameId)
    const guides = structuredClone(DEFAULT_FRAME_GUIDES)
    guides.margins.enabled = true
    guides.margins.top = 20
    guides.margins.right = 20
    guides.margins.bottom = 20
    guides.margins.left = 20
    editor.updateNode(frameId, { pluginData: upsertFrameGuides([], guides) })
    editor.select([childId])

    expect(applyMoveSnap(dragFor(childId, 10, 10), 8, 0, editor)).toEqual({ dx: 10, dy: 0 })
    guides.margins.enabled = false
    editor.updateNode(frameId, { pluginData: upsertFrameGuides([], guides) })
    expect(applyMoveSnap(dragFor(childId, 10, 10), 8, 0, editor)).toEqual({ dx: 8, dy: 0 })
  })

  test('Ctrl bypass returns raw movement and clears transient feedback', () => {
    const editor = createEditor()
    editor.addPageGuide('X', 100)
    const id = editor.createShape('RECTANGLE', 83, 20, 10, 10)
    editor.select([id])

    expect(applyMoveSnap(dragFor(id, 83, 20), 3, 0, editor)).toEqual({ dx: 7, dy: 0 })
    expect(editor.state.snapGuides.length).toBeGreaterThan(0)
    expect(applyMoveSnap(dragFor(id, 83, 20), 3, 0, editor, true)).toEqual({ dx: 3, dy: 0 })
    expect(editor.state.snapGuides).toEqual([])
  })
})
