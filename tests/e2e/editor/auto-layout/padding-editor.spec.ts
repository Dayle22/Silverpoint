import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

async function clickCanvas(page: Page, x: number, y: number) {
  const canvas = page.getByTestId('canvas-element')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas has no bounding box')
  await page.mouse.click(box.x + x, box.y + y)
}

async function dblclickCanvas(
  page: Page,
  x: number,
  y: number,
  options?: { altKey?: boolean }
) {
  const canvas = page.getByTestId('canvas-element')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas has no bounding box')
  await canvas.dispatchEvent('dblclick', {
    clientX: box.x + x,
    clientY: box.y + y,
    altKey: options?.altKey ?? false,
    bubbles: true,
    cancelable: true
  })
}

async function setupAutoLayoutFrame(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')

    store.state.panX = 0
    store.state.panY = 0
    store.state.zoom = 1

    const pageId = store.state.currentPageId
    const frame = store.graph.createNode('FRAME', pageId, {
      name: 'Padding editor frame',
      x: 160,
      y: 120,
      width: 280,
      height: 160,
      layoutMode: 'VERTICAL',
      itemSpacing: 8,
      paddingTop: 20,
      paddingRight: 20,
      paddingBottom: 20,
      paddingLeft: 20
    })
    store.graph.createNode('RECTANGLE', frame.id, {
      name: 'Child',
      x: 20,
      y: 20,
      width: 120,
      height: 40
    })
    store.select([frame.id])
    store.requestRender()
    return frame.id
  })
}

async function framePadding(page: Page, frameId: string) {
  return page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const node = store.graph.getNode(id)
    if (!node) return null
    return {
      paddingTop: node.paddingTop,
      paddingBottom: node.paddingBottom,
      paddingLeft: node.paddingLeft,
      paddingRight: node.paddingRight
    }
  }, frameId)
}

test('double-clicking an auto-layout padding handle opens a scrub editor and updates only that side', async ({
  page
}) => {
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()

  const frameId = await setupAutoLayoutFrame(page)
  await canvas.waitForRender()

  await canvas.hover(300, 130)
  await dblclickCanvas(page, 300, 130)

  const editor = page.getByTestId('auto-layout-padding-editor')
  await expect(editor).toBeVisible()

  await canvas.dragNumberField(editor.getByTestId('auto-layout-padding-input'), 40)

  await expect(editor).toHaveCount(0)
  const padding = await framePadding(page, frameId)
  expect(padding).not.toBeNull()
  expect(padding?.paddingTop).toBeGreaterThan(20)
  expect(padding?.paddingBottom).toBe(20)
  expect(padding?.paddingLeft).toBe(20)
  expect(padding?.paddingRight).toBe(20)

  await canvas.undo()
  const restored = await framePadding(page, frameId)
  expect(restored?.paddingTop).toBe(20)
  expect(restored?.paddingBottom).toBe(20)
  canvas.assertNoErrors()
})

test('alt+double-clicking an auto-layout padding handle updates paired sides symmetrically and undoes in one step', async ({
  page
}) => {
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()

  const frameId = await setupAutoLayoutFrame(page)
  await canvas.waitForRender()

  await canvas.hover(300, 130)
  await dblclickCanvas(page, 300, 130, { altKey: true })

  const editor = page.getByTestId('auto-layout-padding-editor')
  await expect(editor).toBeVisible()

  await canvas.dragNumberField(editor.getByTestId('auto-layout-padding-input'), 40)

  await expect(editor).toHaveCount(0)
  const padding = await framePadding(page, frameId)
  expect(padding).not.toBeNull()
  expect(padding?.paddingTop).toBeGreaterThan(20)
  expect(padding?.paddingBottom).toBe(padding?.paddingTop)
  expect(padding?.paddingLeft).toBe(20)
  expect(padding?.paddingRight).toBe(20)

  await canvas.undo()
  const restored = await framePadding(page, frameId)
  expect(restored?.paddingTop).toBe(20)
  expect(restored?.paddingBottom).toBe(20)
  canvas.assertNoErrors()
})

test('clicking the canvas closes the auto-layout padding editor', async ({ page }) => {
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()

  await setupAutoLayoutFrame(page)
  await canvas.waitForRender()

  await canvas.hover(300, 130)
  await dblclickCanvas(page, 300, 130)
  const editor = page.getByTestId('auto-layout-padding-editor')
  await expect(editor).toBeVisible()

  await clickCanvas(page, 80, 80)
  await expect(editor).toHaveCount(0)
  canvas.assertNoErrors()
})

test('auto-layout padding editor follows canvas pan while open', async ({ page }) => {
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()

  await setupAutoLayoutFrame(page)
  await canvas.waitForRender()

  await canvas.hover(300, 130)
  await dblclickCanvas(page, 300, 130)
  const editor = page.getByTestId('auto-layout-padding-editor')
  await expect(editor).toBeVisible()
  const before = await editor.boundingBox()
  if (!before) throw new Error('Padding editor has no bounding box')

  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.pan(40, 0)
  })
  await canvas.waitForRender()

  const after = await editor.boundingBox()
  if (!after) throw new Error('Padding editor has no bounding box after pan')
  expect(after.x).toBeGreaterThan(before.x + 20)
  canvas.assertNoErrors()
})

test('hovering padding or spacing handles shows directional resize cursor, with resize handles taking precedence', async ({
  page
}) => {
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()

  await setupAutoLayoutFrame(page)
  await canvas.waitForRender()

  const canvasEl = page.getByTestId('canvas-element')

  // Top padding tick (vertical axis) -> ns-resize
  await canvas.hover(300, 130)
  await expect(canvasEl).toHaveCSS('cursor', 'ns-resize')

  // Left padding tick (horizontal axis) -> ew-resize
  await canvas.hover(170, 200)
  await expect(canvasEl).toHaveCSS('cursor', 'ew-resize')

  // Frame top-left corner resize handle -> corner resize cursor takes precedence
  await canvas.hover(160, 120)
  await expect(canvasEl).not.toHaveCSS('cursor', 'ns-resize')
  await expect(canvasEl).not.toHaveCSS('cursor', 'default')

  canvas.assertNoErrors()
})
