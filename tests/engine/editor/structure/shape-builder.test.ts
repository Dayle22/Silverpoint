import { describe, expect, it } from 'bun:test'

import { initCanvasKit } from '#cli/headless'
import { SkiaRenderer } from '#core/canvas'
import { createEditor } from '#core/editor'
import {
  clearShapeBuilder,
  commitShapeBuilder,
  initializeShapeBuilder
} from '#core/editor/structure/shape-builder'

async function createEditorWithRenderer() {
  const ck = await initCanvasKit()
  const surface = ck.MakeSurface(200, 200)
  if (!surface) throw new Error('Could not create CanvasKit surface')
  const renderer = new SkiaRenderer(ck, surface)
  const editor = createEditor()
  editor.setCanvasKit(ck, renderer)
  return { editor, surface }
}

describe('Shape Builder Tool', () => {
  it('decomposes two overlapping rectangles into disjoint regions', async () => {
    const { editor, surface } = await createEditorWithRenderer()

    const rect1 = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const rect2 = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      x: 50,
      y: 0,
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 0, g: 1, b: 0, a: 1 }, opacity: 1, visible: true }]
    })

    editor.select([rect1.id, rect2.id])
    editor.setTool('SHAPE_BUILDER')

    const initialized = initializeShapeBuilder(editor)
    expect(initialized).toBeTrue()

    const sbState = editor.state.shapeBuilderState
    expect(sbState).not.toBeNull()
    expect(sbState?.regions.length).toBe(3)

    clearShapeBuilder(editor)
    expect(editor.state.shapeBuilderState).toBeNull()
    surface.delete()
  })

  it('merges selected regions in merge mode', async () => {
    const { editor, surface } = await createEditorWithRenderer()

    const rect1 = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const rect2 = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      x: 50,
      y: 0,
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 0, g: 1, b: 0, a: 1 }, opacity: 1, visible: true }]
    })

    editor.select([rect1.id, rect2.id])
    editor.setTool('SHAPE_BUILDER')
    initializeShapeBuilder(editor)

    const regions = editor.state.shapeBuilderState?.regions ?? []
    const draggedRegionIds = new Set(
      [regions[0]?.id, regions[1]?.id].filter((id): id is string => id != null)
    )

    const createdIds = commitShapeBuilder(editor, draggedRegionIds, false)
    expect(createdIds).not.toBeNull()
    expect(createdIds?.length).toBe(2)

    const createdNodes = (createdIds ?? []).map((id) => editor.graph.getNode(id))
    expect(createdNodes.every((node) => node?.type === 'VECTOR')).toBeTrue()

    expect(editor.graph.getNode(rect1.id)).toBeUndefined()
    expect(editor.graph.getNode(rect2.id)).toBeUndefined()

    editor.undo.undo()
    expect(editor.graph.getNode(rect1.id)).toBeDefined()
    expect(editor.graph.getNode(rect2.id)).toBeDefined()

    editor.undo.redo()
    expect(editor.graph.getNode(rect1.id)).toBeUndefined()
    expect(editor.graph.getNode(rect2.id)).toBeUndefined()

    surface.delete()
  })

  it('discards brushed regions in delete mode', async () => {
    const { editor, surface } = await createEditorWithRenderer()

    const rect1 = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const rect2 = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      x: 50,
      y: 0,
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 0, g: 1, b: 0, a: 1 }, opacity: 1, visible: true }]
    })

    editor.select([rect1.id, rect2.id])
    editor.setTool('SHAPE_BUILDER')
    initializeShapeBuilder(editor)

    const regions = editor.state.shapeBuilderState?.regions ?? []
    const draggedRegionIds = new Set([regions[1]?.id].filter(Boolean) as string[])

    const createdIds = commitShapeBuilder(editor, draggedRegionIds, true)
    expect(createdIds).not.toBeNull()
    expect(createdIds?.length).toBe(2)

    editor.undo.undo()
    expect(editor.graph.getNode(rect1.id)).toBeDefined()
    expect(editor.graph.getNode(rect2.id)).toBeDefined()

    surface.delete()
  })
})
