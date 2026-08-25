import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

import {
  applySpacingDrag,
  cancelSpacingDrag,
  commitSpacingDrag,
  tryStartSpacingDrag
} from '#vue/shared/input/spacing-drag'

function setupFrame(layoutMode: 'HORIZONTAL' | 'VERTICAL', itemSpacing = 8) {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const frame = editor.graph.createNode('FRAME', pageId, {
    name: 'Auto-layout frame',
    x: 100,
    y: 100,
    width: 280,
    height: 160,
    layoutMode,
    itemSpacing,
    paddingTop: 20,
    paddingRight: 20,
    paddingBottom: 20,
    paddingLeft: 20
  })
  // Explicit local positions (matching what an itemSpacing-8 auto-layout run
  // would produce), rather than relying on graph.createNode to run layout.
  const isRow = layoutMode === 'HORIZONTAL'
  editor.graph.createNode('RECTANGLE', frame.id, {
    name: 'Child 1',
    x: isRow ? 20 : 20,
    y: isRow ? 20 : 20,
    width: 60,
    height: 40
  })
  editor.graph.createNode('RECTANGLE', frame.id, {
    name: 'Child 2',
    x: isRow ? 20 + 60 + itemSpacing : 20,
    y: isRow ? 20 : 20 + 40 + itemSpacing,
    width: 60,
    height: 40
  })
  editor.select([frame.id])
  return { editor, frame }
}

describe('spacing-drag lifecycle', () => {
  test('tryStartSpacingDrag records the axis-matching start cursor', () => {
    const { editor, frame } = setupFrame('VERTICAL')
    // Vertical frame: children stack at local y 20 (h40) then 68 (h40, gap 8).
    // Gap boundary spans local y 60-68 -> absolute y 160-168, midpoint 164.
    const drag = tryStartSpacingDrag(150, 164, editor)
    expect(drag).not.toBeNull()
    expect(drag?.type).toBe('spacing-drag')
    expect(drag?.axis).toBe('VERTICAL')
    expect(drag?.nodeId).toBe(frame.id)
    expect(drag?.startCursor).toBe(164)
    expect(drag?.original).toBe(8)
  })

  test('horizontal-axis drag delta only reacts to cx, not cy', () => {
    const { editor, frame } = setupFrame('HORIZONTAL')
    // Horizontal frame: children at local x 20 (w60) then 88 (w60, gap 8).
    // Gap spans local x 80-88 -> absolute x 180-188, midpoint 184.
    const drag = tryStartSpacingDrag(184, 140, editor)
    expect(drag).not.toBeNull()
    if (!drag) throw new Error('expected drag')

    applySpacingDrag(drag, 194, 999, editor)
    expect(editor.graph.getNode(frame.id)?.itemSpacing).toBe(18)

    applySpacingDrag(drag, 184, -999, editor)
    expect(editor.graph.getNode(frame.id)?.itemSpacing).toBe(8)
  })

  test('vertical-axis drag delta only reacts to cy, not cx', () => {
    const { editor, frame } = setupFrame('VERTICAL')
    const drag = tryStartSpacingDrag(150, 164, editor)
    expect(drag).not.toBeNull()
    if (!drag) throw new Error('expected drag')

    applySpacingDrag(drag, 999, 174, editor)
    expect(editor.graph.getNode(frame.id)?.itemSpacing).toBe(18)

    applySpacingDrag(drag, -999, 164, editor)
    expect(editor.graph.getNode(frame.id)?.itemSpacing).toBe(8)
  })

  test('negative delta clamps itemSpacing at 0', () => {
    const { editor, frame } = setupFrame('VERTICAL')
    const drag = tryStartSpacingDrag(150, 164, editor)
    expect(drag).not.toBeNull()
    if (!drag) throw new Error('expected drag')

    applySpacingDrag(drag, 150, 164 - 100, editor)
    expect(editor.graph.getNode(frame.id)?.itemSpacing).toBe(0)
  })

  test('commit issues exactly one updateNodeWithUndo call and one undo entry', () => {
    const { editor, frame } = setupFrame('VERTICAL')
    const drag = tryStartSpacingDrag(150, 164, editor)
    expect(drag).not.toBeNull()
    if (!drag) throw new Error('expected drag')

    applySpacingDrag(drag, 150, 184, editor)
    expect(editor.graph.getNode(frame.id)?.itemSpacing).toBe(28)

    const undoDepthBefore = editor.undo.undoDepth

    commitSpacingDrag(drag, editor)
    expect(editor.graph.getNode(frame.id)?.itemSpacing).toBe(28)
    expect(editor.undo.undoDepth).toBe(undoDepthBefore + 1)

    editor.undo.undo()
    expect(editor.graph.getNode(frame.id)?.itemSpacing).toBe(8)
  })

  test('commit is a no-op (skips undo) when the final value equals the original', () => {
    const { editor, frame } = setupFrame('VERTICAL')
    const drag = tryStartSpacingDrag(150, 164, editor)
    expect(drag).not.toBeNull()
    if (!drag) throw new Error('expected drag')

    // No movement: applySpacingDrag never called, itemSpacing stays original.
    const undoDepthBefore = editor.undo.undoDepth
    commitSpacingDrag(drag, editor)
    expect(editor.graph.getNode(frame.id)?.itemSpacing).toBe(8)
    expect(editor.undo.undoDepth).toBe(undoDepthBefore)
  })

  test('cancel restores the original value without touching undo', () => {
    const { editor, frame } = setupFrame('VERTICAL')
    const drag = tryStartSpacingDrag(150, 164, editor)
    expect(drag).not.toBeNull()
    if (!drag) throw new Error('expected drag')

    applySpacingDrag(drag, 150, 184, editor)
    expect(editor.graph.getNode(frame.id)?.itemSpacing).toBe(28)

    const undoDepthBefore = editor.undo.undoDepth
    cancelSpacingDrag(drag, editor)
    expect(editor.graph.getNode(frame.id)?.itemSpacing).toBe(8)
    expect(editor.undo.undoDepth).toBe(undoDepthBefore)
  })

  test('tryStartSpacingDrag returns null off the gap marker', () => {
    const { editor } = setupFrame('VERTICAL')
    expect(tryStartSpacingDrag(150, 130, editor)).toBeNull()
  })

  test('tryStartSpacingDrag returns null for a non-auto-layout selection', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const rect = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Plain rect',
      x: 0,
      y: 0,
      width: 100,
      height: 100
    })
    editor.select([rect.id])
    expect(tryStartSpacingDrag(50, 50, editor)).toBeNull()
  })
})
