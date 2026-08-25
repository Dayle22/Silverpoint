import { describe, expect, test } from 'bun:test'

import { DEFAULT_TEXT_HEIGHT, DEFAULT_TEXT_WIDTH } from '@open-pencil/core/constants'
import { createEditor } from '@open-pencil/core/editor'

import {
  cancelTextDraw,
  handleTextDrawMove,
  handleTextDrawUp,
  startTextDraw
} from '#vue/shared/input/draw'
import { MOVE_DRAG_START_THRESHOLD_PX } from '#vue/shared/input/move'
import type { DragState, DragTextDraw } from '#vue/shared/input/types'

function setupTextDraw(
  cx = 50,
  cy = 60,
  sx = 100,
  sy = 120
): {
  editor: ReturnType<typeof createEditor>
  drag: DragTextDraw
  nodeId: string
} {
  const editor = createEditor()
  editor.setTool('TEXT')
  let drag: DragState | null = null
  startTextDraw(cx, cy, sx, sy, editor, (d) => {
    drag = d
  })
  if (!drag || (drag as DragState).type !== 'text-draw') {
    throw new Error('Expected text-draw drag')
  }
  const textDrag = drag as DragTextDraw
  return { editor, drag: textDrag, nodeId: textDrag.nodeId }
}

describe('text-draw gesture', () => {
  test('below-threshold release creates default size box at click point in editing mode', () => {
    const { editor, drag, nodeId } = setupTextDraw(50, 60, 100, 120)

    handleTextDrawMove(
      drag,
      51,
      61,
      100 + MOVE_DRAG_START_THRESHOLD_PX - 1,
      120,
      false,
      editor
    )
    expect(drag.dragStarted).toBe(false)

    handleTextDrawUp(drag, editor)

    const node = editor.graph.getNode(nodeId)
    expect(node?.x).toBe(50)
    expect(node?.y).toBe(60)
    expect(node?.width).toBe(DEFAULT_TEXT_WIDTH)
    expect(node?.height).toBe(DEFAULT_TEXT_HEIGHT)
    expect(node?.text).toBe('')
    expect(node?.textAutoResize).toBe('NONE')
    expect(editor.state.editingTextId).toBe(nodeId)
    expect(editor.state.activeTool).toBe('SELECT')
  })

  test('drag past threshold sizes the text frame to the dragged rectangle', () => {
    const { editor, drag, nodeId } = setupTextDraw(50, 60, 100, 120)

    handleTextDrawMove(drag, 230, 150, 280, 210, false, editor)
    expect(drag.dragStarted).toBe(true)

    handleTextDrawUp(drag, editor)

    const node = editor.graph.getNode(nodeId)
    expect(node?.x).toBe(50)
    expect(node?.y).toBe(60)
    expect(node?.width).toBe(180)
    expect(node?.height).toBe(90)
    expect(node?.text).toBe('')
    expect(node?.textAutoResize).toBe('NONE')
    expect(editor.state.editingTextId).toBe(nodeId)
    expect(editor.state.activeTool).toBe('SELECT')
  })

  test('drag up-and-left moves origin to pointer and keeps positive dimensions', () => {
    const { editor, drag, nodeId } = setupTextDraw(50, 60, 100, 120)

    handleTextDrawMove(drag, 10, 20, 60, 80, false, editor)
    expect(drag.dragStarted).toBe(true)

    handleTextDrawUp(drag, editor)

    const node = editor.graph.getNode(nodeId)
    expect(node?.x).toBe(10)
    expect(node?.y).toBe(20)
    expect(node?.width).toBe(40)
    expect(node?.height).toBe(40)
  })

  test('shiftKey locks square aspect ratio during drag', () => {
    const { editor, drag, nodeId } = setupTextDraw(50, 60, 100, 120)

    handleTextDrawMove(drag, 230, 110, 280, 170, true, editor)
    expect(drag.dragStarted).toBe(true)

    handleTextDrawUp(drag, editor)

    const node = editor.graph.getNode(nodeId)
    expect(node?.width).toBe(180)
    expect(node?.height).toBe(180)
  })

  test('degenerate drag falls back to default text box size', () => {
    const { editor, drag, nodeId } = setupTextDraw(50, 60, 100, 120)

    // Move past screen threshold but canvas coordinates differ by < 2
    handleTextDrawMove(drag, 51, 60.5, 200, 220, false, editor)
    expect(drag.dragStarted).toBe(true)

    handleTextDrawUp(drag, editor)

    const node = editor.graph.getNode(nodeId)
    expect(node?.width).toBe(DEFAULT_TEXT_WIDTH)
    expect(node?.height).toBe(DEFAULT_TEXT_HEIGHT)
  })

  test('single undo step removes created text node, redo restores dragged size', () => {
    const { editor, drag, nodeId } = setupTextDraw(50, 60, 100, 120)

    handleTextDrawMove(drag, 230, 150, 280, 210, false, editor)
    handleTextDrawUp(drag, editor)

    const pageId = editor.state.currentPageId
    expect(editor.graph.getChildren(pageId)).toHaveLength(1)

    editor.undo.undo()
    expect(editor.graph.getChildren(pageId)).toHaveLength(0)

    editor.undo.redo()
    expect(editor.graph.getChildren(pageId)).toHaveLength(1)
    const restored = editor.graph.getNode(nodeId)
    expect(restored?.width).toBe(180)
    expect(restored?.height).toBe(90)
  })

  test('cancelTextDraw leaves no node behind, clears selection, and leaves tool active', () => {
    const { editor, drag } = setupTextDraw(50, 60, 100, 120)

    handleTextDrawMove(drag, 230, 150, 280, 210, false, editor)
    expect(drag.dragStarted).toBe(true)

    cancelTextDraw(drag, editor)

    const pageId = editor.state.currentPageId
    expect(editor.graph.getChildren(pageId)).toHaveLength(0)
    expect(editor.state.selectedIds.size).toBe(0)
    expect(editor.state.activeTool).toBe('TEXT')
  })
})
