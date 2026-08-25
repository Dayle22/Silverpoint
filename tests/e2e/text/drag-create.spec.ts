import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'
import { getEditingTextId, getSelectedNode } from '#tests/helpers/store'

const editor = useEditorSetup()

function getPageChildren() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getChildren(store.state.currentPageId).map((n) => ({
      id: n.id,
      type: n.type,
      name: n.name,
      text: n.text,
      width: n.width,
      height: n.height
    }))
  })
}

test('dragging with text tool creates sized text node and enters editing', async () => {
  await editor.page.keyboard.press('t')
  await editor.canvas.drag(300, 200, 480, 290)
  await editor.canvas.waitForRender()

  const node = expectDefined(await getSelectedNode(editor.page), 'selected text node')
  expect(node.type).toBe('TEXT')
  expect(node.width).toBeGreaterThanOrEqual(178)
  expect(node.width).toBeLessThanOrEqual(182)
  expect(node.height).toBeGreaterThanOrEqual(88)
  expect(node.height).toBeLessThanOrEqual(92)

  const editingId = await getEditingTextId(editor.page)
  expect(editingId).toBe(node.id)

  editor.canvas.assertNoErrors()
})

test('clicking with text tool creates default-sized text box', async () => {
  await editor.page.keyboard.press('Escape')
  await editor.canvas.waitForRender()

  await editor.page.keyboard.press('t')
  await editor.canvas.click(200, 400)
  await editor.canvas.waitForRender()

  // Wait a tick for text editing mode
  await editor.page.waitForTimeout(200)

  const node = expectDefined(await getSelectedNode(editor.page), 'selected text node')
  expect(node.type).toBe('TEXT')
  expect(node.width).toBe(200)
  expect(node.height).toBe(24)

  editor.canvas.assertNoErrors()
})

test('undo removes dragged text node in one step', async () => {
  await editor.page.keyboard.press('Escape')
  await editor.canvas.waitForRender()

  const beforeCount = (await getPageChildren()).length

  await editor.page.keyboard.press('t')
  await editor.canvas.drag(100, 100, 250, 200)
  await editor.canvas.waitForRender()

  const afterCount = (await getPageChildren()).length
  expect(afterCount).toBe(beforeCount + 1)

  await editor.page.keyboard.press('Escape')
  await editor.canvas.waitForRender()

  await editor.page.keyboard.press('Control+z')
  await editor.canvas.waitForRender()

  const undoneCount = (await getPageChildren()).length
  expect(undoneCount).toBe(beforeCount)

  editor.canvas.assertNoErrors()
})
