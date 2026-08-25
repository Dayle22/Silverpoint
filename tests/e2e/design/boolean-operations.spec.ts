import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/')

type TreeNode = {
  id: string
  name: string
  type: string
  booleanOperation?: string
  childIds: string[]
  x: number
}

async function createOperands() {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    for (const node of store.graph.getChildren(store.state.currentPageId)) {
      store.graph.deleteNode(node.id)
    }
    store.undo.clear()
    store.clearSelection()
  })
  await editor.canvas.drawRect(180, 180, 140, 100)
  await editor.canvas.drawRect(240, 210, 140, 100)
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')

    const children = store.graph.getChildren(store.state.currentPageId)
    const first = children.at(-2)?.id
    const second = children.at(-1)?.id
    if (!first || !second) throw new Error('Boolean operands were not created')
    store.graph.updateNode(first, { name: 'Boolean base' })
    store.graph.updateNode(second, { name: 'Boolean cutter' })
    store.selectAll()
    store.requestRender()
    return { first, second }
  })
}

async function readNode(id: string): Promise<TreeNode | null> {
  return editor.page.evaluate((nodeId) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const node = store.graph.getNode(nodeId)
    if (!node) return null
    return {
      id: node.id,
      name: node.name,
      type: node.type,
      booleanOperation: node.booleanOperation,
      childIds: [...node.childIds],
      x: node.x
    }
  }, id)
}

async function chooseOperation(operation: 'booleanUnion' | 'booleanSubtract') {
  await editor.page.getByTestId('boolean-operations-trigger').click()
  const item = editor.page.getByTestId(`boolean-operation-${operation}`)
  await expect(item).toBeVisible()
  await item.focus()
  await editor.page.keyboard.press('Enter')
  await editor.canvas.waitForRender()
}

test('Union and Subtract keep editable Boolean parents through the UI', async () => {
  const unionOperands = await createOperands()
  await chooseOperation('booleanUnion')

  const union = await readNode(unionOperands.first)
  const unionParent = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const selectedId = [...store.state.selectedIds][0]
    return selectedId ? store.graph.getNode(selectedId) : null
  })

  expect(unionParent?.type).toBe('BOOLEAN_OPERATION')
  expect(unionParent?.booleanOperation).toBe('UNION')
  expect(unionParent?.childIds).toEqual([unionOperands.first, unionOperands.second])
  expect(union?.type).toBe('RECTANGLE')

  const unionId = unionParent?.id
  expect(unionId).toBeTruthy()
  expect((await readNode(unionOperands.first))?.id).toBe(unionOperands.first)
  const unionRow = editor.page.locator(`[data-node-id="${unionId}"]`)
  await expect(unionRow).toBeVisible()
  await unionRow.locator('button').first().click()
  await expect(editor.page.locator(`[data-node-id="${unionOperands.first}"]`)).toBeVisible()
  await expect(editor.page.locator(`[data-node-id="${unionOperands.second}"]`)).toBeVisible()

  await editor.page.locator(`[data-node-id="${unionOperands.second}"]`).click()
  const beforeChildEdit = (await readNode(unionOperands.second))?.x
  await editor.page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const node = store.graph.getNode(id)
    if (!node) throw new Error('Missing Boolean child')
    store.graph.updateNode(id, { x: node.x + 30 })
    store.requestRender()
  }, unionOperands.second)
  expect((await readNode(unionOperands.second))?.x).toBe((beforeChildEdit ?? 0) + 30)

  await editor.canvas.undo()
  expect((await readNode(unionOperands.first))?.type).toBe('RECTANGLE')
  expect((await readNode(unionOperands.second))?.type).toBe('RECTANGLE')
  await editor.canvas.redo()
  expect((await readNode(unionId as string))?.booleanOperation).toBe('UNION')

  await editor.canvas.clearCanvas()
  const subtractOperands = await createOperands()
  await chooseOperation('booleanSubtract')

  const subtractParent = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const selectedId = [...store.state.selectedIds][0]
    return selectedId ? store.graph.getNode(selectedId) : null
  })
  expect(subtractParent?.type).toBe('BOOLEAN_OPERATION')
  expect(subtractParent?.booleanOperation).toBe('SUBTRACT')
  expect(subtractParent?.childIds).toEqual([subtractOperands.first, subtractOperands.second])

  editor.canvas.assertNoErrors()
})
