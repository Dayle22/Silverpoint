import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/?test&no-chrome&no-rulers')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
})

test.afterAll(async () => {
  await page.close()
})

test.beforeEach(async () => {
  await canvas.clearCanvas()
})

test('dragging node out of frame to canvas unparents it', async () => {
  const ids = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')

    store.state.panX = 0
    store.state.panY = 0
    store.state.zoom = 1

    const pageId = store.state.currentPageId
    const frame = store.graph.createNode('FRAME', pageId, {
      name: 'Container',
      x: 100,
      y: 100,
      width: 250,
      height: 250,
      fills: [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9, a: 1 }, opacity: 1, visible: true }]
    })

    const box = store.graph.createNode('RECTANGLE', frame.id, {
      name: 'Box',
      x: 20,
      y: 20,
      width: 60,
      height: 60,
      fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.6, b: 1, a: 1 }, opacity: 1, visible: true }]
    })

    store.select([box.id])
    store.requestRender()
    return { page: pageId, frame: frame.id, box: box.id }
  })
  await canvas.waitForRender()

  const boxBounds = await page.getByTestId('canvas-element').boundingBox()
  if (!boxBounds) throw new Error('No canvas element')

  // Drag from box center (100 + 20 + 30 = 150, 100 + 20 + 30 = 150) to canvas empty space (500, 500)
  await canvas.drag(150, 150, 500, 500, 10)
  await canvas.waitForRender()

  const result = await page.evaluate((boxId) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const node = store.graph.getNode(boxId)
    return {
      parentId: node?.parentId,
      x: node?.x,
      y: node?.y
    }
  }, ids.box)

  expect(result.parentId).toBe(ids.page)
  expect(result.x).toBe(470)
  expect(result.y).toBe(470)
  canvas.assertNoErrors()
})

test('dragging over target frame sets drop target highlight', async () => {
  const ids = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')

    store.state.panX = 0
    store.state.panY = 0
    store.state.zoom = 1

    const pageId = store.state.currentPageId
    const sourceFrame = store.graph.createNode('FRAME', pageId, {
      name: 'Source Frame',
      x: 50,
      y: 50,
      width: 200,
      height: 200
    })

    const targetFrame = store.graph.createNode('FRAME', pageId, {
      name: 'Target Frame',
      x: 350,
      y: 50,
      width: 200,
      height: 200
    })

    const box = store.graph.createNode('RECTANGLE', sourceFrame.id, {
      name: 'Box',
      x: 20,
      y: 20,
      width: 50,
      height: 50
    })

    store.select([box.id])
    store.requestRender()
    return { page: pageId, sourceFrame: sourceFrame.id, targetFrame: targetFrame.id, box: box.id }
  })
  await canvas.waitForRender()

  const boxBounds = await page.getByTestId('canvas-element').boundingBox()
  if (!boxBounds) throw new Error('No canvas element')

  // Move pointer over target frame and check dropTargetId mid-drag
  await page.mouse.move(boxBounds.x + 95, boxBounds.y + 95)
  await page.mouse.down()
  await page.mouse.move(boxBounds.x + 450, boxBounds.y + 150, { steps: 8 })
  await canvas.waitForRender()

  const dropTargetId = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    return store?.state?.dropTargetId
  })
  expect(dropTargetId).toBe(ids.targetFrame)

  await page.mouse.up()
  await canvas.waitForRender()

  const finalParent = await page.evaluate((boxId) => {
    const store = window.openPencil?.getStore?.()
    return store?.graph?.getNode(boxId)?.parentId
  }, ids.box)
  expect(finalParent).toBe(ids.targetFrame)
  canvas.assertNoErrors()
})
