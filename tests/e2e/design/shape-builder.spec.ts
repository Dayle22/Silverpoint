import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/')

async function createOverlappingOperands() {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    for (const node of store.graph.getChildren(store.state.currentPageId)) {
      store.graph.deleteNode(node.id)
    }
    store.undo.clear()
    store.clearSelection()
  })

  await editor.canvas.drawRect(180, 180, 100, 100)
  await editor.canvas.drawRect(230, 180, 100, 100)

  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')

    const children = store.graph.getChildren(store.state.currentPageId)
    const first = children.at(-2)?.id
    const second = children.at(-1)?.id
    if (!first || !second) throw new Error('Operands were not created')

    store.select([first, second])
    store.requestRender()
    return { first, second }
  })
}

test('Shape Builder tool decomposes regions, performs merge and delete operations, and supports undo/redo', async () => {
  const { first, second } = await createOverlappingOperands()

  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.setTool('SHAPE_BUILDER')
  })
  await editor.canvas.waitForRender()

  const stateInfo = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return {
      activeTool: store.state.activeTool,
      regionCount: store.state.shapeBuilderState?.regions.length ?? 0
    }
  })

  expect(stateInfo.activeTool).toBe('SHAPE_BUILDER')
  expect(stateInfo.regionCount).toBe(3)

  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store || !store.state.shapeBuilderState) return
    const regions = store.state.shapeBuilderState.regions
    const draggedSet = new Set([regions[0].id, regions[1].id])
    store.commitShapeBuilder(draggedSet, false)
  })
  await editor.canvas.waitForRender()

  const postMergeInfo = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const children = store.graph.getChildren(store.state.currentPageId)
    return {
      count: children.length,
      types: children.map((c) => c.type)
    }
  })

  expect(postMergeInfo.count).toBe(2)
  expect(postMergeInfo.types.every((t) => t === 'VECTOR')).toBe(true)

  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.undo.undo()
  })
  await editor.canvas.waitForRender()

  const postUndoInfo = await editor.page.evaluate((ids) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return {
      firstExists: Boolean(store.graph.getNode(ids.first)),
      secondExists: Boolean(store.graph.getNode(ids.second))
    }
  }, { first, second })

  expect(postUndoInfo.firstExists).toBe(true)
  expect(postUndoInfo.secondExists).toBe(true)

  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.undo.redo()
  })
  await editor.canvas.waitForRender()

  const postRedoCount = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getChildren(store.state.currentPageId).length
  })

  expect(postRedoCount).toBe(2)

  editor.canvas.assertNoErrors()
})
