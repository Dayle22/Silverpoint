import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, fitTextBoxToContent } from '@open-pencil/core/editor'
import { setTextMeasurer } from '@open-pencil/core/layout'
import { commitResizePreview, tryStartResize } from '#vue/shared/input/resize'

import { getNodeOrThrow } from '#tests/helpers/assert'

afterEach(() => {
  setTextMeasurer(null)
})

describe('text resize handle double-click fit-to-content', () => {
  test('tryStartResize identifies corner handle on selected text node and fitTextBoxToContent resizes box', () => {
    setTextMeasurer(() => ({ width: 120, height: 32 }))

    const editor = createEditor()
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      x: 100,
      y: 100,
      width: 400,
      height: 300,
      text: 'Double click me',
      textAutoResize: 'NONE'
    })
    editor.select([text.id])

    // Hit the southeast corner handle (x: 500, y: 400)
    const resizeHit = tryStartResize(500, 400, editor)
    expect(resizeHit).not.toBeNull()
    expect(resizeHit?.nodeId).toBe(text.id)
    expect(resizeHit?.handle).toBe('se')
    if (!resizeHit) throw new Error('Expected resizeHit')

    const node = editor.graph.getNode(resizeHit.nodeId)
    expect(node?.type).toBe('TEXT')

    fitTextBoxToContent(resizeHit.nodeId, editor)

    const fitted = getNodeOrThrow(editor.graph, text.id)
    expect(fitted.width).toBe(120)
    expect(fitted.height).toBe(32)
    expect(fitted.textAutoResize).toBe('NONE')

    editor.undo.undo()
    const undone = getNodeOrThrow(editor.graph, text.id)
    expect(undone.width).toBe(400)
    expect(undone.height).toBe(300)
    expect(undone.textAutoResize).toBe('NONE')

    editor.undo.redo()
    const redone = getNodeOrThrow(editor.graph, text.id)
    expect(redone.width).toBe(120)
    expect(redone.height).toBe(32)
  })

  test('double click sequence clicks without movement do not corrupt undo history', () => {
    setTextMeasurer(() => ({ width: 120, height: 32 }))

    const editor = createEditor()
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      x: 100,
      y: 100,
      width: 400,
      height: 300,
      text: 'Double click me',
      textAutoResize: 'NONE'
    })
    editor.select([text.id])

    // Simulate first mousedown + mouseup on corner handle without movement
    const hit1 = tryStartResize(500, 400, editor)
    if (!hit1) throw new Error('Expected hit1')
    commitResizePreview(hit1, editor)

    // Simulate second mousedown + mouseup on corner handle without movement
    const hit2 = tryStartResize(500, 400, editor)
    if (!hit2) throw new Error('Expected hit2')
    commitResizePreview(hit2, editor)

    // Simulate dblclick firing
    const hitDbl = tryStartResize(500, 400, editor)
    if (!hitDbl) throw new Error('Expected hitDbl')
    fitTextBoxToContent(hitDbl.nodeId, editor)

    const fitted = getNodeOrThrow(editor.graph, text.id)
    expect(fitted.width).toBe(120)
    expect(fitted.height).toBe(32)

    // Single undo must revert to the original 400x300 size directly
    editor.undo.undo()
    const undone = getNodeOrThrow(editor.graph, text.id)
    expect(undone.width).toBe(400)
    expect(undone.height).toBe(300)
  })

  test('tryStartResize skips unselected or locked nodes', () => {
    const editor = createEditor()
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      x: 100,
      y: 100,
      width: 400,
      height: 300,
      text: 'Locked',
      locked: true
    })
    editor.select([text.id])

    expect(tryStartResize(500, 400, editor)).toBeNull()
  })
})
