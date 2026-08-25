import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

async function clickCanvas(page: Page, x: number, y: number) {
  const canvas = page.getByTestId('canvas-element')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas has no bounding box')
  await page.mouse.click(box.x + x, box.y + y)
}

async function dblclickCanvas(page: Page, x: number, y: number) {
  const canvas = page.getByTestId('canvas-element')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas has no bounding box')
  await canvas.dispatchEvent('dblclick', {
    clientX: box.x + x,
    clientY: box.y + y,
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
      name: 'Spacing editor frame',
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
      name: 'Child 1',
      x: 20,
      y: 20,
      width: 120,
      height: 40
    })
    store.graph.createNode('RECTANGLE', frame.id, {
      name: 'Child 2',
      x: 20,
      y: 68,
      width: 120,
      height: 40
    })
    store.select([frame.id])
    store.requestRender()
    return frame.id
  })
}

async function frameItemSpacing(page: Page, frameId: string) {
  return page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getNode(id)?.itemSpacing ?? null
  }, frameId)
}

test('double-clicking an auto-layout spacing handle opens a scrub editor', async ({ page }) => {
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()

  const frameId = await setupAutoLayoutFrame(page)
  await canvas.waitForRender()

  await canvas.hover(300, 184)
  await dblclickCanvas(page, 300, 184)

  const editor = page.getByTestId('auto-layout-spacing-editor')
  await expect(editor).toBeVisible()

  await canvas.dragNumberField(editor.getByTestId('auto-layout-spacing-input'), 40)

  await expect(editor).toHaveCount(0)
  const changedSpacing = await frameItemSpacing(page, frameId)
  expect(changedSpacing).not.toBeNull()
  expect(changedSpacing).toBeGreaterThan(8)

  await canvas.undo()
  expect(await frameItemSpacing(page, frameId)).toBe(8)
  canvas.assertNoErrors()
})

test('clicking the canvas closes the auto-layout spacing editor', async ({ page }) => {
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()

  await setupAutoLayoutFrame(page)
  await canvas.waitForRender()

  await canvas.hover(300, 184)
  await dblclickCanvas(page, 300, 184)
  const editor = page.getByTestId('auto-layout-spacing-editor')
  await expect(editor).toBeVisible()

  await clickCanvas(page, 80, 80)
  await expect(editor).toHaveCount(0)
  canvas.assertNoErrors()
})

test('dragging the gap marker directly changes itemSpacing and undo restores it', async ({
  page
}) => {
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()

  const frameId = await setupAutoLayoutFrame(page)
  await canvas.waitForRender()

  const canvasEl = page.getByTestId('canvas-element')
  const box = await canvasEl.boundingBox()
  if (!box) throw new Error('Canvas has no bounding box')

  // Gap marker sits at the boundary between the two children (see
  // setupAutoLayoutFrame: frame at y120, paddingTop 20, child 1 height 40 ->
  // gap center around canvas y ~184, matching the double-click tests above).
  await page.mouse.move(box.x + 300, box.y + 184)
  await page.mouse.down()
  await page.mouse.move(box.x + 300, box.y + 204, { steps: 5 })
  await page.mouse.up()
  await canvas.waitForRender()

  const changedSpacing = await frameItemSpacing(page, frameId)
  expect(changedSpacing).not.toBeNull()
  expect(changedSpacing).not.toBe(8)

  await canvas.undo()
  expect(await frameItemSpacing(page, frameId)).toBe(8)
  canvas.assertNoErrors()
})

test('dragging outward from a zero gap creates positive spacing', async ({ page }) => {
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()

  const frameId = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')

    store.state.panX = 0
    store.state.panY = 0
    store.state.zoom = 1

    const pageId = store.state.currentPageId
    const frame = store.graph.createNode('FRAME', pageId, {
      name: 'Zero-gap frame',
      x: 160,
      y: 120,
      width: 280,
      height: 160,
      layoutMode: 'VERTICAL',
      itemSpacing: 0,
      paddingTop: 20,
      paddingRight: 20,
      paddingBottom: 20,
      paddingLeft: 20
    })
    store.graph.createNode('RECTANGLE', frame.id, {
      name: 'Child 1',
      x: 20,
      y: 20,
      width: 120,
      height: 40
    })
    // Touching the first child: no gap.
    store.graph.createNode('RECTANGLE', frame.id, {
      name: 'Child 2',
      x: 20,
      y: 60,
      width: 120,
      height: 40
    })
    store.select([frame.id])
    store.requestRender()
    return frame.id
  })
  await canvas.waitForRender()

  expect(await frameItemSpacing(page, frameId)).toBe(0)

  const canvasEl = page.getByTestId('canvas-element')
  const box = await canvasEl.boundingBox()
  if (!box) throw new Error('Canvas has no bounding box')

  // Boundary between the touching children is at canvas y = 120 + 20 + 40 = 180.
  await page.mouse.move(box.x + 280, box.y + 180)
  await page.mouse.down()
  await page.mouse.move(box.x + 280, box.y + 200, { steps: 5 })
  await page.mouse.up()
  await canvas.waitForRender()

  const changedSpacing = await frameItemSpacing(page, frameId)
  expect(changedSpacing).not.toBeNull()
  expect(changedSpacing as number).toBeGreaterThan(0)
  canvas.assertNoErrors()
})

test('auto-layout spacing editor follows canvas pan while open', async ({ page }) => {
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()

  await setupAutoLayoutFrame(page)
  await canvas.waitForRender()

  await canvas.hover(300, 184)
  await dblclickCanvas(page, 300, 184)
  const editor = page.getByTestId('auto-layout-spacing-editor')
  await expect(editor).toBeVisible()
  const before = await editor.boundingBox()
  if (!before) throw new Error('Spacing editor has no bounding box')

  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.pan(40, 0)
  })
  await canvas.waitForRender()

  const after = await editor.boundingBox()
  if (!after) throw new Error('Spacing editor has no bounding box after pan')
  expect(after.x).toBeGreaterThan(before.x + 20)
  canvas.assertNoErrors()
})
