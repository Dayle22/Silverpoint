import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, fitTextBoxToContent } from '@open-pencil/core/editor'
import { setTextMeasurer } from '@open-pencil/core/layout'

import { getNodeOrThrow } from '#tests/helpers/assert'

afterEach(() => {
  setTextMeasurer(null)
})

describe('editor text auto-resize updates', () => {
  test('lineHeight changes resize auto-height text', () => {
    setTextMeasurer((node) => ({ width: node.width, height: node.lineHeight ?? 20 }))

    const editor = createEditor()
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      text: 'Hello',
      textAutoResize: 'HEIGHT',
      width: 120,
      height: 20,
      lineHeight: 20
    })

    editor.updateNode(text.id, { lineHeight: 48 })

    expect(getNodeOrThrow(editor.graph, text.id).lineHeight).toBe(48)
    expect(getNodeOrThrow(editor.graph, text.id).height).toBe(48)
  })

  test('lineHeight changes on auto-height text are undoable with height', () => {
    setTextMeasurer((node) => ({ width: node.width, height: node.lineHeight ?? 20 }))

    const editor = createEditor()
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      text: 'Hello',
      textAutoResize: 'HEIGHT',
      width: 120,
      height: 20,
      lineHeight: 20
    })

    editor.updateNodeWithUndo(text.id, { lineHeight: 48 }, 'Change lineHeight')

    expect(getNodeOrThrow(editor.graph, text.id).height).toBe(48)
    editor.undo.undo()
    expect(getNodeOrThrow(editor.graph, text.id).lineHeight).toBe(20)
    expect(getNodeOrThrow(editor.graph, text.id).height).toBe(20)
    editor.undo.redo()
    expect(getNodeOrThrow(editor.graph, text.id).lineHeight).toBe(48)
    expect(getNodeOrThrow(editor.graph, text.id).height).toBe(48)
  })

  test('font size changes resize width-and-height text', () => {
    setTextMeasurer((node) => ({ width: node.fontSize * 4, height: node.fontSize * 2 }))

    const editor = createEditor()
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      text: 'Text',
      textAutoResize: 'WIDTH_AND_HEIGHT',
      width: 40,
      height: 20,
      fontSize: 10
    })

    editor.updateNode(text.id, { fontSize: 16 })

    expect(getNodeOrThrow(editor.graph, text.id).width).toBe(64)
    expect(getNodeOrThrow(editor.graph, text.id).height).toBe(32)
  })

  test('fitTextBoxToContent fits fixed-size text box to measured size without altering autoResize mode', () => {
    setTextMeasurer(() => ({ width: 150, height: 45 }))

    const editor = createEditor()
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      text: 'Sample text',
      textAutoResize: 'NONE',
      width: 300,
      height: 200
    })

    fitTextBoxToContent(text.id, editor)

    const fitted = getNodeOrThrow(editor.graph, text.id)
    expect(fitted.width).toBe(150)
    expect(fitted.height).toBe(45)
    expect(fitted.textAutoResize).toBe('NONE')

    editor.undo.undo()
    const undone = getNodeOrThrow(editor.graph, text.id)
    expect(undone.width).toBe(300)
    expect(undone.height).toBe(200)

    editor.undo.redo()
    const redone = getNodeOrThrow(editor.graph, text.id)
    expect(redone.width).toBe(150)
    expect(redone.height).toBe(45)
  })

  test('fitTextBoxToContent no-ops for non-text or zero-dimension nodes', () => {
    setTextMeasurer(() => ({ width: 0, height: 20 }))

    const editor = createEditor()
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      text: '',
      textAutoResize: 'NONE',
      width: 100,
      height: 50
    })
    const rect = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      width: 100,
      height: 50
    })

    fitTextBoxToContent(text.id, editor)
    expect(getNodeOrThrow(editor.graph, text.id).width).toBe(100)
    expect(getNodeOrThrow(editor.graph, text.id).height).toBe(50)

    fitTextBoxToContent(rect.id, editor)
    expect(getNodeOrThrow(editor.graph, rect.id).width).toBe(100)
    expect(getNodeOrThrow(editor.graph, rect.id).height).toBe(50)
  })
})

