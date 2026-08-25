import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

describe('page guide actions', () => {
  test('preserves unknown guide entries while adding, moving, removing, undoing, and redoing', () => {
    const editor = createEditor()
    const page = editor.graph.getPages()[0]
    page.source.fig.rawNodeFields.guides = [
      { future: true },
      { axis: 'X', offset: 10, colour: 'preserve' },
      'unknown'
    ]
    page.source.fig.rawNodeFields.customMetadata = { preserved: true }

    editor.addPageGuide('Y', 120)
    expect(editor.getPageGuides()).toEqual([
      { axis: 'X', offset: 10 },
      { axis: 'Y', offset: 120 }
    ])

    editor.updatePageGuide(0, 180)
    expect(page.source.fig.rawNodeFields.guides).toEqual([
      { future: true },
      { axis: 'X', offset: 180, colour: 'preserve' },
      'unknown',
      { axis: 'Y', offset: 120 }
    ])

    editor.removePageGuide(1)
    expect(editor.getPageGuides()).toEqual([{ axis: 'X', offset: 180 }])
    expect(page.source.fig.rawNodeFields.customMetadata).toEqual({ preserved: true })

    editor.undo.undo()
    editor.undo.undo()
    expect(editor.getPageGuides()).toEqual([
      { axis: 'X', offset: 10 },
      { axis: 'Y', offset: 120 }
    ])
    editor.undo.redo()
    expect(editor.getPageGuides()[0]?.offset).toBe(180)
  })

  test('supports preview movement with one committed undo entry and ignores invalid input', () => {
    const editor = createEditor()
    editor.addPageGuide('X', 40)
    editor.undo.clear()

    editor.setPageGuideOffset(0, 75)
    expect(editor.getPageGuides()[0]?.offset).toBe(75)
    expect(editor.undo.canUndo).toBe(false)
    editor.commitPageGuideMove(0, 40)
    expect(editor.undo.canUndo).toBe(true)
    editor.undo.undo()
    expect(editor.getPageGuides()[0]?.offset).toBe(40)

    editor.addPageGuide('Z', 10)
    editor.addPageGuide('Y', Number.NaN)
    editor.updatePageGuide(99, 10)
    editor.removePageGuide(-1)
    expect(editor.getPageGuides()).toEqual([{ axis: 'X', offset: 40 }])
  })
})
