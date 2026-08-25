import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear()

function sceneState(ids: string[]) {
  return editor.page.evaluate((nodeIds) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return nodeIds.map((id) => {
      const node = store.graph.getNode(id)
      return node
        ? { id: node.id, isMask: node.isMask, maskType: node.maskType, parentId: node.parentId }
        : null
    })
  }, ids)
}

function createSiblingMaskScene() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const maskId = store.createShape('ELLIPSE', 120, 120, 120, 120, pageId)
    const contentId = store.createShape('RECTANGLE', 80, 80, 220, 220, pageId)
    store.graph.updateNode(maskId, { name: 'Mask source' })
    store.graph.updateNode(contentId, { name: 'Masked content' })
    store.select([maskId])
    store.requestRender()
    return { maskId, contentId }
  })
}

test('mask stack exposes layer relationships and undo/redo state', async () => {
  const { maskId, contentId } = await createSiblingMaskScene()
  await editor.canvas.waitForRender()

  const maskAction = editor.page.getByTestId('selection-toggle-mask')
  await expect(maskAction).toBeVisible()
  await maskAction.click()
  await editor.canvas.waitForRender()

  expect(await sceneState([maskId, contentId])).toEqual([
    { id: maskId, isMask: true, maskType: 'ALPHA', parentId: expect.any(String) },
    { id: contentId, isMask: false, maskType: 'ALPHA', parentId: expect.any(String) }
  ])
  await expect(editor.page.getByTestId('layers-item-mask-badge')).toHaveCount(1)
  await expect(editor.page.getByTestId('layers-item').filter({ hasText: 'Masked content' })).toHaveAttribute(
    'data-masked',
    'true'
  )

  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.undo.undo()
  })
  await editor.canvas.waitForRender()
  expect((await sceneState([maskId]))[0]?.isMask).toBe(false)
  await expect(editor.page.getByTestId('layers-item-mask-badge')).toHaveCount(0)

  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.undo.redo()
  })
  await editor.canvas.waitForRender()
  expect((await sceneState([maskId]))[0]?.isMask).toBe(true)
  await expect(editor.page.getByTestId('layers-item').filter({ hasText: 'Masked content' })).toHaveAttribute(
    'data-masked',
    'true'
  )
})

test('mask type changes are persisted in the selected node', async () => {
  const { maskId } = await createSiblingMaskScene()
  await editor.canvas.waitForRender()

  await editor.page.getByTestId('selection-toggle-mask').click()
  const maskSection = editor.page.getByRole('region', { name: 'Mask', exact: true })
  await expect(maskSection).toBeVisible()
  await maskSection.getByRole('combobox', { name: 'Mask type' }).click()
  await editor.page.getByRole('option', { name: 'Luminance' }).click()
  await editor.canvas.waitForRender()

  expect((await sceneState([maskId]))[0]?.maskType).toBe('LUMINANCE')
})
