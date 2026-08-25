import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

import { reparentOutsideNodes } from '#vue/shared/input/drop-target'
import { handleMoveMove, handleMoveUp } from '#vue/shared/input/move'
import { createSelectionMoveDrag } from '#vue/shared/input/select/move'
import type { DragMove } from '#vue/shared/input/types'

describe('drag out of frame unparenting', () => {
  test('single frame: dragging node outside frame reparents to page with undo restoration', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId

    const frame = editor.graph.createNode('FRAME', pageId, {
      name: 'Frame',
      x: 100,
      y: 100,
      width: 300,
      height: 300
    })

    const rect = editor.graph.createNode('RECTANGLE', frame.id, {
      name: 'Box',
      x: 20,
      y: 20,
      width: 50,
      height: 50
    })

    editor.select([rect.id])
    const drag = createSelectionMoveDrag(145, 145, 145, 145, editor, false) as DragMove

    handleMoveMove(drag, 600, 600, 600, 600, editor)
    expect(editor.state.dropTargetId).toBeNull()

    handleMoveUp(drag, editor)

    const movedRect = editor.graph.getNode(rect.id)
    expect(movedRect?.parentId).toBe(pageId)
    expect(movedRect?.x).toBe(575)
    expect(movedRect?.y).toBe(575)

    editor.undo.undo()
    const undoneRect = editor.graph.getNode(rect.id)
    expect(undoneRect?.parentId).toBe(frame.id)
    expect(undoneRect?.x).toBe(20)
    expect(undoneRect?.y).toBe(20)

    editor.undo.redo()
    const redoneRect = editor.graph.getNode(rect.id)
    expect(redoneRect?.parentId).toBe(pageId)
    expect(redoneRect?.x).toBe(575)
    expect(redoneRect?.y).toBe(575)
  })

  test('nested frames: dragging out of both inner and outer frame reparents directly to page', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId

    const outerFrame = editor.graph.createNode('FRAME', pageId, {
      name: 'Outer Frame',
      x: 100,
      y: 100,
      width: 400,
      height: 400
    })

    const innerFrame = editor.graph.createNode('FRAME', outerFrame.id, {
      name: 'Inner Frame',
      x: 50,
      y: 50,
      width: 150,
      height: 150
    })

    const rect = editor.graph.createNode('RECTANGLE', innerFrame.id, {
      name: 'Box',
      x: 10,
      y: 10,
      width: 40,
      height: 40
    })

    editor.select([rect.id])
    const drag = createSelectionMoveDrag(160, 160, 160, 160, editor, false) as DragMove

    handleMoveMove(drag, 700, 700, 700, 700, editor)
    expect(editor.state.dropTargetId).toBeNull()

    handleMoveUp(drag, editor)

    const movedRect = editor.graph.getNode(rect.id)
    expect(movedRect?.parentId).toBe(pageId)
    expect(movedRect?.x).toBe(700)
    expect(movedRect?.y).toBe(700)

    editor.undo.undo()
    const undoneRect = editor.graph.getNode(rect.id)
    expect(undoneRect?.parentId).toBe(innerFrame.id)
    expect(undoneRect?.x).toBe(10)
    expect(undoneRect?.y).toBe(10)
  })

  test('nested frames: dragging out of inner frame but staying inside outer frame reparents to outer frame', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId

    const outerFrame = editor.graph.createNode('FRAME', pageId, {
      name: 'Outer Frame',
      x: 100,
      y: 100,
      width: 400,
      height: 400
    })

    const innerFrame = editor.graph.createNode('FRAME', outerFrame.id, {
      name: 'Inner Frame',
      x: 50,
      y: 50,
      width: 100,
      height: 100
    })

    const rect = editor.graph.createNode('RECTANGLE', innerFrame.id, {
      name: 'Box',
      x: 10,
      y: 10,
      width: 30,
      height: 30
    })

    editor.select([rect.id])
    editor.updateNode(rect.id, { x: 160, y: 10 })
    reparentOutsideNodes(editor)

    const reparentedRect = editor.graph.getNode(rect.id)
    expect(reparentedRect?.parentId).toBe(outerFrame.id)
    expect(reparentedRect?.x).toBe(210)
    expect(reparentedRect?.y).toBe(60)
  })

  test('group: dragging out of group does not unparent from group', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId

    const rect1 = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Box 1',
      x: 50,
      y: 50,
      width: 100,
      height: 100
    })
    const rect2 = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Box 2',
      x: 80,
      y: 80,
      width: 50,
      height: 50
    })

    editor.select([rect1.id, rect2.id])
    const groupId = editor.groupSelected([rect1, rect2])

    editor.select([rect1.id])
    editor.updateNode(rect1.id, { x: 500, y: 500 })
    reparentOutsideNodes(editor)

    const node = editor.graph.getNode(rect1.id)
    expect(node?.parentId).toBe(groupId)
  })

  test('drop onto another sibling frame via pointer hit test', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId

    const frameA = editor.graph.createNode('FRAME', pageId, {
      name: 'Frame A',
      x: 50,
      y: 50,
      width: 200,
      height: 200
    })

    const frameB = editor.graph.createNode('FRAME', pageId, {
      name: 'Frame B',
      x: 350,
      y: 50,
      width: 200,
      height: 200
    })

    const rect = editor.graph.createNode('RECTANGLE', frameA.id, {
      name: 'Box',
      x: 20,
      y: 20,
      width: 50,
      height: 50
    })

    editor.select([rect.id])
    const drag = createSelectionMoveDrag(70, 70, 70, 70, editor, false) as DragMove

    handleMoveMove(drag, 400, 100, 400, 100, editor)
    expect(editor.state.dropTargetId).toBe(frameB.id)

    handleMoveUp(drag, editor)

    const movedRect = editor.graph.getNode(rect.id)
    expect(movedRect?.parentId).toBe(frameB.id)
  })

  test('drop onto nested frame reparents to innermost frame under cursor', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId

    const outerFrame = editor.graph.createNode('FRAME', pageId, {
      name: 'Outer Frame',
      x: 100,
      y: 100,
      width: 400,
      height: 400
    })

    const innerFrame = editor.graph.createNode('FRAME', outerFrame.id, {
      name: 'Inner Frame',
      x: 50,
      y: 50,
      width: 150,
      height: 150
    })

    const standaloneRect = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Box',
      x: 600,
      y: 600,
      width: 40,
      height: 40
    })

    editor.select([standaloneRect.id])
    const drag = createSelectionMoveDrag(620, 620, 620, 620, editor, false) as DragMove

    handleMoveMove(drag, 200, 200, 200, 200, editor)
    expect(editor.state.dropTargetId).toBe(innerFrame.id)

    handleMoveUp(drag, editor)

    const movedRect = editor.graph.getNode(standaloneRect.id)
    expect(movedRect?.parentId).toBe(innerFrame.id)
  })

  test('multi-selection drag out of different frames commits in one undo step', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId

    const frameA = editor.graph.createNode('FRAME', pageId, {
      name: 'Frame A',
      x: 50,
      y: 50,
      width: 200,
      height: 200
    })

    const frameB = editor.graph.createNode('FRAME', pageId, {
      name: 'Frame B',
      x: 300,
      y: 50,
      width: 200,
      height: 200
    })

    const rectA = editor.graph.createNode('RECTANGLE', frameA.id, {
      name: 'Box A',
      x: 20,
      y: 20,
      width: 40,
      height: 40
    })

    const rectB = editor.graph.createNode('RECTANGLE', frameB.id, {
      name: 'Box B',
      x: 20,
      y: 20,
      width: 40,
      height: 40
    })

    editor.select([rectA.id, rectB.id])
    const drag = createSelectionMoveDrag(70, 70, 70, 70, editor, false) as DragMove

    handleMoveMove(drag, 670, 670, 670, 670, editor)
    expect(editor.state.dropTargetId).toBeNull()

    handleMoveUp(drag, editor)

    const movedA = editor.graph.getNode(rectA.id)
    const movedB = editor.graph.getNode(rectB.id)
    expect(movedA?.parentId).toBe(pageId)
    expect(movedB?.parentId).toBe(pageId)

    editor.undo.undo()
    const undoneA = editor.graph.getNode(rectA.id)
    const undoneB = editor.graph.getNode(rectB.id)
    expect(undoneA?.parentId).toBe(frameA.id)
    expect(undoneB?.parentId).toBe(frameB.id)
    expect(undoneA?.x).toBe(20)
    expect(undoneB?.x).toBe(20)
  })

  test('auto-layout child dragged far enough unparents once broken out', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId

    const alFrame = editor.graph.createNode('FRAME', pageId, {
      name: 'AutoLayout Frame',
      x: 100,
      y: 100,
      width: 300,
      height: 100,
      layoutMode: 'HORIZONTAL',
      itemSpacing: 10
    })

    const item1 = editor.graph.createNode('RECTANGLE', alFrame.id, {
      name: 'Item 1',
      x: 10,
      y: 10,
      width: 60,
      height: 60
    })

    editor.graph.createNode('RECTANGLE', alFrame.id, {
      name: 'Item 2',
      x: 80,
      y: 10,
      width: 60,
      height: 60
    })

    editor.select([item1.id])
    const drag = createSelectionMoveDrag(130, 130, 130, 130, editor, false) as DragMove
    expect(drag.autoLayoutParentId).toBe(alFrame.id)

    handleMoveMove(drag, 130, 430, 130, 430, editor)
    expect(drag.brokeFromAutoLayout).toBe(true)
    expect(editor.state.dropTargetId).toBeNull()

    handleMoveUp(drag, editor)

    const movedItem = editor.graph.getNode(item1.id)
    expect(movedItem?.parentId).toBe(pageId)
  })
})
