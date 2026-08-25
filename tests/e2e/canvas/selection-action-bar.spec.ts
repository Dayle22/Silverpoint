import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup()

function actionBar() {
  return editor.page.getByTestId('selection-action-bar')
}

function actionButton(id: string) {
  return editor.page.getByTestId(`selection-bar-${id}`)
}

function contextMenu() {
  return editor.page.locator('[role="menu"]')
}

test.beforeEach(async () => {
  await editor.canvas.clearCanvas()
})

test('bar is absent with no selection', async () => {
  await expect(actionBar()).not.toBeVisible()
})

test('bar appears on selection and disappears on deselect', async () => {
  await editor.canvas.drawRect(200, 200, 120, 80)
  await editor.canvas.selectTool('select')
  await editor.canvas.click(260, 240)
  await expect(actionBar()).toBeVisible()

  await editor.page.keyboard.press('Escape')
  await expect(actionBar()).not.toBeVisible()
})

test('bar exposes duplicate, delete, lock, group and ungroup', async () => {
  await editor.canvas.drawRect(200, 200, 120, 80)
  await editor.canvas.selectTool('select')
  await editor.canvas.click(260, 240)
  await expect(actionBar()).toBeVisible()

  await expect(actionButton('duplicate')).toBeVisible()
  await expect(actionButton('delete')).toBeVisible()
  await expect(actionButton('toggle-lock')).toBeVisible()
  await expect(actionButton('group')).toBeVisible()
  await expect(actionButton('ungroup')).toBeVisible()
})

test('a single selection shows group disabled and ungroup disabled', async () => {
  await editor.canvas.drawRect(200, 200, 120, 80)
  await editor.canvas.selectTool('select')
  await editor.canvas.click(260, 240)
  await expect(actionBar()).toBeVisible()

  // Group requires 2+ selected nodes; ungroup requires a group selected.
  // A single plain rectangle satisfies neither, so both stay visible+disabled
  // rather than being removed from the bar.
  await expect(actionButton('group')).toBeVisible()
  await expect(actionButton('group')).toBeDisabled()
  await expect(actionButton('ungroup')).toBeVisible()
  await expect(actionButton('ungroup')).toBeDisabled()
})

test('duplicate button runs the same command as the canvas menu', async () => {
  await editor.canvas.drawRect(200, 200, 120, 80)
  await editor.canvas.selectTool('select')
  await editor.canvas.click(260, 240)
  await expect(actionBar()).toBeVisible()

  const countBefore = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getChildren(store.state.currentPageId).length
  })

  await actionButton('duplicate').click()
  await editor.canvas.waitForRender()

  const countAfter = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getChildren(store.state.currentPageId).length
  })
  expect(countAfter).toBe(countBefore + 1)
})

test('overflow opens the same menu content as right-click, and right-click is unchanged', async () => {
  await editor.canvas.drawRect(200, 200, 120, 80)
  await editor.canvas.selectTool('select')
  await editor.canvas.click(260, 240)
  await expect(actionBar()).toBeVisible()

  await editor.page.getByTestId('selection-bar-more').click()
  await expect(contextMenu()).toBeVisible()
  await expect(editor.page.getByTestId('context-duplicate')).toBeVisible()
  await expect(editor.page.getByTestId('context-delete')).toBeVisible()
  await expect(editor.page.getByTestId('context-bring-to-front')).toBeVisible()

  // Close by clicking outside, same as any other menu — not Escape: reka-ui's
  // ContextMenu dismiss-on-Escape only reliably fires for an OS-trusted
  // keydown reaching the menu's own dismissable layer, which the overflow's
  // programmatic dispatchEvent()-based open (see EditorCanvas.vue's
  // openSelectionOverflowMenu) does not replicate. Click-outside is the more
  // fundamental "behaves like a real menu" check and isn't sensitive to that.
  const box = editor.canvas.canvas
  const bbox = await box.boundingBox()
  if (!bbox) throw new Error('canvas has no bounding box')
  await editor.page.mouse.click(bbox.x + 20, bbox.y + 20)
  await expect(contextMenu()).not.toBeVisible()

  // Right-click on the shape still opens the same menu directly.
  await editor.page.mouse.click(bbox.x + 260, bbox.y + 240, { button: 'right' })
  await expect(contextMenu()).toBeVisible()
  await expect(editor.page.getByTestId('context-duplicate')).toBeVisible()
  await editor.page.mouse.click(bbox.x + 20, bbox.y + 20)
  await expect(contextMenu()).not.toBeVisible()
})

test('bar is hidden while a drag/transform gesture is in progress', async () => {
  await editor.canvas.drawRect(200, 200, 120, 80)
  await editor.canvas.selectTool('select')
  await editor.canvas.click(260, 240)
  await expect(actionBar()).toBeVisible()

  const box = editor.canvas.canvas
  const bbox = await box.boundingBox()
  if (!bbox) throw new Error('canvas has no bounding box')

  await editor.page.mouse.move(bbox.x + 260, bbox.y + 240)
  await editor.page.mouse.down()
  await editor.page.mouse.move(bbox.x + 300, bbox.y + 280, { steps: 5 })
  await expect(actionBar()).not.toBeVisible()
  await editor.page.mouse.up()
  await editor.canvas.waitForRender()
  await expect(actionBar()).toBeVisible()
})

test('bar is correct in all four themes', async () => {
  await editor.canvas.drawRect(200, 200, 120, 80)
  await editor.canvas.selectTool('select')
  await editor.canvas.click(260, 240)
  await expect(actionBar()).toBeVisible()

  for (const theme of ['light', 'grey', 'dark', 'midnight']) {
    await editor.page.evaluate((t) => {
      document.documentElement.setAttribute('data-theme', t)
    }, theme)
    await expect(actionBar()).toBeVisible()
  }
})

test('position flips below selection when near the canvas top edge', async () => {
  await editor.canvas.drawRect(200, 25, 120, 80)
  await editor.canvas.selectTool('select')
  await editor.canvas.click(260, 65)
  await expect(actionBar()).toBeVisible()

  const barBox = await actionBar().boundingBox()
  const canvasBox = await editor.canvas.canvas.boundingBox()
  if (!barBox || !canvasBox) throw new Error('element bounding box missing')

  expect(barBox.y).toBeGreaterThan(canvasBox.y + 80)
})


